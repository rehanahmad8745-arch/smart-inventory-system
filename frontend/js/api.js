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

    console.log("TOKEN =", token);
    console.log("API URL =", API_BASE + endpoint);

    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(API_BASE + endpoint, {
        ...options,
        headers
    });

    const data = await res.json().catch(() => ({
        success: false,
        message: 'Invalid response'
    }));

    console.log("RESPONSE =", data);

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

// ── SVG icon helper ───────────────────────────────────────────────────
function svgIcon(path, size = 16) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
}
const ICONS = {
    dashboard: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
    sales:     "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
    purchase:  "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z",
    stock:     "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
    report:    "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z",
    ai:        "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3M6.343 6.343l-.707-.707M6.343 17.657l-.707.707M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z",
    logout:    "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
    plus:      "M12 5v14M5 12h14",
    trash:     "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
    edit:      "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7",
    search:    "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z",
    email:     "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6",
    alert:     "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01",
};

// ── NEW API CALLS (v2) ────────────────────────────────────────
// Users
API.getUsers       = ()        => apiFetch('/users');
API.createUser     = (body)    => apiFetch('/users', { method:'POST', body: JSON.stringify(body) });
API.updateUser     = (id,body) => apiFetch(`/users/${id}`, { method:'PUT', body: JSON.stringify(body) });
API.deactivateUser = (id)      => apiFetch(`/users/${id}`, { method:'DELETE' });
API.activateUser   = (id)      => apiFetch(`/users/${id}/activate`, { method:'POST' });

// Business Profile
API.getBusiness    = ()        => apiFetch('/business');
API.saveBusiness   = (body)    => apiFetch('/business', { method:'PUT', body: JSON.stringify(body) });

// AI Trends
API.getAITrends    = (cat,items,city) => apiFetch(`/aitrends?category=${encodeURIComponent(cat)}&items=${encodeURIComponent(items||'')}&city=${encodeURIComponent(city||'India')}`);
API.refreshTrends  = (cat)     => apiFetch('/aitrends/refresh', { method:'POST', body: JSON.stringify({ category: cat }) });
