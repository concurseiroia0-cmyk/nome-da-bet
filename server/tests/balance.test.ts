/**
 * OBRIGATÓRIO: o saldo nunca fica negativo e aposta maior que o saldo é
 * rejeitada (inclusive apostas iguais a todo o saldo, limite mínimo/máximo
 * e valores inválidos).
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_MAX_BET, DEFAULT_MIN_BET } from '@shared';
import { getBalance, prisma, registerPlayer, spin, type Agent } from './helpers.js';

async function setBalance(agent: Agent, cents: number): Promise<void> {
  const me = await agent.get('/api/auth/me');
  await prisma.user.update({ where: { id: me.body.id }, data: { balance: cents } });
}

async function userIdOf(agent: Agent): Promise<number> {
  const me = await agent.get('/api/auth/me');
  return me.body.id as number;
}

describe('integridade de saldo', () => {
  it('aposta maior que o saldo é rejeitada e não altera o saldo', async () => {
    const agent = (await registerPlayer()).agent;
    await setBalance(agent, 500); // 5 créditos

    const res = await spin(agent, { bet: 501 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INSUFFICIENT_BALANCE');
    expect(await getBalance(agent)).toBe(500);
  });

  it('aposta igual a todo o saldo é aceita e zera a conta (nunca negativo)', async () => {
    const agent = (await registerPlayer()).agent;
    await setBalance(agent, 500);

    const res = await spin(agent, { bet: 500 });
    expect(res.status).toBe(200);
    const balance = await getBalance(agent);
    expect(balance).toBeGreaterThanOrEqual(0);
    // 500 debitados + prêmio de todas as etapas (>= 0); nunca negativo.
    const paidOut = res.body.steps.reduce((acc: number, s: any) => acc + s.payout, 0);
    expect(balance).toBe(500 - 500 + paidOut);

    // Próxima aposta: saldo agora insuficiente (nunca fica negativo).
    const next = await spin(agent, { bet: 100 });
    expect(next.status).toBe(400);
    expect(next.body.error).toBe('INSUFFICIENT_BALANCE');
    expect(await getBalance(agent)).toBe(balance);
  });

  it('rejeita apostas fora dos limites configuráveis (mín/máx)', async () => {
    const agent = (await registerPlayer()).agent;
    const cfg = (await agent.get('/api/roulette/config')).body;

    const belowMin = await spin(agent, { bet: cfg.minBet - 1 });
    expect(belowMin.status).toBe(400);
    expect(belowMin.body.error).toBe('BET_OUT_OF_RANGE');

    const aboveMax = await spin(agent, { bet: cfg.maxBet + 1 });
    expect(aboveMax.status).toBe(400);
    expect(aboveMax.body.error).toBe('BET_OUT_OF_RANGE');

    // Limites padrão da demo são respeitados.
    expect(cfg.minBet).toBe(DEFAULT_MIN_BET);
    expect(cfg.maxBet).toBe(DEFAULT_MAX_BET);
  });

  it('rejeita apostas inválidas (zero, negativa, fracionária ou não numérica)', async () => {
    const agent = (await registerPlayer()).agent;
    for (const bet of [0, -100, 10.5, '100', null]) {
      const res = await spin(agent, { bet: bet as number });
      expect(res.status, `bet=${String(bet)}`).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    }
    expect(await getBalance(agent)).toBe(1000 * 100);
  });

  it('em uma sequência longa o saldo jamais fica negativo', async () => {
    const agent = (await registerPlayer()).agent;
    const id = await userIdOf(agent);
    await setBalance(agent, 1000); // saldo baixo para forçar rejeições

    for (let i = 0; i < 60; i += 1) {
      const bet = i % 7 === 0 ? 1500 : 200; // algumas apostas acima do saldo
      const res = await spin(agent, { bet });
      const user = await prisma.user.findUniqueOrThrow({ where: { id } });
      expect(user.balance).toBeGreaterThanOrEqual(0);
      if (res.status === 200) {
        expect(res.body.balance).toBe(user.balance);
      }
    }
  });
});
