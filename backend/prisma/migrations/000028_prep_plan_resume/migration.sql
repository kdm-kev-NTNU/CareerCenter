-- Persist research search snippet and curation fill count so failed plans can resume.
ALTER TABLE "InterviewPrepPlan" ADD COLUMN "searchSnippet" TEXT NOT NULL DEFAULT '';
ALTER TABLE "InterviewPrepPlan" ADD COLUMN "curationFilledCount" INTEGER NOT NULL DEFAULT 0;
