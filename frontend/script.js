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
            // Show admin login
            document.getElementById('adminLoginOverlay').style.display = 'flex';
            document.getElementById('adminPasswordInput').focus();
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
    
    const password = document.getElementById('adminPasswordInput').value;
    const errorEl = document.getElementById('adminLoginError');
    const btn = document.getElementById('adminLoginBtn');
    
    if (!password) {
        errorEl.textContent = 'Please enter admin password';
        return;
    }
    
    errorEl.textContent = '';
    btn.textContent = 'Checking...';
    btn.disabled = true;
    
    try {
        const response = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                hwid: 'owner', 
                password: password 
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            adminToken = data.token;
            currentUser = data.user;
            localStorage.setItem('adminToken', adminToken);
            document.getElementById('adminLoginOverlay').style.display = 'none';
            document.getElementById('userDisplay').textContent = '👑 ' + (data.user.username || 'Owner');
            loadAllData();
        } else {
            errorEl.textContent = 'Invalid admin password';
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
let refreshInterval = null;

// DOM Elements
const ownersTableBody = document.getElementById('ownersTableBody');
const usersTableBody = document.getElementById('usersTableBody');
const onlineUsersSpan = document.getElementById('onlineUsers');
const offlineUsersSpan = document.getElementById('offlineUsers');
const totalUsersSpan = document.getElementById('totalUsers');
const statusText = document.getElementById('statusText');
const userDisplay = document.getElementById('userDisplay');

// Check for saved admin token
const savedToken = localStorage.getItem('adminToken');
if (savedToken) {
    adminToken = savedToken;
}

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
    if (refreshInterval) clearInterval(refreshInterval);
});

// ===== ADD OWNER =====
document.getElementById('addOwnerBtn').addEventListener('click', async () => {
    const username = document.getElementById('ownerUsernameInput').value.trim();
    
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
            body: JSON.stringify({ username })
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('ownerUsernameInput').value = '';
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
    if (!message) {
        alert('Please enter a kick message');
        return;
    }
    
    try {
        const response = await fetch('/api/settings/kick-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ message })
        });
        
        const data = await response.json();
        if (data.success) {
            alert('Kick message saved!');
        }
    } catch (error) {
        alert('Connection error');
    }
});

document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const msg = btn.dataset.msg;
        document.getElementById('defaultKickMessage').value = msg;
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
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ lagPercentage: parseInt(lag) })
        });
        
        const data = await response.json();
        if (data.success) {
            alert('Default lag saved!');
        }
    } catch (error) {
        alert('Connection error');
    }
});

document.getElementById('sessionTimeout').addEventListener('change', async () => {
    const timeout = document.getElementById('sessionTimeout').value;
    
    try {
        const response = await fetch('/api/settings/session-timeout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ timeout: parseInt(timeout) })
        });
        
        const data = await response.json();
        if (data.success) {
            alert('Session timeout saved!');
        }
    } catch (error) {
        alert('Connection error');
    }
});

// ===== LOAD DATA =====
async function loadAllData() {
    if (!adminToken) {
        return;
    }
    
    try {
        // Load owners
        const ownersResponse = await fetch('/api/owners', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        if (ownersResponse.ok) {
            owners = await ownersResponse.json();
            displayOwners(owners);
        }
        
        // Load users
        const usersResponse = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        if (usersResponse.ok) {
            users = await usersResponse.json();
            displayUsers(users);
            updateStats(users);
        }
        
        statusText.textContent = 'Online';
        statusText.className = 'status-online';
        
    } catch (error) {
        console.error('Error loading data:', error);
        statusText.textContent = 'Offline';
        statusText.className = 'status-offline';
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
            <td style="font-size:12px;color:#555;">${owner.hwid || 'Not set'}</td>
            <td>
                <span class="status-badge ${owner.isActive ? 'online' : 'offline'}">
                    ${owner.isActive ? 'Online' : 'Offline'}
                </span>
            </td>
            <td>
                <button class="action-btn danger btn-sm" onclick="removeOwner('${owner.id}')">Remove</button>
            </td>
        </tr>
    `).join('');
}

function displayUsers(users) {
    if (!users || users.length === 0) {
        usersTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">No users executing script</td></tr>';
        return;
    }
    
    usersTableBody.innerHTML = users.map(user => `
        <tr>
            <td>${user.username || 'Unknown'}</td>
            <td style="font-size:12px;color:#555;">${user.hwid.slice(0, 16)}...</td>
            <td>
                <span class="status-badge ${user.isActive ? 'online' : 'offline'}">
                    ${user.isActive ? 'Online' : 'Offline'}
                </span>
            </td>
            <td>
                <input type="range" 
                       class="lag-slider" 
                       min="0" 
                       max="100" 
                       value="${user.settings?.lagPercentage || 0}"
                       data-userid="${user.id}"
                       onchange="updateLag(this)"
                       ${!currentUser?.isOwner ? 'disabled' : ''}>
                <span style="font-size:12px;color:#555;margin-left:6px;">${user.settings?.lagPercentage || 0}%</span>
            </td>
            <td>
                <div class="actions-cell">
                    ${currentUser?.isOwner ? `
                        <button class="action-btn danger btn-sm" onclick="crashUser('${user.id}')">Crash</button>
                        <input type="text" 
                               class="kick-input" 
                               placeholder="Kick message"
                               id="kickMsg_${user.id}"
                               value="${user.settings?.kickMessage || ''}">
                        <button class="action-btn btn-sm" onclick="kickUser('${user.id}')">Kick</button>
                    ` : `
                        <span style="color:#333;font-size:12px;">Restricted</span>
                    `}
                </div>
            </td>
        </tr>
    `).join('');
}

function updateStats(users) {
    const online = users.filter(u => u.isActive).length;
    const offline = users.filter(u => !u.isActive).length;
    
    onlineUsersSpan.textContent = online;
    offlineUsersSpan.textContent = offline;
    totalUsersSpan.textContent = users.length;
}

// ===== ACTIONS =====
async function crashUser(userId) {
    if (!confirm('Crash this user?')) return;
    
    try {
        const response = await fetch(`/api/users/${userId}/crash`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        const data = await response.json();
        if (data.success) {
            alert('User crashed!');
            loadAllData();
        } else {
            alert('Error: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Connection error');
    }
}

async function kickUser(userId) {
    const messageInput = document.getElementById(`kickMsg_${userId}`);
    const message = messageInput?.value || 'Your connection has been lost. Please try again later.';
    
    if (!confirm(`Kick user?`)) return;
    
    try {
        const response = await fetch(`/api/users/${userId}/kick`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ message })
        });
        
        const data = await response.json();
        if (data.success) {
            alert('User kicked!');
            loadAllData();
        } else {
            alert('Error: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Connection error');
    }
}

async function removeOwner(ownerId) {
    if (!confirm('Remove this owner?')) return;
    
    try {
        const response = await fetch(`/api/owners/${ownerId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        const data = await response.json();
        if (data.success) {
            loadAllData();
        } else {
            alert('Error: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Connection error');
    }
}

async function updateLag(slider) {
    if (!adminToken || !currentUser?.isOwner) return;
    
    const userId = slider.dataset.userid;
    const value = parseInt(slider.value);
    
    try {
        await fetch(`/api/users/${userId}/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ lagPercentage: value })
        });
    } catch (error) {
        console.error('Error updating lag:', error);
    }
}

// ===== AUTO-REFRESH =====
setInterval(loadAllData, 10000);

// ===== LOAD ON START =====
if (localStorage.getItem('siteToken')) {
    document.getElementById('gateBox').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('adminLoginOverlay').style.display = 'flex';
    document.getElementById('adminPasswordInput').focus();
}

window.crashUser = crashUser;
window.kickUser = kickUser;
window.removeOwner = removeOwner;
window.updateLag = updateLag;