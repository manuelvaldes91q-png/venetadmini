import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

let db: Database.Database;
const BACKUP_FILE = path.join(process.cwd(), 'nexus_backup.json');

export function backupDbToFile() {
  try {
    if (!db) return;
    const data = {
      settings: db.prepare('SELECT * FROM settings').all(),
      users: db.prepare('SELECT * FROM users').all(),
      routers: db.prepare('SELECT * FROM routers').all(),
      clients: db.prepare('SELECT * FROM clients').all(),
      profiles: db.prepare('SELECT * FROM profiles').all(),
    };
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error backing up database to JSON:', err);
  }
}

export function restoreDbFromFile() {
  try {
    if (!fs.existsSync(BACKUP_FILE)) return;
    const raw = fs.readFileSync(BACKUP_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (!data) return;

    if (Array.isArray(data.routers) && data.routers.length > 0) {
      const currentRouters = db.prepare('SELECT COUNT(*) as c FROM routers').get() as { c: number };
      if (currentRouters.c === 0) {
        const stmt = db.prepare('INSERT OR REPLACE INTO routers (id, name, host, port, username, password, status, lastCheck) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        for (const r of data.routers) {
          stmt.run(r.id, r.name, r.host, r.port || 8728, r.username, r.password, r.status || 'disconnected', r.lastCheck || Date.now());
        }
      }
    }

    if (Array.isArray(data.clients) && data.clients.length > 0) {
      const currentClients = db.prepare('SELECT COUNT(*) as c FROM clients').get() as { c: number };
      if (currentClients.c === 0) {
        const stmt = db.prepare('INSERT OR REPLACE INTO clients (id, routerId, name, ip, mac, status, profileId, provider, disabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const c of data.clients) {
          stmt.run(c.id, c.routerId, c.name, c.ip, c.mac, c.status, c.profileId, c.provider, c.disabled || 0);
        }
      }
    }

    if (Array.isArray(data.settings) && data.settings.length > 0) {
      const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
      for (const s of data.settings) {
        stmt.run(s.key, s.value);
      }
    }

    if (Array.isArray(data.users) && data.users.length > 0) {
      const stmt = db.prepare('INSERT OR REPLACE INTO users (id, username, password, role) VALUES (?, ?, ?, ?)');
      for (const u of data.users) {
        stmt.run(u.id, u.username, u.password, u.role);
      }
    }
  } catch (err) {
    console.error('Error restoring database from JSON:', err);
  }
}

export async function initDb() {
  db = new Database('nexus.db');
  db.pragma('journal_mode = WAL');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      userId TEXT,
      expires INTEGER
    );
    CREATE TABLE IF NOT EXISTS routers (
      id TEXT PRIMARY KEY,
      name TEXT,
      host TEXT,
      port INTEGER,
      username TEXT,
      password TEXT,
      status TEXT,
      lastCheck INTEGER
    );
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      routerId TEXT,
      name TEXT,
      ip TEXT,
      mac TEXT,
      status TEXT,
      profileId TEXT,
      provider TEXT,
      disabled INTEGER DEFAULT 0,
      txBytes INTEGER DEFAULT 0,
      rxBytes INTEGER DEFAULT 0,
      totalBytes INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT,
      rxLimit TEXT,
      txLimit TEXT
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp INTEGER,
      userId TEXT,
      action TEXT,
      details TEXT
    );
  `);

  try {
    db.exec('ALTER TABLE routers ADD COLUMN salidaTx INTEGER DEFAULT 0;');
  } catch(e) {}
  try {
    db.exec('ALTER TABLE routers ADD COLUMN salidaRx INTEGER DEFAULT 0;');
  } catch(e) {}
  try {
    db.exec('ALTER TABLE routers ADD COLUMN lastSalidaTx INTEGER DEFAULT 0;');
  } catch(e) {}
  try {
    db.exec('ALTER TABLE routers ADD COLUMN lastSalidaRx INTEGER DEFAULT 0;');
  } catch(e) {}

  try {
    db.exec('ALTER TABLE clients ADD COLUMN txBytes INTEGER DEFAULT 0;');
  } catch(e) {}
  try {
    db.exec('ALTER TABLE clients ADD COLUMN rxBytes INTEGER DEFAULT 0;');
  } catch(e) {}
  try {
    db.exec('ALTER TABLE clients ADD COLUMN totalBytes INTEGER DEFAULT 0;');
  } catch(e) {}
  try {
    db.exec('ALTER TABLE clients ADD COLUMN lastQueueTx INTEGER DEFAULT 0;');
  } catch(e) {}
  try {
    db.exec('ALTER TABLE clients ADD COLUMN lastQueueRx INTEGER DEFAULT 0;');
  } catch(e) {}
  try {
    db.exec('ALTER TABLE clients ADD COLUMN provider TEXT;');
  } catch(e) {}

  // Attempt auto-restore from JSON if tables are empty
  restoreDbFromFile();

  // Seed DB if profiles are empty
  const profileCount = db.prepare('SELECT COUNT(*) as count FROM profiles').get() as {count: number};
  if (profileCount.count === 0) {
    db.prepare('INSERT INTO profiles (id, name, rxLimit, txLimit) VALUES (?, ?, ?, ?)').run('prof-1', '10Mbps', '10M', '5M');
    db.prepare('INSERT INTO profiles (id, name, rxLimit, txLimit) VALUES (?, ?, ?, ?)').run('prof-2', '20Mbps', '20M', '10M');
    db.prepare('INSERT INTO profiles (id, name, rxLimit, txLimit) VALUES (?, ?, ?, ?)').run('prof-3', '50Mbps', '50M', '25M');
  }

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as {count: number};
  if (userCount.count === 0) {
    // default admin password is 'admin123'
    db.prepare('INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)').run('u-admin', 'admin', 'admin123', 'admin');
  }
}

export function getDb() {
  return db;
}

