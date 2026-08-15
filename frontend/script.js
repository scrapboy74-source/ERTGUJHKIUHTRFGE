// ===== PASSWORD GATE =====
document.getElementById('gateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const password = document.getElementById('gatePassword').value;
    const errorEl = document.getElementById('gateError');
    const btn = document.getElementById('unlockBtn');
    
    if (!password) {
        errorEl.textContent = 'Please enter password';
        return;
    }
    
    errorEl.textContent = '';
    btn.textContent = 'Checking...';
    btn.disabled = true;
    
    try {
        const response = await fetch('/api/site-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('gateBox').style.display = 'none';
            document.getElementById('mainApp').style.display = 'block';
            localStorage.setItem('siteToken', data.token);
            document.getElementById('adminLoginOverlay').style.display = 'flex';
            document.getElementById('adminUsernameInput').focus();
        } else {
            errorEl.textContent = 'Invalid password';
            document.getElementById('gatePassword').value = '';
            document.getElementById('gatePassword').focus();
            btn.textContent = 'Unlock';
            btn.disabled = false;
        }
    } catch (err) {
        errorEl.textContent = 'Connection error. Try again.';
        btn.textContent = 'Unlock';
        btn.disabled = false;
    }
});

// ===== ADMIN LOGIN =====
document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('adminUsernameInput').value;
    const password = document.getElementById('adminPasswordInput').value;
    const errorEl = document.getElementById('adminLoginError');
    const btn = document.getElementById('adminLoginBtn');
    
    if (!username || !password) {
        errorEl.textContent = 'Please enter username and password';
        return;
    }
    
    errorEl.textContent = '';
    btn.textContent = 'Checking...';
    btn.disabled = true;
    
    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            adminToken = data.token;
            currentUser = data.user;
            localStorage.setItem('adminToken', adminToken);
            document.getElementById('adminLoginOverlay').style.display = 'none';
            document.getElementById('userDisplay').textContent = '👑 ' + data.user.username;
            loadAllData();
        } else {
            errorEl.textContent = 'Invalid credentials';
            document.getElementById('adminPasswordInput').value = '';
            document.getElementById('adminPasswordInput').focus();
            btn.textContent = 'Login';
            btn.disabled = false;
        }
    } catch (err) {
        errorEl.textContent = 'Connection error. Try again.';
        btn.textContent = 'Login';
        btn.disabled = false;
    }
});

// ===== TABS =====
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const tabId = btn.dataset.tab;
        document.getElementById(`tab-${tabId}`).classList.add('active');
    });
});

// ===== MAIN APP =====
let adminToken = null;
let currentUser = null;
let owners = [];
let users = [];
let admins = [];

const ownersTableBody = document.getElementById('ownersTableBody');
const usersTableBody = document.getElementById('usersTableBody');
const adminsTableBody = document.getElementById('adminsTableBody');
const totalUsersSpan = document.getElementById('totalUsers');
const onlineUsersSpan = document.getElementById('onlineUsers');
const onlinePercentSpan = document.getElementById('onlinePercent');
const totalOwnersSpan = document.getElementById('totalOwners');
const statusDot = document.getElementById('connectionStatus');

// ===== LOGOUT =====
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('siteToken');
    adminToken = null;
    currentUser = null;
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('gateBox').style.display = 'block';
    document.getElementById('adminLoginOverlay').style.display = 'none';
    document.getElementById('gatePassword').value = '';
    document.getElementById('gatePassword').focus();
});

// ===== ADD OWNER =====
document.getElementById('addOwnerBtn').addEventListener('click', async () => {
    const username = document.getElementById('ownerUsernameInput').value.trim();
    const password = document.getElementById('ownerPasswordInput').value.trim();
    
    if (!username) {
        alert('Please enter a Roblox username');
        return;
    }
    
    try {
        const response = await fetch('/api/owners/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('ownerUsernameInput').value = '';
            document.getElementById('ownerPasswordInput').value = '';
            loadAllData();
        } else {
            alert('Error: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Connection error');
    }
});

// ===== CREATE ADMIN =====
document.getElementById('createAdminBtn').addEventListener('click', async () => {
    const username = document.getElementById('adminUserInput').value.trim();
    const password = document.getElementById('adminPassInput').value.trim();
    const roblox = document.getElementById('adminRobloxInput').value.trim();
    
    if (!username || !password || !roblox) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        const response = await fetch('/api/admins/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ username, password, robloxUsername: roblox })
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('adminUserInput').value = '';
            document.getElementById('adminPassInput').value = '';
            document.getElementById('adminRobloxInput').value = '';
            loadAllData();
        } else {
            alert('Error: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Connection error');
    }
});

// ===== SETTINGS =====
document.getElementById('saveKickMsgBtn').addEventListener('click', async () => {
    const message = document.getElementById('defaultKickMessage').value.trim();
    if (!message) { alert('Please enter a kick message'); return; }
    
    try {
        const response = await fetch('/api/settings/kick-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
            body: JSON.stringify({ message })
        });
        const data = await response.json();
        if (data.success) alert('Kick message saved!');
    } catch (error) { alert('Connection error'); }
});

document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.getElementById('defaultKickMessage').value = btn.dataset.msg;
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

document.getElementById('defaultLagSlider').addEventListener('input', (e) => {
    document.getElementById('defaultLagValue').textContent = e.target.value + '%';
});

document.getElementById('saveLagBtn').addEventListener('click', async () => {
    const lag = document.getElementById('defaultLagSlider').value;
    try {
        const response = await fetch('/api/settings/default-lag', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
            body: JSON.stringify({ lagPercentage: parseInt(lag) })
        });
        const data = await response.json();
        if (data.success) alert('Default lag saved!');
    } catch (error) { alert('Connection error'); }
});

document.getElementById('defaultFreezeSlider').addEventListener('input', (e) => {
    document.getElementById('defaultFreezeValue').textContent = e.target.value + '%';
});

document.getElementById('saveFreezeBtn').addEventListener('click', async () => {
    const freeze = document.getElementById('defaultFreezeSlider').value;
    try {
        const response = await fetch('/api/settings/default-freeze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
            body: JSON.stringify({ freezePercentage: parseInt(freeze) })
        });
        const data = await response.json();
        if (data.success) alert('Default freeze saved!');
    } catch (error) { alert('Connection error'); }
});

// ===== LOAD DATA =====
async function loadAllData() {
    if (!adminToken) return;
    
    try {
        // Load owners
        const ownersRes = await fetch('/api/owners', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (ownersRes.ok) {
            owners = await ownersRes.json();
            displayOwners(owners);
            totalOwnersSpan.textContent = owners.length;
        }
        
        // Load users
        const usersRes = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (usersRes.ok) {
            users = await usersRes.json();
            displayUsers(users);
            updateStats(users);
        }
        
        // Load admins
        const adminsRes = await fetch('/api/admins', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (adminsRes.ok) {
            admins = await adminsRes.json();
            displayAdmins(admins);
        }
        
        statusDot.className = 'status-dot online';
    } catch (error) {
        console.error('Error loading data:', error);
        statusDot.className = 'status-dot offline';
    }
}

function displayOwners(owners) {
    if (!owners || owners.length === 0) {
        ownersTableBody.innerHTML = '<tr><td colspan="4" class="empty-state">No owners registered</td></tr>';
        return;
    }
    
    ownersTableBody.innerHTML = owners.map(owner => `
        <tr>
            <td><strong>${owner.username}</strong></td>
            <td style="font-size:11px;color:#555;">${owner.hwid || 'Not set'}</td>
            <td><span class="status-badge ${owner.isActive ? 'online' : 'offline'}">${owner.isActive ? 'Online' : 'Offline'}</span></td>
            <td><button class="action-btn danger btn-sm" onclick="removeOwner('${owner.id}')">Remove</button></td>
        </tr>
    `).join('');
}

function displayUsers(users) {
    if (!users || users.length === 0) {
        usersTableBody.innerHTML = '<tr><td colspan="6" class="empty-state">No users executing script</td></tr>';
        return;
    }
    
    usersTableBody.innerHTML = users.map(user => `
        <tr>
            <td>${user.username || 'Unknown'}</td>
            <td style="font-size:11px;color:#555;">${user.hwid.slice(0, 12)}...</td>
            <td><span class="status-badge ${user.isActive ? 'online' : 'offline'}">${user.isActive ? 'Online' : 'Offline'}</span></td>
            <td>
                <input type="range" class="lag-slider" min="0" max="100" value="${user.settings?.lagPercentage || 0}"
                    data-userid="${user.id}" onchange="updateLag(this)">
                <span class="lag-value">${user.settings?.lagPercentage || 0}%</span>
            </td>
            <td>
                <input type="range" class="freeze-slider" min="0" max="100" value="${user.settings?.freezePercentage || 0}"
                    data-userid="${user.id}" onchange="updateFreeze(this)">
                <span class="freeze-value">${user.settings?.freezePercentage || 0}%</span>
            </td>
            <td>
                <div class="actions-cell">
                    <button class="action-btn danger btn-sm" onclick="crashUser('${user.id}')">Crash</button>
                    <input type="text" class="kick-input" placeholder="Kick msg" id="kickMsg_${user.id}" value="${user.settings?.kickMessage || ''}">
                    <button class="action-btn btn-sm" onclick="kickUser('${user.id}')">Kick</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function displayAdmins(admins) {
    if (!admins || admins.length === 0) {
        adminsTableBody.innerHTML = '<tr><td colspan="3" class="empty-state">No admin accounts</td></tr>';
        return;
    }
    
    adminsTableBody.innerHTML = admins.map(admin => `
        <tr>
            <td>${admin.username}</td>
            <td>${admin.robloxUsername}</td>
            <td><button class="action-btn danger btn-sm" onclick="removeAdmin('${admin.id}')">Remove</button></td>
        </tr>
    `).join('');
}

function updateStats(users) {
    const online = users.filter(u => u.isActive).length;
    const total = users.length;
    const percent = total > 0 ? Math.round((online / total) * 100) : 0;
    
    totalUsersSpan.textContent = total;
    onlineUsersSpan.textContent = online;
    onlinePercentSpan.textContent = percent + '%';
}

// ===== ACTIONS =====
async function crashUser(userId) {
    if (!confirm('Crash this user?')) return;
    try {
        const response = await fetch(`/api/users/${userId}/crash`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await response.json();
        if (data.success) { alert('User crashed!'); loadAllData(); }
        else alert('Error: ' + (data.error || 'Unknown error'));
    } catch (error) { alert('Connection error'); }
}

async function kickUser(userId) {
    const msg = document.getElementById(`kickMsg_${userId}`).value || 'You have been removed.';
    if (!confirm(`Kick user with message: "${msg}"?`)) return;
    try {
        const response = await fetch(`/api/users/${userId}/kick`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
            body: JSON.stringify({ message: msg })
        });
        const data = await response.json();
        if (data.success) { alert('User kicked!'); loadAllData(); }
        else alert('Error: ' + (data.error || 'Unknown error'));
    } catch (error) { alert('Connection error'); }
}

async function removeOwner(ownerId) {
    if (!confirm('Remove this owner?')) return;
    try {
        const response = await fetch(`/api/owners/${ownerId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await response.json();
        if (data.success) loadAllData();
        else alert('Error: ' + (data.error || 'Unknown error'));
    } catch (error) { alert('Connection error'); }
}

async function removeAdmin(adminId) {
    if (!confirm('Remove this admin?')) return;
    try {
        const response = await fetch(`/api/admins/${adminId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await response.json();
        if (data.success) loadAllData();
        else alert('Error: ' + (data.error || 'Unknown error'));
    } catch (error) { alert('Connection error'); }
}

async function updateLag(slider) {
    const userId = slider.dataset.userid;
    const value = parseInt(slider.value);
    try {
        await fetch(`/api/users/${userId}/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
            body: JSON.stringify({ lagPercentage: value })
        });
    } catch (error) { console.error('Error updating lag:', error); }
}

async function updateFreeze(slider) {
    const userId = slider.dataset.userid;
    const value = parseInt(slider.value);
    try {
        await fetch(`/api/users/${userId}/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
            body: JSON.stringify({ freezePercentage: value })
        });
    } catch (error) { console.error('Error updating freeze:', error); }
}

// ===== MAKE FUNCTIONS GLOBAL =====
window.crashUser = crashUser;
window.kickUser = kickUser;
window.removeOwner = removeOwner;
window.removeAdmin = removeAdmin;
window.updateLag = updateLag;
window.updateFreeze = updateFreeze;

// ===== AUTO-REFRESH =====
setInterval(loadAllData, 5000);

// ===== LOAD ON START =====
if (localStorage.getItem('siteToken')) {
    document.getElementById('gateBox').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('adminLoginOverlay').style.display = 'flex';
    document.getElementById('adminUsernameInput').focus();
}