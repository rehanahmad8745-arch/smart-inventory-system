// frontend/js/sales.js
// Sales: list + Tally-style Add Bill modal

let allSales = [];
let saleItemRows = []; // array of row indices

async function loadSales() {
    const res = await API.getSales();
    if (!res || !res.success) { toast('Failed to load sales', 'error'); return; }
    allSales = res.data;
    document.getElementById('sales-count').textContent = allSales.length + ' total bills';
    renderSalesTable(allSales);
}

function renderSalesTable(sales) {
    const tbody = document.getElementById('sales-table-body');
    if (!sales.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-row" style="color:var(--text3);">No sales found</td></tr>';
        return;
    }
    tbody.innerHTML = [...sales].reverse().map(s => `
        <tr>
            <td>${s.customer_name}</td>
            <td><span class="tag">${s.voucher_no}</span></td>
            <td>${dateLabel(s.sale_date)}</td>
            <td><span class="badge badge-purple">${s.item_count} item${s.item_count !== 1 ? 's' : ''}</span></td>
            <td><b style="color:var(--green);">${fmt(s.total_amount)}</b></td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="deleteSale(${s.id}, '${s.voucher_no}')">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    Reverse
                </button>
            </td>
        </tr>`).join('');
}

function filterSales() {
    const q = document.getElementById('sales-search').value.toLowerCase();
    if (!q) { renderSalesTable(allSales); return; }
    renderSalesTable(allSales.filter(s =>
        s.customer_name.toLowerCase().includes(q) || s.voucher_no.toLowerCase().includes(q)
    ));
}

// ── New Sale Modal (Tally-style) ──────────────────────────────────────────────
function openSaleModal() {
    // Set defaults
    document.getElementById('sale-date').value = today();
    document.getElementById('sale-customer').value = '';
    document.getElementById('sale-voucher').value = '';
    document.getElementById('sale-narration').value = '';
    document.getElementById('sale-discount').value = '0';
    document.getElementById('sale-type').value = 'L/GST-No Tax';
    document.getElementById('sale-error').textContent = '';

    // Build item rows
    saleItemRows = [];
    const tbody = document.getElementById('sale-bill-tbody');
    tbody.innerHTML = '';
    // Add 13 empty rows by default (Tally style)
    for (let i = 0; i < 13; i++) addSaleBillRow();

    recalcSaleBill();
    openModal('modal-sale');

    // Focus first item field
    setTimeout(() => {
        const firstSel = document.querySelector('#sale-bill-tbody .bill-item-sel');
        if (firstSel) firstSel.focus();
    }, 100);
}

function addSaleBillRow() {
    const idx = saleItemRows.length;
    saleItemRows.push(idx);
    const tbody = document.getElementById('sale-bill-tbody');
    const tr = document.createElement('tr');
    tr.id = 'sbr-' + idx;
    tr.className = 'bill-row';

    const opts = stockCache.map(s =>
        `<option value="${s.id}" data-rate="${s.sale_rate}" data-qty="${s.qty}">${s.name}</option>`
    ).join('');

    tr.innerHTML = `
        <td class="bill-sn">${idx + 1}</td>
        <td class="bill-item-cell">
            <select class="bill-item-sel" id="sb-item-${idx}" onchange="onSaleBillItemChange(${idx})">
                <option value="">— Select Item —</option>
                ${opts}
            </select>
        </td>
        <td><input class="bill-num-input" type="number" id="sb-qty-${idx}" value="" placeholder="0" min="0.001" step="0.001" oninput="recalcSaleBill()"></td>
        <td>
            <select class="bill-unit-sel" id="sb-unit-${idx}">
                <option>PCS</option><option>KG</option><option>MTR</option><option>BOX</option><option>SET</option>
            </select>
        </td>
        <td><input class="bill-num-input" type="number" id="sb-listprice-${idx}" value="" placeholder="0.00" min="0" step="0.01" oninput="recalcSaleBill()"></td>
        <td><input class="bill-num-input" type="number" id="sb-disc-${idx}" value="0" placeholder="0" min="0" max="100" step="0.01" oninput="recalcSaleBill()"></td>
        <td><input class="bill-num-input" type="number" id="sb-rate-${idx}" value="" placeholder="0.00" min="0" step="0.01" oninput="recalcSaleBill()"></td>
        <td class="bill-amount-cell" id="sb-total-${idx}">0.00</td>
    `;
    tbody.appendChild(tr);

    // Tab from last row → add new row
    tr.addEventListener('keydown', function(e) {
        if (e.key === 'Tab' && idx === saleItemRows.length - 1 && !e.shiftKey) {
            e.preventDefault();
            addSaleBillRow();
            setTimeout(() => {
                const newSel = document.getElementById('sb-item-' + (idx + 1));
                if (newSel) newSel.focus();
            }, 50);
        }
    });
}

function onSaleBillItemChange(idx) {
    const sel = document.getElementById('sb-item-' + idx);
    const opt = sel.options[sel.selectedIndex];
    if (opt && opt.dataset.rate) {
        document.getElementById('sb-listprice-' + idx).value = parseFloat(opt.dataset.rate).toFixed(2);
        document.getElementById('sb-rate-' + idx).value = parseFloat(opt.dataset.rate).toFixed(2);
        const qtyEl = document.getElementById('sb-qty-' + idx);
        if (!qtyEl.value) qtyEl.value = '1';
        qtyEl.focus();
    }
    recalcSaleBill();
}

function recalcSaleBill() {
    let subtotal = 0;
    saleItemRows.forEach(idx => {
        const qtyEl       = document.getElementById('sb-qty-' + idx);
        const listEl      = document.getElementById('sb-listprice-' + idx);
        const discEl      = document.getElementById('sb-disc-' + idx);
        const rateEl      = document.getElementById('sb-rate-' + idx);
        const totalEl     = document.getElementById('sb-total-' + idx);
        if (!qtyEl) return;

        const qty       = parseFloat(qtyEl.value)       || 0;
        const listPrice = parseFloat(listEl.value)      || 0;
        const discPct   = parseFloat(discEl.value)      || 0;
        const rate      = listPrice * (1 - discPct / 100);

        // Auto-update rate when list/disc changes
        if (listPrice > 0 && rateEl) rateEl.value = rate.toFixed(2);

        const lineTotal = qty * (parseFloat(rateEl?.value) || rate);
        subtotal += lineTotal;
        if (totalEl) totalEl.textContent = lineTotal > 0 ? lineTotal.toFixed(2) : '0.00';
    });

    const billDisc = parseFloat(document.getElementById('sale-discount')?.value) || 0;
    const total    = subtotal - billDisc;

    const subEl = document.getElementById('sale-subtotal-display');
    const totEl = document.getElementById('sale-total-display');
    if (subEl) subEl.textContent = '₹' + subtotal.toFixed(2);
    if (totEl) totEl.textContent = '₹' + Math.max(0, total).toFixed(2);
}

async function submitSale() {
    const customer  = document.getElementById('sale-customer').value.trim();
    const voucher   = document.getElementById('sale-voucher').value.trim();
    const date      = document.getElementById('sale-date').value;
    const narration = document.getElementById('sale-narration').value.trim();
    const saleType  = document.getElementById('sale-type').value;
    const discount  = parseFloat(document.getElementById('sale-discount').value) || 0;
    const errEl     = document.getElementById('sale-error');
    errEl.textContent = '';

    if (!customer) { errEl.textContent = '⚠ Party/Customer name is required'; return; }

    // Collect filled rows
    const items = [];
    saleItemRows.forEach(idx => {
        const selEl      = document.getElementById('sb-item-' + idx);
        const qtyEl      = document.getElementById('sb-qty-' + idx);
        const listEl     = document.getElementById('sb-listprice-' + idx);
        const discEl     = document.getElementById('sb-disc-' + idx);
        const rateEl     = document.getElementById('sb-rate-' + idx);
        const unitEl     = document.getElementById('sb-unit-' + idx);
        if (!selEl?.value) return; // skip empty rows
        const qty  = parseFloat(qtyEl?.value) || 0;
        const rate = parseFloat(rateEl?.value) || 0;
        if (qty <= 0 || rate <= 0) return;
        items.push({
            stock_id:   parseInt(selEl.value),
            qty,
            unit:       unitEl?.value || 'PCS',
            list_price: parseFloat(listEl?.value) || rate,
            discount:   parseFloat(discEl?.value) || 0,
            rate
        });
    });

    if (!items.length) { errEl.textContent = '⚠ Add at least one item with quantity and rate'; return; }

    const btn = document.querySelector('#modal-sale .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    const payload = { customer_name: customer, voucher_no: voucher || undefined, sale_date: date, sale_type: saleType, narration, discount, items };
    const res = await API.createSale(payload);

    if (btn) { btn.disabled = false; btn.textContent = 'Save Bill'; }

    if (!res || !res.success) {
        errEl.textContent = '❌ ' + (res?.errors ? res.errors.join(' | ') : (res?.message || 'Failed to save'));
        return;
    }
    toast('✅ Bill saved! Voucher: ' + res.voucher, 'success');
    closeModal('modal-sale');
    loadSales();
    // Refresh stock cache
    const stockRes = await API.getStock();
    if (stockRes?.success) stockCache = stockRes.data;
}

async function deleteSale(id, voucher) {
    if (!confirm(`Reverse sale ${voucher}? This will restore stock.`)) return;
    const res = await API.deleteSale(id);
    if (!res?.success) { toast('Failed to reverse sale', 'error'); return; }
    toast('Sale reversed, stock restored', 'info');
    loadSales();
}