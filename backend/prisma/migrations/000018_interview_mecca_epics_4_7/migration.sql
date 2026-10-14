-- Interview Mecca epics 4-7

CREATE TABLE "InterviewStoryBankEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "situation" TEXT NOT NULL DEFAULT '',
    "task" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL DEFAULT '',
    "result" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewStoryBankEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InterviewStoryScore" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "scoresJson" TEXT NOT NULL,
    "sum" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewStoryScore_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InterviewCaseRepertoireLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseEntryId" TEXT,
    "title" TEXT NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "practicedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewCaseRepertoireLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InterviewAbilityTestAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewAbilityTestAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InterviewVideoSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "thinkSeconds" INTEGER NOT NULL DEFAULT 30,
    "answerSeconds" INTEGER NOT NULL DEFAULT 90,
    "promptsJson" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewVideoSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InterviewVideoRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "settingsJson" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'done',
    "cardIndex" INTEGER,
    "blobKey" TEXT,
    "transcript" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewVideoRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InterviewVideoSettings_userId_key" ON "InterviewVideoSettings"("userId");

CREATE INDEX "InterviewStoryBankEntry_userId_updatedAt_idx" ON "InterviewStoryBankEntry"("userId", "updatedAt");

CREATE INDEX "InterviewStoryScore_storyId_createdAt_idx" ON "InterviewStoryScore"("storyId", "createdAt");

CREATE INDEX "InterviewCaseRepertoireLog_userId_practicedAt_idx" ON "InterviewCaseRepertoireLog"("userId", "practicedAt");

CREATE INDEX "InterviewAbilityTestAttempt_userId_createdAt_idx" ON "InterviewAbilityTestAttempt"("userId", "createdAt");

CREATE INDEX "InterviewVideoRun_userId_createdAt_idx" ON "InterviewVideoRun"("userId", "createdAt");

ALTER TABLE "InterviewStoryBankEntry" ADD CONSTRAINT "InterviewStoryBankEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InterviewStoryScore" ADD CONSTRAINT "InterviewStoryScore_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "InterviewStoryBankEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InterviewCaseRepertoireLog" ADD CONSTRAINT "InterviewCaseRepertoireLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InterviewAbilityTestAttempt" ADD CONSTRAINT "InterviewAbilityTestAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InterviewVideoSettings" ADD CONSTRAINT "InterviewVideoSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InterviewVideoRun" ADD CONSTRAINT "InterviewVideoRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
