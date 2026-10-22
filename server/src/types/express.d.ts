/** Augmenta os tipos do Express com o usuário autenticado. */
import type { Role } from '@shared';

export interface AuthUser {
  id: number;
  email: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

export {};
