CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}',
	"embedding" vector(1536),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "chat_vectors" DROP CONSTRAINT "chat_vectors_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "chat_vectors" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_vectors" ADD COLUMN "chat_id" uuid;--> statement-breakpoint
ALTER TABLE "chat_vectors" ADD COLUMN "message_id" uuid;--> statement-breakpoint
ALTER TABLE "chat_vectors" ADD COLUMN "content" text NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_vectors" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
ALTER TABLE "chat_vectors" ADD COLUMN "metadata" jsonb DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_chat_messages_chat_id" ON "chat_messages" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "idx_chat_messages_created_at" ON "chat_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_chat_messages_embedding" ON "chat_messages" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "idx_chats_user_id" ON "chats" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_chats_updated_at" ON "chats" USING btree ("updated_at");--> statement-breakpoint
ALTER TABLE "chat_vectors" ADD CONSTRAINT "chat_vectors_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_vectors" ADD CONSTRAINT "chat_vectors_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_vectors" ADD CONSTRAINT "chat_vectors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_chat_vectors_user_id" ON "chat_vectors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_chat_vectors_chat_id" ON "chat_vectors" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "idx_chat_vectors_embedding" ON "chat_vectors" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
ALTER TABLE "chat_vectors" DROP COLUMN "vector";