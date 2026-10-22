/** Middlewares de autenticação (cookie httpOnly com JWT) e autorização por papel. */
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config/index.js';
import { forbidden, unauthorized } from '../errors.js';
import { verifySessionToken } from '../services/authService.js';

/** Lê e valida a sessão; anexa req.auth quando válida. */
export function loadSession(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[config.cookieName];
  if (token) {
    try {
      const payload = verifySessionToken(token);
      req.auth = { id: payload.sub, email: payload.email, role: payload.role };
    } catch {
      // Token inválido/expirado: segue como anônimo; rotas exigentes usam requireAuth.
    }
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.auth) return next(unauthorized('Faça login para continuar.'));
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.auth) return next(unauthorized('Faça login para continuar.'));
  if (req.auth.role !== 'admin') return next(forbidden('Acesso restrito ao painel admin.'));
  next();
}
