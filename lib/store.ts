import { formatCurrency } from "@/lib/currency";
import {
  BRANDS_DB,
  BRAND_KITCHENS_DB,
  EMPLOYEES_DB,
  INVENTORY_DB,
  KITCHENS_DB,
  MENU_CATALOG,
  calculateOrderRecipeCost,
  calculateOrderTotalAmount,
  evaluateOrderInventory,
  getRequiredIngredients,
  processOrderDepletion,
  type BrandConfig,
  type BrandKitchenConfig,
  type CancellationRecord,
  type CancellationResolution,
  type CancellationSource,
  type CancellationStage,
  type DbaBrand,
  type Employee,
  type EmployeeRole,
  type InventoryDecision,
  type InventoryItem,
  type InventoryMovement,
  type InventoryMovementType,
  type KitchenConfig,
  type MenuItem,
  type OperationalActivity,
  type Order,
  type OrderChannel,
  type OrderEvent,
  type OrderItem,
  type OrderSource,
  type OrderStatus,
  type OutboxEvent,
  type RevenueLeakageVector,
  type SystemSettings,
  type VirtualFileAsset,
  type WebhookIdempotencyEntry,
} from "@/lib/db";

export type { Order, InventoryItem };

export const MID_PREP_LABOR_ALLOWANCE_INR = 75;

const ALLOWED_EMPLOYEE_ROLES = new Set<EmployeeRole>([
  "OWNER",
  "MANAGER",
  "LINE_COOK",
  "DISPATCH",
]);

const ALLOWED_LEAKAGE_STATUSES = new Set<
  RevenueLeakageVector["status"]
>(["DETECTED", "AUDITING", "RECOVERED"]);

export interface KitchenState {
  orders: Order[];
  inventory: InventoryItem[];
  inventoryMovements: InventoryMovement[];
  cancellations: CancellationRecord[];
  activities: OperationalActivity[];
  brands: BrandConfig[];
  kitchens: KitchenConfig[];
  brandKitchens: BrandKitchenConfig[];
  menuCatalog: MenuItem[];
  employees: Employee[];
  webhookEvents: WebhookIdempotencyEntry[];
  outboxEvents: OutboxEvent[];
  leakageVectors: RevenueLeakageVector[];
  files: VirtualFileAsset[];
  settings: SystemSettings;
}

export interface StoreSnapshot extends KitchenState {}

const DEFAULT_SETTINGS: SystemSettings = {
  currency: "INR",
  timezone: "Asia/Kolkata",
  theme: "obsidian",
  fluidAnimations: true,
  syncMode: "HTTP_POLLING",
  autoAcceptOrders: true,
  lowStockMultiplier: 1.0,
  prepSlaMinutes: 12,
  dispatchSlaMinutes: 15,
  rlsEnforcement: "STRICT_LOCAL_TX",
  circuitBreakerState: "CLOSED",
  rateLimitRps: 250,
};

const INITIAL_LEAKAGE_VECTORS: RevenueLeakageVector[] = [
  {
    id: "LEAK-01",
    vector: "Aggregator Payout Discrepancies",
    signature:
      "Swiggy & Zomato weekly settlements showing unexplained commission or penalty deductions without dispute tickets.",
    impactLevel: "Severe",
    impactNote: "Severe (2–4% of monthly aggregator GMV)",
    potentialRevenue: 485000,
    actualCollected: 451200,
    leakedAmount: 33800,
    affectedAccounts: 14,
    status: "DETECTED",
  },
  {
    id: "LEAK-02",
    vector: "Unclaimed Post-Pickup Cancellations",
    signature:
      "Orders cancelled after courier handoff where kitchen evidence exists but aggregator claim was never filed.",
    impactLevel: "High",
    impactNote: "High (100% food & packaging loss if unclaimed)",
    potentialRevenue: 362000,
    actualCollected: 344900,
    leakedAmount: 17100,
    affectedAccounts: 23,
    status: "AUDITING",
  },
  {
    id: "LEAK-03",
    vector: "Expired Promo & Discount Burn",
    signature:
      "Aggregator campaign discounts continuing past peak-hour windows across multiple virtual brands.",
    impactLevel: "Moderate",
    impactNote: "Moderate (Compounds quietly across weekend surges)",
    potentialRevenue: 294000,
    actualCollected: 279800,
    leakedAmount: 14200,
    affectedAccounts: 9,
    status: "DETECTED",
  },
  {
    id: "LEAK-04",
    vector: "Menu & Packaging Add-On Drift",
    signature:
      "Menu price revisions updated in kitchen POS but out of sync on one or more delivery channels.",
    impactLevel: "Moderate",
    impactNote: "Moderate (Direct margin erosion per ticket)",
    potentialRevenue: 410000,
    actualCollected: 391500,
    leakedAmount: 18500,
    affectedAccounts: 6,
    status: "AUDITING",
  },
  {
    id: "LEAK-05",
    vector: "Failed Direct UPI / Card Captures",
    signature:
      "Direct Web checkout intents where payment capture timed out without automated retry links.",
    impactLevel: "High",
    impactNote: "High (Zero-commission direct orders lost)",
    potentialRevenue: 640000,
    actualCollected: 616000,
    leakedAmount: 24000,
    affectedAccounts: 12,
    status: "RECOVERED",
  },
];

const INITIAL_FILES: VirtualFileAsset[] = [
  {
    id: "FILE-ADR-001",
    name: "DarKitOS_Build_Status_and_Production_Roadmap.md",
    category: "Architecture ADR",
    size: "16.4 KB",
    mimeType: "text/markdown",
    kitchenId: "K1",
    uploadedBy: "Patric Revuelto (OWNER-01)",
    updatedAt: "2026-11-25T05:30:00.000Z",
    status: "VERIFIED",
    content: `# DarKitOS — Current Build Status & Production Roadmap\n\n## Current Stage: Sprint 0 (Verified INR Prototype)\n- INR (₹) native pricing, COGS, wastage loss, and en-IN formatting across all screens.\n- Single canonical store boundary (\`lib/store.ts\`) & client-safe domain contract (\`lib/db.ts\`).\n- End-to-end kitchen flow: Order Intake → Live Orders → Cook KDS → Dispatch → Atomic Recipe Stock Deduction → Stage-Aware Cancellations.\n- Owner Showcase + Downloadable \`.md\` Bottleneck Brief Generator for Gemini / Dev AI.\n- Hardened session JWT auth, strict RBAC guards, and Vitest domain/API test baseline.\n\n## Locked Production Stack (Sprints 1–4)\n- **Sprint 1:** Supabase PostgreSQL (Mumbai \`ap-south-1\`) + Drizzle ORM (\`db/schema.ts\`, \`lib/db-client.ts\`), async \`lib/store.ts\`, per-kitchen isolated inventory ledgers, and GitHub Actions CI.\n- **Sprint 2:** Supabase Auth (Email/Phone OTP), kitchen-scoped RBAC middleware, and Supabase Realtime sub-second KDS sync.\n- **Sprint 3A:** Indian GST invoicing (CGST/SGST/IGST, FSSAI/GSTIN, Tally/Zoho export) + Razorpay UPI checkout/webhooks.\n- **Sprint 3B:** UrbanPiper Swiggy/Zomato webhooks + PostgreSQL Outbox/Upstash QStash + Interakt/Gupshup WhatsApp alerts.\n- **Sprint 4:** 80mm ESC-POS KOT print bridge, audio SLA alerts, and server-side Gemini API operational copilot (\`/api/ai/diagnose\`).`,
  },
  {
    id: "FILE-SOP-002",
    name: "K1_Gurugram_FSSAI_Health_Certificate_2026.pdf",
    category: "Health Certificate",
    size: "1.4 MB",
    mimeType: "application/pdf",
    kitchenId: "K1",
    uploadedBy: "Priya Sharma (0001)",
    updatedAt: "2026-10-10T14:20:00.000Z",
    status: "VERIFIED",
    content: `FSSAI & Municipal Health Inspection Compliance Certificate\nFacility: Gurugram Central Hub (K1 - GGN-01)\nInspection Score: 98.5 / 100 (Grade A+)\nCold Chain Verification: Passed (-18°C Freezer / 2°C Walk-in Chiller)\nValid Through: October 2027`,
  },
  {
    id: "FILE-SOP-003",
    name: "Station_Thermal_Sanitation_SOP_v4.md",
    category: "SOP Manual",
    size: "18.2 KB",
    mimeType: "text/markdown",
    kitchenId: "K1",
    brandId: "BurgerForge",
    uploadedBy: "Priya Sharma (0001)",
    updatedAt: "2026-10-09T09:15:00.000Z",
    status: "VERIFIED",
    content: `# Standard Operating Procedure: Grill & Fryer Station\n1. Verify core patty temperature reaches 74°C prior to assembly.\n2. Log Ghost Pepper Glaze batch volume (ml) every 4 hours for yield reconciliation.\n3. Seal all Direct Web, Swiggy, and Zomato bags with tamper-evident thermal tape before marking READY_FOR_PICKUP.`,
  },
  {
    id: "FILE-REC-004",
    name: "Birria_Consomme_Yield_Spec_Sheet.json",
    category: "Recipe Card",
    size: "9.6 KB",
    mimeType: "application/json",
    kitchenId: "K1",
    brandId: "TacoMatrix",
    uploadedBy: "Rajesh Kumar (2001)",
    updatedAt: "2026-10-10T18:45:00.000Z",
    status: "VERIFIED",
    content: `{\n  "menuItemId": "MENU-TM-01",\n  "name": "Birria Taco Trio",\n  "asPurchasedWeightKg": 0.3125,\n  "usableEdibleWeightKg": 0.25,\n  "targetYieldPct": 80.0,\n  "ingredients": [\n    { "sku": "BIRRIA-01", "qty": 0.25, "unit": "kg" },\n    { "sku": "TORT-01", "qty": 3, "unit": "units" }\n  ]\n}`,
  },
  {
    id: "FILE-IMG-005",
    name: "Double_Smash_Burger_Hero_4K.png",
    category: "Menu Photography",
    size: "3.8 MB",
    mimeType: "image/png",
    kitchenId: "K1",
    brandId: "BurgerForge",
    uploadedBy: "Patric Revuelto (OWNER-01)",
    updatedAt: "2026-10-08T11:00:00.000Z",
    status: "VERIFIED",
    content: `High-Resolution Aggregator Asset (Swiggy / Zomato Approved)\nResolution: 3840x2160px • Color Profile: sRGB\nBrand: BurgerForge (BF) • Item: MENU-BF-01 Double Smash Burger\nLighting: Rim-lit caramelized crust, melted sharp cheddar, toasted brioche bun.`,
  },
  {
    id: "FILE-AUD-006",
    name: "Kitchen_Q4_Food_Yield_Variance_Audit.csv",
    category: "Financial Audit",
    size: "64.1 KB",
    mimeType: "text/csv",
    kitchenId: "K1",
    uploadedBy: "Patric Revuelto (OWNER-01)",
    updatedAt: "2026-10-11T06:00:00.000Z",
    status: "PENDING_REVIEW",
    content: `SKU,Item,Expected_Yield_Pct,Actual_Yield_Pct,Variance_Pct,Status\nBEEF-01,Angus Beef Patties,88.0,85.4,-2.6,WATCH\nBIRRIA-01,Slow-Cooked Birria Beef,80.0,74.5,-5.5,ALERT_OVERPORTIONING\nGHOST-01,Ghost Pepper Glaze,94.0,88.0,-6.0,ALERT_WASTE\nTUNA-01,Sashimi Grade Ahi Tuna,82.0,79.5,-2.5,HEALTHY`,
  },
];

function buildInitialSeedState(): KitchenState {
  const now = Date.now();
  const minAgo = (mins: number) =>
    new Date(now - mins * 60000).toISOString();

  const seedOrders: Order[] = [
    {
      id: "ORD-901",
      externalOrderId: "SWG-884120",
      idempotencyKey: "idem-swg-884120",
      brandId: "BurgerForge",
      kitchenId: "K1",
      channel: "Swiggy",
      source: "SWIGGY",
      status: "PENDING",
      priority: "RUSH",
      customerName: "Aarav Khanna",
      totalAmount: 887,
      itemCount: 3,
      createdAt: minAgo(6),
      updatedAt: minAgo(6),
      receivedAt: minAgo(6),
      inventoryDecision: "LOW_STOCK",
      inventoryWarnings: ["Brioche Buns"],
      inventoryConsumed: false,
      items: [
        {
          id: "ORD-901-1",
          menuItemId: "MENU-BF-01",
          name: "Double Smash Burger",
          quantity: 2,
          price: 349,
          station: "Grill",
          notes: "Extra crispy edges, no pickles",
        },
        {
          id: "ORD-901-2",
          menuItemId: "MENU-BF-02",
          name: "Truffle Fries",
          quantity: 1,
          price: 189,
          station: "Fryer",
        },
      ],
      events: [
        {
          id: "EVT-901-1",
          type: "RECEIVED",
          timestamp: minAgo(6),
          actor: "SWIGGY_WEBHOOK",
          details: "Order injected via Swiggy aggregator webhook (idempotent key verified).",
        },
        {
          id: "EVT-901-2",
          type: "INVENTORY_WARNING",
          timestamp: minAgo(6),
          actor: "SYSTEM",
          details: "Low stock alert triggered for Brioche Buns (18 units <= 25 threshold).",
        },
      ],
    },
    {
      id: "ORD-902",
      externalOrderId: "ZMT-442910",
      idempotencyKey: "idem-zmt-442910",
      brandId: "TacoMatrix",
      kitchenId: "K1",
      channel: "Zomato",
      source: "ZOMATO",
      status: "PENDING",
      priority: "NORMAL",
      customerName: "Meera Nair",
      totalAmount: 848,
      itemCount: 2,
      createdAt: minAgo(4),
      updatedAt: minAgo(4),
      receivedAt: minAgo(4),
      inventoryDecision: "AVAILABLE",
      inventoryConsumed: false,
      items: [
        {
          id: "ORD-902-1",
          menuItemId: "MENU-TM-01",
          name: "Birria Taco Trio",
          quantity: 1,
          price: 399,
          station: "Assembly",
          notes: "Extra consomme cup",
        },
        {
          id: "ORD-902-2",
          menuItemId: "MENU-TM-02",
          name: "Avocado Quesabirria Vampiro",
          quantity: 1,
          price: 449,
          station: "Assembly",
        },
      ],
      events: [
        {
          id: "EVT-902-1",
          type: "RECEIVED",
          timestamp: minAgo(4),
          actor: "ZOMATO_WEBHOOK",
          details: "Order received from Zomato channel.",
        },
      ],
    },
    {
      id: "ORD-903",
      externalOrderId: "ZMT-771039",
      idempotencyKey: "idem-zmt-771039",
      brandId: "WingProtocol",
      kitchenId: "K1",
      channel: "Zomato",
      source: "ZOMATO",
      status: "PREPARING",
      priority: "RUSH",
      customerName: "Kabir Bedi",
      totalAmount: 469,
      itemCount: 1,
      createdAt: minAgo(14),
      updatedAt: minAgo(9),
      receivedAt: minAgo(14),
      prepStartedAt: minAgo(9),
      inventoryDecision: "LOW_STOCK",
      inventoryWarnings: ["Ghost Pepper Glaze"],
      inventoryConsumed: true,
      items: [
        {
          id: "ORD-903-1",
          menuItemId: "MENU-WP-01",
          name: "12pc Ghost Pepper Wings",
          quantity: 1,
          price: 469,
          station: "Fryer",
          notes: "All flats if possible",
        },
      ],
      events: [
        {
          id: "EVT-903-1",
          type: "RECEIVED",
          timestamp: minAgo(14),
          actor: "ZOMATO_WEBHOOK",
          details: "Order received via Zomato.",
        },
        {
          id: "EVT-903-2",
          type: "PREPARING",
          timestamp: minAgo(9),
          actor: "2001 (Rajesh Kumar)",
          details: "Line cook started preparation. Atomic recipe depletion executed (12 Jumbo Chicken Wings, 120 ml Ghost Pepper Glaze).",
        },
      ],
    },
    {
      id: "ORD-904",
      externalOrderId: "WEB-550192",
      idempotencyKey: "idem-web-550192",
      brandId: "GreenBowl",
      kitchenId: "K1",
      channel: "Direct Web",
      source: "DIRECT_WEB",
      status: "READY_FOR_PICKUP",
      priority: "VIP",
      customerName: "Ananya Sen",
      totalAmount: 1058,
      itemCount: 2,
      createdAt: minAgo(22),
      updatedAt: minAgo(7),
      receivedAt: minAgo(22),
      prepStartedAt: minAgo(17),
      prepCompletedAt: minAgo(7),
      readyAt: minAgo(7),
      inventoryDecision: "AVAILABLE",
      inventoryConsumed: true,
      items: [
        {
          id: "ORD-904-1",
          menuItemId: "MENU-GB-01",
          name: "Ahi Tuna Poke Bowl",
          quantity: 2,
          price: 529,
          station: "Cold Prep",
        },
      ],
      events: [
        {
          id: "EVT-904-1",
          type: "RECEIVED",
          timestamp: minAgo(22),
          actor: "DIRECT_WEB",
          details: "Direct Web order created.",
        },
        {
          id: "EVT-904-2",
          type: "PREPARING",
          timestamp: minAgo(17),
          actor: "2001 (Rajesh Kumar)",
          details: "Started preparation on Cold Prep station.",
        },
        {
          id: "EVT-904-3",
          type: "READY_FOR_PICKUP",
          timestamp: minAgo(7),
          actor: "2001 (Rajesh Kumar)",
          details: "Preparation complete. Order staged at heated/chilled dispatch pass.",
        },
      ],
    },
    {
      id: "ORD-905",
      externalOrderId: "SWG-339104",
      idempotencyKey: "idem-swg-339104",
      brandId: "BurgerForge",
      kitchenId: "K2",
      channel: "Swiggy",
      source: "SWIGGY",
      status: "DRIVER_ASSIGNED",
      priority: "NORMAL",
      customerName: "Siddharth Jain",
      driverName: "Deepak Yadav",
      courierEtaMins: 6,
      totalAmount: 738,
      itemCount: 2,
      createdAt: minAgo(28),
      updatedAt: minAgo(4),
      receivedAt: minAgo(28),
      prepStartedAt: minAgo(23),
      prepCompletedAt: minAgo(13),
      readyAt: minAgo(13),
      driverAssignedAt: minAgo(4),
      inventoryDecision: "AVAILABLE",
      inventoryConsumed: true,
      items: [
        {
          id: "ORD-905-1",
          menuItemId: "MENU-BF-03",
          name: "Oklahoma Onion Melt",
          quantity: 1,
          price: 389,
          station: "Grill",
        },
        {
          id: "ORD-905-2",
          menuItemId: "MENU-BF-01",
          name: "Double Smash Burger",
          quantity: 1,
          price: 349,
          station: "Grill",
        },
      ],
      events: [
        {
          id: "EVT-905-1",
          type: "RECEIVED",
          timestamp: minAgo(28),
          actor: "SWIGGY_WEBHOOK",
          details: "Order injected for K2 Noida hub.",
        },
        {
          id: "EVT-905-2",
          type: "PREPARING",
          timestamp: minAgo(23),
          actor: "2002 (Sunita Rao)",
          details: "Preparation started.",
        },
        {
          id: "EVT-905-3",
          type: "READY_FOR_PICKUP",
          timestamp: minAgo(13),
          actor: "2002 (Sunita Rao)",
          details: "Order marked ready.",
        },
        {
          id: "EVT-905-4",
          type: "DRIVER_ASSIGNED",
          timestamp: minAgo(4),
          actor: "3002 (Karan Saxena)",
          details: "Driver Deepak Yadav assigned (ETA 6 mins).",
        },
      ],
    },
    {
      id: "ORD-906",
      externalOrderId: "SWG-119283",
      idempotencyKey: "idem-swg-119283",
      brandId: "TacoMatrix",
      kitchenId: "K1",
      channel: "Swiggy",
      source: "SWIGGY",
      status: "PICKED_UP",
      priority: "NORMAL",
      customerName: "Riya Kapoor",
      driverName: "Suresh Solanki",
      courierEtaMins: 3,
      totalAmount: 798,
      itemCount: 2,
      createdAt: minAgo(35),
      updatedAt: minAgo(2),
      receivedAt: minAgo(35),
      prepStartedAt: minAgo(30),
      prepCompletedAt: minAgo(21),
      readyAt: minAgo(21),
      driverAssignedAt: minAgo(10),
      pickedUpAt: minAgo(2),
      inventoryDecision: "AVAILABLE",
      inventoryConsumed: true,
      items: [
        {
          id: "ORD-906-1",
          menuItemId: "MENU-TM-01",
          name: "Birria Taco Trio",
          quantity: 2,
          price: 399,
          station: "Assembly",
        },
      ],
      events: [
        {
          id: "EVT-906-1",
          type: "RECEIVED",
          timestamp: minAgo(35),
          actor: "SWIGGY_WEBHOOK",
        },
        {
          id: "EVT-906-2",
          type: "PREPARING",
          timestamp: minAgo(30),
          actor: "2001 (Rajesh Kumar)",
        },
        {
          id: "EVT-906-3",
          type: "READY_FOR_PICKUP",
          timestamp: minAgo(21),
          actor: "2001 (Rajesh Kumar)",
        },
        {
          id: "EVT-906-4",
          type: "DRIVER_ASSIGNED",
          timestamp: minAgo(10),
          actor: "3001 (Arjun Mehta)",
          details: "Driver Suresh Solanki assigned.",
        },
        {
          id: "EVT-906-5",
          type: "PICKED_UP",
          timestamp: minAgo(2),
          actor: "3001 (Arjun Mehta)",
          details: "Package handed off to courier Suresh Solanki.",
        },
      ],
    },
    {
      id: "ORD-907",
      externalOrderId: "ZMT-998120",
      idempotencyKey: "idem-zmt-998120",
      brandId: "WingProtocol",
      kitchenId: "K3",
      channel: "Zomato",
      source: "ZOMATO",
      status: "DISPATCHED",
      priority: "NORMAL",
      customerName: "Devansh Arora",
      driverName: "Manoj Tiwari",
      courierEtaMins: 0,
      totalAmount: 738,
      itemCount: 2,
      createdAt: minAgo(52),
      updatedAt: minAgo(18),
      receivedAt: minAgo(52),
      prepStartedAt: minAgo(47),
      prepCompletedAt: minAgo(36),
      readyAt: minAgo(36),
      driverAssignedAt: minAgo(28),
      pickedUpAt: minAgo(22),
      dispatchedAt: minAgo(18),
      inventoryDecision: "AVAILABLE",
      inventoryConsumed: true,
      items: [
        {
          id: "ORD-907-1",
          menuItemId: "MENU-WP-01",
          name: "12pc Ghost Pepper Wings",
          quantity: 1,
          price: 469,
          station: "Fryer",
        },
        {
          id: "ORD-907-2",
          menuItemId: "MENU-WP-02",
          name: "6pc Tactical Fire Wings",
          quantity: 1,
          price: 269,
          station: "Fryer",
        },
      ],
      events: [
        {
          id: "EVT-907-1",
          type: "RECEIVED",
          timestamp: minAgo(52),
          actor: "ZOMATO_WEBHOOK",
        },
        {
          id: "EVT-907-2",
          type: "PREPARING",
          timestamp: minAgo(47),
          actor: "2003 (Pooja Iyer)",
        },
        {
          id: "EVT-907-3",
          type: "READY_FOR_PICKUP",
          timestamp: minAgo(36),
          actor: "2003 (Pooja Iyer)",
        },
        {
          id: "EVT-907-4",
          type: "DRIVER_ASSIGNED",
          timestamp: minAgo(28),
          actor: "3003 (Neha Gupta)",
        },
        {
          id: "EVT-907-5",
          type: "PICKED_UP",
          timestamp: minAgo(22),
          actor: "3003 (Neha Gupta)",
        },
        {
          id: "EVT-907-6",
          type: "DISPATCHED",
          timestamp: minAgo(18),
          actor: "3003 (Neha Gupta)",
          details: "Order dispatched and verified complete.",
        },
      ],
    },
    {
      id: "ORD-908",
      externalOrderId: "ZMT-662011",
      idempotencyKey: "idem-zmt-662011",
      brandId: "BurgerForge",
      kitchenId: "K1",
      channel: "Zomato",
      source: "ZOMATO",
      status: "CANCELLED",
      priority: "NORMAL",
      customerName: "Vikrant Massey",
      totalAmount: 349,
      itemCount: 1,
      createdAt: minAgo(40),
      updatedAt: minAgo(29),
      receivedAt: minAgo(40),
      prepStartedAt: minAgo(36),
      cancelledAt: minAgo(29),
      cancellationSource: "CUSTOMER",
      cancellationReason: "Customer cancelled mid-preparation on aggregator app",
      cancelledBy: "0001 (Priya Sharma)",
      cancellationStage: "DURING_OR_AFTER_PREP",
      cancellationResolution: "FOOD_AND_LABOR_LOSS",
      lossAmount: 273,
      claimAmount: 0,
      inventoryDecision: "AVAILABLE",
      inventoryConsumed: true,
      items: [
        {
          id: "ORD-908-1",
          menuItemId: "MENU-BF-01",
          name: "Double Smash Burger",
          quantity: 1,
          price: 349,
          station: "Grill",
        },
      ],
      events: [
        {
          id: "EVT-908-1",
          type: "RECEIVED",
          timestamp: minAgo(40),
          actor: "ZOMATO_WEBHOOK",
        },
        {
          id: "EVT-908-2",
          type: "PREPARING",
          timestamp: minAgo(36),
          actor: "2001 (Rajesh Kumar)",
          details: "Ingredients depleted from K1 inventory.",
        },
        {
          id: "EVT-908-3",
          type: "CANCELLED",
          timestamp: minAgo(29),
          actor: "0001 (Priya Sharma)",
          details: "Mid-prep cancellation logged as Food & Labor Loss (₹273 total: ₹198 COGS + ₹75 labor).",
        },
      ],
    },
  ];

  const seedMovements: InventoryMovement[] = [
    {
      id: "MOV-101",
      inventoryItemId: "INV-005",
      itemName: "Jumbo Chicken Wings",
      sku: "WING-01",
      kitchenId: "K1",
      type: "SALE_CONSUMPTION",
      quantity: -12,
      previousStock: 362,
      newStock: 350,
      unit: "units",
      costImpact: 216,
      orderId: "ORD-903",
      actor: "2001 (Rajesh Kumar)",
      reason: "Recipe consumption for ORD-903 (12pc Ghost Pepper Wings)",
      timestamp: minAgo(9),
    },
    {
      id: "MOV-102",
      inventoryItemId: "INV-006",
      itemName: "Ghost Pepper Glaze",
      sku: "GHOST-01",
      kitchenId: "K1",
      type: "SALE_CONSUMPTION",
      quantity: -120,
      previousStock: 480,
      newStock: 360,
      unit: "ml",
      costImpact: 60,
      orderId: "ORD-903",
      actor: "2001 (Rajesh Kumar)",
      reason: "Recipe consumption for ORD-903 (low-stock threshold breached)",
      timestamp: minAgo(9),
    },
    {
      id: "MOV-103",
      inventoryItemId: "INV-007",
      itemName: "Sashimi Grade Ahi Tuna",
      sku: "TUNA-01",
      kitchenId: "K1",
      type: "SALE_CONSUMPTION",
      quantity: -0.4,
      previousStock: 14.4,
      newStock: 14,
      unit: "kg",
      costImpact: 480,
      orderId: "ORD-904",
      actor: "2001 (Rajesh Kumar)",
      reason: "Recipe consumption for ORD-904 (2x Ahi Tuna Poke Bowl)",
      timestamp: minAgo(17),
    },
    {
      id: "MOV-104",
      inventoryItemId: "INV-001",
      itemName: "Angus Beef Patties",
      sku: "BEEF-01",
      kitchenId: "K1",
      type: "LOSS",
      quantity: -2,
      previousStock: 142,
      newStock: 140,
      unit: "units",
      costImpact: 170,
      orderId: "ORD-908",
      actor: "0001 (Priya Sharma)",
      reason: "Mid-prep cancellation food loss on ORD-908 (unrecoverable cooked protein)",
      timestamp: minAgo(29),
    },
  ];

  const seedCancellations: CancellationRecord[] = [
    {
      id: "CAN-001",
      orderId: "ORD-908",
      brandId: "BurgerForge",
      kitchenId: "K1",
      channel: "Zomato",
      stage: "DURING_OR_AFTER_PREP",
      previousStatus: "PREPARING",
      resolution: "FOOD_AND_LABOR_LOSS",
      source: "CUSTOMER",
      reason: "Customer cancelled mid-preparation on aggregator app",
      actor: "0001 (Priya Sharma)",
      timestamp: minAgo(29),
      financialLoss: 273,
      claimAmount: 0,
      restoredIngredients: [],
      lostIngredients: [
        { inventoryItemId: "INV-001", name: "Angus Beef Patties", quantity: 2 },
        { inventoryItemId: "INV-002", name: "Brioche Buns", quantity: 1 },
      ],
    },
  ];

  const seedActivities: OperationalActivity[] = [
    {
      id: "ACT-001",
      type: "ORDER_PICKED_UP",
      category: "DISPATCH",
      title: "ORD-906 Picked Up by Courier",
      details: "Suresh Solanki picked up TacoMatrix order at K1 Gurugram Central Hub.",
      actor: "3001 (Arjun Mehta)",
      orderId: "ORD-906",
      kitchenId: "K1",
      brandId: "TacoMatrix",
      timestamp: minAgo(2),
      severity: "info",
    },
    {
      id: "ACT-002",
      type: "DRIVER_ASSIGNED",
      category: "DISPATCH",
      title: "Driver Assigned to ORD-905",
      details: "Deepak Yadav assigned (ETA 6 mins) at K2 Noida Sector 62.",
      actor: "3002 (Karan Saxena)",
      orderId: "ORD-905",
      kitchenId: "K2",
      brandId: "BurgerForge",
      timestamp: minAgo(4),
      severity: "info",
    },
    {
      id: "ACT-003",
      type: "ORDER_CREATED",
      category: "ORDER",
      title: "ORD-902 Injected (Zomato)",
      details: "TacoMatrix order for Meera Nair validated against BrandKitchen K1.",
      actor: "ZOMATO_WEBHOOK",
      orderId: "ORD-902",
      kitchenId: "K1",
      brandId: "TacoMatrix",
      timestamp: minAgo(4),
      severity: "success",
    },
    {
      id: "ACT-004",
      type: "INVENTORY_WARNING",
      category: "INVENTORY",
      title: "Low Stock Alert: Brioche Buns & Ghost Pepper Glaze",
      details: "Brioche Buns (18 units) and Ghost Pepper Glaze (360 ml) below reorder threshold.",
      actor: "SYSTEM",
      orderId: "ORD-901",
      kitchenId: "K1",
      brandId: "BurgerForge",
      timestamp: minAgo(6),
      severity: "warning",
    },
    {
      id: "ACT-005",
      type: "ORDER_READY",
      category: "ORDER",
      title: "ORD-904 Ready for Pickup",
      details: "2x Ahi Tuna Poke Bowl completed on Cold Prep station.",
      actor: "2001 (Rajesh Kumar)",
      orderId: "ORD-904",
      kitchenId: "K1",
      brandId: "GreenBowl",
      timestamp: minAgo(7),
      severity: "success",
    },
    {
      id: "ACT-006",
      type: "INVENTORY_DEPLETED",
      category: "INVENTORY",
      title: "Atomic Recipe Depletion (ORD-903)",
      details: "Deducted 12 Jumbo Chicken Wings and 120 ml Ghost Pepper Glaze on PENDING -> PREPARING.",
      actor: "2001 (Rajesh Kumar)",
      orderId: "ORD-903",
      kitchenId: "K1",
      brandId: "WingProtocol",
      timestamp: minAgo(9),
      severity: "info",
    },
    {
      id: "ACT-007",
      type: "LOSS_RECORDED",
      category: "CANCELLATION",
      title: "Mid-Prep Cancellation Loss (ORD-908)",
      details: "Logged ₹273 Food & Labor Loss; prepared ingredients blocked from inventory return.",
      actor: "0001 (Priya Sharma)",
      orderId: "ORD-908",
      kitchenId: "K1",
      brandId: "BurgerForge",
      timestamp: minAgo(29),
      severity: "error",
    },
  ];

  const seedWebhooks: WebhookIdempotencyEntry[] = seedOrders.map((o) => ({
    idempotencyKey: o.idempotencyKey ?? `idem-${o.id.toLowerCase()}`,
    orderId: o.id,
    status: "completed",
    channel: o.channel,
    brandId: o.brandId,
    kitchenId: o.kitchenId,
    payloadSummary: `${o.brandId} • ${o.items.length} item(s) • ${formatCurrency(o.totalAmount ?? 0, "INR")}`,
    createdAt: o.createdAt,
    hitCount: 1,
  }));

  const seedOutbox: OutboxEvent[] = [
    {
      id: "OUT-501",
      eventType: "aggregator.order.accepted",
      aggregateId: "ORD-901",
      payload: JSON.stringify({ orderId: "ORD-901", channel: "Swiggy", status: "ACCEPTED" }),
      attempt: 1,
      maxAttempts: 6,
      backoffSchedule: "Immediate (0s)",
      status: "DELIVERED",
      createdAt: minAgo(6),
    },
    {
      id: "OUT-502",
      eventType: "kds.inventory.low_stock_alert",
      aggregateId: "INV-006",
      payload: JSON.stringify({ sku: "GHOST-01", stock: 360, threshold: 600 }),
      attempt: 2,
      maxAttempts: 6,
      backoffSchedule: "+10 seconds",
      status: "DELIVERED",
      createdAt: minAgo(9),
    },
    {
      id: "OUT-503",
      eventType: "kitchen.variance.loss_logged",
      aggregateId: "ORD-908",
      payload: JSON.stringify({ orderId: "ORD-908", stage: "DURING_OR_AFTER_PREP", lossInr: 273 }),
      attempt: 1,
      maxAttempts: 6,
      backoffSchedule: "Immediate (0s)",
      status: "DELIVERED",
      createdAt: minAgo(29),
    },
  ];

  return {
    orders: seedOrders,
    inventory: INVENTORY_DB.map((item) => ({ ...item })),
    inventoryMovements: seedMovements,
    cancellations: seedCancellations,
    activities: seedActivities,
    brands: BRANDS_DB.map((b) => ({ ...b })),
    kitchens: KITCHENS_DB.map((k) => ({ ...k })),
    brandKitchens: BRAND_KITCHENS_DB.map((bk) => ({ ...bk })),
    menuCatalog: MENU_CATALOG.map((m) => ({
      ...m,
      recipe: m.recipe.map((r) => ({ ...r })),
    })),
    employees: EMPLOYEES_DB.map((e) => ({ ...e })),
    webhookEvents: seedWebhooks,
    outboxEvents: seedOutbox,
    leakageVectors: INITIAL_LEAKAGE_VECTORS.map((l) => ({ ...l })),
    files: INITIAL_FILES.map((f) => ({ ...f })),
    settings: { ...DEFAULT_SETTINGS },
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __darkit_os_store__: KitchenState | undefined;
}

function getGlobalState(): KitchenState {
  if (!globalThis.__darkit_os_store__) {
    globalThis.__darkit_os_store__ = buildInitialSeedState();
  }
  return globalThis.__darkit_os_store__;
}

function cloneOrder(order: Order): Order {
  return {
    ...order,
    items: order.items.map((item) => ({ ...item })),
    events: order.events.map((event) => ({ ...event })),
    inventoryWarnings: order.inventoryWarnings
      ? [...order.inventoryWarnings]
      : undefined,
    inventoryUnavailable: order.inventoryUnavailable
      ? [...order.inventoryUnavailable]
      : undefined,
  };
}

function cloneInventoryItem(item: InventoryItem): InventoryItem {
  return { ...item };
}

function cloneState(state: KitchenState): KitchenState {
  return {
    orders: state.orders.map(cloneOrder),
    inventory: state.inventory.map(cloneInventoryItem),
    inventoryMovements: state.inventoryMovements.map((m) => ({ ...m })),
    cancellations: state.cancellations.map((c) => ({
      ...c,
      restoredIngredients: c.restoredIngredients.map((i) => ({ ...i })),
      lostIngredients: c.lostIngredients.map((i) => ({ ...i })),
      dispatchEvidence: c.dispatchEvidence
        ? { ...c.dispatchEvidence }
        : undefined,
    })),
    activities: state.activities.map((a) => ({ ...a })),
    brands: state.brands.map((b) => ({ ...b })),
    kitchens: state.kitchens.map((k) => ({ ...k })),
    brandKitchens: state.brandKitchens.map((bk) => ({ ...bk })),
    menuCatalog: state.menuCatalog.map((m) => ({
      ...m,
      recipe: m.recipe.map((r) => ({ ...r })),
    })),
    employees: state.employees.map((e) => ({ ...e })),
    webhookEvents: state.webhookEvents.map((w) => ({ ...w })),
    outboxEvents: state.outboxEvents.map((o) => ({ ...o })),
    leakageVectors: state.leakageVectors.map((l) => ({ ...l })),
    files: state.files.map((f) => ({ ...f })),
    settings: { ...state.settings },
  };
}

export function getOrders(): Order[] {
  return getGlobalState().orders.map(cloneOrder);
}

export function getInventory(): InventoryItem[] {
  return getGlobalState().inventory.map(cloneInventoryItem);
}

export function getInventoryMovements(): InventoryMovement[] {
  return getGlobalState().inventoryMovements.map((m) => ({ ...m }));
}

export function getCancellations(): CancellationRecord[] {
  return getGlobalState().cancellations.map((c) => ({
    ...c,
    restoredIngredients: c.restoredIngredients.map((r) => ({ ...r })),
    lostIngredients: c.lostIngredients.map((l) => ({ ...l })),
    dispatchEvidence: c.dispatchEvidence
      ? { ...c.dispatchEvidence }
      : undefined,
  }));
}

export function getActivities(): OperationalActivity[] {
  return getGlobalState().activities.map((a) => ({ ...a }));
}

export function getBrands(): BrandConfig[] {
  return getGlobalState().brands.map((b) => ({ ...b }));
}

export function getKitchens(): KitchenConfig[] {
  return getGlobalState().kitchens.map((k) => ({ ...k }));
}

export function getBrandKitchens(): BrandKitchenConfig[] {
  return getGlobalState().brandKitchens.map((bk) => ({ ...bk }));
}

export function getMenuCatalog(): MenuItem[] {
  return getGlobalState().menuCatalog.map((m) => ({
    ...m,
    recipe: m.recipe.map((r) => ({ ...r })),
  }));
}

export function getEmployees(): Employee[] {
  return getGlobalState().employees.map((e) => ({ ...e }));
}

export function getSettings(): SystemSettings {
  return { ...getGlobalState().settings };
}

export function getFiles(): VirtualFileAsset[] {
  return getGlobalState().files.map((f) => ({ ...f }));
}

export function getLeakageVectors(): RevenueLeakageVector[] {
  return getGlobalState().leakageVectors.map((l) => ({ ...l }));
}

export function getWebhookEvents(): WebhookIdempotencyEntry[] {
  return getGlobalState().webhookEvents.map((w) => ({ ...w }));
}

export function getOutboxEvents(): OutboxEvent[] {
  return getGlobalState().outboxEvents.map((o) => ({ ...o }));
}

export function getStoreSnapshot(): StoreSnapshot {
  return cloneState(getGlobalState());
}

export function addOrder(order: Order): Order {
  const state = getGlobalState();
  const storedOrder = cloneOrder(order);
  state.orders.unshift(storedOrder);
  return cloneOrder(storedOrder);
}

export function replaceOrders(orders: Order[]): void {
  getGlobalState().orders = orders.map(cloneOrder);
}

export function replaceInventory(inventory: InventoryItem[]): void {
  getGlobalState().inventory = inventory.map(cloneInventoryItem);
}

export function findOrder(orderId: string): Order | undefined {
  const order = getGlobalState().orders.find(
    (item) => item.id === orderId,
  );
  return order ? cloneOrder(order) : undefined;
}

export function updateOrder(
  orderId: string,
  updater: (order: Order) => Order,
): Order {
  const state = getGlobalState();
  const index = state.orders.findIndex(
    (order) => order.id === orderId,
  );

  if (index === -1) {
    throw new Error(`Order not found: ${orderId}`);
  }

  const currentOrder = cloneOrder(state.orders[index]);
  const updatedOrder = updater(currentOrder);
  state.orders[index] = cloneOrder(updatedOrder);

  return cloneOrder(updatedOrder);
}

export function updateInventory(
  updater: (inventory: InventoryItem[]) => InventoryItem[],
): InventoryItem[] {
  const currentInventory = getInventory();
  const updatedInventory = updater(currentInventory);
  replaceInventory(updatedInventory);
  return getInventory();
}

export function transaction<T>(
  callback: (state: KitchenState) => T,
): T {
  const state = getGlobalState();
  const backup = cloneState(state);

  try {
    return callback(state);
  } catch (error) {
    globalThis.__darkit_os_store__ = backup;
    throw error;
  }
}

export function replaceState(state: KitchenState): void {
  globalThis.__darkit_os_store__ = cloneState(state);
}

export function resetStore(): void {
  globalThis.__darkit_os_store__ = buildInitialSeedState();
}

export function clearOrdersStore(): void {
  const state = getGlobalState();
  state.orders = [];
  state.cancellations = [];
  state.webhookEvents = [];
  state.outboxEvents = [];
  state.activities.unshift({
    id: `ACT-${Date.now()}`,
    type: "STORE_CLEARED",
    category: "SYSTEM",
    title: "Active Order Queue Cleared",
    details:
      "All orders, cancellations, webhook receipts, and outbox items cleared to demonstrate honest empty states across stations.",
    actor: "SYSTEM",
    timestamp: new Date().toISOString(),
    severity: "warning",
  });
}

export function recordActivity(
  entry: Omit<OperationalActivity, "id" | "timestamp"> & {
    timestamp?: string;
  },
): OperationalActivity {
  const state = getGlobalState();
  const created: OperationalActivity = {
    ...entry,
    id: `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: entry.timestamp ?? new Date().toISOString(),
  };
  state.activities.unshift(created);
  if (state.activities.length > 200) {
    state.activities = state.activities.slice(0, 200);
  }
  return created;
}

const CHANNEL_SOURCE_MAP: Record<OrderChannel, OrderSource> = {
  Swiggy: "SWIGGY",
  Zomato: "ZOMATO",
  DoorDash: "DOORDASH",
  UberEats: "UBEREATS",
  GrubHub: "GRUBHUB",
  "Direct Web": "DIRECT_WEB",
};

export interface InjectOrderInput {
  id?: string;
  externalOrderId?: string;
  idempotencyKey?: string;
  brandId: DbaBrand;
  kitchenId: string;
  channel: OrderChannel;
  source?: OrderSource;
  priority?: "NORMAL" | "RUSH" | "VIP";
  customerName?: string;
  notes?: string;
  items: {
    id?: string;
    menuItemId: string;
    name?: string;
    quantity: number;
    notes?: string;
  }[];
  actor: string;
}

export interface InjectOrderResult {
  order: Order;
  idempotentReplay: boolean;
  inventoryDecision: InventoryDecision;
  inventoryWarnings: string[];
  inventoryUnavailable: string[];
}

export function injectCanonicalOrder(
  input: InjectOrderInput,
): InjectOrderResult {
  return transaction((state) => {
    const now = new Date().toISOString();

    // 1. Validate Brand
    const brand = state.brands.find(
      (b) => b.id === input.brandId && b.active,
    );
    if (!brand) {
      throw new Error(
        `Invalid or inactive virtual brand: ${input.brandId}`,
      );
    }

    // 2. Validate Kitchen
    const kitchen = state.kitchens.find(
      (k) => k.id === input.kitchenId && k.active,
    );
    if (!kitchen) {
      throw new Error(
        `Invalid or inactive physical kitchen: ${input.kitchenId}`,
      );
    }

    // 3. Enforce Canonical BrandKitchen Mapping
    const mapping = state.brandKitchens.find(
      (bk) =>
        bk.brandId === input.brandId &&
        bk.kitchenId === input.kitchenId &&
        bk.active,
    );
    if (!mapping) {
      throw new Error(
        `BrandKitchen violation: ${input.brandId} is not authorized to operate out of kitchen ${input.kitchenId}.`,
      );
    }

    // 4. Two-Phase Atomic Idempotency Check (Webhook Deduplication)
    const idemKey = input.idempotencyKey?.trim();
    if (idemKey) {
      const existingWebhook = state.webhookEvents.find(
        (w) => w.idempotencyKey === idemKey,
      );
      if (existingWebhook) {
        existingWebhook.hitCount += 1;
        const existingOrder = state.orders.find(
          (o) => o.id === existingWebhook.orderId,
        );
        if (existingOrder) {
          recordActivity({
            type: "WEBHOOK_DEDUPLICATED",
            category: "CLOUD7",
            title: `Idempotent Replay Blocked (${idemKey})`,
            details: `Duplicate webhook payload intercepted via ON CONFLICT DO NOTHING. Returned cached order ${existingOrder.id} (Hit #${existingWebhook.hitCount}).`,
            actor: input.actor,
            orderId: existingOrder.id,
            kitchenId: existingOrder.kitchenId,
            brandId: existingOrder.brandId,
            severity: "warning",
          });
          return {
            order: cloneOrder(existingOrder),
            idempotentReplay: true,
            inventoryDecision:
              existingOrder.inventoryDecision ?? "AVAILABLE",
            inventoryWarnings:
              existingOrder.inventoryWarnings ?? [],
            inventoryUnavailable:
              existingOrder.inventoryUnavailable ?? [],
          };
        }
      }
    }

    // 5. Resolve OrderItems against MenuCatalog
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new Error("Order must contain at least one menu item.");
    }

    let orderId = input.id?.trim();
    if (orderId) {
      if (state.orders.some((o) => o.id === orderId)) {
        throw new Error(`Order ID already exists: ${orderId}`);
      }
    } else {
      let attempts = 0;
      do {
        const suffix = Math.floor(1000 + Math.random() * 9000);
        orderId =
          attempts < 20
            ? `ORD-${suffix}`
            : `ORD-${Date.now().toString().slice(-6)}-${suffix}`;
        attempts += 1;
      } while (state.orders.some((o) => o.id === orderId));
    }

    const resolvedItems: OrderItem[] = input.items.map(
      (raw, idx) => {
        const menu = state.menuCatalog.find(
          (m) =>
            m.id === raw.menuItemId ||
            m.name === raw.name,
        );
        if (!menu) {
          throw new Error(
            `Menu item not found in catalog: ${raw.menuItemId || raw.name}`,
          );
        }
        if (menu.brandId !== input.brandId) {
          throw new Error(
            `Menu item ${menu.name} belongs to ${menu.brandId}, not ${input.brandId}.`,
          );
        }
        const qty = Math.max(1, Math.floor(Number(raw.quantity) || 1));
        return {
          id: raw.id || `${orderId}-ITEM-${idx + 1}`,
          menuItemId: menu.id,
          name: menu.name,
          quantity: qty,
          price: menu.price,
          notes: raw.notes?.trim() || input.notes?.trim() || undefined,
          station: menu.station,
        };
      },
    );

    const totalAmount = calculateOrderTotalAmount(
      resolvedItems,
      state.menuCatalog,
    );
    const itemCount = resolvedItems.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    const channel: OrderChannel =
      CHANNEL_SOURCE_MAP[input.channel]
        ? input.channel
        : "Direct Web";

    const draftOrder: Order = {
      id: orderId,
      externalOrderId:
        input.externalOrderId ||
        `${channel.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`,
      idempotencyKey:
        idemKey || `idem-${orderId.toLowerCase()}`,
      brandId: input.brandId,
      kitchenId: input.kitchenId,
      channel,
      source:
        input.source ||
        CHANNEL_SOURCE_MAP[channel] ||
        "MANUAL",
      status: "PENDING",
      priority: input.priority || "NORMAL",
      items: resolvedItems,
      totalAmount,
      itemCount,
      notes: input.notes?.trim() || undefined,
      customerName:
        input.customerName?.trim() ||
        "Walk-In / Aggregator Guest",
      createdAt: now,
      updatedAt: now,
      receivedAt: now,
      inventoryConsumed: false,
      events: [],
    };

    // 6. Evaluate Inventory Availability
    const evaluation = evaluateOrderInventory(
      draftOrder,
      state.inventory,
      state.menuCatalog,
    );

    draftOrder.inventoryDecision = evaluation.inventoryDecision;
    draftOrder.inventoryWarnings =
      evaluation.lowStockItems.length > 0
        ? evaluation.lowStockItems
        : undefined;
    draftOrder.inventoryUnavailable =
      evaluation.insufficientStockItems.length > 0
        ? evaluation.insufficientStockItems
        : undefined;

    const events: OrderEvent[] = [
      {
        id: `${orderId}-EVT-1`,
        type: "RECEIVED",
        timestamp: now,
        actor: input.actor,
        details: `Order injected via ${channel} for ${input.brandId} at ${kitchen.name}.`,
      },
      {
        id: `${orderId}-EVT-2`,
        type: "INVENTORY_CHECKED",
        timestamp: now,
        actor: "SYSTEM",
        details: `Inventory evaluation: ${evaluation.inventoryDecision}.`,
      },
    ];

    if (evaluation.lowStockItems.length > 0) {
      events.push({
        id: `${orderId}-EVT-LOW`,
        type: "INVENTORY_WARNING",
        timestamp: now,
        actor: "SYSTEM",
        details: `Low stock warning for: ${evaluation.lowStockItems.join(", ")}.`,
      });
    }

    if (evaluation.insufficientStockItems.length > 0) {
      events.push({
        id: `${orderId}-EVT-UNAVAIL`,
        type: "INVENTORY_UNAVAILABLE",
        timestamp: now,
        actor: "SYSTEM",
        details: `Insufficient stock for: ${evaluation.insufficientStockItems.join(", ")}.`,
      });
    }

    draftOrder.events = events;

    // 7. Save Order, Webhook Idempotency Record, and Transactional Outbox Event
    state.orders.unshift(cloneOrder(draftOrder));

    state.webhookEvents.unshift({
      idempotencyKey: draftOrder.idempotencyKey!,
      orderId: draftOrder.id,
      status: "completed",
      channel: draftOrder.channel,
      brandId: draftOrder.brandId,
      kitchenId: draftOrder.kitchenId,
      payloadSummary: `${draftOrder.brandId} • ${itemCount} item(s) • ${formatCurrency(totalAmount, state.settings.currency)}`,
      createdAt: now,
      hitCount: 1,
    });

    state.outboxEvents.unshift({
      id: `OUT-${Date.now().toString().slice(-5)}`,
      eventType: "aggregator.order.created",
      aggregateId: draftOrder.id,
      payload: JSON.stringify({
        orderId: draftOrder.id,
        brandId: draftOrder.brandId,
        kitchenId: draftOrder.kitchenId,
        inventoryDecision: evaluation.inventoryDecision,
      }),
      attempt: 1,
      maxAttempts: 6,
      backoffSchedule: "Immediate (0s)",
      status: "DELIVERED",
      createdAt: now,
    });

    recordActivity({
      type: "ORDER_CREATED",
      category: "ORDER",
      title: `Order ${draftOrder.id} Injected (${draftOrder.brandId})`,
      details: `${itemCount} item(s) (${formatCurrency(totalAmount, state.settings.currency)}) via ${draftOrder.channel} → ${kitchen.name} (${evaluation.inventoryDecision}).`,
      actor: input.actor,
      orderId: draftOrder.id,
      kitchenId: draftOrder.kitchenId,
      brandId: draftOrder.brandId,
      timestamp: now,
      severity:
        evaluation.inventoryDecision === "INSUFFICIENT_STOCK"
          ? "error"
          : evaluation.inventoryDecision === "LOW_STOCK"
            ? "warning"
            : "success",
    });

    return {
      order: cloneOrder(draftOrder),
      idempotentReplay: false,
      inventoryDecision: evaluation.inventoryDecision,
      inventoryWarnings: evaluation.lowStockItems,
      inventoryUnavailable: evaluation.insufficientStockItems,
    };
  });
}

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["DRIVER_ASSIGNED", "CANCELLED"],
  DRIVER_ASSIGNED: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["CANCELLED"],
  CANCELLED: [],
};

export interface TransitionOrderInput {
  orderId: string;
  nextStatus: OrderStatus;
  actor: string;
  driverName?: string;
  courierEtaMins?: number;
  cancellationSource?: CancellationSource;
  cancellationReason?: string;
  restoreInventoryOnPrePrepCancel?: boolean;
}

export interface TransitionOrderResult {
  order: Order;
  idempotentReplay: boolean;
  depletedItems?: string[];
  lowStockAlerts?: string[];
  cancellationRecord?: CancellationRecord;
}

export function transitionCanonicalOrder(
  input: TransitionOrderInput,
): TransitionOrderResult {
  let blockedInsufficientStock: string[] | null = null;

  const result = transaction((state) => {
    const index = state.orders.findIndex(
      (o) => o.id === input.orderId,
    );
    if (index === -1) {
      throw new Error(`Order not found: ${input.orderId}`);
    }

    const currentOrder = cloneOrder(state.orders[index]);
    const now = new Date().toISOString();

    // Idempotent handling if already in the target status (including repeated cancellation)
    if (currentOrder.status === input.nextStatus) {
      const existingCancel =
        input.nextStatus === "CANCELLED"
          ? state.cancellations.find(
              (c) => c.orderId === currentOrder.id,
            )
          : undefined;
      return {
        order: currentOrder,
        idempotentReplay: true,
        cancellationRecord: existingCancel,
      };
    }

    const allowed = VALID_TRANSITIONS[currentOrder.status] ?? [];
    if (!allowed.includes(input.nextStatus)) {
      throw new Error(
        `Invalid status transition: ${currentOrder.status} -> ${input.nextStatus}`,
      );
    }

    // Handle CANCELLATION across all 3 canonical stages
    if (input.nextStatus === "CANCELLED") {
      return executeStageAwareCancellation(
        state,
        currentOrder,
        index,
        input,
        now,
      );
    }

    let depletedItems: string[] = [];
    let lowStockAlerts: string[] = [];

    // Handle PENDING -> PREPARING (Atomic Inventory Consumption Engine)
    if (input.nextStatus === "PREPARING") {
      if (!currentOrder.inventoryConsumed) {
        const requirements = getRequiredIngredients(
          currentOrder,
          state.menuCatalog,
        );
        const depletion = processOrderDepletion(
          currentOrder,
          state.inventory,
          state.menuCatalog,
        );

        if (
          depletion.inventoryDecision ===
          "INSUFFICIENT_STOCK"
        ) {
          // Persist the audit event & inventoryDecision cleanly while keeping stock untouched,
          // then throw AFTER the transaction commits so the audit trail is NOT rolled back.
          currentOrder.inventoryDecision = "INSUFFICIENT_STOCK";
          currentOrder.inventoryUnavailable =
            depletion.insufficientStockItems;
          currentOrder.updatedAt = now;
          currentOrder.events.push({
            id: `${currentOrder.id}-EVT-${Date.now()}`,
            type: "INVENTORY_UNAVAILABLE",
            timestamp: now,
            actor: input.actor,
            details: `Preparation blocked due to insufficient stock: ${depletion.insufficientStockItems.join(", ")}`,
          });
          state.orders[index] = cloneOrder(currentOrder);
          recordActivity({
            type: "INVENTORY_BLOCKED",
            category: "INVENTORY",
            title: `${currentOrder.id} Prep Blocked (Out of Stock)`,
            details: `Insufficient inventory prevented PENDING -> PREPARING: ${depletion.insufficientStockItems.join(", ")}.`,
            actor: input.actor,
            orderId: currentOrder.id,
            kitchenId: currentOrder.kitchenId,
            brandId: currentOrder.brandId,
            timestamp: now,
            severity: "error",
          });
          blockedInsufficientStock = depletion.insufficientStockItems;
          return {
            order: cloneOrder(currentOrder),
            idempotentReplay: false,
          };
        }

        // Record inventory movements for each ingredient consumed
        for (const [invId, reqQty] of requirements) {
          if (reqQty <= 0) continue;
          const beforeItem = state.inventory.find(
            (i) => i.id === invId,
          );
          const afterItem = depletion.updatedInventory.find(
            (i) => i.id === invId,
          );
          if (beforeItem && afterItem) {
            state.inventoryMovements.unshift({
              id: `MOV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              inventoryItemId: beforeItem.id,
              itemName: beforeItem.name,
              sku: beforeItem.sku,
              kitchenId: currentOrder.kitchenId,
              type: "SALE_CONSUMPTION",
              quantity: -reqQty,
              previousStock: beforeItem.currentStock,
              newStock: afterItem.currentStock,
              unit: beforeItem.unit,
              costImpact: Number(
                (reqQty * beforeItem.costPerUnit).toFixed(2),
              ),
              orderId: currentOrder.id,
              actor: input.actor,
              reason: `Recipe consumption on PENDING -> PREPARING for ${currentOrder.id}`,
              timestamp: now,
            });
          }
        }

        state.inventory = depletion.updatedInventory;
        currentOrder.inventoryConsumed = true;
        currentOrder.inventoryDecision =
          depletion.inventoryDecision;
        currentOrder.inventoryWarnings =
          depletion.lowStockAlerts.length > 0
            ? depletion.lowStockAlerts
            : currentOrder.inventoryWarnings;
        currentOrder.inventoryUnavailable = undefined;
        depletedItems = depletion.depletedItems;
        lowStockAlerts = depletion.lowStockAlerts;
      }

      currentOrder.prepStartedAt =
        currentOrder.prepStartedAt ?? now;
      currentOrder.acceptedAt =
        currentOrder.acceptedAt ?? now;
    }

    if (input.nextStatus === "READY_FOR_PICKUP") {
      currentOrder.prepCompletedAt =
        currentOrder.prepCompletedAt ?? now;
      currentOrder.readyAt = currentOrder.readyAt ?? now;
    }

    if (input.nextStatus === "DRIVER_ASSIGNED") {
      currentOrder.driverAssignedAt =
        currentOrder.driverAssignedAt ?? now;
      if (input.driverName?.trim()) {
        currentOrder.driverName = input.driverName.trim();
      } else if (!currentOrder.driverName) {
        currentOrder.driverName = "Assigned Fleet Courier";
      }
      if (typeof input.courierEtaMins === "number") {
        currentOrder.courierEtaMins = input.courierEtaMins;
      } else if (
        typeof currentOrder.courierEtaMins !== "number"
      ) {
        currentOrder.courierEtaMins = 12;
      }
    }

    if (input.nextStatus === "PICKED_UP") {
      currentOrder.pickedUpAt =
        currentOrder.pickedUpAt ?? now;
      currentOrder.courierEtaMins = 0;
    }

    if (input.nextStatus === "DISPATCHED") {
      currentOrder.dispatchedAt =
        currentOrder.dispatchedAt ?? now;
    }

    const previousStatus = currentOrder.status;
    currentOrder.status = input.nextStatus;
    currentOrder.updatedAt = now;

    const eventDetails =
      input.nextStatus === "PREPARING"
        ? `Preparation started (${previousStatus} -> PREPARING). Depleted: ${depletedItems.join(", ") || "No raw recipe items"}.`
        : input.nextStatus === "DRIVER_ASSIGNED"
          ? `Driver ${currentOrder.driverName} assigned (ETA ${currentOrder.courierEtaMins}m).`
          : `Order transitioned ${previousStatus} -> ${input.nextStatus}.`;

    currentOrder.events.push({
      id: `${currentOrder.id}-EVT-${Date.now()}`,
      type:
        input.nextStatus === "PENDING"
          ? "RECEIVED"
          : input.nextStatus,
      timestamp: now,
      actor: input.actor,
      details: eventDetails,
    });

    if (lowStockAlerts.length > 0) {
      currentOrder.events.push({
        id: `${currentOrder.id}-EVT-WARN-${Date.now()}`,
        type: "INVENTORY_WARNING",
        timestamp: now,
        actor: "SYSTEM",
        details: `Reorder threshold breached for: ${lowStockAlerts.join(", ")}.`,
      });
    }

    state.orders[index] = cloneOrder(currentOrder);

    recordActivity({
      type: `ORDER_${input.nextStatus}`,
      category:
        input.nextStatus === "DRIVER_ASSIGNED" ||
        input.nextStatus === "PICKED_UP" ||
        input.nextStatus === "DISPATCHED"
          ? "DISPATCH"
          : "ORDER",
      title: `${currentOrder.id} → ${input.nextStatus.replaceAll("_", " ")}`,
      details: eventDetails,
      actor: input.actor,
      orderId: currentOrder.id,
      kitchenId: currentOrder.kitchenId,
      brandId: currentOrder.brandId,
      timestamp: now,
      severity:
        lowStockAlerts.length > 0 ? "warning" : "info",
    });

    return {
      order: cloneOrder(currentOrder),
      idempotentReplay: false,
      depletedItems,
      lowStockAlerts,
    };
  });

  if (blockedInsufficientStock !== null) {
    throw new Error(
      `Insufficient inventory for preparation: ${(blockedInsufficientStock as string[]).join(", ")}`,
    );
  }

  return result;
}

function executeStageAwareCancellation(
  state: KitchenState,
  currentOrder: Order,
  orderIndex: number,
  input: TransitionOrderInput,
  now: string,
): TransitionOrderResult {
  const previousStatus = currentOrder.status;
  const requirements = getRequiredIngredients(
    currentOrder,
    state.menuCatalog,
  );
  const recipeCost = calculateOrderRecipeCost(
    currentOrder,
    state.inventory,
    state.menuCatalog,
  );
  const orderValue =
    currentOrder.totalAmount ??
    calculateOrderTotalAmount(
      currentOrder.items,
      state.menuCatalog,
    );

  let stage: CancellationStage = "BEFORE_PREP";
  let resolution: CancellationResolution =
    "INVENTORY_RESTORED";
  let financialLoss = 0;
  let claimAmount = 0;
  const restoredIngredients: CancellationRecord["restoredIngredients"] =
    [];
  const lostIngredients: CancellationRecord["lostIngredients"] =
    [];

  const shouldRestorePrePrep =
    input.restoreInventoryOnPrePrepCancel !== false;

  if (previousStatus === "PENDING") {
    stage = "BEFORE_PREP";
    if (currentOrder.inventoryConsumed) {
      if (shouldRestorePrePrep) {
        resolution = "INVENTORY_RESTORED";
        for (const [invId, qty] of requirements) {
          const item = state.inventory.find(
            (i) => i.id === invId,
          );
          if (item && qty > 0) {
            const prevStock = item.currentStock;
            item.currentStock = Number(
              (item.currentStock + qty).toFixed(4),
            );
            restoredIngredients.push({
              inventoryItemId: item.id,
              name: item.name,
              quantity: qty,
            });
            state.inventoryMovements.unshift({
              id: `MOV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              inventoryItemId: item.id,
              itemName: item.name,
              sku: item.sku,
              kitchenId: currentOrder.kitchenId,
              type: "CANCELLATION_RESTORE",
              quantity: qty,
              previousStock: prevStock,
              newStock: item.currentStock,
              unit: item.unit,
              costImpact: Number(
                (qty * item.costPerUnit).toFixed(2),
              ),
              orderId: currentOrder.id,
              actor: input.actor,
              reason: `Pre-prep cancellation stock restoration for ${currentOrder.id}`,
              timestamp: now,
            });
          }
        }
        currentOrder.inventoryRestored = true;
      } else {
        resolution = "UNAVOIDABLE_LOSS";
        financialLoss = recipeCost;
        for (const [invId, qty] of requirements) {
          const item = state.inventory.find(
            (i) => i.id === invId,
          );
          if (item && qty > 0) {
            lostIngredients.push({
              inventoryItemId: item.id,
              name: item.name,
              quantity: qty,
            });
          }
        }
      }
    } else {
      // Stock is only deducted on PENDING -> PREPARING. Because inventoryConsumed is false,
      // no ingredients were removed and no food loss occurred (restoredIngredients stays empty).
      resolution = "INVENTORY_RESTORED";
      financialLoss = 0;
    }
  } else if (
    previousStatus === "PREPARING" ||
    previousStatus === "READY_FOR_PICKUP" ||
    previousStatus === "DRIVER_ASSIGNED"
  ) {
    // Mid-production or post-prep cancellation: DO NOT return cooked food to usable inventory!
    stage = "DURING_OR_AFTER_PREP";
    resolution = "FOOD_AND_LABOR_LOSS";
    financialLoss = Number(
      (recipeCost + MID_PREP_LABOR_ALLOWANCE_INR).toFixed(2),
    ); // COGS + ₹75 station labor allocation

    for (const [invId, qty] of requirements) {
      const item = state.inventory.find(
        (i) => i.id === invId,
      );
      if (item && qty > 0) {
        lostIngredients.push({
          inventoryItemId: item.id,
          name: item.name,
          quantity: qty,
        });
        state.inventoryMovements.unshift({
          id: `MOV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          inventoryItemId: item.id,
          itemName: item.name,
          sku: item.sku,
          kitchenId: currentOrder.kitchenId,
          type: "LOSS",
          quantity: 0, // Already deducted on PREPARING; logged as irreversible loss audit
          previousStock: item.currentStock,
          newStock: item.currentStock,
          unit: item.unit,
          costImpact: Number(
            (qty * item.costPerUnit).toFixed(2),
          ),
          orderId: currentOrder.id,
          actor: input.actor,
          reason: `Mid-prep cancellation Food & Labor Loss (${previousStatus}); blocked from usable stock return`,
          timestamp: now,
        });
      }
    }
  } else {
    // PICKED_UP or DISPATCHED -> Post-Pickup Cancellation -> Aggregator / Accounting Claim
    stage = "AFTER_PICKUP";
    resolution = "AGGREGATOR_ACCOUNTING_CLAIM";
    financialLoss = recipeCost;
    claimAmount = orderValue;

    for (const [invId, qty] of requirements) {
      const item = state.inventory.find(
        (i) => i.id === invId,
      );
      if (item && qty > 0) {
        lostIngredients.push({
          inventoryItemId: item.id,
          name: item.name,
          quantity: qty,
        });
      }
    }
  }

  const source: CancellationSource =
    input.cancellationSource ?? "MANUAL";
  const reason =
    input.cancellationReason?.trim() ||
    `Cancelled from ${previousStatus} stage (${resolution})`;

  currentOrder.status = "CANCELLED";
  currentOrder.updatedAt = now;
  currentOrder.cancelledAt = now;
  currentOrder.cancelledBy = input.actor;
  currentOrder.cancellationSource = source;
  currentOrder.cancellationReason = reason;
  currentOrder.cancellationStage = stage;
  currentOrder.cancellationResolution = resolution;
  currentOrder.lossAmount = financialLoss;
  currentOrder.claimAmount = claimAmount;

  const formattedLoss = formatCurrency(
    financialLoss,
    state.settings.currency,
  );
  const formattedClaim = formatCurrency(
    claimAmount,
    state.settings.currency,
  );

  currentOrder.events.push({
    id: `${currentOrder.id}-EVT-CANCEL-${Date.now()}`,
    type: "CANCELLED",
    timestamp: now,
    actor: input.actor,
    details: `Order cancelled at ${previousStatus} (${stage}) -> ${resolution}. Loss: ${formattedLoss}, Claim: ${formattedClaim}.`,
  });

  const cancellationRecord: CancellationRecord = {
    id: `CAN-${Date.now().toString().slice(-6)}`,
    orderId: currentOrder.id,
    brandId: currentOrder.brandId,
    kitchenId: currentOrder.kitchenId,
    channel: currentOrder.channel,
    stage,
    previousStatus,
    resolution,
    source,
    reason,
    actor: input.actor,
    timestamp: now,
    financialLoss,
    claimAmount,
    restoredIngredients,
    lostIngredients,
    dispatchEvidence:
      stage === "AFTER_PICKUP" ||
      currentOrder.driverName ||
      currentOrder.pickedUpAt
        ? {
            driverName: currentOrder.driverName,
            readyAt: currentOrder.readyAt,
            driverAssignedAt:
              currentOrder.driverAssignedAt,
            pickedUpAt: currentOrder.pickedUpAt,
            dispatchedAt: currentOrder.dispatchedAt,
          }
        : undefined,
  };

  state.orders[orderIndex] = cloneOrder(currentOrder);
  state.cancellations.unshift(cancellationRecord);

  recordActivity({
    type: "ORDER_CANCELLED",
    category: "CANCELLATION",
    title: `${currentOrder.id} Cancelled (${stage.replaceAll("_", " ")})`,
    details: `Resolution: ${resolution.replaceAll("_", " ")} • Loss: ${formattedLoss} • Claim: ${formattedClaim}.`,
    actor: input.actor,
    orderId: currentOrder.id,
    kitchenId: currentOrder.kitchenId,
    brandId: currentOrder.brandId,
    timestamp: now,
    severity:
      stage === "BEFORE_PREP" ? "warning" : "error",
  });

  return {
    order: cloneOrder(currentOrder),
    idempotentReplay: false,
    cancellationRecord,
  };
}

export interface InventoryMutationInput {
  itemId: string;
  action:
    | "RESTOCK"
    | "MANUAL_ADJUSTMENT"
    | "WASTE"
    | "LOSS"
    | "SET_STOCK";
  quantity?: number;
  currentStock?: number;
  reason?: string;
  actor: string;
  kitchenId?: string;
}

export function mutateCanonicalInventory(
  input: InventoryMutationInput,
): {
  item: InventoryItem;
  movement: InventoryMovement;
  inventory: InventoryItem[];
} {
  return transaction((state) => {
    const idx = state.inventory.findIndex(
      (i) => i.id === input.itemId,
    );
    if (idx === -1) {
      throw new Error(
        `Inventory item not found: ${input.itemId}`,
      );
    }

    const existing = { ...state.inventory[idx] };
    const previousStock = existing.currentStock;
    const now = new Date().toISOString();

    let nextStock = previousStock;
    let movementType: InventoryMovementType =
      "MANUAL_ADJUSTMENT";
    let delta = 0;

    if (input.action === "SET_STOCK") {
      if (typeof input.currentStock !== "number" || !Number.isFinite(input.currentStock)) {
        throw new Error(
          "SET_STOCK requires a finite numeric currentStock value.",
        );
      }
      nextStock = Number(input.currentStock);
      delta = Number(
        (nextStock - previousStock).toFixed(4),
      );
      movementType =
        delta > 0 ? "RESTOCK" : "MANUAL_ADJUSTMENT";
    } else if (input.action === "RESTOCK") {
      const addQty = Math.abs(Number(input.quantity) || 0);
      if (addQty <= 0) {
        throw new Error(
          "Restock quantity must be greater than 0.",
        );
      }
      delta = addQty;
      nextStock = Number(
        (previousStock + addQty).toFixed(4),
      );
      movementType = "RESTOCK";
    } else if (
      input.action === "WASTE" ||
      input.action === "LOSS"
    ) {
      const lossQty = Math.abs(
        Number(input.quantity) || 0,
      );
      if (lossQty <= 0) {
        throw new Error(
          "Waste/Loss quantity must be greater than 0.",
        );
      }
      delta = -Math.min(previousStock, lossQty);
      nextStock = Number(
        Math.max(0, previousStock - lossQty).toFixed(4),
      );
      movementType = input.action;
    } else {
      delta = Number(input.quantity) || 0;
      nextStock = Number(
        Math.max(0, previousStock + delta).toFixed(4),
      );
      movementType = "MANUAL_ADJUSTMENT";
    }

    if (!Number.isFinite(nextStock) || nextStock < 0) {
      throw new Error(
        "Resulting stock must be a non-negative number.",
      );
    }

    const updatedItem: InventoryItem = {
      ...existing,
      currentStock: nextStock,
      lastRestocked:
        nextStock > previousStock
          ? now
          : existing.lastRestocked,
    };

    state.inventory[idx] = updatedItem;

    const movement: InventoryMovement = {
      id: `MOV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      inventoryItemId: updatedItem.id,
      itemName: updatedItem.name,
      sku: updatedItem.sku,
      kitchenId:
        input.kitchenId || updatedItem.kitchenId || "K1",
      type: movementType,
      quantity: delta,
      previousStock,
      newStock: nextStock,
      unit: updatedItem.unit,
      costImpact: Number(
        (
          Math.abs(delta) * updatedItem.costPerUnit
        ).toFixed(2),
      ),
      actor: input.actor,
      reason:
        input.reason?.trim() ||
        `${movementType.replaceAll("_", " ")} (${previousStock} -> ${nextStock} ${updatedItem.unit})`,
      timestamp: now,
    };

    state.inventoryMovements.unshift(movement);

    recordActivity({
      type: `INVENTORY_${movementType}`,
      category: "INVENTORY",
      title: `${updatedItem.name}: ${previousStock} → ${nextStock} ${updatedItem.unit}`,
      details: `${movement.reason} (Cost impact: ${formatCurrency(movement.costImpact, state.settings.currency)})`,
      actor: input.actor,
      kitchenId: movement.kitchenId,
      timestamp: now,
      severity:
        movementType === "WASTE" || movementType === "LOSS"
          ? "error"
          : nextStock <= updatedItem.reorderThreshold
            ? "warning"
            : "success",
    });

    return {
      item: { ...updatedItem },
      movement: { ...movement },
      inventory: state.inventory.map(cloneInventoryItem),
    };
  });
}

export function toggleBrandKitchenMapping(
  brandId: DbaBrand,
  kitchenId: string,
  actor: string,
): BrandKitchenConfig[] {
  return transaction((state) => {
    const existing = state.brandKitchens.find(
      (bk) =>
        bk.brandId === brandId &&
        bk.kitchenId === kitchenId,
    );
    if (existing) {
      existing.active = !existing.active;
    } else {
      state.brandKitchens.push({
        brandId,
        kitchenId,
        active: true,
      });
    }

    const activeState =
      state.brandKitchens.find(
        (bk) =>
          bk.brandId === brandId &&
          bk.kitchenId === kitchenId,
      )?.active ?? false;

    recordActivity({
      type: "BRAND_KITCHEN_UPDATED",
      category: "SYSTEM",
      title: `BrandKitchen Matrix: ${brandId} ↔ ${kitchenId} ${activeState ? "ENABLED" : "DISABLED"}`,
      details: `Production authorization between ${brandId} and ${kitchenId} set to ${activeState}.`,
      actor,
      kitchenId,
      brandId,
      severity: activeState ? "success" : "warning",
    });

    return state.brandKitchens.map((bk) => ({ ...bk }));
  });
}

export function updateMenuCatalogItem(
  item: Partial<MenuItem> & { id: string },
  actor: string,
): MenuItem[] {
  return transaction((state) => {
    if (!item || typeof item.id !== "string" || !item.id.trim()) {
      throw new Error("Menu item id is required.");
    }
    const cleanId = item.id.trim();
    const idx = state.menuCatalog.findIndex(
      (m) => m.id === cleanId,
    );
    if (idx !== -1) {
      const existing = state.menuCatalog[idx];
      const nextPrice =
        typeof item.price === "number" &&
        Number.isFinite(item.price) &&
        item.price > 0
          ? Number(item.price.toFixed(2))
          : existing.price;
      const nextPrep =
        typeof item.prepTimeMins === "number" &&
        Number.isFinite(item.prepTimeMins) &&
        item.prepTimeMins >= 1
          ? Math.round(item.prepTimeMins)
          : existing.prepTimeMins;

      state.menuCatalog[idx] = {
        ...existing,
        name:
          typeof item.name === "string" && item.name.trim()
            ? item.name.trim()
            : existing.name,
        price: nextPrice,
        station:
          typeof item.station === "string" && item.station.trim()
            ? (item.station as MenuItem["station"])
            : existing.station,
        active:
          typeof item.active === "boolean"
            ? item.active
            : existing.active,
        prepTimeMins: nextPrep,
        recipe: Array.isArray(item.recipe)
          ? item.recipe
              .filter(
                (r) =>
                  r &&
                  typeof r.inventoryItemId === "string" &&
                  typeof r.quantityRequired === "number" &&
                  Number.isFinite(r.quantityRequired) &&
                  r.quantityRequired > 0,
              )
              .map((r) => ({
                inventoryItemId: r.inventoryItemId,
                quantityRequired: r.quantityRequired,
              }))
          : existing.recipe,
      };
    } else if (item.brandId && item.name && item.station) {
      const price =
        typeof item.price === "number" &&
        Number.isFinite(item.price) &&
        item.price > 0
          ? Number(item.price.toFixed(2))
          : 299;
      state.menuCatalog.push({
        id: cleanId,
        brandId: item.brandId,
        name: item.name.trim(),
        price,
        station: item.station,
        active: typeof item.active === "boolean" ? item.active : true,
        prepTimeMins:
          typeof item.prepTimeMins === "number" && item.prepTimeMins >= 1
            ? Math.round(item.prepTimeMins)
            : 8,
        recipe: Array.isArray(item.recipe) ? item.recipe : [],
      });
    } else {
      throw new Error(
        `Menu item ${cleanId} not found and missing required brandId, name, or station.`,
      );
    }

    recordActivity({
      type: "MENU_UPDATED",
      category: "SYSTEM",
      title: `Menu Catalog Updated (${cleanId})`,
      details: `Menu item ${item.name || cleanId} updated by ${actor}.`,
      actor,
      brandId: item.brandId,
      severity: "info",
    });

    return state.menuCatalog.map((m) => ({
      ...m,
      recipe: m.recipe.map((r) => ({ ...r })),
    }));
  });
}

export function toggleKitchenActive(
  kitchenId: string,
  actor: string,
): KitchenConfig[] {
  return transaction((state) => {
    const kitchen = state.kitchens.find(
      (k) => k.id === kitchenId,
    );
    if (!kitchen) {
      throw new Error(`Kitchen not found: ${kitchenId}`);
    }
    kitchen.active = !kitchen.active;

    recordActivity({
      type: "KITCHEN_STATUS_CHANGED",
      category: "SYSTEM",
      title: `${kitchen.name} (${kitchen.id}) ${kitchen.active ? "ONLINE" : "MAINTENANCE"}`,
      details: `Physical kitchen facility status toggled by ${actor}.`,
      actor,
      kitchenId,
      severity: kitchen.active ? "success" : "warning",
    });

    return state.kitchens.map((k) => ({ ...k }));
  });
}

export function upsertCanonicalEmployee(
  employee: Partial<Employee> & { employeeCode: string },
  actor: string,
): Employee[] {
  return transaction((state) => {
    if (
      !employee ||
      typeof employee.employeeCode !== "string" ||
      !employee.employeeCode.trim()
    ) {
      throw new Error("employeeCode is required.");
    }
    const cleanCode = employee.employeeCode.trim().toUpperCase();
    if (
      employee.role !== undefined &&
      !ALLOWED_EMPLOYEE_ROLES.has(employee.role)
    ) {
      throw new Error(`Invalid employee role: ${String(employee.role)}`);
    }

    const idx = state.employees.findIndex(
      (e) =>
        (employee.id && e.id === employee.id) ||
        e.employeeCode.toLowerCase() === cleanCode.toLowerCase(),
    );

    if (idx !== -1) {
      const existing = state.employees[idx];
      state.employees[idx] = {
        id: existing.id,
        employeeCode: cleanCode,
        name:
          typeof employee.name === "string" && employee.name.trim()
            ? employee.name.trim()
            : existing.name,
        role: employee.role ?? existing.role,
        kitchenId:
          typeof employee.kitchenId === "string" && employee.kitchenId.trim()
            ? employee.kitchenId.trim()
            : existing.kitchenId,
        active:
          typeof employee.active === "boolean"
            ? employee.active
            : existing.active,
      };
    } else {
      state.employees.push({
        id:
          typeof employee.id === "string" && employee.id.trim()
            ? employee.id.trim()
            : `EMP-${Date.now().toString().slice(-4)}`,
        employeeCode: cleanCode,
        name:
          typeof employee.name === "string" && employee.name.trim()
            ? employee.name.trim()
            : "New Operator",
        role: employee.role ?? "LINE_COOK",
        kitchenId:
          typeof employee.kitchenId === "string" && employee.kitchenId.trim()
            ? employee.kitchenId.trim()
            : "K1",
        active: typeof employee.active === "boolean" ? employee.active : true,
      });
    }

    recordActivity({
      type: "STAFF_UPDATED",
      category: "AUTH",
      title: `Staff Record Updated (${cleanCode})`,
      details: `Employee ${employee.name || cleanCode} updated by ${actor}.`,
      actor,
      kitchenId: employee.kitchenId,
      severity: "info",
    });

    return state.employees.map((e) => ({ ...e }));
  });
}

const ALLOWED_FILE_CATEGORIES: VirtualFileAsset["category"][] = [
  "Owner Brief",
  "Health Certificate",
  "SOP Manual",
  "Menu Photography",
  "Recipe Card",
  "Architecture ADR",
  "Financial Audit",
];

const ALLOWED_FILE_STATUSES: VirtualFileAsset["status"][] = [
  "VERIFIED",
  "PENDING_REVIEW",
  "ARCHIVED",
];

export function upsertVirtualFile(
  file: Partial<VirtualFileAsset> & { name: string },
  actor: string,
): VirtualFileAsset[] {
  return transaction((state) => {
    if (!file || typeof file.name !== "string" || !file.name.trim()) {
      throw new Error("File name is required and must be a non-empty string.");
    }
    const cleanName = file.name.trim();
    const safeCategory =
      file.category && ALLOWED_FILE_CATEGORIES.includes(file.category)
        ? file.category
        : "SOP Manual";
    const safeStatus =
      file.status && ALLOWED_FILE_STATUSES.includes(file.status)
        ? file.status
        : "VERIFIED";

    const now = new Date().toISOString();
    const idx = file.id
      ? state.files.findIndex((f) => f.id === file.id)
      : -1;
    if (idx !== -1) {
      const existing = state.files[idx];
      state.files[idx] = {
        ...existing,
        name: cleanName,
        category: file.category ? safeCategory : existing.category,
        size:
          typeof file.size === "string" && file.size.trim()
            ? file.size.trim()
            : existing.size,
        mimeType:
          typeof file.mimeType === "string" && file.mimeType.trim()
            ? file.mimeType.trim()
            : existing.mimeType,
        kitchenId:
          typeof file.kitchenId === "string" && file.kitchenId.trim()
            ? file.kitchenId.trim()
            : existing.kitchenId,
        brandId: file.brandId ?? existing.brandId,
        status: file.status ? safeStatus : existing.status,
        content:
          typeof file.content === "string"
            ? file.content
            : existing.content,
        updatedAt: now,
      };
    } else {
      const content =
        typeof file.content === "string" && file.content.trim()
          ? file.content
          : `# ${cleanName}\nUploaded to DarKIT OS Virtual File Explorer by ${actor}.`;
      const computedSize =
        typeof file.size === "string" && file.size.trim()
          ? file.size.trim()
          : `${Math.max(0.2, content.length / 1024).toFixed(1)} KB`;
      state.files.unshift({
        id: `FILE-${Date.now().toString().slice(-5)}`,
        name: cleanName,
        category: safeCategory,
        size: computedSize,
        mimeType:
          typeof file.mimeType === "string" && file.mimeType.trim()
            ? file.mimeType.trim()
            : "text/markdown",
        kitchenId:
          typeof file.kitchenId === "string" && file.kitchenId.trim()
            ? file.kitchenId.trim()
            : "K1",
        brandId: file.brandId,
        uploadedBy: actor,
        updatedAt: now,
        status: safeStatus,
        content,
      });
    }

    recordActivity({
      type: "FILE_ASSET_SAVED",
      category: "SYSTEM",
      title: `Virtual Explorer Asset Saved: ${cleanName}`,
      details: `Category: ${safeCategory} • Kitchen: ${file.kitchenId || "GLOBAL"}.`,
      actor,
      kitchenId: file.kitchenId,
      brandId: file.brandId,
      severity: "info",
    });

    return state.files.map((f) => ({ ...f }));
  });
}

export function deleteVirtualFile(
  fileId: string,
  actor: string,
): VirtualFileAsset[] {
  return transaction((state) => {
    if (!fileId || typeof fileId !== "string") {
      throw new Error("fileId is required.");
    }
    const target = state.files.find((f) => f.id === fileId);
    state.files = state.files.filter((f) => f.id !== fileId);
    if (target) {
      recordActivity({
        type: "FILE_ASSET_DELETED",
        category: "SYSTEM",
        title: `Virtual Explorer Asset Deleted: ${target.name}`,
        details: `Removed from operational storage by ${actor}.`,
        actor,
        severity: "warning",
      });
    }
    return state.files.map((f) => ({ ...f }));
  });
}

const ALLOWED_THEMES: SystemSettings["theme"][] = [
  "obsidian",
  "midnight",
  "cyber-emerald",
  "titanium",
];
const ALLOWED_CURRENCIES: SystemSettings["currency"][] = [
  "INR",
  "USD",
  "EUR",
];
const ALLOWED_SYNC_MODES: SystemSettings["syncMode"][] = [
  "WEBSOCKET",
  "SSE",
  "HTTP_POLLING",
];
const ALLOWED_RLS_MODES: SystemSettings["rlsEnforcement"][] = [
  "STRICT_LOCAL_TX",
  "SESSION",
];
const ALLOWED_CIRCUIT_STATES: SystemSettings["circuitBreakerState"][] = [
  "CLOSED",
  "HALF_OPEN",
  "OPEN",
];

export function updateSystemSettings(
  partial: Partial<SystemSettings>,
  actor: string,
): SystemSettings {
  return transaction((state) => {
    const safeLowStockMultiplier =
      typeof partial.lowStockMultiplier === "number" &&
      Number.isFinite(partial.lowStockMultiplier) &&
      partial.lowStockMultiplier >= 0.5 &&
      partial.lowStockMultiplier <= 3
        ? partial.lowStockMultiplier
        : state.settings.lowStockMultiplier;

    const safePrepSla =
      typeof partial.prepSlaMinutes === "number" &&
      Number.isFinite(partial.prepSlaMinutes) &&
      partial.prepSlaMinutes >= 3 &&
      partial.prepSlaMinutes <= 60
        ? partial.prepSlaMinutes
        : state.settings.prepSlaMinutes;

    const safeDispatchSla =
      typeof partial.dispatchSlaMinutes === "number" &&
      Number.isFinite(partial.dispatchSlaMinutes) &&
      partial.dispatchSlaMinutes >= 3 &&
      partial.dispatchSlaMinutes <= 60
        ? partial.dispatchSlaMinutes
        : state.settings.dispatchSlaMinutes;

    const safeRateLimit =
      typeof partial.rateLimitRps === "number" &&
      Number.isFinite(partial.rateLimitRps) &&
      partial.rateLimitRps >= 10 &&
      partial.rateLimitRps <= 5000
        ? partial.rateLimitRps
        : state.settings.rateLimitRps;

    state.settings = {
      currency:
        partial.currency && ALLOWED_CURRENCIES.includes(partial.currency)
          ? partial.currency
          : state.settings.currency,
      timezone:
        typeof partial.timezone === "string" && partial.timezone.trim()
          ? partial.timezone.trim()
          : state.settings.timezone,
      theme:
        partial.theme && ALLOWED_THEMES.includes(partial.theme)
          ? partial.theme
          : state.settings.theme,
      fluidAnimations:
        typeof partial.fluidAnimations === "boolean"
          ? partial.fluidAnimations
          : state.settings.fluidAnimations,
      syncMode:
        partial.syncMode && ALLOWED_SYNC_MODES.includes(partial.syncMode)
          ? partial.syncMode
          : state.settings.syncMode,
      autoAcceptOrders:
        typeof partial.autoAcceptOrders === "boolean"
          ? partial.autoAcceptOrders
          : state.settings.autoAcceptOrders,
      lowStockMultiplier: safeLowStockMultiplier,
      prepSlaMinutes: safePrepSla,
      dispatchSlaMinutes: safeDispatchSla,
      rlsEnforcement:
        partial.rlsEnforcement &&
        ALLOWED_RLS_MODES.includes(partial.rlsEnforcement)
          ? partial.rlsEnforcement
          : state.settings.rlsEnforcement,
      circuitBreakerState:
        partial.circuitBreakerState &&
        ALLOWED_CIRCUIT_STATES.includes(partial.circuitBreakerState)
          ? partial.circuitBreakerState
          : state.settings.circuitBreakerState,
      rateLimitRps: safeRateLimit,
    };

    recordActivity({
      type: "SETTINGS_UPDATED",
      category: "SYSTEM",
      title: "System Preferences Updated",
      details: `Currency: ${state.settings.currency} • Theme: ${state.settings.theme} • Sync: ${state.settings.syncMode} • Prep SLA: ${state.settings.prepSlaMinutes}m.`,
      actor,
      severity: "info",
    });

    return { ...state.settings };
  });
}

export function updateLeakageVectorStatus(
  id: string,
  status: RevenueLeakageVector["status"],
  actor: string,
): RevenueLeakageVector[] {
  return transaction((state) => {
    if (!ALLOWED_LEAKAGE_STATUSES.has(status)) {
      throw new Error(`Invalid leakage status: ${String(status)}`);
    }
    const vector = state.leakageVectors.find(
      (v) => v.id === id,
    );
    if (!vector) {
      throw new Error(`Leakage vector not found: ${id}`);
    }
    vector.status = status;
    if (status === "RECOVERED") {
      vector.actualCollected = vector.potentialRevenue;
      vector.leakedAmount = 0;
    }
    recordActivity({
      type: "LEAKAGE_AUDIT",
      category: "CLOUD7",
      title: `Revenue Leakage Audit (${vector.vector}): ${status}`,
      details: `Cloud-kitchen revenue recovery status updated by ${actor}.`,
      actor,
      severity:
        status === "RECOVERED" ? "success" : "info",
    });
    return state.leakageVectors.map((l) => ({ ...l }));
  });
}
