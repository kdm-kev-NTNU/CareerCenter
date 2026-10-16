-- AlterTable
ALTER TABLE "InterviewVideoSettings" ADD COLUMN "questionCount" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "InterviewVideoSettings" DROP COLUMN "promptsJson";

-- AlterTable
ALTER TABLE "InterviewVideoRun" ADD COLUMN "companyName" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "InterviewVideoRun" ADD COLUMN "roleDescription" TEXT NOT NULL DEFAULT '';
