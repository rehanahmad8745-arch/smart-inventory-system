// backend/routes/auth.js
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../config/db');

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
        return res.status(400).json({ success: false, message: 'Username and password required' });
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (!rows.length)
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        const user = rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match)
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        const token = jwt.sign(
            { id: user.id, username: user.username, name: user.name, role: user.role, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );
        res.json({ success: true, token, user: { id: user.id, name: user.name, username: user.username, role: user.role } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/auth/register (admin only in prod; open for setup)
router.post('/register', async (req, res) => {
    const { name, username, password, role, email } = req.body;
    if (!name || !username || !password)
        return res.status(400).json({ success: false, message: 'Name, username, password required' });
    try {
        const hash = await bcrypt.hash(password, 10);
        const [result] = await db.query(
            'INSERT INTO users (name, username, password, role, email) VALUES (?,?,?,?,?)',
            [name, username, hash, role || 'staff', email || null]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY')
            return res.status(409).json({ success: false, message: 'Username already exists' });
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
