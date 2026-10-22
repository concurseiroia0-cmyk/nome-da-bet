/**
 * Fabrica da aplicação Express (usada pelo servidor e pelos testes).
 *
 * Segurança: CORS restrito às origens configuradas, JSON limitado, cookies
 * httpOnly, rate limit no /spin, validação zod e logs de auditoria.
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { config } from './config/index.js';
import { loadSession } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import rouletteRoutes from './routes/roulette.routes.js';
import historyRoutes from './routes/history.routes.js';
import adminRoutes from './routes/admin.routes.js';
import miscRoutes from './routes/misc.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');

  // CORS restrito: apenas as origens configuradas, com credenciais.
  app.use(
    cors({
      origin: (origin, callback) => {
        // Permite requisições sem Origin (curl/testes) e apenas origens configuradas.
        if (!origin || config.corsOrigins.includes(origin)) callback(null, true);
        else callback(null, false);
      },
      credentials: true,
    }),
  );

  // Cabeçalhos básicos de segurança.
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());
  app.use(loadSession);

  app.use('/api/auth', authRoutes);
  app.use('/api/roulette', rouletteRoutes);
  app.use('/api/history', historyRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', miscRoutes);

  // Produção simples: serve o build do client se existir (SERVE_CLIENT=1).
  if (config.serveClient) {
    const distDir = path.resolve(__dirname, '../../client/dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
    }
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
