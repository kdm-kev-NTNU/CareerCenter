-- AlterTable: example answers and tips for practice
ALTER TABLE "InterviewPrepQuestion" ADD COLUMN "exampleAnswer" TEXT NOT NULL DEFAULT '';
ALTER TABLE "InterviewPrepQuestion" ADD COLUMN "tips" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable: drop company report artefact
ALTER TABLE "InterviewPrepPlan" DROP COLUMN IF EXISTS "companyReportJson";

-- Data: map legacy company_report pipeline step to clarifications
UPDATE "InterviewPrepPlan" SET "pipelineStep" = 'clarifications' WHERE "pipelineStep" = 'company_report';
