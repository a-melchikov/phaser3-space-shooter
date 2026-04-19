import type { FastifyReply, FastifyRequest } from "fastify";

import { AppError } from "../../utils/errors.js";

import type { PlayersService } from "./players.service.js";

export class PlayersController {
  public constructor(private readonly playersService: PlayersService) {}

  public getCurrentPlayer = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new AppError(401, "unauthorized", "Authenticated player is required.");
    }

    const profile = await this.playersService.getCurrentPlayerProfile(request.user.playerId);

    await reply.send({
      player: {
        id: profile.id,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl
      },
      bestScore: profile.bestScore,
      bestWave: profile.bestWave,
      bestScoreAt: profile.bestScoreAt ? profile.bestScoreAt.toISOString() : null,
      rank: profile.rank
    });
  };
}
