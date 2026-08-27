CREATE TABLE "anonymous_devices" (
	"id" varchar PRIMARY KEY NOT NULL,
	"free_scans_used" integer DEFAULT 0 NOT NULL,
	"claimed_by_user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scan_usage_logs" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scan_usage_logs" ADD COLUMN "device_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_status" varchar DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_plan" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trial_used" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "revenue_cat_customer_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "free_scans_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "anonymous_devices" ADD CONSTRAINT "anonymous_devices_claimed_by_user_id_users_id_fk" FOREIGN KEY ("claimed_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;