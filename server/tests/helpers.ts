/** Helpers compartilhados pelos testes de integração (supertest). */
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';

export const app = createApp();
/** Cliente supertest para requisições sem sessão. */
export const http = request(app);

let uniqueCounter = 0;
export function uniqueEmail(prefix = 'user'): string {
  uniqueCounter += 1;
  return `${prefix}-${Date.now()}-${uniqueCounter}@demo.test`;
}

/** Tipo real devolvido por `request.agent(app)` (supertest). */
export type Agent = ReturnType<typeof request.agent>;

export interface TestAgent {
  agent: Agent;
  email: string;
  password: string;
}

/** Registra um novo jogador e devolve um agent com o cookie de sessão. */
export async function registerPlayer(prefix = 'player'): Promise<TestAgent> {
  const agent = request.agent(app);
  const email = uniqueEmail(prefix);
  const password = 'senha-forte-123';
  const res = await agent.post('/api/auth/register').send({ email, password });
  if (res.status !== 201) {
    throw new Error(`register falhou: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { agent, email, password };
}

/** Cria um usuário admin diretamente no banco e devolve o agent logado. */
export async function registerAdmin(): Promise<TestAgent> {
  const { agent, email, password } = await registerPlayer('admin');
  await prisma.user.update({ where: { email }, data: { role: 'admin' } });
  // Reautentica para o JWT carregar o papel novo.
  await agent.post('/api/auth/logout');
  const login = await agent.post('/api/auth/login').send({ email, password });
  if (login.status !== 200) throw new Error(`login admin falhou: ${login.status}`);
  return { agent, email, password };
}

let keyCounter = 0;
export function idempotencyKey(prefix = 'test'): string {
  keyCounter += 1;
  return `${prefix}-${Date.now()}-${keyCounter}-${Math.floor(Math.random() * 1e6)}`;
}

/** Gira a roleta com valores padrão; devolve a resposta tipada. */
export async function spin(
  agent: Agent,
  options: { bet?: number; key?: string } = {},
): Promise<{ status: number; body: any }> {
  return agent.post('/api/roulette/spin').send({
    bet: options.bet === undefined ? 100 : options.bet,
    idempotencyKey: options.key ?? idempotencyKey(),
  });
}

export async function getBalance(agent: Agent): Promise<number> {
  const res = await agent.get('/api/auth/me');
  if (res.status !== 200) throw new Error(`me falhou: ${res.status}`);
  return res.body.balance as number;
}

export { prisma };
