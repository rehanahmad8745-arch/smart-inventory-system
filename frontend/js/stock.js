// frontend/js/stock.js
// Stock page: list articles, search, add, edit, delete

let allStock = [];

async function loadStock() {
    // Also load categories for the modal
    const [stockRes, catRes] = await Promise.all([API.getStock(), API.getCategories()]);
    if (!stockRes?.success) { toast('Failed to load stock', 'error'); return; }
    allStock = stockRes.data;
    stockCache = allStock; // update global cache for sales/purchase modals
    document.getElementById('stock-count').textContent = allStock.length + ' articles';
    renderStockTable(allStock);

    // Populate category dropdown in modal
    if (catRes?.success) {
        const sel = document.getElementById('stock-category');
        const existing = Array.from(sel.options).map(o => o.value);
        catRes.data.forEach(c => {
            if (!existing.includes(String(c.id))) {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name;
                sel.appendChild(opt);
            }
        });
    }
}

function renderStockTable(stock) {
    const tbody = document.getElementById('stock-table-body');
    if (!stock.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-row" style="color:var(--text3);">No articles found</td></tr>';
        return;
    }
    tbody.innerHTML = stock.map(s => {
        const margin = s.sale_rate > 0 ? Math.round((s.sale_rate - s.purchase_rate) / s.sale_rate * 100) : 0;
        let qtyBadge;
        if (s.qty === 0)                        qtyBadge = `<span class="badge badge-red">OUT</span>`;
        else if (s.qty <= s.low_stock_threshold) qtyBadge = `<span class="badge badge-red">${s.qty} pcs</span>`;
        else if (s.qty <= s.low_stock_threshold * 2) qtyBadge = `<span class="badge badge-amber">${s.qty} pcs</span>`;
        else                                    qtyBadge = `<span class="badge badge-green">${s.qty} pcs</span>`;
        return `
            <tr>
                <td>${s.name}</td>
                <td><span class="tag">${s.category_name || '—'}</span></td>
                <td>${qtyBadge}</td>
                <td>${fmt(s.sale_rate)}</td>
                <td>${fmt(s.purchase_rate)}</td>
                <td><span style="color:var(--green);font-weight:500;">${margin}%</span></td>
                <td>
                    <div style="display:flex;gap:6px;">
                        <button class="btn btn-sm btn-ghost" onclick='openEditStockModal(${JSON.stringify(s)})'>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteStock(${s.id}, '${s.name.replace(/'/g, "\\'")}')">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </td>
            </tr>`;
    }).join('');
}

function filterStock() {
    const q = document.getElementById('stock-search').value.toLowerCase();
    if (!q) { renderStockTable(allStock); return; }
    renderStockTable(allStock.filter(s =>
        s.name.toLowerCase().includes(q) || (s.category_name || '').toLowerCase().includes(q)
    ));
}

// ── Add Stock Modal ───────────────────────────────────────────────────────
function openAddStockModal() {
    document.getElementById('stock-modal-title').textContent = 'Add New Article';
    document.getElementById('stock-edit-id').value = '';
    document.getElementById('stock-name').value = '';
    document.getElementById('stock-category').value = '';
    document.getElementById('stock-qty').value = '0';
    document.getElementById('stock-sale-rate').value = '0';
    document.getElementById('stock-purchase-rate').value = '0';
    document.getElementById('stock-threshold').value = '5';
    openModal('modal-stock');
}

function openEditStockModal(s) {
    document.getElementById('stock-modal-title').textContent = 'Edit: ' + s.name;
    document.getElementById('stock-edit-id').value = s.id;
    document.getElementById('stock-name').value = s.name;
    document.getElementById('stock-category').value = s.category_id || '';
    document.getElementById('stock-qty').value = s.qty;
    document.getElementById('stock-sale-rate').value = s.sale_rate;
    document.getElementById('stock-purchase-rate').value = s.purchase_rate;
    document.getElementById('stock-threshold').value = s.low_stock_threshold;
    openModal('modal-stock');
}

async function submitStock() {
    const id       = document.getElementById('stock-edit-id').value;
    const name     = document.getElementById('stock-name').value.trim();
    const catId    = document.getElementById('stock-category').value;
    const qty      = parseInt(document.getElementById('stock-qty').value) || 0;
    const saleRate = parseFloat(document.getElementById('stock-sale-rate').value) || 0;
    const purRate  = parseFloat(document.getElementById('stock-purchase-rate').value) || 0;
    const thresh   = parseInt(document.getElementById('stock-threshold').value) || 5;

    if (!name) { toast('Article name is required', 'error'); return; }

    const payload = { name, category_id: catId || null, qty, sale_rate: saleRate, purchase_rate: purRate, low_stock_threshold: thresh };
    let res;
    if (id) {
        res = await API.updateStock(id, payload);
    } else {
        res = await API.createStock(payload);
    }
    if (!res?.success) { toast(res?.message || 'Failed to save', 'error'); return; }
    toast(id ? 'Article updated!' : 'Article added!', 'success');
    closeModal('modal-stock');
    loadStock();
}

async function deleteStock(id, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const res = await API.deleteStock(id);
    if (!res?.success) { toast(res?.message || 'Failed to delete', 'error'); return; }
    toast('Article deleted', 'info');
    loadStock();
}
