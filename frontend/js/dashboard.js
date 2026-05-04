// frontend/js/dashboard.js
// Dashboard page: stats, charts, fast-selling, low stock, recent bills

let monthlyChartInst = null;

async function loadDashboard() {
    // Set date
    document.getElementById('dash-date').textContent = new Date().toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    const res = await API.getDashboard();
    if (!res || !res.success) {
        toast('Failed to load dashboard', 'error');
        return;
    }
    const d = res.data;

    // ── Stat Cards ───────────────────────────────────────────
    document.getElementById('dash-revenue').textContent  = fmt(d.today.revenue);
    document.getElementById('dash-bills').textContent    = d.today.bills + ' bills today';
    document.getElementById('dash-purchase').textContent = fmt(d.today.purchases);
    document.getElementById('dash-stock').textContent    = fmtQty(d.stock.total_qty) + ' pcs';
    document.getElementById('dash-profit').textContent   = fmt(d.today.revenue * 0.38);

    const lowEl = document.getElementById('dash-low-count');
    lowEl.textContent = d.stock.low_stock_count + ' items low stock';
    lowEl.className = 'stat-change ' + (d.stock.low_stock_count > 0 ? 'down' : 'up');

    // ── Monthly Chart ────────────────────────────────────────
    const months = d.monthlyRevenue.map(m => m.month.slice(5)); // MM
    const revenues = d.monthlyRevenue.map(m => parseFloat(m.revenue));
    const ctx = document.getElementById('chart-monthly').getContext('2d');
    if (monthlyChartInst) monthlyChartInst.destroy();
    monthlyChartInst = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Revenue',
                data: revenues,
                borderColor: '#6c63ff',
                backgroundColor: 'rgba(108,99,255,0.08)',
                fill: true, tension: 0.4,
                pointRadius: 4, pointBackgroundColor: '#6c63ff'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#5a5a72', font: { size: 10 } } },
                y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#5a5a72', font: { size: 10 }, callback: v => '₹' + (v / 1000).toFixed(0) + 'k' } }
            }
        }
    });

    // ── Fast Selling ─────────────────────────────────────────
    const fsEl = document.getElementById('dash-fast-selling');
    if (!d.fastSelling.length) {
        fsEl.innerHTML = '<div class="loading-row" style="color:var(--text3);">No sales data yet</div>';
    } else {
        const max = d.fastSelling[0].total_sold;
        fsEl.innerHTML = d.fastSelling.map((item, i) => `
            <div class="trend-item">
                <div class="trend-rank">#${i + 1}</div>
                <div class="trend-name">${item.item_name}</div>
                <div class="trend-bar-wrap"><div class="trend-bar" style="width:${Math.round(item.total_sold / max * 100)}%"></div></div>
                <div class="trend-qty">${item.total_sold} sold</div>
            </div>`).join('');
    }

    // ── Low Stock Alerts ─────────────────────────────────────
    const lsEl = document.getElementById('dash-low-stock');
    if (!d.lowStockItems.length) {
        lsEl.innerHTML = '<div style="color:var(--green);font-size:13px;padding:8px 0;">✅ All items well-stocked</div>';
    } else {
        lsEl.innerHTML = d.lowStockItems.map(s => `
            <div class="alert-item">
                <div class="alert-name">${s.name}</div>
                <div class="alert-qty">${s.qty} left</div>
            </div>`).join('');
    }

    // ── Recent Bills ─────────────────────────────────────────
    const tbody = document.getElementById('dash-recent-bills');
    if (!d.recentSales.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="loading-row" style="color:var(--text3);">No sales yet</td></tr>';
    } else {
        tbody.innerHTML = d.recentSales.map(s => `
            <tr>
                <td>${s.customer_name}</td>
                <td><span class="tag">${s.voucher_no}</span></td>
                <td><b style="color:var(--green);">${fmt(s.total_amount)}</b></td>
            </tr>`).join('');
    }

    // Cache for AI page
    window._dashData = d;
}
