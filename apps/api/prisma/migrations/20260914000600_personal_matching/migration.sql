CREATE TYPE "ApplicationKind" AS ENUM ('OPPORTUNITY', 'MATCH');
ALTER TABLE "applications" ADD COLUMN "kind" "ApplicationKind" NOT NULL DEFAULT 'OPPORTUNITY',
  ADD COLUMN "target_user_id" TEXT, ALTER COLUMN "opportunity_id" DROP NOT NULL;
ALTER TABLE "applications" ADD CONSTRAINT "applications_target_user_id_fkey"
  FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "applications" ADD CONSTRAINT "applications_kind_target_check" CHECK (
  ("kind" = 'OPPORTUNITY' AND "opportunity_id" IS NOT NULL AND "target_user_id" IS NULL) OR
  ("kind" = 'MATCH' AND "opportunity_id" IS NULL AND "target_user_id" IS NOT NULL AND "target_user_id" <> "applicant_id")
);
CREATE UNIQUE INDEX "applications_applicant_id_target_user_id_key" ON "applications"("applicant_id", "target_user_id");
CREATE INDEX "applications_target_user_id_created_at_idx" ON "applications"("target_user_id", "created_at");
CREATE TABLE "match_rounds" (
  "id" TEXT PRIMARY KEY, "user_id" TEXT NOT NULL, "day" TEXT NOT NULL, "ordinal" INTEGER NOT NULL,
  "request_id" TEXT NOT NULL, "requirement" TEXT NOT NULL, "algorithm" TEXT NOT NULL DEFAULT 'rules-v1',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "match_rounds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "match_rounds_ordinal_check" CHECK ("ordinal" BETWEEN 1 AND 3)
);
CREATE UNIQUE INDEX "match_rounds_user_id_day_ordinal_key" ON "match_rounds"("user_id", "day", "ordinal");
CREATE UNIQUE INDEX "match_rounds_user_id_request_id_key" ON "match_rounds"("user_id", "request_id");
CREATE TABLE "match_candidates" (
  "round_id" TEXT NOT NULL, "user_id" TEXT NOT NULL, "score" INTEGER NOT NULL, "rank" INTEGER NOT NULL,
  PRIMARY KEY ("round_id", "user_id"),
  CONSTRAINT "match_candidates_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "match_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "match_candidates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
