-- AlterTable
ALTER TABLE "RecoveryCase" ADD COLUMN     "activeSkillId" TEXT,
ADD COLUMN     "activeSkillVersion" INTEGER,
ADD COLUMN     "subjectId" TEXT,
ADD COLUMN     "subjectType" TEXT;
