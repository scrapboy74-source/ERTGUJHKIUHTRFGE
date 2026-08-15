// ===== OWNERS MANAGEMENT =====

// Get all owners
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

// Add owner by Roblox username
app.post('/api/owners/add', authenticateToken, (req, res) => {
    if (!req.user.isOwner) {
        return res.status(403).json({ error: 'Only owners can add other owners' });
    }
    
    const { username } = req.body;
    
    if (!username) {
        return res.status(400).json({ error: 'Roblox username is required' });
    }
    
    let users = readUsers();
    
    // Check if already exists
    const existing = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (existing) {
        return res.status(400).json({ error: 'User already registered' });
    }
    
    // Create new owner with a placeholder HWID
    // The actual HWID will be set when they first execute the script
    const newOwner = {
        id: crypto.randomUUID(),
        hwid: `pending_${username}`,
        username: username,
        isOwner: true,
        createdAt: new Date().toISOString(),
        settings: {
            lagPercentage: 0,
            crashEnabled: false,
            kickMessage: 'Your connection has been lost. Please try again later.'
        }
    };
    
    users.push(newOwner);
    writeUsers(users);
    
    res.json({
        success: true,
        user: newOwner
    });
});

// Remove owner
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
    
    // Prevent removing yourself
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

// ===== SETTINGS MANAGEMENT =====

// Save default kick message
app.post('/api/settings/kick-message', authenticateToken, (req, res) => {
    if (!req.user.isOwner) {
        return res.status(403).json({ error: 'Only owners can change settings' });
    }
    
    const { message } = req.body;
    
    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }
    
    // Store in a settings file or memory
    // For simplicity, we'll store in a settings.json file
    const settingsPath = path.join(__dirname, 'data', 'settings.json');
    let settings = {};
    
    if (fs.existsSync(settingsPath)) {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
    
    settings.defaultKickMessage = message;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    
    res.json({
        success: true,
        message: 'Default kick message saved'
    });
});

// Save default lag
app.post('/api/settings/default-lag', authenticateToken, (req, res) => {
    if (!req.user.isOwner) {
        return res.status(403).json({ error: 'Only owners can change settings' });
    }
    
    const { lagPercentage } = req.body;
    
    if (lagPercentage === undefined || lagPercentage < 0 || lagPercentage > 100) {
        return res.status(400).json({ error: 'Invalid lag percentage (0-100)' });
    }
    
    const settingsPath = path.join(__dirname, 'data', 'settings.json');
    let settings = {};
    
    if (fs.existsSync(settingsPath)) {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
    
    settings.defaultLag = lagPercentage;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    
    res.json({
        success: true,
        message: 'Default lag saved'
    });
});

// Save session timeout
app.post('/api/settings/session-timeout', authenticateToken, (req, res) => {
    if (!req.user.isOwner) {
        return res.status(403).json({ error: 'Only owners can change settings' });
    }
    
    const { timeout } = req.body;
    
    if (!timeout || timeout < 1) {
        return res.status(400).json({ error: 'Invalid timeout value' });
    }
    
    const settingsPath = path.join(__dirname, 'data', 'settings.json');
    let settings = {};
    
    if (fs.existsSync(settingsPath)) {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
    
    settings.sessionTimeout = timeout;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    
    res.json({
        success: true,
        message: 'Session timeout saved'
    });
});

// Get settings
app.get('/api/settings', authenticateToken, (req, res) => {
    const settingsPath = path.join(__dirname, 'data', 'settings.json');
    let settings = {};
    
    if (fs.existsSync(settingsPath)) {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
    
    res.json({
        defaultKickMessage: settings.defaultKickMessage || 'Your connection has been lost. Please try again later.',
        defaultLag: settings.defaultLag || 50,
        sessionTimeout: settings.sessionTimeout || 10
    });
});

// ===== SCRIPT EXECUTION API =====

// Register a user executing the script
app.post('/api/script/register', (req, res) => {
    const { hwid, robloxUsername } = req.body;
    
    if (!hwid) {
        return res.status(400).json({ error: 'HWID is required' });
    }
    
    let users = readUsers();
    let user = users.find(u => u.hwid === hwid);
    
    // If user doesn't exist, create a regular user
    if (!user) {
        const newUser = {
            id: crypto.randomUUID(),
            hwid: hwid,
            username: robloxUsername || `User_${hwid.slice(0, 8)}`,
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
    }
    
    // Update username if provided and different
    if (robloxUsername && user.username !== robloxUsername) {
        user.username = robloxUsername;
        writeUsers(users);
    }
    
    // Create/update session
    const sessions = readSessions();
    const existingSession = sessions.find(s => s.userId === user.id);
    
    if (existingSession) {
        // Update existing session
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
    
    // Get current settings
    const settingsPath = path.join(__dirname, 'data', 'settings.json');
    let settings = {};
    if (fs.existsSync(settingsPath)) {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
    
    res.json({
        success: true,
        user: {
            id: user.id,
            username: user.username,
            hwid: user.hwid,
            isOwner: user.isOwner,
            settings: {
                lagPercentage: user.settings.lagPercentage || 50,
                crashEnabled: user.settings.crashEnabled || false,
                kickMessage: user.settings.kickMessage || settings.defaultKickMessage || 'Your connection has been lost. Please try again later.'
            }
        }
    });
});

// Get script commands for a user
app.get('/api/script/commands/:hwid', (req, res) => {
    const { hwid } = req.params;
    
    let users = readUsers();
    const user = users.find(u => u.hwid === hwid);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    // Get settings
    const settingsPath = path.join(__dirname, 'data', 'settings.json');
    let settings = {};
    if (fs.existsSync(settingsPath)) {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
    
    res.json({
        success: true,
        commands: {
            lagPercentage: user.settings.lagPercentage || settings.defaultLag || 50,
            crashEnabled: user.settings.crashEnabled || false,
            kickMessage: user.settings.kickMessage || settings.defaultKickMessage || 'Your connection has been lost. Please try again later.'
        }
    });
});

// Update user status (keep alive)
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
    
    // Update session
    const sessions = readSessions();
    const session = sessions.find(s => s.userId === user.id);
    
    if (session) {
        session.expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        writeSessions(sessions);
    }
    
    res.json({ success: true });
});