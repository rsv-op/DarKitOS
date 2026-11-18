// Labels and instructions for the tour; orders and permissions still come from the app.
export const ORDER_WALKTHROUGH = [
  {
    href: "/order-injection",
    screen: "Sample Orders",
    title: "Add a sample order",
    detail: "Use the prefilled meal or choose a food brand, kitchen, and menu item.",
    icon: "ticket",
  },
  {
    href: "/live-orders",
    screen: "Live Orders",
    title: "Find the order",
    detail: "Look it up by order number and see its status and history.",
    icon: "list",
  },
  {
    href: "/kds",
    screen: "Kitchen Board",
    title: "Prepare the meal",
    detail: "Start preparing the order, then mark it ready for pickup.",
    icon: "cook",
  },
  {
    href: "/dispatch",
    screen: "Dispatch",
    title: "Hand it to a courier",
    detail: "Assign a driver, confirm pickup, and mark the order dispatched.",
    icon: "truck",
  },
] as const;

export const DEMO_ROLES = [
  {
    code: "OWNER-01",
    role: "OWNER",
    label: "Owner",
    description: "See orders, sales, and stock across all kitchens and brands.",
    startsAt: "Overview",
    icon: "chart",
  },
  {
    code: "0001",
    role: "MANAGER",
    label: "Manager",
    description: "Manage a kitchen’s orders and ingredients during a shift.",
    startsAt: "Overview",
    icon: "list",
  },
  {
    code: "2001",
    role: "LINE_COOK",
    label: "Cook",
    description: "See what needs cooking and mark meals ready for pickup.",
    startsAt: "Kitchen Board",
    icon: "cook",
  },
  {
    code: "3001",
    role: "DISPATCH",
    label: "Dispatch",
    description: "Assign couriers and confirm which meals have been picked up.",
    startsAt: "Dispatch",
    icon: "truck",
  },
] as const;
