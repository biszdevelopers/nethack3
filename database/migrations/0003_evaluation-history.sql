CREATE TABLE "evaluation_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"judge_user_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"status" text NOT NULL,
	"overall_comment" text DEFAULT '' NOT NULL,
	"weighted_score" numeric(7, 2),
	"scores" jsonb NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evaluation_versions_evaluation_revision_unique" UNIQUE("evaluation_id","revision"),
	CONSTRAINT "evaluation_versions_id_org_unique" UNIQUE("id","organization_id")
);
--> statement-breakpoint
ALTER TABLE "evaluation_versions" ADD CONSTRAINT "evaluation_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_versions" ADD CONSTRAINT "evaluation_versions_judge_user_id_users_id_fk" FOREIGN KEY ("judge_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_versions" ADD CONSTRAINT "evaluation_versions_evaluation_fk" FOREIGN KEY ("evaluation_id","organization_id") REFERENCES "public"."evaluations"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evaluation_versions_assignment_revision_idx" ON "evaluation_versions" USING btree ("organization_id","assignment_id","revision" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "evaluation_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "evaluation_versions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "evaluation_versions_isolation" ON "evaluation_versions"
    FOR ALL
    USING (organization_id = current_organization_id())
    WITH CHECK (organization_id = current_organization_id());--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "evaluation_versions" TO nethack_app;