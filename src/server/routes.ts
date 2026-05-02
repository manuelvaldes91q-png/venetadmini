import { Router } from 'express';
import { getDb } from './db.js';
import { 
    syncRouter, 
    provisionClientToRouter, 
    toggleClientOnRouter, 
    deleteClientOnRouter, 
    getLeasesFromRouters,
    setClientProviderOnRouter
} from './services/mikrotik.js';
import crypto from 'crypto';

export const apiRouter = Router();

// Middleware to check session
const requireAuth = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND expires > ?').get(token, Date.now()) as any;
  if (!session) return res.status(401).json({ error: 'Session expired or invalid' });
  
  const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(session.userId) as any;
  if (!user) return res.status(401).json({ error: 'User not found' });
  
  req.user = user;
  next();
};

const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden. Admin only.' });
  next();
};

apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// AUTH
apiRouter.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password) as any;
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  
  const sessionId = crypto.randomUUID();
  const expires = Date.now() + 1000 * 60 * 60 * 24; // 24 hours
  db.prepare('INSERT INTO sessions (id, userId, expires) VALUES (?, ?, ?)').run(sessionId, user.id, expires);
  
  res.json({ token: sessionId, user: { id: user.id, username: user.username, role: user.role } });
});

apiRouter.get('/auth/me', requireAuth, (req: any, res) => {
  res.json({ user: req.user });
});

// USERS
apiRouter.get('/users', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, username, role FROM users').all();
  res.json(users);
});

apiRouter.post('/users', requireAuth, requireAdmin, (req, res) => {
  const { username, password, role } = req.body;
  const db = getDb();
  try {
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)').run(id, username, password, role);
    res.json({ id, username, role });
  } catch(err) {
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.delete('/users/:id', requireAuth, requireAdmin, (req: any, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  const db = getDb();
  try {
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: String(err) });
  }
});


// ROUTERS
apiRouter.get('/routers', requireAuth, (req, res) => {
  const db = getDb();
  const routers = db.prepare('SELECT id, name, host, port, username, status, lastCheck, salidaTx, salidaRx FROM routers').all();
  res.json(routers);
});

apiRouter.post('/routers', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const { name, host, port, username, password } = req.body;
  const id = crypto.randomUUID();
  try {
    db.prepare('INSERT INTO routers (id, name, host, port, username, password, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, name, host, port || 8728, username, password, 'disconnected');
    
    // Trigger sync
    syncRouter(id).catch(console.error);
    
    res.json({ id, status: 'success' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// CLIENTS
apiRouter.get('/clients', requireAuth, (req, res) => {
  const db = getDb();
  const clients = db.prepare(`
    SELECT c.*, p.name as profileName 
    FROM clients c 
    LEFT JOIN profiles p ON c.profileId = p.id
  `).all();
  res.json(clients);
});

apiRouter.post('/clients', requireAuth, async (req: any, res) => {
  if (req.user.role === 'readonly') return res.status(403).json({ error: 'Readonly users cannot modify clients' });
  const db = getDb();
  const { routerId, name, ip, mac, profileId, provider } = req.body;
  const id = crypto.randomUUID();
  try {
    const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId) as any;
    const limit = profile ? `${profile.txLimit}/${profile.rxLimit}` : '0/0';

    await provisionClientToRouter(routerId, name, ip, mac, limit);
    
    if (provider) {
        await setClientProviderOnRouter(routerId, ip, provider);
    }

    db.prepare('INSERT INTO clients (id, routerId, name, ip, mac, status, profileId, provider, disabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, routerId, name, ip, mac, 'active', profileId, provider, 0);

    res.json({ id, status: 'success' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.post('/clients/:id/toggle', requireAuth, async (req: any, res) => {
  if (req.user.role === 'readonly') return res.status(403).json({ error: 'Readonly users cannot modify clients' });
  const db = getDb();
  const { id } = req.params;
  try {
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as any;
    if (!client) return res.status(404).json({ error: 'Not found' });
    
    const newDisabled = client.disabled ? 0 : 1;
    const newStatus = newDisabled ? 'cut' : 'active';

    await toggleClientOnRouter(client.routerId, client.ip, newDisabled === 1);
    
    db.prepare('UPDATE clients SET disabled = ?, status = ? WHERE id = ?')
      .run(newDisabled, newStatus, id);
    
    res.json({ success: true, newStatus });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.put('/clients/:id/profile', requireAuth, async (req: any, res) => {
  if (req.user.role === 'readonly') return res.status(403).json({ error: 'Readonly' });
  const db = getDb();
  const { id } = req.params;
  const { profileId } = req.body;
  try {
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as any;
    const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId) as any;
    if(client && profile) {
        const limit = `${profile.txLimit}/${profile.rxLimit}`;
        await provisionClientToRouter(client.routerId, client.name, client.ip, client.mac, limit);
    }
    db.prepare('UPDATE clients SET profileId = ? WHERE id = ?').run(profileId, id);
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.put('/clients/:id/provider', requireAuth, async (req: any, res) => {
  if (req.user.role === 'readonly') return res.status(403).json({ error: 'Readonly' });
  const db = getDb();
  const { id } = req.params;
  const { provider } = req.body; // 'Inter', 'Airtek', or null
  try {
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as any;
    if(!client) return res.status(404).json({ error: 'Client not found' });
    
    await setClientProviderOnRouter(client.routerId, client.ip, provider);
    
    db.prepare('UPDATE clients SET provider = ? WHERE id = ?').run(provider, id);
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.delete('/clients/:id', requireAuth, async (req: any, res) => {
  if (req.user.role === 'readonly') return res.status(403).json({ error: 'Readonly' });
  const db = getDb();
  const { id } = req.params;
  try {
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as any;
    if(client) {
        await deleteClientOnRouter(client.routerId, client.ip, client.mac);
    }
    db.prepare('DELETE FROM clients WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// PROFILES
apiRouter.get('/profiles', requireAuth, (req, res) => {
  const db = getDb();
  const profiles = db.prepare('SELECT * FROM profiles').all();
  res.json(profiles);
});

apiRouter.post('/profiles', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const { name, rxLimit, txLimit } = req.body;
  const id = crypto.randomUUID();
  try {
    db.prepare('INSERT INTO profiles (id, name, rxLimit, txLimit) VALUES (?, ?, ?, ?)')
      .run(id, name, rxLimit, txLimit);
    res.json({ id, status: 'success' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// STATS
apiRouter.get('/stats', requireAuth, (req, res) => {
  const db = getDb();
  const clientCount = db.prepare('SELECT COUNT(*) as count FROM clients').get() as {count: number};
  const activeCount = db.prepare('SELECT COUNT(*) as count FROM clients WHERE disabled = 0').get() as {count: number};
  const routerCount = db.prepare('SELECT COUNT(*) as count FROM routers').get() as {count: number};
  
  res.json({
    totalClients: clientCount.count,
    activeClients: activeCount.count,
    routers: routerCount.count,
    uptime: process.uptime()
  });
});

// SETTINGS
apiRouter.get('/settings', requireAuth, (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all() as {key: string, value: string}[];
  const settings = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
  res.json(settings);
});

apiRouter.post('/settings', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const settings = req.body;
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  
  try {
    db.transaction(() => {
      for (const [key, value] of Object.entries(settings)) {
        if (value !== undefined && value !== null) stmt.run(key, String(value));
      }
    })();
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: String(err) });
  }
});

// LEASES
apiRouter.get('/leases', requireAuth, async (req, res) => {
  try {
     const leases = await getLeasesFromRouters();
     res.json(leases);
  } catch(err) {
     res.status(500).json({ error: String(err) });
  }
});

apiRouter.delete('/routers/:id', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  try {
    db.prepare('DELETE FROM clients WHERE routerId = ?').run(req.params.id);
    db.prepare('DELETE FROM routers WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: String(err) });
  }
});
