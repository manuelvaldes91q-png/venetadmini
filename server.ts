import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import { initDb } from './src/server/db.js';
import { apiRouter } from './src/server/routes.js';
import { startMikrotikSync } from './src/server/services/mikrotik.js';
import { setupTelegramBot } from './src/server/services/telegram.js';
import { securityHeadersMiddleware, apiRateLimiter } from './src/server/security.js';

process.on('uncaughtException', (err) => {
  console.error('[SERVER] Uncaught Exception caught safely:', err?.message || err);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('[SERVER] Unhandled Rejection caught safely:', reason?.message || reason);
});

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.disable('x-powered-by');
  app.use(securityHeadersMiddleware);
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));

  // Initialize DB
  await initDb();

  // API Routes with rate limiting
  app.use('/api', apiRateLimiter, apiRouter);
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'Ruta de API no encontrada.' });
  });

  // Background Services
  startMikrotikSync();
  setupTelegramBot();

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
