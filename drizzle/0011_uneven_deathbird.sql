CREATE TABLE "periodos_lectivos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(50) NOT NULL,
	"activo" boolean DEFAULT false NOT NULL,
	"fecha_inicio" timestamp,
	"fecha_fin" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
