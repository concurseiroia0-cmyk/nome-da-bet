/** Utilidades de exibição. O front nunca calcula saldo/resultado da API. */
import { CENTS_PER_CREDIT } from '@shared';

/** Centésimos de crédito -> texto "1.234,50". */
export function formatCredits(cents: number): string {
  return (cents / CENTS_PER_CREDIT).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Multiplicador em centésimos -> "1.5x". */
export function formatMultiplier(multiplierHundredths: number): string {
  const value = multiplierHundredths / 100;
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}x`;
}

/** Partes por 10.000 -> "62%". */
export function formatPercent(parts: number): string {
  return `${(parts / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

/** Fração RTP (0.693) -> "69,30%". */
export function formatRtp(fraction: number): string {
  return `${(fraction * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

/** Gera uma idempotencyKey aleatória no formato aceito pela API. */
export function newIdempotencyKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
