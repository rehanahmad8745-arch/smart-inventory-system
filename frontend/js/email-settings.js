// frontend/js/email-settings.js — Custom Email Settings Page

async function loadEmailSettingsPage() {
    // Load current config from server
    const res = await API.getEmailConfig();

    const statusBadge = document.getElementById('email-status-badge');
    const statusDetail = document.getElementById('email-status-detail');

    if (res?.success && res.config) {
        const c = res.config;

        // Fill form fields
        if (c.host)      document.getElementById('em-host').value = c.host;
        if (c.port)      document.getElementById('em-port').value = c.port;
        if (c.secure !== undefined) document.getElementById('em-secure').value = c.secure ? 'true' : 'false';
        if (c.user)      document.getElementById('em-user').value = c.user;
        if (c.recipient) document.getElementById('em-recipient').value = c.recipient;
        if (c.cron)      document.getElementById('em-time').value = c.cron;

        if (c.configured) {
            statusBadge.textContent = '✅ Configured';
            statusBadge.className = 'badge badge-green';
            statusDetail.innerHTML = `Email is set up with <strong style="color:var(--text);">${c.user}</strong> via <strong style="color:var(--text);">${c.host}:${c.port}</strong>. Daily reports go to <strong style="color:var(--accent2);">${c.recipient || 'not set'}</strong>.`;
        } else {
            statusBadge.textContent = '⚠️ Not Configured';
            statusBadge.className = 'badge badge-amber';
            statusDetail.innerHTML = 'Email not configured. Fill in the form below and click <strong>Save Settings</strong>.';
        }
    } else {
        statusBadge.textContent = '❌ Error';
        statusBadge.className = 'badge badge-red';
        statusDetail.textContent = 'Could not load email config. Make sure server is running.';
    }
}

async function saveEmailSettings() {
    const host      = document.getElementById('em-host').value.trim();
    const port      = document.getElementById('em-port').value.trim();
    const secure    = document.getElementById('em-secure').value;
    const user      = document.getElementById('em-user').value.trim();
    const pass      = document.getElementById('em-pass').value.trim();
    const recipient = document.getElementById('em-recipient').value.trim();
    const cron      = document.getElementById('em-time').value;

    if (!host || !user) { toast('SMTP Host and Email are required', 'error'); return; }

    const res = await API.saveEmailConfig({ host, port, secure, user, pass, recipient, cron });

    if (res?.success) {
        toast('✅ Email settings saved! Restart server for changes to take effect.', 'success', 6000);
        loadEmailSettingsPage();
    } else {
        toast('❌ Failed to save: ' + (res?.message || 'Unknown error'), 'error');
    }
}

async function testEmail() {
    const recipient = document.getElementById('em-recipient').value.trim();
    if (!recipient) { toast('Enter a recipient email first', 'error'); return; }

    toast('📤 Sending test email...', 'info', 2000);
    const res = await API.sendEmail();

    if (res?.success) {
        toast('✅ Test email sent to ' + recipient, 'success', 5000);
    } else {
        toast('❌ Email failed: ' + (res?.error || 'Check your SMTP settings'), 'error', 6000);
    }
}