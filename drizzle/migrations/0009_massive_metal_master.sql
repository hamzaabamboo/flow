ALTER TABLE "calendar_integrations" RENAME TO "external_calendars";--> statement-breakpoint
ALTER TABLE "external_calendars" DROP CONSTRAINT "calendar_integrations_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "external_calendars" ADD COLUMN "name" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "external_calendars" ADD COLUMN "ical_url" text NOT NULL;--> statement-breakpoint
ALTER TABLE "external_calendars" ADD COLUMN "space" "space_enum" NOT NULL;--> statement-breakpoint
ALTER TABLE "external_calendars" ADD COLUMN "color" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "external_calendars" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "external_calendars" ADD CONSTRAINT "external_calendars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_calendars" DROP COLUMN "provider";--> statement-breakpoint
ALTER TABLE "external_calendars" DROP COLUMN "access_token";--> statement-breakpoint
ALTER TABLE "external_calendars" DROP COLUMN "refresh_token";--> statement-breakpoint
ALTER TABLE "external_calendars" DROP COLUMN "token_expiry";--> statement-breakpoint
ALTER TABLE "external_calendars" DROP COLUMN "email";--> statement-breakpoint
ALTER TABLE "external_calendars" DROP COLUMN "calendar_id";--> statement-breakpoint
ALTER TABLE "external_calendars" DROP COLUMN "sync_enabled";--> statement-breakpoint
ALTER TABLE "external_calendars" DROP COLUMN "last_sync_at";