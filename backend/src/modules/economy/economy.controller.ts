import type { FastifyReply, FastifyRequest } from "fastify";

import { AppError, isAppError } from "../../utils/errors.js";
import { validateWithSchema } from "../../utils/validation.js";
import type { AuditService } from "../audit/audit.service.js";

import type { EconomyService } from "./economy.service.js";
import {
  economyPurchaseSchema,
  economyRunFinishSchema,
  economyRunStartSchema
} from "./economy.types.js";

export class EconomyController {
  public constructor(
    private readonly economyService: EconomyService,
    private readonly auditService: AuditService
  ) {}

  public getMe = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new AppError(401, "unauthorized", "Authenticated player is required.");
    }

    const profile = await this.economyService.getProfile(request.user);
    await reply.send(profile);
  };

  public purchase = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new AppError(401, "unauthorized", "Authenticated player is required.");
    }

    const payload = validateWithSchema(economyPurchaseSchema, request.body);
    const result = await this.economyService.purchaseUpgrade(request.user, payload);

    await this.auditService.tryRecordFromRequest(request, {
      eventType: "upgrade_purchased",
      category: "economy",
      actorType: "authenticated",
      playerId: request.user.playerId,
      firebaseUid: request.user.firebaseUid,
      source: "backend",
      status: "success",
      metadata: {
        upgradeKey: result.upgradeKey,
        level: result.level,
        spent: result.spent,
        balance: result.currency.shardsBalance
      }
    });

    await reply.send(result);
  };

  public startRun = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new AppError(401, "unauthorized", "Authenticated player is required.");
    }

    const payload = validateWithSchema(economyRunStartSchema, request.body ?? {});
    const result = await this.economyService.startRun(request.user, payload);

    await this.auditService.tryRecordFromRequest(request, {
      eventType: "economy_run_started",
      category: "economy",
      actorType: "authenticated",
      playerId: request.user.playerId,
      firebaseUid: request.user.firebaseUid,
      source: "backend",
      status: "success",
      metadata: {
        runId: result.runId,
        clientBuildVersion: payload.clientBuildVersion
      }
    });

    await reply.code(201).send(result);
  };

  public finishRun = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new AppError(401, "unauthorized", "Authenticated player is required.");
    }

    const payload = validateWithSchema(economyRunFinishSchema, request.body);

    try {
      const result = await this.economyService.finishRun(request.user, payload);

      await this.auditService.tryRecordFromRequest(request, {
        eventType: "economy_run_finished",
        category: "economy",
        actorType: "authenticated",
        playerId: request.user.playerId,
        firebaseUid: request.user.firebaseUid,
        source: "backend",
        status: result.status === "duplicate" ? "info" : "success",
        metadata: {
          runId: result.runId,
          score: payload.score,
          wave: payload.wave,
          status: result.status,
          totalReward: result.totalReward,
          capped: result.capped,
          suspicious: result.suspicious
        }
      });

      if (result.suspicious) {
        await this.auditService.tryRecordFromRequest(request, {
          eventType: "suspicious_economy_submission",
          category: "security",
          actorType: "authenticated",
          playerId: request.user.playerId,
          firebaseUid: request.user.firebaseUid,
          source: "backend",
          status: result.capped ? "success" : "rejected",
          metadata: {
            runId: result.runId,
            reasons: result.suspiciousReasons,
            capped: result.capped,
            totalReward: result.totalReward
          }
        });
      }

      if (result.status === "awarded" && result.totalReward > 0) {
        await this.auditService.tryRecordFromRequest(request, {
          eventType: "shards_awarded",
          category: "economy",
          actorType: "authenticated",
          playerId: request.user.playerId,
          firebaseUid: request.user.firebaseUid,
          source: "backend",
          status: "success",
          metadata: {
            runId: result.runId,
            amount: result.totalReward,
            balance: result.balance
          }
        });
      }

      await reply.code(result.status === "duplicate" ? 200 : 201).send(result);
    } catch (error) {
      if (isAppError(error) && error.code === "economy_submission_rejected") {
        await this.auditService.tryRecordFromRequest(request, {
          eventType: "economy_submission_rejected",
          category: "security",
          actorType: "authenticated",
          playerId: request.user.playerId,
          firebaseUid: request.user.firebaseUid,
          source: "backend",
          status: "rejected",
          metadata: {
            runId: payload.runId,
            score: payload.score,
            wave: payload.wave,
            details: error.details
          }
        });
      }

      throw error;
    }
  };
}
