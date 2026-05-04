// frontend/js/purchases.js
// Purchase page: list orders, new purchase modal

let allPurchases = [];
let purItemCount = 0;

async function loadPurchases() {
    const res = await API.getPurchases();
    if (!res || !res.success) { toast('Failed to load purchases', 'error'); return; }
    allPurchases = res.data;
    document.getElementById('purchase-count').textContent = allPurchases.length + ' purchase orders';
    renderPurchaseTable(allPurchases);
}

function renderPurchaseTable(purchases) {
    const tbody = document.getElementById('purchase-table-body');
    if (!purchases.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-row" style="color:var(--text3);">No purchases found</td></tr>';
        return;
    }
    tbody.innerHTML = [...purchases].reverse().map(p => `
        <tr>
            <td>${p.supplier_name}</td>
            <td><span class="tag">${p.voucher_no}</span></td>
            <td>${dateLabel(p.purchase_date)}</td>
            <td><span class="badge badge-blue">${p.item_count} item${p.item_count !== 1 ? 's' : ''}</span></td>
            <td><b style="color:var(--amber);">${fmt(p.total_amount)}</b></td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="deletePurchase(${p.id}, '${p.voucher_no}')">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    Reverse
                </button>
            </td>
        </tr>`).join('');
}

// ── New Purchase Modal ────────────────────────────────────────────────────
function openPurchaseModal() {
    document.getElementById('pur-supplier').value = '';
    document.getElementById('pur-voucher').value = '';
    document.getElementById('pur-date').value = today();
    document.getElementById('pur-narration').value = '';
    document.getElementById('pur-error').textContent = '';
    document.getElementById('pur-items-wrap').innerHTML = '';
    purItemCount = 0;
    addPurchaseItem();
    openModal('modal-purchase');
}

function addPurchaseItem() {
    const idx = purItemCount++;
    const wrap = document.getElementById('pur-items-wrap');
    const div = document.createElement('div');
    div.className = 'bill-item';
    div.id = 'pur-item-' + idx;
    const opts = stockCache.map(s =>
        `<option value="${s.id}" data-rate="${s.purchase_rate}">${s.name}</option>`
    ).join('');
    div.innerHTML = `
        <div class="bill-item-grid">
            <select class="form-input" id="pi-name-${idx}" onchange="onPurItemChange(${idx})">
                <option value="">Select item</option>
                ${opts}
            </select>
            <input class="form-input" type="number" id="pi-qty-${idx}" value="1" min="1" placeholder="Qty" oninput="recalcPurTotal()" />
            <input class="form-input" type="number" id="pi-rate-${idx}" value="0" placeholder="Rate ₹" oninput="recalcPurTotal()" />
            <div style="font-size:13px;font-weight:600;color:var(--amber);font-family:'Space Mono',monospace;" id="pi-total-${idx}">₹0.00</div>
            <button class="btn btn-sm btn-danger" onclick="removePurItem(${idx})" style="padding:4px 8px;">✕</button>
        </div>`;
    wrap.appendChild(div);
    recalcPurTotal();
}

function removePurItem(idx) {
    document.getElementById('pur-item-' + idx)?.remove();
    recalcPurTotal();
}

function onPurItemChange(idx) {
    const sel = document.getElementById('pi-name-' + idx);
    const opt = sel.options[sel.selectedIndex];
    if (opt.dataset.rate) {
        document.getElementById('pi-rate-' + idx).value = opt.dataset.rate;
    }
    recalcPurTotal();
}

function recalcPurTotal() {
    let total = 0;
    document.querySelectorAll('#pur-items-wrap .bill-item').forEach(div => {
        const idx  = div.id.replace('pur-item-', '');
        const qty  = parseFloat(document.getElementById('pi-qty-' + idx)?.value) || 0;
        const rate = parseFloat(document.getElementById('pi-rate-' + idx)?.value) || 0;
        const line = qty * rate;
        total += line;
        const totEl = document.getElementById('pi-total-' + idx);
        if (totEl) totEl.textContent = fmt(line);
    });
    document.getElementById('pur-total-display').textContent = 'Total: ' + fmt(total);
}

async function submitPurchase() {
    const supplier  = document.getElementById('pur-supplier').value.trim();
    const voucher   = document.getElementById('pur-voucher').value.trim();
    const date      = document.getElementById('pur-date').value;
    const narration = document.getElementById('pur-narration').value.trim();
    const errEl     = document.getElementById('pur-error');
    errEl.textContent = '';

    if (!supplier) { errEl.textContent = 'Supplier name is required'; return; }

    const items = [];
    document.querySelectorAll('#pur-items-wrap .bill-item').forEach(div => {
        const idx  = div.id.replace('pur-item-', '');
        const sel  = document.getElementById('pi-name-' + idx);
        const qty  = parseInt(document.getElementById('pi-qty-' + idx)?.value) || 0;
        const rate = parseFloat(document.getElementById('pi-rate-' + idx)?.value) || 0;
        if (!sel?.value || qty <= 0 || rate <= 0) return;
        items.push({ stock_id: parseInt(sel.value), qty, rate });
    });

    if (!items.length) { errEl.textContent = 'Add at least one valid item'; return; }

    const payload = { supplier_name: supplier, voucher_no: voucher || undefined, purchase_date: date, narration, items };
    const res = await API.createPurchase(payload);
    if (!res || !res.success) {
        errEl.textContent = res?.message || 'Failed to save purchase';
        return;
    }
    toast('Purchase saved! Voucher: ' + res.voucher, 'success');
    closeModal('modal-purchase');
    loadPurchases();
    // Refresh stock cache
    const stockRes = await API.getStock();
    if (stockRes?.success) stockCache = stockRes.data;
}

async function deletePurchase(id, voucher) {
    if (!confirm(`Reverse purchase ${voucher}? This will deduct stock.`)) return;
    const res = await API.deletePurchase(id);
    if (!res?.success) { toast('Failed to reverse purchase', 'error'); return; }
    toast('Purchase reversed, stock deducted', 'info');
    loadPurchases();
}
