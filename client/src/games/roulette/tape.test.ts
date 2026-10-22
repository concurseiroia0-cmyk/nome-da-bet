/**
 * Testes da fita horizontal (spec 8.2/8.3/8.5):
 * - NEUTRALIDADE: a fita é gerada só com as probabilidades configuradas e não
 *   depende do resultado (vizinhança não é manipulada);
 * - alvo a ≥ 40 bolas com a bola sorteada e posição final exata (≤ 2 px);
 * - curva de movimento: aceleração → cruzeiro → easeOutQuart até o alvo.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROBABILITIES, type Ball } from '@shared';
import {
  ACCEL_S,
  CRUISE_S,
  MIN_LEAD,
  SETTLE_GAP_PX,
  STEP_PX,
  centerIndexAt,
  cruiseSpeed,
  findTargetIndex,
  makeBallSource,
  mulberry32,
  planSpin,
  positionAtTime,
  positionOf,
  settlePosition,
  totalSpinTime,
} from './tape.ts';

describe('fita neutra (independente do resultado)', () => {
  it('é determinística por semente e respeita as probabilidades configuradas', () => {
    const a = makeBallSource(DEFAULT_PROBABILITIES, 123);
    const b = makeBallSource(DEFAULT_PROBABILITIES, 123);
    expect(a(0)).toBe(b(0));
    expect(a(999)).toBe(b(999));

    const N = 20_000;
    const counts: Record<Ball, number> = { branca: 0, bronze: 0, prata: 0, dourada: 0, preta: 0 };
    const src = makeBallSource(DEFAULT_PROBABILITIES, 99);
    for (let i = 0; i < N; i += 1) counts[src(i)] += 1;
    for (const ball of Object.keys(counts) as Ball[]) {
      const observed = counts[ball] / N;
      const expected = DEFAULT_PROBABILITIES[ball] / 10_000;
      expect(Math.abs(observed - expected)).toBeLessThan(0.02);
    }
  });

  it('NEUTRALIDADE: a sequência da fita é idêntica qualquer que seja o resultado', () => {
    const seed = 777;
    const fitaA = makeBallSource(DEFAULT_PROBABILITIES, seed);
    const fitaB = makeBallSource(DEFAULT_PROBABILITIES, seed);
    const center = 500;
    // Alvos diferentes para bolas diferentes: a fita ANTES do alvo é a mesma.
    const alvoA = findTargetIndex(fitaA, 'preta', center);
    const alvoB = findTargetIndex(fitaB, 'branca', center);
    for (let i = center - 20; i < Math.min(alvoA, alvoB); i += 1) {
      expect(fitaA(i)).toBe(fitaB(i));
    }
    // E a escolha do alvo não altera nenhuma bola da fita em lugar algum.
    for (let i = 0; i < 1500; i += 1) {
      const src = makeBallSource(DEFAULT_PROBABILITIES, seed);
      expect(src(i)).toBe(fitaA(i));
    }
  });
});

describe('planejamento do giro', () => {
  it('para sobre uma ocorrência da bola sorteada a ≥ 40 bolas, exatamente no marcador (≤ 2 px)', () => {
    const src = makeBallSource(DEFAULT_PROBABILITIES, 42);
    const centerX = 340;
    const offsetStart = 0;
    const plan = planSpin(src, 'dourada', offsetStart, centerX, mulberry32(1));

    expect(plan.targetIndex).toBeGreaterThanOrEqual(MIN_LEAD);
    expect(src(plan.targetIndex)).toBe('dourada');

    const finalOffset = offsetStart + plan.distance;
    const x = positionOf(plan.targetIndex, finalOffset, centerX);
    expect(Math.abs(x - centerX)).toBeLessThanOrEqual(2);
    // O centro da fita no fim é exatamente a bola sorteada.
    expect(centerIndexAt(finalOffset, centerX)).toBe(plan.targetIndex);
  });

  it('funciona para todas as bolas possíveis do resultado', () => {
    const src = makeBallSource(DEFAULT_PROBABILITIES, 42);
    for (const ball of ['branca', 'bronze', 'prata', 'dourada', 'preta'] as Ball[]) {
      const plan = planSpin(src, ball, 1234, 300, mulberry32(9));
      expect(src(plan.targetIndex)).toBe(ball);
      const x = positionOf(plan.targetIndex, 1234 + plan.distance, 300);
      expect(Math.abs(x - 300)).toBeLessThanOrEqual(2);
    }
  });
});

describe('curva de movimento (spec 8.3)', () => {
  const D = 12_345;
  const td = 5;

  it('começa em 0 e termina exatamente na distância planejada, monotônica', () => {
    expect(positionAtTime(0, D, td)).toBe(0);
    const end = totalSpinTime(td);
    expect(positionAtTime(end, D, td)).toBeCloseTo(D, 6);
    let prev = -1;
    for (let t = 0; t <= end; t += 0.05) {
      const p = positionAtTime(t, D, td);
      expect(p).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = p;
    }
  });

  it('é contínua nas fronteiras das fases e desacelera até praticamente parar', () => {
    const h = 0.001;
    const vel = (t: number) => (positionAtTime(t + h, D, td) - positionAtTime(t, D, td)) / h;
    const t1 = ACCEL_S;
    const t2 = t1 + CRUISE_S;
    const t3 = totalSpinTime(td);

    // Continuidade de posição nas fronteiras (ambos os lados se aproximam
    // do mesmo ponto; a diferença finita é só o próprio movimento).
    const v = cruiseSpeed(D, td);
    const pT1 = positionAtTime(t1, D, td);
    expect(Math.abs(positionAtTime(t1 - 1e-4, D, td) - pT1)).toBeLessThan(v * 2e-4);
    expect(Math.abs(positionAtTime(t1 + 1e-4, D, td) - pT1)).toBeLessThan(v * 2e-4);
    const pT2 = positionAtTime(t2, D, td);
    expect(Math.abs(positionAtTime(t2 - 1e-4, D, td) - pT2)).toBeLessThan(v * 2e-4);
    expect(Math.abs(positionAtTime(t2 + 1e-4, D, td) - pT2)).toBeLessThan(v * 2e-4);

    // Cruzeiro constante ≈ velocidade calculada.
    expect(vel(t2 - 0.05)).toBeCloseTo(cruiseSpeed(D, td), 0);

    // Desaceleração contínua: velocidade cai ao longo da fase e chega ≈ 0.
    const v1 = vel(t2 + 0.3);
    const v2 = vel(t2 + td / 2);
    const v3 = vel(t2 + td - 0.3);
    expect(v1).toBeGreaterThan(v2);
    expect(v2).toBeGreaterThan(v3);
    expect(v3).toBeLessThan(cruiseSpeed(D, td) * 0.1);
  });

  it('o micro-ajuste final assenta suavemente exatamente no alvo', () => {
    expect(settlePosition(0, D)).toBeCloseTo(D - SETTLE_GAP_PX, 6);
    expect(settlePosition(1, D)).toBeCloseTo(D, 6);
    // cresce sem pular
    let prev = settlePosition(0, D);
    for (let p = 0.1; p <= 1; p += 0.1) {
      const v = settlePosition(p, D);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('o passo da fita casa o alinhamento usado no CSS', () => {
    // centerX arbitrário: a distância final sempre fecha o alvo no marcador.
    const src = makeBallSource(DEFAULT_PROBABILITIES, 5);
    const centerX = 371.5; // largura ímpar
    const plan = planSpin(src, 'preta', 0, centerX, mulberry32(3));
    const finalOffset = plan.distance;
    const delta = Math.abs(positionOf(plan.targetIndex, finalOffset, centerX) - centerX);
    expect(delta).toBeLessThanOrEqual(2);
    expect(plan.distance / STEP_PX).toBeGreaterThan(MIN_LEAD - 1);
  });
});
