let currentToken = null;
let currentUser = null;

// DOM Elements
const statusText = document.getElementById('statusText');
const loginBtn = document.getElementById('loginBtn');
const loginModal = document.getElementById('loginModal');
const addUserModal = document.getElementById('addUserModal');
const userTableBody = document.getElementById('userTableBody');
const totalUsersSpan = document.getElementById('totalUsers');
const activeUsersSpan = document.getElementById('activeUsers');

// Check for saved token
const savedToken = localStorage.getItem('crasherToken');
if (savedToken) {
    currentToken = savedToken;
    updateUI(true);
    fetchUsers();
}

// Event Listeners
loginBtn.addEventListener('click', () => {
    loginModal.style.display = 'flex';
});

document.querySelectorAll('.close').forEach(el => {
    el.addEventListener('click', () => {
        loginModal.style.display = 'none';
        addUserModal.style.display = 'none';
    });
});

window.addEventListener('click', (e) => {
    if (e.target === loginModal) loginModal.style.display = 'none';
    if (e.target === addUserModal) addUserModal.style.display = 'none';
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('passwordInput').value;
    
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
            currentToken = data.token;
            currentUser = data.user;
            localStorage.setItem('crasherToken', currentToken);
            updateUI(true);
            loginModal.style.display = 'none';
            fetchUsers();
            document.getElementById('passwordInput').value = '';
        } else {
            alert('Invalid password!');
        }
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
});

document.getElementById('addUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const hwid = document.getElementById('hwidInput').value;
    const username = document.getElementById('usernameInput').value;
    
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
            alert('User added successfully!');
            document.getElementById('hwidInput').value = '';
            document.getElementById('usernameInput').value = '';
            addUserModal.style.display = 'none';
            fetchUsers();
        } else {
            alert('Failed to add user: ' + data.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
});

document.getElementById('addUserBtn').addEventListener('click', () => {
    if (!currentToken) {
        alert('Please login as owner first!');
        return;
    }
    addUserModal.style.display = 'flex';
});

document.getElementById('refreshBtn').addEventListener('click', fetchUsers);

// Functions
function updateUI(isAuthenticated) {
    if (isAuthenticated) {
        statusText.textContent = '✅ Authenticated';
        statusText.style.color = '#48bb78';
        loginBtn.textContent = 'Logout';
        loginBtn.onclick = () => {
            localStorage.removeItem('crasherToken');
            currentToken = null;
            updateUI(false);
            userTableBody.innerHTML = '<tr><td colspan="5" class="no-data">Please login to view users</td></tr>';
        };
    } else {
        statusText.textContent = '🔴 Not Authenticated';
        statusText.style.color = '#f56565';
        loginBtn.textContent = 'Login';
        loginBtn.onclick = () => {
            loginModal.style.display = 'flex';
        };
    }
}

async function fetchUsers() {
    if (!currentToken) {
        userTableBody.innerHTML = '<tr><td colspan="5" class="no-data">Please login to view users</td></tr>';
        return;
    }
    
    try {
        const response = await fetch('/api/users', {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.status === 401) {
            localStorage.removeItem('crasherToken');
            currentToken = null;
            updateUI(false);
            alert('Session expired. Please login again.');
            return;
        }
        
        const users = await response.json();
        displayUsers(users);
        
        // Fetch stats
        const statsResponse = await fetch('/api/stats', {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (statsResponse.ok) {
            const stats = await statsResponse.json();
            totalUsersSpan.textContent = stats.totalUsers;
            activeUsersSpan.textContent = stats.activeUsers;
        }
    } catch (error) {
        console.error('Error fetching users:', error);
        userTableBody.innerHTML = '<tr><td colspan="5" class="no-data">Error loading users</td></tr>';
    }
}

function displayUsers(users) {
    if (!users || users.length === 0) {
        userTableBody.innerHTML = '<tr><td colspan="5" class="no-data">No users found</td></tr>';
        return;
    }
    
    userTableBody.innerHTML = users.map(user => `
        <tr>
            <td><strong>${user.username}</strong></td>
            <td><code style="font-size: 11px; background: #f0f0f0; padding: 2px 6px; border-radius: 4px;">${user.hwid.slice(0, 16)}...</code></td>
            <td>
                <span class="status-badge ${user.isActive ? 'status-active' : 'status-inactive'}">
                    ${user.isActive ? '🟢 Active' : '🔴 Offline'}
                </span>
                ${user.isOwner ? ' 👑' : ''}
            </td>
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="range" 
                           class="lag-slider" 
                           min="0" 
                           max="100" 
                           value="${user.settings.lagPercentage}"
                           data-userid="${user.id}"
                           onchange="updateLag(this)"
                           ${!currentUser?.isOwner ? 'disabled' : ''}>
                    <span style="font-weight: bold;">${user.settings.lagPercentage}%</span>
                </div>
            </td>
            <td>
                <div class="actions-cell">
                    ${currentUser?.isOwner ? `
                        <button class="btn btn-danger btn-sm" onclick="crashUser('${user.id}')">
                            💥 Crash
                        </button>
                        <div style="display: flex; gap: 5px; align-items: center;">
                            <input type="text" 
                                   class="kick-input" 
                                   placeholder="Kick message"
                                   id="kickMsg_${user.id}"
                                   value="${user.settings.kickMessage || ''}">
                            <button class="btn btn-warning btn-sm" onclick="kickUser('${user.id}')">
                                🚫 Kick
                            </button>
                        </div>
                        <button class="btn btn-danger btn-sm" onclick="removeUser('${user.id}')">
                            🗑️ Remove
                        </button>
                    ` : `
                        <span style="color: #a0aec0; font-size: 12px;">Owner only</span>
                    `}
                </div>
            </td>
        </tr>
    `).join('');
}

async function updateLag(slider) {
    if (!currentToken || !currentUser?.isOwner) return;
    
    const userId = slider.dataset.userid;
    const value = parseInt(slider.value);
    
    try {
        const response = await fetch(`/api/users/${userId}/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ lagPercentage: value })
        });
        
        if (!response.ok) {
            alert('Failed to update lag settings');
        }
    } catch (error) {
        console.error('Error updating lag:', error);
    }
}

async function crashUser(userId) {
    if (!confirm('Are you sure you want to crash this user?')) return;
    
    try {
        const response = await fetch(`/api/users/${userId}/crash`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ Crash triggered successfully!');
            fetchUsers();
        } else {
            alert('❌ Failed to crash user: ' + data.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function kickUser(userId) {
    const messageInput = document.getElementById(`kickMsg_${userId}`);
    const message = messageInput?.value || 'Your connection has been lost. Please try again later.';
    
    if (!confirm(`Kick this user with message: "${message}"?`)) return;
    
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
            alert('✅ User kicked successfully!');
            fetchUsers();
        } else {
            alert('❌ Failed to kick user: ' + data.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function removeUser(userId) {
    if (!confirm('Are you sure you want to remove this user permanently?')) return;
    
    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ User removed successfully!');
            fetchUsers();
        } else {
            alert('❌ Failed to remove user: ' + data.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Make functions globally accessible
window.crashUser = crashUser;
window.kickUser = kickUser;
window.removeUser = removeUser;
window.updateLag = updateLag;

// Initial fetch
if (currentToken) {
    fetchUsers();
}