/**
 * Cliente HTTP da API. O front-end NUNCA calcula saldo nem resultado:
 * apenas exibe o que a API retorna (regra 9 da especificação).
 */
import type {
  AdminStatsDTO,
  AdminUserDTO,
  GameConfigVersionDTO,
  HistoryResponseDTO,
  LobbyGameDTO,
  RouletteConfigDTO,
  RoundStepDTO,
  RTPPreviewDTO,
  SpinResponseDTO,
  UserDTO,
} from '@shared';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      ...init,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Não foi possível falar com o servidor.');
  }

  if (res.status === 204) return undefined as T;

  const body: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = body as { error?: string; message?: string };
    throw new ApiError(res.status, err.error ?? 'UNKNOWN', err.message ?? `Erro ${res.status}.`);
  }
  return body as T;
}

export const api = {
  // Auth
  register: (email: string, password: string) =>
    request<UserDTO>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    request<UserDTO>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
  me: () => request<UserDTO>('/auth/me'),

  // Roulette
  rouletteConfig: () => request<RouletteConfigDTO>('/roulette/config'),
  spin: (bet: number, idempotencyKey: string) =>
    request<SpinResponseDTO>('/roulette/spin', {
      method: 'POST',
      body: JSON.stringify({ bet, idempotencyKey }),
    }),

  // History
  history: (page: number, pageSize: number) =>
    request<HistoryResponseDTO>(`/history?page=${page}&pageSize=${pageSize}`),
  recentRounds: (limit = 10) => request<{ items: RoundStepDTO[] }>(`/history/recent?limit=${limit}`),

  // Lobby / teste
  lobby: () => request<{ games: LobbyGameDTO[] }>('/lobby'),
  recharge: () => request<UserDTO>('/test/recharge', { method: 'POST' }),

  // Admin
  adminConfig: () =>
    request<{
      current: { version: number; probabilities: RouletteConfigDTO['probabilities']; multipliers: RouletteConfigDTO['multipliers']; minBet: number; maxBet: number; updatedAt: string };
      rtp: { rtp: number; houseEdge: number; expectedReturn: number };
      versions: GameConfigVersionDTO[];
    }>('/admin/config'),
  adminPreview: (probabilities: RouletteConfigDTO['probabilities'], multipliers: RouletteConfigDTO['multipliers']) =>
    request<RTPPreviewDTO>('/admin/config/preview', {
      method: 'POST',
      body: JSON.stringify({ probabilities, multipliers }),
    }),
  adminSaveConfig: (payload: {
    probabilities: RouletteConfigDTO['probabilities'];
    multipliers: RouletteConfigDTO['multipliers'];
    minBet: number;
    maxBet: number;
  }) => request<{ current: GameConfigVersionDTO; preview: RTPPreviewDTO }>('/admin/config', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  adminStats: () => request<AdminStatsDTO>('/admin/stats'),
  adminUsers: () => request<{ users: AdminUserDTO[] }>('/admin/users'),
  adminResetUser: (id: number) =>
    request<{ id: number; balance: number }>(`/admin/users/${id}/reset`, { method: 'POST' }),
};
