/**
 * Testes da página (spec 8.5):
 * - o botão GIRAR fica desabilitado durante toda a animação;
 * - o resultado exibido é exatamente o que a API retornou (o front nunca
 *   calcula resultado nem saldo).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DEFAULT_MULTIPLIERS, DEFAULT_PROBABILITIES } from '@shared';
import { AuthProvider } from '../auth.tsx';
import { RoulettePage } from './RoulettePage.tsx';

const USER = {
  id: 1,
  email: 'jogador@bet.demo',
  role: 'player' as const,
  balance: 100_000,
  createdAt: new Date().toISOString(),
};

const CONFIG = {
  minBet: 100,
  maxBet: 50_000,
  probabilities: DEFAULT_PROBABILITIES,
  multipliers: DEFAULT_MULTIPLIERS,
  version: 1,
  rtp: 0.693,
  houseEdge: 0.307,
  updatedAt: new Date().toISOString(),
};

/** Resposta do spin: dourada 2x, retorno 200 centésimos (= 2 créditos). */
const SPIN_RESPONSE = {
  balance: 100_100,
  replayed: false,
  steps: [
    {
      roundId: 1,
      bet: 100,
      ball: 'dourada',
      multiplier: 200,
      payout: 200,
      isFreeSpin: false,
      parentRoundId: null,
      balanceBefore: 100_000,
      balanceAfter: 100_100,
      createdAt: new Date().toISOString(),
    },
  ],
};

function stubFetch() {
  const json = (body: unknown, status = 200) =>
    ({ ok: status < 400, status, json: async () => body }) as unknown as Response;
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/auth/me')) return json(USER);
    if (url.includes('/api/roulette/config')) return json(CONFIG);
    if (url.includes('/api/roulette/spin')) return json(SPIN_RESPONSE);
    if (url.includes('/api/history/recent')) return json({ items: [] });
    if (url.includes('/api/history')) return json({ items: [], page: 1, pageSize: 20, total: 0 });
    return json({ error: 'NOT_FOUND' }, 404);
  });
}

beforeEach(() => {
  cleanup();
  vi.stubGlobal('fetch', stubFetch());
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('página da Roleta de Bolas', () => {
  it('GIRAR fica desabilitado durante o giro e o resultado exibido é o da API', async () => {
    render(
      <AuthProvider>
        <RoulettePage />
      </AuthProvider>,
    );

    const btn = (await screen.findByRole('button', { name: /GIRAR/ })) as HTMLButtonElement;
    // Habilita quando a config chega.
    await waitFor(() => expect(btn.disabled).toBe(false));

    // Modo reduzido acelera o teste (fade curto, sem rAF longo).
    fireEvent.click(screen.getByRole('button', { name: /Reduzir animações/ }));

    fireEvent.click(btn);
    // Durante toda a animação, o botão permanece desabilitado.
    expect(btn.disabled).toBe(true);

    // O que a API retornou (dourada, 2x, retorno 200 centésimos = +2,00
    // créditos) é exibido — nada calculado no front.
    // (asserção única: a revelação fica na tela durante uma janela curta)
    await waitFor(
      () => {
        expect(screen.getAllByText('2x').length).toBeGreaterThan(0);
        expect(screen.getByText(/\+2,00 créditos/)).toBeTruthy();
      },
      { timeout: 5000 },
    );

    // Reabilitado ao final (inclusive após a animação terminar).
    await waitFor(() => expect(btn.disabled).toBe(false), { timeout: 5000 });
  }, 15_000);
});
