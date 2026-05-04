// frontend/js/users.js — Users & Staff management

let allUsers = [];

async function loadUsers() {
    const res = await API.getUsers();
    if (!res?.success) {
        document.getElementById('users-table-body').innerHTML =
            '<tr><td colspan="7" class="loading-row" style="color:var(--red);">Admin access required to view users.</td></tr>';
        return;
    }
    allUsers = res.data;
    const admins = allUsers.filter(u => u.role==='admin').length;
    const staff  = allUsers.filter(u => u.role==='staff').length;
    const active = allUsers.filter(u => u.is_active).length;

    document.getElementById('users-count').textContent      = `${admins} admin${admins!==1?'s':''}, ${staff} staff member${staff!==1?'s':''}`;
    document.getElementById('users-total-count').textContent= allUsers.length;
    document.getElementById('users-admin-count').textContent= admins;
    document.getElementById('users-staff-count').textContent= staff;

    renderUsersTable(allUsers);
}

function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    if (!users.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-row" style="color:var(--text3);">No users found</td></tr>';
        return;
    }
    tbody.innerHTML = users.map(u => `
        <tr>
            <td>
                <div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:32px;height:32px;border-radius:50%;background:${u.role==='admin'?'var(--accent-dim)':'var(--green-dim)'};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:${u.role==='admin'?'var(--accent2)':'var(--green)'};">${u.name[0].toUpperCase()}</div>
                    <div>
                        <div style="font-size:13px;color:var(--text);font-weight:500;">${u.name}</div>
                        <div style="font-size:11px;color:var(--text3);">@${u.username}</div>
                    </div>
                </div>
            </td>
            <td><span class="badge ${u.role==='admin'?'badge-purple':'badge-green'}">${u.role}</span></td>
            <td style="font-size:12px;">${u.email||'—'}</td>
            <td style="font-size:12px;">${u.phone||'—'}</td>
            <td style="font-size:12px;">${new Date(u.created_at).toLocaleDateString('en-IN')}</td>
            <td><span class="badge ${u.is_active?'badge-green':'badge-red'}">${u.is_active?'Active':'Inactive'}</span></td>
            <td>
                <div style="display:flex;gap:6px;">
                    <button class="btn btn-sm btn-ghost" onclick='openEditUserModal(${JSON.stringify(u)})' title="Edit">✏️</button>
                    ${u.is_active
                        ? `<button class="btn btn-sm btn-danger" onclick="toggleUser(${u.id},false,'${u.name.replace(/'/g,"\\'")}')">Deactivate</button>`
                        : `<button class="btn btn-sm btn-success" onclick="toggleUser(${u.id},true,'${u.name.replace(/'/g,"\\'")}')">Activate</button>`}
                </div>
            </td>
        </tr>`).join('');
}

function openAddUserModal(defaultRole='staff') {
    document.getElementById('user-modal-title').textContent = defaultRole==='admin' ? 'Add New Admin' : 'Add New Staff';
    document.getElementById('user-edit-id').value  = '';
    document.getElementById('user-name').value     = '';
    document.getElementById('user-username').value = '';
    document.getElementById('user-email').value    = '';
    document.getElementById('user-phone').value    = '';
    document.getElementById('user-password').value = '';
    document.getElementById('user-role').value     = defaultRole;
    document.getElementById('user-error').textContent = '';
    document.getElementById('user-password-note').style.display = 'none';
    openModal('modal-user');
}

function openEditUserModal(u) {
    document.getElementById('user-modal-title').textContent = 'Edit: ' + u.name;
    document.getElementById('user-edit-id').value  = u.id;
    document.getElementById('user-name').value     = u.name;
    document.getElementById('user-username').value = u.username;
    document.getElementById('user-email').value    = u.email||'';
    document.getElementById('user-phone').value    = u.phone||'';
    document.getElementById('user-password').value = '';
    document.getElementById('user-role').value     = u.role;
    document.getElementById('user-error').textContent = '';
    document.getElementById('user-password-note').style.display = 'block';
    openModal('modal-user');
}

async function submitUser() {
    const id       = document.getElementById('user-edit-id').value;
    const name     = document.getElementById('user-name').value.trim();
    const username = document.getElementById('user-username').value.trim();
    const email    = document.getElementById('user-email').value.trim();
    const phone    = document.getElementById('user-phone').value.trim();
    const password = document.getElementById('user-password').value;
    const role     = document.getElementById('user-role').value;
    const errEl    = document.getElementById('user-error');
    errEl.textContent = '';

    if (!name||!username)          { errEl.textContent='Name and username are required'; return; }
    if (!id && !password)          { errEl.textContent='Password is required for new users'; return; }
    if (password && password.length<6) { errEl.textContent='Password must be at least 6 characters'; return; }

    const payload = { name, username, role, email:email||null, phone:phone||null };
    if (password) payload.password = password;

    const res = id ? await API.updateUser(id, payload) : await API.createUser(payload);
    if (!res?.success) { errEl.textContent = res?.message||'Failed to save'; return; }
    toast(id ? 'User updated!' : `${role==='admin'?'Admin':'Staff member'} created successfully!`, 'success');
    closeModal('modal-user');
    loadUsers();
}

async function toggleUser(id, activate, name) {
    if (!confirm(`${activate?'Activate':'Deactivate'} user "${name}"?`)) return;
    const res = activate ? await API.activateUser(id) : await API.deactivateUser(id);
    if (!res?.success) { toast('Failed: '+(res?.message||''), 'error'); return; }
    toast(`User ${activate?'activated':'deactivated'}`, 'info');
    loadUsers();
}
