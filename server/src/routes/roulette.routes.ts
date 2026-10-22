/** Rotas da Roleta de Bolas: configuração vigente e giro. */
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config/index.js';
import { badRequest } from '../errors.js';
import { ah } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { computeRTP, executeSpin } from '../games/ball-roulette/index.js';
import { getCurrentConfig } from '../services/configService.js';

const router = Router();

const spinLimiter = createRateLimiter({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  key: (req) => `spin:${req.auth?.id ?? req.ip}`,
});

const spinSchema = z.object({
  // Centésimos de crédito, inteiro positivo (validações extras na engine).
  bet: z.number().int().positive('Aposta deve ser um inteiro positivo (centésimos).'),
  idempotencyKey: z
    .string()
    .min(8, 'idempotencyKey muito curta.')
    .max(128, 'idempotencyKey muito longa.')
    .regex(/^[A-Za-z0-9_-]+$/, 'idempotencyKey contém caracteres inválidos.'),
});

// GET /api/roulette/config - probabilidades, multiplicadores, limites e RTP teórico
router.get(
  '/config',
  requireAuth,
  ah(async (_req, res) => {
    const cfg = await getCurrentConfig();
    const rtp = computeRTP(cfg);
    res.json({
      minBet: cfg.minBet,
      maxBet: cfg.maxBet,
      probabilities: cfg.probabilities,
      multipliers: cfg.multipliers,
      version: cfg.version,
      rtp: rtp.rtp,
      houseEdge: rtp.houseEdge,
      updatedAt: cfg.updatedAt.toISOString(),
    });
  }),
);

// POST /api/roulette/spin - processa a aposta em UMA transação atômica
router.post(
  '/spin',
  requireAuth,
  spinLimiter,
  ah(async (req, res) => {
    const parsed = spinSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join('; '));
    }

    const cfg = await getCurrentConfig();
    const result = await executeSpin(
      {
        userId: req.auth!.id,
        bet: parsed.data.bet,
        idempotencyKey: parsed.data.idempotencyKey,
      },
      cfg,
    );
    // O cliente apenas exibe a resposta; ele nunca calcula saldo nem resultado.
    res.json(result);
  }),
);

export default router;
