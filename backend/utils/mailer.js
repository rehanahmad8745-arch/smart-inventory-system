// backend/utils/mailer.js
const nodemailer = require('nodemailer');
const db = require('../config/db');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host:   process.env.EMAIL_HOST,
    port:   parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// ── Verify transporter ───────────────────────────────────────────────────
transporter.verify((err) => {
    if (err) console.warn('⚠️  Email transport not ready:', err.message);
    else     console.log('📧 Email transport ready');
});

// ── Format currency ──────────────────────────────────────────────────────
function fmt(n) {
    return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

// ── Build daily report HTML ──────────────────────────────────────────────
async function buildDailyReportHTML() {
    const today = new Date().toISOString().split('T')[0];

    // Today's sales
    const [sales] = await db.query(
        `SELECT s.*, COUNT(si.id) as item_count
         FROM sales s
         LEFT JOIN sale_items si ON si.sale_id = s.id
         WHERE s.sale_date = ?
         GROUP BY s.id
         ORDER BY s.created_at DESC`, [today]
    );
    const totalRevenue = sales.reduce((a, b) => a + parseFloat(b.total_amount), 0);

    // Low stock alerts
    const [lowStock] = await db.query(
        `SELECT name, qty, low_stock_threshold FROM stock WHERE qty <= low_stock_threshold ORDER BY qty ASC`
    );

    // Top sold today
    const [topSold] = await db.query(
        `SELECT si.item_name, SUM(si.qty) as total_qty, SUM(si.total) as total_rev
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         WHERE s.sale_date = ?
         GROUP BY si.item_name
         ORDER BY total_qty DESC LIMIT 5`, [today]
    );

    // Today's purchases
    const [purchases] = await db.query(
        `SELECT SUM(total_amount) as total FROM purchases WHERE purchase_date = ?`, [today]
    );
    const purchaseTotal = purchases[0]?.total || 0;

    const dateStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const salesRows = sales.length > 0 ? sales.map(s =>
        `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.voucher_no}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.customer_name}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${s.item_count}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600;color:#16a34a;">${fmt(s.total_amount)}</td>
        </tr>`
    ).join('') : `<tr><td colspan="4" style="padding:16px;text-align:center;color:#999;">No sales today</td></tr>`;

    const topRows = topSold.map((t, i) =>
        `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;">#${i+1}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;">${t.item_name}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${t.total_qty} pcs</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;color:#7c3aed;">${fmt(t.total_rev)}</td>
        </tr>`
    ).join('');

    const alertRows = lowStock.map(s =>
        `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #fff2f2;">${s.name}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #fff2f2;text-align:center;">
                <span style="background:#fee2e2;color:#dc2626;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600;">${s.qty} left</span>
            </td>
            <td style="padding:8px 12px;border-bottom:1px solid #fff2f2;color:#dc2626;">${s.qty === 0 ? 'OUT OF STOCK' : 'Restock needed'}</td>
        </tr>`
    ).join('');

    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Daily Sales Report</title></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px;">
<div style="max-width:680px;margin:0 auto;">

    <div style="background:linear-gradient(135deg,#1e1b4b,#4c1d95);padding:32px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:24px;letter-spacing:-0.5px;">⬡ StockSense AI</h1>
        <p style="color:#c4b5fd;margin:6px 0 0;font-size:14px;">Daily Sales Report — ${dateStr}</p>
    </div>

    <div style="background:#fff;padding:24px;display:flex;gap:0;">
        <div style="flex:1;text-align:center;padding:20px;border-right:1px solid #f0f0f0;">
            <div style="font-size:12px;color:#999;text-transform:uppercase;letter-spacing:1px;">Today's Revenue</div>
            <div style="font-size:28px;font-weight:700;color:#16a34a;margin:8px 0;">${fmt(totalRevenue)}</div>
            <div style="font-size:13px;color:#666;">${sales.length} bills</div>
        </div>
        <div style="flex:1;text-align:center;padding:20px;border-right:1px solid #f0f0f0;">
            <div style="font-size:12px;color:#999;text-transform:uppercase;letter-spacing:1px;">Today's Purchases</div>
            <div style="font-size:28px;font-weight:700;color:#d97706;margin:8px 0;">${fmt(purchaseTotal)}</div>
            <div style="font-size:13px;color:#666;">Procurement</div>
        </div>
        <div style="flex:1;text-align:center;padding:20px;">
            <div style="font-size:12px;color:#999;text-transform:uppercase;letter-spacing:1px;">Low Stock Alerts</div>
            <div style="font-size:28px;font-weight:700;color:${lowStock.length>0?'#dc2626':'#16a34a'};margin:8px 0;">${lowStock.length}</div>
            <div style="font-size:13px;color:#666;">${lowStock.length>0?'Items need restock':'All good!'}</div>
        </div>
    </div>

    <div style="background:#fff;padding:0 24px 24px;">
        <h2 style="font-size:16px;font-weight:600;margin:0 0 12px;padding-top:24px;border-top:1px solid #eee;">Sales Bills Today</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
                <tr style="background:#f8f8f8;">
                    <th style="padding:10px 12px;text-align:left;font-size:11px;color:#999;text-transform:uppercase;">Voucher</th>
                    <th style="padding:10px 12px;text-align:left;font-size:11px;color:#999;text-transform:uppercase;">Customer</th>
                    <th style="padding:10px 12px;text-align:center;font-size:11px;color:#999;text-transform:uppercase;">Items</th>
                    <th style="padding:10px 12px;text-align:right;font-size:11px;color:#999;text-transform:uppercase;">Total</th>
                </tr>
            </thead>
            <tbody>${salesRows}</tbody>
        </table>
    </div>

    ${topSold.length > 0 ? `
    <div style="background:#fff;padding:0 24px 24px;">
        <h2 style="font-size:16px;font-weight:600;margin:0 0 12px;padding-top:24px;border-top:1px solid #eee;">🔥 Top Selling Today</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
                <tr style="background:#f8f8f8;">
                    <th style="padding:10px 12px;text-align:left;font-size:11px;color:#999;">#</th>
                    <th style="padding:10px 12px;text-align:left;font-size:11px;color:#999;">Article</th>
                    <th style="padding:10px 12px;text-align:center;font-size:11px;color:#999;">Qty</th>
                    <th style="padding:10px 12px;text-align:right;font-size:11px;color:#999;">Revenue</th>
                </tr>
            </thead>
            <tbody>${topRows}</tbody>
        </table>
    </div>` : ''}

    ${lowStock.length > 0 ? `
    <div style="background:#fff3f3;border:1px solid #fecaca;margin:0 24px 24px;border-radius:8px;padding:16px 24px;">
        <h2 style="font-size:15px;font-weight:600;color:#dc2626;margin:0 0 12px;">⚠️ Low Stock Alerts</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr>
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#dc2626;">Article</th>
                <th style="padding:8px 12px;text-align:center;font-size:11px;color:#dc2626;">Qty</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#dc2626;">Status</th>
            </tr></thead>
            <tbody style="background:#fff;">${alertRows}</tbody>
        </table>
    </div>` : ''}

    <div style="background:#1e1b4b;padding:20px 24px;border-radius:0 0 12px 12px;text-align:center;">
        <p style="color:#a5b4fc;font-size:12px;margin:0;">Generated by StockSense AI • ${process.env.BUSINESS_NAME || 'Your Store'} • ${process.env.BUSINESS_CITY || ''}</p>
    </div>
</div>
</body>
</html>`;
}

// ── Send daily report email ──────────────────────────────────────────────
async function sendDailyReport() {
    const recipients = process.env.DAILY_REPORT_RECIPIENTS || '';
    if (!recipients) {
        console.log('⚠️  No email recipients configured');
        return;
    }
    try {
        const html = await buildDailyReportHTML();
        const today = new Date().toLocaleDateString('en-IN');
        const info = await transporter.sendMail({
            from:    process.env.EMAIL_FROM,
            to:      recipients,
            subject: `📊 Daily Sales Report — ${today} | ${process.env.BUSINESS_NAME || 'StockSense'}`,
            html,
        });
        // Log to DB
        await db.query(
            `INSERT INTO email_logs (type, recipient, subject, status) VALUES (?,?,?,?)`,
            ['daily_report', recipients, `Daily Sales Report — ${today}`, 'sent']
        );
        console.log('📧 Daily report sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (err) {
        console.error('❌ Failed to send daily report:', err.message);
        await db.query(
            `INSERT INTO email_logs (type, recipient, subject, status) VALUES (?,?,?,?)`,
            ['daily_report', recipients, 'Daily Report', 'failed']
        ).catch(() => {});
        return { success: false, error: err.message };
    }
}

// ── Send low stock alert ─────────────────────────────────────────────────
async function sendLowStockAlert(items) {
    const recipients = process.env.DAILY_REPORT_RECIPIENTS || '';
    if (!recipients || !items.length) return;
    const rows = items.map(i => `<li><b>${i.name}</b> — only ${i.qty} left</li>`).join('');
    try {
        await transporter.sendMail({
            from:    process.env.EMAIL_FROM,
            to:      recipients,
            subject: `⚠️ Low Stock Alert — ${items.length} item(s) need restock`,
            html:    `<h2>Low Stock Alert</h2><ul>${rows}</ul><p>Please restock immediately.</p>`,
        });
    } catch (err) {
        console.error('Low stock alert email failed:', err.message);
    }
}

module.exports = { sendDailyReport, sendLowStockAlert, buildDailyReportHTML };
