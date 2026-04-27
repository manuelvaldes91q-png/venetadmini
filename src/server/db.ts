import Database from 'better-sqlite3';

let db: Database.Database;

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
      disabled INTEGER DEFAULT 0
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

  // Seed DB if profiles are empty
  const profileCount = db.prepare('SELECT COUNT(*) as count FROM profiles').get() as {count: number};
  if (profileCount.count === 0) {
    db.prepare('INSERT INTO profiles (id, name, rxLimit, txLimit) VALUES (?, ?, ?, ?)').run('prof-1', '10Mbps', '10M', '5M');
    db.prepare('INSERT INTO profiles (id, name, rxLimit, txLimit) VALUES (?, ?, ?, ?)').run('prof-2', '20Mbps', '20M', '10M');
    db.prepare('INSERT INTO profiles (id, name, rxLimit, txLimit) VALUES (?, ?, ?, ?)').run('prof-3', '50Mbps', '50M', '25M');
    
    // Fake router
    db.prepare('INSERT INTO routers (id, name, host, port, username, password, status) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      'rt-1', 'Core Router', '192.168.88.1', 8728, 'admin', '', 'connected'
    );

    // Fake clients
    db.prepare('INSERT INTO clients (id, routerId, name, ip, mac, status, profileId, disabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      'cl-1', 'rt-1', 'John Doe - Home', '192.168.88.10', '00:11:22:33:44:55', 'active', 'prof-2', 0
    );
    db.prepare('INSERT INTO clients (id, routerId, name, ip, mac, status, profileId, disabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      'cl-2', 'rt-1', 'Tech Corp S.A.', '192.168.88.11', 'AA:BB:CC:DD:EE:FF', 'cut', 'prof-3', 1
    );
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
