/**
 * Cálculo do RTP (Return To Player) teórico da Roleta de Bolas.
 *
 *   E     = p_prata*m_prata + p_dourada*m_dourada + p_preta*m_preta
 *   RTP   = E × (1 + p_bronze)      // bronze vale UMA rodada grátis, sem encadeamento
 *   Banca = 1 − RTP
 *
 * Exemplo com as probabilidades iniciais:
 *   E = 0.18*1.5 + 0.08*2 + 0.02*10 = 0.63
 *   RTP = 0.63 × 1.10 = 0.693 (69.3%)  →  banca = 30.7%
 */
import { PROBABILITY_TOTAL, type Ball } from '@shared';

export interface RTPConfigInput {
  probabilities: Record<Ball, number>; // partes por 10.000
  multipliers: Record<Ball, number>; // centésimos (150 = 1.5x)
}

export interface RTPResult {
  /** Retorno esperado de uma rodada paga (fração da aposta, sem o bônus do bronze). */
  expectedReturn: number;
  /** Fração devolvida pela banca no longo prazo (ex.: 0.693 = 69.3%). */
  rtp: number;
  /** Vantagem da banca (fração, ex.: 0.307 = 30.7%). */
  houseEdge: number;
}

export function computeRTP(config: RTPConfigInput): RTPResult {
  const p = (ball: Ball) => config.probabilities[ball] / PROBABILITY_TOTAL;
  const m = (ball: Ball) => config.multipliers[ball] / 100; // centésimos → multiplicador

  // Retorno esperado de uma rodada paga.
  const expectedReturn = p('prata') * m('prata') + p('dourada') * m('dourada') + p('preta') * m('preta');

  // Bronze: uma rodada grátis adicional, sem encadeamento (paga 0 na própria rodada).
  const rtp = expectedReturn * (1 + p('bronze'));

  return {
    expectedReturn,
    rtp,
    houseEdge: 1 - rtp,
  };
}
