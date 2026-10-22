/** Tratamento de erros: 404, ZodError, ApiError e erros inesperados. */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import { audit } from '../audit.js';
import { ApiError } from '../errors.js';

/** Embute handlers async para que rejeições cheguem ao errorHandler (Express 4). */
export function ah<T extends Request = Request>(
  handler: (req: T, res: Response, next: NextFunction) => Promise<unknown> | unknown,
): RequestHandler {
  return (req, res, next) => {
    try {
      const result = handler(req as unknown as T, res, next);
      if (result instanceof Promise) result.catch(next);
    } catch (err) {
      next(err);
    }
  };
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: 'NOT_FOUND', message: `Rota não encontrada: ${req.method} ${req.path}` });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => `${issue.path.join('.') || '(corpo)'}: ${issue.message}`);
    res.status(400).json({ error: 'VALIDATION_ERROR', message: details.join('; '), details });
    return;
  }

  // Violação de unicidade (ex.: corrida de idempotencyKey/registro).
  if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') {
    res.status(409).json({ error: 'CONFLICT', message: 'Registro duplicado (corrida concorrente).' });
    return;
  }

  audit('server.error', {
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' });
}
