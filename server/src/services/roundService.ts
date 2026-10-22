/** Serviço de rodadas: histórico paginado do usuário e estatísticas agregadas. */
import { BALLS, type AdminStatsDTO, type Ball, type HistoryResponseDTO, type RoundStepDTO } from '@shared';
import { prisma } from '../db/prisma.js';

function toStep(round: {
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

/** Histórico paginado das rodadas do usuário (mais recentes primeiro). */
export async function getUserHistory(
  userId: number,
  page: number,
  pageSize: number,
): Promise<HistoryResponseDTO> {
  const [total, rows] = await Promise.all([
    prisma.round.count({ where: { userId } }),
    prisma.round.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: rows.map(toStep),
    page,
    pageSize,
    total,
  };
}

/** Últimas N rodadas do usuário (usado para popular o histórico da roleta). */
export async function getRecentRounds(userId: number, limit: number): Promise<RoundStepDTO[]> {
  const rows = await prisma.round.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });
  return rows.map(toStep);
}

/** Estatísticas agregadas de TODAS as rodadas (painel admin). */
export async function getAggregateStats(): Promise<AdminStatsDTO> {
  const [paidAgg, payoutAgg, byBall, freeSpinCount, roundCount] = await Promise.all([
    // Total apostado: apenas rodadas PAGAS (tentativas grátis não debitam).
    prisma.round.aggregate({ where: { isFreeSpin: false }, _sum: { bet: true } }),
    // Total pago: inclui o pagamento das tentativas grátis.
    prisma.round.aggregate({ _sum: { payout: true } }),
    prisma.round.groupBy({ by: ['ball'], where: { isFreeSpin: false }, _count: { _all: true } }),
    prisma.round.count({ where: { isFreeSpin: true } }),
    prisma.round.count(),
  ]);

  const totalBet = paidAgg._sum.bet ?? 0;
  const totalPaid = payoutAgg._sum.payout ?? 0;
  const realRtp = totalBet > 0 ? totalPaid / totalBet : 0;

  const ballDistribution = Object.fromEntries(BALLS.map((ball) => [ball, 0])) as Record<Ball, number>;
  for (const entry of byBall) {
    if (BALLS.includes(entry.ball as Ball)) {
      ballDistribution[entry.ball as Ball] = entry._count._all;
    }
  }

  return {
    totalBet,
    totalPaid,
    realRtp,
    houseProfit: totalBet - totalPaid,
    roundCount,
    freeSpinCount: freeSpinCount,
    ballDistribution,
  };
}
