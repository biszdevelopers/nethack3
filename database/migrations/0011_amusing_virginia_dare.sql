ALTER TYPE "public"."edition_status" ADD VALUE 'paused' BEFORE 'completed';--> statement-breakpoint
ALTER TABLE "ballots" ADD COLUMN "voter_team_id" uuid;--> statement-breakpoint
ALTER TABLE "competition_editions" ADD COLUMN "status_before_pause" "edition_status";