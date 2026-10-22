/**
 * Serviço de configuração global do jogo (GameConfig).
 * A configuração é GLOBAL: igual para todos os jogadores, sem variação por
 * usuário nem por histórico de ganhos/perdas. Cada salvamento cria uma nova
 * versão (histórico com data e autor).
 */
import {
  DEFAULT_MAX_BET,
  DEFAULT_MIN_BET,
  DEFAULT_MULTIPLIERS,
  DEFAULT_PROBABILITIES,
  type Ball,
} from '@shared';
import {
  computeRTP,
  validateGameConfig,
  type GameConfigRecord,
} from '../games/ball-roulette/index.js';
import { prisma } from '../db/prisma.js';
import { badRequest } from '../errors.js';

interface GameConfigRow {
  id: number;
  version: number;
  probabilities: unknown;
  multipliers: unknown;
  minBet: number;
  maxBet: number;
  updatedAt: Date;
}

function normalize(row: GameConfigRow): GameConfigRecord & { updatedAt: Date } {
  return {
    id: row.id,
    version: row.version,
    probabilities: row.probabilities as Record<Ball, number>,
    multipliers: row.multipliers as Record<Ball, number>,
    minBet: row.minBet,
    maxBet: row.maxBet,
    updatedAt: row.updatedAt,
  };
}

/** Configuração vigente (versão mais alta). Cria a v1 se o banco estiver vazio. */
export async function getCurrentConfig(): Promise<GameConfigRecord & { updatedAt: Date }> {
  const row = await prisma.gameConfig.findFirst({ orderBy: { version: 'desc' } });
  if (row) return normalize(row);

  const created = await prisma.gameConfig.create({
    data: {
      version: 1,
      probabilities: DEFAULT_PROBABILITIES,
      multipliers: DEFAULT_MULTIPLIERS,
      minBet: DEFAULT_MIN_BET,
      maxBet: DEFAULT_MAX_BET,
    },
  });
  return normalize(created);
}

export interface SaveConfigInput {
  probabilities: Record<Ball, number>;
  multipliers: Record<Ball, number>;
  minBet: number;
  maxBet: number;
  updatedBy: number;
}

/** Valida e grava uma NOVA versão da configuração global. */
export async function saveConfigVersion(input: SaveConfigInput): Promise<GameConfigRecord & { updatedAt: Date }> {
  const errors = validateGameConfig(input);
  if (errors.length > 0) {
    throw badRequest('INVALID_CONFIG', `Configuração inválida: ${errors.join('; ')}`);
  }

  const last = await prisma.gameConfig.findFirst({ orderBy: { version: 'desc' } });
  const created = await prisma.gameConfig.create({
    data: {
      version: (last?.version ?? 0) + 1,
      probabilities: input.probabilities,
      multipliers: input.multipliers,
      minBet: input.minBet,
      maxBet: input.maxBet,
      updatedBy: input.updatedBy,
    },
  });
  return normalize(created);
}

export interface ConfigVersionDTO {
  id: number;
  version: number;
  probabilities: Record<Ball, number>;
  multipliers: Record<Ball, number>;
  minBet: number;
  maxBet: number;
  updatedAt: string;
  updatedByEmail: string | null;
}

/** Histórico completo de versões (mais recente primeiro). */
export async function getConfigVersions(): Promise<ConfigVersionDTO[]> {
  const rows = await prisma.gameConfig.findMany({ orderBy: { version: 'desc' } });
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  return rows.map((row) => ({
    id: row.id,
    version: row.version,
    probabilities: row.probabilities as Record<Ball, number>,
    multipliers: row.multipliers as Record<Ball, number>,
    minBet: row.minBet,
    maxBet: row.maxBet,
    updatedAt: row.updatedAt.toISOString(),
    updatedByEmail: row.updatedBy ? (emailById.get(row.updatedBy) ?? null) : null,
  }));
}

export { computeRTP };
