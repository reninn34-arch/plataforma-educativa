ALTER TYPE "public"."role" ADD VALUE 'admin';--> statement-breakpoint
CREATE TABLE "curso_estudiantes" (
	"id" serial PRIMARY KEY NOT NULL,
	"curso_id" integer NOT NULL,
	"estudiante_id" integer NOT NULL,
	CONSTRAINT "curso_estudiante_unique" UNIQUE("curso_id","estudiante_id")
);
--> statement-breakpoint
CREATE TABLE "cursos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(200) NOT NULL,
	"nivel" varchar(100) NOT NULL,
	"profesor_id" integer,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email" varchar(200);--> statement-breakpoint
ALTER TABLE "curso_estudiantes" ADD CONSTRAINT "curso_estudiantes_curso_id_cursos_id_fk" FOREIGN KEY ("curso_id") REFERENCES "public"."cursos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curso_estudiantes" ADD CONSTRAINT "curso_estudiantes_estudiante_id_users_id_fk" FOREIGN KEY ("estudiante_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cursos" ADD CONSTRAINT "cursos_profesor_id_users_id_fk" FOREIGN KEY ("profesor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;