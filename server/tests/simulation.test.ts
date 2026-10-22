/**
 * OBRIGATÓRIO: simulação de milhões de rodadas dentro da tolerância do RTP.
 * O teste FALHA se o RTP simulado divergir do teórico além da tolerância
 * configurada (RTP_TOLERANCE).
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_MULTIPLIERS, DEFAULT_PROBABILITIES } from '@shared';
import { formatSimulationReport, simulate } from '../src/games/ball-roulette/index.js';

const TOLERANCE = Number(process.env.RTP_TOLERANCE ?? 0.01);

describe('simulação da Roleta de Bolas', () => {
  it(`1.000.000 de rodadas medem RTP dentro da tolerância (${TOLERANCE})`, () => {
    const result = simulate({
      rounds: 1_000_000,
      probabilities: DEFAULT_PROBABILITIES,
      multipliers: DEFAULT_MULTIPLIERS,
      tolerance: TOLERANCE,
    });

    // O simulador deve marcar a divergência; o teste falha junto com ele.
    expect(
      result.withinTolerance,
      `RTP medido ${(result.measuredRtp * 100).toFixed(4)}% vs teórico ` +
        `${(result.theoreticalRtp * 100).toFixed(4)}% (Δ=${(result.delta * 100).toFixed(4)}% > ${TOLERANCE})`,
    ).toBe(true);
    expect(result.delta).toBeLessThanOrEqual(TOLERANCE);

    // Coerência interna.
    expect(result.theoreticalRtp).toBeCloseTo(0.693, 10);
    expect(result.totalPaid).toBeGreaterThanOrEqual(0);
    expect(result.measuredRtp).toBeGreaterThan(0);
    expect(result.freeSpins).toBeGreaterThan(0);
    expect(result.stddevPerRound).toBeGreaterThan(0);
    expect(result.longestLosingStreak).toBeGreaterThan(0);
  }, 120_000);

  it('frequências das bolas convergem para as probabilidades configuradas', () => {
    const result = simulate({
      rounds: 500_000,
      probabilities: DEFAULT_PROBABILITIES,
      multipliers: DEFAULT_MULTIPLIERS,
      tolerance: TOLERANCE,
    });

    const expectedPct = {
      branca: 62,
      bronze: 10,
      prata: 18,
      dourada: 8,
      preta: 2,
    } as const;

    for (const [ball, expected] of Object.entries(expectedPct)) {
      const measured = result.ballFrequency[ball as keyof typeof expectedPct];
      // Tolerância estatística de ±1.5 ponto percentual (n=500k).
      expect(Math.abs(measured - expected), `${ball}: ${measured}% vs ${expected}%`).toBeLessThan(1.5);
    }
  }, 120_000);

  it('o relatório formatado traz RTP medido e teórico', () => {
    const result = simulate({
      rounds: 10_000,
      probabilities: DEFAULT_PROBABILITIES,
      multipliers: DEFAULT_MULTIPLIERS,
      tolerance: TOLERANCE,
    });
    const report = formatSimulationReport(result);
    expect(report).toContain('RTP teórico');
    expect(report).toContain('RTP medido');
    expect(report).toContain('Maior sequência de perdas');
    expect(report).toContain('preta');
  });
});
