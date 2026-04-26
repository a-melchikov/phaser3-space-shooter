-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "playerId" TEXT,
    "firebaseUid" TEXT,
    "sessionId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "route" TEXT,
    "source" TEXT NOT NULL,
    "requestId" TEXT,
    "status" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_event_type_created_idx" ON "AuditEvent"("eventType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_category_created_idx" ON "AuditEvent"("category", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_player_created_idx" ON "AuditEvent"("playerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_firebase_uid_created_idx" ON "AuditEvent"("firebaseUid", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_session_created_idx" ON "AuditEvent"("sessionId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
