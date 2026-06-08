-- Drop foreign keys and companyId columns from listings
ALTER TABLE "Internship" DROP CONSTRAINT IF EXISTS "Internship_companyId_fkey";
ALTER TABLE "GraduateProgram" DROP CONSTRAINT IF EXISTS "GraduateProgram_companyId_fkey";
ALTER TABLE "Internship" DROP COLUMN IF EXISTS "companyId";
ALTER TABLE "GraduateProgram" DROP COLUMN IF EXISTS "companyId";

-- Drop board and legacy map tables
DROP TABLE IF EXISTS "CareerBoard";
DROP TABLE IF EXISTS "CareerMapNode";
DROP TABLE IF EXISTS "Company";
