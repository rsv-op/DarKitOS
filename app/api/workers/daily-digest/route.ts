import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/db";
import { verifyWorkerAuth } from "@/lib/outbox-dispatcher";
import { getEmployees } from "@/lib/store";
import { runDailyOwnerInrDigest } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

async function resolveExplicitOwnerSession(request: NextRequest): Promise<{
  actor: string;
  organizationId: string;
} | null> {
  const token = request.cookies.get("dark_cloud_session")?.value;
  if (!token) return null;

  const session = await verifyToken(token);
  if (!session) return null;

  const employees = await getEmployees();
  const matched = employees.find(
    (e) =>
      e.id === session.userId ||
      (session.employeeCode &&
        e.employeeCode.toLowerCase() === session.employeeCode.toLowerCase()),
  );
  if (!matched || matched.active === false) {
    return null;
  }
  if (matched.role !== "OWNER") {
    return null;
  }

  return {
    actor: matched.name,
    organizationId: matched.organizationId ?? DEFAULT_ORGANIZATION_ID,
  };
}

export async function POST(request: NextRequest) {
  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    rawBody = "";
  }

  const workerAuth = await verifyWorkerAuth(request, rawBody);
  let authMethod: "CRON_SECRET" | "QSTASH_SIGNATURE" | "OWNER_SESSION" | null =
    workerAuth.authorized ? (workerAuth.authMethod ?? "CRON_SECRET") : null;
  let actor = "DAILY_DIGEST_WORKER";
  let scopedOrganizationId: string | undefined;

  if (!authMethod) {
    const ownerSession = await resolveExplicitOwnerSession(request);
    if (!ownerSession) {
      return NextResponse.json(
        {
          error:
            "Unauthorized. Provide Bearer CRON_SECRET, Upstash-Signature, or an authenticated OWNER session.",
        },
        { status: 401 },
      );
    }
    authMethod = "OWNER_SESSION";
    actor = ownerSession.actor;
    scopedOrganizationId = ownerSession.organizationId;
  }

  let requestedOrgId: string | undefined;
  let istDate: string | undefined;
  let force = false;

  if (rawBody.trim()) {
    try {
      const parsed = JSON.parse(rawBody) as {
        organizationId?: unknown;
        istDate?: unknown;
        force?: unknown;
      };
      if (
        typeof parsed.organizationId === "string" &&
        parsed.organizationId.trim()
      ) {
        requestedOrgId = parsed.organizationId.trim();
      }
      if (typeof parsed.istDate === "string" && parsed.istDate.trim()) {
        istDate = parsed.istDate.trim();
      }
      if (parsed.force === true) {
        force = true;
      }
    } catch {
      // Optional JSON body
    }
  }

  const organizationId = scopedOrganizationId ?? requestedOrgId;

  const digest = await runDailyOwnerInrDigest({
    organizationId,
    istDate,
    force,
    actor,
  });

  return NextResponse.json({
    ok: true,
    authMethod,
    istDate: digest.istDate,
    results: digest.results,
  });
}
