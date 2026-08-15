// Check if we have site session (cookie)
function checkSiteSession() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        if (cookie.trim().startsWith('siteSession=')) {
            return true;
        }
    }
    return false;
}

// If no site session, redirect to gate
if (!checkSiteSession()) {
    window.location.href = '/gate.html';
}

let currentToken = null;
let currentUser = null;

// DOM Elements
const statusDot = document.getElementById('connectionStatus');
const userTableBody = document.getElementById('userTableBody');
const totalUsersSpan = document.getElementById('totalUsers');
const activeUsersSpan = document.getElementById('activeUsers');

// Check for saved admin token
const savedToken = localStorage.getItem('adminToken');
if (savedToken) {
    currentToken = savedToken;
    fetchUsers();
}

// Event Listeners
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('adminToken');
    currentToken = null;
    // Clear site session too
    document.cookie = 'siteSession=; path=/; max-age=0';
    window.location.href = '/gate.html';
});

document.getElementById('addUserBtn').addEventListener('click', () => {
    if (!currentToken) {
        alert('Login required');
        return;
    }
    document.getElementById('addUserModal').style.display = 'flex';
});

document.getElementById('refreshBtn').addEventListener('click', fetchUsers);

// Modal close
document.querySelector('.modal-close')?.addEventListener('click', () => {
    document.getElementById('addUserModal').style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('addUserModal')) {
        document.getElementById('addUserModal').style.display = 'none';
    }
});

// Add user form
document.getElementById('addUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const hwid = document.getElementById('hwidInput').value.trim();
    const username = document.getElementById('usernameInput').value.trim();
    
    if (!hwid) {
        alert('HWID is required');
        return;
    }
    
    try {
        const response = await fetch('/api/users/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ hwid, username })
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('addUserModal').style.display = 'none';
            document.getElementById('hwidInput').value = '';
            document.getElementById('usernameInput').value = '';
            fetchUsers();
        } else {
            alert('Error: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Connection error');
    }
});

// Fetch users
async function fetchUsers() {
    if (!currentToken) {
        userTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">Login required</td></tr>';
        return;
    }
    
    try {
        const response = await fetch('/api/users', {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.status === 401) {
            localStorage.removeItem('adminToken');
            currentToken = null;
            userTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">Session expired</td></tr>';
            statusDot.className = 'status-dot offline';
            return;
        }
        
        const users = await response.json();
        displayUsers(users);
        
        // Get stats
        const statsResponse = await fetch('/api/stats', {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (statsResponse.ok) {
            const stats = await statsResponse.json();
            totalUsersSpan.textContent = stats.totalUsers || 0;
            activeUsersSpan.textContent = stats.activeUsers || 0;
            
            // Update status dot
            if (stats.activeUsers > 0) {
                statusDot.className = 'status-dot online';
            } else {
                statusDot.className = 'status-dot offline';
            }
        }
    } catch (error) {
        console.error('Error:', error);
        userTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">Connection error</td></tr>';
    }
}

function displayUsers(users) {
    if (!users || users.length === 0) {
        userTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">No users registered</td></tr>';
        return;
    }
    
    userTableBody.innerHTML = users.map(user => `
        <tr>
            <td>${user.username || 'Unknown'}</td>
            <td style="font-size:12px;color:#555;">${user.hwid.slice(0, 16)}...</td>
            <td>
                <span class="status-badge ${user.isActive ? 'online' : 'offline'}">
                    ${user.isActive ? 'Connected' : 'Offline'}
                </span>
                ${user.isOwner ? ' <span style="color:#333;">*</span>' : ''}
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
                        <button class="action-btn danger" onclick="crashUser('${user.id}')">Crash</button>
                        <input type="text" 
                               class="kick-input" 
                               placeholder="Kick message"
                               id="kickMsg_${user.id}"
                               value="${user.settings?.kickMessage || ''}">
                        <button class="action-btn" onclick="kickUser('${user.id}')">Kick</button>
                        <button class="action-btn danger" onclick="removeUser('${user.id}')">Remove</button>
                    ` : `
                        <span style="color:#333;font-size:12px;">Restricted</span>
                    `}
                </div>
            </td>
        </tr>
    `).join('');
}

// Actions
async function crashUser(userId) {
    if (!confirm('Crash this user?')) return;
    
    try {
        const response = await fetch(`/api/users/${userId}/crash`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const data = await response.json();
        if (data.success) {
            fetchUsers();
        } else {
            alert('Error: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Connection error');
    }
}

async function kickUser(userId) {
    const messageInput = document.getElementById(`kickMsg_${userId}`);
    const message = messageInput?.value || 'Connection lost';
    
    if (!confirm(`Kick user?`)) return;
    
    try {
        const response = await fetch(`/api/users/${userId}/kick`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ message })
        });
        
        const data = await response.json();
        if (data.success) {
            fetchUsers();
        } else {
            alert('Error: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Connection error');
    }
}

async function removeUser(userId) {
    if (!confirm('Remove this user?')) return;
    
    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const data = await response.json();
        if (data.success) {
            fetchUsers();
        } else {
            alert('Error: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Connection error');
    }
}

async function updateLag(slider) {
    if (!currentToken || !currentUser?.isOwner) return;
    
    const userId = slider.dataset.userid;
    const value = parseInt(slider.value);
    
    try {
        await fetch(`/api/users/${userId}/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ lagPercentage: value })
        });
    } catch (error) {
        console.error('Error updating lag:', error);
    }
}

// Make functions global
window.crashUser = crashUser;
window.kickUser = kickUser;
window.removeUser = removeUser;
window.updateLag = updateLag;