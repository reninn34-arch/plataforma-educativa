CREATE TABLE "student_modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"module_id" integer NOT NULL,
	"order" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "student_module_unique" UNIQUE("student_id","module_id")
);
--> statement-breakpoint
ALTER TABLE "student_modules" ADD CONSTRAINT "student_modules_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_modules" ADD CONSTRAINT "student_modules_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_student_modules_order" ON "student_modules" USING btree ("student_id","order");