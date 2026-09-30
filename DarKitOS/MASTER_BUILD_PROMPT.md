
# DarKitOS Master Build Prompt

## MASTER EXECUTION INSTRUCTION

You are the primary implementation agent for DarKitOS.

Your task is to build and integrate DarKitOS as a complete, production-oriented Cloud Kitchen Operating System.

Do not treat this repository as a collection of pages.

Do not build isolated mockups.

Do not invent a parallel architecture.

Do not replace working architecture without first inspecting it.

Build one connected operational system.

---

# 1. PRIMARY OBJECTIVE

Build DarKitOS so that the following operational chain works as one system:

```text
LOGIN
  ↓
AUTHENTICATION
  ↓
AUTHORIZATION
  ↓
OWNER
  ↓
ORDER INJECTION
  ↓
LIVE ORDERS
  ↓
COOK KDS
  ↓
READY
  ↓
DISPATCH
  ↓
INVENTORY
  ↓
OPERATIONAL ACTIVITY
  ↓
ANALYTICS

The exact route names may differ in the existing repository.

The operational relationship must not.


---

2. READ THE PROJECT INSTRUCTIONS FIRST

Before changing code, read:

agents.md
architecture.md
CONTRIBUTING.md
CLAUDE.md
cloud.md
full-stack-feature.md
SCREENSHOT_SPEC.md

Then inspect the actual repository.

Do not begin implementation until the current architecture is understood.


---

3. REPOSITORY INSPECTION

Inspect at minimum:

package.json
tsconfig.json
next.config.*
middleware.*
lib/
app/
components/
public/

Then identify:

Domain models
Store
Authentication
Permissions
API routes
Order lifecycle
Inventory logic
Existing screens
Existing components
Existing tests


---

4. CANONICAL ARCHITECTURE

Use:

UI
 ↓
API Route
 ↓
Domain / Application Logic
 ↓
Store / Data Access
 ↓
Persistence

The architecture must preserve:

lib/db.ts

as the canonical domain contract.

Use:

lib/store.ts

as the canonical operational state/data-access boundary where present or required by the existing architecture.

Do not create competing operational stores.


---

5. SOURCE-OF-TRUTH RULE

The existing repository is authoritative for what already exists.

Use this hierarchy:

1. Existing verified working implementation
2. lib/db.ts
3. lib/store.ts
4. Existing APIs
5. Existing domain logic
6. Project instruction files
7. Existing UI
8. Screenshots
9. Agent assumptions

If something already exists:

Reuse it.

If it is incomplete:

Extend it.

Only create something new when the architecture genuinely requires it.


---

6. DO NOT HALLUCINATE

Never assume:

A file exists.

An API exists.

A field exists.

A type exists.

A permission exists.

A route exists.

A database exists.

A function exists.

A deployment succeeded.

A test passed.


Inspect or test it.

If something is missing, identify the correct architectural place for it before creating it.


---

7. NO DUPLICATE DOMAIN MODELS

Do not create a second definition of:

Order
OrderItem
Brand
Kitchen
Channel
Employee
Permission
InventoryItem
Recipe
RecipeIngredient
MenuItem
Station
OrderStatus
OperationalEvent

if canonical definitions already exist.

Import and use the canonical definitions.


---

8. NO DUPLICATE OPERATIONAL STATE

Do not create independent runtime copies of:

Orders
Inventory
Employees
Permissions
Operational Activity

Do not create:

globalInventory
ownerInventory
cookInventory
dispatchInventory

as competing operational state.

Do not create separate:

ownerOrders
cookOrders
dispatchOrders

as competing order state.

Derived views are acceptable.

Independent operational truth is not.


---

9. PRESERVE EXISTING VALID ARCHITECTURE

Do not rewrite the application simply because another architecture seems cleaner.

Before replacing something determine:

What does it currently do?
Who consumes it?
What depends on it?
What will break?

Preserve valid implementation.

Refactor only when the refactor improves the canonical architecture or is necessary for the requested functionality.


---

10. PRODUCT MODEL

DarKitOS must support the conceptual relationship:

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

A brand may operate from multiple kitchens.

A kitchen may serve multiple brands.

An order must preserve its relevant:

Brand
Kitchen
Channel

context.


---

11. REQUIRED SCREENS

Build and integrate these operational areas:

1. Login
2. Owner Command Center
3. Order Injection
4. Live Orders
5. Cook KDS
6. Dispatch
7. Inventory Management

If equivalent routes already exist:

Extend them.

Do not create duplicate pages.


---

12. SCREEN 1: LOGIN

Ensure authentication is real.

Login must:

Validate credentials
 ↓
Resolve employee
 ↓
Verify employee is active
 ↓
Create authentication/session state
 ↓
Redirect appropriately

Protected routes must reject unauthenticated users.

Do not rely only on frontend route hiding.


---

13. AUTHORIZATION

Authentication asks:

Who is the employee?

Authorization asks:

What may the employee do?

Use canonical permissions.

Examples may include:

OWNER_VIEW
INVENTORY_VIEW
INVENTORY_MANAGE
COOK_ORDERS
DISPATCH_ORDERS
ORDER_CANCEL
STAFF_MANAGE

Use the actual permissions in the repository.


---

14. SERVER-SIDE AUTHORIZATION

The UI may hide or disable actions based on permission.

But:

Hidden button ≠ Security

The API/domain layer must enforce authorization.


---

15. SCREEN 2: OWNER COMMAND CENTER

The Owner Command Center should provide real operational visibility.

It should consume real data for:

Orders
Inventory
Kitchen Performance
Channel Performance
Brand Performance
Dispatch
Cancellations
Loss
Operational Activity
Exceptions

Do not hard-code operational numbers.


---

16. OWNER IS NOT A KITCHEN STATION

The Owner screen is:

Command
Visibility
Analysis
Exception management

It is not another:

Cook station
Dispatch station
Inventory workstation

Avoid duplicating operational interfaces unnecessarily.


---

17. SCREEN 3: ORDER INJECTION

Build a real order creation workflow.

The conceptual flow is:

Input
 ↓
Validation
 ↓
Brand
 ↓
Kitchen
 ↓
Channel
 ↓
Menu Items
 ↓
Quantities
 ↓
Canonical Order
 ↓
Store

The created order must become visible to downstream workflows.

Do not create the order only in client state.


---

18. ORDER VALIDATION

Validate all required fields.

At minimum where applicable:

Brand
Kitchen
Channel
Items
Quantity
Customer information
Pricing
Operational metadata

Use the actual canonical requirements.


---

19. SCREEN 4: LIVE ORDERS

Build the operational order view using canonical order data.

It should allow users to understand:

Order ID
Brand
Kitchen
Channel
Items
Quantity
Status
Timing
Priority where supported

Support useful filters where appropriate.

Do not maintain a separate order state.


---

20. ORDER LIFECYCLE

Respect the canonical lifecycle:

PENDING
 ↓
PREPARING
 ↓
READY_FOR_PICKUP
 ↓
DISPATCHED

If the repository contains additional states such as:

DRIVER_ASSIGNED
PICKED_UP

preserve and integrate them.

Do not replace the existing canonical lifecycle arbitrarily.


---

21. STATUS TRANSITIONS

Every status transition must verify:

Current state
Employee
Permission
Allowed transition
Operational conditions

Never allow the client to decide that a transition is valid.


---

22. SCREEN 5: COOK KDS

The Cook KDS must be operational.

It should display eligible orders and allow authorized staff to process them.

Typical workflow:

PENDING
 ↓
START PREPARING
 ↓
PREPARING
 ↓
MARK READY
 ↓
READY_FOR_PICKUP

Use the existing canonical lifecycle.


---

23. COOK KDS UX

Prioritize:

Order identity
Brand
Items
Quantities
Timing
Priority
Status
Action

Avoid excessive decorative UI.

The KDS should be usable during real kitchen operations.


---

24. SCREEN 6: DISPATCH

Dispatch must consume orders that are operationally ready.

Typical flow:

READY_FOR_PICKUP
 ↓
DRIVER_ASSIGNED
 ↓
PICKED_UP
 ↓
DISPATCHED

Only use states that exist in the canonical model.


---

25. DISPATCH ACTIONS

Where supported, allow authorized staff to:

View ready orders
Assign driver
Mark pickup
Dispatch order

Every action must update canonical operational state.


---

26. DISPATCH EVIDENCE

Preserve relevant dispatch evidence:

Order
Driver
Employee
Pickup
Dispatch
Timestamp

where the domain supports these fields.

This evidence matters for post-pickup cancellation/accounting scenarios.


---

27. SCREEN 7: INVENTORY MANAGEMENT

Build inventory as an operational system.

It should support the capabilities that exist in the current domain, such as:

View inventory
Search
Filter
Stock levels
Reorder thresholds
Low-stock alerts
Restocking
Adjustments
Loss
Movement history

Do not invent unsupported operations.


---

28. INVENTORY CANONICAL FIELDS

Use canonical inventory fields.

For example, if the model uses:

currentStock
reorderThreshold

do not create:

stock
threshold

as competing fields.

Inspect lib/db.ts first.


---

29. INVENTORY CONSUMPTION

Inventory consumption must happen exactly where the business rule requires it.

Do not allow:

Order API
+
Cook UI
+
Dispatch UI

to independently consume the same inventory.

One business event should produce one intended inventory movement.


---

30. INVENTORY MOVEMENT

Meaningful inventory changes should have a reason.

Possible reasons include:

SALE_CONSUMPTION
RESTOCK
MANUAL_ADJUSTMENT
WASTE
LOSS
CANCELLATION_RESTORE

Use the actual canonical event/movement definitions.


---

31. CANCELLATION RULES

Implement the established cancellation behavior.

Before preparation

Cancellation
 ↓
Determine consumed ingredients
 ↓
Restore where operationally possible

If restoration cannot be performed:

Record consumed inventory as loss.

After preparation

Treat as:

Food/Labor Loss

Do not return prepared food ingredients to usable inventory merely because the order was cancelled.

After pickup

Treat as:

Aggregator / Accounting Claim

Preserve dispatch/pickup evidence.

Where supported, record food-loss/claim evidence for reconciliation.


---

32. CANCELLATION IDEMPOTENCY

Repeated cancellation must not cause:

Double restoration
Double loss
Duplicate claim
Duplicate event

The operation must recognize that cancellation has already been processed.


---

33. ACTIVITY / EVENT TRACKING

Record meaningful operational events where supported.

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

Use the canonical event model.


---

34. ANALYTICS

Analytics must derive from operational data.

Do not create fake numbers.

Examples of potentially derivable metrics:

Order volume
Preparation time
Kitchen throughput
Channel volume
Cancellation
Loss
Inventory alerts
Dispatch activity
Brand activity

Only calculate metrics supported by the available data.


---

35. EMPTY DATA

If no data exists, display an honest empty state.

Examples:

No active orders.
No operational activity available.
No performance data available yet.
No low-stock items.

Do not populate dashboards with fabricated data.


---

36. LOADING

Every async operational screen must communicate loading.

Do not immediately show:

No data

while data is still being retrieved.


---

37. ERROR HANDLING

Differentiate:

Loading
Empty
Unauthorized
Forbidden
Validation error
Not found
Conflict
Server error

Do not turn API failures into fake empty states.


---

38. RESPONSIVE UI

Every major screen must be usable on:

Mobile
Tablet
Desktop

Prioritize the operational information that matters most on smaller screens.


---

39. NAVIGATION

Create or improve clear navigation between:

Owner
Orders
Order Injection
Cook
Dispatch
Inventory
Performance

Use the existing routing structure where possible.

Do not create duplicate navigation systems.


---

40. VISUAL IMPLEMENTATION

Use the screenshot references in:

SCREENSHOT_SPEC.md

to guide:

Layout
Spacing
Information hierarchy
Cards
Tables
Navigation
Typography
Status presentation
Responsive behavior

But do not copy screenshot data into the application.


---

41. SCREENSHOT RULE

A screenshot is not a database schema.

A screenshot is not an API contract.

A screenshot is not a business rule.

A screenshot is not authorization.

A screenshot is a reference for the intended experience.


---

42. API ARCHITECTURE

API routes must follow:

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

Keep route handlers focused.


---

43. DOMAIN ARCHITECTURE

Business rules belong in the appropriate domain/application layer.

Do not put complex business logic inside:

React components

or duplicate it across API routes.


---

44. STORE ARCHITECTURE

All operational mutations should use the canonical store boundary.

Examples:

Create Order
Update Order
Cancel Order
Consume Inventory
Restore Inventory
Record Loss
Record Dispatch
Record Activity

Use the actual functions already present.


---

45. PERSISTENCE

Keep persistence replaceable.

The application should be able to evolve from:

Development runtime state

to:

Persistent database

without requiring a complete UI rewrite.


---

46. FULL ORDER TEST

After implementation, execute the conceptual test:

LOGIN
 ↓
CREATE ORDER
 ↓
VERIFY ORDER
 ↓
VERIFY INVENTORY EFFECT
 ↓
LIVE ORDERS
 ↓
START PREPARATION
 ↓
VERIFY PREPARING
 ↓
MARK READY
 ↓
VERIFY READY
 ↓
DISPATCH
 ↓
VERIFY DISPATCHED
 ↓
VERIFY ACTIVITY
 ↓
VERIFY ANALYTICS

Use the actual available application routes and actions.


---

47. CANCELLATION TEST

Execute:

Create order
 ↓
Cancel before preparation
 ↓
Verify order
 ↓
Verify inventory restoration/loss
 ↓
Verify activity

Then separately test:

Cancel after preparation

and:

Cancel after pickup

where the current application supports those states.


---

48. PERMISSION TEST

Test at least:

Owner
Cook
Dispatch
Inventory user
Unauthorized user
Inactive employee

Verify that permissions are actually enforced by the server.


---

49. REPEATED ACTION TEST

Test:

Double-click action
Refresh immediately after action
Repeat API request
Repeat cancellation
Repeat inventory restoration

Verify that the system does not create duplicate business effects.


---

50. FAILURE TEST

Test:

Invalid login
Missing required field
Invalid order
Invalid transition
Unauthorized API request
Forbidden operation
Missing entity
Server failure

The UI must provide useful feedback.


---

51. BUILD VALIDATION

Run:

npm run build

when the environment supports it.

Do not declare the implementation complete if the production build fails.

If the local environment has a platform-specific limitation:

Document it.

Do not confuse it with an application failure.


---

52. CODE QUALITY

Do not:

Create unnecessary dependencies
Use any to hide errors
Create duplicate state
Create duplicate types
Create fake APIs
Create fake analytics
Suppress errors
Rewrite unrelated code

Prefer:

Existing abstractions
Canonical models
Small coherent changes
Explicit validation
Real integration


---

53. GIT SAFETY

Before changes:

git status

After changes:

git diff

Do not blindly use:

git add .

if unrelated files exist.

Do not commit:

.env
.env.local
Secrets
Tokens
Credentials
node_modules
.next


---

54. DEPLOYMENT

When implementation is ready:

Validate
 ↓
Review diff
 ↓
Commit
 ↓
Push to GitHub
 ↓
Vercel build
 ↓
Deployment
 ↓
Production verification

Do not claim deployment success without verification.


---

55. PRODUCTION TEST

After deployment verify:

Root
Login
Protected routes
Authentication
Authorization
Owner
Order Injection
Live Orders
Cook
Dispatch
Inventory
Cancellation
Activity
Analytics

where implemented.


---

56. DO NOT STOP AT THE UI

If a screen exists but:

The button does nothing

the feature is incomplete.

If:

The API exists but the UI does not use it

the feature is incomplete.

If:

The UI and API work but inventory becomes inconsistent

the feature is incomplete.

If:

The build passes but the operational workflow fails

the feature is incomplete.


---

57. INTEGRATION STANDARD

Every feature must answer:

Where does the data come from?
Where is the truth stored?
Who can modify it?
What API changes it?
What business rule controls it?
What happens after it changes?
Which screens need to know?
What happens if it fails?
What happens if it is repeated?

If these answers are unknown, inspect the repository before proceeding.


---

58. IMPLEMENTATION ORDER

For a large implementation, use this order:

PHASE 1
Repository inspection

PHASE 2
Domain and store alignment

PHASE 3
Authentication and permissions

PHASE 4
Order architecture

PHASE 5
Inventory architecture

PHASE 6
Order Injection

PHASE 7
Live Orders

PHASE 8
Cook KDS

PHASE 9
Dispatch

PHASE 10
Owner Command Center

PHASE 11
Inventory Management

PHASE 12
Activity and Analytics

PHASE 13
Cross-screen integration

PHASE 14
Error/loading/empty states

PHASE 15
Responsive polish

PHASE 16
Testing

PHASE 17
Production build

PHASE 18
Deployment verification

Do not blindly follow this order if the existing repository requires another dependency sequence.


---

59. DEPENDENCY-FIRST IMPLEMENTATION

If a feature depends on another feature:

Build the dependency first.

For example:

Order Injection

depends on:

Order domain
Store
API
Authentication
Permissions

Therefore do not attempt to build the final Order Injection UI before understanding those dependencies.


---

60. NO MOCK-FIRST ARCHITECTURE

Do not build:

Beautiful UI
 ↓
Fake data
 ↓
Later backend

Prefer:

Canonical model
 ↓
Store
 ↓
API
 ↓
Real data
 ↓
UI

Visual polish can happen after integration.


---

61. EXISTING MOCKS

If the repository already contains mock data or static screens:

Do not automatically delete them.

First determine:

Are they seed data?
Are they tests?
Are they placeholders?
Are they still used?

Then replace or integrate them appropriately.


---

62. EXISTING ROUTES

Before creating:

/orders
/cook
/dispatch
/inventory
/performance

inspect whether equivalent routes already exist.

Reuse existing routes when appropriate.


---

63. EXISTING APIs

Before creating:

/api/orders
/api/inventory

inspect existing implementations.

If they already exist:

Fix or extend them.

Do not create:

/api/orders2
/api/inventory2

merely to avoid understanding the existing code.


---

64. SHARED STORE RULE

If multiple APIs currently maintain separate copies of operational state:

Identify this as an architectural defect.

Correct it by moving operational state toward the canonical store boundary.

Do not add more copies.


---

65. ORDER + INVENTORY INTEGRITY

Order and inventory operations must remain coherent.

If an order consumes ingredients:

Order
 ↓
Recipe
 ↓
Inventory Movement
 ↓
Current Stock

must remain traceable.

If the order is cancelled:

Cancellation
 ↓
Determine stage
 ↓
Inventory restoration or loss

must follow the business rules.


---

66. ANALYTICS INTEGRITY

Analytics must never become a separate fake data source.

Use:

Canonical operational data

to derive:

Metrics
Charts
Counts
Performance
Alerts


---

67. ACTIVITY INTEGRITY

Activity must derive from real operational events.

Do not manually add activity entries just because a dashboard needs content.


---

68. OWNER INTEGRATION

The Owner Command Center should act as a consumer of operational truth.

It should not independently mutate order or inventory state unless a clearly defined owner operation requires it.


---

69. ROLE-BASED EXPERIENCE

The application should provide different operational experiences based on employee responsibilities.

Examples:

Owner
→ Command / analysis

Cook
→ Preparation

Dispatch
→ Dispatch

Inventory Manager
→ Inventory

The exact roles and permissions must come from the canonical repository.


---

70. MOBILE-FIRST OPERATIONAL THINKING

The application must remain useful on a phone.

For small screens:

Prioritize:

Current status
Order identity
Critical actions
Alerts
Navigation

Do not simply shrink the desktop layout until everything becomes unreadable.


---

71. VISUAL HIERARCHY

Every screen should make it obvious:

What is happening?
What needs attention?
What can I do?
What happened recently?

This is more important than decorative visual effects.


---

72. PERFORMANCE

Do not introduce unnecessary polling.

Do not make every component independently fetch the same data.

Prefer efficient data retrieval and appropriate refresh behavior.

Do not sacrifice correctness merely to reduce requests.


---

73. ACCESSIBILITY

Operational controls should have:

Clear labels
Keyboard access
Visible focus
Readable text
Meaningful error messages

Do not communicate important status through color alone.


---

74. FINAL BUILD GATE

Before declaring the master build complete:

[ ] Repository inspected
[ ] Canonical domain verified
[ ] Canonical store verified
[ ] Authentication verified
[ ] Authorization verified
[ ] Login functional
[ ] Owner functional
[ ] Order Injection functional
[ ] Live Orders functional
[ ] Cook functional
[ ] Dispatch functional
[ ] Inventory functional
[ ] Cancellation rules implemented
[ ] Inventory integrity verified
[ ] Activity verified
[ ] Analytics derived from real data
[ ] Loading states
[ ] Empty states
[ ] Error states
[ ] Responsive UI
[ ] No duplicate operational state
[ ] No duplicate domain model
[ ] No fake operational success
[ ] npm run build passes
[ ] Git diff reviewed
[ ] No secrets committed
[ ] Deployment verified if requested


---

75. FINAL END-TO-END ACCEPTANCE

The master build must be able to demonstrate:

┌──────────────┐
                │    LOGIN     │
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │    OWNER     │
                └──────┬───────┘
                       │
                       ▼
             ┌──────────────────┐
             │ ORDER INJECTION  │
             └────────┬─────────┘
                      │
                      ▼
             ┌──────────────────┐
             │   LIVE ORDERS    │
             └────────┬─────────┘
                      │
                      ▼
             ┌──────────────────┐
             │    COOK KDS      │
             └────────┬─────────┘
                      │
                      ▼
             ┌──────────────────┐
             │      READY       │
             └────────┬─────────┘
                      │
                      ▼
             ┌──────────────────┐
             │     DISPATCH     │
             └────────┬─────────┘
                      │
                      ▼
             ┌──────────────────┐
             │    INVENTORY     │
             └────────┬─────────┘
                      │
             ┌────────┴─────────┐
             ▼                  ▼
       ┌───────────┐      ┌────────────┐
       │  ACTIVITY │      │ ANALYTICS  │
       └───────────┘      └────────────┘

The same canonical operational state must flow through this entire system.


---

76. FINAL CANCELLATION ACCEPTANCE

The system must also support the conceptual cancellation matrix:

CANCELLATION
                           │
             ┌─────────────┼─────────────┐
             │             │             │
             ▼             ▼             ▼
       BEFORE PREP     AFTER PREP    AFTER PICKUP
             │             │             │
             ▼             ▼             ▼
        RESTORE OR      FOOD/LABOR    CLAIM /
           LOSS            LOSS       ACCOUNTING
             │             │             │
             └─────────────┼─────────────┘
                           ▼
                      ACTIVITY
                           │
                           ▼
                      ANALYTICS

The exact implementation must follow the canonical domain and available fields.


---

77. FINAL DATA-INTEGRITY ACCEPTANCE

Verify that:

One order
=
One canonical order

One inventory state
=
One canonical inventory state

One permission definition
=
One canonical permission definition

One business event
=
One intended operational effect

No duplicate state should exist merely because multiple screens consume the data.


---

78. FINAL AGENT BEHAVIOR

If the repository is incomplete:

Do not panic.
Do not invent.
Do not rewrite everything.

Instead:

Inspect
 ↓
Identify gap
 ↓
Determine correct architectural layer
 ↓
Implement
 ↓
Integrate
 ↓
Test


---

79. IF SOMETHING IS BROKEN

Do not hide the problem.

Report:

Problem
Root Cause
Affected Layer
Affected Files
Fix
Validation
Remaining Issue

Then continue with the implementation only if the fix is within the requested scope.


---

80. IF SOMETHING IS UNCLEAR

Search the repository first.

Check:

lib/db.ts
lib/store.ts
API routes
Existing screens
Existing components
Middleware
Permissions

Only ask the user when the required decision cannot reasonably be determined from the repository or project requirements.

Do not ask the user questions that repository inspection can answer.


---

81. FINAL MASTER INSTRUCTION

Build DarKitOS as a complete Cloud Kitchen Operating System.

Do not build seven disconnected pages.

Do not build a visual prototype and call it complete.

Do not create duplicate operational state.

Do not create duplicate domain models.

Do not bypass the canonical store.

Do not invent APIs.

Do not invent fields.

Do not invent permissions.

Do not fabricate analytics.

Do not fake operational success.

Do not declare completion without validation.

Instead:

INSPECT
   ↓
UNDERSTAND
   ↓
ALIGN DOMAIN
   ↓
ALIGN STORE
   ↓
IMPLEMENT BUSINESS LOGIC
   ↓
IMPLEMENT API
   ↓
IMPLEMENT UI
   ↓
INTEGRATE ALL AFFECTED SCREENS
   ↓
TEST
   ↓
BUILD
   ↓
VERIFY

The final result must behave as one connected operational system:

LOGIN
 ↓
AUTH
 ↓
OWNER
 ↓
ORDER INJECTION
 ↓
LIVE ORDERS
 ↓
COOK
 ↓
READY
 ↓
DISPATCH
 ↓
INVENTORY
 ↓
ACTIVITY
 ↓
ANALYTICS

That is the definition of the DarKitOS master build.
