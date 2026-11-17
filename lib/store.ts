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
  currency: "USD",
  timezone: "Asia/Kolkata",
  theme: "obsidian",
  fluidAnimations: true,
  syncMode: "WEBSOCKET",
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
    vector: "Failed Payments",
    signature:
      "Open invoices with payment_failed status lacking automated dunning follow-ups.",
    impactLevel: "Severe",
    impactNote: "Severe (20-40% of churned MRR)",
    potentialRevenue: 48500,
    actualCollected: 45120,
    leakedAmount: 3380,
    affectedAccounts: 14,
    status: "DETECTED",
  },
  {
    id: "LEAK-02",
    vector: "Expired Discounts",
    signature:
      "Active subscriptions where promotional coupons surpassed intended end dates without nullifiers.",
    impactLevel: "Moderate",
    impactNote: "Moderate (Compounds significantly over time)",
    potentialRevenue: 36200,
    actualCollected: 34490,
    leakedAmount: 1710,
    affectedAccounts: 23,
    status: "AUDITING",
  },
  {
    id: "LEAK-03",
    vector: "Unbilled Usage",
    signature:
      "Active kitchen terminal sessions & metered order volume exceeding invoiced tier quantities.",
    impactLevel: "Moderate",
    impactNote: "Moderate (Overage drift across multi-brand hubs)",
    potentialRevenue: 29400,
    actualCollected: 27980,
    leakedAmount: 1420,
    affectedAccounts: 9,
    status: "DETECTED",
  },
  {
    id: "LEAK-04",
    vector: "Contract-to-Billing Drift",
    signature:
      "Manual brand expansion upgrades executed in CRM failing to trigger billing tier increments.",
    impactLevel: "Moderate",
    impactNote: "Moderate (Sync gap between CRM & Billing)",
    potentialRevenue: 41000,
    actualCollected: 39150,
    leakedAmount: 1850,
    affectedAccounts: 6,
    status: "AUDITING",
  },
  {
    id: "LEAK-05",
    vector: "Lapsed Renewals",
    signature:
      "Annual enterprise kitchen contracts reaching end date without triggering renewal invoice.",
    impactLevel: "High",
    impactNote: "High (Rare but massive per incident)",
    potentialRevenue: 64000,
    actualCollected: 61600,
    leakedAmount: 2400,
    affectedAccounts: 2,
    status: "RECOVERED",
  },
];

const INITIAL_FILES: VirtualFileAsset[] = [
  {
    id: "FILE-ADR-001",
    name: "Cloud7_VerticalForge_DarKITOS_ADR.md",
    category: "Architecture ADR",
    size: "42.8 KB",
    mimeType: "text/markdown",
    kitchenId: "K1",
    uploadedBy: "Patric Revuelto (OWNER-01)",
    updatedAt: "2026-10-11T05:30:00.000Z",
    status: "VERIFIED",
    content: `# Architecture Decision Record: Cloud7, VerticalForge & DarKIT OS\n\n## Layer 1: Cloud7 Infrastructure\n- Shared Database, Shared Schema enforced by PostgreSQL Row-Level Security (RLS).\n- Transaction-mode PgBouncer pooling using \`set_config('app.current_tenant', tenant_id, true)\` (\`is_local = true\`).\n- Edge API Gateway with Sliding-Window Token Bucket Rate Limiting and Circuit Breaker (\`CLOSED -> OPEN -> HALF_OPEN\`).\n- Autonomous Agent Integration via \`wshobson/agents\` (200+ specialist agents).\n\n## Layer 2: VerticalForge Diagnostic Engine\n- Revenue Leakage Formula: \`(Total Potential Revenue - Actual Collected Revenue) / Total Potential Revenue * 100\`.\n- Physical Food Yield Formula: \`(Usable Edible Product Weight / As Purchased Weight) * 100\`.\n\n## Layer 3: DarKIT OS\n- Single Canonical Store & State Machine (\`PENDING -> PREPARING -> READY_FOR_PICKUP -> DRIVER_ASSIGNED -> PICKED_UP -> DISPATCHED\`).\n- Atomic Inventory Consumption on \`PENDING -> PREPARING\`.\n- Stage-Aware Cancellations: Pre-Prep Restoration, Mid-Prep Food/Labor Loss, Post-Pickup Aggregator Accounting Claim.`,
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
    content: `# Standard Operating Procedure: Grill & Fryer Station\n1. Verify core patty temperature reaches 74°C (165°F) prior to assembly.\n2. Log Ghost Pepper Glaze batch weight every 4 hours for VerticalForge yield reconciliation.\n3. Seal all Direct Web and Swiggy bags with tamper-evident thermal tape before marking READY_FOR_PICKUP.`,
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
    content: `{\n  "menuItemId": "MENU-TM-01",\n  "name": "Birria Taco Trio",\n  "asPurchasedWeightLb": 0.625,\n  "usableEdibleWeightLb": 0.50,\n  "targetYieldPct": 80.0,\n  "ingredients": [\n    { "sku": "BIRRIA-01", "qty": 0.5, "unit": "lbs" },\n    { "sku": "TORT-01", "qty": 3, "unit": "units" }\n  ]\n}`,
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
    content: `High-Resolution Aggregator Asset (Swiggy / Zomato / UberEats Approved)\nResolution: 3840x2160px • Color Profile: sRGB\nBrand: BurgerForge (BF) • Item: MENU-BF-01 Double Smash Burger\nLighting: Rim-lit caramelized crust, melted sharp cheddar, toasted brioche bun.`,
  },
  {
    id: "FILE-AUD-006",
    name: "VerticalForge_Q4_Variance_Audit.csv",
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
      totalAmount: 32.47,
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
          price: 12.99,
          station: "Grill",
          notes: "Extra crispy edges, no pickles",
        },
        {
          id: "ORD-901-2",
          menuItemId: "MENU-BF-02",
          name: "Truffle Fries",
          quantity: 1,
          price: 6.49,
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
      totalAmount: 30.49,
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
          price: 14.5,
          station: "Assembly",
          notes: "Extra consomme cup",
        },
        {
          id: "ORD-902-2",
          menuItemId: "MENU-TM-02",
          name: "Avocado Quesabirria Vampiro",
          quantity: 1,
          price: 15.99,
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
      externalOrderId: "UE-771039",
      idempotencyKey: "idem-ue-771039",
      brandId: "WingProtocol",
      kitchenId: "K1",
      channel: "UberEats",
      source: "UBEREATS",
      status: "PREPARING",
      priority: "RUSH",
      customerName: "Kabir Bedi",
      totalAmount: 16.99,
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
          price: 16.99,
          station: "Fryer",
          notes: "All flats if possible",
        },
      ],
      events: [
        {
          id: "EVT-903-1",
          type: "RECEIVED",
          timestamp: minAgo(14),
          actor: "UBEREATS_WEBHOOK",
          details: "Order received via UberEats.",
        },
        {
          id: "EVT-903-2",
          type: "PREPARING",
          timestamp: minAgo(9),
          actor: "2001 (Rajesh Kumar)",
          details: "Line cook started preparation. Atomic recipe depletion executed (12 Jumbo Chicken Wings, 4 oz Ghost Pepper Glaze).",
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
      totalAmount: 34.5,
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
          price: 17.25,
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
      externalOrderId: "DD-339104",
      idempotencyKey: "idem-dd-339104",
      brandId: "BurgerForge",
      kitchenId: "K2",
      channel: "DoorDash",
      source: "DOORDASH",
      status: "DRIVER_ASSIGNED",
      priority: "NORMAL",
      customerName: "Siddharth Jain",
      driverName: "Deepak Yadav",
      courierEtaMins: 6,
      totalAmount: 27.48,
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
          price: 14.49,
          station: "Grill",
        },
        {
          id: "ORD-905-2",
          menuItemId: "MENU-BF-01",
          name: "Double Smash Burger",
          quantity: 1,
          price: 12.99,
          station: "Grill",
        },
      ],
      events: [
        {
          id: "EVT-905-1",
          type: "RECEIVED",
          timestamp: minAgo(28),
          actor: "DOORDASH_WEBHOOK",
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
      totalAmount: 29.0,
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
          price: 14.5,
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
      totalAmount: 26.98,
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
          price: 16.99,
          station: "Fryer",
        },
        {
          id: "ORD-907-2",
          menuItemId: "MENU-WP-02",
          name: "6pc Tactical Fire Wings",
          quantity: 1,
          price: 9.99,
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
      externalOrderId: "GH-662011",
      idempotencyKey: "idem-gh-662011",
      brandId: "BurgerForge",
      kitchenId: "K1",
      channel: "GrubHub",
      source: "GRUBHUB",
      status: "CANCELLED",
      priority: "NORMAL",
      customerName: "Vikrant Massey",
      totalAmount: 12.99,
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
      lossAmount: 2.8,
      claimAmount: 0,
      inventoryDecision: "AVAILABLE",
      inventoryConsumed: true,
      items: [
        {
          id: "ORD-908-1",
          menuItemId: "MENU-BF-01",
          name: "Double Smash Burger",
          quantity: 1,
          price: 12.99,
          station: "Grill",
        },
      ],
      events: [
        {
          id: "EVT-908-1",
          type: "RECEIVED",
          timestamp: minAgo(40),
          actor: "GRUBHUB_WEBHOOK",
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
          details: "Mid-prep cancellation logged as Food & Labor Loss ($2.80 COGS).",
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
      costImpact: 6.6,
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
      quantity: -4,
      previousStock: 16,
      newStock: 12,
      unit: "oz",
      costImpact: 3.4,
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
      quantity: -0.8,
      previousStock: 28.8,
      newStock: 28,
      unit: "lbs",
      costImpact: 9.6,
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
      costImpact: 2.4,
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
      channel: "GrubHub",
      stage: "DURING_OR_AFTER_PREP",
      previousStatus: "PREPARING",
      resolution: "FOOD_AND_LABOR_LOSS",
      source: "CUSTOMER",
      reason: "Customer cancelled mid-preparation on aggregator app",
      actor: "0001 (Priya Sharma)",
      timestamp: minAgo(29),
      financialLoss: 2.8,
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
      details: "Brioche Buns (18 units) and Ghost Pepper Glaze (12 oz) below reorder threshold.",
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
      details: "Deducted 12 Jumbo Chicken Wings and 4 oz Ghost Pepper Glaze on PENDING -> PREPARING.",
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
      details: "Logged $2.80 Food & Labor Loss; prepared ingredients blocked from inventory return.",
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
    payloadSummary: `${o.brandId} • ${o.items.length} item(s) • $${(o.totalAmount ?? 0).toFixed(2)}`,
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
      payload: JSON.stringify({ sku: "GHOST-01", stock: 12, threshold: 20 }),
      attempt: 2,
      maxAttempts: 6,
      backoffSchedule: "+10 seconds",
      status: "DELIVERED",
      createdAt: minAgo(9),
    },
    {
      id: "OUT-503",
      eventType: "verticalforge.variance.loss_logged",
      aggregateId: "ORD-908",
      payload: JSON.stringify({ orderId: "ORD-908", stage: "DURING_OR_AFTER_PREP", lossUsd: 2.8 }),
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
  return getGlobalState().cancellations.map((c) => ({ ...c }));
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
  state.activities.unshift({
    id: `ACT-${Date.now()}`,
    type: "STORE_CLEARED",
    category: "SYSTEM",
    title: "Active Order Queue Cleared",
    details: "All orders cleared to demonstrate honest empty states across stations.",
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

    const orderId =
      input.id?.trim() ||
      `ORD-${Math.floor(1000 + Math.random() * 9000)}`;

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
      payloadSummary: `${draftOrder.brandId} • ${itemCount} item(s) • $${totalAmount.toFixed(2)}`,
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
      details: `${itemCount} item(s) ($${totalAmount.toFixed(2)}) via ${draftOrder.channel} → ${kitchen.name} (${evaluation.inventoryDecision}).`,
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
  return transaction((state) => {
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
          currentOrder.inventoryDecision = "INSUFFICIENT_STOCK";
          currentOrder.inventoryUnavailable =
            depletion.insufficientStockItems;
          currentOrder.events.push({
            id: `${currentOrder.id}-EVT-${Date.now()}`,
            type: "INVENTORY_UNAVAILABLE",
            timestamp: now,
            actor: input.actor,
            details: `Preparation blocked due to insufficient stock: ${depletion.insufficientStockItems.join(", ")}`,
          });
          state.orders[index] = cloneOrder(currentOrder);
          throw new Error(
            `Insufficient inventory for preparation: ${depletion.insufficientStockItems.join(", ")}`,
          );
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
      // Stock was never deducted (canonical PENDING state before prep)
      if (shouldRestorePrePrep) {
        resolution = "INVENTORY_RESTORED";
        for (const [invId, qty] of requirements) {
          const item = state.inventory.find(
            (i) => i.id === invId,
          );
          if (item && qty > 0) {
            restoredIngredients.push({
              inventoryItemId: item.id,
              name: item.name,
              quantity: qty,
            });
          }
        }
      } else {
        resolution = "UNAVOIDABLE_LOSS";
        financialLoss = recipeCost;
      }
    }
  } else if (
    previousStatus === "PREPARING" ||
    previousStatus === "READY_FOR_PICKUP" ||
    previousStatus === "DRIVER_ASSIGNED"
  ) {
    // Mid-production or post-prep cancellation: DO NOT return cooked food to usable inventory!
    stage = "DURING_OR_AFTER_PREP";
    resolution = "FOOD_AND_LABOR_LOSS";
    financialLoss = Number((recipeCost + 1.5).toFixed(2)); // COGS + station labor allocation

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

  currentOrder.events.push({
    id: `${currentOrder.id}-EVT-CANCEL-${Date.now()}`,
    type: "CANCELLED",
    timestamp: now,
    actor: input.actor,
    details: `Order cancelled at ${previousStatus} (${stage}) -> ${resolution}. Loss: $${financialLoss.toFixed(2)}, Claim: $${claimAmount.toFixed(2)}.`,
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
    details: `Resolution: ${resolution.replaceAll("_", " ")} • Loss: $${financialLoss.toFixed(2)} • Claim: $${claimAmount.toFixed(2)}.`,
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

    if (
      input.action === "SET_STOCK" ||
      typeof input.currentStock === "number"
    ) {
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
      details: `${movement.reason} (Cost impact: $${movement.costImpact.toFixed(2)})`,
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
    const idx = state.menuCatalog.findIndex(
      (m) => m.id === item.id,
    );
    if (idx !== -1) {
      state.menuCatalog[idx] = {
        ...state.menuCatalog[idx],
        ...item,
        price:
          typeof item.price === "number" && item.price > 0
            ? item.price
            : state.menuCatalog[idx].price,
      };
    } else if (item.brandId && item.name && item.station) {
      state.menuCatalog.push({
        id: item.id,
        brandId: item.brandId,
        name: item.name,
        price: Number(item.price) || 12.99,
        station: item.station,
        active: item.active ?? true,
        prepTimeMins: item.prepTimeMins ?? 8,
        recipe: item.recipe ?? [],
      });
    }

    recordActivity({
      type: "MENU_UPDATED",
      category: "SYSTEM",
      title: `Menu Catalog Updated (${item.id})`,
      details: `Menu item ${item.name || item.id} updated by ${actor}.`,
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
    const idx = state.employees.findIndex(
      (e) =>
        e.id === employee.id ||
        e.employeeCode.toLowerCase() ===
          employee.employeeCode.toLowerCase(),
    );
    if (idx !== -1) {
      state.employees[idx] = {
        ...state.employees[idx],
        ...employee,
      };
    } else {
      state.employees.push({
        id:
          employee.id ||
          `EMP-${Date.now().toString().slice(-4)}`,
        employeeCode: employee.employeeCode
          .trim()
          .toUpperCase(),
        name: employee.name?.trim() || "New Operator",
        role: employee.role || "LINE_COOK",
        kitchenId: employee.kitchenId || "K1",
        active: employee.active ?? true,
      });
    }

    recordActivity({
      type: "STAFF_UPDATED",
      category: "AUTH",
      title: `Staff Record Updated (${employee.employeeCode})`,
      details: `Employee ${employee.name || employee.employeeCode} updated by ${actor}.`,
      actor,
      kitchenId: employee.kitchenId,
      severity: "info",
    });

    return state.employees.map((e) => ({ ...e }));
  });
}

export function upsertVirtualFile(
  file: Partial<VirtualFileAsset> & { name: string },
  actor: string,
): VirtualFileAsset[] {
  return transaction((state) => {
    const now = new Date().toISOString();
    const idx = file.id
      ? state.files.findIndex((f) => f.id === file.id)
      : -1;
    if (idx !== -1) {
      state.files[idx] = {
        ...state.files[idx],
        ...file,
        updatedAt: now,
      };
    } else {
      state.files.unshift({
        id: `FILE-${Date.now().toString().slice(-5)}`,
        name: file.name.trim(),
        category: file.category || "SOP Manual",
        size: file.size || "14.2 KB",
        mimeType: file.mimeType || "text/markdown",
        kitchenId: file.kitchenId || "K1",
        brandId: file.brandId,
        uploadedBy: actor,
        updatedAt: now,
        status: file.status || "VERIFIED",
        content:
          file.content ||
          `# ${file.name}\nUploaded to DarKIT OS Virtual File Explorer by ${actor}.`,
      });
    }

    recordActivity({
      type: "FILE_ASSET_SAVED",
      category: "SYSTEM",
      title: `Virtual Explorer Asset Saved: ${file.name}`,
      details: `Category: ${file.category || "SOP Manual"} • Kitchen: ${file.kitchenId || "GLOBAL"}.`,
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

export function updateSystemSettings(
  partial: Partial<SystemSettings>,
  actor: string,
): SystemSettings {
  return transaction((state) => {
    // Self-healing fallback sanitation for malformed configuration values
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
      ...state.settings,
      ...partial,
      lowStockMultiplier: safeLowStockMultiplier,
      prepSlaMinutes: safePrepSla,
      dispatchSlaMinutes: safeDispatchSla,
      rateLimitRps: safeRateLimit,
    };

    recordActivity({
      type: "SETTINGS_UPDATED",
      category: "SYSTEM",
      title: "System Personalization & Cloud7 Parameters Updated",
      details: `Theme: ${state.settings.theme} • Sync: ${state.settings.syncMode} • RLS: ${state.settings.rlsEnforcement} • Circuit: ${state.settings.circuitBreakerState}.`,
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
    const vector = state.leakageVectors.find(
      (v) => v.id === id,
    );
    if (vector) {
      vector.status = status;
      if (status === "RECOVERED") {
        vector.actualCollected = vector.potentialRevenue;
        vector.leakedAmount = 0;
      }
      recordActivity({
        type: "VERTICALFORGE_AUDIT",
        category: "CLOUD7",
        title: `VerticalForge Leakage Vector ${vector.vector}: ${status}`,
        details: `Quote-to-cash diagnostic updated by ${actor}.`,
        actor,
        severity:
          status === "RECOVERED" ? "success" : "info",
      });
    }
    return state.leakageVectors.map((l) => ({ ...l }));
  });
}
