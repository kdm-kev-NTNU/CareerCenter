-- Candidate background (CV + transcript + notes) for company-report answer suggestions.
CREATE TABLE "CandidateBackground" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cvText" TEXT NOT NULL DEFAULT '',
    "cvFileName" TEXT NOT NULL DEFAULT '',
    "cvUpdatedAt" TIMESTAMP(3),
    "transcriptText" TEXT NOT NULL DEFAULT '',
    "transcriptFileName" TEXT NOT NULL DEFAULT '',
    "transcriptUpdatedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateBackground_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CandidateBackground_userId_key" ON "CandidateBackground"("userId");

ALTER TABLE "CandidateBackground" ADD CONSTRAINT "CandidateBackground_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prep plans no longer store recommended cases or practice tasks.
DROP TABLE IF EXISTS "InterviewPrepPlanCase";
DROP TABLE IF EXISTS "InterviewPrepTask";
