ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false;