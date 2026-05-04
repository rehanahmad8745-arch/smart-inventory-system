// frontend/js/sales.js
// Sales page: list bills, new sale modal, negative stock validation

let allSales = [];
let saleItemCount = 0;

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

// ── New Sale Modal ────────────────────────────────────────────────────────
function openSaleModal() {
    // Reset
    document.getElementById('sale-customer').value = '';
    document.getElementById('sale-voucher').value = '';
    document.getElementById('sale-date').value = today();
    document.getElementById('sale-narration').value = '';
    document.getElementById('sale-error').textContent = '';
    document.getElementById('sale-items-wrap').innerHTML = '';
    saleItemCount = 0;
    addSaleItem(); // Add one row by default
    openModal('modal-sale');
}

function addSaleItem() {
    const idx = saleItemCount++;
    const wrap = document.getElementById('sale-items-wrap');
    const div = document.createElement('div');
    div.className = 'bill-item';
    div.id = 'sale-item-' + idx;
    // Build stock options from cache
    const opts = stockCache.map(s =>
        `<option value="${s.id}" data-rate="${s.sale_rate}" data-qty="${s.qty}">${s.name} (${s.qty} in stock)</option>`
    ).join('');
    div.innerHTML = `
        <div class="bill-item-grid">
            <select class="form-input" id="si-name-${idx}" onchange="onSaleItemChange(${idx})">
                <option value="">Select item</option>
                ${opts}
            </select>
            <input class="form-input" type="number" id="si-qty-${idx}" value="1" min="1" placeholder="Qty" oninput="recalcSaleTotal()" />
            <input class="form-input" type="number" id="si-rate-${idx}" value="0" placeholder="Rate ₹" oninput="recalcSaleTotal()" />
            <div style="font-size:13px;font-weight:600;color:var(--green);font-family:'Space Mono',monospace;" id="si-total-${idx}">₹0.00</div>
            <button class="btn btn-sm btn-danger" onclick="removeSaleItem(${idx})" style="padding:4px 8px;">✕</button>
        </div>
        <div style="font-size:11px;color:var(--red);margin-top:4px;display:none;" id="si-err-${idx}"></div>`;
    wrap.appendChild(div);
    recalcSaleTotal();
}

function removeSaleItem(idx) {
    document.getElementById('sale-item-' + idx)?.remove();
    recalcSaleTotal();
}

function onSaleItemChange(idx) {
    const sel = document.getElementById('si-name-' + idx);
    const opt = sel.options[sel.selectedIndex];
    if (opt.dataset.rate) {
        document.getElementById('si-rate-' + idx).value = opt.dataset.rate;
    }
    recalcSaleTotal();
}

function recalcSaleTotal() {
    let total = 0;
    document.querySelectorAll('#sale-items-wrap .bill-item').forEach(div => {
        const idx = div.id.replace('sale-item-', '');
        const qty  = parseFloat(document.getElementById('si-qty-' + idx)?.value) || 0;
        const rate = parseFloat(document.getElementById('si-rate-' + idx)?.value) || 0;
        const line = qty * rate;
        total += line;
        const totEl = document.getElementById('si-total-' + idx);
        if (totEl) totEl.textContent = fmt(line);
    });
    document.getElementById('sale-total-display').textContent = 'Total: ' + fmt(total);
}

async function submitSale() {
    const customer = document.getElementById('sale-customer').value.trim();
    const voucher  = document.getElementById('sale-voucher').value.trim();
    const date     = document.getElementById('sale-date').value;
    const narration= document.getElementById('sale-narration').value.trim();
    const errEl    = document.getElementById('sale-error');
    errEl.textContent = '';

    if (!customer) { errEl.textContent = 'Customer name is required'; return; }

    // Collect items
    const items = [];
    let valid = true;
    document.querySelectorAll('#sale-items-wrap .bill-item').forEach(div => {
        const idx   = div.id.replace('sale-item-', '');
        const selEl = document.getElementById('si-name-' + idx);
        const qty   = parseInt(document.getElementById('si-qty-' + idx)?.value) || 0;
        const rate  = parseFloat(document.getElementById('si-rate-' + idx)?.value) || 0;
        const errI  = document.getElementById('si-err-' + idx);
        errI.style.display = 'none';
        if (!selEl?.value) return; // skip empty rows
        if (qty <= 0) { errI.textContent = 'Qty must be > 0'; errI.style.display = 'block'; valid = false; return; }
        items.push({ stock_id: parseInt(selEl.value), qty, rate });
    });

    if (!valid || !items.length) {
        if (!items.length) errEl.textContent = 'Add at least one item';
        return;
    }

    const payload = { customer_name: customer, voucher_no: voucher || undefined, sale_date: date, narration, items };
    const res = await API.createSale(payload);
    if (!res || !res.success) {
        errEl.textContent = res?.errors ? res.errors.join(' | ') : (res?.message || 'Failed to save');
        return;
    }
    toast('Bill saved! Voucher: ' + res.voucher, 'success');
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
