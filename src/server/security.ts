import crypto from 'crypto';

// Password Hashing with PBKDF2 & Salt
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `pbkdf2:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;

  // Support legacy plain text passwords for smooth migration
  if (!storedHash.startsWith('pbkdf2:')) {
    return password === storedHash;
  }

  try {
    const parts = storedHash.split(':');
    if (parts.length !== 3) return false;
    
    const [, salt, hash] = parts;
    const computed = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

// Security Headers Middleware
export function securityHeadersMiddleware(req: any, res: any, next: any) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
}

// In-Memory Rate Limiter for Login (Anti Brute-Force)
const loginAttempts = new Map<string, { count: number; lockUntil: number }>();

export function loginRateLimiter(req: any, res: any, next: any) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();
  const record = loginAttempts.get(String(ip));

  if (record && record.lockUntil > now) {
    const remainingSecs = Math.ceil((record.lockUntil - now) / 1000);
    return res.status(429).json({ 
      error: `Demasiados intentos fallidos. Bloqueado por ${remainingSecs} segundos para proteger el servidor.` 
    });
  }

  next();
}

export function recordFailedLogin(ip: string) {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, lockUntil: 0 };
  
  // If lock expired, reset
  if (record.lockUntil < now) {
    record.count = 0;
  }

  record.count += 1;

  // Lock for 15 minutes after 5 failed attempts
  if (record.count >= 5) {
    record.lockUntil = now + 15 * 60 * 1000;
  }

  loginAttempts.set(ip, record);
}

export function resetFailedLogin(ip: string) {
  loginAttempts.delete(ip);
}

// In-Memory API Rate Limiter (Anti DDoS / Flood)
const apiRequests = new Map<string, { count: number; resetTime: number }>();

export function apiRateLimiter(req: any, res: any, next: any) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 200; // max 200 requests per minute per IP

  const record = apiRequests.get(String(ip));

  if (!record || record.resetTime < now) {
    apiRequests.set(String(ip), { count: 1, resetTime: now + windowMs });
    return next();
  }

  record.count += 1;
  if (record.count > maxRequests) {
    return res.status(429).json({ error: 'Límite de solicitudes alcanzado. Por favor espera un momento.' });
  }

  next();
}
