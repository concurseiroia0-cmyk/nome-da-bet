import { describe, expect, it } from 'vitest';
import { formatCredits, formatMultiplier, formatPercent, formatRtp, newIdempotencyKey } from './utils.ts';

describe('helpers de exibição', () => {
  it('formata centésimos de crédito no padrão pt-BR', () => {
    expect(formatCredits(100_000)).toBe('1.000,00');
    expect(formatCredits(0)).toBe('0,00');
    expect(formatCredits(150)).toBe('1,50');
  });

  it('formata multiplicador, percentual e RTP', () => {
    expect(formatMultiplier(150)).toBe('1,5x');
    expect(formatMultiplier(1000)).toBe('10x');
    expect(formatPercent(6200)).toBe('62%');
    expect(formatRtp(0.693)).toBe('69,30%');
  });

  it('gera idempotencyKey no formato aceito pela API', () => {
    const key = newIdempotencyKey();
    expect(key).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    expect(newIdempotencyKey()).not.toBe(key);
  });
});
