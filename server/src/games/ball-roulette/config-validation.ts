/**
 * Validação e normalização da configuração da Roleta de Bolas.
 *
 * REGRA: as probabilidades são guardadas em partes por 10.000 e a soma DEVE
 * ser exatamente 10.000 (100%). Qualquer outra configuração é rejeitada.
 */
import { BALLS, PROBABILITY_TOTAL, type Ball, type RTPPreviewDTO } from '@shared';
import { computeRTP } from './rtp.js';

export interface GameConfigInput {
  probabilities: Record<Ball, number>;
  multipliers: Record<Ball, number>;
  minBet: number;
  maxBet: number;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** Valida o mapa de probabilidades (soma exatamente 10.000). */
export function validateProbabilities(probabilities: unknown): string[] {
  const errors: string[] = [];
  if (typeof probabilities !== 'object' || probabilities === null) {
    return ['probabilities: deve ser um objeto com as 5 bolas'];
  }
  const map = probabilities as Record<string, unknown>;

  for (const ball of BALLS) {
    const value = map[ball];
    if (!isPositiveInteger(value)) {
      errors.push(`probabilities.${ball}: deve ser um inteiro >= 0 (partes por 10.000)`);
    }
  }
  for (const key of Object.keys(map)) {
    if (!BALLS.includes(key as Ball)) {
      errors.push(`probabilities: bola desconhecida "${key}"`);
    }
  }
  if (errors.length > 0) return errors;

  const sum = BALLS.reduce((acc, ball) => acc + (map[ball] as number), 0);
  if (sum !== PROBABILITY_TOTAL) {
    errors.push(
      `probabilities: a soma deve ser exatamente ${PROBABILITY_TOTAL} (100%), recebido ${sum}`,
    );
  }
  return errors;
}

/**
 * Valida os multiplicadores (centésimos).
 * Branca e Bronze são fixas pelas regras do jogo (0x e tentativa grátis),
 * por isso devem ser 0 e não são editáveis no painel admin.
 */
export function validateMultipliers(multipliers: unknown): string[] {
  const errors: string[] = [];
  if (typeof multipliers !== 'object' || multipliers === null) {
    return ['multipliers: deve ser um objeto com as 5 bolas'];
  }
  const map = multipliers as Record<string, unknown>;

  for (const ball of BALLS) {
    const value = map[ball];
    if (!isPositiveInteger(value)) {
      errors.push(`multipliers.${ball}: deve ser um inteiro >= 0 (centésimos do multiplicador)`);
    }
  }
  for (const key of Object.keys(map)) {
    if (!BALLS.includes(key as Ball)) {
      errors.push(`multipliers: bola desconhecida "${key}"`);
    }
  }
  if (errors.length > 0) return errors;

  if ((map.branca as number) !== 0) {
    errors.push('multipliers.branca: fixa em 0 (branca sempre perde a aposta)');
  }
  if ((map.bronze as number) !== 0) {
    errors.push('multipliers.bronze: fixa em 0 (bronze paga com a tentativa grátis, não na própria rodada)');
  }
  return errors;
}

export function validateBetLimits(minBet: unknown, maxBet: unknown): string[] {
  const errors: string[] = [];
  if (!isPositiveInteger(minBet) || minBet <= 0) {
    errors.push('minBet: deve ser um inteiro > 0 (centésimos)');
  }
  if (!isPositiveInteger(maxBet) || maxBet <= 0) {
    errors.push('maxBet: deve ser um inteiro > 0 (centésimos)');
  }
  if (errors.length === 0 && (minBet as number) > (maxBet as number)) {
    errors.push('minBet: deve ser menor ou igual a maxBet');
  }
  return errors;
}

/** Valida a configuração completa; devolve a lista de erros (vazia = válida). */
export function validateGameConfig(input: Partial<GameConfigInput>): string[] {
  return [
    ...validateProbabilities(input.probabilities),
    ...validateMultipliers(input.multipliers),
    ...validateBetLimits(input.minBet, input.maxBet),
  ];
}

/** Prévia de RTP/banca para o painel admin (antes de confirmar o salvamento). */
export function toRTPPreview(probabilities: unknown, multipliers: unknown): RTPPreviewDTO {
  const errors = [...validateProbabilities(probabilities), ...validateMultipliers(multipliers)];
  if (errors.length > 0) {
    return { valid: false, errors, expectedReturn: null, rtp: null, houseEdge: null };
  }
  const rtp = computeRTP({
    probabilities: probabilities as Record<Ball, number>,
    multipliers: multipliers as Record<Ball, number>,
  });
  return { valid: true, errors: [], ...rtp };
}
