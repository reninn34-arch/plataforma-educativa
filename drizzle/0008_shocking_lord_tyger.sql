CREATE TABLE "configuracion" (
	"id" serial PRIMARY KEY NOT NULL,
	"clave" varchar(100) NOT NULL,
	"valor" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "configuracion_clave_unique" UNIQUE("clave")
);
