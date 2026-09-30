
# DarKitOS

## Dark Cloud Kitchen Operating System

DarKitOS is a unified Cloud Kitchen Operating System designed to manage multiple virtual food brands, physical kitchens, order channels, inventory, preparation, dispatch, and operational analytics through one connected system.

The objective is not to create a collection of dashboards.

The objective is to create one operational system with one source of truth.

---

# 1. Product Vision

DarKitOS connects:

```text
Brands
+
Physical Kitchens
+
Order Channels
+
Menus
+
Recipes
+
Inventory
+
Orders
+
Cooking
+
Dispatch
+
Analytics

into one operational model.

The core concept is:

ONE OPERATIONAL SYSTEM
        │
        ├── Multiple Brands
        │
        ├── Multiple Kitchens
        │
        ├── Multiple Channels
        │
        ├── Shared Inventory
        │
        ├── Shared Order Lifecycle
        │
        ├── Cooking Workflow
        │
        ├── Dispatch Workflow
        │
        └── Owner Analytics


---

2. Core Operational Flow

The primary workflow is:

LOGIN
  ↓
AUTHENTICATION
  ↓
AUTHORIZATION
  ↓
OWNER / OPERATIONS
  ↓
ORDER INJECTION
  ↓
LIVE ORDERS
  ↓
COOK KDS
  ↓
READY FOR PICKUP
  ↓
DISPATCH
  ↓
INVENTORY / EVENTS
  ↓
ANALYTICS

The same canonical operational state must flow through the entire system.


---

3. Architecture

DarKitOS follows:

UI
 ↓
API Route
 ↓
Domain / Application Logic
 ↓
Store / Data Access
 ↓
Persistence

The UI must not become the source of operational truth.

API routes must not create competing business logic.

Operational state must not be duplicated across screens.


---

4. Canonical Domain

The canonical domain definitions live in:

lib/db.ts

This file should be treated as the authoritative contract for existing:

Brands
Inventory
Menu
Recipes
Orders
Employees
Permissions
Stations
Statuses

Do not create duplicate definitions without architectural justification.


---

5. Operational Store

The operational data-access boundary is:

lib/store.ts

where present in the repository architecture.

Operational mutations should pass through the canonical store boundary.

Examples:

Create Order
Update Order
Cancel Order
Consume Inventory
Restore Inventory
Record Loss
Dispatch Order
Record Activity

The implementation may evolve toward a persistent database without requiring a complete UI rewrite.


---

6. Application Areas

DarKitOS is organized around these operational areas:

/login
/owner
/orders
/cook
/dispatch
/inventory
/performance

The exact routes may differ in the repository.

Existing routes should be reused rather than duplicated.


---

7. Main Screens

Login

Provides authentication and establishes employee context.


---

Owner Command Center

Provides:

Operational visibility
Performance
Exceptions
Inventory alerts
Order overview
Channel analysis
Brand analysis
Kitchen analysis
Activity

The Owner screen is a command center, not another kitchen station.


---

Order Injection

Allows authorized users to create operational orders.

An injected order must enter the canonical order lifecycle and become visible to downstream operational screens.


---

Live Orders

Displays the current operational order state.

Users should be able to understand:

Order
Brand
Kitchen
Channel
Items
Timing
Status


---

Cook KDS

Provides the preparation workflow.

Typical lifecycle:

PENDING
 ↓
PREPARING
 ↓
READY_FOR_PICKUP


---

Dispatch

Handles orders that are operationally ready.

Depending on the canonical domain:

READY_FOR_PICKUP
 ↓
DRIVER_ASSIGNED
 ↓
PICKED_UP
 ↓
DISPATCHED


---

Inventory

Provides operational inventory management.

Potential capabilities include:

Stock levels
Low-stock alerts
Restocking
Adjustments
Loss
Inventory movements

Only capabilities supported by the canonical domain should be implemented.


---

8. Order Lifecycle

The canonical lifecycle is:

PENDING
   ↓
PREPARING
   ↓
READY_FOR_PICKUP
   ↓
DISPATCHED

If the repository contains additional valid states, they must be integrated rather than arbitrarily removed.

Every transition should validate:

Current state
Employee
Permission
Allowed transition
Operational conditions


---

9. Cancellation Rules

Cancellation is stage-dependent.

Before Preparation

Attempt to restore ingredients consumed by the order.

If restoration is not operationally possible:

Record consumed ingredients as loss.


---

After Preparation

Treat cancellation as:

Food / Labor Loss

Prepared food should not simply be returned to usable inventory.


---

After Pickup

Treat cancellation as:

Aggregator / Accounting Claim

Preserve relevant evidence:

Order
Driver
Pickup
Dispatch
Timestamp

where supported.


---

10. Inventory Integrity

Inventory must have one canonical operational state.

Do not create separate inventories for:

Owner
Cook
Dispatch

The UI may present different views of inventory.

The underlying operational state must remain unified.


---

11. Inventory Consumption

Inventory consumption should be tied to the appropriate business event.

For example:

Order
 ↓
Recipe
 ↓
Ingredient Consumption
 ↓
Inventory Movement
 ↓
Current Stock

The same business event must not accidentally consume inventory multiple times.


---

12. Inventory Restoration

When cancellation requires restoration:

Cancellation
 ↓
Determine order stage
 ↓
Determine consumed ingredients
 ↓
Restore where possible

Repeated cancellation must not produce repeated restoration.


---

13. Activity

Meaningful operational events should be recorded where supported.

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

Activity should reflect real operations.

It must not be fabricated simply to populate a dashboard.


---

14. Analytics

Analytics must be derived from operational data.

Potential metrics include:

Order volume
Kitchen throughput
Preparation time
Channel volume
Brand volume
Cancellations
Loss
Inventory alerts
Dispatch activity

Only calculate metrics supported by the available data.

If there is insufficient data:

No data available yet.

is preferable to fabricated numbers.


---

15. Authentication

Authentication determines:

Who is the employee?

Authorization determines:

What may the employee do?

These are separate concerns.

Protected routes and APIs must enforce authorization server-side.


---

16. Permissions

Use the canonical permission model.

Examples may include:

OWNER_VIEW
INVENTORY_VIEW
INVENTORY_MANAGE
COOK_ORDERS
DISPATCH_ORDERS
ORDER_CANCEL
STAFF_MANAGE

The actual repository definitions are authoritative.

Do not invent permissions when an equivalent canonical permission already exists.


---

17. Security

Never commit:

.env
.env.local
API keys
Passwords
Tokens
Private credentials

Never rely solely on frontend visibility for authorization.

A hidden button is not a security mechanism.


---

18. Responsive Design

DarKitOS should work across:

Mobile
Tablet
Desktop

The operational priority on smaller screens is:

Current state
Critical action
Order identity
Alerts
Navigation


---

19. UI Principles

Each operational screen should make it clear:

What is happening?
What needs attention?
What can I do?
What happened recently?

Avoid decorative UI that obscures operational information.


---

20. State Handling

Async interfaces must distinguish:

Loading
Empty
Unauthorized
Forbidden
Validation error
Not found
Conflict
Server error
Success

Do not display:

No data

when the request has actually failed.


---

21. Source-of-Truth Rules

Before creating new architecture:

Inspect the repository.

Before creating a new type:

Search for the existing type.

Before creating a new API:

Search for an existing API.

Before creating a new store:

Search for the existing store.

Before creating a new route:

Search for an equivalent route.


---

22. Development Rules

Always inspect before modifying.

Preferred workflow:

INSPECT
 ↓
UNDERSTAND
 ↓
PLAN
 ↓
IMPLEMENT
 ↓
INTEGRATE
 ↓
TEST
 ↓
BUILD
 ↓
VERIFY

Never:

GUESS
 ↓
CODE
 ↓
HOPE


---

23. Project Instruction Files

The project contains the following development instructions:

agents.md
architecture.md
CONTRIBUTING.md
CLAUDE.md
cloud.md
full-stack-feature.md
SCREENSHOT_SPEC.md
MASTER_BUILD_PROMPT.md

Read these before undertaking substantial changes.


---

24. Instruction File Responsibilities

File	Purpose

agents.md	Agent behavior and operating rules
architecture.md	System architecture
CONTRIBUTING.md	Development and contribution rules
CLAUDE.md	AI coding constitution
cloud.md	GitHub, Vercel and cloud workflow
full-stack-feature.md	Feature implementation protocol
SCREENSHOT_SPEC.md	Screen and UX requirements
MASTER_BUILD_PROMPT.md	Master implementation instruction
README.md	Human-readable project overview



---

25. Development Environment

The project is designed around:

Phone / Termux
      ↓
Git
      ↓
GitHub
      ↓
Vercel

A local desktop development environment is not a mandatory requirement.

The production build environment is expected to provide the required Next.js runtime/build tooling.


---

26. Technology

Current application architecture is based on:

Next.js
React
TypeScript
Tailwind CSS
App Router

Do not introduce a different framework unless explicitly required.


---

27. Git Workflow

Before modifying:

git status

Review existing changes.

After modifying:

git diff

Review the changes before committing.

Avoid blindly staging unrelated files.


---

28. Build

The primary production build command is:

npm run build

A successful build should be treated as one validation layer, not proof that the entire application works.

The operational workflow must also be tested.


---

29. Deployment

The intended deployment workflow is:

Local / Termux
      ↓
Git
      ↓
GitHub
      ↓
Vercel
      ↓
Production

After deployment, verify the actual deployed application.

Do not assume that a successful Git push means the production deployment is correct.


---

30. Production Verification

Verify at minimum:

Login
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

31. Definition of Done

A feature is not complete merely because:

The page renders.

A feature is complete when:

Domain
 ↓
Store
 ↓
API
 ↓
Authorization
 ↓
UI
 ↓
Integration
 ↓
Error handling
 ↓
Testing
 ↓
Build

are all coherent.


---

32. No Fake Completion

Never declare:

Complete

when:

Buttons do nothing
APIs are mocked
Data is hard-coded
Inventory is inconsistent
Order states are disconnected
Analytics are fabricated
Authentication is bypassed


---

33. End-to-End Acceptance

The application should support a connected workflow resembling:

LOGIN
  ↓
CREATE ORDER
  ↓
ORDER APPEARS IN LIVE ORDERS
  ↓
COOK STARTS ORDER
  ↓
ORDER BECOMES PREPARING
  ↓
COOK MARKS READY
  ↓
ORDER BECOMES READY
  ↓
DISPATCH PROCESSES ORDER
  ↓
ORDER BECOMES DISPATCHED
  ↓
INVENTORY / ACTIVITY UPDATE
  ↓
OWNER SEES OPERATIONAL RESULT


---

34. Cancellation Acceptance

The system should support:

BEFORE PREPARATION
→ Restore inventory where possible
→ Otherwise record loss

AFTER PREPARATION
→ Food/labor loss

AFTER PICKUP
→ Aggregator/accounting claim
→ Preserve dispatch evidence


---

35. Long-Term Architecture

The system should be designed so that:

Current runtime/store

can eventually evolve into:

Persistent database

without requiring the operational UI to be rebuilt.

The UI should depend on application/domain interfaces rather than database implementation details.


---

36. Future Expansion

The architecture should leave room for:

Multiple brands
Multiple kitchens
Multiple channels
Aggregator integrations
Delivery integrations
Advanced inventory
Procurement
Staff management
Financial reconciliation
Operational reporting
Notifications
Webhooks
Persistent database

Future expansion must follow the same canonical architecture.


---

37. What DarKitOS Is Not

DarKitOS is not:

A static dashboard
A collection of mock screens
A spreadsheet replacement with decorative charts
A collection of unrelated CRUD pages
A frontend-only prototype

It is intended to become an operational control system for cloud kitchen businesses.


---

38. Engineering Philosophy

Prefer:

Correctness
Consistency
Traceability
Maintainability
Operational usefulness

over:

Shortcuts
Duplicate state
Fake data
Decorative complexity
Unverified assumptions


---

39. Agent Execution Principle

When an AI coding agent works on DarKitOS:

Read the instructions.
Inspect the repository.
Use the existing architecture.
Make the smallest coherent change.
Integrate it.
Test it.
Verify it.
Report what changed.

The agent must not assume that generating code equals completing the feature.


---

40. Final System Model

The long-term DarKitOS model is:

┌───────────────┐
                    │     OWNER     │
                    │  COMMAND CTR  │
                    └───────┬───────┘
                            │
                            ▼
┌─────────┐          ┌──────────────┐
│ BRANDS  │─────────▶│    ORDERS    │
└─────────┘          └──────┬───────┘
                            │
┌─────────┐                 │
│CHANNELS │─────────────────┤
└─────────┘                 │
                            ▼
                     ┌──────────────┐
                     │  LIVE ORDER  │
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   COOK KDS   │
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │    READY     │
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   DISPATCH   │
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   INVENTORY  │
                     └──────┬───────┘
                            │
                 ┌──────────┴──────────┐
                 ▼                     ▼
          ┌─────────────┐       ┌─────────────┐
          │   ACTIVITY  │       │  ANALYTICS  │
          └─────────────┘       └─────────────┘

All of these components must ultimately operate from the same canonical operational model.


---

41. Final Principle

> Build the operating system, not the appearance of one.



Every screen should connect to real operational state.

Every important action should have a business rule.

Every business rule should have a clear architectural home.

Every mutation should pass through the appropriate canonical boundary.

Every operational result should be observable.

Every important workflow should be testable.

That is the foundation of DarKitOS.

That completes the **9-file instruction pack**:

```text
1. agents.md
2. architecture.md
3. CONTRIBUTING.md
4. CLAUDE.md
5. cloud.md
6. full-stack-feature.md
7. SCREENSHOT_SPEC.md
8. MASTER_BUILD_PROMPT.md
9. README.md
