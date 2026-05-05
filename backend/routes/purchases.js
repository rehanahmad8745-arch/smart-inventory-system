// backend/routes/purchases.js — Company-isolated purchases
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/purchases
router.get('/', async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) return res.status(400).json({ success: false, message: 'No company linked. Please logout and login again.' });

        const { from, to, supplier } = req.query;
        let sql = `SELECT p.*, u.name AS created_by_name,
                   (SELECT COUNT(*) FROM purchase_items WHERE purchase_id = p.id) AS item_count
                   FROM purchases p LEFT JOIN users u ON u.id = p.created_by
                   WHERE p.company_id = ?`;
        const params = [companyId];
        if (from)     { sql += ' AND p.purchase_date >= ?';    params.push(from); }
        if (to)       { sql += ' AND p.purchase_date <= ?';    params.push(to); }
        if (supplier) { sql += ' AND p.supplier_name LIKE ?';  params.push('%' + supplier + '%'); }
        sql += ' ORDER BY p.created_at DESC';
        const [rows] = await db.query(sql, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/purchases/:id — with items
router.get('/:id', async (req, res) => {
    try {
        const companyId = req.user.company_id;
        const [purchases] = await db.query('SELECT * FROM purchases WHERE id = ? AND company_id = ?', [req.params.id, companyId]);
        if (!purchases.length) return res.status(404).json({ success: false, message: 'Not found' });
        const [items] = await db.query('SELECT * FROM purchase_items WHERE purchase_id = ?', [req.params.id]);
        res.json({ success: true, data: { ...purchases[0], items } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/purchases — Create purchase bill
router.post('/', async (req, res) => {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ success: false, message: 'No company linked. Please logout and login again.' });

    const { supplier_name, voucher_no, purchase_date, narration, discount, items } = req.body;
    if (!supplier_name || !items || !items.length)
        return res.status(400).json({ success: false, message: 'Supplier name and at least one item required' });

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Validate all items belong to this company
        const errors = [];
        for (const item of items) {
            if (!item.stock_id) { errors.push('Each item needs a stock item selected'); continue; }
            if (item.qty <= 0)  { errors.push('Quantity must be greater than 0'); continue; }
            if (item.rate <= 0) { errors.push('Rate must be greater than 0'); continue; }
            const [stockCheck] = await conn.query('SELECT id FROM stock WHERE id = ? AND company_id = ?', [item.stock_id, companyId]);
            if (!stockCheck.length) errors.push(`Item ID ${item.stock_id} not found in your company stock`);
        }
        if (errors.length) { await conn.rollback(); return res.status(400).json({ success: false, message: errors.join(' | ') }); }

        // Auto voucher (company-scoped)
        const [cnt] = await conn.query('SELECT COUNT(*) as c FROM purchases WHERE company_id = ?', [companyId]);
        const voucher = voucher_no || `P-${String(1001 + cnt[0].c).padStart(5, '0')}`;

        let subtotal = 0;
        for (const item of items) subtotal += parseFloat(item.qty) * parseFloat(item.rate);
        const disc   = parseFloat(discount) || 0;
        const netAmt = Math.max(0, subtotal - disc);

        const [pResult] = await conn.query(
            `INSERT INTO purchases (company_id, voucher_no, supplier_name, purchase_date, narration, discount, total_amount, net_amount, created_by)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [companyId, voucher, supplier_name, purchase_date || new Date().toISOString().split('T')[0],
             narration || null, disc, subtotal, netAmt, req.user.id]
        );
        const purchaseId = pResult.insertId;

        for (const item of items) {
            const lineTotal = parseFloat(item.qty) * parseFloat(item.rate);
            const [stockRow] = await conn.query('SELECT name FROM stock WHERE id = ?', [item.stock_id]);
            await conn.query(
                `INSERT INTO purchase_items (purchase_id, stock_id, item_name, qty, unit, rate, total)
                 VALUES (?,?,?,?,?,?,?)`,
                [purchaseId, item.stock_id, stockRow[0].name, item.qty, item.unit || 'PCS', item.rate, lineTotal]
            );
            // ADD stock on purchase
            await conn.query('UPDATE stock SET qty = qty + ?, purchase_rate = ? WHERE id = ? AND company_id = ?',
                [item.qty, item.rate, item.stock_id, companyId]);
        }

        await conn.commit();

        const io = req.app.get('io');
        if (io) io.emit('purchase:new', { purchaseId, total: netAmt, supplier_name, company_id: companyId });

        res.json({ success: true, purchaseId, voucher, total: subtotal, net: netAmt });
    } catch (err) {
        await conn.rollback();
        if (err.code === 'ER_DUP_ENTRY')
            return res.status(409).json({ success: false, message: 'Voucher number already exists. Leave blank for auto-generate.' });
        res.status(500).json({ success: false, message: err.message });
    } finally {
        conn.release();
    }
});

// DELETE /api/purchases/:id — Reverse purchase
router.delete('/:id', async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const companyId = req.user.company_id;
        const [purch] = await conn.query('SELECT id FROM purchases WHERE id = ? AND company_id = ?', [req.params.id, companyId]);
        if (!purch.length) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Purchase not found' }); }
        const [items] = await conn.query('SELECT * FROM purchase_items WHERE purchase_id = ?', [req.params.id]);
        for (const item of items) {
            await conn.query('UPDATE stock SET qty = qty - ? WHERE id = ? AND company_id = ?', [item.qty, item.stock_id, companyId]);
        }
        await conn.query('DELETE FROM purchases WHERE id = ?', [req.params.id]);
        await conn.commit();
        res.json({ success: true, message: 'Purchase reversed, stock deducted' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: err.message });
    } finally {
        conn.release();
    }
});

module.exports = router;