-- CreateEnum
CREATE TYPE "UploadPurpose" AS ENUM ('GENERAL', 'PROFILE_PHOTO', 'PROFILE_CV');

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "curriculum" JSONB,
ADD COLUMN     "cvUploadId" TEXT,
ADD COLUMN     "links" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "photoUploadId" TEXT,
ADD COLUMN     "skills" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Upload" ADD COLUMN     "purpose" "UploadPurpose" NOT NULL DEFAULT 'GENERAL';

-- CreateIndex
CREATE UNIQUE INDEX "Profile_photoUploadId_key" ON "Profile"("photoUploadId");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_cvUploadId_key" ON "Profile"("cvUploadId");

-- CreateIndex
CREATE INDEX "Upload_accountId_purpose_idx" ON "Upload"("accountId", "purpose");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_photoUploadId_fkey" FOREIGN KEY ("photoUploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_cvUploadId_fkey" FOREIGN KEY ("cvUploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

