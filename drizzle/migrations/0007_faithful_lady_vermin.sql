CREATE TABLE "pomodoro_active_state" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"type" varchar(20) NOT NULL,
	"duration" integer NOT NULL,
	"time_left" integer NOT NULL,
	"is_running" boolean DEFAULT false NOT NULL,
	"start_time" timestamp,
	"completed_sessions" integer DEFAULT 0 NOT NULL,
	"task_id" uuid,
	"task_title" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pomodoro_active_state" ADD CONSTRAINT "pomodoro_active_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pomodoro_active_state" ADD CONSTRAINT "pomodoro_active_state_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;