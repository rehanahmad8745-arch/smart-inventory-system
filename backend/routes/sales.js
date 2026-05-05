// backend/routes/sales.js — Company-isolated sales
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/sales
router.get('/', async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) return res.status(400).json({ success: false, message: 'No company linked. Please logout and login again.' });

        const { date, from, to, customer } = req.query;
        let sql = `SELECT s.*, u.name AS created_by_name,
                   (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) AS item_count
                   FROM sales s LEFT JOIN users u ON u.id = s.created_by
                   WHERE s.company_id = ?`;
        const params = [companyId];
        if (date)     { sql += ' AND s.sale_date = ?';        params.push(date); }
        if (from)     { sql += ' AND s.sale_date >= ?';       params.push(from); }
        if (to)       { sql += ' AND s.sale_date <= ?';       params.push(to); }
        if (customer) { sql += ' AND s.customer_name LIKE ?'; params.push('%' + customer + '%'); }
        sql += ' ORDER BY s.created_at DESC';
        const [rows] = await db.query(sql, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/sales/:id — with items
router.get('/:id', async (req, res) => {
    try {
        const companyId = req.user.company_id;
        const [sales] = await db.query('SELECT * FROM sales WHERE id = ? AND company_id = ?', [req.params.id, companyId]);
        if (!sales.length) return res.status(404).json({ success: false, message: 'Not found' });
        const [items] = await db.query('SELECT * FROM sale_items WHERE sale_id = ?', [req.params.id]);
        res.json({ success: true, data: { ...sales[0], items } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/sales — Create sale bill
router.post('/', async (req, res) => {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ success: false, message: 'No company linked. Please logout and login again.' });

    const { customer_name, voucher_no, sale_date, sale_type, narration, discount, items } = req.body;
    if (!customer_name || !items || !items.length)
        return res.status(400).json({ success: false, message: 'Customer name and at least one item required' });

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Stock validation
        const errors = [];
        for (const item of items) {
            const [rows] = await conn.query(
                'SELECT id, name, qty FROM stock WHERE id = ? AND company_id = ? FOR UPDATE',
                [item.stock_id, companyId]
            );
            if (!rows.length) { errors.push(`Item ID ${item.stock_id} not found in your stock`); continue; }
            if (item.qty <= 0) { errors.push(`${rows[0].name}: Qty must be > 0`); continue; }
            if (rows[0].qty < item.qty) errors.push(`${rows[0].name}: Only ${rows[0].qty} in stock, cannot sell ${item.qty}`);
        }
        if (errors.length) { await conn.rollback(); return res.status(400).json({ success: false, message: errors.join(' | '), errors }); }

        // Auto voucher number (company-scoped)
        const [cnt] = await conn.query('SELECT COUNT(*) as c FROM sales WHERE company_id = ?', [companyId]);
        const voucher = voucher_no || `S-${String(1001 + cnt[0].c).padStart(5, '0')}`;

        // Calculate totals
        let subtotal = 0;
        for (const item of items) subtotal += parseFloat(item.qty) * parseFloat(item.rate);
        const disc    = parseFloat(discount) || 0;
        const netAmt  = Math.max(0, subtotal - disc);

        const [saleResult] = await conn.query(
            `INSERT INTO sales (company_id, voucher_no, customer_name, sale_date, sale_type, narration, discount, total_amount, net_amount, created_by)
             VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [companyId, voucher, customer_name, sale_date || new Date().toISOString().split('T')[0],
             sale_type || 'L/GST-No Tax', narration || null, disc, subtotal, netAmt, req.user.id]
        );
        const saleId = saleResult.insertId;

        for (const item of items) {
            const lineTotal = parseFloat(item.qty) * parseFloat(item.rate);
            const [stockRow] = await conn.query('SELECT name FROM stock WHERE id = ?', [item.stock_id]);
            await conn.query(
                `INSERT INTO sale_items (sale_id, stock_id, item_name, qty, unit, list_price, discount, rate, total)
                 VALUES (?,?,?,?,?,?,?,?,?)`,
                [saleId, item.stock_id, stockRow[0].name, item.qty, item.unit || 'PCS',
                 item.list_price || item.rate, item.discount || 0, item.rate, lineTotal]
            );
            await conn.query('UPDATE stock SET qty = qty - ? WHERE id = ? AND company_id = ?', [item.qty, item.stock_id, companyId]);
        }

        await conn.commit();

        const io = req.app.get('io');
        if (io) io.emit('sale:new', { saleId, total: netAmt, customer_name, company_id: companyId });

        res.json({ success: true, saleId, voucher, total: subtotal, net: netAmt });
    } catch (err) {
        await conn.rollback();
        if (err.code === 'ER_DUP_ENTRY')
            return res.status(409).json({ success: false, message: 'Voucher number already exists. Leave blank for auto-generate.' });
        res.status(500).json({ success: false, message: err.message });
    } finally {
        conn.release();
    }
});

// DELETE /api/sales/:id — Reverse sale
router.delete('/:id', async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const companyId = req.user.company_id;
        const [sales] = await conn.query('SELECT id FROM sales WHERE id = ? AND company_id = ?', [req.params.id, companyId]);
        if (!sales.length) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Sale not found' }); }
        const [items] = await conn.query('SELECT * FROM sale_items WHERE sale_id = ?', [req.params.id]);
        for (const item of items) {
            await conn.query('UPDATE stock SET qty = qty + ? WHERE id = ? AND company_id = ?', [item.qty, item.stock_id, companyId]);
        }
        await conn.query('DELETE FROM sales WHERE id = ?', [req.params.id]);
        await conn.commit();
        res.json({ success: true, message: 'Sale reversed and stock restored' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: err.message });
    } finally {
        conn.release();
    }
});

module.exports = router;