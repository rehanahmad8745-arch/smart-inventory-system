// backend/routes/reports.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { sendDailyReport } = require('../utils/mailer');

router.use(authMiddleware);

// GET /api/reports/dashboard — Dashboard summary
router.get('/dashboard', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const month = today.substring(0, 7); // YYYY-MM

        // Today's sales
        const [[todaySales]] = await db.query(
            `SELECT COALESCE(SUM(total_amount),0) AS revenue, COUNT(*) AS bills
             FROM sales WHERE sale_date = ?`, [today]
        );

        // Today's purchases
        const [[todayPurch]] = await db.query(
            `SELECT COALESCE(SUM(total_amount),0) AS total FROM purchases WHERE purchase_date = ?`, [today]
        );

        // Total stock
        const [[stockSummary]] = await db.query(
            `SELECT SUM(qty) AS total_qty, COUNT(*) AS total_articles FROM stock`
        );

        // Low stock count
        const [[lowStockCount]] = await db.query(
            `SELECT COUNT(*) AS cnt FROM stock WHERE qty <= low_stock_threshold`
        );

        // Monthly revenue (last 12 months)
        const [monthlyRevenue] = await db.query(
            `SELECT DATE_FORMAT(sale_date,'%Y-%m') AS month, SUM(total_amount) AS revenue, COUNT(*) AS bills
             FROM sales WHERE sale_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
             GROUP BY month ORDER BY month ASC`
        );

        // Fast selling (top 10 by qty)
        const [fastSelling] = await db.query(
            `SELECT si.item_name, SUM(si.qty) AS total_sold, SUM(si.total) AS total_rev
             FROM sale_items si
             JOIN sales s ON s.id = si.sale_id
             WHERE s.sale_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
             GROUP BY si.item_name ORDER BY total_sold DESC LIMIT 10`
        );

        // Low stock items
        const [lowStockItems] = await db.query(
            `SELECT id, name, qty, low_stock_threshold FROM stock
             WHERE qty <= low_stock_threshold ORDER BY qty ASC LIMIT 10`
        );

        // Recent sales
        const [recentSales] = await db.query(
            `SELECT id, voucher_no, customer_name, sale_date, total_amount
             FROM sales ORDER BY created_at DESC LIMIT 5`
        );

        // Category breakdown
        const [categoryBreakdown] = await db.query(
            `SELECT c.name AS category, SUM(si.total) AS revenue
             FROM sale_items si
             JOIN sales s ON s.id = si.sale_id
             JOIN stock st ON st.id = si.stock_id
             LEFT JOIN categories c ON c.id = st.category_id
             WHERE s.sale_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
             GROUP BY c.name ORDER BY revenue DESC`
        );

        res.json({
            success: true,
            data: {
                today: {
                    revenue: parseFloat(todaySales.revenue),
                    bills: todaySales.bills,
                    purchases: parseFloat(todayPurch.total),
                },
                stock: {
                    total_qty: stockSummary.total_qty || 0,
                    total_articles: stockSummary.total_articles || 0,
                    low_stock_count: lowStockCount.cnt,
                },
                monthlyRevenue,
                fastSelling,
                lowStockItems,
                recentSales,
                categoryBreakdown,
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/reports/daily?date=2025-04-25
router.get('/daily', async (req, res) => {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    try {
        const [sales] = await db.query(
            `SELECT s.*, GROUP_CONCAT(si.item_name SEPARATOR ', ') AS items_list
             FROM sales s LEFT JOIN sale_items si ON si.sale_id = s.id
             WHERE s.sale_date = ? GROUP BY s.id`, [date]
        );
        const [[totals]] = await db.query(
            `SELECT COALESCE(SUM(total_amount),0) AS revenue, COUNT(*) AS bills FROM sales WHERE sale_date = ?`, [date]
        );
        res.json({ success: true, data: { date, sales, totals } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/reports/monthly?month=2025-04
router.get('/monthly', async (req, res) => {
    const month = req.query.month || new Date().toISOString().substring(0, 7);
    try {
        const [daily] = await db.query(
            `SELECT sale_date, SUM(total_amount) AS revenue, COUNT(*) AS bills
             FROM sales WHERE DATE_FORMAT(sale_date,'%Y-%m') = ?
             GROUP BY sale_date ORDER BY sale_date ASC`, [month]
        );
        const [[totals]] = await db.query(
            `SELECT COALESCE(SUM(total_amount),0) AS revenue, COUNT(*) AS bills
             FROM sales WHERE DATE_FORMAT(sale_date,'%Y-%m') = ?`, [month]
        );
        const [topItems] = await db.query(
            `SELECT si.item_name, SUM(si.qty) AS total_qty, SUM(si.total) AS total_rev
             FROM sale_items si JOIN sales s ON s.id = si.sale_id
             WHERE DATE_FORMAT(s.sale_date,'%Y-%m') = ?
             GROUP BY si.item_name ORDER BY total_qty DESC LIMIT 10`, [month]
        );
        res.json({ success: true, data: { month, daily, totals, topItems } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/reports/send-email — Trigger manual daily report email
router.post('/send-email', async (req, res) => {
    try {
        const result = await sendDailyReport();
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
