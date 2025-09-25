ALTER TABLE "habit_logs" ALTER COLUMN "date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "habits" ALTER COLUMN "active" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pomodoro_sessions" ALTER COLUMN "completed_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "habit_logs" ADD COLUMN "completed_at" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "habit_logs" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "target_days" integer[];--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "pomodoro_sessions" ADD COLUMN "type" varchar(50);--> statement-breakpoint
ALTER TABLE "pomodoro_sessions" ADD COLUMN "start_time" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "pomodoro_sessions" ADD COLUMN "end_time" timestamp;--> statement-breakpoint
ALTER TABLE "pomodoro_sessions" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;