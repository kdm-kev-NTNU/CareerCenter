-- AlterTable
ALTER TABLE "InterviewKnowledgeDoc" ADD COLUMN "originalFileKey" TEXT;

-- AlterTable
ALTER TABLE "InterviewCaseEntry" ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE "InterviewCaseEntry" ADD COLUMN "originalFileKey" TEXT;

-- AlterTable
ALTER TABLE "InterviewPrepPlan" ADD COLUMN "companyProfileJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "InterviewPrepPlan" ADD COLUMN "clarificationRound" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "InterviewPrepClarification" ADD COLUMN "round" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "InterviewPrepQuestion" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'generated';
ALTER TABLE "InterviewPrepQuestion" ADD COLUMN "bankQuestionId" TEXT;
ALTER TABLE "InterviewPrepQuestion" ADD COLUMN "storyId" TEXT;
ALTER TABLE "InterviewPrepQuestion" ADD COLUMN "gapReason" TEXT;

-- AlterTable
ALTER TABLE "InterviewSession" ADD COLUMN "caseEntryId" TEXT;

-- AlterTable
ALTER TABLE "InterviewCaseRepertoireLog" ADD COLUMN "company" TEXT NOT NULL DEFAULT '';
ALTER TABLE "InterviewCaseRepertoireLog" ADD COLUMN "format" TEXT NOT NULL DEFAULT '';
ALTER TABLE "InterviewCaseRepertoireLog" ADD COLUMN "tested" TEXT NOT NULL DEFAULT '';
ALTER TABLE "InterviewCaseRepertoireLog" ADD COLUMN "improvement" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "InterviewBankQuestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "knowledgeDocId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT[],
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewBankQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewPrepPlanCase" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "caseEntryId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InterviewPrepPlanCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewImportJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "knowledgeDocId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT NOT NULL DEFAULT '',
    "resultJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InterviewBankQuestion_userId_contentHash_key" ON "InterviewBankQuestion"("userId", "contentHash");
CREATE INDEX "InterviewBankQuestion_userId_category_idx" ON "InterviewBankQuestion"("userId", "category");
CREATE INDEX "InterviewBankQuestion_knowledgeDocId_idx" ON "InterviewBankQuestion"("knowledgeDocId");
CREATE UNIQUE INDEX "InterviewPrepPlanCase_planId_caseEntryId_key" ON "InterviewPrepPlanCase"("planId", "caseEntryId");
CREATE INDEX "InterviewPrepPlanCase_planId_sortOrder_idx" ON "InterviewPrepPlanCase"("planId", "sortOrder");
CREATE INDEX "InterviewImportJob_userId_status_idx" ON "InterviewImportJob"("userId", "status");
CREATE INDEX "InterviewImportJob_knowledgeDocId_idx" ON "InterviewImportJob"("knowledgeDocId");
CREATE INDEX "InterviewCaseEntry_userId_approvalStatus_idx" ON "InterviewCaseEntry"("userId", "approvalStatus");

-- AddForeignKey
ALTER TABLE "InterviewBankQuestion" ADD CONSTRAINT "InterviewBankQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InterviewBankQuestion" ADD CONSTRAINT "InterviewBankQuestion_knowledgeDocId_fkey" FOREIGN KEY ("knowledgeDocId") REFERENCES "InterviewKnowledgeDoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InterviewPrepQuestion" ADD CONSTRAINT "InterviewPrepQuestion_bankQuestionId_fkey" FOREIGN KEY ("bankQuestionId") REFERENCES "InterviewBankQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InterviewPrepPlanCase" ADD CONSTRAINT "InterviewPrepPlanCase_planId_fkey" FOREIGN KEY ("planId") REFERENCES "InterviewPrepPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InterviewPrepPlanCase" ADD CONSTRAINT "InterviewPrepPlanCase_caseEntryId_fkey" FOREIGN KEY ("caseEntryId") REFERENCES "InterviewCaseEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InterviewImportJob" ADD CONSTRAINT "InterviewImportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InterviewImportJob" ADD CONSTRAINT "InterviewImportJob_knowledgeDocId_fkey" FOREIGN KEY ("knowledgeDocId") REFERENCES "InterviewKnowledgeDoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_caseEntryId_fkey" FOREIGN KEY ("caseEntryId") REFERENCES "InterviewCaseEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
