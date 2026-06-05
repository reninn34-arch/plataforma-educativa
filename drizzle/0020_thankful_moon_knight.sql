CREATE TABLE "notificaciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" varchar(20) DEFAULT 'system' NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" text,
	"link" varchar(500),
	"read" boolean DEFAULT false NOT NULL,
	"related_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notificaciones_user_id" ON "notificaciones" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notificaciones_read" ON "notificaciones" USING btree ("read");--> statement-breakpoint
CREATE INDEX "idx_notificaciones_user_read" ON "notificaciones" USING btree ("user_id","read");