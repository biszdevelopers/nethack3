ALTER TABLE "competition_editions" ADD COLUMN "theme_name" text;--> statement-breakpoint
ALTER TABLE "competition_editions" ADD COLUMN "theme_description" text;--> statement-breakpoint
ALTER TABLE "competition_editions" ADD COLUMN "show_scores" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "competition_editions" ADD COLUMN "show_ranking" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "video_url" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "ai_disclosure" text DEFAULT '' NOT NULL;