// backend/routes/purchases.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/purchases
router.get('/', async (req, res) => {
    try {
        const { from, to, supplier } = req.query;
        let sql = `SELECT p.*, u.name AS created_by_name,
                   (SELECT COUNT(*) FROM purchase_items WHERE purchase_id = p.id) AS item_count
                   FROM purchases p LEFT JOIN users u ON u.id = p.created_by WHERE 1=1`;
        const params = [];
        if (from)     { sql += ' AND p.purchase_date >= ?'; params.push(from); }
        if (to)       { sql += ' AND p.purchase_date <= ?'; params.push(to); }
        if (supplier) { sql += ' AND p.supplier_name LIKE ?'; params.push('%'+supplier+'%'); }
        sql += ' ORDER BY p.created_at DESC';
        const [rows] = await db.query(sql, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/purchases/:id
router.get('/:id', async (req, res) => {
    try {
        const [purchases] = await db.query('SELECT * FROM purchases WHERE id = ?', [req.params.id]);
        if (!purchases.length) return res.status(404).json({ success: false, message: 'Not found' });
        const [items] = await db.query('SELECT * FROM purchase_items WHERE purchase_id = ?', [req.params.id]);
        res.json({ success: true, data: { ...purchases[0], items } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/purchases
router.post('/', async (req, res) => {
    const { supplier_name, voucher_no, purchase_date, narration, items } = req.body;
    if (!supplier_name || !items || !items.length)
        return res.status(400).json({ success: false, message: 'supplier_name and items required' });

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Validate items
        for (const item of items) {
            if (!item.stock_id) throw new Error('Each item needs stock_id');
            if (item.qty <= 0)  throw new Error('Quantity must be > 0');
            if (item.rate <= 0) throw new Error('Rate must be > 0');
        }

        const [rows] = await conn.query(`SELECT COUNT(*) as cnt FROM purchases`);
        const voucher = voucher_no || `P-${String(1001 + rows[0].cnt).padStart(5, '0')}`;

        const [pResult] = await conn.query(
            `INSERT INTO purchases (voucher_no, supplier_name, purchase_date, narration, created_by) VALUES (?,?,?,?,?)`,
            [voucher, supplier_name, purchase_date || new Date().toISOString().split('T')[0], narration || null, req.user.id]
        );
        const purchaseId = pResult.insertId;
        let total = 0;

        for (const item of items) {
            const lineTotal = parseFloat(item.qty) * parseFloat(item.rate);
            total += lineTotal;
            const [stockRow] = await conn.query('SELECT name FROM stock WHERE id = ?', [item.stock_id]);
            await conn.query(
                `INSERT INTO purchase_items (purchase_id, stock_id, item_name, qty, rate, total) VALUES (?,?,?,?,?,?)`,
                [purchaseId, item.stock_id, stockRow[0].name, item.qty, item.rate, lineTotal]
            );
            // Increase stock
            await conn.query('UPDATE stock SET qty = qty + ? WHERE id = ?', [item.qty, item.stock_id]);
            // Update purchase rate in stock
            await conn.query('UPDATE stock SET purchase_rate = ? WHERE id = ?', [item.rate, item.stock_id]);
        }

        await conn.query('UPDATE purchases SET total_amount = ? WHERE id = ?', [total, purchaseId]);
        await conn.commit();

        const io = req.app.get('io');
        if (io) io.emit('purchase:new', { purchaseId, total, supplier_name });

        res.json({ success: true, purchaseId, voucher, total });
    } catch (err) {
        await conn.rollback();
        if (err.code === 'ER_DUP_ENTRY')
            return res.status(409).json({ success: false, message: 'Voucher number already exists' });
        res.status(500).json({ success: false, message: err.message });
    } finally {
        conn.release();
    }
});

// DELETE /api/purchases/:id — reverse purchase (deduct stock)
router.delete('/:id', async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [items] = await conn.query('SELECT * FROM purchase_items WHERE purchase_id = ?', [req.params.id]);
        for (const item of items) {
            await conn.query('UPDATE stock SET qty = qty - ? WHERE id = ?', [item.qty, item.stock_id]);
        }
        await conn.query('DELETE FROM purchases WHERE id = ?', [req.params.id]);
        await conn.commit();
        res.json({ success: true, message: 'Purchase reversed and stock deducted' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: err.message });
    } finally {
        conn.release();
    }
});

module.exports = router;
