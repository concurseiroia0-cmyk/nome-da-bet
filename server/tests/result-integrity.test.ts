/**
 * OBRIGATÓRIO: o resultado exibido ao cliente É o resultado gravado no banco.
 * Também valida o encadeamento de saldos (balanceBefore/balanceAfter) e o
 * histórico paginado.
 */
import { describe, expect, it } from 'vitest';
import { BALLS } from '@shared';
import { prisma, registerPlayer, spin } from './helpers.js';

describe('integridade do resultado', () => {
  it('cada etapa da resposta corresponde exatamente ao Round gravado', async () => {
    const { agent } = await registerPlayer();

    for (let i = 0; i < 30; i += 1) {
      const res = await spin(agent, { bet: 100 });
      expect(res.status).toBe(200);

      for (const step of res.body.steps) {
        const row = await prisma.round.findUnique({ where: { id: step.roundId } });
        expect(row, `round ${step.roundId} não existe`).not.toBeNull();
        expect(row!.ball).toBe(step.ball);
        expect(row!.bet).toBe(step.bet);
        expect(row!.payout).toBe(step.payout);
        expect(row!.multiplier).toBe(step.multiplier);
        expect(row!.isFreeSpin).toBe(step.isFreeSpin);
        expect(row!.parentRoundId).toBe(step.parentRoundId);
        expect(row!.balanceBefore).toBe(step.balanceBefore);
        expect(row!.balanceAfter).toBe(step.balanceAfter);
        expect(BALLS).toContain(row!.ball);
        expect(row!.rngSeed).toBeTruthy(); // referência de auditoria do sorteio
        expect(row!.configVersion).toBeGreaterThan(0);
      }

      // A cadeia de saldos é consistente e o final bate com o usuário.
      const steps = res.body.steps;
      expect(steps[0].balanceBefore).toBeGreaterThanOrEqual(steps[0].bet); // aposta ainda não debitada
      for (let s = 1; s < steps.length; s += 1) {
        expect(steps[s].balanceBefore).toBe(steps[s - 1].balanceAfter);
      }
      const last = steps[steps.length - 1];
      expect(last.balanceAfter).toBe(res.body.balance);

      const me = await agent.get('/api/auth/me');
      expect(me.body.balance).toBe(res.body.balance);
    }
  });

  it('a última bola sorteada aparece no histórico recente do usuário', async () => {
    const { agent } = await registerPlayer();
    const res = await spin(agent, { bet: 100 });
    const lastRoundId = res.body.steps[res.body.steps.length - 1].roundId;

    const recent = await agent.get('/api/history/recent?limit=10');
    expect(recent.status).toBe(200);
    expect(recent.body.items.length).toBeGreaterThan(0);
    expect(recent.body.items[0].roundId).toBe(lastRoundId); // mais recente primeiro
    expect(recent.body.items[0].ball).toBe(res.body.steps[0].ball);
  });

  it('histórico paginado devolve apenas rodadas do próprio usuário', async () => {
    const playerA = await registerPlayer('hist-a');
    const playerB = await registerPlayer('hist-b');

    for (let i = 0; i < 5; i += 1) {
      await spin(playerA.agent, { bet: 100 });
      await spin(playerB.agent, { bet: 100 });
    }

    const meA = await playerA.agent.get('/api/auth/me');
    const page1 = await playerA.agent.get('/api/history?page=1&pageSize=3');
    expect(page1.status).toBe(200);
    expect(page1.body.items).toHaveLength(3);
    expect(page1.body.total).toBeGreaterThanOrEqual(5);
    expect(page1.body.page).toBe(1);

    const page2 = await playerA.agent.get('/api/history?page=2&pageSize=3');
    const expectedPage2 = Math.max(0, Math.min(3, page1.body.total - 3));
    expect(page2.body.items).toHaveLength(expectedPage2);

    const pageIds = new Set(page1.body.items.map((i: any) => i.roundId));
    for (const item of page2.body.items) expect(pageIds.has(item.roundId)).toBe(false);

    // Nenhuma rodada de outro usuário aparece.
    const rounds = await prisma.round.findMany({ where: { userId: meA.body.id } });
    expect(page1.body.total).toBe(rounds.length);
  });
});
