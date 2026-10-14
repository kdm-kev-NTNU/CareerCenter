-- AlterTable
ALTER TABLE "InterviewPrepQuestion" ADD COLUMN "included" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "InterviewPrepQuestion" ADD COLUMN "notes" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "InterviewImportJob" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'cases';

-- CreateIndex
CREATE INDEX "InterviewImportJob_knowledgeDocId_kind_status_idx" ON "InterviewImportJob"("knowledgeDocId", "kind", "status");
