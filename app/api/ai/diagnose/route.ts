import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedEmployee } from "@/lib/domain/auth-service";
import {
  canAccessKitchen,
  getAccessibleKitchenIds,
  hasGlobalScope,
  hasPermission,
} from "@/lib/domain/permission-service";
import {
  MAX_BOTTLENECK_CHARS,
  diagnoseKitchenBottleneck,
} from "@/lib/gemini-copilot";
import { getKitchens, recordActivity } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedEmployee(request);
  if (!auth.ok) return auth.response;
  const employee = auth.employee;

  // Strictly OWNER and MANAGER only (LINE_COOK and DISPATCH receive 403)
  if (!hasPermission(employee, "OWNER_VIEW")) {
    return NextResponse.json(
      {
        error:
          "Forbidden: OWNER_VIEW permission required to run Operational Copilot diagnostics.",
      },
      { status: 403 },
    );
  }

  let body: {
    bottleneck?: unknown;
    kitchenId?: unknown;
  };
  try {
    body = (await request.json()) as {
      bottleneck?: unknown;
      kitchenId?: unknown;
    };
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const bottleneck =
    typeof body?.bottleneck === "string" ? body.bottleneck.trim() : "";

  if (!bottleneck) {
    return NextResponse.json(
      { error: "bottleneck description is required (1–2000 characters)." },
      { status: 400 },
    );
  }

  if (bottleneck.length > MAX_BOTTLENECK_CHARS) {
    return NextResponse.json(
      {
        error: `bottleneck exceeds maximum allowed length of ${MAX_BOTTLENECK_CHARS} characters.`,
      },
      { status: 400 },
    );
  }

  const kitchens = await getKitchens();
  const accessibleKitchenIds = getAccessibleKitchenIds(employee, kitchens);

  const rawRequestedKitchen =
    typeof body?.kitchenId === "string" ? body.kitchenId.trim() : "";

  let resolvedKitchenId: string | undefined;

  if (rawRequestedKitchen) {
    if (
      rawRequestedKitchen.toUpperCase() === "ALL" ||
      rawRequestedKitchen.toUpperCase() === "GLOBAL"
    ) {
      if (!hasGlobalScope(employee)) {
        return NextResponse.json(
          {
            error:
              "Forbidden: Kitchen-scoped managers may only diagnose their assigned kitchen hub, not ALL kitchens.",
          },
          { status: 403 },
        );
      }
      resolvedKitchenId = "ALL";
    } else {
      if (!canAccessKitchen(employee, rawRequestedKitchen, kitchens)) {
        return NextResponse.json(
          {
            error: `Forbidden: You do not have access to diagnose kitchen ${rawRequestedKitchen}.`,
          },
          { status: 403 },
        );
      }
      resolvedKitchenId = rawRequestedKitchen;
    }
  } else {
    resolvedKitchenId = hasGlobalScope(employee)
      ? "ALL"
      : employee.kitchenId || undefined;
  }

  try {
    const result = await diagnoseKitchenBottleneck({
      bottleneck,
      organizationId: employee.organizationId,
      kitchenId: resolvedKitchenId,
      accessibleKitchenIds,
      ownerName: employee.name,
    });

    await recordActivity({
      organizationId: employee.organizationId,
      type: "AI_DIAGNOSIS_GENERATED",
      category: "AI_COPILOT",
      title: "Operational Diagnosis Generated",
      details: `Copilot (${result.mode}) diagnosed ${result.telemetrySnapshot.kitchenScope} — estimated monthly impact ₹${result.diagnosis.estimatedMonthlyImpactInr.toLocaleString("en-IN")}.`,
      actor: employee.name,
      kitchenId:
        resolvedKitchenId && resolvedKitchenId !== "ALL"
          ? resolvedKitchenId
          : undefined,
      severity: "info",
    });

    return NextResponse.json({
      ok: true,
      mode: result.mode,
      model: result.model,
      fallbackReason: result.fallbackReason,
      telemetrySnapshot: result.telemetrySnapshot,
      diagnosis: result.diagnosis,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Unable to generate operational diagnosis.",
      },
      { status: 400 },
    );
  }
}
