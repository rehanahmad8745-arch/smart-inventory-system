// backend/routes/users.js
// Manage users & staff — Admin only for create/edit/delete

const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const db      = require('../config/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/users — list all users (admin only)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, name, username, role, email, phone, is_active, created_at
             FROM users ORDER BY role ASC, name ASC`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/users/:id
router.get('/:id', adminOnly, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, name, username, role, email, phone, is_active, created_at FROM users WHERE id = ?`,
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/users — create new user or staff (admin only)
router.post('/', adminOnly, async (req, res) => {
    const { name, username, password, role, email, phone } = req.body;
    if (!name || !username || !password)
        return res.status(400).json({ success: false, message: 'Name, username and password are required' });
    if (!['admin', 'staff'].includes(role))
        return res.status(400).json({ success: false, message: 'Role must be admin or staff' });
    if (password.length < 6)
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    try {
        const hash = await bcrypt.hash(password, 10);
        const [result] = await db.query(
            `INSERT INTO users (name, username, password, role, email, phone) VALUES (?,?,?,?,?,?)`,
            [name, username, hash, role, email || null, phone || null]
        );
        res.json({ success: true, id: result.insertId, message: `${role} created successfully` });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY')
            return res.status(409).json({ success: false, message: 'Username already exists' });
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/users/:id — update user (admin only)
router.put('/:id', adminOnly, async (req, res) => {
    const { name, username, password, role, email, phone, is_active } = req.body;
    try {
        // Build update dynamically (password optional)
        if (password && password.length < 6)
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        const hash = password ? await bcrypt.hash(password, 10) : null;
        if (hash) {
            await db.query(
                `UPDATE users SET name=?, username=?, password=?, role=?, email=?, phone=?, is_active=? WHERE id=?`,
                [name, username, hash, role, email||null, phone||null, is_active??1, req.params.id]
            );
        } else {
            await db.query(
                `UPDATE users SET name=?, username=?, role=?, email=?, phone=?, is_active=? WHERE id=?`,
                [name, username, role, email||null, phone||null, is_active??1, req.params.id]
            );
        }
        res.json({ success: true, message: 'User updated' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY')
            return res.status(409).json({ success: false, message: 'Username already exists' });
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/users/:id — deactivate (cannot delete self)
router.delete('/:id', adminOnly, async (req, res) => {
    if (parseInt(req.params.id) === req.user.id)
        return res.status(400).json({ success: false, message: 'Cannot deactivate your own account' });
    try {
        await db.query(`UPDATE users SET is_active = 0 WHERE id = ?`, [req.params.id]);
        res.json({ success: true, message: 'User deactivated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/users/:id/activate
router.post('/:id/activate', adminOnly, async (req, res) => {
    try {
        await db.query(`UPDATE users SET is_active = 1 WHERE id = ?`, [req.params.id]);
        res.json({ success: true, message: 'User activated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
