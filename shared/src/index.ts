/** Tipos e constantes compartilhados entre client e server. */

// Re-exports explícitos (sem `export *`) para compatibilidade com o
// carregamento nativo de TypeScript do Node/tsx.
export {
  BALLS,
  BALL_LABEL,
  BALL_HEX,
  PROBABILITY_TOTAL,
  DEFAULT_PROBABILITIES,
  DEFAULT_MULTIPLIERS,
  FREE_SPIN_BALL,
  CENTS_PER_CREDIT,
  INITIAL_CREDITS,
  DEFAULT_MIN_BET,
  DEFAULT_MAX_BET,
  BALL_RESULT,
  DEFAULT_RTP_TOLERANCE,
} from './constants.ts';
export type { Ball } from './constants.ts';

export type {
  Role,
  UserDTO,
  RoundStepDTO,
  SpinResponseDTO,
  RouletteConfigDTO,
  HistoryResponseDTO,
  LobbyGameDTO,
  RTPPreviewDTO,
  GameConfigVersionDTO,
  AdminStatsDTO,
  AdminUserDTO,
} from './types.ts';
