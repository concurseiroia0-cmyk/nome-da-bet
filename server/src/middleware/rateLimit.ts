/**
 * Rate limiter simples em memória (janela fixa).
 * Usado no POST /api/roulette/spin para evitar rajadas de apostas.
 */
import type { NextFunction, Request, Response } from 'express';
import { tooManyRequests } from '../errors.js';

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  key?: (req: Request) => string;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const buckets = new Map<string, Bucket>();

  function sweep(now: number): void {
    if (buckets.size < 5000) return;
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }

  return function rateLimiter(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();
    const key = options.key ? options.key(req) : req.ip ?? 'unknown';
    sweep(now);

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    if (bucket.count > options.max) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)).toString());
      return next(tooManyRequests('Muitas rodadas em sequência. Aguarde alguns segundos.'));
    }
    next();
  };
}
