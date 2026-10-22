/**
 * Resolução pura de uma rodada da Roleta de Bolas.
 *
 * É a ÚNICA fonte de regras de pagamento, usada tanto pelo motor transacional
 * (engine.ts) quanto pela simulação (simulation.ts) — assim o RTP medido no
 * simulador sempre corresponde ao código executado em produção.
 *
 * Regras:
 *  - Branca: 0x → perde a aposta.
 *  - Bronze: 0x na própria rodada + 1 tentativa grátis (não debita; não encadeia).
 *  - Prata 1.5x / Dourada 2x / Preta 10x → pagamento TOTAL da rodada (inclui a aposta).
 *  - Na tentativa grátis, prata/dourada/preta pagam multiplicador × aposta original;
 *    branca e bronze pagam 0 e encerram a sequência.
 */
import { FREE_SPIN_BALL, type Ball } from '@shared';
import { drawBall, type ProbabilityMap } from './draw.js';

export interface MultiplierMap {
  [ball: string]: number; // centésimos
}

export interface FreeSpinResolution {
  ball: Ball;
  multiplier: number; // centésimos
  payout: number; // centésimos
}

export interface RoundResolution {
  ball: Ball;
  multiplier: number; // centésimos
  payout: number; // centésimos (retorno TOTAL; 0 para branca e bronze)
  freeSpin: FreeSpinResolution | null;
}

/** Pagamento total da rodada: aposta × multiplicador, arredondado para baixo. */
export function computePayout(bet: number, multiplierHundredths: number): number {
  return Math.floor((bet * multiplierHundredths) / 100);
}

/**
 * Sorteia e resolve uma rodada completa (paga + eventual tentativa grátis).
 * `draw` é injetável apenas para testes; em produção usa crypto.randomInt.
 */
export function resolveRound(
  bet: number,
  probabilities: ProbabilityMap,
  multipliers: MultiplierMap,
  draw: (probabilities: ProbabilityMap) => Ball = drawBall,
): RoundResolution {
  const ball = draw(probabilities);
  const multiplier = multipliers[ball] ?? 0;

  let freeSpin: FreeSpinResolution | null = null;
  if (ball === FREE_SPIN_BALL) {
    // Tentativa grátis: sorteio próprio, sem débito e SEM encadeamento.
    const freeBall = draw(probabilities);
    const freeMultiplier = multipliers[freeBall] ?? 0;
    freeSpin = {
      ball: freeBall,
      multiplier: freeMultiplier,
      payout: computePayout(bet, freeMultiplier),
    };
  }

  return {
    ball,
    multiplier,
    payout: computePayout(bet, multiplier),
    freeSpin,
  };
}
