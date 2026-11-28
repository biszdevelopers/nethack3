DROP INDEX "team_members_team_user_unique";--> statement-breakpoint
ALTER TABLE "competition_editions" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "competition_editions" ADD COLUMN "contact_url" text;--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN "left_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_team_user_unique" ON "team_members" USING btree ("team_id","user_id") WHERE "team_members"."left_at" is null;