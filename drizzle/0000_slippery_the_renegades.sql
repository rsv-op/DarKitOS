CREATE TABLE "activities" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"details" text NOT NULL,
	"actor" text NOT NULL,
	"order_id" text,
	"kitchen_id" text,
	"brand_id" text,
	"timestamp" timestamp with time zone NOT NULL,
	"severity" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_kitchens" (
	"brand_id" text NOT NULL,
	"kitchen_id" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "brand_kitchens_brand_id_kitchen_id_pk" PRIMARY KEY("brand_id","kitchen_id")
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"color_theme" text NOT NULL,
	"tagline" text NOT NULL,
	"cuisine" text NOT NULL,
	CONSTRAINT "brands_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "cancellations" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"brand_id" text NOT NULL,
	"kitchen_id" text NOT NULL,
	"channel" text NOT NULL,
	"stage" text NOT NULL,
	"previous_status" text NOT NULL,
	"resolution" text NOT NULL,
	"source" text NOT NULL,
	"reason" text NOT NULL,
	"actor" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"financial_loss" numeric(12, 2) NOT NULL,
	"claim_amount" numeric(12, 2) NOT NULL,
	"restored_ingredients" jsonb NOT NULL,
	"lost_ingredients" jsonb NOT NULL,
	"dispatch_evidence" jsonb,
	CONSTRAINT "cancellations_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_code" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"kitchen_id" text,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "employees_employee_code_unique" UNIQUE("employee_code")
);
--> statement-breakpoint
CREATE TABLE "ingredients" (
	"id" text PRIMARY KEY NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"unit" text NOT NULL,
	"cost_per_unit" numeric(12, 2) NOT NULL,
	"expected_yield_pct" real,
	"actual_yield_pct" real,
	CONSTRAINT "ingredients_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"kitchen_id" text NOT NULL,
	"ingredient_id" text NOT NULL,
	"item_name" text NOT NULL,
	"sku" text NOT NULL,
	"type" text NOT NULL,
	"quantity" numeric(12, 4) NOT NULL,
	"previous_stock" numeric(12, 4) NOT NULL,
	"new_stock" numeric(12, 4) NOT NULL,
	"unit" text NOT NULL,
	"cost_impact" numeric(12, 2) NOT NULL,
	"order_id" text,
	"transfer_group_id" text,
	"actor" text NOT NULL,
	"reason" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kitchen_inventory" (
	"kitchen_id" text NOT NULL,
	"ingredient_id" text NOT NULL,
	"current_stock" numeric(12, 4) NOT NULL,
	"reorder_threshold" numeric(12, 4) NOT NULL,
	"last_restocked" timestamp with time zone NOT NULL,
	CONSTRAINT "kitchen_inventory_kitchen_id_ingredient_id_pk" PRIMARY KEY("kitchen_id","ingredient_id")
);
--> statement-breakpoint
CREATE TABLE "kitchens" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"location" text NOT NULL,
	"area_code" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"capacity_per_hour" integer DEFAULT 100 NOT NULL,
	CONSTRAINT "kitchens_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "leakage_vectors" (
	"id" text PRIMARY KEY NOT NULL,
	"vector" text NOT NULL,
	"signature" text NOT NULL,
	"impact_level" text NOT NULL,
	"impact_note" text NOT NULL,
	"potential_revenue" numeric(12, 2) NOT NULL,
	"actual_collected" numeric(12, 2) NOT NULL,
	"leaked_amount" numeric(12, 2) NOT NULL,
	"affected_accounts" integer NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_id" text NOT NULL,
	"name" text NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"station" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"prep_time_mins" integer DEFAULT 8 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_recipes" (
	"menu_item_id" text NOT NULL,
	"ingredient_id" text NOT NULL,
	"quantity_required" numeric(12, 4) NOT NULL,
	CONSTRAINT "menu_recipes_menu_item_id_ingredient_id_pk" PRIMARY KEY("menu_item_id","ingredient_id")
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"type" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"actor" text NOT NULL,
	"details" text
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"menu_item_id" text NOT NULL,
	"name" text NOT NULL,
	"quantity" integer NOT NULL,
	"price" numeric(12, 2),
	"notes" text,
	"station" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"external_order_id" text,
	"idempotency_key" text,
	"brand_id" text NOT NULL,
	"kitchen_id" text NOT NULL,
	"channel" text NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"priority" text,
	"total_amount" numeric(12, 2),
	"item_count" integer,
	"notes" text,
	"customer_name" text,
	"driver_name" text,
	"courier_eta_mins" integer,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"prep_started_at" timestamp with time zone,
	"prep_completed_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"driver_assigned_at" timestamp with time zone,
	"picked_up_at" timestamp with time zone,
	"dispatched_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancellation_source" text,
	"cancellation_reason" text,
	"cancelled_by" text,
	"cancellation_stage" text,
	"cancellation_resolution" text,
	"loss_amount" numeric(12, 2),
	"claim_amount" numeric(12, 2),
	"inventory_decision" text,
	"inventory_warnings" jsonb,
	"inventory_unavailable" jsonb,
	"inventory_consumed" boolean DEFAULT false NOT NULL,
	"inventory_restored" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"payload" text NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"max_attempts" integer DEFAULT 6 NOT NULL,
	"backoff_schedule" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"currency" text NOT NULL,
	"timezone" text NOT NULL,
	"theme" text NOT NULL,
	"fluid_animations" boolean DEFAULT true NOT NULL,
	"sync_mode" text NOT NULL,
	"auto_accept_orders" boolean DEFAULT true NOT NULL,
	"low_stock_multiplier" real DEFAULT 1 NOT NULL,
	"prep_sla_minutes" integer DEFAULT 12 NOT NULL,
	"dispatch_sla_minutes" integer DEFAULT 15 NOT NULL,
	"rls_enforcement" text NOT NULL,
	"circuit_breaker_state" text NOT NULL,
	"rate_limit_rps" integer DEFAULT 250 NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "virtual_files" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"size" text NOT NULL,
	"mime_type" text NOT NULL,
	"kitchen_id" text,
	"brand_id" text,
	"uploaded_by" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"content" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"idempotency_key" text PRIMARY KEY NOT NULL,
	"order_id" text,
	"status" text DEFAULT 'processing' NOT NULL,
	"channel" text NOT NULL,
	"brand_id" text NOT NULL,
	"kitchen_id" text NOT NULL,
	"payload_summary" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"hit_count" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_kitchens" ADD CONSTRAINT "brand_kitchens_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_kitchens" ADD CONSTRAINT "brand_kitchens_kitchen_id_kitchens_id_fk" FOREIGN KEY ("kitchen_id") REFERENCES "public"."kitchens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellations" ADD CONSTRAINT "cancellations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellations" ADD CONSTRAINT "cancellations_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellations" ADD CONSTRAINT "cancellations_kitchen_id_kitchens_id_fk" FOREIGN KEY ("kitchen_id") REFERENCES "public"."kitchens"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_kitchen_id_kitchens_id_fk" FOREIGN KEY ("kitchen_id") REFERENCES "public"."kitchens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_kitchen_id_kitchens_id_fk" FOREIGN KEY ("kitchen_id") REFERENCES "public"."kitchens"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_inventory" ADD CONSTRAINT "kitchen_inventory_kitchen_id_kitchens_id_fk" FOREIGN KEY ("kitchen_id") REFERENCES "public"."kitchens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_inventory" ADD CONSTRAINT "kitchen_inventory_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_recipes" ADD CONSTRAINT "menu_recipes_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_recipes" ADD CONSTRAINT "menu_recipes_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_kitchen_id_kitchens_id_fk" FOREIGN KEY ("kitchen_id") REFERENCES "public"."kitchens"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_timestamp_idx" ON "activities" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "brand_kitchens_kitchen_idx" ON "brand_kitchens" USING btree ("kitchen_id");--> statement-breakpoint
CREATE INDEX "cancellations_kitchen_ts_idx" ON "cancellations" USING btree ("kitchen_id","timestamp");--> statement-breakpoint
CREATE INDEX "employees_kitchen_idx" ON "employees" USING btree ("kitchen_id");--> statement-breakpoint
CREATE INDEX "inventory_movements_kitchen_ts_idx" ON "inventory_movements" USING btree ("kitchen_id","timestamp");--> statement-breakpoint
CREATE INDEX "inventory_movements_ingredient_ts_idx" ON "inventory_movements" USING btree ("ingredient_id","timestamp");--> statement-breakpoint
CREATE INDEX "inventory_movements_transfer_group_idx" ON "inventory_movements" USING btree ("transfer_group_id");--> statement-breakpoint
CREATE INDEX "kitchen_inventory_ingredient_idx" ON "kitchen_inventory" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "menu_items_brand_idx" ON "menu_items" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "order_events_order_ts_idx" ON "order_events" USING btree ("order_id","timestamp");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_kitchen_status_idx" ON "orders" USING btree ("kitchen_id","status");--> statement-breakpoint
CREATE INDEX "orders_brand_created_idx" ON "orders" USING btree ("brand_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_idempotency_key_unique" ON "orders" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "outbox_events_status_created_idx" ON "outbox_events" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "virtual_files_updated_at_idx" ON "virtual_files" USING btree ("updated_at");