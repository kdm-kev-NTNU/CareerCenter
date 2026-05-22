-- CreateTable
CREATE TABLE "BachelorFolder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BachelorFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BachelorFile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "folderId" TEXT,
    "originalName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BachelorFile_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BachelorFolder" ADD CONSTRAINT "BachelorFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BachelorFolder" ADD CONSTRAINT "BachelorFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "BachelorFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BachelorFile" ADD CONSTRAINT "BachelorFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BachelorFile" ADD CONSTRAINT "BachelorFile_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "BachelorFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
