ALTER TABLE "competition_editions" ADD COLUMN "requires_board_approval" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "competition_editions" ADD COLUMN "is_blank_start" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "competition_editions" ADD COLUMN "board_approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "competition_editions" ADD COLUMN "board_approved_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "competition_editions" ADD CONSTRAINT "competition_editions_board_approved_by_user_id_users_id_fk" FOREIGN KEY ("board_approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;