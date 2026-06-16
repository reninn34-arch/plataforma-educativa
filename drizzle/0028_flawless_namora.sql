CREATE TABLE "node_videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"node_id" integer NOT NULL,
	"video_id" varchar(50) NOT NULL,
	"title" varchar(300) NOT NULL,
	"channel_name" varchar(200) NOT NULL,
	"thumbnail_url" varchar(500),
	"duration" varchar(20),
	"embeddable" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "node_videos_node_video_unique" UNIQUE("node_id","video_id")
);
--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "topic_embedding" jsonb;--> statement-breakpoint
ALTER TABLE "node_videos" ADD CONSTRAINT "node_videos_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_node_videos_node_id" ON "node_videos" USING btree ("node_id");