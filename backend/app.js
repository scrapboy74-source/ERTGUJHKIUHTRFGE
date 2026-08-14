const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// Data file paths
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const SESSIONS_FILE = path.join(__dirname, 'data', 'sessions.json');

// Initialize data files
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
}

if (!fs.existsSync(SESSIONS_FILE)) {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify([]));
}

// Helper functions
const readUsers = () => {
    try {
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch {
        return [];
    }
};

const writeUsers = (users) => {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

const readSessions = () => {
    try {
        return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    } catch {
        return [];
    }
};

const writeSessions = (sessions) => {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
};

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// API Endpoints

// 1. Register/Login script (HWID authentication)
app.post('/api/auth', (req, res) => {
    const { hwid, password } = req.body;

    if (!hwid) {
        return res.status(400).json({ error: 'HWID is required' });
    }

    let users = readUsers();
    let user = users.find(u => u.hwid === hwid);

    // If user doesn't exist, create new user
    if (!user) {
        // Check if this is an owner adding a new user
        if (password && password === process.env.ADMIN_PASSWORD) {
            const newUser = {
                id: crypto.randomUUID(),
                hwid: hwid,
                username: req.body.username || `User_${hwid.slice(0, 8)}`,
                isOwner: false,
                createdAt: new Date().toISOString(),
                settings: {
                    lagPercentage: 50,
                    crashEnabled: false,
                    kickMessage: 'Your connection has been lost. Please try again later.'
                }
            };
            users.push(newUser);
            writeUsers(users);
            user = newUser;
        } else {
            return res.status(401).json({ 
                error: 'HWID not registered. Contact an owner to add you.' 
            });
        }
    }

    // Generate session token
    const token = jwt.sign(
        { 
            id: user.id, 
            hwid: user.hwid, 
            isOwner: user.isOwner 
        }, 
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );

    // Save session
    const sessions = readSessions();
    sessions.push({
        token,
        hwid: user.hwid,
        userId: user.id,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
    writeSessions(sessions);

    res.json({
        success: true,
        token,
        user: {
            id: user.id,
            hwid: user.hwid,
            username: user.username,
            isOwner: user.isOwner,
            settings: user.settings
        }
    });
});

// 2. Get all active users (for website)
app.get('/api/users', authenticateToken, (req, res) => {
    const users = readUsers();
    const sessions = readSessions();
    
    // Get active users (with valid sessions)
    const activeUsers = users.map(user => {
        const activeSession = sessions.find(s => 
            s.userId === user.id && 
            new Date(s.expiresAt) > new Date()
        );
        
        return {
            ...user,
            isActive: !!activeSession,
            sessionId: activeSession ? activeSession.token : null
        };
    });

    res.json(activeUsers);
});

// 3. Update user settings (Lag, Crash, Kick)
app.put('/api/users/:userId/settings', authenticateToken, (req, res) => {
    const { userId } = req.params;
    const { lagPercentage, crashEnabled, kickMessage } = req.body;

    // Check if user is owner
    if (!req.user.isOwner) {
        return res.status(403).json({ error: 'Only owners can modify settings' });
    }

    let users = readUsers();
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Update settings
    if (lagPercentage !== undefined) {
        users[userIndex].settings.lagPercentage = Math.min(100, Math.max(0, lagPercentage));
    }
    if (crashEnabled !== undefined) {
        users[userIndex].settings.crashEnabled = crashEnabled;
    }
    if (kickMessage !== undefined) {
        users[userIndex].settings.kickMessage = kickMessage;
    }

    writeUsers(users);

    res.json({
        success: true,
        settings: users[userIndex].settings
    });
});

// 4. Trigger crash for specific user
app.post('/api/users/:userId/crash', authenticateToken, (req, res) => {
    const { userId } = req.params;

    if (!req.user.isOwner) {
        return res.status(403).json({ error: 'Only owners can trigger crashes' });
    }

    const users = readUsers();
    const user = users.find(u => u.id === userId);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Enable crash for this user
    user.settings.crashEnabled = true;
    writeUsers(users);

    // Log crash event
    console.log(`[CRASH] User ${user.username} (${user.hwid}) crashed by ${req.user.id}`);

    res.json({
        success: true,
        message: `Crash triggered for ${user.username}`,
        user: user
    });
});

// 5. Kick user with custom message
app.post('/api/users/:userId/kick', authenticateToken, (req, res) => {
    const { userId } = req.params;
    const { message } = req.body;

    if (!req.user.isOwner) {
        return res.status(403).json({ error: 'Only owners can kick users' });
    }

    let users = readUsers();
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Update kick message
    if (message) {
        users[userIndex].settings.kickMessage = message;
    }

    // Force session expiration
    const sessions = readSessions();
    const updatedSessions = sessions.filter(s => s.userId !== userId);
    writeSessions(updatedSessions);

    writeUsers(users);

    res.json({
        success: true,
        message: `User ${users[userIndex].username} kicked`,
        kickMessage: users[userIndex].settings.kickMessage
    });
});

// 6. Add new user (Owner only)
app.post('/api/users/add', authenticateToken, (req, res) => {
    const { hwid, username } = req.body;

    if (!req.user.isOwner) {
        return res.status(403).json({ error: 'Only owners can add users' });
    }

    if (!hwid) {
        return res.status(400).json({ error: 'HWID is required' });
    }

    let users = readUsers();
    
    // Check if user already exists
    if (users.find(u => u.hwid === hwid)) {
        return res.status(400).json({ error: 'User with this HWID already exists' });
    }

    const newUser = {
        id: crypto.randomUUID(),
        hwid: hwid,
        username: username || `User_${hwid.slice(0, 8)}`,
        isOwner: false,
        createdAt: new Date().toISOString(),
        settings: {
            lagPercentage: 50,
            crashEnabled: false,
            kickMessage: 'Your connection has been lost. Please try again later.'
        }
    };

    users.push(newUser);
    writeUsers(users);

    res.json({
        success: true,
        user: newUser
    });
});

// 7. Remove user (Owner only)
app.delete('/api/users/:userId', authenticateToken, (req, res) => {
    const { userId } = req.params;

    if (!req.user.isOwner) {
        return res.status(403).json({ error: 'Only owners can remove users' });
    }

    let users = readUsers();
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Remove user's sessions
    const sessions = readSessions();
    const updatedSessions = sessions.filter(s => s.userId !== userId);
    writeSessions(updatedSessions);

    // Remove user
    users.splice(userIndex, 1);
    writeUsers(users);

    res.json({
        success: true,
        message: 'User removed successfully'
    });
});

// 8. Get active sessions count
app.get('/api/stats', authenticateToken, (req, res) => {
    const sessions = readSessions();
    const activeSessions = sessions.filter(s => new Date(s.expiresAt) > new Date());
    
    res.json({
        totalUsers: readUsers().length,
        activeUsers: activeSessions.length,
        timestamp: new Date().toISOString()
    });
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});