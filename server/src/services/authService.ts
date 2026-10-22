/** Serviço de autenticação: registro/login com bcrypt e sessão JWT em cookie httpOnly. */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import { INITIAL_CREDITS, type Role, type UserDTO } from '@shared';
import { config } from '../config/index.js';
import { prisma } from '../db/prisma.js';
import { badRequest, conflict, unauthorized } from '../errors.js';

export const INITIAL_CREDITS_CENTS = INITIAL_CREDITS * 100; // centésimos

export interface UserRecord {
  id: number;
  email: string;
  passwordHash: string;
  role: string;
  balance: number;
  createdAt: Date;
}

export function toUserDTO(user: UserRecord): UserDTO {
  return {
    id: user.id,
    email: user.email,
    role: user.role as Role,
    balance: user.balance,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function registerUser(email: string, password: string): Promise<UserRecord> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw conflict('EMAIL_TAKEN', 'Este e-mail já está cadastrado.');

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    return await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'player',
        // Cadastro recebe 1.000 créditos fictícios (sem valor real).
        balance: INITIAL_CREDITS_CENTS,
      },
    });
  } catch (err: unknown) {
    // Corrida com outro registro do mesmo e-mail.
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
      throw conflict('EMAIL_TAKEN', 'Este e-mail já está cadastrado.');
    }
    throw err;
  }
}

export async function authenticate(email: string, password: string): Promise<UserRecord> {
  const user = await prisma.user.findUnique({ where: { email } });
  // Mensagem genérica para não revelar quais e-mails existem.
  const genericError = unauthorized('E-mail ou senha inválidos.');
  if (!user) throw genericError;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw genericError;
  return user;
}

interface TokenPayload {
  sub: number;
  email: string;
  role: Role;
}

export function signSessionToken(user: UserRecord): string {
  const payload: TokenPayload = { sub: user.id, email: user.email, role: user.role as Role };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] });
}

export function verifySessionToken(token: string): TokenPayload {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as unknown as TokenPayload;
    if (typeof payload.sub !== 'number') throw new Error('payload inválido');
    return payload;
  } catch {
    throw unauthorized();
  }
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(config.cookieName, token, {
    httpOnly: true, // inacessível pelo JavaScript do cliente
    sameSite: 'lax',
    secure: config.env === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(config.cookieName, { httpOnly: true, sameSite: 'lax', path: '/' });
}

export function parseBetRange(value: unknown, message: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw badRequest('INVALID_BET', message);
  }
  return value;
}
