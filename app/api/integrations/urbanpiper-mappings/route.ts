import { NextRequest, NextResponse } from "next/server";
import type { AggregatorChannel, DbaBrand } from "@/lib/db";
import { requireAuthenticatedEmployee } from "@/lib/domain/auth-service";
import {
  canAccessKitchen,
  canAccessOrganization,
  hasPermission,
} from "@/lib/domain/permission-service";
import { processOutboxQueue } from "@/lib/outbox-dispatcher";
import {
  getAggregatorSkuMappings,
  getBrands,
  getKitchens,
  getMenuCatalog,
  getOutboxEvents,
  getWhatsAppLogs,
  retryOutboxEvent,
  toggleAggregatorSkuMapping,
  upsertAggregatorSkuMapping,
} from "@/lib/store";
import { isUrbanPiperLiveConfigured } from "@/lib/urbanpiper";
import { resolveWhatsAppProvider, runDailyOwnerInrDigest } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

const ALLOWED_CHANNELS = new Set<AggregatorChannel>([
  "SWIGGY",
  "ZOMATO",
  "ALL",
]);

async function requireOwnerView(request: NextRequest) {
  const auth = await requireAuthenticatedEmployee(request);
  if (!auth.ok) return auth;
  if (!hasPermission(auth.employee, "OWNER_VIEW")) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Forbidden: OWNER_VIEW permission required." },
        { status: 403 },
      ),
    };
  }
  return auth;
}

export async function GET(request: NextRequest) {
  const auth = await requireOwnerView(request);
  if (!auth.ok) return auth.response;
  const employee = auth.employee;

  const { searchParams } = new URL(request.url);
  const kitchenFilter = searchParams.get("kitchenId") || undefined;

  const [mappings, outboxEvents, whatsappLogs, kitchens, brands, menuCatalog] =
    await Promise.all([
      getAggregatorSkuMappings({
        organizationId: employee.organizationId,
        kitchenId: kitchenFilter,
      }),
      getOutboxEvents({
        organizationId: employee.organizationId,
        kitchenId: kitchenFilter,
      }),
      getWhatsAppLogs({
        organizationId: employee.organizationId,
        kitchenId: kitchenFilter,
      }),
      getKitchens(),
      getBrands(),
      getMenuCatalog(),
    ]);

  const orgKitchens = kitchens.filter(
    (k) =>
      canAccessOrganization(employee, k.organizationId) &&
      canAccessKitchen(employee, k.id),
  );
  const allowedKitchenIds = new Set(orgKitchens.map((k) => k.id));

  const scopedMappings = mappings.filter((m) =>
    allowedKitchenIds.has(m.kitchenId),
  );
  const scopedOutbox = outboxEvents.filter(
    (e) => !e.kitchenId || allowedKitchenIds.has(e.kitchenId),
  );
  const scopedWhatsApp = whatsappLogs.filter(
    (w) => !w.kitchenId || allowedKitchenIds.has(w.kitchenId),
  );

  return NextResponse.json({
    ok: true,
    organizationId: employee.organizationId,
    mappings: scopedMappings,
    outboxEvents: scopedOutbox,
    whatsappLogs: scopedWhatsApp,
    kitchens: orgKitchens,
    brands,
    menuCatalog,
    integrationStatus: {
      urbanpiperMode: isUrbanPiperLiveConfigured() ? "LIVE" : "SANDBOX",
      qstashMode: process.env.QSTASH_TOKEN?.trim() ? "LIVE" : "LOCAL_SANDBOX",
      whatsappProvider: resolveWhatsAppProvider(),
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireOwnerView(request);
  if (!auth.ok) return auth.response;
  const employee = auth.employee;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const action = String(body.action ?? "UPSERT_MAPPING").toUpperCase();

  try {
    if (action === "FLUSH_OUTBOX") {
      const summary = await processOutboxQueue({
        organizationId: employee.organizationId,
        limit: typeof body.limit === "number" ? body.limit : 25,
      });
      return NextResponse.json({
        ok: true,
        action: "FLUSH_OUTBOX",
        ...summary,
      });
    }

    if (action === "SEND_DAILY_DIGEST") {
      const digest = await runDailyOwnerInrDigest({
        organizationId: employee.organizationId,
        istDate:
          typeof body.istDate === "string" && body.istDate.trim()
            ? body.istDate.trim()
            : undefined,
        force: body.force === true,
        actor: employee.name,
      });
      return NextResponse.json({
        ok: true,
        action: "SEND_DAILY_DIGEST",
        istDate: digest.istDate,
        results: digest.results,
      });
    }

    const kitchenId = String(body.kitchenId ?? "").trim();
    const brandId = String(body.brandId ?? "").trim() as DbaBrand;
    const menuItemId = String(body.menuItemId ?? "").trim();
    const externalStoreId = String(body.externalStoreId ?? "").trim();
    const externalItemId = String(body.externalItemId ?? "").trim();
    const channel = String(
      body.channel ?? "ALL",
    ).toUpperCase() as AggregatorChannel;

    if (
      !kitchenId ||
      !brandId ||
      !menuItemId ||
      !externalStoreId ||
      !externalItemId
    ) {
      return NextResponse.json(
        {
          error:
            "kitchenId, brandId, menuItemId, externalStoreId, and externalItemId are required.",
        },
        { status: 400 },
      );
    }

    if (!ALLOWED_CHANNELS.has(channel)) {
      return NextResponse.json(
        { error: "Invalid channel. Expected SWIGGY, ZOMATO, or ALL." },
        { status: 400 },
      );
    }

    const kitchens = await getKitchens();
    const targetKitchen = kitchens.find((k) => k.id === kitchenId);
    if (
      !targetKitchen ||
      !canAccessOrganization(employee, targetKitchen.organizationId) ||
      !canAccessKitchen(employee, kitchenId)
    ) {
      return NextResponse.json(
        { error: `Access denied for kitchen ${kitchenId}` },
        { status: 403 },
      );
    }

    const mapping = await upsertAggregatorSkuMapping(
      {
        organizationId: employee.organizationId,
        kitchenId,
        brandId,
        menuItemId,
        provider: "URBANPIPER",
        channel,
        externalStoreId,
        externalItemId,
        externalItemName:
          typeof body.externalItemName === "string"
            ? body.externalItemName
            : undefined,
        active: typeof body.active === "boolean" ? body.active : true,
      },
      employee.name,
    );

    return NextResponse.json({ ok: true, mapping }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Operation failed" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireOwnerView(request);
  if (!auth.ok) return auth.response;
  const employee = auth.employee;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const action = String(body.action ?? "UPDATE_MAPPING").toUpperCase();

  try {
    if (action === "RETRY_OUTBOX") {
      const eventId = String(body.eventId ?? "").trim();
      if (!eventId) {
        return NextResponse.json(
          { error: "eventId is required" },
          { status: 400 },
        );
      }
      const events = await getOutboxEvents({
        organizationId: employee.organizationId,
      });
      const existing = events.find((e) => e.id === eventId);
      if (!existing) {
        return NextResponse.json(
          { error: `Outbox event not found: ${eventId}` },
          { status: 404 },
        );
      }
      if (existing.kitchenId && !canAccessKitchen(employee, existing.kitchenId)) {
        return NextResponse.json(
          { error: `Access denied for kitchen ${existing.kitchenId}` },
          { status: 403 },
        );
      }

      const requeued = await retryOutboxEvent(eventId, employee.name);
      const flushResult =
        body.flushImmediately === true
          ? await processOutboxQueue({
              organizationId: employee.organizationId,
              limit: 10,
            })
          : undefined;

      return NextResponse.json({
        ok: true,
        event: requeued,
        flushResult,
      });
    }

    const id = String(body.id ?? "").trim();
    if (!id) {
      return NextResponse.json(
        { error: "Mapping id is required" },
        { status: 400 },
      );
    }

    const existingList = await getAggregatorSkuMappings({
      organizationId: employee.organizationId,
    });
    const existing = existingList.find((m) => m.id === id);
    if (!existing) {
      return NextResponse.json(
        { error: `Aggregator SKU mapping not found: ${id}` },
        { status: 404 },
      );
    }
    if (!canAccessKitchen(employee, existing.kitchenId)) {
      return NextResponse.json(
        { error: `Access denied for kitchen ${existing.kitchenId}` },
        { status: 403 },
      );
    }

    const channel =
      typeof body.channel === "string"
        ? (body.channel.toUpperCase() as AggregatorChannel)
        : undefined;
    if (channel && !ALLOWED_CHANNELS.has(channel)) {
      return NextResponse.json(
        { error: "Invalid channel" },
        { status: 400 },
      );
    }

    const mapping = await toggleAggregatorSkuMapping(
      id,
      {
        active: typeof body.active === "boolean" ? body.active : undefined,
        externalStoreId:
          typeof body.externalStoreId === "string"
            ? body.externalStoreId
            : undefined,
        externalItemId:
          typeof body.externalItemId === "string"
            ? body.externalItemId
            : undefined,
        channel,
      },
      employee.name,
    );

    return NextResponse.json({ ok: true, mapping });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 400 },
    );
  }
}
