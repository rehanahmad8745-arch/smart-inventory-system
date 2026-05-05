// backend/routes/business.js — Company-aware business profile
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/business — fetch this user's company profile
router.get('/', async (req, res) => {
    try {
        const companyId = req.user.company_id;
        const [rows] = await db.query('SELECT * FROM companies WHERE id = ?', [companyId]);
        res.json({ success: true, data: rows[0] || null });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/business — update company profile (admin only)
router.put('/', adminOnly, async (req, res) => {
    const companyId = req.user.company_id;
    const {
        business_name, owner_name, address, city, state, pincode,
        phone, email, gst_number, pan_number,
        nature, business_category, selling_items,
        sell_online, sell_physical, website_url, established_year
    } = req.body;

    if (!business_name)
        return res.status(400).json({ success: false, message: 'Business name is required' });

    try {
        await db.query(
            `UPDATE companies SET
                business_name=?, owner_name=?, address=?, city=?, state=?, pincode=?,
                phone=?, email=?, gst_number=?, pan_number=?,
                nature=?, business_category=?, selling_items=?,
                sell_online=?, sell_physical=?, website_url=?, established_year=?
             WHERE id = ?`,
            [business_name, owner_name||null, address||null, city||null, state||null, pincode||null,
             phone||null, email||null, gst_number||null, pan_number||null,
             nature||null, business_category||null, selling_items||null,
             sell_online?1:0, sell_physical?1:0, website_url||null, established_year||null,
             companyId]
        );
        res.json({ success: true, message: 'Business profile updated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;