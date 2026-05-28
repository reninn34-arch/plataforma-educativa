ALTER TABLE "teacher_subjects" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "teacher_subjects" CASCADE;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "curso_id" integer;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_curso_id_cursos_id_fk" FOREIGN KEY ("curso_id") REFERENCES "public"."cursos"("id") ON DELETE no action ON UPDATE no action;