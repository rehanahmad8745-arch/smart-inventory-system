// backend/routes/settings.js — Email settings API
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const ENV_PATH = path.join(__dirname, '../../.env');

function readEnv() {
    const content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
    const map = {};
    content.split('\n').forEach(line => {
        const [key, ...vals] = line.split('=');
        if (key && key.trim()) map[key.trim()] = vals.join('=').trim();
    });
    return map;
}

function writeEnv(map) {
    const content = Object.entries(map).map(([k, v]) => `${k}=${v}`).join('\n');
    fs.writeFileSync(ENV_PATH, content + '\n', 'utf8');
}

// GET /api/settings/email — return current email config (masked password)
router.get('/email', authMiddleware, adminOnly, (req, res) => {
    try {
        const env = readEnv();
        res.json({
            success: true,
            config: {
                host:       env.EMAIL_HOST || '',
                port:       env.EMAIL_PORT || '587',
                secure:     env.EMAIL_SECURE === 'true',
                user:       env.EMAIL_USER || '',
                recipient:  env.EMAIL_RECIPIENT || env.EMAIL_USER || '',
                cron:       env.DAILY_REPORT_CRON || '0 20 * * *',
                configured: !!(env.EMAIL_HOST && env.EMAIL_USER && env.EMAIL_PASS)
            }
        });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// POST /api/settings/email — save email config to .env
router.post('/email', authMiddleware, adminOnly, (req, res) => {
    try {
        const { host, port, secure, user, pass, recipient, cron } = req.body;

        if (!host || !user) {
            return res.json({ success: false, message: 'SMTP host and email are required' });
        }

        const env = readEnv();

        env.EMAIL_HOST      = host;
        env.EMAIL_PORT      = port || '587';
        env.EMAIL_SECURE    = secure || 'false';
        env.EMAIL_USER      = user;
        if (pass) env.EMAIL_PASS = pass; // only update password if provided
        env.EMAIL_RECIPIENT = recipient || user;
        if (cron) env.DAILY_REPORT_CRON = cron;

        writeEnv(env);

        res.json({
            success: true,
            message: 'Email settings saved. Restart server for changes to take full effect.'
        });

    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

module.exports = router;