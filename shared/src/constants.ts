/**
 * Constantes compartilhadas entre client e server.
 *
 * TODOS os valores monetários são inteiros em CENTÉSIMOS de crédito
 * (1 crédito = 100 centésimos). Isso evita erros de ponto flutuante.
 *
 * Probabilidades são guardadas em PARTES POR 10.000 (10.000 = 100%).
 * Multiplicadores são guardados em CENTÉSIMOS do multiplicador
 * (150 = 1.5x, 200 = 2x, 1000 = 10x).
 */

export const BALLS = ['branca', 'bronze', 'prata', 'dourada', 'preta'] as const;
export type Ball = (typeof BALLS)[number];

export const BALL_LABEL: Record<Ball, string> = {
  branca: 'Branca',
  bronze: 'Bronze',
  prata: 'Prata',
  dourada: 'Dourada',
  preta: 'Preta',
};

/** Cor de referência de cada bola (tema escuro + dourado + vermelho). */
export const BALL_HEX: Record<Ball, string> = {
  branca: '#F5F5F5',
  bronze: '#CD7F32',
  prata: '#C0C0C0',
  dourada: '#FFD700',
  preta: '#111111',
};

/** Soma das probabilidades deve ser exatamente 100%. */
export const PROBABILITY_TOTAL = 10_000;

/** Probabilidades iniciais de demonstração (partes por 10.000). */
export const DEFAULT_PROBABILITIES: Record<Ball, number> = {
  branca: 6200, // 62%
  bronze: 1000, // 10%
  prata: 1800, // 18%
  dourada: 800, // 8%
  preta: 200, // 2%
};

/** Multiplicadores iniciais (centésimos do multiplicador; retorno TOTAL da rodada). */
export const DEFAULT_MULTIPLIERS: Record<Ball, number> = {
  branca: 0, // 0x - perde a aposta
  bronze: 0, // vale 1 tentativa grátis (não paga nada na própria rodada)
  prata: 150, // 1.5x
  dourada: 200, // 2x
  preta: 1000, // 10x
};

/** Bolas que encadeiam tentativa grátis. */
export const FREE_SPIN_BALL: Ball = 'bronze';

/** Centésimos por crédito exibido na interface. */
export const CENTS_PER_CREDIT = 100;

/** Créditos fictícios iniciais / de recarga de teste. */
export const INITIAL_CREDITS = 1000;

/** Aposta mínima e máxima padrão (centésimos). */
export const DEFAULT_MIN_BET = 100; // 1 crédito
export const DEFAULT_MAX_BET = 50_000; // 500 créditos

/** Resultados possíveis das bolas no pagamento. */
export const BALL_RESULT = {
  /** Perde a aposta (pagamento 0). */
  LOSS: 'loss',
  /** Paga o multiplicador normalmente. */
  WIN: 'win',
  /** Não debita e gera tentativa grátis. */
  FREE_SPIN: 'free_spin',
} as const;

/** Tolerância padrão (absoluta) entre RTP teórico e RTP medido na simulação. */
export const DEFAULT_RTP_TOLERANCE = 0.01;
