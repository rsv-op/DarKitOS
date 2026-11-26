import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { isDemoSandboxEnabled } from "@/lib/auth";
import { closeDb } from "@/lib/db-client";
import {
  publishKitchenRealtimeEvent,
  setRealtimePublisherFetchForTesting,
} from "@/lib/realtime-publisher";
import {
  findOrLinkEmployeeByAuthIdentity,
  injectCanonicalOrder,
  resetStore,
  toggleBrandKitchenMapping,
  upsertCanonicalEmployee,
  upsertKitchen,
  upsertOrganization,
} from "@/lib/store";
import { POST as loginHandler } from "@/app/api/login/route";
import { GET as sessionHandler } from "@/app/api/session/route";
import {
  GET as getOrdersHandler,
  PATCH as patchOrdersHandler,
  POST as postOrdersHandler,
} from "@/app/api/orders/route";
import { PATCH as patchOrderStatusHandler } from "@/app/api/orders/[id]/status/route";
import {
  GET as getInventoryHandler,
  PATCH as patchInventoryHandler,
} from "@/app/api/inventory/route";
import {
  GET as getStaffHandler,
  PATCH as patchStaffHandler,
  POST as postStaffHandler,
} from "@/app/api/staff/route";
import { GET as getSystemHandler } from "@/app/api/system/route";

function makeRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
  } = {},
): NextRequest {
  const headers = new Headers(options.headers || {});
  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
  }
  if (options.cookies && Object.keys(options.cookies).length > 0) {
    const cookieHeader = Object.entries(options.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
    headers.set("cookie", cookieHeader);
  }
  return new NextRequest(url, {
    method: options.method || "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

async function loginAs(code: string): Promise<string> {
  const req = makeRequest("http://localhost:3000/api/login", {
    method: "POST",
    body: { employeeCode: code },
  });
  const res = await loginHandler(req);
  expect(res.status).toBe(200);
  const token = res.cookies.get("dark_cloud_session")?.value;
  expect(token).toBeTruthy();
  return token!;
}

async function seedSecondTenantOrg() {
  await upsertOrganization({
    id: "ORG-002",
    name: "Mumbai Cloud Kitchens LLP",
    slug: "mumbai-cloud-kitchens",
    gstin: "27AABCM9901K1Z8",
    fssaiLicense: "11524009004411",
    active: true,
  });

  await upsertKitchen({
    id: "K-ORG2-1",
    organizationId: "ORG-002",
    name: "Andheri West Cloud Unit",
    code: "BOM-01",
    location: "Andheri West, Mumbai",
    areaCode: "BOM-01",
    active: true,
    timezone: "Asia/Kolkata",
    capacityPerHour: 110,
  });

  await toggleBrandKitchenMapping("BurgerForge", "K-ORG2-1", "TEST_SETUP");

  await upsertCanonicalEmployee(
    {
      id: "EMP-ORG2-OWNER",
      organizationId: "ORG-002",
      employeeCode: "ORG2-OWNER",
      name: "Kabir Deshmukh",
      role: "OWNER",
      email: "kabir@mumbaicloud.in",
      phone: "+919820000001",
      active: true,
    },
    "TEST_SETUP",
  );

  await upsertCanonicalEmployee(
    {
      id: "EMP-ORG2-MGR",
      organizationId: "ORG-002",
      employeeCode: "ORG2-MGR",
      name: "Nisha Kulkarni",
      role: "MANAGER",
      kitchenId: "K-ORG2-1",
      email: "nisha@mumbaicloud.in",
      phone: "+919820000002",
      active: true,
    },
    "TEST_SETUP",
  );

  await injectCanonicalOrder({
    id: "ORD-ORG2-001",
    organizationId: "ORG-002",
    brandId: "BurgerForge",
    kitchenId: "K-ORG2-1",
    channel: "Swiggy",
    customerName: "Mumbai Tenant Guest",
    items: [{ menuItemId: "MENU-BF-01", quantity: 1 }],
    actor: "ORG2-OWNER (Kabir Deshmukh)",
  });
}

describe("Sprint 2 — Multi-Tenant RBAC, Immediate Revocation & Realtime Broadcasts", () => {
  const savedEnv = {
    NODE_ENV: process.env.NODE_ENV,
    DEMO_SANDBOX_MODE: process.env.DEMO_SANDBOX_MODE,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  beforeEach(async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    process.env.DEMO_SANDBOX_MODE = "true";
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    setRealtimePublisherFetchForTesting(null);
    await resetStore();
  });

  afterEach(() => {
    setRealtimePublisherFetchForTesting(null);
    (process.env as Record<string, string | undefined>).NODE_ENV =
      savedEnv.NODE_ENV;
    if (savedEnv.DEMO_SANDBOX_MODE === undefined) {
      delete process.env.DEMO_SANDBOX_MODE;
    } else {
      process.env.DEMO_SANDBOX_MODE = savedEnv.DEMO_SANDBOX_MODE;
    }
    if (savedEnv.NEXT_PUBLIC_SUPABASE_URL === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = savedEnv.NEXT_PUBLIC_SUPABASE_URL;
    }
    if (savedEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
        savedEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    }
    if (savedEnv.SUPABASE_SERVICE_ROLE_KEY === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY =
        savedEnv.SUPABASE_SERVICE_ROLE_KEY;
    }
  });

  afterAll(async () => {
    await closeDb();
  });

  it("1. Enforces strict cross-organization isolation across orders, inventory, staff, and system endpoints", async () => {
    await seedSecondTenantOrg();

    const org1OwnerJwt = await loginAs("OWNER-01");
    const org2OwnerJwt = await loginAs("ORG2-OWNER");

    // ORG-001 OWNER list reads must NEVER leak ORG-002 orders, kitchens, inventory, or staff
    const org1OrdersRes = await getOrdersHandler(
      makeRequest("http://localhost:3000/api/orders", {
        cookies: { dark_cloud_session: org1OwnerJwt },
      }),
    );
    expect(org1OrdersRes.status).toBe(200);
    const org1OrdersData = await org1OrdersRes.json();
    expect(
      org1OrdersData.orders.some(
        (o: { id: string }) => o.id === "ORD-ORG2-001",
      ),
    ).toBe(false);

    const org1StaffRes = await getStaffHandler(
      makeRequest("http://localhost:3000/api/staff", {
        cookies: { dark_cloud_session: org1OwnerJwt },
      }),
    );
    expect(org1StaffRes.status).toBe(200);
    const org1StaffData = await org1StaffRes.json();
    expect(
      org1StaffData.employees.some(
        (e: { organizationId: string }) => e.organizationId === "ORG-002",
      ),
    ).toBe(false);

    const org2SystemRes = await getSystemHandler(
      makeRequest("http://localhost:3000/api/system", {
        cookies: { dark_cloud_session: org2OwnerJwt },
      }),
    );
    expect(org2SystemRes.status).toBe(200);
    const org2SystemData = await org2SystemRes.json();
    expect(org2SystemData.orders.map((o: { id: string }) => o.id)).toEqual([
      "ORD-ORG2-001",
    ]);
    expect(
      org2SystemData.inventory.every(
        (i: { kitchenId: string }) => i.kitchenId === "K-ORG2-1",
      ),
    ).toBe(true);

    // Explicit cross-org reads/writes by ORG-001 OWNER against ORG-002 must return 403 Forbidden
    const crossOrderGet = await getOrdersHandler(
      makeRequest("http://localhost:3000/api/orders?kitchenId=K-ORG2-1", {
        cookies: { dark_cloud_session: org1OwnerJwt },
      }),
    );
    expect(crossOrderGet.status).toBe(403);

    const crossOrderInject = await postOrdersHandler(
      makeRequest("http://localhost:3000/api/orders", {
        method: "POST",
        cookies: { dark_cloud_session: org1OwnerJwt },
        body: {
          brandId: "BurgerForge",
          kitchenId: "K-ORG2-1",
          channel: "Swiggy",
          items: [{ menuItemId: "MENU-BF-01", quantity: 1 }],
        },
      }),
    );
    expect(crossOrderInject.status).toBe(403);

    const crossOrderPatch = await patchOrdersHandler(
      makeRequest("http://localhost:3000/api/orders", {
        method: "PATCH",
        cookies: { dark_cloud_session: org1OwnerJwt },
        body: { orderId: "ORD-ORG2-001", action: "PREPARING" },
      }),
    );
    expect(crossOrderPatch.status).toBe(403);

    const crossStatusPatch = await patchOrderStatusHandler(
      makeRequest("http://localhost:3000/api/orders/ORD-ORG2-001/status", {
        method: "PATCH",
        cookies: { dark_cloud_session: org1OwnerJwt },
        body: { status: "PREPARING" },
      }),
      { params: { id: "ORD-ORG2-001" } },
    );
    expect(crossStatusPatch.status).toBe(403);

    const crossInvGet = await getInventoryHandler(
      makeRequest("http://localhost:3000/api/inventory?kitchenId=K-ORG2-1", {
        cookies: { dark_cloud_session: org1OwnerJwt },
      }),
    );
    expect(crossInvGet.status).toBe(403);

    const crossInvTransfer = await patchInventoryHandler(
      makeRequest("http://localhost:3000/api/inventory", {
        method: "PATCH",
        cookies: { dark_cloud_session: org1OwnerJwt },
        body: {
          id: "INV-001",
          action: "TRANSFER",
          fromKitchenId: "K1",
          toKitchenId: "K-ORG2-1",
          quantity: 5,
        },
      }),
    );
    expect(crossInvTransfer.status).toBe(403);

    const crossStaffPatch = await patchStaffHandler(
      makeRequest("http://localhost:3000/api/staff", {
        method: "PATCH",
        cookies: { dark_cloud_session: org1OwnerJwt },
        body: { employeeCode: "ORG2-MGR", active: false },
      }),
    );
    expect(crossStaffPatch.status).toBe(403);
  });

  it("2. Enforces kitchen isolation within the same org while allowing OWNER access across all own-org kitchens", async () => {
    const ownerJwt = await loginAs("OWNER-01");
    const k1MgrJwt = await loginAs("0001"); // K1 MANAGER
    const k1CookJwt = await loginAs("2001"); // K1 LINE_COOK

    // K1 MANAGER cannot read or mutate K2 inventory or K2 staff
    const mgrK2Inv = await getInventoryHandler(
      makeRequest("http://localhost:3000/api/inventory?kitchenId=K2", {
        cookies: { dark_cloud_session: k1MgrJwt },
      }),
    );
    expect(mgrK2Inv.status).toBe(403);

    const mgrK2InvAdjust = await patchInventoryHandler(
      makeRequest("http://localhost:3000/api/inventory", {
        method: "PATCH",
        cookies: { dark_cloud_session: k1MgrJwt },
        body: { id: "INV-001", kitchenId: "K2", action: "RESTOCK", quantity: 10 },
      }),
    );
    expect(mgrK2InvAdjust.status).toBe(403);

    const mgrK2StaffPatch = await patchStaffHandler(
      makeRequest("http://localhost:3000/api/staff", {
        method: "PATCH",
        cookies: { dark_cloud_session: k1MgrJwt },
        body: { employeeCode: "2002", active: false }, // K2 cook
      }),
    );
    expect(mgrK2StaffPatch.status).toBe(403);

    // K1 LINE_COOK cannot access /api/staff at all
    const cookStaffGet = await getStaffHandler(
      makeRequest("http://localhost:3000/api/staff", {
        cookies: { dark_cloud_session: k1CookJwt },
      }),
    );
    expect(cookStaffGet.status).toBe(403);

    // ORG-001 OWNER CAN access both K1 and K2
    const ownerK1Inv = await getInventoryHandler(
      makeRequest("http://localhost:3000/api/inventory?kitchenId=K1", {
        cookies: { dark_cloud_session: ownerJwt },
      }),
    );
    const ownerK2Inv = await getInventoryHandler(
      makeRequest("http://localhost:3000/api/inventory?kitchenId=K2", {
        cookies: { dark_cloud_session: ownerJwt },
      }),
    );
    expect(ownerK1Inv.status).toBe(200);
    expect(ownerK2Inv.status).toBe(200);

    // OWNER can provision a new staff member in K2 via POST /api/staff and link Supabase auth_user_id on first login
    const createStaffRes = await postStaffHandler(
      makeRequest("http://localhost:3000/api/staff", {
        method: "POST",
        cookies: { dark_cloud_session: ownerJwt },
        body: {
          name: "Meera Joshi",
          employeeCode: "2099",
          email: "meera.k2@darkit.in",
          phone: "+919811112099",
          role: "LINE_COOK",
          kitchenId: "K2",
        },
      }),
    );
    expect(createStaffRes.status).toBe(201);

    const linked = await findOrLinkEmployeeByAuthIdentity({
      authUserId: "00000000-0000-4000-8000-000000002099",
      email: "MEERA.K2@darkit.in",
    });
    expect(linked).not.toBeNull();
    expect(linked?.employeeCode).toBe("2099");
    expect(linked?.authUserId).toBe("00000000-0000-4000-8000-000000002099");
  });

  it("3. Immediately revokes active sessions with 403 Forbidden when an employee is deactivated", async () => {
    const ownerJwt = await loginAs("OWNER-01");
    const cookJwt = await loginAs("2001"); // K1 LINE_COOK

    // Active cook can read K1 orders
    const beforeRes = await getOrdersHandler(
      makeRequest("http://localhost:3000/api/orders", {
        cookies: { dark_cloud_session: cookJwt },
      }),
    );
    expect(beforeRes.status).toBe(200);

    // OWNER deactivates 2001 via PATCH /api/staff
    const deactivateRes = await patchStaffHandler(
      makeRequest("http://localhost:3000/api/staff", {
        method: "PATCH",
        cookies: { dark_cloud_session: ownerJwt },
        body: { employeeCode: "2001", active: false },
      }),
    );
    expect(deactivateRes.status).toBe(200);

    // Cook's existing still-valid JWT cookie is IMMEDIATELY rejected with 403 across all routes
    const afterOrders = await getOrdersHandler(
      makeRequest("http://localhost:3000/api/orders", {
        cookies: { dark_cloud_session: cookJwt },
      }),
    );
    expect(afterOrders.status).toBe(403);

    const afterMutate = await patchOrdersHandler(
      makeRequest("http://localhost:3000/api/orders", {
        method: "PATCH",
        cookies: { dark_cloud_session: cookJwt },
        body: { orderId: "ORD-901", action: "PREPARING" },
      }),
    );
    expect(afterMutate.status).toBe(403);

    const afterInventory = await getInventoryHandler(
      makeRequest("http://localhost:3000/api/inventory", {
        cookies: { dark_cloud_session: cookJwt },
      }),
    );
    expect(afterInventory.status).toBe(403);

    const afterSystem = await getSystemHandler(
      makeRequest("http://localhost:3000/api/system", {
        cookies: { dark_cloud_session: cookJwt },
      }),
    );
    expect(afterSystem.status).toBe(403);

    const afterSession = await sessionHandler(
      makeRequest("http://localhost:3000/api/session", {
        cookies: { dark_cloud_session: cookJwt },
      }),
    );
    expect(afterSession.status).toBe(403);
  });

  it("4. Locks out demo quick-login/PINs in strict production mode and fails closed with 503 if Supabase is unconfigured", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.DEMO_SANDBOX_MODE;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(isDemoSandboxEnabled()).toBe(false);

    // Demo employeeCode login MUST be rejected with 403
    const demoCodeRes = await loginHandler(
      makeRequest("http://localhost:3000/api/login", {
        method: "POST",
        body: { employeeCode: "OWNER-01" },
      }),
    );
    expect(demoCodeRes.status).toBe(403);

    // Demo shift PIN login MUST be rejected with 403
    const demoPinRes = await loginHandler(
      makeRequest("http://localhost:3000/api/login", {
        method: "POST",
        body: { pin: "3333" },
      }),
    );
    expect(demoPinRes.status).toBe(403);

    // Email/Password and OTP login MUST fail closed with 503 when Supabase env vars are missing
    const pwdRes = await loginHandler(
      makeRequest("http://localhost:3000/api/login", {
        method: "POST",
        body: {
          mode: "password",
          email: "owner@darkit.in",
          password: "password123",
        },
      }),
    );
    expect(pwdRes.status).toBe(503);
    const pwdData = await pwdRes.json();
    expect(pwdData.error).toContain("Auth provider not configured");

    const otpRes = await loginHandler(
      makeRequest("http://localhost:3000/api/login", {
        method: "POST",
        body: {
          mode: "otp_request",
          email: "owner@darkit.in",
        },
      }),
    );
    expect(otpRes.status).toBe(503);

    // Unauthenticated API calls MUST fail closed with 401 (never silently auto-login as OWNER-01)
    const unauthOrders = await getOrdersHandler(
      makeRequest("http://localhost:3000/api/orders"),
    );
    expect(unauthOrders.status).toBe(401);
  });

  it("5. Publishes Realtime broadcast payloads safely (no-op without env vars; exact topic & payload contract when configured)", async () => {
    // 5a. Graceful no-op when Supabase env vars are absent
    const noopResult = await publishKitchenRealtimeEvent({
      type: "ORDER_CREATED",
      organizationId: "ORG-001",
      kitchenId: "K1",
      orderId: "ORD-TEST-1",
      status: "PENDING",
    });
    expect(noopResult.delivered).toBe(false);
    expect(noopResult.skippedReason).toBe("UNCONFIGURED");
    expect(noopResult.topics).toEqual([
      "org:ORG-001:kitchen:K1",
      "org:ORG-001:all",
    ]);

    // 5b. Exact Supabase Realtime Broadcast contract when configured
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://darkit-demo.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

    const calls: { url: string; headers: Record<string, string>; body: unknown }[] =
      [];
    setRealtimePublisherFetchForTesting(async (input, init) => {
      const headersRecord: Record<string, string> = {};
      if (init?.headers && typeof init.headers === "object") {
        for (const [k, v] of Object.entries(
          init.headers as Record<string, string>,
        )) {
          headersRecord[k] = String(v);
        }
      }
      calls.push({
        url: String(input),
        headers: headersRecord,
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return new Response(JSON.stringify({ ok: true }), { status: 202 });
    });

    // Trigger via canonical order injection to confirm store -> realtime publisher integration
    await injectCanonicalOrder({
      id: "ORD-RT-501",
      brandId: "TacoMatrix",
      kitchenId: "K1",
      channel: "Zomato",
      items: [{ menuItemId: "MENU-TM-01", quantity: 1 }],
      actor: "OWNER-01 (Patric Revuelto)",
    });

    expect(calls.length).toBeGreaterThanOrEqual(1);
    const createdCall = calls[0];
    expect(createdCall.url).toBe(
      "https://darkit-demo.supabase.co/realtime/v1/api/broadcast",
    );
    expect(createdCall.headers.apikey).toBe("test-service-role-key");
    expect(createdCall.headers.Authorization).toBe(
      "Bearer test-service-role-key",
    );

    const parsedBody = createdCall.body as {
      messages: {
        topic: string;
        event: string;
        payload: {
          type: string;
          organizationId: string;
          kitchenId: string;
          orderId: string;
        };
      }[];
    };
    expect(parsedBody.messages).toHaveLength(2);
    expect(parsedBody.messages.map((m) => m.topic)).toEqual([
      "org:ORG-001:kitchen:K1",
      "org:ORG-001:all",
    ]);
    expect(parsedBody.messages[0].event).toBe("ORDER_CREATED");
    expect(parsedBody.messages[0].payload.orderId).toBe("ORD-RT-501");
    expect(parsedBody.messages[0].payload.organizationId).toBe("ORG-001");
    expect(parsedBody.messages[0].payload.kitchenId).toBe("K1");
  });
});
