// frontend/js/app.js — Login, routing, sidebar, socket.io

let socket = null;
let stockCache = [];

// ── Login ────────────────────────────────────────────────────────────────
function setLoginRole(role) {
    document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.login-tab[data-role="${role}"]`).classList.add('active');
    document.getElementById('login-hint').textContent =
        role === 'admin' ? 'Hint: admin / password' : 'Hint: staff / password';
    document.getElementById('login-username').value = role;
}

async function doLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const errEl    = document.getElementById('login-error');
    errEl.classList.add('hidden');
    if (!username || !password) { errEl.textContent = 'Username and password required'; errEl.classList.remove('hidden'); return; }
    const res = await API.login({ username, password });
    if (!res?.success) { errEl.textContent = res?.message || 'Login failed'; errEl.classList.remove('hidden'); return; }
    Auth.setToken(res.token);
    Auth.setUser(res.user);
    bootApp(res.user);
}

function doLogout() { Auth.logout(); }

// ── Boot app ─────────────────────────────────────────────────────────────
async function bootApp(user) {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');

    // Sidebar user info
    document.getElementById('user-avatar').textContent        = user.name[0].toUpperCase();
    document.getElementById('user-name-display').textContent  = user.name;
    document.getElementById('user-role-display').textContent  = user.role === 'admin' ? 'Administrator' : 'Staff';

    // Hide admin-only nav items for staff
    if (user.role !== 'admin') {
        document.getElementById('nav-users')?.classList.add('hidden');
        document.getElementById('nav-business')?.classList.add('hidden');
        document.getElementById('admin-nav-section')?.classList.add('hidden');
    }

    // Load business name for sidebar
    try {
        const biz = await API.getBusiness();
        if (biz?.success && biz.data?.business_name) {
            const n = biz.data.business_name;
            document.getElementById('sidebar-logo-name').textContent = '⬡ ' + (n.length > 13 ? n.substring(0,13)+'…' : n);
            window._bizProfile = biz.data;
        }
    } catch(e) {}

    connectSocket();
    setDateDefaults();
    navigateTo('dashboard');
}

// ── Page navigation ───────────────────────────────────────────────────────
function navigateTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item[data-page]').forEach(n => n.classList.remove('active'));
    document.getElementById('page-' + page)?.classList.add('active');
    document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');

    const loaders = {
        dashboard: loadDashboard,
        sales:     loadSales,
        purchase:  loadPurchases,
        stock:     loadStock,
        reports:   loadReports,
        ai:        loadAIPage,
        users:     loadUsers,
        business:  loadBusiness,
    };
    loaders[page]?.();
}

// ── Socket.IO realtime ─────────────────────────────────────────────────────
function connectSocket() {
    socket = io();
    socket.on('connect', () => console.log('🔌 Realtime connected'));
    socket.on('sale:new', (data) => {
        toast(`New sale — ${data.customer_name} (${fmt(data.total)})`, 'success');
        if (document.getElementById('page-dashboard').classList.contains('active')) loadDashboard();
    });
    socket.on('purchase:new', (data) => {
        toast(`New purchase — ${data.supplier_name} (${fmt(data.total)})`, 'info');
    });
    socket.on('stock:lowAlert', (items) => {
        if (items.length > 0) {
            const el = document.getElementById('dash-low-count');
            if (el) { el.textContent = items.length + ' items low stock'; el.className = 'stat-change down'; }
        }
    });
}

// ── Modal helpers ──────────────────────────────────────────────────────────
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }

// ── Utility ────────────────────────────────────────────────────────────────
function setDateDefaults() {
    const t = today();
    ['sale-date','pur-date'].forEach(id => { const el = document.getElementById(id); if(el) el.value = t; });
}

// ── Auto-login check on page load ──────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    const user  = Auth.getUser();
    const token = Auth.getToken();
    if (user && token) { bootApp(user); }
    else {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
    }
});
