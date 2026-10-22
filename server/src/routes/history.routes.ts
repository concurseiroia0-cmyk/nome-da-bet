/** Rotas de histórico do usuário. */
import { Router } from 'express';
import { z } from 'zod';
import { badRequest } from '../errors.js';
import { ah } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { getRecentRounds, getUserHistory } from '../services/roundService.js';

const router = Router();

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /api/history?page=1&pageSize=20
router.get(
  '/',
  requireAuth,
  ah(async (req, res) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) throw badRequest('VALIDATION_ERROR', 'Parâmetros de paginação inválidos.');
    const result = await getUserHistory(req.auth!.id, parsed.data.page, parsed.data.pageSize);
    res.json(result);
  }),
);

// GET /api/history/recent?limit=10 - últimas rodadas (histórico da tela do jogo)
router.get(
  '/recent',
  requireAuth,
  ah(async (req, res) => {
    const parsed = z
      .object({ limit: z.coerce.number().int().min(1).max(50).default(10) })
      .safeParse(req.query);
    if (!parsed.success) throw badRequest('VALIDATION_ERROR', 'Parâmetro inválido.');
    const items = await getRecentRounds(req.auth!.id, parsed.data.limit);
    res.json({ items });
  }),
);

export default router;
