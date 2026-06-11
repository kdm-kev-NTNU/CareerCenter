-- CreateTable
CREATE TABLE "ThesisCompany" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "topicArea" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'other',
    "location" TEXT NOT NULL DEFAULT '',
    "contactPerson" TEXT NOT NULL DEFAULT '',
    "websiteUrl" TEXT,
    "targetSemester" INTEGER,
    "trackTags" TEXT[],
    "notes" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThesisCompany_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ThesisCompany" ADD CONSTRAINT "ThesisCompany_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
