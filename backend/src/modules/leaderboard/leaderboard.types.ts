import { z } from "zod";

export const submitScoreSchema = z.object({
  score: z.number().int().positive(),
  wave: z.number().int().min(1),
  economyRunId: z.string().uuid().optional()
});

export const leaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});

export const leaderboardTopQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(10)
});

export const leaderboardAroundMeQuerySchema = z.object({
  radius: z.coerce.number().int().min(1).max(10).default(3)
});

export type SubmitScoreInput = z.infer<typeof submitScoreSchema>;
export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;
export type LeaderboardTopQuery = z.infer<typeof leaderboardTopQuerySchema>;
export type LeaderboardAroundMeQuery = z.infer<typeof leaderboardAroundMeQuerySchema>;

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  displayName: string;
  avatarUrl: string | null;
  bestScore: number;
  bestWave: number;
  bestScoreAt: Date;
}

export interface LeaderboardPage {
  items: LeaderboardEntry[];
  limit: number;
  offset: number;
  total: number;
}

export interface AroundMeLeaderboard {
  playerRank: number | null;
  items: LeaderboardEntry[];
}

export interface SubmitScoreResult {
  accepted: true;
  improvedBest: boolean;
  bestScore: number;
  bestWave: number;
  bestScoreAt: Date;
  rank: number | null;
}
