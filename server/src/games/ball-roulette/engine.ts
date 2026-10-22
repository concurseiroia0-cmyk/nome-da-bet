/**
 * Motor transacional da Roleta de Bolas.
 *
 * Garantias:
 *  - UMA transação por aposta: débito → sortear → crédito → persistir.
 *  - O resultado é definido ANTES da animação; o cliente só o exibe.
 *  - Idempotência: a mesma idempotencyKey nunca debita duas vezes
 *    (constraint única no banco + verificação dentro da transação).
 *  - O saldo nunca fica negativo (checagem condicional no UPDATE).
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import type { Ball, RoundStepDTO, SpinResponseDTO } from '@shared';
import { audit } from '../../audit.js';
import { prisma } from '../../db/prisma.js';
import { ApiError, badRequest, unauthorized } from '../../errors.js';
import { drawNonce } from './draw.js';
import { computePayout, resolveRound } from './round-resolver.js';

export interface GameConfigRecord {
  id: number;
  version: number;
  probabilities: Record<Ball, number>;
  multipliers: Record<Ball, number>;
  minBet: number;
  maxBet: number;
}

export interface SpinInput {
  userId: number;
  bet: number; // centésimos
  idempotencyKey: string;
}

type Tx = Prisma.TransactionClient | PrismaClient;

function roundToStep(round: {
  id: number;
  bet: number;
  ball: string;
  multiplier: number;
  payout: number;
  isFreeSpin: boolean;
  parentRoundId: number | null;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: Date;
}): RoundStepDTO {
  return {
    roundId: round.id,
    bet: round.bet,
    ball: round.ball as Ball,
    multiplier: round.multiplier,
    payout: round.payout,
    isFreeSpin: round.isFreeSpin,
    parentRoundId: round.parentRoundId,
    balanceBefore: round.balanceBefore,
    balanceAfter: round.balanceAfter,
    createdAt: round.createdAt.toISOString(),
  };
}

/** Reconstrói a resposta de uma idempotencyKey já processada (replay). */
async function replayResponse(tx: Tx, parentRoundId: number, userId: number): Promise<SpinResponseDTO> {
  const parent = await tx.round.findUniqueOrThrow({ where: { id: parentRoundId } });
  const children = await tx.round.findMany({ where: { parentRoundId: parent.id } });
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
  return {
    balance: user.balance,
    steps: [roundToStep(parent), ...children.map(roundToStep)],
    replayed: true,
  };
}

/**
 * Executa uma aposta completa em UMA transação:
 *  1. valida sessão/saldo;
 *  2. debita a aposta (condicionalmente, garantindo saldo >= 0);
 *  3. sortea com crypto.randomInt (via resolveRound/drawBall);
 *  4. creditas o prêmio;
 *  5. se a bola for bronze, executa a tentativa grátis na MESMA transação;
 *  6. persiste cada etapa como Round (com balanceBefore/balanceAfter).
 */
export async function executeSpin(input: SpinInput, cfg: GameConfigRecord): Promise<SpinResponseDTO> {
  return prisma.$transaction(async (tx) => {
    // 1) Idempotência: se a chave já existe, devolve o resultado gravado.
    const existing = await tx.round.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: { id: true },
    });
    if (existing) {
      audit('roulette.spin.replay', { userId: input.userId, key: input.idempotencyKey, roundId: existing.id });
      return replayResponse(tx, existing.id, input.userId);
    }

    const user = await tx.user.findUnique({ where: { id: input.userId } });
    if (!user) throw unauthorized();

    if (input.bet < cfg.minBet || input.bet > cfg.maxBet) {
      throw badRequest(
        'BET_OUT_OF_RANGE',
        `Aposta fora do permitido (mínimo ${cfg.minBet}, máximo ${cfg.maxBet} centésimos).`,
      );
    }
    if (user.balance < input.bet) {
      throw badRequest('INSUFFICIENT_BALANCE', 'Saldo insuficiente para essa aposta.');
    }

    // 2) Débito atômico e condicional: só debita se o saldo cobrir a aposta.
    const debited = await tx.user.updateMany({
      where: { id: user.id, balance: { gte: input.bet } },
      data: { balance: { decrement: input.bet } },
    });
    if (debited.count === 0) {
      throw badRequest('INSUFFICIENT_BALANCE', 'Saldo insuficiente para essa aposta.');
    }

    let runningBalance = user.balance - input.bet;
    const steps: RoundStepDTO[] = [];

    // 3) Sorteio da rodada PAGA (resultado definido aqui, antes de qualquer animação).
    const resolution = resolveRound(input.bet, cfg.probabilities, cfg.multipliers);
    const paidPayout = computePayout(input.bet, resolution.multiplier);
    if (paidPayout !== resolution.payout) {
      // Invariante defensiva: resolveRound e computePayout devem concordar.
      throw new ApiError(500, 'INTERNAL_ERROR', 'Falha interna no cálculo do prêmio.');
    }
    runningBalance += paidPayout;

    const parentRound = await tx.round.create({
      data: {
        userId: user.id,
        bet: input.bet,
        ball: resolution.ball,
        multiplier: resolution.multiplier,
        payout: paidPayout,
        isFreeSpin: false,
        idempotencyKey: input.idempotencyKey,
        rngSeed: drawNonce(),
        configVersion: cfg.version,
        balanceBefore: user.balance,
        balanceAfter: runningBalance,
      },
    });
    steps.push(roundToStep(parentRound));

    // 4) Tentativa grátis (bronze): na MESMA transação, sem débito e sem
    //    novo bronze em cadeia (resolveRound não encadeia).
    if (resolution.freeSpin) {
      const before = runningBalance;
      runningBalance += resolution.freeSpin.payout;
      const freeRound = await tx.round.create({
        data: {
          userId: user.id,
          bet: input.bet, // referência: aposta original (nada foi debitado)
          ball: resolution.freeSpin.ball,
          multiplier: resolution.freeSpin.multiplier,
          payout: resolution.freeSpin.payout,
          isFreeSpin: true,
          parentRoundId: parentRound.id,
          rngSeed: drawNonce(),
          configVersion: cfg.version,
          balanceBefore: before,
          balanceAfter: runningBalance,
        },
      });
      steps.push(roundToStep(freeRound));
    }

    // 5) Crédito final do prêmio.
    const updated = await tx.user.update({
      where: { id: user.id },
      data: { balance: runningBalance },
    });

    audit('roulette.spin', {
      userId: user.id,
      bet: input.bet,
      steps: steps.map((s) => ({
        roundId: s.roundId,
        ball: s.ball,
        multiplier: s.multiplier,
        payout: s.payout,
        isFreeSpin: s.isFreeSpin,
      })),
      balanceAfter: updated.balance,
      configVersion: cfg.version,
      idempotencyKey: input.idempotencyKey,
    });

    return { balance: updated.balance, steps, replayed: false };
  });
}
