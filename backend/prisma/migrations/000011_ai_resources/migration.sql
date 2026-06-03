CREATE TABLE "AiResource" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "targetTools" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" TEXT NOT NULL DEFAULT 'draft',
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "installPath" TEXT NOT NULL DEFAULT '',
  "content" TEXT NOT NULL DEFAULT '',
  "frontmatter" JSONB,
  "configFormat" TEXT NOT NULL DEFAULT 'markdown',
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiResource_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiResource_userId_kind_idx" ON "AiResource"("userId", "kind");
CREATE INDEX "AiResource_userId_status_idx" ON "AiResource"("userId", "status");

ALTER TABLE "AiResource"
  ADD CONSTRAINT "AiResource_userId_fkey"
  FOREIGN KEY ("userId")
  REFERENCES "User"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
