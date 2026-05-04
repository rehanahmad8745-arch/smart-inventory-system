// backend/routes/stock.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/stock — list all stock
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT s.*, c.name AS category_name
             FROM stock s
             LEFT JOIN categories c ON c.id = s.category_id
             ORDER BY s.name ASC`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/stock/low — low stock items
router.get('/low', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT s.*, c.name AS category_name FROM stock s
             LEFT JOIN categories c ON c.id = s.category_id
             WHERE s.qty <= s.low_stock_threshold ORDER BY s.qty ASC`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/stock/:id
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT s.*, c.name AS category_name FROM stock s
             LEFT JOIN categories c ON c.id = s.category_id WHERE s.id = ?`, [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/stock
router.post('/', async (req, res) => {
    const { name, category_id, qty, sale_rate, purchase_rate, low_stock_threshold } = req.body;
    if (!name || sale_rate == null || purchase_rate == null)
        return res.status(400).json({ success: false, message: 'name, sale_rate, purchase_rate required' });
    try {
        const [result] = await db.query(
            `INSERT INTO stock (name, category_id, qty, sale_rate, purchase_rate, low_stock_threshold)
             VALUES (?,?,?,?,?,?)`,
            [name, category_id || null, qty || 0, sale_rate, purchase_rate, low_stock_threshold || 5]
        );
        const [newRow] = await db.query('SELECT * FROM stock WHERE id = ?', [result.insertId]);
        res.json({ success: true, data: newRow[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/stock/:id
router.put('/:id', async (req, res) => {
    const { name, category_id, qty, sale_rate, purchase_rate, low_stock_threshold } = req.body;
    try {
        await db.query(
            `UPDATE stock SET name=?, category_id=?, qty=?, sale_rate=?, purchase_rate=?, low_stock_threshold=? WHERE id=?`,
            [name, category_id || null, qty, sale_rate, purchase_rate, low_stock_threshold || 5, req.params.id]
        );
        const [updated] = await db.query('SELECT * FROM stock WHERE id = ?', [req.params.id]);
        res.json({ success: true, data: updated[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/stock/:id
router.delete('/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM stock WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/stock/categories/all
router.get('/categories/all', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM categories ORDER BY name');
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
