/** Erro de API com status HTTP e código estável para o cliente. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (code: string, message: string) => new ApiError(400, code, message);
export const unauthorized = (message = 'Sessão inválida ou expirada.') =>
  new ApiError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Acesso negado.') => new ApiError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Não encontrado.') => new ApiError(404, 'NOT_FOUND', message);
export const conflict = (code: string, message: string) => new ApiError(409, code, message);
export const tooManyRequests = (message = 'Muitas tentativas. Aguarde um instante.') =>
  new ApiError(429, 'RATE_LIMITED', message);
