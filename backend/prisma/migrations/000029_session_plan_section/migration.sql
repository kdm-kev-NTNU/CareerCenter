-- A simulator session can practise one section of a prep plan instead of the whole interview.
ALTER TABLE "InterviewSession" ADD COLUMN "planSection" TEXT;
