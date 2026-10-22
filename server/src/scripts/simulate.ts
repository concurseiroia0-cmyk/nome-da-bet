/**
 * Simulação de milhões de rodadas da Roleta de Bolas.
 *
 *   npm run simulate -- --rounds 10000000
 *
 * Usa o MESMO código de sorteio do jogo (crypto.randomInt) e compara o RTP
 * medido com o RTP teórico (computeRTP). Sai com código 1 se a diferença
 * ultrapassar a tolerância configurada (RTP_TOLERANCE).
 */
import {
  DEFAULT_MAX_BET,
  DEFAULT_MIN_BET,
  DEFAULT_MULTIPLIERS,
  DEFAULT_PROBABILITIES,
  type Ball,
} from '@shared';
import { prisma } from '../db/prisma.js';
import { config } from '../config/index.js';
import { formatSimulationReport, simulate } from '../games/ball-roulette/index.js';

function parseRounds(argv: string[]): number {
  const flagIndex = argv.indexOf('--rounds');
  if (flagIndex === -1) return config.simulationDefaultRounds;
  const raw = argv[flagIndex + 1];
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    console.error(`[simulate] --rounds inválido: "${raw}". Use um inteiro positivo.`);
    process.exit(2);
  }
  return value;
}

async function main() {
  const rounds = parseRounds(process.argv.slice(2));

  // Usa a configuração global vigente do banco (ou os padrões, se ainda não houver).
  const cfg = await prisma.gameConfig.findFirst({ orderBy: { version: 'desc' } });
  const probabilities = (cfg?.probabilities ?? DEFAULT_PROBABILITIES) as Record<Ball, number>;
  const multipliers = (cfg?.multipliers ?? DEFAULT_MULTIPLIERS) as Record<Ball, number>;
  const minBet = cfg?.minBet ?? DEFAULT_MIN_BET;
  const maxBet = cfg?.maxBet ?? DEFAULT_MAX_BET;

  console.log(
    `[simulate] config v${cfg?.version ?? 1} | tolerância=${config.rtpTolerance} | ` +
      `minBet=${minBet} maxBet=${maxBet} (centésimos)`,
  );

  const result = simulate({
    rounds,
    probabilities,
    multipliers,
    tolerance: config.rtpTolerance,
  });

  console.log(formatSimulationReport(result));

  if (!result.withinTolerance) {
    console.error(
      `[simulate] FALHA: RTP medido (${(result.measuredRtp * 100).toFixed(4)}%) divergiu do teórico ` +
        `(${(result.theoreticalRtp * 100).toFixed(4)}%) além da tolerância ${config.rtpTolerance}.`,
    );
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error('[simulate] erro:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
