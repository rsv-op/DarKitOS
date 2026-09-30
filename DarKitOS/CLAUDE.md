

# DarKitOS AI Coding Constitution

## 1. Purpose

This document defines how AI coding agents must behave when working on DarKitOS.

DarKitOS is a unified Cloud Kitchen Operating System.

The AI agent is not being asked to generate isolated pages.

The AI agent is responsible for preserving and extending one connected operational system.

The system must connect:

```text
Authentication
      ↓
Owner
      ↓
Order Injection
      ↓
Orders
      ↓
Cook KDS
      ↓
Dispatch
      ↓
Inventory
      ↓
Operational Activity
      ↓
Analytics

Every implementation decision must preserve this chain.


---

2. Primary Instruction

Before changing code:

INSPECT
→ UNDERSTAND
→ PLAN
→ IMPLEMENT
→ INTEGRATE
→ TEST
→ VERIFY

Never:

GUESS
→ GENERATE
→ HOPE


---

3. Repository Is the Source of Reality

The actual repository is authoritative for what currently exists.

Do not assume that a file, function, API, component, type, route, or feature exists.

Verify it.

Do not claim:

"This already works"

unless it has been inspected or tested.

Do not claim:

"Build passes"

unless the build was actually executed successfully.


---

4. Instruction Hierarchy

When working on DarKitOS, consider these sources in this order:

1. Existing verified working implementation
2. lib/db.ts
3. lib/store.ts
4. Existing API contracts
5. Existing domain logic
6. agents.md
7. architecture.md
8. CONTRIBUTING.md
9. This CLAUDE.md
10. cloud.md
11. full-stack-feature.md
12. SCREENSHOT_SPEC.md
13. MASTER_BUILD_PROMPT.md
14. Visual assumptions

If two instructions conflict, investigate the actual repository before deciding.

Do not silently replace working architecture.


---

5. Canonical Domain Contract

lib/db.ts is the canonical domain contract.

Use it for the definitions of:

Brands

Kitchens

Channels

Employees

Permissions

Inventory

Recipes

Menu

Orders

Order items

Stations

Statuses

Domain events


Do not create competing domain definitions.


---

6. Canonical Operational Boundary

lib/store.ts is the canonical operational state/data-access boundary.

The store is responsible for the application's operational state.

All meaningful operational mutations should flow through it.

Examples:

Create Order
Update Order
Cancel Order
Consume Inventory
Restore Inventory
Record Loss
Record Dispatch
Record Activity

Use the actual functions already present in the repository.

Do not invent alternative stores.


---

7. Mandatory Architecture

The application flow is:

UI
 ↓
API Route
 ↓
Domain / Application Logic
 ↓
Store
 ↓
Persistence

Do not bypass this architecture simply because directly changing state is easier.


---

8. No Duplicate State

This is one of the highest-priority rules.

Do not create a second operational state source.

Bad:

lib/store.ts
        +
api/orders/globalInventory
        +
api/inventory/globalInventory

Good:

lib/store.ts
      ↓
All operational consumers

The same principle applies to orders, inventory, employees, permissions, and other canonical data.


---

9. No Duplicate Interfaces

Before defining a new interface:

SEARCH THE REPOSITORY.

If an existing canonical type exists:

IMPORT IT.

Do not create:

interface Order

inside a page merely because the existing Order interface is inconvenient.


---

10. No Duplicate Business Rules

Business rules should not exist independently in:

Owner
Cook
Dispatch
API
Inventory

The rule should exist at the appropriate domain/application boundary.

The UI may display the result of the rule.

It should not become the authority for the rule.


---

11. Screenshot Interpretation

Screenshots are references for:

Layout
Information hierarchy
Navigation
Component placement
Interaction
Visual density
Responsive behavior

Screenshots are NOT authoritative for:

Database schema
Business rules
Permissions
Order lifecycle
Inventory logic
API contracts
Security

If a screenshot conflicts with the actual domain architecture:

Preserve the architecture.
Adapt the visual implementation.


---

12. Screenshot-to-System Rule

When implementing a screenshot:

Do not ask:

> "How do I reproduce this picture?"



Ask:

> "What operational experience is this screen communicating?"



Then implement:

Visual structure
+
Real data
+
Real actions
+
Real state
+
Real permissions
+
Real error handling


---

13. Seven Core Screens

The intended application experience contains these operational areas:

1. Login
2. Owner Command Center
3. Order Injection
4. Live Orders
5. Cook KDS
6. Dispatch
7. Inventory Management

These are not seven independent applications.

They are seven views of the same operational system.


---

14. Login

Login must:

Authenticate the employee.

Establish employee identity.

Establish the appropriate session/authentication state.

Respect active/inactive employee status.

Redirect appropriately after successful login.

Prevent unauthorized access to protected areas.


Do not hard-code a successful login into the UI.


---

15. Owner Command Center

The Owner screen is the command center.

It should provide operational visibility into:

Orders
Inventory
Kitchen Performance
Channel Performance
Brand Performance
Dispatch
Cancellations
Loss
Activity
Exceptions

It should not become a duplicate Cook or Dispatch station.


---

16. Order Injection

Order Injection creates a real order.

The workflow should be:

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
Items
 ↓
Canonical Order
 ↓
Store
 ↓
Operational Visibility

Do not create an order only in React state.


---

17. Live Orders

Live Orders should represent the canonical order state.

They should not maintain a separate order database.

When an order changes:

Live Orders
Cook
Dispatch
Owner
Analytics

should reflect the same underlying state where relevant.


---

18. Cook KDS

The Cook KDS is an operational workstation.

It should allow authorized users to process preparation.

Typical flow:

PENDING
 ↓
PREPARING
 ↓
READY_FOR_PICKUP

The exact lifecycle must follow the existing canonical domain model.


---

19. Dispatch

Dispatch handles orders that have reached the appropriate stage.

Typical flow:

READY_FOR_PICKUP
 ↓
Driver Assignment
 ↓
Pickup
 ↓
DISPATCHED

If the existing model does not contain a particular state, do not invent one without architectural justification.


---

20. Inventory Management

Inventory must show the actual canonical inventory state.

The interface may support:

Search
Filter
Stock levels
Reorder thresholds
Alerts
Restocking
Adjustments
Loss
Movement history

Only actions supported by the existing permissions and domain should be enabled.


---

21. Order Lifecycle

Primary lifecycle:

PENDING
 ↓
PREPARING
 ↓
READY_FOR_PICKUP
 ↓
DISPATCHED

Existing additional states must be respected.

Never create a parallel lifecycle.


---

22. Order State Transitions

Every transition must validate:

Employee
Permission
Current status
Allowed next status
Operational conditions

The client cannot be trusted to enforce this.


---

23. Inventory Consumption

Inventory consumption must be tied to the correct business event.

Do not assume:

Order Created = Inventory Consumed

unless the domain explicitly defines that behavior.

Determine the existing business rule.

Then implement it consistently.


---

24. Inventory Restoration

Cancellation may require restoration.

Before restoring:

Determine what was consumed.
Determine whether restoration is operationally valid.
Record the movement.
Prevent duplicate restoration.

Do not simply increment stock.


---

25. Cancellation Rules

Before preparation

Attempt to restore ingredients.

If restoration is not operationally possible:

Record consumed inventory as loss.

After preparation

Treat the cancellation as food/labor loss.

After pickup

Treat the cancellation as an aggregator/accounting claim case.

Preserve dispatch evidence.

These rules must remain consistent across:

Order
Inventory
Activity
Loss
Reconciliation


---

26. Idempotency

Operational commands must be safe against repetition.

Protect against:

Double-click
Refresh
Network retry
Repeated API call
Repeated cancellation
Repeated status update
Repeated restoration

Never allow a retry to create a second business effect.


---

27. Permission Model

Do not assume:

Logged in = Full access

Permission checks must use the canonical employee/permission model.

Examples may include:

OWNER_VIEW
INVENTORY_VIEW
INVENTORY_MANAGE
COOK_ORDERS
DISPATCH_ORDERS
ORDER_CANCEL
STAFF_MANAGE

Use the actual repository definitions.


---

28. Authorization Must Be Server-Side

Do not rely on:

Button hidden
Button disabled
Route hidden
Menu item hidden

as the security mechanism.

The server/API/domain layer must verify authorization.


---

29. API Contract

API routes should follow:

Request
 ↓
Authentication
 ↓
Authorization
 ↓
Input Validation
 ↓
Domain/Application Logic
 ↓
Store
 ↓
Response

Keep route handlers focused.


---

30. API Errors

Use meaningful responses for:

401 Unauthorized
403 Forbidden
400 Validation Error
404 Not Found
409 Conflict
500 Server Error

Use the repository's existing conventions where available.

Do not invent a completely different API response format for one route.


---

31. Client Error Handling

The client should distinguish:

Loading
Empty
Unauthorized
Forbidden
Validation Error
Server Error
Success

Do not treat every failed request as:

No data


---

32. Empty Data

Do not create fake operational data to make the dashboard look populated.

Correct:

No active orders.

Incorrect:

Generate five fake orders so the dashboard looks complete.

Seed data is acceptable when intentionally part of the development environment.


---

33. Analytics

Analytics must be derived from operational data.

Do not hard-code:

99.2%
87 orders
₹1,25,000 revenue

unless these values genuinely come from the application's data.


---

34. Operational Activity

Important events should be traceable.

Examples:

Order Created
Preparation Started
Order Ready
Driver Assigned
Order Picked Up
Order Dispatched
Order Cancelled
Inventory Depleted
Inventory Restored
Loss Recorded

Use canonical event structures where available.


---

35. Owner Analytics

Owner analytics should be able to derive information such as:

Order volume
Kitchen throughput
Channel activity
Brand activity
Cancellation
Loss
Inventory alerts
Dispatch performance

Only calculate metrics that the current data can support.


---

36. Loading Behavior

Every async operational screen should avoid flashing misleading empty states.

Preferred flow:

Loading
 ↓
Data

or:

Loading
 ↓
Empty

or:

Loading
 ↓
Error


---

37. Responsive Behavior

Operational pages must remain usable on:

Mobile
Tablet
Desktop

Do not assume the user is always on a desktop monitor.


---

38. Navigation

The application should provide clear navigation between major operational areas.

The exact design may follow the repository and screenshots.

Do not create multiple competing navigation systems.


---

39. Visual Design

Visual quality matters, but functionality comes first.

Avoid:

Huge decorative cards
Excessive empty space
Fake charts
Unnecessary gradients
Static illustrations replacing operational information
Buttons with no action

Prefer:

Clear hierarchy
Operational density
Readable typography
Status visibility
Useful tables
Clear actions
Responsive layout


---

40. Build Order

For substantial features, prefer:

1. Domain
2. Store
3. Business Logic
4. API
5. Authentication / Permissions
6. UI
7. Integration
8. Testing

Do not build all visual pages first and attempt to invent the backend later.


---

41. Integration Before Polish

The implementation priority is:

Correctness
 ↓
Integration
 ↓
Security
 ↓
Data integrity
 ↓
Error handling
 ↓
Responsive behavior
 ↓
Visual polish

Do not spend the majority of implementation effort polishing a screen whose underlying workflow does not work.


---

42. Existing Working Code

Preserve working functionality.

Before replacing code ask:

What does this currently do?
Who depends on it?
What breaks if it is replaced?

If the existing implementation is valid:

Extend it.

Do not rewrite it simply because a different approach looks cleaner.


---

43. Refactoring

Refactoring is allowed when it improves architectural integrity.

A refactor must:

Preserve required behavior
Remove duplication
Improve maintainability
Maintain API contracts where possible
Maintain domain consistency


---

44. Dependency Changes

Do not install packages automatically.

Before adding a package:

Search existing code.
Check package.json.
Check whether the feature already exists.
Check compatibility.
Check deployment implications.


---

45. Environment Constraints

Development may occur in environments such as:

Termux
Android ARM64
Codespaces
Vercel

Do not confuse local tooling limitations with production failures.

Example:

Local ARM64 SWC issue

is not automatically:

Next.js application failure

If Vercel builds successfully, distinguish the two environments.


---

46. Debugging

When an issue is reported:

1. Reproduce
2. Identify layer
3. Trace data
4. Identify root cause
5. Apply smallest correct fix
6. Test
7. Re-test dependent workflows

Do not patch only the visible symptom.


---

47. Debug Output

When reporting a bug, provide:

Problem
Root Cause
Affected Files
Affected Workflow
Fix
Validation
Remaining Risk

Do not merely say:

Fixed.


---

48. Code Generation Discipline

When generating code:

Use the repository's existing style.

Preserve imports where valid.

Use existing types.

Use existing helpers.

Avoid unnecessary abstraction.

Avoid unnecessary dependencies.

Avoid unrelated modifications.



---

49. Do Not Invent APIs

Before calling an API from a UI:

Confirm the route exists.
Confirm the method.
Confirm the request shape.
Confirm the response shape.
Confirm authentication.
Confirm permissions.

Do not invent:

/api/orders/create

if the actual route is:

/api/orders


---

50. Do Not Invent Fields

Before using:

order.customerName
order.totalAmount
inventory.stock
inventory.threshold

verify that the canonical model actually contains those fields.

If the field does not exist:

Do not silently invent it.

Determine the appropriate existing field or extend the domain deliberately.


---

51. Do Not Invent Routes

Before creating a new page:

Search app/

Before creating a new API route:

Search app/api/

Before creating a new component:

Search components/


---

52. File Ownership

Prefer clear responsibilities:

app/
    UI and routes

app/api/
    API boundaries

lib/db.ts
    Domain contract

lib/store.ts
    Operational state/data access

components/
    Reusable presentation/interaction

middleware.ts
    Request-level protection where appropriate

Follow the actual repository structure if it differs.


---

53. No Architecture Drift

Architecture drift occurs when:

A temporary shortcut

becomes:

A permanent second system.

Examples:

Temporary global variable
Temporary duplicate Order type
Temporary inventory array
Temporary permission check
Temporary fake API

Do not allow these to become production architecture.


---

54. Production Readiness

Before declaring production readiness verify:

[ ] Login
[ ] Authentication
[ ] Authorization
[ ] Owner
[ ] Order Injection
[ ] Orders
[ ] Cook
[ ] Dispatch
[ ] Inventory
[ ] Cancellation
[ ] Activity
[ ] Analytics
[ ] Error states
[ ] Loading states
[ ] Empty states
[ ] Responsive UI
[ ] Build
[ ] Deployment


---

55. Definition of Done

A feature is done only when:

UI works
+
API works
+
Domain logic works
+
Store works
+
Data changes correctly
+
Permissions work
+
Errors are handled
+
Affected screens update
+
Build passes


---

56. End-to-End Acceptance

The most important acceptance scenario is:

LOGIN
 ↓
OWNER
 ↓
ORDER INJECTION
 ↓
CREATE ORDER
 ↓
LIVE ORDERS
 ↓
COOK
 ↓
PREPARING
 ↓
READY
 ↓
DISPATCH
 ↓
DISPATCHED
 ↓
ACTIVITY
 ↓
ANALYTICS

Then separately test:

CANCELLATION
 ↓
INVENTORY EFFECT
 ↓
LOSS / RESTORATION
 ↓
ACTIVITY


---

57. Agent Completion Report

After completing a substantial BUILD operation, report:

Files inspected

List the important files inspected.

Files changed

List every changed file.

Architecture changes

Explain any architectural changes.

Domain changes

Explain changes to canonical domain types.

Store changes

Explain changes to operational state/data access.

API changes

List changed or created routes.

UI changes

List changed screens/components.

Tests

List tests actually executed.

Build

State whether:

npm run build

passed or failed.

Known issues

List unresolved issues honestly.

Next action

If something remains, state the exact next action.


---

58. No False Completion

Never report:

Complete

when important work remains.

Use:

Complete

only when the defined acceptance criteria have been verified.

Otherwise report:

Partially complete

and identify what remains.


---

59. No Silent Scope Expansion

Do not modify unrelated parts of the repository because they appear improvable.

If an unrelated issue is discovered:

Document it.

Fix it only when:

It blocks the requested work.

It creates a security problem.

It creates a data-integrity problem.

The user explicitly requests broader cleanup.



---

60. Build Trigger

When the user explicitly says:

Build

interpret it as an instruction to move from discussion into implementation.

Before implementation:

Inspect repository.
Read applicable instructions.
Identify current architecture.
Identify affected files.

Then implement and validate.


---

61. Run Trigger

When the user says:

Run

interpret it as an instruction to execute the requested test, analysis, inspection, or validation.

Do not assume that "Run" means "rewrite the code."


---

62. Generate Trigger

When the user says:

Generate

interpret it as an instruction to produce the requested artifact or implementation.

Generated code must still comply with this document and the canonical architecture.


---

63. Screenshot Workflow

When a screenshot is provided as a reference:

1. Inspect screenshot.
2. Identify screen purpose.
3. Identify visible workflows.
4. Map UI elements to existing domain data.
5. Identify missing operational capabilities.
6. Implement using canonical architecture.
7. Connect actions to real APIs/store.
8. Test the workflow.
9. Polish the visual implementation.

Never stop at step 1.


---

64. Screenshot Agent Rule

A screenshot may define what the user expects to see.

It does not define how the backend should work.

The implementation must translate:

Screenshot
 ↓
Operational requirement
 ↓
Canonical domain
 ↓
Store
 ↓
API
 ↓
UI


---

65. Multi-Agent Work

If multiple coding agents are used:

Every agent must respect:

lib/db.ts
lib/store.ts

and these project instructions.

Agents must not independently create competing architectures.

Before modifying shared files:

Inspect current state.

After modifying shared files:

Report the change.


---

66. Agent Handoff

Every handoff should include:

Completed
Files changed
Architecture impact
Tests
Build result
Known issues
Next step

This prevents one agent from repeating work already completed by another.


---

67. Final AI Principle

The AI agent is not a page generator.

It is an implementation agent operating inside an existing software architecture.

Therefore:

Do not optimize for code volume.
Do not optimize for visual imitation.
Do not optimize for speed at the expense of integrity.

Optimize for:

Correctness
Consistency
Traceability
Security
Integration
Maintainability
Operational usefulness


---

68. Final System Principle

DarKitOS must behave like one system.

If an order is created:

Every relevant operational area must know about it.

If an order changes:

Every relevant consumer must see the correct state.

If inventory changes:

The inventory truth must remain consistent.

If an order is cancelled:

The order, inventory, loss, activity, and accounting implications
must remain coherent.

If the owner opens the command center:

The information must come from the same operational truth
used by the operational stations.


---

69. Final Command

When uncertain:

STOP
↓
INSPECT
↓
SEARCH
↓
TRACE
↓
USE CANONICAL MODEL
↓
IMPLEMENT
↓
TEST

Never:

GUESS
↓
DUPLICATE
↓
PATCH
↓
DECLARE COMPLETE

DarKitOS should be built as one connected Cloud Kitchen Operating System, not as a collection of visually similar pages.
