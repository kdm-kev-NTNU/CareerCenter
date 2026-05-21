-- CreateTable
CREATE TABLE "CareerTrackSetting" (
    "id" TEXT NOT NULL,
    "defaultLabel" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CareerTrackSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerMapNode" (
    "id" TEXT NOT NULL,
    "defaultTitle" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "defaultItems" TEXT[] NOT NULL,
    "items" TEXT[] NOT NULL,
    "level" INTEGER NOT NULL,
    "trackId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CareerMapNode_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CareerMapNode" ADD CONSTRAINT "CareerMapNode_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "CareerTrackSetting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
