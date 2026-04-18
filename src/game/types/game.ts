import type { AuthMode } from "../../auth/types";
import type {
  BossDefinition,
  BossId,
  CombatCaps,
  EnemyArchetypeId,
  EnemyDefinition,
  EnemyRole,
  EnemyVariant,
  PlannedEnemySpawn,
  PowerUpType,
  ProgressionStage,
  SpawnBatch,
  TelegraphSpec,
  WaveKind,
  WavePlan,
  WaveThemeId
} from "./combat";
import type { SavedRunState } from "./runState";

export type EnemyType = EnemyArchetypeId;
export type {
  BossDefinition,
  BossId,
  CombatCaps,
  EnemyArchetypeId,
  EnemyDefinition,
  EnemyRole,
  EnemyVariant,
  PlannedEnemySpawn,
  PowerUpType,
  ProgressionStage,
  SpawnBatch,
  TelegraphSpec,
  WaveKind,
  WavePlan,
  WaveThemeId
};

export interface HighscoreEntry {
  score: number;
  wave: number;
  date: string;
}

export interface PracticeScoreEntry extends HighscoreEntry {
  playerLabel: string;
  mode: AuthMode;
  rankedEligible: boolean;
}

export interface SessionPresentation {
  mode: AuthMode;
  displayName: string;
  rankedEligible: boolean;
  isGuest: boolean;
}

export interface GameStartPayload {
  source?: "menu" | "gameover" | "resume";
  session: SessionPresentation;
  savedRun?: SavedRunState;
}

export interface GameOverPayload {
  score: number;
  wave: number;
  session: SessionPresentation;
}

export interface CompletedRunResult {
  score: number;
  wave: number;
  completedAt: string;
}

export interface RankedScorePayload extends CompletedRunResult {
  playerLabel: string;
}

export interface RankedScoreSubmissionOutcome {
  status: "queued" | "submitted" | "skipped" | "unavailable" | "failed";
  message: string;
}

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  avatarUrl: string | null;
  bestScore: number;
  bestWave: number;
  bestScoreAt: string;
}

export interface LeaderboardResponse {
  items: LeaderboardEntry[];
  limit: number;
  offset: number;
  total: number;
}

export interface LeaderboardTopResponse {
  items: LeaderboardEntry[];
  limit: number;
}

export interface AroundMeLeaderboardResponse {
  playerRank: number | null;
  items: LeaderboardEntry[];
}

export interface PlayerLeaderboardProfile {
  player: {
    id: string;
    firebaseUid: string;
    email: string | null;
    displayName: string;
    avatarUrl: string | null;
  };
  bestScore: number | null;
  bestWave: number | null;
  bestScoreAt: string | null;
  rank: number | null;
}

export interface RankedSubmitResponse {
  accepted: true;
  improvedBest: boolean;
  bestScore: number;
  bestWave: number;
  bestScoreAt: string;
  rank: number | null;
}

export interface ActivePowerUpState {
  type: PowerUpType;
  label: string;
  remainingMs: number;
}

export interface WaveManagerCallbacks {
  onWaveChanged: (plan: WavePlan) => void;
  onTransitionStateChange: (active: boolean) => void;
  onBanner: (text: string) => void;
  spawnBatch: (plan: WavePlan, batch: SpawnBatch) => SpawnBatch | null;
  spawnBoss: (plan: WavePlan) => void;
  hasActiveEnemies: () => boolean;
  hasActiveEnemyProjectiles: () => boolean;
  hasActiveHazards: () => boolean;
  isBossAlive: () => boolean;
}
