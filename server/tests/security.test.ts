/** Testes de segurança: rate limit, CORS restrito e validação de entrada. */
import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '../src/middleware/rateLimit.js';
import { idempotencyKey, registerPlayer } from './helpers.js';

function fakeRes() {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader(k: string, v: string) {
      headers[k] = v;
    },
  } as any;
}

describe('rate limit do /spin', () => {
  it('bloqueia após exceder o máximo da janela', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3, key: () => 'user-1' });
    const req = { ip: '1.2.3.4' } as any;

    const results: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      let outcome = 'ok';
      limiter(req, fakeRes(), ((err?: any) => {
        outcome = err ? `blocked:${err.code}` : 'ok';
      }) as any);
      results.push(outcome);
    }
    expect(results.slice(0, 3)).toEqual(['ok', 'ok', 'ok']);
    expect(results.slice(3)).toEqual(['blocked:RATE_LIMITED', 'blocked:RATE_LIMITED']);
  });

  it('janelas diferentes têm contadores diferentes por chave', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1, key: (req) => String(req.auth?.id ?? req.ip) });
    const a = { auth: { id: 1 } } as any;
    const b = { auth: { id: 2 } } as any;
    let a2 = 'ok';
    limiter(a, fakeRes(), ((err?: any) => { if (err) a2 = err.code; }) as any);
    limiter(b, fakeRes(), ((err?: any) => { if (err) a2 = err.code; }) as any);
    expect(a2).toBe('ok'); // usuário 2 não é afetado pelo limite do 1
  });
});

describe('CORS restrito', () => {
  it('não libera origem desconhecida', async () => {
    const { http } = await import('./helpers.js');
    const res = await http.get('/api/health').set('Origin', 'https://evil.example');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('libera a origem do front-end configurada', async () => {
    const { http } = await import('./helpers.js');
    const res = await http.get('/api/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});

describe('validação de entrada do /spin', () => {
  it('rejeita idempotencyKey muito curta ou com caracteres inválidos', async () => {
    const { agent } = await registerPlayer();
    const short = await agent.post('/api/roulette/spin').send({ bet: 100, idempotencyKey: 'abc' });
    expect(short.status).toBe(400);

    const weird = await agent
      .post('/api/roulette/spin')
      .send({ bet: 100, idempotencyKey: 'chave com espaços e acentuação' });
    expect(weird.status).toBe(400);

    const ok = await agent.post('/api/roulette/spin').send({ bet: 100, idempotencyKey: idempotencyKey() });
    expect(ok.status).toBe(200);
  });

  it('rejeita corpo ausente ou não-JSON esperado', async () => {
    const { agent } = await registerPlayer();
    const res = await agent.post('/api/roulette/spin').send({}); // sem bet/key
    expect(res.status).toBe(400);
  });
});
