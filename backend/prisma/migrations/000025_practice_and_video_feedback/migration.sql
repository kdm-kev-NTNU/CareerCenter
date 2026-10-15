-- AlterTable
ALTER TABLE "InterviewSession" ADD COLUMN "practice" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "InterviewVideoRun" ADD COLUMN "prompt" TEXT NOT NULL DEFAULT '';
ALTER TABLE "InterviewVideoRun" ADD COLUMN "feedbackJson" TEXT;
