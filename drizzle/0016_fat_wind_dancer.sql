CREATE TABLE "student_exercises" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"node_id" integer NOT NULL,
	"version" integer NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "student_exercises_student_node_unique" UNIQUE("student_id","node_id")
);
--> statement-breakpoint
ALTER TABLE "student_exercises" ADD CONSTRAINT "student_exercises_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_exercises" ADD CONSTRAINT "student_exercises_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nodes" DROP COLUMN "cached_exercises";