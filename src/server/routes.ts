import { Router } from 'express';
import { getDb } from './db.js';
import { 
    syncRouter, 
    provisionClientToRouter, 
    toggleClientOnRouter, 
    deleteClientOnRouter, 
    getLeasesFromRouters,
    setClientProviderOnRouter,
    getRouterMonitoring,
    updateClientNameOnRouter,
    pingHostOnRouter,
    getAllNetwatchHosts,
    addNetwatchHostToRouter,
    deleteNetwatchHostFromRouter
} from './services/mikrotik.js';
import crypto from 'crypto';
import { 
    hashPassword, 
    verifyPassword, 
    loginRateLimiter, 
    recordFailedLogin, 
    resetFailedLogin 
} from './security.js';

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
apiRouter.post('/auth/login', loginRateLimiter, (req, res) => {
  const { username, password } = req.body;
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1');
  const db = getDb();
  
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  if (!user || !verifyPassword(password, user.password)) {
    recordFailedLogin(ip);
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
  
  resetFailedLogin(ip);

  // If password was stored as plaintext, upgrade it to pbkdf2 automatically!
  if (!user.password.startsWith('pbkdf2:')) {
    const hashed = hashPassword(password);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, user.id);
  }

  const sessionId = crypto.randomUUID();
  const expires = Date.now() + 1000 * 60 * 60 * 24; // 24 hours
  db.prepare('INSERT INTO sessions (id, userId, expires) VALUES (?, ?, ?)').run(sessionId, user.id, expires);
  
  res.json({ 
    token: sessionId, 
    user: { 
      id: user.id, 
      username: user.username, 
      role: user.role,
      isDefaultPassword: password === 'admin123'
    } 
  });
});

apiRouter.post('/auth/logout', requireAuth, (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    const db = getDb();
    db.prepare('DELETE FROM sessions WHERE id = ?').run(token);
  }
  res.json({ success: true });
});

apiRouter.get('/auth/me', requireAuth, (req: any, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, username, password, role FROM users WHERE id = ?').get(req.user.id) as any;
  res.json({ 
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      isDefaultPassword: verifyPassword('admin123', user.password)
    } 
  });
});

// USERS
apiRouter.get('/users', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, username, role FROM users').all();
  res.json(users);
});

apiRouter.post('/users', requireAuth, requireAdmin, (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  if (password.length < 4) return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });

  const db = getDb();
  try {
    const id = crypto.randomUUID();
    const hashedPassword = hashPassword(password);
    db.prepare('INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)').run(id, username, hashedPassword, role || 'tech');
    res.json({ id, username, role: role || 'tech' });
  } catch(err) {
    res.status(500).json({ error: String(err) });
  }
});

// Change own password
const handleChangePassword = (req: any, res: any) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Se requiere la contraseña actual y la nueva contraseña.' });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 4 caracteres.' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id) as any;
    if (!user || !verifyPassword(currentPassword, user.password)) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta.' });
    }

    const hashedPassword = hashPassword(newPassword);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.user.id);

    res.json({ success: true, message: 'Contraseña actualizada correctamente.' });
  } catch (err: any) {
    res.status(500).json({ error: String(err.message || err) });
  }
};

apiRouter.put('/users/change-password', requireAuth, handleChangePassword);
apiRouter.post('/users/change-password', requireAuth, handleChangePassword);
apiRouter.patch('/users/change-password', requireAuth, handleChangePassword);

// Admin reset any user password
const handleAdminResetPassword = (req: any, res: any) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres.' });
    }

    const targetIdentifier = req.params.id || req.body?.userId || req.body?.id || req.body?.username;
    if (!targetIdentifier) {
      return res.status(400).json({ error: 'Usuario no especificado.' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ? OR username = ?').get(targetIdentifier, targetIdentifier) as any;
    if (!user) return res.status(400).json({ error: `Usuario '${targetIdentifier}' no encontrado.` });

    const hashedPassword = hashPassword(newPassword);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, user.id);

    res.json({ success: true, message: `Contraseña de ${user.username} actualizada.` });
  } catch (err: any) {
    res.status(500).json({ error: String(err.message || err) });
  }
};

apiRouter.put('/users/password', requireAuth, requireAdmin, handleAdminResetPassword);
apiRouter.post('/users/password', requireAuth, requireAdmin, handleAdminResetPassword);
apiRouter.put('/users/:id/password', requireAuth, requireAdmin, handleAdminResetPassword);
apiRouter.post('/users/:id/password', requireAuth, requireAdmin, handleAdminResetPassword);
apiRouter.patch('/users/:id/password', requireAuth, requireAdmin, handleAdminResetPassword);

apiRouter.delete('/users/:id', requireAuth, requireAdmin, (req: any, res) => {
  const db = getDb();
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ? OR username = ?').get(req.params.id, req.params.id) as any;
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    if (user.id === req.user.id) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo.' });

    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    db.prepare('DELETE FROM sessions WHERE userId = ?').run(user.id);
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

apiRouter.put('/routers/:id', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const { name, host, port, username, password } = req.body;
  try {
    db.prepare('UPDATE routers SET name = ?, host = ?, port = ?, username = ?, password = ?, status = ? WHERE id = ?')
      .run(name, host, port || 8728, username, password, 'disconnected', req.params.id);
    
    // Trigger sync
    syncRouter(req.params.id).catch(console.error);
    
    res.json({ id: req.params.id, status: 'success' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.post('/routers/test', requireAuth, requireAdmin, async (req, res) => {
  const { host, port, username, password } = req.body;
  try {
    const { testRouterConnection } = await import('./services/mikrotik.js');
    await testRouterConnection(host, port, username, password);
    res.json({ success: true });
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

apiRouter.put('/clients/:id/name', requireAuth, async (req: any, res) => {
  if (req.user.role === 'readonly') return res.status(403).json({ error: 'Readonly' });
  const db = getDb();
  const { id } = req.params;
  const { name } = req.body;
  try {
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as any;
    if(!client) return res.status(404).json({ error: 'Client not found' });
    
    await updateClientNameOnRouter(client.routerId, client.ip, client.mac, name);
    
    db.prepare('UPDATE clients SET name = ? WHERE id = ?').run(name, id);
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

apiRouter.get('/routers/:id/monitor', requireAuth, async (req, res) => {
  try {
    const data = await getRouterMonitoring(req.params.id);
    res.json(data);
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

// NETWATCH & PING MONITORS
apiRouter.get('/netwatch', requireAuth, async (req, res) => {
  try {
    const netwatch = await getAllNetwatchHosts();
    res.json(netwatch);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.post('/netwatch', requireAuth, async (req: any, res) => {
  if (req.user.role === 'readonly') return res.status(403).json({ error: 'Readonly users cannot modify Netwatch' });
  const { routerId, host, comment, interval } = req.body;
  if (!routerId || !host) return res.status(400).json({ error: 'routerId y host son requeridos' });

  try {
    await addNetwatchHostToRouter(routerId, host, comment, interval);
    res.json({ success: true, message: 'Host/Antena agregada a Netwatch' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.delete('/netwatch/:routerId/:mikrotikId', requireAuth, async (req: any, res) => {
  if (req.user.role === 'readonly') return res.status(403).json({ error: 'Readonly users cannot modify Netwatch' });
  const { routerId, mikrotikId } = req.params;
  try {
    await deleteNetwatchHostFromRouter(routerId, mikrotikId);
    res.json({ success: true, message: 'Host/Antena eliminada de Netwatch' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.post('/routers/:id/ping', requireAuth, async (req, res) => {
  const { host, count } = req.body;
  if (!host) return res.status(400).json({ error: 'Host es requerido' });

  try {
    const result = await pingHostOnRouter(req.params.id, host, count || 3);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.post('/netwatch/ping-batch', requireAuth, async (req, res) => {
  const { targets } = req.body; // Array of { routerId, host }
  if (!Array.isArray(targets)) return res.status(400).json({ error: 'targets must be an array' });

  try {
    const results = await Promise.all(
      targets.map(t => pingHostOnRouter(t.routerId, t.host, t.count || 2))
    );
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

