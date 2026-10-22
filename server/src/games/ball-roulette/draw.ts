/**
 * Sorteio da Roleta de Bolas.
 *
 * REGRA DE OURO: o sorteio usa APENAS crypto.randomInt (CSPRNG do sistema).
 * Math.random() é PROIBIDO aqui e em todo o módulo de jogo.
 *
 * As probabilidades são guardadas em partes por 10.000 (10.000 = 100%) e a
 * configuração é validada antes de chegar aqui (soma exatamente 10.000).
 */
import { randomBytes, randomInt } from 'node:crypto';
import { BALLS, PROBABILITY_TOTAL, type Ball } from '@shared';

export type ProbabilityMap = Record<Ball, number>;

/**
 * Percorre as probabilidades cumulativas e devolve a bola sorteada.
 * Recebe o "roll" via parâmetro apenas para permitir testes determinísticos;
 * em produção o roll é sempre obtido com crypto.randomInt.
 */
export function drawBall(probabilities: ProbabilityMap, roll?: number): Ball {
  const value = roll ?? randomInt(0, PROBABILITY_TOTAL); // [0, 10000)
  let acc = 0;
  for (const ball of BALLS) {
    acc += probabilities[ball];
    if (value < acc) return ball;
  }
  // Só alcançável se a soma das probabilidades > 10.000 (config inválida,
  // rejeitada na validação). Defensivo: devolve a última bola da lista.
  return BALLS[BALLS.length - 1];
}

/** Identificador de auditoria registrado em cada Round (rngSeed). */
export function drawNonce(): string {
  // 8 bytes aleatórios do CSPRNG como referência de auditoria da rodada.
  return randomBytes(8).toString('hex');
}
