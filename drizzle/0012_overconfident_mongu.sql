ALTER TYPE "public"."role" ADD VALUE 'parent';--> statement-breakpoint
CREATE TABLE "asistencia" (
	"id" serial PRIMARY KEY NOT NULL,
	"curso_id" integer NOT NULL,
	"student_id" integer NOT NULL,
	"fecha" timestamp NOT NULL,
	"estado" varchar(20) DEFAULT 'presente' NOT NULL,
	CONSTRAINT "asistencia_unique" UNIQUE("curso_id","student_id","fecha")
);
--> statement-breakpoint
CREATE TABLE "parent_students" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_id" integer NOT NULL,
	"student_id" integer NOT NULL,
	CONSTRAINT "parent_student_unique" UNIQUE("parent_id","student_id")
);
--> statement-breakpoint
ALTER TABLE "asistencia" ADD CONSTRAINT "asistencia_curso_id_cursos_id_fk" FOREIGN KEY ("curso_id") REFERENCES "public"."cursos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asistencia" ADD CONSTRAINT "asistencia_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_students" ADD CONSTRAINT "parent_students_parent_id_users_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_students" ADD CONSTRAINT "parent_students_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;