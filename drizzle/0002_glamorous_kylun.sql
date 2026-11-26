CREATE TABLE "payment_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text DEFAULT 'ORG-001' NOT NULL,
	"kitchen_id" text NOT NULL,
	"order_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_order_id" text,
	"provider_payment_id" text,
	"provider_refund_id" text,
	"webhook_event_id" text,
	"amount" numeric(12, 2) NOT NULL,
	"refunded_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"status" text NOT NULL,
	"method" text,
	"raw_meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_transactions_provider_order_id_unique" UNIQUE("provider_order_id"),
	CONSTRAINT "payment_transactions_provider_payment_id_unique" UNIQUE("provider_payment_id"),
	CONSTRAINT "payment_transactions_provider_refund_id_unique" UNIQUE("provider_refund_id"),
	CONSTRAINT "payment_transactions_webhook_event_id_unique" UNIQUE("webhook_event_id")
);
--> statement-breakpoint
CREATE TABLE "tax_invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text DEFAULT 'ORG-001' NOT NULL,
	"kitchen_id" text NOT NULL,
	"order_id" text NOT NULL,
	"invoice_number" text NOT NULL,
	"financial_year" text NOT NULL,
	"sequence_number" integer NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"seller_gstin" text NOT NULL,
	"seller_fssai" text NOT NULL,
	"seller_state_code" text NOT NULL,
	"place_of_supply_state_code" text NOT NULL,
	"customer_name" text,
	"customer_gstin" text,
	"taxable_subtotal" numeric(12, 2) NOT NULL,
	"packaging_fee" numeric(12, 2) DEFAULT '0' NOT NULL,
	"cgst_rate" numeric(5, 2) NOT NULL,
	"cgst_amount" numeric(12, 2) NOT NULL,
	"sgst_rate" numeric(5, 2) NOT NULL,
	"sgst_amount" numeric(12, 2) NOT NULL,
	"igst_rate" numeric(5, 2) NOT NULL,
	"igst_amount" numeric(12, 2) NOT NULL,
	"total_tax" numeric(12, 2) NOT NULL,
	"grand_total" numeric(12, 2) NOT NULL,
	"status" text DEFAULT 'ISSUED' NOT NULL,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tax_invoices_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "tax_invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
ALTER TABLE "kitchens" ADD COLUMN "state_code" text DEFAULT '06' NOT NULL;--> statement-breakpoint
ALTER TABLE "kitchens" ADD COLUMN "gstin" text;--> statement-breakpoint
ALTER TABLE "kitchens" ADD COLUMN "fssai_license" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "subtotal_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "packaging_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cgst_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "sgst_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "igst_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tax_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_status" text DEFAULT 'AGGREGATOR_SETTLED' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "invoice_id" text;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_kitchen_id_kitchens_id_fk" FOREIGN KEY ("kitchen_id") REFERENCES "public"."kitchens"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_invoices" ADD CONSTRAINT "tax_invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_invoices" ADD CONSTRAINT "tax_invoices_kitchen_id_kitchens_id_fk" FOREIGN KEY ("kitchen_id") REFERENCES "public"."kitchens"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_invoices" ADD CONSTRAINT "tax_invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_transactions_order_idx" ON "payment_transactions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payment_transactions_org_kitchen_idx" ON "payment_transactions" USING btree ("organization_id","kitchen_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_invoices_org_fy_kitchen_seq_uidx" ON "tax_invoices" USING btree ("organization_id","financial_year","kitchen_id","sequence_number");--> statement-breakpoint
CREATE INDEX "tax_invoices_org_kitchen_issued_idx" ON "tax_invoices" USING btree ("organization_id","kitchen_id","issued_at");