const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

const CACHE_HOURS = 6;

// GET /api/aitrends
router.get('/', async (req, res) => {
    const category = req.query.category || 'Retail';
    const items = req.query.items || '';
    const city = req.query.city || 'India';

    try {
        // Cache check
        const [cached] = await db.query(`
            SELECT result_json
            FROM ai_trend_cache
            WHERE business_category = ?
            AND cached_at > DATE_SUB(NOW(), INTERVAL ? HOUR)
            LIMIT 1
        `, [category, CACHE_HOURS]);

        if (cached.length) {
            console.log('✅ AI Trends: returning from cache');
            return res.json({
                success: true,
                data: JSON.parse(cached[0].result_json),
                fromCache: true
            });
        }

        // AI call
        console.log('🤖 AI Trends: calling OpenRouter for', category, city);
        const prompt = buildPrompt(category, items, city);
        const { text, error } = await callAI(prompt);

        if (error) {
            console.error('❌ OpenRouter Error:', error);
            return res.json({
                success: false,
                message: 'OpenRouter API error: ' + error,
                data: null
            });
        }

        console.log('✅ OpenRouter raw response:', text?.substring(0, 200));

        let data;
        try {
            const cleaned = text.replace(/```json|```/g, '').trim();
            data = JSON.parse(cleaned);
        } catch (parseErr) {
            console.error('❌ JSON parse failed. Raw text was:', text);
            return res.json({
                success: false,
                message: 'AI returned invalid JSON. Raw: ' + text?.substring(0, 300),
                data: null
            });
        }

        // Save to cache
        await db.query(`
            INSERT INTO ai_trend_cache (business_category, result_json)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE
            result_json = VALUES(result_json),
            cached_at = NOW()
        `, [category, JSON.stringify(data)]).catch(() => {});

        res.json({ success: true, data, fromCache: false });

    } catch (err) {
        console.error('❌ aitrends route error:', err.message);
        res.json({ success: false, message: err.message, data: null });
    }
});

// POST /api/aitrends/refresh — clear cache
router.post('/refresh', async (req, res) => {
    try {
        const { category } = req.body;
        await db.query(
            'DELETE FROM ai_trend_cache WHERE business_category = ?',
            [category || '']
        );
        res.json({ success: true, message: 'Cache cleared' });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// Build Prompt
function buildPrompt(category, items, city) {
    return `You are a retail market analyst. Return ONLY a valid JSON object. No explanation. No markdown. No extra text.

Analyze market trends for a ${category} store in ${city}.
Products they sell: ${items || category + ' products'}.

Return EXACTLY this JSON structure with real trend data for ${city}:
{
  "top_searches": [
    { "rank": 1, "term": "trending product name", "volume": "High", "trend": "rising", "score": 95 },
    { "rank": 2, "term": "trending product name", "volume": "High", "trend": "rising", "score": 88 },
    { "rank": 3, "term": "trending product name", "volume": "Medium", "trend": "stable", "score": 75 },
    { "rank": 4, "term": "trending product name", "volume": "Medium", "trend": "stable", "score": 65 },
    { "rank": 5, "term": "trending product name", "volume": "Low", "trend": "falling", "score": 50 }
  ],
  "rising_fast": ["item1", "item2", "item3"],
  "season_tip": "One sentence seasonal advice.",
  "opportunity": "One sentence business opportunity."
}`;
}

// Call OpenRouter
async function callAI(prompt) {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
        return { text: null, error: 'OPENROUTER_API_KEY is missing from .env file' };
    }

const models = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'deepseek/deepseek-chat:free',
    'openrouter/free',
    'meta-llama/llama-3.1-8b-instruct:free'
];

    for (const model of models) {
        try {
            console.log('🔄 Trying model:', model);

            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:3000',
                    'X-Title': 'StockSense AI'
                },
                body: JSON.stringify({
                    model,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 600
                })
            });

            const data = await response.json();
            console.log('📡 OpenRouter status:', response.status);

            if (data.error) {
                console.warn('⚠️ Model error:', model, data.error.message || data.error);
                continue;
            }

            const text = data?.choices?.[0]?.message?.content;
            if (text) {
                return { text, error: null };
            }

        } catch (fetchErr) {
            console.error('❌ Fetch error for model', model, ':', fetchErr.message);
        }
    }

    return { text: null, error: 'All models failed or could not connect to OpenRouter' };
}

module.exports = router;
