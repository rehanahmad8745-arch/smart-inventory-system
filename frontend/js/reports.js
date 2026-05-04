// frontend/js/reports.js
// Reports page: revenue stats, category doughnut, monthly grid, best sellers, email

let categoryChartInst = null;

async function loadReports() {
    const [dashRes, salesRes, purRes] = await Promise.all([
        API.getDashboard(),
        API.getSales(),
        API.getPurchases()
    ]);
    if (!dashRes?.success) { toast('Failed to load report data', 'error'); return; }

    const d = dashRes.data;
    const totalRevenue  = (salesRes?.data || []).reduce((a, b) => a + parseFloat(b.total_amount), 0);
    const totalPurchase = (purRes?.data  || []).reduce((a, b) => a + parseFloat(b.total_amount), 0);

    // ── Stat Cards ───────────────────────────────────────────
    document.getElementById('rep-revenue').textContent  = fmt(totalRevenue);
    document.getElementById('rep-purchase').textContent = fmt(totalPurchase);
    document.getElementById('rep-profit').textContent   = fmt(totalRevenue * 0.38);
    document.getElementById('rep-bills').textContent    = (salesRes?.data?.length || 0) + ' bills';

    // ── Category Doughnut Chart ──────────────────────────────
    const cats   = d.categoryBreakdown.map(c => c.category || 'Other');
    const catVals= d.categoryBreakdown.map(c => parseFloat(c.revenue));
    const COLORS = ['#6c63ff','#22c55e','#f59e0b','#3b82f6','#ef4444','#8b5cf6','#06b6d4','#ec4899'];
    const ctx = document.getElementById('chart-category').getContext('2d');
    if (categoryChartInst) categoryChartInst.destroy();
    if (cats.length) {
        categoryChartInst = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: cats,
                datasets: [{ data: catVals, backgroundColor: COLORS, borderColor: '#16161d', borderWidth: 2 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: true, position: 'bottom', labels: { color: '#8888a8', font: { size: 11 }, padding: 10 } } }
            }
        });
    } else {
        ctx.canvas.parentElement.innerHTML = '<div class="loading-row" style="color:var(--text3);">No category data yet</div>';
    }

    // ── Best Selling Articles ────────────────────────────────
    const bestTbody = document.getElementById('rep-best-selling');
    if (!d.fastSelling.length) {
        bestTbody.innerHTML = '<tr><td colspan="3" class="loading-row" style="color:var(--text3);">No sales data</td></tr>';
    } else {
        bestTbody.innerHTML = d.fastSelling.map((item, i) => `
            <tr>
                <td style="font-family:'Space Mono',monospace;color:var(--text3);">${i + 1}</td>
                <td>${item.item_name}</td>
                <td><span class="badge badge-purple">${item.total_sold} pcs</span></td>
            </tr>`).join('');
    }

    // ── Monthly Performance Grid ─────────────────────────────
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthMap = {};
    d.monthlyRevenue.forEach(m => { monthMap[m.month] = parseFloat(m.revenue); });

    const grid = document.getElementById('rep-monthly-grid');
    const year = new Date().getFullYear();
    grid.innerHTML = monthNames.map((mn, i) => {
        const key = `${year}-${String(i + 1).padStart(2, '0')}`;
        const rev = monthMap[key] || 0;
        return `
            <div style="text-align:center;padding:12px 8px;background:var(--bg3);border-radius:8px;border:1px solid var(--border);">
                <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">${mn}</div>
                <div style="font-size:13px;font-weight:600;color:${rev > 0 ? 'var(--text)' : 'var(--text3)'};font-family:'Space Mono',monospace;">
                    ${rev > 0 ? '₹' + (rev / 1000).toFixed(0) + 'k' : '—'}
                </div>
            </div>`;
    }).join('');
}

// ── Send Email ────────────────────────────────────────────────────────────
async function sendEmail() {
    const btn = document.getElementById('email-btn');
    btn.disabled = true;
    btn.textContent = 'Sending...';
    const res = await API.sendEmail();
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg> Send Daily Report Email`;
    if (res?.success) {
        toast('✅ Daily report email sent successfully!', 'success', 5000);
    } else {
        toast('❌ Email failed: ' + (res?.error || 'Check .env email settings'), 'error', 6000);
    }
}
