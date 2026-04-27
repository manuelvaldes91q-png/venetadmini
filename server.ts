import express from 'express';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import { initDb } from './src/server/db.js';
import { apiRouter } from './src/server/routes.js';
import { startMikrotikSync } from './src/server/services/mikrotik.js';
import { setupTelegramBot } from './src/server/services/telegram.js';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json());

  // Initialize DB
  await initDb();

  // API Routes
  app.use('/api', apiRouter);

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
    const distPath = new URL('./dist', import.meta.url).pathname;
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(distPath + '/index.html');
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
