CREATE TABLE "curso_profesores" (
	"id" serial PRIMARY KEY NOT NULL,
	"curso_id" integer NOT NULL,
	"teacher_id" integer NOT NULL,
	"subject_id" integer NOT NULL,
	CONSTRAINT "curso_profesor_subject_unique" UNIQUE("curso_id","teacher_id","subject_id")
);
--> statement-breakpoint
CREATE TABLE "teacher_subjects" (
	"id" serial PRIMARY KEY NOT NULL,
	"teacher_id" integer NOT NULL,
	"subject_id" integer NOT NULL,
	CONSTRAINT "teacher_subject_unique" UNIQUE("teacher_id","subject_id")
);
--> statement-breakpoint
ALTER TABLE "curso_profesores" ADD CONSTRAINT "curso_profesores_curso_id_cursos_id_fk" FOREIGN KEY ("curso_id") REFERENCES "public"."cursos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curso_profesores" ADD CONSTRAINT "curso_profesores_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curso_profesores" ADD CONSTRAINT "curso_profesores_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_subjects" ADD CONSTRAINT "teacher_subjects_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_subjects" ADD CONSTRAINT "teacher_subjects_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;