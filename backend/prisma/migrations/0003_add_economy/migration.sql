-- AlterTable
ALTER TABLE "ScoreEntry" ADD COLUMN "economyRunId" TEXT;

-- CreateTable
CREATE TABLE "PlayerEconomy" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "shardsBalance" INTEGER NOT NULL DEFAULT 0,
    "lifetimeShardsEarned" INTEGER NOT NULL DEFAULT 0,
    "lifetimeShardsSpent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerEconomy_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PlayerEconomy_non_negative_balance_check" CHECK ("shardsBalance" >= 0),
    CONSTRAINT "PlayerEconomy_non_negative_lifetime_check" CHECK ("lifetimeShardsEarned" >= 0 AND "lifetimeShardsSpent" >= 0)
);

-- CreateTable
CREATE TABLE "EconomyTransaction" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "runId" TEXT,
    "sourceId" TEXT,
    "upgradeKey" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EconomyTransaction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EconomyTransaction_non_zero_amount_check" CHECK ("amount" <> 0)
);

-- CreateTable
CREATE TABLE "PlayerUpgrade" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "upgradeKey" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerUpgrade_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PlayerUpgrade_non_negative_level_check" CHECK ("level" >= 0)
);

-- CreateTable
CREATE TABLE "EconomyRunSession" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'started',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "clientBuildVersion" TEXT,
    "upgradesSnapshot" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EconomyRunSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EconomyRunReward" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "wave" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "baseReward" INTEGER NOT NULL,
    "bonusReward" INTEGER NOT NULL,
    "totalReward" INTEGER NOT NULL,
    "finalizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "EconomyRunReward_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EconomyRunReward_non_negative_values_check" CHECK (
        "wave" >= 1
        AND "score" >= 0
        AND "baseReward" >= 0
        AND "bonusReward" >= 0
        AND "totalReward" >= 0
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerEconomy_playerId_key" ON "PlayerEconomy"("playerId");

-- CreateIndex
CREATE INDEX "economy_transaction_player_created_idx" ON "EconomyTransaction"("playerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "economy_transaction_run_idx" ON "EconomyTransaction"("runId");

-- CreateIndex
CREATE INDEX "economy_transaction_upgrade_idx" ON "EconomyTransaction"("upgradeKey");

-- CreateIndex
CREATE UNIQUE INDEX "player_upgrade_player_key_unique" ON "PlayerUpgrade"("playerId", "upgradeKey");

-- CreateIndex
CREATE INDEX "player_upgrade_player_idx" ON "PlayerUpgrade"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "EconomyRunSession_runId_key" ON "EconomyRunSession"("runId");

-- CreateIndex
CREATE INDEX "economy_run_player_started_idx" ON "EconomyRunSession"("playerId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "economy_run_status_started_idx" ON "EconomyRunSession"("status", "startedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "EconomyRunReward_runId_key" ON "EconomyRunReward"("runId");

-- CreateIndex
CREATE INDEX "economy_reward_player_finalized_idx" ON "EconomyRunReward"("playerId", "finalizedAt" DESC);

-- CreateIndex
CREATE INDEX "score_entry_economy_run_idx" ON "ScoreEntry"("economyRunId");

-- AddForeignKey
ALTER TABLE "ScoreEntry" ADD CONSTRAINT "ScoreEntry_economyRunId_fkey" FOREIGN KEY ("economyRunId") REFERENCES "EconomyRunSession"("runId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerEconomy" ADD CONSTRAINT "PlayerEconomy_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EconomyTransaction" ADD CONSTRAINT "EconomyTransaction_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerUpgrade" ADD CONSTRAINT "PlayerUpgrade_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EconomyRunSession" ADD CONSTRAINT "EconomyRunSession_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EconomyRunReward" ADD CONSTRAINT "EconomyRunReward_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EconomyRunReward" ADD CONSTRAINT "EconomyRunReward_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EconomyRunSession"("runId") ON DELETE CASCADE ON UPDATE CASCADE;
