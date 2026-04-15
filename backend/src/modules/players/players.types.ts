export interface CurrentPlayerProfile {
  id: string;
  firebaseUid: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  bestScore: number | null;
  bestWave: number | null;
  bestScoreAt: Date | null;
  rank: number | null;
}
