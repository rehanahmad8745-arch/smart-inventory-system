// backend/routes/auth.js — Company-aware auth
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
        const [rows] = await db.query('SELECT * FROM users WHERE username = ? AND is_active = 1', [username]);
        if (!rows.length)
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        const user = rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match)
            return res.status(401).json({ success: false, message: 'Invalid username or password' });

        // ── KEY FIX: include company_id in JWT ──
        const token = jwt.sign(
            {
                id:         user.id,
                company_id: user.company_id,   // ← THIS is what routes need
                username:   user.username,
                name:       user.name,
                role:       user.role,
                email:      user.email
            },
            process.env.JWT_SECRET || 'stocksense_secret_key',
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        res.json({
            success: true,
            token,
            user: {
                id:         user.id,
                company_id: user.company_id,
                name:       user.name,
                username:   user.username,
                role:       user.role
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/auth/register-company — Create new company + admin user
router.post('/register-company', async (req, res) => {
    const { name, username, password, email, bizname } = req.body;
    if (!name || !username || !password || !bizname)
        return res.status(400).json({ success: false, message: 'Company name, your name, username and password are required' });
    if (password.length < 6)
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Check username unique
        const [existing] = await conn.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existing.length)
            return res.status(409).json({ success: false, message: 'Username already taken. Choose another.' });

        // 1. Create company
        const [compResult] = await conn.query(
            `INSERT INTO companies (business_name, owner_name, email, business_category, nature, selling_items, sell_physical)
             VALUES (?, ?, ?, 'Garments', 'Retail', '', 1)`,
            [bizname, name, email || null]
        );
        const companyId = compResult.insertId;

        // 2. Seed default categories for this company
        const cats = ['Shirts','Jeans','Jackets','Dresses','Trousers','Knitwear','Accessories','Footwear','Sportswear','Ethnic'];
        for (const cat of cats) {
            await conn.query('INSERT IGNORE INTO categories (company_id, name) VALUES (?,?)', [companyId, cat]);
        }

        // 3. Create admin user linked to company
        const hash = await bcrypt.hash(password, 10);
        const [userResult] = await conn.query(
            'INSERT INTO users (company_id, name, username, password, role, email) VALUES (?,?,?,?,?,?)',
            [companyId, name, username, hash, 'admin', email || null]
        );

        await conn.commit();
        res.json({ success: true, message: `Company "${bizname}" created! Sign in with: ${username}`, userId: userResult.insertId });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: err.message });
    } finally {
        conn.release();
    }
});

module.exports = router;