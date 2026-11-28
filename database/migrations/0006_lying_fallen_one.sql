CREATE TYPE "public"."debug_ai_message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
ALTER TYPE "public"."team_status" ADD VALUE 'withdrawn' BEFORE 'disbanded';--> statement-breakpoint
ALTER TYPE "public"."team_status" ADD VALUE 'disqualified' BEFORE 'disbanded';--> statement-breakpoint
ALTER TYPE "public"."team_status" ADD VALUE 'no_show' BEFORE 'disbanded';--> statement-breakpoint
CREATE TABLE "debug_ai_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" "debug_ai_message_role" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debug_ai_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "judging_rubric_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"definition" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "judging_rubric_templates_id_org_unique" UNIQUE("id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "judging_score_curves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"edition_id" uuid NOT NULL,
	"points" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "judging_score_curves_id_org_unique" UNIQUE("id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "user_profile_themes" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"theme" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ballots" ADD COLUMN "reasoning" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "edition_results" ADD COLUMN "previous_edition_status" "edition_status";--> statement-breakpoint
ALTER TABLE "evaluation_versions" ADD COLUMN "rubric_id" uuid;--> statement-breakpoint
ALTER TABLE "evaluation_versions" ADD COLUMN "rubric_version" integer;--> statement-breakpoint
ALTER TABLE "evaluation_versions" ADD COLUMN "rubric_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "judging_criteria" ADD COLUMN "min_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "judging_rubrics" ADD COLUMN "division_id" uuid;--> statement-breakpoint
ALTER TABLE "judging_rubrics" ADD COLUMN "family_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "judging_rubrics" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "judging_rubrics" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "judging_rubrics" ADD COLUMN "comment_guidance" jsonb DEFAULT '{"introduction":"","guidelines":[],"templates":[]}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "voting_rounds" ADD COLUMN "max_votes_per_user" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "debug_ai_messages" ADD CONSTRAINT "debug_ai_messages_session_fk" FOREIGN KEY ("session_id") REFERENCES "public"."debug_ai_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debug_ai_sessions" ADD CONSTRAINT "debug_ai_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judging_rubric_templates" ADD CONSTRAINT "judging_rubric_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judging_score_curves" ADD CONSTRAINT "judging_score_curves_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judging_score_curves" ADD CONSTRAINT "judging_score_curves_edition_fk" FOREIGN KEY ("edition_id","organization_id") REFERENCES "public"."competition_editions"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile_themes" ADD CONSTRAINT "user_profile_themes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "debug_ai_messages_session_created_idx" ON "debug_ai_messages" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "debug_ai_sessions_user_updated_idx" ON "debug_ai_sessions" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "judging_rubric_templates_org_name_unique" ON "judging_rubric_templates" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "judging_rubric_templates_org_idx" ON "judging_rubric_templates" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "judging_score_curves_org_edition_unique" ON "judging_score_curves" USING btree ("organization_id","edition_id");--> statement-breakpoint
ALTER TABLE "judging_rubrics" ADD CONSTRAINT "judging_rubrics_division_fk" FOREIGN KEY ("division_id","organization_id") REFERENCES "public"."divisions"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "judging_rubrics_family_version_unique" ON "judging_rubrics" USING btree ("family_id","version");--> statement-breakpoint
CREATE INDEX "judging_rubrics_family_idx" ON "judging_rubrics" USING btree ("organization_id","family_id","version");--> statement-breakpoint
CREATE INDEX "judging_rubrics_division_idx" ON "judging_rubrics" USING btree ("organization_id","division_id");--> statement-breakpoint
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_reasoning_length_check" CHECK (length("ballots"."reasoning") <= 2000);--> statement-breakpoint
ALTER TABLE "voting_rounds" ADD CONSTRAINT "voting_rounds_max_votes_per_user_check" CHECK ("voting_rounds"."max_votes_per_user" between 0 and 50);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
    SELECT nullif(current_setting('nethack.user_id', true), '')::uuid
$$;--> statement-breakpoint
ALTER TABLE "judging_rubric_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "judging_rubric_templates" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "judging_rubric_templates_isolation" ON "judging_rubric_templates"
    FOR ALL
    USING (organization_id = current_organization_id())
    WITH CHECK (organization_id = current_organization_id());--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "judging_rubric_templates" TO nethack_app;--> statement-breakpoint
ALTER TABLE "judging_score_curves" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "judging_score_curves" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "judging_score_curves_isolation" ON "judging_score_curves"
    FOR ALL
    USING (organization_id = current_organization_id())
    WITH CHECK (organization_id = current_organization_id());--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "judging_score_curves" TO nethack_app;--> statement-breakpoint
ALTER TABLE "user_profile_themes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_profile_themes" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "user_profile_themes_public_read" ON "user_profile_themes"
    FOR SELECT
    USING (true);--> statement-breakpoint
CREATE POLICY "user_profile_themes_owner_write" ON "user_profile_themes"
    FOR ALL
    USING (user_id = current_user_id())
    WITH CHECK (user_id = current_user_id());--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "user_profile_themes" TO nethack_app;--> statement-breakpoint
ALTER TABLE "debug_ai_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "debug_ai_sessions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "debug_ai_sessions_owner" ON "debug_ai_sessions"
    FOR ALL
    USING (user_id = current_user_id())
    WITH CHECK (user_id = current_user_id());--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "debug_ai_sessions" TO nethack_app;--> statement-breakpoint
ALTER TABLE "debug_ai_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "debug_ai_messages" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "debug_ai_messages_owner" ON "debug_ai_messages"
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM debug_ai_sessions session
            WHERE session.id = debug_ai_messages.session_id
              AND session.user_id = current_user_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM debug_ai_sessions session
            WHERE session.id = debug_ai_messages.session_id
              AND session.user_id = current_user_id()
        )
    );--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "debug_ai_messages" TO nethack_app;
