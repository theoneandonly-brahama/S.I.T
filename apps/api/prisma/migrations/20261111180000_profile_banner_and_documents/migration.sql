-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "bannerColor" TEXT,
ADD COLUMN     "diplomaUploadId" TEXT;

-- CreateTable
CREATE TABLE "ProfileCertification" (
    "profileId" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileCertification_pkey" PRIMARY KEY ("profileId","uploadId")
);

-- CreateIndex
CREATE INDEX "ProfileCertification_uploadId_idx" ON "ProfileCertification"("uploadId");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_diplomaUploadId_key" ON "Profile"("diplomaUploadId");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_diplomaUploadId_fkey" FOREIGN KEY ("diplomaUploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileCertification" ADD CONSTRAINT "ProfileCertification_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileCertification" ADD CONSTRAINT "ProfileCertification_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
