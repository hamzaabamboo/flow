ALTER TABLE "boards" ADD COLUMN "settings" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "reminder_minutes_before" integer;