ALTER TABLE "columns" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "inbox_items" ADD COLUMN "processed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "inbox_items" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;