// frontend/js/app.js — Login, routing, sidebar, socket.io

let socket = null;
let stockCache = []; // global stock list used by billing modals

// ── Auth Tab Switcher ─────────────────────────────────────────────────
function showAuthTab(tab) {
    document.querySelectorAll('#login-screen .login-tab').forEach(t => {
        t.classList.toggle('active', t.textContent.toLowerCase().includes(tab === 'login' ? 'sign' : 'new'));
    });
    document.getElementById('auth-login').classList.toggle('hidden', tab !== 'login');
    document.getElementById('auth-register').classList.toggle('hidden', tab !== 'register');
}

function setLoginRole(role) {
    document.querySelectorAll('.login-tab[data-role]').forEach(t => t.classList.remove('active'));
    document.querySelector(`.login-tab[data-role="${role}"]`)?.classList.add('active');
    document.getElementById('login-hint').textContent =
        role === 'admin' ? 'Hint: admin / password' : 'Hint: staff / password';
    document.getElementById('login-username').value = role;
}

// ── Login ─────────────────────────────────────────────────────────────
async function doLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const errEl    = document.getElementById('login-error');
    errEl.classList.add('hidden');

    if (!username || !password) {
        errEl.textContent = 'Username and password required';
        errEl.classList.remove('hidden');
        return;
    }

    const res = await API.login({ username, password });

    if (!res?.success) {
        errEl.textContent = res?.message || 'Login failed';
        errEl.classList.remove('hidden');
        return;
    }

    Auth.setToken(res.token);
    Auth.setUser(res.user);
    bootApp(res.user);
}

// ── Register New Company ──────────────────────────────────────────────
async function doRegister() {
    const name     = document.getElementById('reg-name').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value.trim();
    const email    = document.getElementById('reg-email').value.trim();
    const bizname  = document.getElementById('reg-bizname').value.trim();
    const errEl    = document.getElementById('reg-error');
    const succEl   = document.getElementById('reg-success');

    errEl.classList.add('hidden');
    succEl.classList.add('hidden');

    if (!name || !username || !password || !bizname) {
        errEl.textContent = 'Company name, your name, username and password are required';
        errEl.classList.remove('hidden');
        return;
    }
    if (password.length < 6) {
        errEl.textContent = 'Password must be at least 6 characters';
        errEl.classList.remove('hidden');
        return;
    }

    const res = await API.register({ name, username, password, email, role: 'admin', bizname });

    if (res?.success) {
        succEl.textContent = `✅ Company "${bizname}" created! Sign in with username: ${username}`;
        succEl.classList.remove('hidden');
        setTimeout(() => {
            showAuthTab('login');
            document.getElementById('login-username').value = username;
            document.getElementById('login-password').value = '';
        }, 2000);
    } else {
        errEl.textContent = res?.message || 'Registration failed. Username may already exist.';
        errEl.classList.remove('hidden');
    }
}

function doLogout() { Auth.logout(); }

// ── Boot App ──────────────────────────────────────────────────────────
async function bootApp(user) {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');

    document.getElementById('user-avatar').textContent       = user.name[0].toUpperCase();
    document.getElementById('user-name-display').textContent = user.name;
    document.getElementById('user-role-display').textContent = user.role === 'admin' ? 'Administrator' : 'Staff';

    // Hide admin-only nav items for staff
    if (user.role !== 'admin') {
        document.getElementById('nav-users')?.classList.add('hidden');
        document.getElementById('nav-business')?.classList.add('hidden');
        document.getElementById('nav-email')?.classList.add('hidden');
        document.getElementById('admin-nav-section')?.classList.add('hidden');
    }

    // Load business name for sidebar
    try {
        const biz = await API.getBusiness();
        if (biz?.success && biz.data?.business_name) {
            const n = biz.data.business_name;
            document.getElementById('sidebar-logo-name').textContent =
                '⬡ ' + (n.length > 13 ? n.substring(0, 13) + '…' : n);
            window._bizProfile = biz.data;
        }
    } catch(e) {}

    // ── PRE-LOAD stock cache so billing modals work immediately ──────
    try {
        const stockRes = await API.getStock();
        if (stockRes?.success) {
            stockCache = stockRes.data;
        }
    } catch(e) {}

    connectSocket();
    setDateDefaults();
    navigateTo('dashboard');
}

// ── Page Navigation ───────────────────────────────────────────────────
function navigateTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item[data-page]').forEach(n => n.classList.remove('active'));
    document.getElementById('page-' + page)?.classList.add('active');
    document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');

    const loaders = {
        dashboard:        loadDashboard,
        sales:            loadSales,
        purchase:         loadPurchases,
        stock:            loadStock,
        reports:          loadReports,
        'sp-dashboard':   loadSPDashboard,
        ai:               loadAIPage,
        users:            loadUsers,
        business:         loadBusiness,
        'email-settings': loadEmailSettingsPage,
    };
    loaders[page]?.();
}

// ── Modal helpers — FIXED: openModal was MISSING causing all billing to fail ──
function openModal(id) {
    document.getElementById(id)?.classList.remove('hidden');
}

function closeModal(id) {
    document.getElementById(id)?.classList.add('hidden');
}

// ── Socket.IO Realtime ────────────────────────────────────────────────
function connectSocket() {
    try {
        socket = io();
        socket.on('connect', () => console.log('🔌 Socket connected'));
        socket.on('sale:new', (data) => {
            toast(`New sale — ${data.customer_name} (${fmt(data.total)})`, 'success');
            if (document.getElementById('page-dashboard')?.classList.contains('active')) loadDashboard();
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
    } catch(e) { console.warn('Socket.io not available'); }
}

function setDateDefaults() {
    const t = new Date().toISOString().split('T')[0];
    ['sale-date', 'pur-date'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = t;
    });
}

// ── Auto-login on page load ───────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    const user  = Auth.getUser();
    const token = Auth.getToken();
    if (user && token) {
        bootApp(user);
    }
});

// ── Mobile Sidebar Toggle ──────────────────────────────────────────────
function toggleMobileMenu() {
    const sidebar  = document.querySelector('.sidebar');
    const overlay  = document.getElementById('mob-overlay');
    const isOpen   = sidebar.classList.contains('mob-open');
    if (isOpen) {
        sidebar.classList.remove('mob-open');
        overlay.classList.remove('mob-show');
    } else {
        sidebar.classList.add('mob-open');
        overlay.classList.add('mob-show');
    }
}

function closeMobileMenu() {
    document.querySelector('.sidebar')?.classList.remove('mob-open');
    document.getElementById('mob-overlay')?.classList.remove('mob-show');
}

// Close sidebar on resize to desktop
window.addEventListener('resize', () => {
    if (window.innerWidth > 900) closeMobileMenu();
});