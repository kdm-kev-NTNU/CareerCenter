-- AlterTable
ALTER TABLE "InterviewKnowledgeDoc" ADD COLUMN "sourceFilename" TEXT,
ADD COLUMN "contentHash" TEXT NOT NULL DEFAULT '';

-- Backfill hash for existing rows
UPDATE "InterviewKnowledgeDoc" SET "contentHash" = md5("id" || "content") WHERE "contentHash" = '';

-- CreateTable
CREATE TABLE "InterviewCaseEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "knowledgeDocId" TEXT,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL DEFAULT '',
    "interviewerInfo" TEXT NOT NULL DEFAULT '',
    "solution" TEXT NOT NULL DEFAULT '',
    "sourceKind" TEXT NOT NULL,
    "caseStyle" TEXT,
    "companyTags" TEXT[],
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewCaseEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewPrepPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "roleTitle" TEXT NOT NULL DEFAULT '',
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "researchNotes" TEXT NOT NULL DEFAULT '',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewPrepPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewPrepClarification" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InterviewPrepClarification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewPrepQuestion" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InterviewPrepQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewPrepTask" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "done" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "InterviewPrepTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewSimulatorSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "companyName" TEXT NOT NULL DEFAULT '',
    "tone" TEXT NOT NULL DEFAULT 'profesjonell',
    "language" TEXT NOT NULL DEFAULT 'nb',
    "essentialsSheet" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewSimulatorSettings_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "InterviewSession" ADD COLUMN "prepPlanId" TEXT,
ADD COLUMN "feedbackJson" TEXT,
ADD COLUMN "finishedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "InterviewKnowledgeDoc_userId_contentHash_key" ON "InterviewKnowledgeDoc"("userId", "contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewCaseEntry_userId_contentHash_key" ON "InterviewCaseEntry"("userId", "contentHash");

-- CreateIndex
CREATE INDEX "InterviewCaseEntry_userId_idx" ON "InterviewCaseEntry"("userId");

-- CreateIndex
CREATE INDEX "InterviewPrepPlan_userId_status_idx" ON "InterviewPrepPlan"("userId", "status");

-- CreateIndex
CREATE INDEX "InterviewPrepClarification_planId_sortOrder_idx" ON "InterviewPrepClarification"("planId", "sortOrder");

-- CreateIndex
CREATE INDEX "InterviewPrepQuestion_planId_sortOrder_idx" ON "InterviewPrepQuestion"("planId", "sortOrder");

-- CreateIndex
CREATE INDEX "InterviewPrepTask_planId_sortOrder_idx" ON "InterviewPrepTask"("planId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewSimulatorSettings_userId_mode_key" ON "InterviewSimulatorSettings"("userId", "mode");

-- AddForeignKey
ALTER TABLE "InterviewCaseEntry" ADD CONSTRAINT "InterviewCaseEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewCaseEntry" ADD CONSTRAINT "InterviewCaseEntry_knowledgeDocId_fkey" FOREIGN KEY ("knowledgeDocId") REFERENCES "InterviewKnowledgeDoc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewPrepPlan" ADD CONSTRAINT "InterviewPrepPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewPrepClarification" ADD CONSTRAINT "InterviewPrepClarification_planId_fkey" FOREIGN KEY ("planId") REFERENCES "InterviewPrepPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewPrepQuestion" ADD CONSTRAINT "InterviewPrepQuestion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "InterviewPrepPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewPrepTask" ADD CONSTRAINT "InterviewPrepTask_planId_fkey" FOREIGN KEY ("planId") REFERENCES "InterviewPrepPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSimulatorSettings" ADD CONSTRAINT "InterviewSimulatorSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_prepPlanId_fkey" FOREIGN KEY ("prepPlanId") REFERENCES "InterviewPrepPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
