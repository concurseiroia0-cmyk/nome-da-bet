/** Testes de autenticação, sessão por cookie httpOnly e papel admin. */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { INITIAL_CREDITS } from '@shared';
import { app, getBalance, http, prisma, registerAdmin, registerPlayer, uniqueEmail } from './helpers.js';

describe('autenticação', () => {
  it('registra usuário com 1.000 créditos fictícios e sessão em cookie httpOnly', async () => {
    const email = uniqueEmail('cookie');
    const res = await http.post('/api/auth/register').send({ email, password: 'senha-forte-123' });
    expect(res.status).toBe(201);
    expect(res.body.balance).toBe(INITIAL_CREDITS * 100); // centésimos

    const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined;
    const sessionCookie = (setCookie ?? []).find((c) => c.startsWith('bet_session='));
    expect(sessionCookie).toBeTruthy();
    expect(sessionCookie!.toLowerCase()).toContain('httponly');
    expect(sessionCookie!.toLowerCase()).toContain('samesite=lax');

    // A sessão funciona com o cookie enviado (agent persiste cookies).
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email, password: 'senha-forte-123' });
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(email);
  });

  it('rejeita e-mail duplicado', async () => {
    const email = uniqueEmail('dup');
    const first = await http.post('/api/auth/register').send({ email, password: 'senha-forte-123' });
    expect(first.status).toBe(201);
    const second = await http.post('/api/auth/register').send({ email, password: 'senha-forte-123' });
    expect(second.status).toBe(409);
    expect(second.body.error).toBe('EMAIL_TAKEN');
  });

  it('rejeita senha fraca no cadastro', async () => {
    const res = await http.post('/api/auth/register').send({ email: uniqueEmail(), password: '123' });
    expect(res.status).toBe(400);
  });

  it('faz login com senha correta e recusa senha errada', async () => {
    const { email, password } = await registerPlayer();
    const bad = await http.post('/api/auth/login').send({ email, password: 'senha-errada-999' });
    expect(bad.status).toBe(401);

    const ok = await http.post('/api/auth/login').send({ email, password });
    expect(ok.status).toBe(200);
    expect(ok.body.email).toBe(email);
  });

  it('guarda o hash da senha com bcrypt (nunca em texto puro)', async () => {
    const { email } = await registerPlayer();
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(user.passwordHash).not.toContain('senha');
  });

  it('exige sessão nas rotas privadas', async () => {
    expect((await http.get('/api/roulette/config')).status).toBe(401);
    expect((await http.get('/api/history')).status).toBe(401);
    expect((await http.post('/api/roulette/spin').send({ bet: 100, idempotencyKey: 'abcdefgh' })).status).toBe(401);
  });

  it('protege o painel admin: players recebem 403, admins 200', async () => {
    const player = await registerPlayer();
    const asPlayer = await player.agent.get('/api/admin/stats');
    expect(asPlayer.status).toBe(403);

    const admin = await registerAdmin();
    const asAdmin = await admin.agent.get('/api/admin/stats');
    expect(asAdmin.status).toBe(200);
  });

  it('logout limpa a sessão', async () => {
    const { agent } = await registerPlayer();
    await agent.post('/api/auth/logout');
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('recarga de teste devolve o saldo para 1.000 créditos', async () => {
    const { agent } = await registerPlayer();
    await agent.post('/api/test/recharge');
    expect(await getBalance(agent)).toBe(INITIAL_CREDITS * 100);
  });
});
