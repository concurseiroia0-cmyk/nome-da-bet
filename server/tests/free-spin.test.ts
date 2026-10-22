/**
 * OBRIGATÓRIO: a bola bronze não debita créditos na tentativa grátis e não
 * encadeia uma nova tentativa grátis (bronze dentro da grátis paga 0 e encerra).
 */
import { describe, expect, it } from 'vitest';
import type { Ball } from '@shared';
import { DEFAULT_MULTIPLIERS, DEFAULT_PROBABILITIES } from '@shared';
import { computePayout, resolveRound } from '../src/games/ball-roulette/index.js';
import { getBalance, prisma, registerPlayer, spin } from './helpers.js';

describe('bola bronze - tentativa grátis', () => {
  it('resolveRound: bronze paga 0 na rodada paga e gera exatamente UMA grátis', () => {
    const alwaysBronze = () => 'bronze' as Ball;
    const res = resolveRound(100, DEFAULT_PROBABILITIES, DEFAULT_MULTIPLIERS, alwaysBronze);

    expect(res.ball).toBe('bronze');
    expect(res.payout).toBe(0); // bronze não paga na própria rodada
    expect(res.freeSpin).not.toBeNull();
    expect(res.freeSpin!.ball).toBe('bronze'); // também saiu bronze na grátis
    expect(res.freeSpin!.payout).toBe(0); // paga 0 e encerra a sequência
    // NÃO encadeia: resolveRound devolve no máximo 1 tentativa grátis.
  });

  it('resolveRound: na tentativa grátis prata/dourada/preta pagam multiplicador × aposta original', () => {
    /** Sorteio determinístico: primeira bola = bronze, segunda = a desejada. */
    const sequenceDraw = (second: Ball) => {
      let calls = 0;
      return () => (calls++ === 0 ? ('bronze' as Ball) : second);
    };

    const prata = resolveRound(100, DEFAULT_PROBABILITIES, DEFAULT_MULTIPLIERS, sequenceDraw('prata'));
    expect(prata.ball).toBe('bronze');
    expect(prata.payout).toBe(0);
    expect(prata.freeSpin!.ball).toBe('prata');
    expect(prata.freeSpin!.payout).toBe(computePayout(100, DEFAULT_MULTIPLIERS.prata)); // 150

    const gold = resolveRound(100, DEFAULT_PROBABILITIES, DEFAULT_MULTIPLIERS, sequenceDraw('dourada'));
    expect(gold.freeSpin!.payout).toBe(computePayout(100, DEFAULT_MULTIPLIERS.dourada)); // 200

    const black = resolveRound(100, DEFAULT_PROBABILITIES, DEFAULT_MULTIPLIERS, sequenceDraw('preta'));
    expect(black.freeSpin!.payout).toBe(computePayout(100, DEFAULT_MULTIPLIERS.preta)); // 1000

    // Branca na tentativa grátis: paga 0 e encerra a sequência.
    const white = resolveRound(100, DEFAULT_PROBABILITIES, DEFAULT_MULTIPLIERS, sequenceDraw('branca'));
    expect(white.freeSpin!.payout).toBe(0);
  });

  it('integração: bronze cobra UMA aposta só, grátis não debita e não gera netos', async () => {
    const { agent } = await registerPlayer();
    const cfg = (await agent.get('/api/roulette/config')).body;
    const bet = cfg.minBet; // 100 centésimos

    let bronzeResponse: any = null;
    let spins = 0;
    // 10% de chance por giro; 400 tentativas tornam o não-ocorrimento ~1e-19.
    while (!bronzeResponse && spins < 400) {
      spins += 1;
      const res = await spin(agent, { bet });
      expect(res.status).toBe(200);
      if (res.body.steps[0].ball === 'bronze') bronzeResponse = res.body;
    }
    expect(bronzeResponse, 'bronze não apareceu em 400 giros').toBeTruthy();

    const [paid, free] = bronzeResponse.steps;
    expect(bronzeResponse.steps).toHaveLength(2);
    expect(paid.isFreeSpin).toBe(false);
    expect(free.isFreeSpin).toBe(true);
    expect(free.parentRoundId).toBe(paid.roundId);

    // Débito total: exatamente UMA aposta (a grátis não debita nada).
    const totalPayout = paid.payout + free.payout;
    expect(paid.balanceBefore - bronzeResponse.balance).toBe(bet - totalPayout);
    expect(paid.payout).toBe(0); // bronze pagam 0 na rodada paga
    expect(free.balanceBefore).toBe(paid.balanceAfter); // sem débito entre as etapas

    // Saldo final bate com o banco.
    expect(await getBalance(agent)).toBe(bronzeResponse.balance);
    expect(bronzeResponse.balance).toBeGreaterThanOrEqual(0);

    // Nenhuma tentativa grátis gerou outra (sem netos no banco).
    const freeRounds = await prisma.round.findMany({
      where: { id: { in: bronzeResponse.steps.map((s: any) => s.roundId) } },
    });
    expect(freeRounds).toHaveLength(2);
    const grandChildren = await prisma.round.count({
      where: { parentRoundId: free.roundId },
    });
    expect(grandChildren).toBe(0);
  });
});
