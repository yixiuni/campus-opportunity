CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');
ALTER TABLE "users" ADD COLUMN "contact" TEXT NOT NULL DEFAULT '';
CREATE TABLE "applications" (
  "id" TEXT NOT NULL,
  "opportunity_id" TEXT NOT NULL,
  "applicant_id" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "send_profile" BOOLEAN NOT NULL DEFAULT false,
  "profile_snapshot" JSONB,
  "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "applications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "applications_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "applications_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "applications_opportunity_id_applicant_id_key" ON "applications"("opportunity_id", "applicant_id");
CREATE INDEX "applications_applicant_id_created_at_idx" ON "applications"("applicant_id", "created_at");
CREATE INDEX "applications_opportunity_id_status_idx" ON "applications"("opportunity_id", "status");
