/**
 * Simulador da Roleta de Bolas.
 *
 * Usa EXATAMENTE o mesmo código de sorteio (drawBall com crypto.randomInt) e o
 * mesmo resolvedor de rodadas (resolveRound) do motor transacional, então o
 * RTP medido corresponde ao comportamento real do jogo.
 *
 *   npm run simulate -- --rounds 10000000
 */
import { BALLS, type Ball } from '@shared';
import { computeRTP } from './rtp.js';
import { resolveRound } from './round-resolver.js';
import type { ProbabilityMap } from './draw.js';

export interface SimulationInput {
  rounds: number;
  probabilities: ProbabilityMap;
  multipliers: Record<Ball, number>;
  tolerance?: number; // tolerância absoluta opcional (usada pelo script)
}

export interface SimulationResult {
  rounds: number;
  freeSpins: number;
  totalBet: number; // centésimos apostados (rodadas pagas)
  totalPaid: number; // centésimos pagos (inclui tentativas grátis)
  /** RTP medido = totalPaid / totalBet. */
  measuredRtp: number;
  /** RTP teórico via computeRTP(). */
  theoreticalRtp: number;
  houseEdgeMeasured: number;
  houseEdgeTheoretical: number;
  delta: number; // |measured - theoretical|
  withinTolerance: boolean;
  tolerance: number;
  /** Frequência de cada bola nas rodadas PAGAS (%). */
  ballFrequency: Record<Ball, number>;
  /** Maior sequência de perdas (rodadas pagas com pagamento 0). */
  longestLosingStreak: number;
  /** Desvio padrão do lucro líquido por rodada (em créditos da aposta unitária). */
  stddevPerRound: number;
  /** Retorno médio por rodada (lucro líquido médio, fração da aposta). */
  avgNetReturn: number;
  durationMs: number;
}

/** Simula N rodadas completas (paga + eventual tentativa grátis). */
export function simulate(input: SimulationInput): SimulationResult {
  const startedAt = Date.now();
  const { rounds, probabilities, multipliers } = input;
  const tolerance = input.tolerance ?? 0;

  let totalBet = 0;
  let totalPaid = 0;
  let freeSpins = 0;
  let losingStreak = 0;
  let longestLosingStreak = 0;
  let sumNet = 0;
  let sumNetSq = 0;

  const ballCounts: Record<Ball, number> = {
    branca: 0,
    bronze: 0,
    prata: 0,
    dourada: 0,
    preta: 0,
  };

  for (let i = 0; i < rounds; i += 1) {
    const bet = 100; // aposta unitária (1 crédito) — escala linear, RTP não muda
    const result = resolveRound(bet, probabilities, multipliers);

    ballCounts[result.ball] += 1;
    totalBet += bet;

    const paid = result.payout + (result.freeSpin?.payout ?? 0);
    totalPaid += paid;

    if (result.freeSpin) freeSpins += 1;

    if (paid === 0) {
      losingStreak += 1;
      if (losingStreak > longestLosingStreak) longestLosingStreak = losingStreak;
    } else {
      losingStreak = 0;
    }

    const net = paid - bet; // lucro líquido da rodada
    sumNet += net;
    sumNetSq += net * net;
  }

  const theoretical = computeRTP({ probabilities, multipliers });
  const measuredRtp = rounds > 0 ? totalPaid / totalBet : 0;
  const avgNetReturn = rounds > 0 ? sumNet / rounds / 100 : 0; // fração da aposta
  const variance = rounds > 0 ? Math.max(0, sumNetSq / rounds - (sumNet / rounds) ** 2) : 0;

  const ballFrequency = {} as Record<Ball, number>;
  for (const ball of BALLS) {
    ballFrequency[ball] = rounds > 0 ? (ballCounts[ball] / rounds) * 100 : 0;
  }

  return {
    rounds,
    freeSpins,
    totalBet,
    totalPaid,
    measuredRtp,
    theoreticalRtp: theoretical.rtp,
    houseEdgeMeasured: 1 - measuredRtp,
    houseEdgeTheoretical: theoretical.houseEdge,
    delta: Math.abs(measuredRtp - theoretical.rtp),
    withinTolerance: Math.abs(measuredRtp - theoretical.rtp) <= tolerance,
    tolerance,
    ballFrequency,
    longestLosingStreak,
    stddevPerRound: Math.sqrt(variance) / 100, // em fração da aposta
    avgNetReturn,
    durationMs: Date.now() - startedAt,
  };
}

/** Relatório legível do resultado da simulação. */
export function formatSimulationReport(result: SimulationResult): string {
  const pct = (v: number) => `${(v * 100).toFixed(4)}%`;
  const lines = [
    '================================================================',
    ' SIMULAÇÃO - ROLETA DE BOLAS (DEMO - créditos fictícios)',
    '================================================================',
    ` Rodadas simuladas:      ${result.rounds.toLocaleString('pt-BR')}`,
    ` Duração:                ${(result.durationMs / 1000).toFixed(2)}s`,
    ` Tentativas grátis:      ${result.freeSpins.toLocaleString('pt-BR')}`,
    ` Total apostado:         ${result.totalBet.toLocaleString('pt-BR')} centésimos`,
    ` Total pago:             ${result.totalPaid.toLocaleString('pt-BR')} centésimos`,
    '----------------------------------------------------------------',
    ` RTP teórico:            ${pct(result.theoreticalRtp)}`,
    ` RTP medido:             ${pct(result.measuredRtp)}`,
    ` Diferença (|Δ|):        ${pct(result.delta)}  (tolerância: ${pct(result.tolerance)})`,
    ` Dentro da tolerância:   ${result.withinTolerance ? 'SIM' : 'NÃO'}`,
    '----------------------------------------------------------------',
    ` Banca teórica:          ${pct(result.houseEdgeTheoretical)}`,
    ` Banca medida:           ${pct(result.houseEdgeMeasured)}`,
    ` Retorno líquido médio:  ${pct(result.avgNetReturn)} por rodada`,
    ` Desvio padrão/rodada:   ${pct(result.stddevPerRound)}`,
    ` Maior sequência de perdas: ${result.longestLosingStreak}`,
    '----------------------------------------------------------------',
    ' Frequência das bolas (rodadas pagas):',
    ...BALLS.map(
      (ball) => `   ${ball.padEnd(8)} ${result.ballFrequency[ball].toFixed(4)}%`,
    ),
    '================================================================',
  ];
  return lines.join('\n');
}
