// backend/routes/reports.js — Company-isolated reports
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { sendDailyReport } = require('../utils/mailer');

router.use(authMiddleware);

// GET /api/reports/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const companyId = req.user.company_id;
        const today = new Date().toISOString().split('T')[0];

        const [[todaySales]] = await db.query(
            `SELECT COALESCE(SUM(net_amount),0) AS revenue, COUNT(*) AS bills
             FROM sales WHERE sale_date = ? AND company_id = ?`, [today, companyId]);

        const [[todayPurch]] = await db.query(
            `SELECT COALESCE(SUM(net_amount),0) AS total FROM purchases WHERE purchase_date = ? AND company_id = ?`,
            [today, companyId]);

        const [[stockSummary]] = await db.query(
            `SELECT COALESCE(SUM(qty),0) AS total_qty, COUNT(*) AS total_articles FROM stock WHERE company_id = ?`,
            [companyId]);

        const [[lowStockCount]] = await db.query(
            `SELECT COUNT(*) AS cnt FROM stock WHERE company_id = ? AND qty <= low_stock_threshold`,
            [companyId]);

        const [monthlyRevenue] = await db.query(
            `SELECT DATE_FORMAT(sale_date,'%Y-%m') AS month, SUM(net_amount) AS revenue, COUNT(*) AS bills
             FROM sales WHERE company_id = ? AND sale_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
             GROUP BY month ORDER BY month ASC`, [companyId]);

        const [fastSelling] = await db.query(
            `SELECT si.item_name, SUM(si.qty) AS total_sold, SUM(si.total) AS total_rev
             FROM sale_items si JOIN sales s ON s.id = si.sale_id
             WHERE s.company_id = ? AND s.sale_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
             GROUP BY si.item_name ORDER BY total_sold DESC LIMIT 10`, [companyId]);

        const [lowStockItems] = await db.query(
            `SELECT s.id, s.name, s.qty, s.low_stock_threshold, c.name AS category_name
             FROM stock s LEFT JOIN categories c ON c.id = s.category_id
             WHERE s.company_id = ? AND s.qty <= s.low_stock_threshold
             ORDER BY s.qty ASC LIMIT 10`, [companyId]);

        const [recentBills] = await db.query(
            `SELECT id, customer_name, voucher_no, net_amount, sale_date FROM sales
             WHERE company_id = ? ORDER BY created_at DESC LIMIT 8`, [companyId]);

        res.json({
            success: true,
            data: {
                todaySales: { revenue: todaySales.revenue, bills: todaySales.bills },
                todayPurchase: todayPurch.total,
                stock: { total_qty: stockSummary.total_qty, total_articles: stockSummary.total_articles },
                lowStockCount: lowStockCount.cnt,
                monthlyRevenue,
                fastSelling,
                lowStockItems,
                recentBills
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/reports/daily
router.get('/daily', async (req, res) => {
    try {
        const companyId = req.user.company_id;
        const date = req.query.date || new Date().toISOString().split('T')[0];

        const [sales] = await db.query(
            `SELECT s.*, si.item_name, si.qty, si.rate, si.total AS item_total
             FROM sales s JOIN sale_items si ON si.sale_id = s.id
             WHERE s.company_id = ? AND s.sale_date = ?
             ORDER BY s.created_at DESC`, [companyId, date]);

        const [[summary]] = await db.query(
            `SELECT COALESCE(SUM(net_amount),0) AS revenue, COUNT(*) AS bills FROM sales
             WHERE company_id = ? AND sale_date = ?`, [companyId, date]);

        res.json({ success: true, data: { date, sales, summary } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/reports/send-email
router.post('/send-email', async (req, res) => {
    try {
        await sendDailyReport();
        res.json({ success: true, message: 'Email sent successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;