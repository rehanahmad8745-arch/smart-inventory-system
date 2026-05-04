// frontend/js/ai.js — AI Insights: predictions + trend signals

async function loadAIPage() {
    const d = window._dashData;

    // Fast selling
    const fsEl = document.getElementById('ai-fast-selling');
    if (!d?.fastSelling?.length) {
        fsEl.innerHTML = '<div class="loading-row" style="color:var(--text3);">Go to Dashboard first to load data.</div>';
    } else {
        const max = d.fastSelling[0].total_sold;
        fsEl.innerHTML = d.fastSelling.map((item, i) => `
            <div class="trend-item">
                <div class="trend-rank">#${i + 1}</div>
                <div class="trend-name">${item.item_name}</div>
                <div class="trend-bar-wrap">
                    <div class="trend-bar" style="width:${Math.round(item.total_sold / max * 100)}%"></div>
                </div>
                <div class="trend-qty">${item.total_sold} sold</div>
            </div>
        `).join('');
    }

    // Low stock
    const lsEl = document.getElementById('ai-low-stock');
    if (!d?.lowStockItems?.length) {
        lsEl.innerHTML = '<div style="color:var(--green);font-size:13px;padding:8px 0;">✅ All items well-stocked</div>';
    } else {
        lsEl.innerHTML = d.lowStockItems.map(s => `
            <div class="alert-item">
                <div>
                    <div class="alert-name">${s.name}</div>
                    <div style="font-size:11px;color:var(--text3);">Threshold: ${s.low_stock_threshold}</div>
                </div>
                <div style="text-align:right;">
                    <div class="alert-qty">${s.qty} left</div>
                    <div style="font-size:11px;color:var(--text3);">${s.qty === 0 ? 'OUT' : 'Critical'}</div>
                </div>
            </div>
        `).join('');
    }

    // Forecast cards
    const forecasts = [
        { event: 'Summer (May–Jun)', items: 'Light cotton shirts, shorts, summer dresses', score: 92, color: 'var(--amber)' },
        { event: 'Eid & Festivals', items: 'Kurtas, sherwanis, ethnic wear, dupattas', score: 88, color: 'var(--green)' },
        { event: 'Monsoon (Jul–Aug)', items: 'Jackets, casual inners, waterproof accessories', score: 65, color: 'var(--blue)' }
    ];

    document.getElementById('ai-forecast').innerHTML = forecasts.map(f => `
        <div class="card card-sm" style="background:var(--bg3);">
            <div style="font-size:12px;color:var(--text3);margin-bottom:6px;">${f.event}</div>
            <div style="font-size:13px;color:var(--text);margin-bottom:10px;line-height:1.5;">${f.items}</div>
            <div style="display:flex;align-items:center;gap:8px;">
                <div style="flex:1;height:4px;background:var(--border);border-radius:2px;">
                    <div style="width:${f.score}%;height:4px;background:${f.color};border-radius:2px;"></div>
                </div>
                <span style="font-size:11px;color:${f.color};font-weight:600;">${f.score}%</span>
            </div>
        </div>
    `).join('');

    if (window._bizProfile?.business_category) {
        loadAITrends(false);
    }
}

// AI Trends — calls /api/aitrends
async function loadAITrends(forceRefresh = false) {
    const biz = window._bizProfile || {};
    const category = biz.business_category || 'Garments';
    const items = biz.selling_items || '';
    const city = biz.city || 'India';

    const container = document.getElementById('ai-trends-container');
    const metaEl = document.getElementById('ai-trends-meta');
    const cacheEl = document.getElementById('ai-trends-cache-badge');
    const refreshBtn = document.getElementById('ai-refresh-btn');

    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '⏳ Loading...';
    container.innerHTML = `<div class="loading-row">🤖 Fetching live AI trends for "${category}" in ${city}...</div>`;

    try {
        if (forceRefresh) {
            await API.refreshTrends(category);
        }

        const res = await API.getAITrends(category, items, city);

        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '🔄 Refresh Trends';

        // FIXED: Show real error message from server instead of silently failing
        if (!res?.success) {
            container.innerHTML = `
                <div style="color:red;padding:16px;background:#fff1f1;border-radius:8px;border:1px solid #fcc;">
                    <strong>❌ AI Trend Error:</strong><br><br>
                    ${res?.message || 'Unknown error from server'}<br><br>
                    <small style="color:#888;">Check your terminal/console for details. Make sure OPENROUTER_API_KEY is set in your .env file.</small>
                </div>`;
            return;
        }

        if (!res.data) {
            container.innerHTML = `<div class="loading-row" style="color:orange;">⚠️ No trend data returned</div>`;
            return;
        }

        const data = res.data;

        metaEl.textContent = `Category: ${category} · City: ${city}`;
        cacheEl.textContent = res.fromCache ? '📦 Cached' : '✅ Live from AI';
        cacheEl.className = 'badge ' + (res.fromCache ? 'badge-gray' : 'badge-green');

        container.innerHTML = `
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Search Term</th>
                            <th>Volume</th>
                            <th>Trend</th>
                            <th>Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.top_searches.map(t => `
                            <tr>
                                <td>${t.rank}</td>
                                <td>${t.term}</td>
                                <td>${t.volume}</td>
                                <td style="color:${t.trend === 'rising' ? 'var(--green)' : t.trend === 'falling' ? 'red' : 'var(--text3)'}">
                                    ${t.trend === 'rising' ? '↑' : t.trend === 'falling' ? '↓' : '→'} ${t.trend}
                                </td>
                                <td>${t.score}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        if (data.rising_fast?.length) {
            document.getElementById('ai-rising-fast').innerHTML =
                data.rising_fast.map(term =>
                    `<span class="badge badge-green">↑ ${term}</span>`
                ).join('');
        }

        if (data.season_tip) {
            const tipEl = document.getElementById('ai-season-tip');
            if (tipEl) tipEl.textContent = data.season_tip;
        }

        if (data.opportunity) {
            const oppEl = document.getElementById('ai-opportunity');
            if (oppEl) oppEl.textContent = data.opportunity;
        }

        window._trendData = data;

    } catch (err) {
        container.innerHTML = `
            <div style="color:red;padding:16px;">
                <strong>❌ Network Error:</strong> ${err.message}
            </div>`;
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '🔄 Refresh Trends';
    }
}

// AI Prediction — calls /api/ai/predict
async function getAIPrediction() {
    const btn = document.getElementById('ai-btn');
    const content = document.getElementById('ai-content');

    btn.disabled = true;
    btn.textContent = '🤖 Analyzing...';
    content.textContent = 'Connecting to AI...';

    const d = window._dashData;
    const trends = window._trendData;

    const topSold = d?.fastSelling?.slice(0, 5).map(i =>
        `${i.item_name} (${i.total_sold} sold)`
    ).join(', ') || 'No sales data';

    const lowItems = d?.lowStockItems?.map(i =>
        `${i.name} (${i.qty} left)`
    ).join(', ') || 'None';

    const trendStr = trends?.top_searches?.slice(0, 5).map(t =>
        `${t.term} (${t.trend})`
    ).join(', ') || 'Not loaded yet';

    const prompt = `You are a retail business advisor for a store in India.

Store data:
- Top selling items: ${topSold}
- Low stock items: ${lowItems}
- Current market trends: ${trendStr}

Give me 4 specific actionable insights:
1. Next month sales prediction
2. Which items to restock urgently and why
3. A promotion idea to boost sales
4. A seasonal tip for this time of year in India`;

    try {
        const response = await fetch('/api/ai/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        const data = await response.json();

        if (data.success && data.text) {
            content.textContent = data.text;
        } else {
            // FIXED: Show real error message
            content.innerHTML = `<span style="color:red;">❌ Error: ${data.error || data.message || 'No response from AI'}</span>`;
        }

    } catch (err) {
        content.innerHTML = `<span style="color:red;">❌ Network Error: ${err.message}</span>`;
    }

    btn.disabled = false;
    btn.textContent = '🤖 Get AI Prediction';
}
