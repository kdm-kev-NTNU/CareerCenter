ALTER TABLE "AiResource"
  ADD COLUMN "folderPath" TEXT NOT NULL DEFAULT 'Inbox',
  ADD COLUMN "isStarred" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "usageCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastUsedAt" TIMESTAMP(3),
  ADD COLUMN "sourcePath" TEXT;

CREATE INDEX "AiResource_userId_folderPath_idx" ON "AiResource"("userId", "folderPath");
CREATE INDEX "AiResource_userId_isStarred_idx" ON "AiResource"("userId", "isStarred");

