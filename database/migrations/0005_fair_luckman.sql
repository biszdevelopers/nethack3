CREATE TYPE "public"."judge_flag_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TABLE "awards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"edition_id" uuid NOT NULL,
	"namespace" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon" text DEFAULT 'award' NOT NULL,
	"color" text DEFAULT 'gold' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "awards_id_org_unique" UNIQUE("id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "edition_results" (
	"edition_id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_by_user_id" uuid NOT NULL,
	"snapshot" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "judge_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"edition_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"reported_by_user_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" "judge_flag_status" DEFAULT 'open' NOT NULL,
	"resolved_by_user_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "judge_flags_id_org_unique" UNIQUE("id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "team_awards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"edition_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"award_id" uuid NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"assigned_by_user_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_awards_team_award_unique" UNIQUE("team_id","award_id"),
	CONSTRAINT "team_awards_id_org_unique" UNIQUE("id","organization_id")
);
--> statement-breakpoint
ALTER TABLE "voting_rounds" ALTER COLUMN "max_selections" SET DEFAULT 10;--> statement-breakpoint
ALTER TABLE "votes" ADD COLUMN "stars" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "awards" ADD CONSTRAINT "awards_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awards" ADD CONSTRAINT "awards_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awards" ADD CONSTRAINT "awards_edition_fk" FOREIGN KEY ("edition_id","organization_id") REFERENCES "public"."competition_editions"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_results" ADD CONSTRAINT "edition_results_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_results" ADD CONSTRAINT "edition_results_published_by_user_id_users_id_fk" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_results" ADD CONSTRAINT "edition_results_edition_fk" FOREIGN KEY ("edition_id","organization_id") REFERENCES "public"."competition_editions"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judge_flags" ADD CONSTRAINT "judge_flags_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judge_flags" ADD CONSTRAINT "judge_flags_reported_by_user_id_users_id_fk" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judge_flags" ADD CONSTRAINT "judge_flags_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judge_flags" ADD CONSTRAINT "judge_flags_edition_fk" FOREIGN KEY ("edition_id","organization_id") REFERENCES "public"."competition_editions"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judge_flags" ADD CONSTRAINT "judge_flags_assignment_fk" FOREIGN KEY ("assignment_id","organization_id") REFERENCES "public"."judge_assignments"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judge_flags" ADD CONSTRAINT "judge_flags_submission_fk" FOREIGN KEY ("submission_id","organization_id") REFERENCES "public"."submissions"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_awards" ADD CONSTRAINT "team_awards_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_awards" ADD CONSTRAINT "team_awards_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_awards" ADD CONSTRAINT "team_awards_team_fk" FOREIGN KEY ("team_id","organization_id") REFERENCES "public"."teams"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_awards" ADD CONSTRAINT "team_awards_award_fk" FOREIGN KEY ("award_id","organization_id") REFERENCES "public"."awards"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "awards_edition_namespace_unique" ON "awards" USING btree ("edition_id","namespace");--> statement-breakpoint
CREATE INDEX "awards_org_edition_idx" ON "awards" USING btree ("organization_id","edition_id");--> statement-breakpoint
CREATE INDEX "edition_results_org_idx" ON "edition_results" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "judge_flags_assignment_judge_unique" ON "judge_flags" USING btree ("assignment_id","reported_by_user_id");--> statement-breakpoint
CREATE INDEX "judge_flags_edition_status_idx" ON "judge_flags" USING btree ("organization_id","edition_id","status");--> statement-breakpoint
CREATE INDEX "judge_flags_judge_idx" ON "judge_flags" USING btree ("organization_id","reported_by_user_id");--> statement-breakpoint
CREATE INDEX "team_awards_org_edition_idx" ON "team_awards" USING btree ("organization_id","edition_id");--> statement-breakpoint
CREATE INDEX "team_awards_org_team_idx" ON "team_awards" USING btree ("organization_id","team_id");--> statement-breakpoint
CREATE INDEX "team_awards_org_award_idx" ON "team_awards" USING btree ("organization_id","award_id");--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_stars_range_check" CHECK ("votes"."stars" between 1 and 5);
--> statement-breakpoint
UPDATE "voting_rounds" SET "max_selections" = 10 WHERE "max_selections" < 2;--> statement-breakpoint
ALTER TABLE "awards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "awards" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "awards_isolation" ON "awards"
    FOR ALL
    USING (organization_id = current_organization_id())
    WITH CHECK (organization_id = current_organization_id());--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "awards" TO nethack_app;--> statement-breakpoint
ALTER TABLE "team_awards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "team_awards" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "team_awards_isolation" ON "team_awards"
    FOR ALL
    USING (organization_id = current_organization_id())
    WITH CHECK (organization_id = current_organization_id());--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "team_awards" TO nethack_app;--> statement-breakpoint
ALTER TABLE "edition_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "edition_results" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "edition_results_isolation" ON "edition_results"
    FOR ALL
    USING (organization_id = current_organization_id())
    WITH CHECK (organization_id = current_organization_id());--> statement-breakpoint
CREATE POLICY "edition_results_public_read" ON "edition_results"
    FOR SELECT
    USING (true);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "edition_results" TO nethack_app;--> statement-breakpoint
ALTER TABLE "judge_flags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "judge_flags" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "judge_flags_isolation" ON "judge_flags"
    FOR ALL
    USING (organization_id = current_organization_id())
    WITH CHECK (organization_id = current_organization_id());--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "judge_flags" TO nethack_app;
