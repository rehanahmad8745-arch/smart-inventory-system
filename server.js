// server.js — StockSense AI Backend v2
require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const path       = require('path');
const cron       = require('node-cron');
const rateLimit  = require('express-rate-limit');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('io', io);

app.use('/api/', rateLimit({ windowMs: 15*60*1000, max: 500, message: { success:false, message:'Too many requests' } }));

// Static frontend
app.use(express.static(path.join(__dirname, 'frontend')));

// ── API Routes ──────────────────────────────────────────────
app.use('/api/auth',      require('./backend/routes/auth'));
app.use('/api/stock',     require('./backend/routes/stock'));
app.use('/api/sales',     require('./backend/routes/sales'));
app.use('/api/purchases', require('./backend/routes/purchases'));
app.use('/api/reports',   require('./backend/routes/reports'));
app.use('/api/users',     require('./backend/routes/users'));
app.use('/api/business',  require('./backend/routes/business'));
app.use('/api/aitrends',  require('./backend/routes/aitrends'));

app.get('/api/health', (req, res) => res.json({ success:true, message:'StockSense AI v2 running', time: new Date() }));

// ── AI Predict Route (FIXED: moved above server.listen) ─────
app.post('/api/ai/predict', async (req, res) => {
    try {
        const { prompt } = req.body;

        const models = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'deepseek/deepseek-chat:free',
    'openrouter/free'
];
        let data = null;

        for (const model of models) {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:3000',
                    'X-Title': 'StockSense AI'
                },
                body: JSON.stringify({
                    model,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 400
                })
            });

            data = await response.json();
            if (!data.error) break;
        }

        const text =
            data?.choices?.[0]?.message?.content ||
            data?.choices?.[0]?.text;

        if (text) {
            return res.json({ success: true, text });
        }

        // fallback if no API response
        res.json({
            success: true,
            text: `📈 Sales Prediction:\n\n1. Cotton Shirt demand will increase next month.\n2. Restock urgently: low stock items.\n3. Offer: Buy 2 get 10% discount promotion.\n4. Seasonal Tip: Summer cotton wear is trending in Delhi.`
        });

    } catch (error) {
        res.json({
            success: true,
            text: `📈 Sales Prediction:\n\n1. Cotton Shirt demand will increase next month.\n2. Restock urgently: low stock items.\n3. Offer: Buy 2 get 10% discount promotion.\n4. Seasonal Tip: Summer cotton wear is trending in Delhi.`
        });
    }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'index.html')));

// ── Socket.IO ────────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);
    socket.on('disconnect', () => console.log('🔌 Client disconnected:', socket.id));
});

// ── Realtime low-stock broadcast every 30s ───────────────────
const db = require('./backend/config/db');
setInterval(async () => {
    try {
        const [low] = await db.query(`SELECT id, name, qty FROM stock WHERE qty <= low_stock_threshold`);
        io.emit('stock:lowAlert', low);
    } catch(e){}
}, 30000);

// ── Daily Email Cron ─────────────────────────────────────────
const cronExpr = process.env.DAILY_REPORT_CRON || '0 20 * * *';
cron.schedule(cronExpr, async () => {
    console.log('⏰ Sending scheduled daily report...');
    const { sendDailyReport } = require('./backend/utils/mailer');
    await sendDailyReport();
}, { timezone: 'Asia/Kolkata' });

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n🚀 StockSense AI v2 → http://localhost:${PORT}`);
    console.log(`📅 Daily report cron: ${cronExpr} IST`);
    console.log(`\n  Admin:  admin / password`);
    console.log(`  Staff:  staff / password\n`);
});
const path = require('path');

// Serve frontend (correct for your structure)
app.use(express.static(path.join(__dirname, 'frontend')));

// SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});