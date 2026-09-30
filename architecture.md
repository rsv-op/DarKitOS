# DarKitOS Architecture

## 1. System Purpose

DarKitOS is a unified Cloud Kitchen Operating System designed to operate multiple virtual food brands from one or more physical kitchens.

The system must provide one connected operational model for:

- Brands
- Physical kitchens
- Channels
- Orders
- Customers
- Menus
- Recipes
- Ingredients
- Inventory
- Cooking
- Dispatch
- Employees
- Permissions
- Operational events
- Loss
- Cancellations
- Analytics
- Owner-level command and control

The system must not become a collection of disconnected dashboards.

---

# 2. Core Product Model

The fundamental relationship is:

```text
Brand
   +
Physical Kitchen
   +
Channel
   +
Menu
   +
Recipe
   +
Inventory
   +
Order
   +
Operational Workflow

File 2: architecture.md

Create this at:

DarKitOS/architecture.md

Copy everything below:

# DarKitOS Architecture

## 1. System Purpose

DarKitOS is a unified Cloud Kitchen Operating System designed to operate multiple virtual food brands from one or more physical kitchens.

The system must provide one connected operational model for:

- Brands
- Physical kitchens
- Channels
- Orders
- Customers
- Menus
- Recipes
- Ingredients
- Inventory
- Cooking
- Dispatch
- Employees
- Permissions
- Operational events
- Loss
- Cancellations
- Analytics
- Owner-level command and control

The system must not become a collection of disconnected dashboards.

---

# 2. Core Product Model

The fundamental relationship is:

```text
Brand
   +
Physical Kitchen
   +
Channel
   +
Menu
   +
Recipe
   +
Inventory
   +
Order
   +
Operational Workflow

---

A brand may operate from one or more physical kitchens.

A physical kitchen may produce orders for multiple brands.

An order belongs to a brand, kitchen, and channel.

The operational system must preserve these relationships.


---

3. Primary Application Areas

The application is organized around these operational areas:

/login
/owner
/orders
/cook
/dispatch
/inventory

The exact route structure may differ in the existing repository.

Do not create duplicate routes merely because the conceptual area exists.

The existing repository should be inspected first.


---

4. Mandatory Architecture

The required architecture is:

┌─────────────────────┐
│         UI          │
│ React / Next.js     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│      API Routes     │
│ Authentication      │
│ Validation          │
│ Permissions         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Domain / Application│
│ Business Rules      │
│ Order Logic         │
│ Inventory Logic     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│     lib/store.ts    │
│ Operational State   │
│ Data Access         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│     Persistence     │
│ Replaceable Layer   │
└─────────────────────┘

This boundary must be preserved.


---

5. lib/db.ts

lib/db.ts is the canonical domain contract.

It defines the domain model used by the application.

Where present, it should contain canonical definitions for concepts such as:

Brand
Kitchen
Channel
Employee
Permission
InventoryItem
Recipe
RecipeIngredient
MenuItem
Order
OrderItem
Station
Operational Event

The exact interfaces must be determined from the repository.

Do not assume fields that do not exist.

Do not duplicate these definitions inside pages or API routes.


---

6. lib/store.ts

lib/store.ts is the canonical operational state and data-access boundary.

All operational mutations should ultimately flow through this boundary.

Examples include:

createOrder()
getOrders()
getOrder()
updateOrderStatus()
cancelOrder()
depleteInventory()
restoreInventory()
recordLoss()
recordDispatch()
getInventory()
getActivity()

The actual function names must follow the existing repository.

Do not invent duplicate store implementations.


---

7. Persistence Independence

The application architecture must allow the underlying persistence mechanism to change without redesigning the entire application.

For example:

Current runtime state
       ↓
Future database
       ↓
Future managed database

The UI should not care whether the data eventually comes from:

In-memory state

PostgreSQL

MySQL

Supabase

Neon

another persistence provider


The operational contract should remain stable.


---

8. Single Operational Truth

The system must maintain one canonical operational state.

For example:

Order Injection
       ↓
Canonical Order
       ↓
Store
       ↓
Live Orders
       ↓
Cook
       ↓
Dispatch
       ↓
Analytics

Every screen reads the same order state.

Similarly:

Inventory
       ↓
Consumption
       ↓
Inventory Movement
       ↓
Current Stock
       ↓
Inventory Alerts
       ↓
Analytics

Every screen must derive inventory information from the same operational state.


---

9. Prohibited Duplicate State

Do not create separate runtime copies such as:

globalInventory
localInventory
ownerInventory
cookInventory
dispatchInventory

Do not create:

ownerOrders
cookOrders
dispatchOrders
analyticsOrders

if those are merely independent copies of the same operational data.

Derived views are acceptable.

Independent operational state is not.


---

10. Order Architecture

The order is the central operational object.

Conceptually:

Order
├── Order Identity
├── Brand
├── Kitchen
├── Channel
├── Customer
├── Items
├── Pricing
├── Status
├── Timestamps
├── Preparation
├── Dispatch
└── Operational Events

The exact structure must follow lib/db.ts.


---

11. Order Lifecycle

The primary lifecycle is:

PENDING
   ↓
PREPARING
   ↓
READY_FOR_PICKUP
   ↓
DISPATCHED

If the existing repository includes additional states, they must be incorporated rather than arbitrarily removed.

For example:

PENDING
   ↓
PREPARING
   ↓
READY_FOR_PICKUP
   ↓
DRIVER_ASSIGNED
   ↓
PICKED_UP
   ↓
DISPATCHED

The existing canonical domain model takes precedence.


---

12. Order Injection

Order Injection is the entry point for creating operational orders.

Conceptually:

External / Manual Order
        ↓
Validation
        ↓
Brand Resolution
        ↓
Kitchen Resolution
        ↓
Channel Resolution
        ↓
Menu / Item Resolution
        ↓
Canonical Order
        ↓
Store

The resulting order must immediately become visible to appropriate operational screens.


---

13. Order Validation

Before creating an order, validate:

Brand

Kitchen

Channel

Items

Quantities

Required customer information

Pricing where required

Valid operational state


Invalid orders must not enter the operational system.


---

14. Order Identity

Each order must have a unique identifier.

The identifier must remain stable throughout the lifecycle.

Do not generate a new order ID when:

Changing status

Moving from Cook to Dispatch

Refreshing the page

Updating inventory

Recording activity



---

15. Order Status Ownership

Different operational areas may perform different status transitions.

Conceptually:

Order Injection
    ↓
PENDING

Cook
    ↓
PREPARING

Cook
    ↓
READY_FOR_PICKUP

Dispatch
    ↓
DISPATCHED

Permission checks determine whether an employee may perform each action.

The UI should not be trusted as the authority.

The server/domain layer must validate transitions.


---

16. State Transition Rules

A status transition should verify:

1. Current employee


2. Required permission


3. Current order status


4. Valid next status


5. Required operational conditions



Example:

PENDING → PREPARING

is valid if the employee has the required cooking permission.

A random transition such as:

PENDING → DISPATCHED

should not be accepted unless explicitly supported by the domain model.


---

17. Inventory Architecture

Inventory is a shared operational resource.

Conceptually:

Inventory Item
├── SKU / ID
├── Name
├── Unit
├── Current Stock
├── Reorder Threshold
├── Cost where available
└── Operational Metadata

Use the canonical field names from lib/db.ts.

Do not create aliases merely for convenience.


---

18. Recipe Architecture

A menu item may contain a recipe.

Conceptually:

Menu Item
    ↓
Recipe
    ↓
Recipe Ingredients
    ↓
Inventory Items

Example:

Burger
   ↓
Burger Recipe
   ├── Bun × 1
   ├── Patty × 1
   ├── Sauce × 20g
   └── Vegetables × 30g

The actual units and quantities must come from the canonical domain model.


---

19. Inventory Consumption

When an operational event requires inventory consumption:

Order
 ↓
Order Items
 ↓
Menu Items
 ↓
Recipes
 ↓
Ingredients
 ↓
Inventory Movement
 ↓
Current Stock

Consumption must be processed through the canonical domain/store layer.

Do not allow UI components to directly mutate inventory.


---

20. Inventory Movement

Every meaningful inventory mutation should have an operational reason.

Examples:

SALE_CONSUMPTION
RESTOCK
MANUAL_ADJUSTMENT
WASTE
LOSS
CANCELLATION_RESTORE

Use existing event/type definitions when available.

Do not invent incompatible enums.


---

21. Inventory Depletion Protection

A single business event must not consume the same inventory twice.

For example:

Order created
      ↓
Inventory consumed

The same order must not cause:

Cook screen → consume
API route → consume
Dispatch → consume

unless the domain explicitly requires separate movements.


---

22. Cancellation Architecture

Cancellation is not merely:

status = CANCELLED

Cancellation may have inventory, food, labor, and accounting consequences.

The system must evaluate the order's operational stage.


---

23. Cancellation Before Preparation

If an order is cancelled before preparation:

Cancellation
      ↓
Determine consumed ingredients
      ↓
Restore if operationally possible
      ↓
Record restoration

If restoration is not possible:

Cancellation
      ↓
Consumed inventory
      ↓
Record loss

Never silently manipulate stock.


---

24. Cancellation After Preparation

After preparation, the cancellation should be treated as operational food/labor loss.

Do not return prepared ingredients to usable inventory merely because the order was cancelled.

Record the appropriate loss information.


---

25. Cancellation After Pickup

After pickup, cancellation becomes an aggregator/accounting claim scenario.

The system should preserve evidence such as:

Order identity

Dispatch status

Pickup status where available

Timestamps

Employee actions

Relevant operational events


Where required, the system should support a food-loss/claim record.


---

26. Idempotent Cancellation

Repeated cancellation requests must not:

restore inventory twice
record loss twice
create duplicate claims
create duplicate activity events

The operation must recognize that the cancellation has already been processed.


---

27. Operational Events

Operational events provide traceability.

Examples:

ORDER_CREATED
ORDER_STARTED
ORDER_READY
DRIVER_ASSIGNED
ORDER_PICKED_UP
ORDER_DISPATCHED
ORDER_CANCELLED
INVENTORY_DEPLETED
INVENTORY_RESTORED
LOSS_RECORDED

Use the existing domain definitions where present.


---

28. Event Structure

An operational event should contain enough information to understand:

What happened?
Who performed it?
When did it happen?
What entity was affected?
What was the previous state?
What was the new state?
Why did it happen?

Not every field is mandatory if the existing domain model does not support it.

Do not fabricate schema fields solely to satisfy this conceptual model.


---

29. Owner Command Center

The Owner Command Center is the system-level operational view.

It should provide visibility into:

Current Orders
Inventory
Kitchen Performance
Channel Performance
Brand Performance
Dispatch
Cancellations
Loss
Operational Activity
Exceptions

It is a command and analysis interface.

It should not duplicate Cook or Dispatch functionality unnecessarily.


---

30. Kitchen Performance

Kitchen performance should derive from actual operational data.

Potential metrics include:

Orders processed
Preparation time
Ready time
Dispatch time
Cancellation count
Loss
Throughput

Only display metrics that can be calculated from available data.

Do not manufacture numbers.


---

31. Channel Performance

Channel performance should derive from actual orders.

Potential dimensions include:

Channel
Order volume
Revenue
Cancellation
Preparation
Dispatch
Operational outcome

Only calculate metrics supported by available data.


---

32. Brand Performance

The architecture must support multiple brands.

Example:

Brand A
Brand B
Brand C
Brand D

The owner should be able to analyze brands without creating separate applications.

A brand may operate from multiple kitchens.


---

33. Physical Kitchen Architecture

A physical kitchen is an operational production location.

Conceptually:

Kitchen
├── Brands
├── Stations
├── Employees
├── Inventory
├── Orders
└── Dispatch

A single kitchen may serve multiple virtual brands.


---

34. Kitchen + Brand Resolution

An order must resolve both:

Brand
Kitchen

These are separate concepts.

Do not treat:

Brand = Kitchen

unless the existing domain explicitly models them that way.


---

35. Multi-Kitchen Architecture

The system must support:

Brand A
 ├── Kitchen 1
 └── Kitchen 2

Brand B
 ├── Kitchen 1
 └── Kitchen 3

This is an example only.

The implementation must use the actual configured data.


---

36. Cook KDS Architecture

The Cook KDS is responsible for preparation.

Conceptually:

Orders awaiting preparation
        ↓
Start preparation
        ↓
Preparation in progress
        ↓
Mark ready

The KDS should prioritize operational clarity.

Important information includes:

Order ID

Brand

Items

Quantities

Timing

Priority

Status

Relevant kitchen information



---

37. Dispatch Architecture

Dispatch receives orders that are operationally ready.

Conceptually:

READY_FOR_PICKUP
        ↓
Dispatch Queue
        ↓
Driver Assignment where supported
        ↓
Pickup
        ↓
Dispatch

Dispatch must not bypass required order state transitions.


---

38. Inventory Management Architecture

Inventory management should support:

View inventory
Search
Filter
Stock level
Reorder threshold
Low-stock alerts
Inventory movement
Manual adjustment where permitted
Restocking where supported
Loss / waste

All mutations must use the canonical store.


---

39. Authentication Architecture

Authentication must establish employee identity.

Conceptually:

Login
 ↓
Employee Resolution
 ↓
Session / Authentication State
 ↓
Protected Application

The exact implementation must follow the existing repository.

Do not introduce a second authentication system.


---

40. Authorization Architecture

Authentication answers:

> Who are you?



Authorization answers:

> What are you allowed to do?



Both must be enforced.

A hidden button is not authorization.

The server must validate permission.


---

41. Middleware

Middleware may protect application routes where appropriate.

However, middleware should not become the only authorization layer.

API routes and domain operations must still enforce permissions.


---

42. API Architecture

API routes should remain thin.

Conceptually:

Request
 ↓
Authentication
 ↓
Authorization
 ↓
Validation
 ↓
Domain/Application Logic
 ↓
Store
 ↓
Response

Avoid placing the entire business system inside route handlers.


---

43. UI Architecture

UI components are responsible for:

Presentation

Interaction

Input

Loading state

Error state

Empty state

Success state

Calling APIs


They are not the authoritative source of business rules.


---

44. Polling and Refresh

Operational screens may require near-real-time updates.

Where the existing application uses polling:

Fetch
 ↓
Display
 ↓
Refresh
 ↓
Display latest state

Polling intervals must be reasonable.

Avoid unnecessary requests.

Do not create multiple independent polling systems for the same data if a shared mechanism is practical.


---

45. Loading State

Every operational page that performs asynchronous data retrieval should communicate that loading is occurring.

Avoid rendering misleading empty states while data is still loading.


---

46. Empty State

An empty operational state is not automatically an error.

For example:

No active orders

is different from:

Failed to load orders

The UI must distinguish them.


---

47. Error State

Errors should communicate enough information for the user to understand the problem.

Examples:

Unable to load orders.
Please refresh or try again.

For development/debugging, preserve useful technical information without exposing secrets.


---

48. Responsive Architecture

The application should support:

Desktop
Tablet
Mobile

Operational interfaces should remain usable on smaller screens.

Do not allow a desktop-only layout to become unusable on a phone.


---

49. Navigation

The major operational areas should be reachable through clear navigation.

Conceptually:

Owner
Orders
Order Injection
Cook
Dispatch
Inventory
Performance

The actual navigation structure should respect the existing application.

Do not duplicate navigation systems.


---

50. Data Flow Example

A complete order should follow:

1. User logs in
        ↓
2. User opens Order Injection
        ↓
3. Order is created
        ↓
4. Store records canonical order
        ↓
5. Inventory logic evaluates required consumption
        ↓
6. Order appears in Live Orders
        ↓
7. Cook sees order
        ↓
8. Cook starts preparation
        ↓
9. Order becomes PREPARING
        ↓
10. Cook marks order ready
        ↓
11. Order becomes READY_FOR_PICKUP
        ↓
12. Dispatch sees order
        ↓
13. Dispatch processes pickup
        ↓
14. Order becomes DISPATCHED
        ↓
15. Operational activity is recorded
        ↓
16. Owner analytics reflect the order

The implementation may contain additional states.

The repository's canonical domain model takes precedence.


---

51. Failure Example

If Cook cannot load an order:

Cook UI
   ↓
API
   ↓
Store
   ↓
Error

The error must not silently become:

No orders

unless the store actually returned an empty result.


---

52. Data Integrity

The following must always remain consistent:

Order status
Inventory movement
Operational activity
Dispatch state
Analytics

When a mutation affects more than one of these, the implementation must consider all affected state.


---

53. Transactional Thinking

Even if the current implementation uses in-memory state, business operations should be designed as coherent units.

For example:

Cancel Order
    ↓
Determine stage
    ↓
Determine inventory effect
    ↓
Apply inventory effect
    ↓
Update order
    ↓
Record event

Do not update only one piece of state and leave the rest inconsistent.


---

54. Replaceable Persistence

The current implementation may use an in-memory or local data model.

That is acceptable for development.

However, application code should not become permanently dependent on implementation details of that storage mechanism.

The future goal is:

UI
 ↓
API
 ↓
Domain
 ↓
Store
 ↓
Database

rather than:

UI
 ↓
random global variable


---

55. Testing Architecture

Testing should cover both individual features and complete workflows.

Examples:

Login test
Permission test
Order creation test
Order transition test
Inventory depletion test
Cancellation test
Inventory restoration test
Dispatch test
Analytics test

The most important test is the complete operational journey.


---

56. End-to-End Test

A minimum end-to-end scenario should be:

Login
 ↓
Create Order
 ↓
Verify Order
 ↓
Verify Inventory Effect
 ↓
Start Preparation
 ↓
Mark Ready
 ↓
Dispatch
 ↓
Verify Activity
 ↓
Verify Analytics

Then test cancellation scenarios separately.


---

57. Cancellation Test Matrix

Test:

Cancellation before preparation
Cancellation during preparation
Cancellation after preparation
Cancellation after pickup
Repeated cancellation

Verify:

Order state
Inventory
Loss
Activity
Claim/accounting state where applicable


---

58. Permission Test Matrix

Test at minimum:

Owner
Cook
Dispatch
Inventory user
Unauthorized user
Inactive employee

Verify that each role can only perform permitted operations.

The actual roles must follow the repository.


---

59. Build Validation

Production build must be tested with:

npm run build

A successful build does not prove that the application is operationally correct.

It proves compilation/build integration.

Functional tests are still required.


---

60. Deployment Architecture

The intended deployment flow is:

Development Environment
        ↓
GitHub
        ↓
Vercel
        ↓
Production

The application should remain compatible with this workflow.


---

61. Environment Variables

Secrets must never be committed.

Use environment variables for:

API keys

Database credentials

Authentication secrets

External service credentials


Never place secrets in:

lib/db.ts
components
pages
README
screenshots
Git history


---

62. Production Safety

Before production deployment verify:

Authentication
Authorization
Environment variables
Build
API routes
Data integrity
Error handling
Responsive UI
Core workflow


---

63. Architecture Change Rule

A major architectural change requires inspection of:

lib/db.ts
lib/store.ts
API routes
middleware
authentication
existing pages
components

Do not change architecture because a single page is inconvenient to implement.


---

64. Anti-Duplication Rule

Before adding any new model, function, API, state container, or data source ask:

Does this already exist?

Search the repository first.

If it exists:

reuse

If it is incomplete:

extend

Only create a new abstraction when the existing architecture genuinely cannot support the requirement.


---

65. Final Architecture

The intended final system is:

┌───────────────┐
                         │     LOGIN     │
                         └───────┬───────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │ AUTH + PERMISSIONS     │
                    └───────────┬────────────┘
                                │
             ┌──────────────────┼──────────────────┐
             │                  │                  │
             ▼                  ▼                  ▼
       ┌─────────┐      ┌──────────────┐    ┌───────────┐
       │  OWNER    │      │ ORDER SYSTEM   │    │ INVENTORY   │
       └────┬────┘      └──────┬───────┘    └─────┬─────┘
             │                    │                     │
             │                    ▼                    │
             │           ┌──────────────┐            │
             │           │    COOK KDS     │           │
             │           └──────┬───────┘            │
             │                   │                      │
             │                  ▼                      │
             │            ┌──────────────┐           │
             │            │   DISPATCH     │            │
             │            └──────┬───────┘           │
             │                    │                     │
             └─────────────────┼──────────────────┘
                               │
                               ▼
                    ┌────────────────────┐
                    │ OPERATIONAL STORE      │
                    │    lib/store.ts        │
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │   PERSISTENCE          │
                    └────────────────────┘


---

66. Architectural North Star

The system should always answer these questions consistently:

What orders exist?
Where are they?
What brand owns them?
Which kitchen is producing them?
What channel produced them?
What stage are they in?
Who can act on them?
What inventory was consumed?
What inventory remains?
What happened operationally?
Who performed the action?
What was cancelled?
What was lost?
What was dispatched?
What should the owner know?

If different screens produce different answers to these questions, the architecture is broken.


---

67. Final Rule

Do not optimize for:

more pages
more components
more code
more visual effects

Optimize for:

one operational truth
+
clear business rules
+
secure permissions
+
connected workflows
+
traceable state changes
+
replaceable persistence
+
reliable deployment

DarKitOS is complete only when the system operates as one coherent Cloud Kitchen Operating System.
