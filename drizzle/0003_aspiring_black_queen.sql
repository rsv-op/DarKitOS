CREATE TABLE "aggregator_sku_mappings" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text DEFAULT 'ORG-001' NOT NULL,
	"kitchen_id" text NOT NULL,
	"brand_id" text NOT NULL,
	"menu_item_id" text NOT NULL,
	"provider" text DEFAULT 'URBANPIPER' NOT NULL,
	"channel" text NOT NULL,
	"external_store_id" text NOT NULL,
	"external_item_id" text NOT NULL,
	"external_item_name" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_notification_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text DEFAULT 'ORG-001' NOT NULL,
	"kitchen_id" text,
	"template_name" text NOT NULL,
	"recipient_phone" text NOT NULL,
	"dedupe_key" text,
	"provider" text NOT NULL,
	"provider_message_id" text,
	"status" text NOT NULL,
	"payload" jsonb NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outbox_events" ALTER COLUMN "attempt" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "outbox_events" ALTER COLUMN "max_attempts" SET DEFAULT 5;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD COLUMN "organization_id" text DEFAULT 'ORG-001' NOT NULL;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD COLUMN "kitchen_id" text;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD COLUMN "destination" text DEFAULT 'URBANPIPER' NOT NULL;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD COLUMN "next_retry_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "aggregator_sku_mappings" ADD CONSTRAINT "aggregator_sku_mappings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aggregator_sku_mappings" ADD CONSTRAINT "aggregator_sku_mappings_kitchen_id_kitchens_id_fk" FOREIGN KEY ("kitchen_id") REFERENCES "public"."kitchens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aggregator_sku_mappings" ADD CONSTRAINT "aggregator_sku_mappings_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aggregator_sku_mappings" ADD CONSTRAINT "aggregator_sku_mappings_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_notification_logs" ADD CONSTRAINT "whatsapp_notification_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_notification_logs" ADD CONSTRAINT "whatsapp_notification_logs_kitchen_id_kitchens_id_fk" FOREIGN KEY ("kitchen_id") REFERENCES "public"."kitchens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agg_sku_mappings_org_provider_store_item_uidx" ON "aggregator_sku_mappings" USING btree ("organization_id","provider","external_store_id","external_item_id");--> statement-breakpoint
CREATE INDEX "agg_sku_mappings_org_kitchen_idx" ON "aggregator_sku_mappings" USING btree ("organization_id","kitchen_id");--> statement-breakpoint
CREATE INDEX "whatsapp_logs_org_dedupe_created_idx" ON "whatsapp_notification_logs" USING btree ("organization_id","dedupe_key","created_at");--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_kitchen_id_kitchens_id_fk" FOREIGN KEY ("kitchen_id") REFERENCES "public"."kitchens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outbox_events_due_status_retry_idx" ON "outbox_events" USING btree ("status","next_retry_at");--> statement-breakpoint
CREATE INDEX "outbox_events_org_kitchen_idx" ON "outbox_events" USING btree ("organization_id","kitchen_id");