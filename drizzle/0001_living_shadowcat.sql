CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"gstin" text,
	"fssai_license" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
INSERT INTO "organizations" ("id", "name", "slug", "gstin", "fssai_license", "active")
VALUES ('ORG-001', 'DarKit Hospitality Pvt. Ltd.', 'darkit-hospitality', '06AABCD4921E1Z5', '10824005001942', true)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "organization_id" text DEFAULT 'ORG-001' NOT NULL;--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "organization_id" text DEFAULT 'ORG-001' NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "organization_id" text DEFAULT 'ORG-001' NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "auth_user_id" text;--> statement-breakpoint
ALTER TABLE "kitchens" ADD COLUMN "organization_id" text DEFAULT 'ORG-001' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "organization_id" text DEFAULT 'ORG-001' NOT NULL;--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "organization_id" text DEFAULT 'ORG-001' NOT NULL;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brands" ADD CONSTRAINT "brands_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchens" ADD CONSTRAINT "kitchens_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brands_organization_idx" ON "brands" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "employees_organization_idx" ON "employees" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "kitchens_organization_idx" ON "kitchens" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "orders_org_kitchen_status_idx" ON "orders" USING btree ("organization_id","kitchen_id","status");--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_auth_user_id_unique" UNIQUE("auth_user_id");