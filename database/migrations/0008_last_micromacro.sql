ALTER TABLE "competition_editions" ADD COLUMN "results_open_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "locked_at" timestamp with time zone;