import type { PrismaClient } from "@prisma/client";

import { AppError } from "../../utils/errors.js";
import { LeaderboardService } from "../leaderboard/leaderboard.service.js";

import { PlayersRepository } from "./players.repository.js";
import type { CurrentPlayerProfile } from "./players.types.js";

export class PlayersService {
  private readonly playersRepository: PlayersRepository;
  private readonly leaderboardService: LeaderboardService;

  public constructor(prisma: PrismaClient) {
    this.playersRepository = new PlayersRepository(prisma);
    this.leaderboardService = new LeaderboardService(prisma);
  }

  public async getCurrentPlayerProfile(playerId: string): Promise<CurrentPlayerProfile> {
    const player = await this.playersRepository.getPlayerById(playerId);

    if (!player) {
      throw new AppError(404, "player_not_found", "Player profile was not found.");
    }

    const rank = await this.leaderboardService.getPlayerRank(playerId);

    return {
      id: player.id,
      firebaseUid: player.firebaseUid,
      email: player.email,
      displayName: player.displayName,
      avatarUrl: player.avatarUrl,
      bestScore: player.bestScore,
      bestWave: player.bestWave,
      bestScoreAt: player.bestScoreAt,
      rank
    };
  }
}
