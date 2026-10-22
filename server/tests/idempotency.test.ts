/**
 * OBRIGATÓRIO: a mesma idempotencyKey processa UMA única vez e requisições
 * simultâneas com a mesma chave não geram cobrança duplicada.
 */
import { describe, expect, it } from 'vitest';
import { getBalance, idempotencyKey, prisma, registerPlayer, spin } from './helpers.js';

describe('idempotência do /spin', () => {
  it('a mesma idempotencyKey debita apenas uma vez (replay devolve o mesmo resultado)', async () => {
    const { agent } = await registerPlayer();
    const key = idempotencyKey('replay');
    const bet = 100;

    const balanceBefore = await getBalance(agent);
    const first = await spin(agent, { bet, key });
    expect(first.status).toBe(200);
    expect(first.body.replayed).toBe(false);

    const balanceAfterFirst = await getBalance(agent);
    const debit = balanceBefore - balanceAfterFirst;

    // Repetições com a MESMA chave: não podem cobrar de novo.
    const second = await spin(agent, { bet, key });
    expect(second.status).toBe(200);
    expect(second.body.replayed).toBe(true);
    expect(second.body.steps.map((s: any) => s.roundId)).toEqual(
      first.body.steps.map((s: any) => s.roundId),
    );
    expect(await getBalance(agent)).toBe(balanceAfterFirst);

    const third = await spin(agent, { bet, key });
    expect(third.body.replayed).toBe(true);
    expect(await getBalance(agent)).toBe(balanceAfterFirst);
    void debit;

    // Apenas UMA rodada paga existe para essa chave.
    const paidRounds = await prisma.round.findMany({ where: { idempotencyKey: key } });
    expect(paidRounds).toHaveLength(1);
    const children = await prisma.round.count({ where: { parentRoundId: paidRounds[0].id } });
    expect(children).toBeLessThanOrEqual(1); // no máximo UMA tentativa grátis
    const totalRounds = await prisma.round.count({
      where: {
        OR: [{ idempotencyKey: key }, { parentRoundId: paidRounds[0].id }],
      },
    });
    expect(totalRounds).toBe(1 + children); // paga + no máximo 1 grátis
  });

  it('requisições SIMULTÂNEAS com a mesma chave não geram cobrança duplicada', async () => {
    const { agent } = await registerPlayer();
    const key = idempotencyKey('concurrent');
    const bet = 100;

    const balanceBefore = await getBalance(agent);

    // 6 giros simultâneos com a MESMA chave.
    const responses = await Promise.all(
      Array.from({ length: 6 }, () => spin(agent, { bet, key })),
    );

    for (const res of responses) expect(res.status).toBe(200);
    const processed = responses.filter((r) => r.body.replayed === false);
    expect(processed).toHaveLength(1); // exatamente UM processamento real

    // Toda a cadeia de rounds da chave existe uma única vez.
    const parent = await prisma.round.findUnique({ where: { idempotencyKey: key } });
    expect(parent).not.toBeNull();
    const children = await prisma.round.count({ where: { parentRoundId: parent!.id } });
    expect(children).toBe(processed[0].body.steps.length - 1);

    // Débito único: o saldo caiu exatamente 1 aposta (menos o prêmio pago).
    const balanceAfter = await getBalance(agent);
    const expected =
      balanceBefore - bet + processed[0].body.steps.reduce((acc: number, s: any) => acc + s.payout, 0);
    expect(balanceAfter).toBe(expected);
    expect(balanceAfter).toBeGreaterThanOrEqual(0);
  });

  it('chaves diferentes processam rodadas independentes', async () => {
    const { agent } = await registerPlayer();
    const balanceBefore = await getBalance(agent);
    const a = await spin(agent, { bet: 100, key: idempotencyKey('indep-a') });
    const b = await spin(agent, { bet: 100, key: idempotencyKey('indep-b') });
    expect(a.body.replayed).toBe(false);
    expect(b.body.replayed).toBe(false);
    expect(a.body.steps[0].roundId).not.toBe(b.body.steps[0].roundId);

    const count = await prisma.round.count({
      where: { id: { in: [a.body.steps[0].roundId, b.body.steps[0].roundId] } },
    });
    expect(count).toBe(2);
    const paidA = a.body.steps.reduce((acc: number, s: any) => acc + s.payout, 0);
    const paidB = b.body.steps.reduce((acc: number, s: any) => acc + s.payout, 0);
    expect(await getBalance(agent)).toBe(balanceBefore - 200 + paidA + paidB);
  });
});
