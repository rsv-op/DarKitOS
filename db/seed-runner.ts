import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import { DEFAULT_ORGANIZATION_ID, INVENTORY_DB } from "@/lib/db";
import { buildInitialSeedState } from "@/lib/store-seed";

export type SeedableDb = PostgresJsDatabase<typeof schema>;

function toDate(value?: string): Date | null {
  return value ? new Date(value) : null;
}

function toNumStr(value: number, scale = 4): string {
  return Number(value).toFixed(scale);
}

function toMoneyStr(value?: number): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Number(value).toFixed(2);
}

/**
 * Idempotently populates all 19 normalized PostgreSQL tables using ON CONFLICT DO NOTHING.
 * Safe to invoke repeatedly via `npm run db:seed` or concurrent cold-start `ensureSeeded()`.
 */
export async function seedDatabaseIdempotent(db: SeedableDb): Promise<void> {
  const dataset = buildInitialSeedState();

  await db.transaction(async (tx) => {
    // 0. Organizations
    await tx
      .insert(schema.organizations)
      .values(
        dataset.organizations.map((o) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          gstin: o.gstin ?? null,
          fssaiLicense: o.fssaiLicense ?? null,
          active: o.active,
          createdAt: new Date(o.createdAt),
        })),
      )
      .onConflictDoNothing();

    // 1. Kitchens
    await tx
      .insert(schema.kitchens)
      .values(
        dataset.kitchens.map((k) => ({
          id: k.id,
          organizationId: k.organizationId ?? DEFAULT_ORGANIZATION_ID,
          name: k.name,
          code: k.code,
          location: k.location ?? "",
          areaCode: k.areaCode ?? k.code,
          stateCode: k.stateCode ?? "06",
          gstin: k.gstin ?? null,
          fssaiLicense: k.fssaiLicense ?? null,
          active: k.active,
          timezone: k.timezone,
          capacityPerHour: k.capacityPerHour ?? 100,
        })),
      )
      .onConflictDoNothing();

    // 2. Brands
    await tx
      .insert(schema.brands)
      .values(
        dataset.brands.map((b) => ({
          id: b.id,
          organizationId: b.organizationId ?? DEFAULT_ORGANIZATION_ID,
          name: b.name,
          code: b.code,
          active: b.active,
          colorTheme: b.colorTheme,
          tagline: b.tagline ?? "",
          cuisine: b.cuisine ?? "",
        })),
      )
      .onConflictDoNothing();

    // 3. Brand <-> Kitchen Matrix
    await tx
      .insert(schema.brandKitchens)
      .values(
        dataset.brandKitchens.map((bk) => ({
          brandId: bk.brandId,
          kitchenId: bk.kitchenId,
          active: bk.active,
        })),
      )
      .onConflictDoNothing();

    // 4. Employees (strictly PIN-free)
    await tx
      .insert(schema.employees)
      .values(
        dataset.employees.map((e) => ({
          id: e.id,
          organizationId: e.organizationId ?? DEFAULT_ORGANIZATION_ID,
          employeeCode: e.employeeCode,
          name: e.name,
          role: e.role,
          kitchenId: e.kitchenId ?? null,
          email: e.email ?? null,
          phone: e.phone ?? null,
          authUserId: e.authUserId ?? null,
          active: e.active,
        })),
      )
      .onConflictDoNothing();

    // 5. Ingredient Master Catalog
    await tx
      .insert(schema.ingredients)
      .values(
        INVENTORY_DB.map((ing) => ({
          id: ing.id,
          sku: ing.sku,
          name: ing.name,
          category: ing.category,
          unit: ing.unit,
          costPerUnit: Number(ing.costPerUnit).toFixed(2),
          expectedYieldPct: ing.expectedYieldPct ?? null,
          actualYieldPct: ing.actualYieldPct ?? null,
        })),
      )
      .onConflictDoNothing();

    // 6. Per-Kitchen Inventory (4 kitchens × 11 ingredients = 44 isolated rows)
    await tx
      .insert(schema.kitchenInventory)
      .values(
        dataset.inventory.map((row) => ({
          kitchenId: row.kitchenId ?? "K1",
          ingredientId: row.ingredientId ?? row.id,
          currentStock: toNumStr(row.currentStock, 4),
          reorderThreshold: toNumStr(row.reorderThreshold, 4),
          lastRestocked: new Date(row.lastRestocked),
        })),
      )
      .onConflictDoNothing();

    // 7. Menu Items
    await tx
      .insert(schema.menuItems)
      .values(
        dataset.menuCatalog.map((m) => ({
          id: m.id,
          brandId: m.brandId,
          name: m.name,
          price: Number(m.price).toFixed(2),
          station: m.station,
          active: m.active ?? true,
          prepTimeMins: m.prepTimeMins ?? 8,
        })),
      )
      .onConflictDoNothing();

    // 8. Menu Recipes
    const recipeRows = dataset.menuCatalog.flatMap((m) =>
      m.recipe.map((r) => ({
        menuItemId: m.id,
        ingredientId: r.inventoryItemId,
        quantityRequired: toNumStr(r.quantityRequired, 4),
      })),
    );
    if (recipeRows.length > 0) {
      await tx
        .insert(schema.menuRecipes)
        .values(recipeRows)
        .onConflictDoNothing();
    }

    // 9. Orders
    if (dataset.orders.length > 0) {
      await tx
        .insert(schema.orders)
        .values(
          dataset.orders.map((o) => ({
            id: o.id,
            organizationId: o.organizationId ?? DEFAULT_ORGANIZATION_ID,
            externalOrderId: o.externalOrderId ?? null,
            idempotencyKey: o.idempotencyKey ?? null,
            brandId: o.brandId,
            kitchenId: o.kitchenId,
            channel: o.channel,
            source: o.source,
            status: o.status,
            priority: o.priority ?? null,
            subtotalAmount: toMoneyStr(o.subtotalAmount),
            packagingAmount: toMoneyStr(o.packagingAmount),
            cgstAmount: toMoneyStr(o.cgstAmount),
            sgstAmount: toMoneyStr(o.sgstAmount),
            igstAmount: toMoneyStr(o.igstAmount),
            taxAmount: toMoneyStr(o.taxAmount),
            totalAmount: toMoneyStr(o.totalAmount),
            paymentStatus: o.paymentStatus ?? "AGGREGATOR_SETTLED",
            invoiceId: o.invoiceId ?? null,
            itemCount: o.itemCount ?? null,
            notes: o.notes ?? null,
            customerName: o.customerName ?? null,
            driverName: o.driverName ?? null,
            courierEtaMins:
              typeof o.courierEtaMins === "number" ? o.courierEtaMins : null,
            createdAt: new Date(o.createdAt),
            updatedAt: new Date(o.updatedAt),
            receivedAt: toDate(o.receivedAt),
            acceptedAt: toDate(o.acceptedAt),
            prepStartedAt: toDate(o.prepStartedAt),
            prepCompletedAt: toDate(o.prepCompletedAt),
            readyAt: toDate(o.readyAt),
            driverAssignedAt: toDate(o.driverAssignedAt),
            pickedUpAt: toDate(o.pickedUpAt),
            dispatchedAt: toDate(o.dispatchedAt),
            cancelledAt: toDate(o.cancelledAt),
            cancellationSource: o.cancellationSource ?? null,
            cancellationReason: o.cancellationReason ?? null,
            cancelledBy: o.cancelledBy ?? null,
            cancellationStage: o.cancellationStage ?? null,
            cancellationResolution: o.cancellationResolution ?? null,
            lossAmount: toMoneyStr(o.lossAmount),
            claimAmount: toMoneyStr(o.claimAmount),
            inventoryDecision: o.inventoryDecision ?? null,
            inventoryWarnings: o.inventoryWarnings ?? null,
            inventoryUnavailable: o.inventoryUnavailable ?? null,
            inventoryConsumed: Boolean(o.inventoryConsumed),
            inventoryRestored: Boolean(o.inventoryRestored),
          })),
        )
        .onConflictDoNothing();

      // 10. Order Items
      const orderItemRows = dataset.orders.flatMap((o) =>
        o.items.map((item, idx) => ({
          id: item.id,
          orderId: o.id,
          menuItemId: item.menuItemId,
          name: item.name,
          quantity: item.quantity,
          price: toMoneyStr(item.price),
          notes: item.notes ?? null,
          station: item.station,
          sortOrder: idx,
        })),
      );
      if (orderItemRows.length > 0) {
        await tx
          .insert(schema.orderItems)
          .values(orderItemRows)
          .onConflictDoNothing();
      }

      // 11. Order Events
      const orderEventRows = dataset.orders.flatMap((o) =>
        o.events.map((evt) => ({
          id: evt.id,
          orderId: o.id,
          type: evt.type,
          timestamp: new Date(evt.timestamp),
          actor: evt.actor,
          details: evt.details ?? null,
        })),
      );
      if (orderEventRows.length > 0) {
        await tx
          .insert(schema.orderEvents)
          .values(orderEventRows)
          .onConflictDoNothing();
      }
    }

    // 12. Inventory Movements
    if (dataset.inventoryMovements.length > 0) {
      await tx
        .insert(schema.inventoryMovements)
        .values(
          dataset.inventoryMovements.map((m) => ({
            id: m.id,
            kitchenId: m.kitchenId,
            ingredientId: m.inventoryItemId,
            itemName: m.itemName,
            sku: m.sku,
            type: m.type,
            quantity: toNumStr(m.quantity, 4),
            previousStock: toNumStr(m.previousStock, 4),
            newStock: toNumStr(m.newStock, 4),
            unit: m.unit,
            costImpact: Number(m.costImpact).toFixed(2),
            orderId: m.orderId ?? null,
            transferGroupId: m.transferGroupId ?? null,
            actor: m.actor,
            reason: m.reason,
            timestamp: new Date(m.timestamp),
          })),
        )
        .onConflictDoNothing();
    }

    // 13. Cancellations
    if (dataset.cancellations.length > 0) {
      await tx
        .insert(schema.cancellations)
        .values(
          dataset.cancellations.map((c) => ({
            id: c.id,
            orderId: c.orderId,
            brandId: c.brandId,
            kitchenId: c.kitchenId,
            channel: c.channel,
            stage: c.stage,
            previousStatus: c.previousStatus,
            resolution: c.resolution,
            source: c.source,
            reason: c.reason,
            actor: c.actor,
            timestamp: new Date(c.timestamp),
            financialLoss: Number(c.financialLoss).toFixed(2),
            claimAmount: Number(c.claimAmount).toFixed(2),
            restoredIngredients: c.restoredIngredients,
            lostIngredients: c.lostIngredients,
            dispatchEvidence: c.dispatchEvidence ?? null,
          })),
        )
        .onConflictDoNothing();
    }

    // 14. Webhook Events
    if (dataset.webhookEvents.length > 0) {
      await tx
        .insert(schema.webhookEvents)
        .values(
          dataset.webhookEvents.map((w) => ({
            idempotencyKey: w.idempotencyKey,
            orderId: w.orderId,
            status: w.status,
            channel: w.channel,
            brandId: w.brandId,
            kitchenId: w.kitchenId,
            payloadSummary: w.payloadSummary,
            createdAt: new Date(w.createdAt),
            hitCount: w.hitCount,
          })),
        )
        .onConflictDoNothing();
    }

    // 15. Outbox Events
    if (dataset.outboxEvents.length > 0) {
      await tx
        .insert(schema.outboxEvents)
        .values(
          dataset.outboxEvents.map((o) => ({
            id: o.id,
            eventType: o.eventType,
            aggregateId: o.aggregateId,
            payload: o.payload,
            attempt: o.attempt,
            maxAttempts: o.maxAttempts,
            backoffSchedule: o.backoffSchedule,
            status: o.status,
            createdAt: new Date(o.createdAt),
          })),
        )
        .onConflictDoNothing();
    }

    // 16. Activities
    if (dataset.activities.length > 0) {
      await tx
        .insert(schema.activities)
        .values(
          dataset.activities.map((a) => ({
            id: a.id,
            organizationId: a.organizationId ?? DEFAULT_ORGANIZATION_ID,
            type: a.type,
            category: a.category,
            title: a.title,
            details: a.details,
            actor: a.actor,
            orderId: a.orderId ?? null,
            kitchenId: a.kitchenId ?? null,
            brandId: a.brandId ?? null,
            timestamp: new Date(a.timestamp),
            severity: a.severity,
          })),
        )
        .onConflictDoNothing();
    }

    // 17. Leakage Vectors
    if (dataset.leakageVectors.length > 0) {
      await tx
        .insert(schema.leakageVectors)
        .values(
          dataset.leakageVectors.map((l) => ({
            id: l.id,
            vector: l.vector,
            signature: l.signature,
            impactLevel: l.impactLevel,
            impactNote: l.impactNote,
            potentialRevenue: Number(l.potentialRevenue).toFixed(2),
            actualCollected: Number(l.actualCollected).toFixed(2),
            leakedAmount: Number(l.leakedAmount).toFixed(2),
            affectedAccounts: l.affectedAccounts,
            status: l.status,
          })),
        )
        .onConflictDoNothing();
    }

    // 18. Virtual Files
    if (dataset.files.length > 0) {
      await tx
        .insert(schema.virtualFiles)
        .values(
          dataset.files.map((f) => ({
            id: f.id,
            name: f.name,
            category: f.category,
            size: f.size,
            mimeType: f.mimeType,
            kitchenId: f.kitchenId ?? null,
            brandId: f.brandId ?? null,
            uploadedBy: f.uploadedBy,
            updatedAt: new Date(f.updatedAt),
            status: f.status,
            content: f.content,
          })),
        )
        .onConflictDoNothing();
    }

    // 19. System Settings
    await tx
      .insert(schema.systemSettings)
      .values({
        id: "default",
        organizationId:
          dataset.settings.organizationId ?? DEFAULT_ORGANIZATION_ID,
        currency: dataset.settings.currency,
        timezone: dataset.settings.timezone,
        theme: dataset.settings.theme,
        fluidAnimations: dataset.settings.fluidAnimations,
        syncMode: dataset.settings.syncMode,
        autoAcceptOrders: dataset.settings.autoAcceptOrders,
        lowStockMultiplier: dataset.settings.lowStockMultiplier,
        prepSlaMinutes: dataset.settings.prepSlaMinutes,
        dispatchSlaMinutes: dataset.settings.dispatchSlaMinutes,
        rlsEnforcement: dataset.settings.rlsEnforcement,
        circuitBreakerState: dataset.settings.circuitBreakerState,
        rateLimitRps: dataset.settings.rateLimitRps,
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    // 20. GST Tax Invoices
    if (dataset.taxInvoices.length > 0) {
      await tx
        .insert(schema.taxInvoices)
        .values(
          dataset.taxInvoices.map((inv) => ({
            id: inv.id,
            organizationId: inv.organizationId,
            kitchenId: inv.kitchenId,
            orderId: inv.orderId,
            invoiceNumber: inv.invoiceNumber,
            financialYear: inv.financialYear,
            sequenceNumber: inv.sequenceNumber,
            issuedAt: new Date(inv.issuedAt),
            sellerGstin: inv.sellerGstin,
            sellerFssai: inv.sellerFssai,
            sellerStateCode: inv.sellerStateCode,
            placeOfSupplyStateCode: inv.placeOfSupplyStateCode,
            customerName: inv.customerName ?? null,
            customerGstin: inv.customerGstin ?? null,
            taxableSubtotal: Number(inv.taxableSubtotal).toFixed(2),
            packagingFee: Number(inv.packagingFee).toFixed(2),
            cgstRate: Number(inv.cgstRate).toFixed(2),
            cgstAmount: Number(inv.cgstAmount).toFixed(2),
            sgstRate: Number(inv.sgstRate).toFixed(2),
            sgstAmount: Number(inv.sgstAmount).toFixed(2),
            igstRate: Number(inv.igstRate).toFixed(2),
            igstAmount: Number(inv.igstAmount).toFixed(2),
            totalTax: Number(inv.totalTax).toFixed(2),
            grandTotal: Number(inv.grandTotal).toFixed(2),
            status: inv.status,
            voidedAt: toDate(inv.voidedAt),
            voidReason: inv.voidReason ?? null,
            createdAt: new Date(inv.createdAt),
          })),
        )
        .onConflictDoNothing();
    }

    // 21. Payment Transactions
    if (dataset.paymentTransactions.length > 0) {
      await tx
        .insert(schema.paymentTransactions)
        .values(
          dataset.paymentTransactions.map((txRow) => ({
            id: txRow.id,
            organizationId: txRow.organizationId,
            kitchenId: txRow.kitchenId,
            orderId: txRow.orderId,
            provider: txRow.provider,
            providerOrderId: txRow.providerOrderId ?? null,
            providerPaymentId: txRow.providerPaymentId ?? null,
            providerRefundId: txRow.providerRefundId ?? null,
            webhookEventId: txRow.webhookEventId ?? null,
            amount: Number(txRow.amount).toFixed(2),
            refundedAmount: Number(txRow.refundedAmount).toFixed(2),
            currency: txRow.currency,
            status: txRow.status,
            method: txRow.method ?? null,
            rawMeta: txRow.rawMeta ?? null,
            createdAt: new Date(txRow.createdAt),
            updatedAt: new Date(txRow.updatedAt),
          })),
        )
        .onConflictDoNothing();
    }
  });
}

/**
 * Truncates all tables and re-seeds clean canonical demo data (used by resetStore & tests).
 */
export async function resetDatabaseToSeed(db: SeedableDb): Promise<void> {
  await db.execute(sql`
    TRUNCATE TABLE
      payment_transactions,
      tax_invoices,
      order_events,
      order_items,
      cancellations,
      inventory_movements,
      orders,
      webhook_events,
      outbox_events,
      activities,
      virtual_files,
      leakage_vectors,
      menu_recipes,
      menu_items,
      kitchen_inventory,
      ingredients,
      employees,
      brand_kitchens,
      brands,
      kitchens,
      system_settings,
      organizations
    RESTART IDENTITY CASCADE
  `);

  await seedDatabaseIdempotent(db);
}
