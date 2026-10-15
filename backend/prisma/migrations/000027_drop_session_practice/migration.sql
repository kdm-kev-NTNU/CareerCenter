-- Sessions are always scored. The unscored test-session flag is gone.
ALTER TABLE "InterviewSession" DROP COLUMN "practice";
