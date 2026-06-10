CREATE TABLE "cuestionario_preguntas" (
	"id" serial PRIMARY KEY NOT NULL,
	"cuestionario_id" integer NOT NULL,
	"type" "question_type" DEFAULT 'mcq' NOT NULL,
	"question" text NOT NULL,
	"options" jsonb,
	"correct_index" integer,
	"explanation" text,
	"points" integer DEFAULT 1 NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cuestionarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"teacher_id" integer NOT NULL,
	"subject_id" integer NOT NULL,
	"curso_id" integer,
	"title" varchar(200) NOT NULL,
	"description" text,
	"trimester" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cuestionario_preguntas" ADD CONSTRAINT "cuestionario_preguntas_cuestionario_id_cuestionarios_id_fk" FOREIGN KEY ("cuestionario_id") REFERENCES "public"."cuestionarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuestionarios" ADD CONSTRAINT "cuestionarios_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuestionarios" ADD CONSTRAINT "cuestionarios_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuestionarios" ADD CONSTRAINT "cuestionarios_curso_id_cursos_id_fk" FOREIGN KEY ("curso_id") REFERENCES "public"."cursos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cuestionario_preguntas_cuestionario_id" ON "cuestionario_preguntas" USING btree ("cuestionario_id");--> statement-breakpoint
CREATE INDEX "idx_cuestionarios_teacher_id" ON "cuestionarios" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "idx_cuestionarios_subject_id" ON "cuestionarios" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "idx_cuestionarios_curso_id" ON "cuestionarios" USING btree ("curso_id");