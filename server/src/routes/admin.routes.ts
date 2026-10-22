/**
 * Painel admin (rota protegida por papel "admin"):
 *  - editar probabilidades/multiplicadores com validação (soma = 100%);
 *  - prévia de RTP/banca antes de confirmar;
 *  - histórico de versões da configuração (data e autor);
 *  - estatísticas agregadas (apostas, pagamentos, RTP real, distribuição);
 *  - lista de usuários com reset de saldo de teste.
 */
import { Router } from 'express';
import { z } from 'zod';
import { BALLS, INITIAL_CREDITS, type AdminUserDTO, type Ball } from '@shared';
import { audit } from '../audit.js';
import { prisma } from '../db/prisma.js';
import { badRequest, notFound } from '../errors.js';
import { ah } from '../middleware/errorHandler.js';
import { requireAdmin } from '../middleware/auth.js';
import { computeRTP, toRTPPreview, validateGameConfig } from '../games/ball-roulette/index.js';
import { getConfigVersions, getCurrentConfig, saveConfigVersion } from '../services/configService.js';
import { getAggregateStats } from '../services/roundService.js';

const router = Router();

router.use(requireAdmin);

const intMapSchema = z.object(
  Object.fromEntries(BALLS.map((ball) => [ball, z.number().int().min(0)])) as Record<string, z.ZodNumber>,
);

const configSchema = z.object({
  probabilities: intMapSchema,
  multipliers: intMapSchema,
  minBet: z.number().int().positive(),
  maxBet: z.number().int().positive(),
});

// GET /api/admin/config - configuração vigente + histórico de versões
router.get(
  '/config',
  ah(async (_req, res) => {
    const cfg = await getCurrentConfig();
    const [versions, rtp] = [await getConfigVersions(), computeRTP(cfg)];
    res.json({
      current: {
        version: cfg.version,
        probabilities: cfg.probabilities,
        multipliers: cfg.multipliers,
        minBet: cfg.minBet,
        maxBet: cfg.maxBet,
        updatedAt: cfg.updatedAt.toISOString(),
      },
      rtp,
      versions,
    });
  }),
);

// POST /api/admin/config/preview - prévia de RTP/banca SEM salvar
router.post(
  '/config/preview',
  ah(async (req, res) => {
    const body = z.object({ probabilities: intMapSchema, multipliers: intMapSchema }).safeParse(req.body);
    if (!body.success) throw badRequest('VALIDATION_ERROR', 'Formato inválido de probabilidades/multiplicadores.');
    res.json(toRTPPreview(body.data.probabilities, body.data.multipliers));
  }),
);

// POST /api/admin/config - salva NOVA versão (validação obrigatória)
router.post(
  '/config',
  ah(async (req, res) => {
    const parsed = configSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(
        'VALIDATION_ERROR',
        parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      );
    }

    const errors = validateGameConfig({
      probabilities: parsed.data.probabilities as Record<Ball, number>,
      multipliers: parsed.data.multipliers as Record<Ball, number>,
      minBet: parsed.data.minBet,
      maxBet: parsed.data.maxBet,
    });
    if (errors.length > 0) throw badRequest('INVALID_CONFIG', errors.join('; '));

    const cfg = await saveConfigVersion({
      probabilities: parsed.data.probabilities as Record<Ball, number>,
      multipliers: parsed.data.multipliers as Record<Ball, number>,
      minBet: parsed.data.minBet,
      maxBet: parsed.data.maxBet,
      updatedBy: req.auth!.id,
    });
    const preview = toRTPPreview(cfg.probabilities, cfg.multipliers);
    audit('admin.config.updated', {
      version: cfg.version,
      by: req.auth!.id,
      probabilities: cfg.probabilities,
      multipliers: cfg.multipliers,
    });
    res.status(201).json({ current: cfg, preview });
  }),
);

// GET /api/admin/stats - estatísticas agregadas de todas as rodadas
router.get(
  '/stats',
  ah(async (_req, res) => {
    res.json(await getAggregateStats());
  }),
);

// GET /api/admin/users - usuários com saldo e contagem de rodadas
router.get(
  '/users',
  ah(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        balance: true,
        createdAt: true,
        rounds: { select: { id: true } },
      },
      orderBy: { id: 'asc' },
    });
    const dto: AdminUserDTO[] = users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role as AdminUserDTO['role'],
      balance: u.balance,
      createdAt: u.createdAt.toISOString(),
      roundCount: u.rounds.length,
    }));
    res.json({ users: dto });
  }),
);

// POST /api/admin/users/:id/reset - devolve o saldo de teste para 1.000 créditos
router.post(
  '/users/:id/reset',
  ah(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw badRequest('INVALID_ID', 'Id inválido.');
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw notFound('Usuário não encontrado.');

    const updated = await prisma.user.update({
      where: { id },
      data: { balance: INITIAL_CREDITS * 100 },
    });
    audit('admin.user.reset_balance', { by: req.auth!.id, targetUserId: id, newBalance: updated.balance });
    res.json({ id: updated.id, balance: updated.balance });
  }),
);

export default router;
