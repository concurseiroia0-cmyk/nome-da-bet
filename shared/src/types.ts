/** Tipos compartilhados entre client e server. */

import type { Ball } from './constants.ts';

export type Role = 'admin' | 'player';

export interface UserDTO {
  id: number;
  email: string;
  role: Role;
  /** Saldo em centésimos de crédito (inteiro). */
  balance: number;
  createdAt: string;
}

/** Uma etapa de uma rodada (paga ou tentativa grátis). */
export interface RoundStepDTO {
  roundId: number;
  bet: number;
  ball: Ball;
  /** Multiplicador em centésimos (150 = 1.5x). */
  multiplier: number;
  /** Pagamento total da rodada em centésimos (já inclui a aposta quando vence). */
  payout: number;
  isFreeSpin: boolean;
  parentRoundId: number | null;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
}

/** Resposta do POST /api/roulette/spin. O cliente apenas exibe, nunca calcula. */
export interface SpinResponseDTO {
  /** Saldo atual do usuário em centésimos (após todas as etapas). */
  balance: number;
  /** Etapas: sempre 1; 2 quando a bola branca/bronze... quando sai bronze, com a tentativa grátis. */
  steps: RoundStepDTO[];
  /** true quando a resposta veio de uma idempotencyKey repetida (não cobrou de novo). */
  replayed: boolean;
}

export interface RouletteConfigDTO {
  minBet: number;
  maxBet: number;
  /** Probabilidades em partes por 10.000 (soma 10.000). */
  probabilities: Record<Ball, number>;
  /** Multiplicadores em centésimos. */
  multipliers: Record<Ball, number>;
  version: number;
  /** RTP teórico (fração, ex.: 0.693). */
  rtp: number;
  /** Banca / house edge (fração, ex.: 0.307). */
  houseEdge: number;
  updatedAt: string;
}

export interface HistoryResponseDTO {
  items: RoundStepDTO[];
  page: number;
  pageSize: number;
  total: number;
}

export interface LobbyGameDTO {
  id: string;
  name: string;
  description: string;
  status: 'available' | 'coming-soon';
}

export interface RTPPreviewDTO {
  valid: boolean;
  errors: string[];
  /** E = p_prata*m_prata + p_dourada*m_dourada + p_preta*m_preta */
  expectedReturn: number | null;
  rtp: number | null;
  houseEdge: number | null;
}

export interface GameConfigVersionDTO {
  id: number;
  version: number;
  probabilities: Record<Ball, number>;
  multipliers: Record<Ball, number>;
  minBet: number;
  maxBet: number;
  updatedAt: string;
  updatedByEmail: string | null;
}

export interface AdminStatsDTO {
  totalBet: number;
  totalPaid: number;
  realRtp: number;
  houseProfit: number;
  roundCount: number;
  freeSpinCount: number;
  ballDistribution: Record<Ball, number>;
}

export interface AdminUserDTO {
  id: number;
  email: string;
  role: Role;
  balance: number;
  createdAt: string;
  roundCount: number;
}
