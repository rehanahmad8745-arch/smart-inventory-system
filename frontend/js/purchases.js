// frontend/js/purchases.js
// Purchases: list + Tally-style Add Purchase Bill modal

let allPurchases = [];
let purItemRows = [];

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

// ── New Purchase Modal (Tally-style) ──────────────────────────────────────────
function openPurchaseModal() {
    document.getElementById('pur-date').value = today();
    document.getElementById('pur-supplier').value = '';
    document.getElementById('pur-voucher').value = '';
    document.getElementById('pur-narration').value = '';
    document.getElementById('pur-error').textContent = '';

    purItemRows = [];
    const tbody = document.getElementById('pur-bill-tbody');
    tbody.innerHTML = '';
    for (let i = 0; i < 13; i++) addPurBillRow();

    recalcPurBill();
    openModal('modal-purchase');

    setTimeout(() => {
        const firstSel = document.querySelector('#pur-bill-tbody .bill-item-sel');
        if (firstSel) firstSel.focus();
    }, 100);
}

function addPurBillRow() {
    const idx = purItemRows.length;
    purItemRows.push(idx);
    const tbody = document.getElementById('pur-bill-tbody');
    const tr = document.createElement('tr');
    tr.id = 'pbr-' + idx;
    tr.className = 'bill-row';

    const opts = stockCache.map(s =>
        `<option value="${s.id}" data-rate="${s.purchase_rate}">${s.name}</option>`
    ).join('');

    tr.innerHTML = `
        <td class="bill-sn">${idx + 1}</td>
        <td class="bill-item-cell">
            <select class="bill-item-sel" id="pb-item-${idx}" onchange="onPurBillItemChange(${idx})">
                <option value="">— Select Item —</option>
                ${opts}
            </select>
        </td>
        <td><input class="bill-num-input" type="number" id="pb-qty-${idx}" value="" placeholder="0" min="0.001" step="0.001" oninput="recalcPurBill()"></td>
        <td>
            <select class="bill-unit-sel" id="pb-unit-${idx}">
                <option>PCS</option><option>KG</option><option>MTR</option><option>BOX</option><option>SET</option>
            </select>
        </td>
        <td><input class="bill-num-input" type="number" id="pb-rate-${idx}" value="" placeholder="0.00" min="0" step="0.01" oninput="recalcPurBill()"></td>
        <td class="bill-amount-cell" id="pb-total-${idx}">0.00</td>
    `;
    tbody.appendChild(tr);

    tr.addEventListener('keydown', function(e) {
        if (e.key === 'Tab' && idx === purItemRows.length - 1 && !e.shiftKey) {
            e.preventDefault();
            addPurBillRow();
            setTimeout(() => {
                const newSel = document.getElementById('pb-item-' + (idx + 1));
                if (newSel) newSel.focus();
            }, 50);
        }
    });
}

function onPurBillItemChange(idx) {
    const sel = document.getElementById('pb-item-' + idx);
    const opt = sel.options[sel.selectedIndex];
    if (opt && opt.dataset.rate) {
        document.getElementById('pb-rate-' + idx).value = parseFloat(opt.dataset.rate).toFixed(2);
        const qtyEl = document.getElementById('pb-qty-' + idx);
        if (!qtyEl.value) qtyEl.value = '1';
        qtyEl.focus();
    }
    recalcPurBill();
}

function recalcPurBill() {
    let total = 0;
    purItemRows.forEach(idx => {
        const qtyEl   = document.getElementById('pb-qty-' + idx);
        const rateEl  = document.getElementById('pb-rate-' + idx);
        const totalEl = document.getElementById('pb-total-' + idx);
        if (!qtyEl) return;
        const qty  = parseFloat(qtyEl.value)  || 0;
        const rate = parseFloat(rateEl?.value) || 0;
        const line = qty * rate;
        total += line;
        if (totalEl) totalEl.textContent = line > 0 ? line.toFixed(2) : '0.00';
    });
    const totEl = document.getElementById('pur-total-display');
    if (totEl) totEl.textContent = '₹' + total.toFixed(2);
}

async function submitPurchase() {
    const supplier  = document.getElementById('pur-supplier').value.trim();
    const voucher   = document.getElementById('pur-voucher').value.trim();
    const date      = document.getElementById('pur-date').value;
    const narration = document.getElementById('pur-narration').value.trim();
    const errEl     = document.getElementById('pur-error');
    errEl.textContent = '';

    if (!supplier) { errEl.textContent = '⚠ Supplier name is required'; return; }

    const items = [];
    purItemRows.forEach(idx => {
        const selEl  = document.getElementById('pb-item-' + idx);
        const qtyEl  = document.getElementById('pb-qty-' + idx);
        const rateEl = document.getElementById('pb-rate-' + idx);
        const unitEl = document.getElementById('pb-unit-' + idx);
        if (!selEl?.value) return;
        const qty  = parseFloat(qtyEl?.value)  || 0;
        const rate = parseFloat(rateEl?.value) || 0;
        if (qty <= 0 || rate <= 0) return;
        items.push({ stock_id: parseInt(selEl.value), qty, unit: unitEl?.value || 'PCS', rate });
    });

    if (!items.length) { errEl.textContent = '⚠ Add at least one valid item'; return; }

    const btn = document.querySelector('#modal-purchase .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    const payload = { supplier_name: supplier, voucher_no: voucher || undefined, purchase_date: date, narration, items };
    const res = await API.createPurchase(payload);

    if (btn) { btn.disabled = false; btn.textContent = 'Save Bill'; }

    if (!res || !res.success) {
        errEl.textContent = '❌ ' + (res?.message || 'Failed to save purchase');
        return;
    }
    toast('✅ Purchase saved! Voucher: ' + res.voucher, 'success');
    closeModal('modal-purchase');
    loadPurchases();
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