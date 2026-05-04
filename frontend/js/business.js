// frontend/js/business.js — Business Profile page

let bizProfile = null;

async function loadBusiness() {
    const res = await API.getBusiness();
    if (!res?.success) { toast('Failed to load business profile','error'); return; }
    bizProfile = res.data || {};
    window._bizProfile = bizProfile;
    renderBizView(bizProfile);
}

function renderBizView(b) {
    // Hero
    const initials = (b.business_name||'S').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
    document.getElementById('biz-avatar').textContent         = initials;
    document.getElementById('biz-display-name').textContent   = b.business_name    || '—';
    document.getElementById('biz-display-cat').textContent    = b.business_category || '—';

    // Sell channels
    const channels = [];
    if (b.sell_physical) channels.push('<span class="badge badge-green">🏪 Physical Store</span>');
    if (b.sell_online)   channels.push('<span class="badge badge-blue">🌐 Online</span>');
    document.getElementById('biz-display-channels').innerHTML = channels.join(' ')||'<span class="badge badge-gray">Not set</span>';

    // Business info card
    document.getElementById('biz-display-owner').textContent   = b.owner_name        || '—';
    document.getElementById('biz-display-nature').textContent  = b.nature            || '—';
    document.getElementById('biz-display-cat2').textContent    = b.business_category || '—';
    document.getElementById('biz-display-year').textContent    = b.established_year  || '—';
    document.getElementById('biz-display-website').textContent = b.website_url       || '—';

    // Contact card
    document.getElementById('biz-display-phone').textContent   = b.phone   || '—';
    document.getElementById('biz-display-email').textContent   = b.email   || '—';
    document.getElementById('biz-display-city').textContent    = [b.city, b.state, b.pincode].filter(Boolean).join(', ') || '—';
    document.getElementById('biz-display-address').textContent = b.address || '—';

    // Tax card
    document.getElementById('biz-display-gst').textContent      = b.gst_number || 'Not provided';
    document.getElementById('biz-display-pan').textContent      = b.pan_number || 'Not provided';
    document.getElementById('biz-display-online').innerHTML     = b.sell_online ? '<span class="badge badge-green">Yes</span>' : '<span class="badge badge-gray">No</span>';
    document.getElementById('biz-display-physical').innerHTML   = b.sell_physical ? '<span class="badge badge-green">Yes</span>' : '<span class="badge badge-gray">No</span>';

    // Selling items as tags
    const itemsWrap = document.getElementById('biz-display-items-wrap');
    if (b.selling_items) {
        itemsWrap.innerHTML = b.selling_items.split(',').map(i=>i.trim()).filter(Boolean)
            .map(i=>`<span class="badge badge-purple" style="margin:2px;">${i}</span>`).join('');
    } else {
        itemsWrap.innerHTML = '<span style="color:var(--text3);font-size:13px;">—</span>';
    }

    // Update sidebar logo
    if (b.business_name) {
        const n = b.business_name;
        const logoEl = document.getElementById('sidebar-logo-name');
        if (logoEl) logoEl.textContent = '⬡ ' + (n.length>13 ? n.substring(0,13)+'…' : n);
    }
}

function openBizEditModal() {
    const b = bizProfile || {};
    document.getElementById('biz-name').value     = b.business_name     || '';
    document.getElementById('biz-owner').value    = b.owner_name        || '';
    document.getElementById('biz-category').value = b.business_category || '';
    document.getElementById('biz-nature').value   = b.nature            || '';
    document.getElementById('biz-gst').value      = b.gst_number        || '';
    document.getElementById('biz-pan').value      = b.pan_number        || '';
    document.getElementById('biz-phone').value    = b.phone             || '';
    document.getElementById('biz-email').value    = b.email             || '';
    document.getElementById('biz-address').value  = b.address           || '';
    document.getElementById('biz-city').value     = b.city              || '';
    document.getElementById('biz-state').value    = b.state             || '';
    document.getElementById('biz-pincode').value  = b.pincode           || '';
    document.getElementById('biz-items').value    = b.selling_items     || '';
    document.getElementById('biz-website').value  = b.website_url       || '';
    document.getElementById('biz-year').value     = b.established_year  || '';
    document.getElementById('biz-online').checked   = !!b.sell_online;
    document.getElementById('biz-physical').checked = b.sell_physical !== undefined ? !!b.sell_physical : true;
    document.getElementById('biz-error').textContent = '';
    openModal('modal-business');
}

async function submitBusiness() {
    const errEl = document.getElementById('biz-error');
    errEl.textContent = '';
    const payload = {
        business_name:     document.getElementById('biz-name').value.trim(),
        owner_name:        document.getElementById('biz-owner').value.trim(),
        business_category: document.getElementById('biz-category').value,
        nature:            document.getElementById('biz-nature').value,
        gst_number:        document.getElementById('biz-gst').value.trim(),
        pan_number:        document.getElementById('biz-pan').value.trim(),
        phone:             document.getElementById('biz-phone').value.trim(),
        email:             document.getElementById('biz-email').value.trim(),
        address:           document.getElementById('biz-address').value.trim(),
        city:              document.getElementById('biz-city').value.trim(),
        state:             document.getElementById('biz-state').value.trim(),
        pincode:           document.getElementById('biz-pincode').value.trim(),
        selling_items:     document.getElementById('biz-items').value.trim(),
        website_url:       document.getElementById('biz-website').value.trim(),
        established_year:  document.getElementById('biz-year').value || null,
        sell_online:       document.getElementById('biz-online').checked,
        sell_physical:     document.getElementById('biz-physical').checked,
    };
    if (!payload.business_name) { errEl.textContent = 'Business name is required'; return; }
    const res = await API.saveBusiness(payload);
    if (!res?.success) { errEl.textContent = res?.message||'Failed to save'; return; }
    toast('Business profile saved!', 'success');
    bizProfile = payload;
    window._bizProfile = payload;
    closeModal('modal-business');
    renderBizView(payload);
}
