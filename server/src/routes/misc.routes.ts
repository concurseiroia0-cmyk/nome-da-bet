/** Rotas miscelâneas: health, lobby e recarga de créditos de teste. */
import { Router } from 'express';
import { INITIAL_CREDITS, type LobbyGameDTO } from '@shared';
import { audit } from '../audit.js';
import { prisma } from '../db/prisma.js';
import { ah } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { listGames } from '../games/registry.js';
import { toUserDTO } from '../services/authService.js';

const router = Router();

// GET /api/health
router.get('/health', (_req, res) => {
  res.json({ ok: true, demo: true, note: 'Ambiente de teste: créditos fictícios sem valor real.' });
});

// GET /api/lobby - cards de jogos (disponíveis e "em breve")
router.get(
  '/lobby',
  requireAuth,
  ah(async (_req, res) => {
    const games: LobbyGameDTO[] = listGames().map((game) => ({
      id: game.id,
      name: game.name,
      description: game.description,
      status: game.status,
    }));
    res.json({ games });
  }),
);

// POST /api/test/recharge - devolve o saldo de teste para 1.000 créditos
router.post(
  '/test/recharge',
  requireAuth,
  ah(async (req, res) => {
    const updated = await prisma.user.update({
      where: { id: req.auth!.id },
      data: { balance: INITIAL_CREDITS * 100 },
    });
    audit('test.recharge', { userId: updated.id, balance: updated.balance });
    res.json(toUserDTO(updated));
  }),
);

export default router;
