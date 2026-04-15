import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { PrismaClient } from "@prisma/client";

import type { AppEnv } from "../../config/env.js";
import { AppError } from "../../utils/errors.js";

import type { AuthenticatedPlayer } from "./auth.types.js";

export class FirebaseAuthService {
  private readonly adminAuth;

  public constructor(env: AppEnv) {
    const existingApp = getApps().find((app) => app.name === "starfall-aegis-backend");
    const app =
      existingApp ??
      initializeApp(
        {
          credential: cert({
            projectId: env.FIREBASE_PROJECT_ID,
            clientEmail: env.FIREBASE_CLIENT_EMAIL,
            privateKey: env.FIREBASE_PRIVATE_KEY
          })
        },
        "starfall-aegis-backend"
      );

    this.adminAuth = getAuth(app);
  }

  public async verifyAndSyncPlayer(prisma: PrismaClient, idToken: string): Promise<AuthenticatedPlayer> {
    try {
      const decodedToken = await this.adminAuth.verifyIdToken(idToken, true);
      const firebaseUid = decodedToken.uid;
      const email = typeof decodedToken.email === "string" ? decodedToken.email : null;
      const displayName =
        typeof decodedToken.name === "string" && decodedToken.name.trim().length > 0
          ? decodedToken.name.trim()
          : email ?? "Google player";
      const avatarUrl = typeof decodedToken.picture === "string" ? decodedToken.picture : null;

      const player = await prisma.player.upsert({
        where: {
          firebaseUid
        },
        create: {
          firebaseUid,
          email,
          displayName,
          avatarUrl
        },
        update: {
          email,
          displayName,
          avatarUrl
        }
      });

      return {
        playerId: player.id,
        firebaseUid,
        email: player.email,
        displayName: player.displayName,
        avatarUrl: player.avatarUrl
      };
    } catch (error) {
      throw new AppError(401, "unauthorized", "A valid Firebase ID token is required.", {
        reason: error instanceof Error ? error.message : "unknown"
      });
    }
  }
}
