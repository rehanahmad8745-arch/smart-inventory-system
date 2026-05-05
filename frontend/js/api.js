// frontend/js/api.js — HTTP API wrapper + auth helpers

const API_BASE = '/api';

// ── Token management ──────────────────────────────────────────────────
const Auth = {
    getToken:  ()     => localStorage.getItem('ss_token'),
    setToken:  (t)    => localStorage.setItem('ss_token', t),
    clearToken:()     => localStorage.removeItem('ss_token'),
    getUser:   ()     => { try { return JSON.parse(localStorage.getItem('ss_user')); } catch { return null; } },
    setUser:   (u)    => localStorage.setItem('ss_user', JSON.stringify(u)),
    clearUser: ()     => localStorage.removeItem('ss_user'),
    isLoggedIn:()     => !!localStorage.getItem('ss_token'),
    logout: () => {
        localStorage.removeItem('ss_token');
        localStorage.removeItem('ss_user');
        window.location.reload();
    }
};

// ── Core fetch wrapper ────────────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
    const token = Auth.getToken();
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(API_BASE + endpoint, { ...options, headers });
    const data = await res.json().catch(() => ({ success: false, message: 'Invalid response' }));
    if (res.status === 401) {
        Auth.logout();
        return;
    }
    return data;
}

// ── API calls ────────────────────────────────────────────────────────
const API = {
    // Auth
    login:    (body) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    register: (body) => apiFetch('/auth/register-company', { method: 'POST', body: JSON.stringify(body) }),

    // Stock
    getStock:       ()       => apiFetch('/stock'),
    getLowStock:    ()       => apiFetch('/stock/low'),
    createStock:    (body)   => apiFetch('/stock', { method: 'POST', body: JSON.stringify(body) }),
    updateStock:    (id, b)  => apiFetch(`/stock/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
    deleteStock:    (id)     => apiFetch(`/stock/${id}`, { method: 'DELETE' }),
    getCategories:  ()       => apiFetch('/stock/categories/all'),

    // Sales
    getSales:       (q = '') => apiFetch('/sales' + (q ? '?' + q : '')),
    getSale:        (id)     => apiFetch(`/sales/${id}`),
    createSale:     (body)   => apiFetch('/sales', { method: 'POST', body: JSON.stringify(body) }),
    deleteSale:     (id)     => apiFetch(`/sales/${id}`, { method: 'DELETE' }),

    // Purchases
    getPurchases:   (q = '') => apiFetch('/purchases' + (q ? '?' + q : '')),
    createPurchase: (body)   => apiFetch('/purchases', { method: 'POST', body: JSON.stringify(body) }),
    deletePurchase: (id)     => apiFetch(`/purchases/${id}`, { method: 'DELETE' }),

    // Reports
    getDashboard:   ()       => apiFetch('/reports/dashboard'),
    getDaily:       (date)   => apiFetch('/reports/daily?date=' + date),
    getMonthly:     (month)  => apiFetch('/reports/monthly?month=' + month),
    sendEmail:      ()       => apiFetch('/reports/send-email', { method: 'POST' }),

    // Users
    getUsers:       ()        => apiFetch('/users'),
    createUser:     (body)    => apiFetch('/users', { method:'POST', body: JSON.stringify(body) }),
    updateUser:     (id,body) => apiFetch(`/users/${id}`, { method:'PUT', body: JSON.stringify(body) }),
    deactivateUser: (id)      => apiFetch(`/users/${id}`, { method:'DELETE' }),
    activateUser:   (id)      => apiFetch(`/users/${id}/activate`, { method:'POST' }),

    // Business Profile
    getBusiness:    ()        => apiFetch('/business'),
    saveBusiness:   (body)    => apiFetch('/business', { method:'PUT', body: JSON.stringify(body) }),

    // AI Trends
    getAITrends:    (cat,items,city) => apiFetch(`/aitrends?category=${encodeURIComponent(cat)}&items=${encodeURIComponent(items||'')}&city=${encodeURIComponent(city||'India')}`),
    refreshTrends:  (cat)     => apiFetch('/aitrends/refresh', { method:'POST', body: JSON.stringify({ category: cat }) }),

    // Email Settings (NEW)
    getEmailConfig: ()        => apiFetch('/settings/email'),
    saveEmailConfig:(body)    => apiFetch('/settings/email', { method:'POST', body: JSON.stringify(body) }),
};

// ── Toast notifications ───────────────────────────────────────────────
function toast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(100%)'; el.style.transition = '0.3s'; setTimeout(() => el.remove(), 300); }, duration);
}

// ── Format helpers ────────────────────────────────────────────────────
function fmt(n)    { return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 }); }
function fmtQty(n) { return Number(n).toLocaleString('en-IN'); }
function today()   { return new Date().toISOString().split('T')[0]; }
function dateLabel(d) { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }

function svgIcon(path, size = 16) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
}