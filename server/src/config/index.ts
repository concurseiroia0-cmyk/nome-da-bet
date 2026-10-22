/**
 * Configuração central do servidor (DEMO - créditos fictícios, sem valor real).
 * Valores podem ser sobrescritos por variáveis de ambiente (.env).
 */
import 'dotenv/config';
import { DEFAULT_RTP_TOLERANCE } from '@shared';

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: num(process.env.PORT, 4000),

  /** Origens permitidas no CORS (separadas por vírgula). */
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-secret-troque-em-producao',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  cookieName: 'bet_session',

  /** Rate limit do POST /api/roulette/spin. */
  rateLimitWindowMs: num(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
  rateLimitMax: num(process.env.RATE_LIMIT_MAX, 120),

  /** Tolerância absoluta entre RTP teórico e RTP medido. */
  rtpTolerance: num(process.env.RTP_TOLERANCE, DEFAULT_RTP_TOLERANCE),

  /** Rodadas padrão da simulação (npm run simulate -- --rounds N). */
  simulationDefaultRounds: 1_000_000,

  /** Serve o build do client pelo próprio server (produção simples). */
  serveClient: process.env.SERVE_CLIENT === '1',
} as const;

export type AppConfig = typeof config;
