-- AlterTable
ALTER TABLE "BachelorKnowledge" ADD COLUMN "folderId" TEXT;

-- AddForeignKey
ALTER TABLE "BachelorKnowledge" ADD CONSTRAINT "BachelorKnowledge_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "BachelorFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
