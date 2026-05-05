// frontend/js/sp-dashboard.js — Sales & Purchase Dashboard

let spTrendChart = null;
let spSplitChart = null;

async function loadSPDashboard() {
    const days = document.getElementById('sp-period')?.value || 30;

    const [salesRes, purRes] = await Promise.all([
        API.getSales(),
        API.getPurchases()
    ]);

    const sales = salesRes?.data || [];
    const purchases = purRes?.data || [];

    // Filter by period
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(days));

    const filteredSales = sales.filter(s => new Date(s.sale_date) >= cutoff);
    const filteredPurchases = purchases.filter(p => new Date(p.purchase_date) >= cutoff);

    const totalSales = filteredSales.reduce((a, b) => a + parseFloat(b.total_amount), 0);
    const totalPurchase = filteredPurchases.reduce((a, b) => a + parseFloat(b.total_amount), 0);
    const profit = totalSales - totalPurchase;
    const margin = totalSales > 0 ? ((profit / totalSales) * 100).toFixed(1) : 0;
    const avgDay = totalSales / parseInt(days);

    // KPIs
    document.getElementById('sp-total-sales').textContent = fmt(totalSales);
    document.getElementById('sp-sales-count').textContent = filteredSales.length + ' bills';
    document.getElementById('sp-total-purchase').textContent = fmt(totalPurchase);
    document.getElementById('sp-purchase-count').textContent = filteredPurchases.length + ' orders';
    document.getElementById('sp-profit').textContent = fmt(profit);
    document.getElementById('sp-margin').textContent = margin + '% margin';
    document.getElementById('sp-avg-day').textContent = fmt(avgDay);

    // Build daily buckets for chart
    const dateMap = {};
    const addToMap = (date, type, amount) => {
        if (!dateMap[date]) dateMap[date] = { sales: 0, purchase: 0 };
        dateMap[date][type] += parseFloat(amount);
    };

    filteredSales.forEach(s => addToMap(s.sale_date?.split('T')[0] || s.sale_date, 'sales', s.total_amount));
    filteredPurchases.forEach(p => addToMap(p.purchase_date?.split('T')[0] || p.purchase_date, 'purchase', p.total_amount));

    const sortedDates = Object.keys(dateMap).sort();
    const labels = sortedDates.map(d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
    const salesData = sortedDates.map(d => dateMap[d].sales);
    const purchaseData = sortedDates.map(d => dateMap[d].purchase);

    // Trend Chart
    if (spTrendChart) spTrendChart.destroy();
    const trendCtx = document.getElementById('chart-sp-trend').getContext('2d');
    spTrendChart = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Sales',
                    data: salesData,
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34,197,94,0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 3
                },
                {
                    label: 'Purchase',
                    data: purchaseData,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245,158,11,0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#8888a8', font: { size: 11 } } }
            },
            scales: {
                x: { ticks: { color: '#52526a', font: { size: 10 }, maxTicksLimit: 10 }, grid: { color: '#2a2a3a' } },
                y: { ticks: { color: '#52526a', font: { size: 10 }, callback: v => '₹' + (v/1000).toFixed(0) + 'k' }, grid: { color: '#2a2a3a' } }
            }
        }
    });

    // Split Donut
    if (spSplitChart) spSplitChart.destroy();
    const splitCtx = document.getElementById('chart-sp-split').getContext('2d');
    spSplitChart = new Chart(splitCtx, {
        type: 'doughnut',
        data: {
            labels: ['Sales Revenue', 'Purchase Cost', 'Gross Profit'],
            datasets: [{
                data: [totalSales, totalPurchase, Math.max(profit, 0)],
                backgroundColor: ['#22c55e', '#f59e0b', '#6c63ff'],
                borderColor: '#16161d',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#8888a8', font: { size: 11 }, padding: 10 }
                }
            }
        }
    });

    // Sales Table
    const salesBody = document.getElementById('sp-sales-body');
    if (!filteredSales.length) {
        salesBody.innerHTML = '<tr><td colspan="4" class="loading-row" style="color:var(--text3);">No sales in this period</td></tr>';
    } else {
        salesBody.innerHTML = filteredSales.slice(0, 20).map(s => `
            <tr>
                <td>${dateLabel(s.sale_date?.split('T')[0] || s.sale_date)}</td>
                <td>${s.customer_name}</td>
                <td style="font-family:'Space Mono',monospace;font-size:11px;">${s.voucher_no}</td>
                <td style="color:var(--green);font-weight:600;">${fmt(s.total_amount)}</td>
            </tr>
        `).join('');
    }

    // Purchase Table
    const purchaseBody = document.getElementById('sp-purchase-body');
    if (!filteredPurchases.length) {
        purchaseBody.innerHTML = '<tr><td colspan="4" class="loading-row" style="color:var(--text3);">No purchases in this period</td></tr>';
    } else {
        purchaseBody.innerHTML = filteredPurchases.slice(0, 20).map(p => `
            <tr>
                <td>${dateLabel(p.purchase_date?.split('T')[0] || p.purchase_date)}</td>
                <td>${p.supplier_name}</td>
                <td style="font-family:'Space Mono',monospace;font-size:11px;">${p.voucher_no}</td>
                <td style="color:var(--amber);font-weight:600;">${fmt(p.total_amount)}</td>
            </tr>
        `).join('');
    }

    // Store for export
    window._spData = { filteredSales, filteredPurchases, totalSales, totalPurchase, profit, margin };
}

function exportSPDashboard() {
    if (!window._spData) { toast('Load dashboard data first', 'error'); return; }
    const { filteredSales, filteredPurchases, totalSales, totalPurchase, profit } = window._spData;
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summary = [
        ['StockSense AI — Sales & Purchase Summary'],
        ['Generated:', new Date().toLocaleString('en-IN')],
        [],
        ['Metric', 'Value'],
        ['Total Sales', totalSales.toFixed(2)],
        ['Total Purchase', totalPurchase.toFixed(2)],
        ['Gross Profit', profit.toFixed(2)],
        ['Margin %', ((profit / totalSales) * 100).toFixed(1) + '%'],
        ['Total Bills', filteredSales.length],
        ['Total Orders', filteredPurchases.length],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Summary');

    // Sales sheet
    const salesRows = [['Date', 'Customer', 'Voucher', 'Amount (₹)']];
    filteredSales.forEach(s => salesRows.push([s.sale_date?.split('T')[0] || s.sale_date, s.customer_name, s.voucher_no, parseFloat(s.total_amount)]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(salesRows), 'Sales');

    // Purchase sheet
    const purRows = [['Date', 'Supplier', 'Voucher', 'Amount (₹)']];
    filteredPurchases.forEach(p => purRows.push([p.purchase_date?.split('T')[0] || p.purchase_date, p.supplier_name, p.voucher_no, parseFloat(p.total_amount)]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(purRows), 'Purchases');

    XLSX.writeFile(wb, `StockSense_SP_Dashboard_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast('✅ Excel exported!', 'success');
}