-- CreateTable
CREATE TABLE "GraduateProgramStatusOption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GraduateProgramStatusOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraduateProgramLocationOption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GraduateProgramLocationOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraduateProgramRequirementType" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GraduateProgramRequirementType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraduateProgram" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT,
    "companyName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "applicationUrl" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "deadline" TIMESTAMP(3),
    "statusId" TEXT NOT NULL,
    "locationIds" TEXT[],
    "trackTags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GraduateProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraduateProgramRequirementItem" (
    "id" TEXT NOT NULL,
    "graduateProgramId" TEXT NOT NULL,
    "requirementTypeId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "GraduateProgramRequirementItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GraduateProgramStatusOption" ADD CONSTRAINT "GraduateProgramStatusOption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduateProgramLocationOption" ADD CONSTRAINT "GraduateProgramLocationOption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduateProgramRequirementType" ADD CONSTRAINT "GraduateProgramRequirementType_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduateProgram" ADD CONSTRAINT "GraduateProgram_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduateProgram" ADD CONSTRAINT "GraduateProgram_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduateProgram" ADD CONSTRAINT "GraduateProgram_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "GraduateProgramStatusOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduateProgramRequirementItem" ADD CONSTRAINT "GraduateProgramRequirementItem_graduateProgramId_fkey" FOREIGN KEY ("graduateProgramId") REFERENCES "GraduateProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduateProgramRequirementItem" ADD CONSTRAINT "GraduateProgramRequirementItem_requirementTypeId_fkey" FOREIGN KEY ("requirementTypeId") REFERENCES "GraduateProgramRequirementType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
