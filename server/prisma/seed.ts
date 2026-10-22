/**
 * Seed do banco de dados (DEMO - créditos fictícios, sem valor real).
 *
 * Cria:
 *  - usuário admin:   admin@bet.demo / admin1234
 *  - usuário teste:   jogador@bet.demo / jogador1234
 *  - GameConfig v1 com as probabilidades/multiplicadores iniciais
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  DEFAULT_MAX_BET,
  DEFAULT_MIN_BET,
  DEFAULT_MULTIPLIERS,
  DEFAULT_PROBABILITIES,
  INITIAL_CREDITS,
} from '@shared';

const prisma = new PrismaClient();

const INITIAL_CREDITS_CENTS = INITIAL_CREDITS * 100; // centésimos

async function main() {
  const adminHash = await bcrypt.hash('admin1234', 10);
  const playerHash = await bcrypt.hash('jogador1234', 10);

  await prisma.user.upsert({
    where: { email: 'admin@bet.demo' },
    update: {},
    create: {
      email: 'admin@bet.demo',
      passwordHash: adminHash,
      role: 'admin',
      balance: INITIAL_CREDITS_CENTS,
    },
  });

  await prisma.user.upsert({
    where: { email: 'jogador@bet.demo' },
    update: {},
    create: {
      email: 'jogador@bet.demo',
      passwordHash: playerHash,
      role: 'player',
      balance: INITIAL_CREDITS_CENTS,
    },
  });

  const configCount = await prisma.gameConfig.count();
  if (configCount === 0) {
    await prisma.gameConfig.create({
      data: {
        version: 1,
        probabilities: DEFAULT_PROBABILITIES,
        multipliers: DEFAULT_MULTIPLIERS,
        minBet: DEFAULT_MIN_BET,
        maxBet: DEFAULT_MAX_BET,
      },
    });
    console.log('[seed] GameConfig v1 criada');
  }

  console.log('[seed] Usuários criados:');
  console.log('  admin:   admin@bet.demo / admin1234');
  console.log('  jogador: jogador@bet.demo / jogador1234');
}

main()
  .catch((err) => {
    console.error('[seed] erro:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
