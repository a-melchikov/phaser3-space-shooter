export interface CurrentPlayerProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bestScore: number | null;
  bestWave: number | null;
  bestScoreAt: Date | null;
  rank: number | null;
}
