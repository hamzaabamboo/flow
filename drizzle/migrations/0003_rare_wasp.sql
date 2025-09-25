CREATE TYPE "public"."space_enum" AS ENUM('work', 'personal');--> statement-breakpoint
ALTER TABLE "boards" ALTER COLUMN "space" SET DATA TYPE "public"."space_enum" USING "space"::"public"."space_enum";--> statement-breakpoint
ALTER TABLE "inbox_items" ALTER COLUMN "space" SET DATA TYPE "public"."space_enum" USING "space"::"public"."space_enum";