ALTER TABLE "sessions" ADD COLUMN "development_only" BOOLEAN NOT NULL DEFAULT false;
-- All sessions issued before production identity integration are development sessions.
UPDATE "sessions" SET "development_only" = true;
