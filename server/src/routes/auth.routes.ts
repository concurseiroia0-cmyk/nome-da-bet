/** Rotas de autenticação: registro, login, logout e sessão atual. */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import {
  authenticate,
  clearSessionCookie,
  registerUser,
  setSessionCookie,
  signSessionToken,
  toUserDTO,
} from '../services/authService.js';
import { audit } from '../audit.js';
import { prisma } from '../db/prisma.js';
import { unauthorized } from '../errors.js';
import { ah } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().min(5).max(254).email('E-mail inválido.'),
  password: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres.').max(128),
});

// POST /api/auth/register - cria conta com 1.000 créditos fictícios
router.post(
  '/register',
  ah(async (req, res) => {
    const { email, password } = credentialsSchema.parse(req.body);
    const user = await registerUser(email, password);
    setSessionCookie(res, signSessionToken(user));
    audit('auth.register', { userId: user.id, email: user.email });
    res.status(201).json(toUserDTO(user));
  }),
);

// POST /api/auth/login
router.post(
  '/login',
  ah(async (req, res) => {
    const { email, password } = credentialsSchema.parse(req.body);
    const user = await authenticate(email, password);
    setSessionCookie(res, signSessionToken(user));
    audit('auth.login', { userId: user.id, email: user.email });
    res.json(toUserDTO(user));
  }),
);

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

// GET /api/auth/me
router.get(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.auth!.id } });
    if (!user) throw unauthorized();
    res.json(toUserDTO(user));
  }),
);

// POST /api/auth/change-password (bônus simples para a demo)
router.post(
  '/change-password',
  requireAuth,
  ah(async (req, res) => {
    const body = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(128) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.auth!.id } });
    if (!user) throw unauthorized();
    const ok = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!ok) {
      res.status(400).json({ error: 'INVALID_PASSWORD', message: 'Senha atual incorreta.' });
      return;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(body.newPassword, 10) },
    });
    audit('auth.change_password', { userId: user.id });
    res.json({ ok: true });
  }),
);

export default router;
