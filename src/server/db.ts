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
