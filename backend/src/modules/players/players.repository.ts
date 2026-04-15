import type { PrismaClient } from "@prisma/client";

export class PlayersRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public getPlayerById(playerId: string) {
    return this.prisma.player.findUnique({
      where: {
        id: playerId
      },
      select: {
        id: true,
        firebaseUid: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        bestScore: true,
        bestWave: true,
        bestScoreAt: true
      }
    });
  }
}
