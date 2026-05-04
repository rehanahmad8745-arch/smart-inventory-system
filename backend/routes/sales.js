// backend/routes/sales.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/sales
router.get('/', async (req, res) => {
    try {
        const { date, from, to, customer } = req.query;
        let sql = `SELECT s.*, u.name AS created_by_name,
                   (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) AS item_count
                   FROM sales s LEFT JOIN users u ON u.id = s.created_by WHERE 1=1`;
        const params = [];
        if (date)     { sql += ' AND s.sale_date = ?';          params.push(date); }
        if (from)     { sql += ' AND s.sale_date >= ?';         params.push(from); }
        if (to)       { sql += ' AND s.sale_date <= ?';         params.push(to); }
        if (customer) { sql += ' AND s.customer_name LIKE ?';   params.push('%'+customer+'%'); }
        sql += ' ORDER BY s.created_at DESC';
        const [rows] = await db.query(sql, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/sales/:id
router.get('/:id', async (req, res) => {
    try {
        const [sales] = await db.query('SELECT * FROM sales WHERE id = ?', [req.params.id]);
        if (!sales.length) return res.status(404).json({ success: false, message: 'Not found' });
        const [items] = await db.query('SELECT * FROM sale_items WHERE sale_id = ?', [req.params.id]);
        res.json({ success: true, data: { ...sales[0], items } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/sales — Create new sale bill
router.post('/', async (req, res) => {
    const { customer_name, voucher_no, sale_date, narration, items } = req.body;
    if (!customer_name || !items || !items.length)
        return res.status(400).json({ success: false, message: 'customer_name and items required' });

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // ── NEGATIVE STOCK CHECK ─────────────────────────────────────────
        const stockErrors = [];
        for (const item of items) {
            const [rows] = await conn.query('SELECT id, name, qty FROM stock WHERE id = ? FOR UPDATE', [item.stock_id]);
            if (!rows.length) {
                stockErrors.push(`Item ID ${item.stock_id} not found`);
                continue;
            }
            const s = rows[0];
            if (item.qty <= 0) {
                stockErrors.push(`${s.name}: Quantity must be greater than 0`);
            } else if (s.qty < item.qty) {
                stockErrors.push(`${s.name}: Only ${s.qty} in stock, cannot sell ${item.qty}`);
            }
        }
        if (stockErrors.length) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: 'Stock validation failed', errors: stockErrors });
        }

        // Generate voucher if not provided
        const voucher = voucher_no || await generateVoucher(conn, 'S');

        // Insert sale
        const [saleResult] = await conn.query(
            `INSERT INTO sales (voucher_no, customer_name, sale_date, narration, created_by) VALUES (?,?,?,?,?)`,
            [voucher, customer_name, sale_date || new Date().toISOString().split('T')[0], narration || null, req.user.id]
        );
        const saleId = saleResult.insertId;
        let total = 0;

        // Insert items + deduct stock
        for (const item of items) {
            const lineTotal = parseFloat(item.qty) * parseFloat(item.rate);
            total += lineTotal;
            const [stockRow] = await conn.query('SELECT name FROM stock WHERE id = ?', [item.stock_id]);
            await conn.query(
                `INSERT INTO sale_items (sale_id, stock_id, item_name, qty, rate, total) VALUES (?,?,?,?,?,?)`,
                [saleId, item.stock_id, stockRow[0].name, item.qty, item.rate, lineTotal]
            );
            // Deduct stock (safe — already validated above)
            await conn.query('UPDATE stock SET qty = qty - ? WHERE id = ?', [item.qty, item.stock_id]);
        }

        // Update total
        await conn.query('UPDATE sales SET total_amount = ? WHERE id = ?', [total, saleId]);
        await conn.commit();

        // Emit realtime event
        const io = req.app.get('io');
        if (io) io.emit('sale:new', { saleId, total, customer_name });

        res.json({ success: true, saleId, voucher, total });
    } catch (err) {
        await conn.rollback();
        if (err.code === 'ER_DUP_ENTRY')
            return res.status(409).json({ success: false, message: 'Voucher number already exists' });
        res.status(500).json({ success: false, message: err.message });
    } finally {
        conn.release();
    }
});

// DELETE /api/sales/:id — Reverse sale (restore stock)
router.delete('/:id', async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [items] = await conn.query('SELECT * FROM sale_items WHERE sale_id = ?', [req.params.id]);
        for (const item of items) {
            await conn.query('UPDATE stock SET qty = qty + ? WHERE id = ?', [item.qty, item.stock_id]);
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

async function generateVoucher(conn, prefix) {
    const table = prefix === 'S' ? 'sales' : 'purchases';
    const [rows] = await conn.query(`SELECT COUNT(*) as cnt FROM ${table}`);
    return `${prefix}-${String(1001 + rows[0].cnt).padStart(5, '0')}`;
}

module.exports = router;
