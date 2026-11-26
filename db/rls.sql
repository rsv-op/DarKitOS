-- =============================================================================
-- DarKitOS — Multi-Tenant PostgreSQL Row Level Security (RLS) Baseline
-- =============================================================================
-- Safe to run repeatedly (idempotent) on both Supabase PostgreSQL and vanilla
-- PostgreSQL 16 (CI). Table owners / Drizzle server connections bypass RLS
-- (ENABLE without FORCE) while authenticated Supabase JWT roles are strictly
-- isolated by organization_id via auth.uid().
-- =============================================================================

-- 1. Vanilla PostgreSQL 16 compatibility shim (no-op on Supabase where auth.uid() exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    CREATE SCHEMA auth;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid' AND p.pronargs = 0
  ) THEN
    CREATE FUNCTION auth.uid()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    AS $fn$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $fn$;
  END IF;
END
$$;

-- 2. SECURITY DEFINER tenant lookup helpers (prevent self-recursion on employees RLS)
CREATE OR REPLACE FUNCTION public.darkit_current_org_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.organization_id
  FROM public.employees e
  WHERE e.auth_user_id = auth.uid()::text
    AND e.active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.darkit_current_kitchen_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.kitchen_id
  FROM public.employees e
  WHERE e.auth_user_id = auth.uid()::text
    AND e.active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.darkit_is_org_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.auth_user_id = auth.uid()::text
      AND e.active = true
      AND e.role = 'OWNER'
  );
$$;

-- 3. Enable Row Level Security on all core tenant operational tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cancellations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aggregator_sku_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;

-- 4. Organizations tenant policy
DROP POLICY IF EXISTS darkit_organizations_tenant_isolation ON public.organizations;
CREATE POLICY darkit_organizations_tenant_isolation
  ON public.organizations
  FOR ALL
  USING (
    auth.uid() IS NOT NULL
    AND id = public.darkit_current_org_id()
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND id = public.darkit_current_org_id()
  );

-- 5. Kitchens tenant policy
DROP POLICY IF EXISTS darkit_kitchens_tenant_isolation ON public.kitchens;
CREATE POLICY darkit_kitchens_tenant_isolation
  ON public.kitchens
  FOR ALL
  USING (
    auth.uid() IS NOT NULL
    AND organization_id = public.darkit_current_org_id()
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND organization_id = public.darkit_current_org_id()
  );

-- 6. Brands tenant policy
DROP POLICY IF EXISTS darkit_brands_tenant_isolation ON public.brands;
CREATE POLICY darkit_brands_tenant_isolation
  ON public.brands
  FOR ALL
  USING (
    auth.uid() IS NOT NULL
    AND organization_id = public.darkit_current_org_id()
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND organization_id = public.darkit_current_org_id()
  );

-- 7. Employees tenant policy
DROP POLICY IF EXISTS darkit_employees_tenant_isolation ON public.employees;
CREATE POLICY darkit_employees_tenant_isolation
  ON public.employees
  FOR ALL
  USING (
    auth.uid() IS NOT NULL
    AND (
      auth_user_id = auth.uid()::text
      OR organization_id = public.darkit_current_org_id()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND organization_id = public.darkit_current_org_id()
  );

-- 8. Per-kitchen inventory tenant + kitchen isolation policy
DROP POLICY IF EXISTS darkit_kitchen_inventory_tenant_isolation ON public.kitchen_inventory;
CREATE POLICY darkit_kitchen_inventory_tenant_isolation
  ON public.kitchen_inventory
  FOR ALL
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.kitchens k
      WHERE k.id = kitchen_inventory.kitchen_id
        AND k.organization_id = public.darkit_current_org_id()
    )
    AND (
      public.darkit_is_org_owner()
      OR kitchen_id = public.darkit_current_kitchen_id()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.kitchens k
      WHERE k.id = kitchen_inventory.kitchen_id
        AND k.organization_id = public.darkit_current_org_id()
    )
    AND (
      public.darkit_is_org_owner()
      OR kitchen_id = public.darkit_current_kitchen_id()
    )
  );

-- 9. Orders tenant + kitchen isolation policy
DROP POLICY IF EXISTS darkit_orders_tenant_isolation ON public.orders;
CREATE POLICY darkit_orders_tenant_isolation
  ON public.orders
  FOR ALL
  USING (
    auth.uid() IS NOT NULL
    AND organization_id = public.darkit_current_org_id()
    AND (
      public.darkit_is_org_owner()
      OR kitchen_id = public.darkit_current_kitchen_id()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND organization_id = public.darkit_current_org_id()
    AND (
      public.darkit_is_org_owner()
      OR kitchen_id = public.darkit_current_kitchen_id()
    )
  );

-- 10. Cancellations tenant + kitchen isolation policy
DROP POLICY IF EXISTS darkit_cancellations_tenant_isolation ON public.cancellations;
CREATE POLICY darkit_cancellations_tenant_isolation
  ON public.cancellations
  FOR ALL
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.kitchens k
      WHERE k.id = cancellations.kitchen_id
        AND k.organization_id = public.darkit_current_org_id()
    )
    AND (
      public.darkit_is_org_owner()
      OR kitchen_id = public.darkit_current_kitchen_id()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.kitchens k
      WHERE k.id = cancellations.kitchen_id
        AND k.organization_id = public.darkit_current_org_id()
    )
    AND (
      public.darkit_is_org_owner()
      OR kitchen_id = public.darkit_current_kitchen_id()
    )
  );

-- 11. Operational activities tenant + kitchen isolation policy
DROP POLICY IF EXISTS darkit_activities_tenant_isolation ON public.activities;
CREATE POLICY darkit_activities_tenant_isolation
  ON public.activities
  FOR ALL
  USING (
    auth.uid() IS NOT NULL
    AND organization_id = public.darkit_current_org_id()
    AND (
      public.darkit_is_org_owner()
      OR kitchen_id IS NULL
      OR kitchen_id = public.darkit_current_kitchen_id()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND organization_id = public.darkit_current_org_id()
  );

-- 12. Tax invoices tenant + kitchen isolation policy
DROP POLICY IF EXISTS darkit_tax_invoices_tenant_isolation ON public.tax_invoices;
CREATE POLICY darkit_tax_invoices_tenant_isolation
  ON public.tax_invoices
  FOR ALL
  USING (
    auth.uid() IS NOT NULL
    AND organization_id = public.darkit_current_org_id()
    AND (
      public.darkit_is_org_owner()
      OR kitchen_id = public.darkit_current_kitchen_id()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND organization_id = public.darkit_current_org_id()
    AND (
      public.darkit_is_org_owner()
      OR kitchen_id = public.darkit_current_kitchen_id()
    )
  );

-- 13. Payment transactions tenant + kitchen isolation policy
DROP POLICY IF EXISTS darkit_payment_transactions_tenant_isolation ON public.payment_transactions;
CREATE POLICY darkit_payment_transactions_tenant_isolation
  ON public.payment_transactions
  FOR ALL
  USING (
    auth.uid() IS NOT NULL
    AND organization_id = public.darkit_current_org_id()
    AND (
      public.darkit_is_org_owner()
      OR kitchen_id = public.darkit_current_kitchen_id()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND organization_id = public.darkit_current_org_id()
    AND (
      public.darkit_is_org_owner()
      OR kitchen_id = public.darkit_current_kitchen_id()
    )
  );

-- 14. Aggregator SKU mappings tenant + kitchen isolation policy
DROP POLICY IF EXISTS darkit_aggregator_sku_mappings_tenant_isolation ON public.aggregator_sku_mappings;
CREATE POLICY darkit_aggregator_sku_mappings_tenant_isolation
  ON public.aggregator_sku_mappings
  FOR ALL
  USING (
    auth.uid() IS NOT NULL
    AND organization_id = public.darkit_current_org_id()
    AND (
      public.darkit_is_org_owner()
      OR kitchen_id = public.darkit_current_kitchen_id()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND organization_id = public.darkit_current_org_id()
    AND (
      public.darkit_is_org_owner()
      OR kitchen_id = public.darkit_current_kitchen_id()
    )
  );

-- 15. WhatsApp notification logs tenant + kitchen isolation policy
DROP POLICY IF EXISTS darkit_whatsapp_logs_tenant_isolation ON public.whatsapp_notification_logs;
CREATE POLICY darkit_whatsapp_logs_tenant_isolation
  ON public.whatsapp_notification_logs
  FOR ALL
  USING (
    auth.uid() IS NOT NULL
    AND organization_id = public.darkit_current_org_id()
    AND (
      public.darkit_is_org_owner()
      OR kitchen_id IS NULL
      OR kitchen_id = public.darkit_current_kitchen_id()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND organization_id = public.darkit_current_org_id()
  );

-- 16. Transactional outbox events tenant + kitchen isolation policy
DROP POLICY IF EXISTS darkit_outbox_events_tenant_isolation ON public.outbox_events;
CREATE POLICY darkit_outbox_events_tenant_isolation
  ON public.outbox_events
  FOR ALL
  USING (
    auth.uid() IS NOT NULL
    AND organization_id = public.darkit_current_org_id()
    AND (
      public.darkit_is_org_owner()
      OR kitchen_id IS NULL
      OR kitchen_id = public.darkit_current_kitchen_id()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND organization_id = public.darkit_current_org_id()
  );
