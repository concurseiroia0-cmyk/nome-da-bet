/**
 * OBRIGATÓRIO: cada multiplicador calculado corretamente.
 * Ex.: aposta 100 + dourada = retorno 200, ganho líquido 100.
 * O retorno TOTAL da rodada já inclui a aposta.
 */
import { describe, expect, it } from 'vitest';
import type { Ball } from '@shared';
import { DEFAULT_MULTIPLIERS, DEFAULT_PROBABILITIES } from '@shared';
import { computePayout, computeRTP, resolveRound } from '../src/games/ball-roulette/index.js';
import { registerPlayer, spin } from './helpers.js';

function forcedDraw(ball: Ball) {
  return () => ball;
}

describe('multiplicadores', () => {
  it('branca: 0x (perde a aposta)', () => {
    const res = resolveRound(100, DEFAULT_PROBABILITIES, DEFAULT_MULTIPLIERS, forcedDraw('branca'));
    expect(res.multiplier).toBe(0);
    expect(res.payout).toBe(0);
    expect(res.freeSpin).toBeNull();
  });

  it('prata: retorno total 1.5x', () => {
    const res = resolveRound(100, DEFAULT_PROBABILITIES, DEFAULT_MULTIPLIERS, forcedDraw('prata'));
    expect(res.payout).toBe(150); // retorno total
    expect(res.payout - 100).toBe(50); // ganho líquido
  });

  it('dourada: aposta 100 + dourada = retorno 200, ganho líquido 100', () => {
    const res = resolveRound(100, DEFAULT_PROBABILITIES, DEFAULT_MULTIPLIERS, forcedDraw('dourada'));
    expect(computePayout(100, DEFAULT_MULTIPLIERS.dourada)).toBe(200);
    expect(res.payout).toBe(200);
    expect(res.payout - 100).toBe(100); // ganho líquido
  });

  it('preta: retorno total 10x', () => {
    const res = resolveRound(100, DEFAULT_PROBABILITIES, DEFAULT_MULTIPLIERS, forcedDraw('preta'));
    expect(res.payout).toBe(1000);
    expect(res.payout - 100).toBe(900);
  });

  it('apostas ímpares arredondam para baixo (sempre a favor da banca)', () => {
    expect(computePayout(101, 150)).toBe(151); // 151.5 → 151
    expect(computePayout(99, 200)).toBe(198);
    expect(computePayout(33, 1000)).toBe(330);
  });

  it('integração: o payout gravado na API bate com o multiplicador da bola', async () => {
    const { agent } = await registerPlayer();
    const cfg = (await agent.get('/api/roulette/config')).body;
    const bet = cfg.minBet;

    const seen = new Set<string>();
    for (let i = 0; i < 120; i += 1) {
      const res = await spin(agent, { bet });
      expect(res.status).toBe(200);
      for (const step of res.body.steps) {
        seen.add(step.ball);
        const expected = Math.floor((bet * cfg.multipliers[step.ball]) / 100);
        expect(step.payout, `ball=${step.ball}`).toBe(expected);
        expect(step.multiplier).toBe(cfg.multipliers[step.ball]);
        if (step.isFreeSpin) {
          // A tentativa grátis paga multiplicador × aposta original (nada debitado).
          expect(step.bet).toBe(bet);
        }
      }
    }
    // Apenas sanity: as bolas mais frequentes aparecem nessa amostra.
    expect(seen.has('branca')).toBe(true);
  });
});

describe('RTP teórico (computeRTP)', () => {
  it('confere o exemplo das configurações iniciais: E=0.63, RTP=69.3%, banca=30.7%', () => {
    const { expectedReturn, rtp, houseEdge } = computeRTP({
      probabilities: DEFAULT_PROBABILITIES,
      multipliers: DEFAULT_MULTIPLIERS,
    });
    expect(expectedReturn).toBeCloseTo(0.63, 10);
    expect(rtp).toBeCloseTo(0.693, 10);
    expect(houseEdge).toBeCloseTo(0.307, 10);
    expect(rtp + houseEdge).toBeCloseTo(1, 10);
  });

  it('respeita a fórmula RTP = E × (1 + p_bronze)', () => {
    const probabilities = { ...DEFAULT_PROBABILITIES, bronze: 2000 }; // 20% de bronze
    const { expectedReturn, rtp } = computeRTP({ probabilities, multipliers: DEFAULT_MULTIPLIERS });
    expect(rtp).toBeCloseTo(expectedReturn * 1.2, 10);
  });
});
