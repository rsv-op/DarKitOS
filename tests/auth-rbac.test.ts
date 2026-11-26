import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { isSafeRedirectPath } from "@/lib/auth";
import { closeDb } from "@/lib/db-client";
import { resetStore } from "@/lib/store";
import {
  DELETE as logoutHandler,
  POST as loginHandler,
} from "@/app/api/login/route";
import { GET as sessionHandler } from "@/app/api/session/route";
import {
  GET as getOrdersHandler,
  PATCH as patchOrdersHandler,
  POST as postOrdersHandler,
} from "@/app/api/orders/route";
import { PATCH as patchOrderStatusHandler } from "@/app/api/orders/[id]/status/route";
import {
  GET as getSystemHandler,
  PATCH as patchSystemHandler,
} from "@/app/api/system/route";

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

describe("Auth, Logout & Server-Side RBAC Security", () => {
  beforeEach(async () => {
    process.env.DEMO_SANDBOX_MODE = "true";
    await resetStore();
  });

  afterAll(async () => {
    await closeDb();
  });

  it("blocks open redirect URLs in isSafeRedirectPath", () => {
    expect(isSafeRedirectPath("/dashboard")).toBe(true);
    expect(isSafeRedirectPath("/kds?kitchen=K1")).toBe(true);
    expect(isSafeRedirectPath("//evil.example/phish")).toBe(false);
    expect(isSafeRedirectPath("https://evil.example")).toBe(false);
    expect(isSafeRedirectPath("/\\evil.example")).toBe(false);
    expect(isSafeRedirectPath("/login")).toBe(false);
  });

  it("sanitizes redirect on POST /api/login and never leaks plaintext PINs", async () => {
    const res = await loginHandler(
      makeRequest("http://localhost:3000/api/login", {
        method: "POST",
        body: {
          employeeCode: "OWNER-01",
          redirect: "//evil.example/phish",
        },
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.redirectTo).toBe("/dashboard");
    expect(data.employee.pin).toBeUndefined();
    expect(JSON.stringify(data)).not.toContain('"pin"');
  });

  it("actually logs out on DELETE /api/login so GET /api/session returns unauthenticated", async () => {
    const ownerJwt = await loginAs("OWNER-01");
    const logoutRes = await logoutHandler(
      makeRequest("http://localhost:3000/api/login", { method: "DELETE" }),
    );
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.cookies.get("dark_cloud_logged_out")?.value).toBe("1");
    expect(logoutRes.cookies.get("dark_cloud_session")?.value).toBe("");

    const sessionRes = await sessionHandler(
      makeRequest("http://localhost:3000/api/session", {
        cookies: {
          dark_cloud_session: ownerJwt,
          dark_cloud_logged_out: "1",
        },
      }),
    );
    const sessionData = await sessionRes.json();
    expect(sessionData.authenticated).toBe(false);
    expect(sessionData.employee).toBeNull();
  });

  it("rejects spoofed x-employee-code headers, unsigned employee_code cookies, and legacy_role_token", async () => {
    process.env.DEMO_SANDBOX_MODE = "false";

    const spoofHeader = await getOrdersHandler(
      makeRequest("http://localhost:3000/api/orders", {
        headers: { "x-employee-code": "OWNER-01" },
      }),
    );
    expect(spoofHeader.status).toBe(401);

    const unsignedCookie = await getOrdersHandler(
      makeRequest("http://localhost:3000/api/orders", {
        cookies: { employee_code: "OWNER-01" },
      }),
    );
    expect(unsignedCookie.status).toBe(401);

    const forgedLegacy = await getOrdersHandler(
      makeRequest("http://localhost:3000/api/orders", {
        cookies: { dark_cloud_session: "legacy_role_token:owner" },
      }),
    );
    expect(forgedLegacy.status).toBe(401);
  });

  it("blocks LINE_COOK from injecting orders, cancelling, mutating system, or crossing kitchens", async () => {
    const cookJwt = await loginAs("2001"); // K1 LINE_COOK

    const injectRes = await postOrdersHandler(
      makeRequest("http://localhost:3000/api/orders", {
        method: "POST",
        cookies: { dark_cloud_session: cookJwt },
        body: {
          brandId: "BurgerForge",
          kitchenId: "K1",
          channel: "Swiggy",
          items: [{ menuItemId: "MENU-BF-01", quantity: 1 }],
        },
      }),
    );
    expect(injectRes.status).toBe(403);

    for (const payload of [
      { action: "CLEAR_ORDERS" },
      { action: "RESET_STORE" },
      { action: "UPDATE_SETTINGS", settings: { currency: "USD" } },
      { action: "UPSERT_FILE", file: { name: "hack.md" } },
      { action: "DELETE_FILE", fileId: "FILE-ADR-001" },
    ]) {
      const sysRes = await patchSystemHandler(
        makeRequest("http://localhost:3000/api/system", {
          method: "PATCH",
          cookies: { dark_cloud_session: cookJwt },
          body: payload,
        }),
      );
      expect(sysRes.status).toBe(403);
    }

    const cancelRes = await patchOrderStatusHandler(
      makeRequest("http://localhost:3000/api/orders/ORD-901/status", {
        method: "PATCH",
        cookies: { dark_cloud_session: cookJwt },
        body: { status: "CANCELLED" },
      }),
      { params: { id: "ORD-901" } },
    );
    expect(cancelRes.status).toBe(403);

    const listRes = await getOrdersHandler(
      makeRequest("http://localhost:3000/api/orders?kitchenId=K2", {
        cookies: { dark_cloud_session: cookJwt },
      }),
    );
    const listData = await listRes.json();
    expect(listRes.status).toBe(200);
    expect(
      listData.orders.every((o: { kitchenId: string }) => o.kitchenId === "K1"),
    ).toBe(true);

    const crossKitchenRes = await patchOrdersHandler(
      makeRequest("http://localhost:3000/api/orders", {
        method: "PATCH",
        cookies: { dark_cloud_session: cookJwt },
        body: { orderId: "ORD-905", action: "PREPARING" },
      }),
    );
    expect(crossKitchenRes.status).toBe(403);

    const sysGetRes = await getSystemHandler(
      makeRequest("http://localhost:3000/api/system", {
        cookies: { dark_cloud_session: cookJwt },
      }),
    );
    const sysData = await sysGetRes.json();
    expect(sysData.leakageVectors).toEqual([]);
    expect(sysData.employees).toHaveLength(1);
    expect(sysData.employees[0].employeeCode).toBe("2001");
    expect(
      sysData.inventory.every(
        (i: { kitchenId: string }) => i.kitchenId === "K1",
      ),
    ).toBe(true);
  });

  it("blocks DISPATCH from cancelling orders and blocks K1 MANAGER from K2 injection or global resets", async () => {
    const dispatchJwt = await loginAs("3001"); // K1 DISPATCH
    const dispCancel = await patchOrdersHandler(
      makeRequest("http://localhost:3000/api/orders", {
        method: "PATCH",
        cookies: { dark_cloud_session: dispatchJwt },
        body: { orderId: "ORD-906", action: "CANCELLED" },
      }),
    );
    expect(dispCancel.status).toBe(403);

    const mgrJwt = await loginAs("0001"); // K1 MANAGER
    const crossInject = await postOrdersHandler(
      makeRequest("http://localhost:3000/api/orders", {
        method: "POST",
        cookies: { dark_cloud_session: mgrJwt },
        body: {
          brandId: "BurgerForge",
          kitchenId: "K2",
          channel: "Swiggy",
          items: [{ menuItemId: "MENU-BF-01", quantity: 1 }],
        },
      }),
    );
    expect(crossInject.status).toBe(403);

    const mgrReset = await patchSystemHandler(
      makeRequest("http://localhost:3000/api/system", {
        method: "PATCH",
        cookies: { dark_cloud_session: mgrJwt },
        body: { action: "RESET_STORE" },
      }),
    );
    expect(mgrReset.status).toBe(403);
  });
});
