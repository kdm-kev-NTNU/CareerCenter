-- AlterTable: who asks the question, soft discard and cleanup bookkeeping
ALTER TABLE "InterviewBankQuestion" ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'candidate';
ALTER TABLE "InterviewBankQuestion" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "InterviewBankQuestion" ADD COLUMN "discardReason" TEXT;
ALTER TABLE "InterviewBankQuestion" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'rule';
ALTER TABLE "InterviewBankQuestion" ADD COLUMN "sourceText" TEXT;
ALTER TABLE "InterviewBankQuestion" ADD COLUMN "cleanedAt" TIMESTAMP(3);

-- Backfill: LLM-extracted rows carry the "llm" tag; every row keeps its text as source identity.
UPDATE "InterviewBankQuestion" SET "origin" = 'llm' WHERE 'llm' = ANY("tags");
UPDATE "InterviewBankQuestion" SET "sourceText" = "text" WHERE "sourceText" IS NULL;

-- CreateIndex
CREATE INDEX "InterviewBankQuestion_userId_audience_status_idx" ON "InterviewBankQuestion"("userId", "audience", "status");
CREATE INDEX "InterviewBankQuestion_knowledgeDocId_cleanedAt_idx" ON "InterviewBankQuestion"("knowledgeDocId", "cleanedAt");

-- AlterTable: questions the candidate asks the interviewer, stored with the plan
ALTER TABLE "InterviewPrepQuestion" ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'candidate';

-- AlterTable: NULL essentials means "use the shared default for the mode"
ALTER TABLE "InterviewSimulatorSettings" ALTER COLUMN "essentialsSheet" DROP NOT NULL;
ALTER TABLE "InterviewSimulatorSettings" ALTER COLUMN "essentialsSheet" DROP DEFAULT;
UPDATE "InterviewSimulatorSettings" SET "essentialsSheet" = NULL WHERE btrim("essentialsSheet") = '';
