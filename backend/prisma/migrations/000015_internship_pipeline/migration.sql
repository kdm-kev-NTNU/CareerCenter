-- AlterTable
ALTER TABLE "InternshipStatusOption" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'stage';

-- AlterTable
ALTER TABLE "Internship" ADD COLUMN "stageIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "InternshipStatusOption"
SET "kind" = 'outcome'
WHERE "label" IN ('Tilbud', 'Avslått', 'Trukket');
