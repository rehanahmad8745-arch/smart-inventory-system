// frontend/js/export.js — One-click Excel export for any table or reports

// Export any HTML table to Excel
function exportTableExcel(tableId, sheetName) {
    const table = document.getElementById(tableId);
    if (!table) { toast('Table not found', 'error'); return; }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(table);
    XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Sheet1');

    const filename = `StockSense_${sheetName || 'Export'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast('✅ Excel file downloaded!', 'success');
}

// Reports page special export with summary
async function exportReportsExcel() {
    try {
        const [dashRes, salesRes, purRes] = await Promise.all([
            API.getDashboard(),
            API.getSales(),
            API.getPurchases()
        ]);

        const d = dashRes?.data || {};
        const sales = salesRes?.data || [];
        const purchases = purRes?.data || [];

        const totalRevenue = sales.reduce((a, b) => a + parseFloat(b.total_amount), 0);
        const totalPurchase = purchases.reduce((a, b) => a + parseFloat(b.total_amount), 0);

        const wb = XLSX.utils.book_new();

        // ── Sheet 1: Summary ──
        const summaryData = [
            ['StockSense AI — Business Report'],
            ['Generated on:', new Date().toLocaleString('en-IN')],
            [],
            ['FINANCIAL SUMMARY'],
            ['Total Revenue (₹)', totalRevenue.toFixed(2)],
            ['Total Purchase (₹)', totalPurchase.toFixed(2)],
            ['Gross Profit (₹)', (totalRevenue * 0.38).toFixed(2)],
            ['Total Bills', sales.length],
            ['Total Purchase Orders', purchases.length],
            [],
            ['TOP SELLING ARTICLES'],
            ['Rank', 'Item Name', 'Total Sold (pcs)'],
            ...(d.fastSelling || []).map((item, i) => [i + 1, item.item_name, item.total_sold]),
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Summary');

        // ── Sheet 2: All Sales ──
        const salesData = [
            ['Date', 'Customer Name', 'Voucher No.', 'Items', 'Amount (₹)', 'Created At']
        ];
        sales.forEach(s => {
            salesData.push([
                s.sale_date?.split('T')[0] || s.sale_date,
                s.customer_name,
                s.voucher_no,
                s.item_count || '',
                parseFloat(s.total_amount).toFixed(2),
                s.created_at?.split('T')[0] || ''
            ]);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(salesData), 'All Sales');

        // ── Sheet 3: All Purchases ──
        const purchaseData = [
            ['Date', 'Supplier Name', 'Voucher No.', 'Amount (₹)', 'Created At']
        ];
        purchases.forEach(p => {
            purchaseData.push([
                p.purchase_date?.split('T')[0] || p.purchase_date,
                p.supplier_name,
                p.voucher_no,
                parseFloat(p.total_amount).toFixed(2),
                p.created_at?.split('T')[0] || ''
            ]);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(purchaseData), 'All Purchases');

        // ── Sheet 4: Stock ──
        const stockRes = await API.getStock();
        const stock = stockRes?.data || [];
        const stockData = [
            ['Article Name', 'Category', 'Qty', 'Sale Rate (₹)', 'Purchase Rate (₹)', 'Low Stock Threshold', 'Status']
        ];
        stock.forEach(s => {
            stockData.push([
                s.name,
                s.category_name || '',
                s.qty,
                parseFloat(s.sale_rate).toFixed(2),
                parseFloat(s.purchase_rate).toFixed(2),
                s.low_stock_threshold,
                s.qty <= s.low_stock_threshold ? 'LOW STOCK' : 'OK'
            ]);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stockData), 'Stock');

        XLSX.writeFile(wb, `StockSense_Full_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast('✅ Full report exported as Excel!', 'success');

    } catch (err) {
        toast('Export failed: ' + err.message, 'error');
    }
}