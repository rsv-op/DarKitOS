# DarKitOS Agent Operating Rules

## 1. Purpose

DarKitOS is a unified Cloud Kitchen Operating System.

It is not a collection of independent dashboards or disconnected pages.

The system must operate as one connected operational platform covering:

- Authentication
- Owner Command Center
- Order Injection
- Live Orders
- Cooking / KDS
- Dispatch
- Inventory
- Brands
- Physical Kitchens
- Channels
- Recipes
- Menu
- Order lifecycle
- Inventory movement
- Operational activity
- Analytics
- Permissions
- Cancellation and loss handling

Every implementation must preserve end-to-end operational integrity.

---

# 2. Trigger Words

The following words have explicit meanings.

## BUILD

When the user says:

> Build

The agent may inspect the repository and implement the required functionality.

The agent must:

1. Inspect the existing repository.
2. Read all applicable project instruction files.
3. Identify the existing architecture.
4. Preserve valid existing implementation.
5. Avoid duplicate state or domain models.
6. Implement the required functionality.
7. Integrate it with existing screens and APIs.
8. Run validation.
9. Fix discovered errors.
10. Report exactly what was changed and what was verified.

Do not stop after creating a UI mockup.

A feature is not considered built until its operational path works end-to-end.

---

# 3. RUN

When the user says:

> Run

The agent should execute the requested test, validation, inspection, debug, or analysis workflow.

Do not modify production code unless the user explicitly asks to fix something.

If a test discovers a problem:

1. Identify the problem.
2. Explain the affected architecture.
3. Provide the smallest safe fix.
4. Ask for BUILD if implementation is required, unless the current instruction explicitly authorizes automatic fixes.

---

# 4. GENERATE

When the user says:

> Generate

The agent may generate the requested artifact, implementation, documentation, configuration, or code.

Generated implementation must still comply with:

- `architecture.md`
- `CLAUDE.md`
- `CONTRIBUTING.md`
- `cloud.md`
- `full-stack-feature.md`

---

# 5. Source-of-Truth Hierarchy

When information conflicts, use this hierarchy:

1. Existing working code
2. `lib/db.ts`
3. `lib/store.ts`
4. Existing API contracts
5. Existing domain types
6. Project instruction files
7. Existing UI implementation
8. User-provided screenshot
9. Agent assumptions

Never allow an assumption to override an existing verified implementation.

If the repository contradicts the project instructions, inspect the repository first.

Do not silently invent a new architecture.

---

# 6. Canonical Architecture

The required application flow is:

UI
↓
API Route
↓
Domain / Application Logic
↓
Store / Data Access
↓
Persistence

The UI must not create a second operational data source.

The API must not create a separate inventory or order state.

The domain layer must contain business rules.

The store layer must provide the operational data boundary.

Persistence must remain replaceable.

---

# 7. Canonical Domain Contract

`lib/db.ts` is the canonical domain contract.

Do not create competing definitions for:

- Orders
- Order status
- Brands
- Kitchens
- Channels
- Employees
- Permissions
- Inventory
- Recipes
- Menu items
- Stations
- Cancellation states
- Operational events

If a required domain object does not exist:

1. Inspect `lib/db.ts`.
2. Determine whether the object already exists under another name.
3. Extend the canonical model only when necessary.
4. Update dependent code consistently.

Never create a duplicate interface inside a page or API route simply because it is convenient.

---

# 8. Canonical Operational State

`lib/store.ts` is the canonical operational state/data-access boundary.

All operational mutations should flow through the store.

Examples:

- Create order
- Update order status
- Cancel order
- Deplete inventory
- Restore inventory
- Record loss
- Record dispatch
- Record operational activity
- Read operational summaries

Do not create:

```text
globalInventory


Use this order:

1. agents.md


2. architecture.md


3. CONTRIBUTING.md


4. CLAUDE.md


5. cloud.md


6. full-stack-feature.md


7. SCREENSHOT_SPEC.md


8. MASTER_BUILD_PROMPT.md


9. README.md



Important: These are instruction/control files for the coding agents. They go in the repository root, not inside app/.

File 1: agents.md

Create:

DarKitOS/agents.md

Copy everything below into that file:

# DarKitOS Agent Operating Rules

## 1. Purpose

DarKitOS is a unified Cloud Kitchen Operating System.

It is not a collection of independent dashboards or disconnected pages.

The system must operate as one connected operational platform covering:

- Authentication
- Owner Command Center
- Order Injection
- Live Orders
- Cooking / KDS
- Dispatch
- Inventory
- Brands
- Physical Kitchens
- Channels
- Recipes
- Menu
- Order lifecycle
- Inventory movement
- Operational activity
- Analytics
- Permissions
- Cancellation and loss handling

Every implementation must preserve end-to-end operational integrity.

---

# 2. Trigger Words

The following words have explicit meanings.

## BUILD

When the user says:

> Build

The agent may inspect the repository and implement the required functionality.

The agent must:

1. Inspect the existing repository.
2. Read all applicable project instruction files.
3. Identify the existing architecture.
4. Preserve valid existing implementation.
5. Avoid duplicate state or domain models.
6. Implement the required functionality.
7. Integrate it with existing screens and APIs.
8. Run validation.
9. Fix discovered errors.
10. Report exactly what was changed and what was verified.

Do not stop after creating a UI mockup.

A feature is not considered built until its operational path works end-to-end.

---

# 3. RUN

When the user says:

> Run

The agent should execute the requested test, validation, inspection, debug, or analysis workflow.

Do not modify production code unless the user explicitly asks to fix something.

If a test discovers a problem:

1. Identify the problem.
2. Explain the affected architecture.
3. Provide the smallest safe fix.
4. Ask for BUILD if implementation is required, unless the current instruction explicitly authorizes automatic fixes.

---

# 4. GENERATE

When the user says:

> Generate

The agent may generate the requested artifact, implementation, documentation, configuration, or code.

Generated implementation must still comply with:

- `architecture.md`
- `CLAUDE.md`
- `CONTRIBUTING.md`
- `cloud.md`
- `full-stack-feature.md`

---

# 5. Source-of-Truth Hierarchy

When information conflicts, use this hierarchy:

1. Existing working code
2. `lib/db.ts`
3. `lib/store.ts`
4. Existing API contracts
5. Existing domain types
6. Project instruction files
7. Existing UI implementation
8. User-provided screenshot
9. Agent assumptions

Never allow an assumption to override an existing verified implementation.

If the repository contradicts the project instructions, inspect the repository first.

Do not silently invent a new architecture.

---

# 6. Canonical Architecture

The required application flow is:

UI
↓
API Route
↓
Domain / Application Logic
↓
Store / Data Access
↓
Persistence

The UI must not create a second operational data source.

The API must not create a separate inventory or order state.

The domain layer must contain business rules.

The store layer must provide the operational data boundary.

Persistence must remain replaceable.

---

# 7. Canonical Domain Contract

`lib/db.ts` is the canonical domain contract.

Do not create competing definitions for:

- Orders
- Order status
- Brands
- Kitchens
- Channels
- Employees
- Permissions
- Inventory
- Recipes
- Menu items
- Stations
- Cancellation states
- Operational events

If a required domain object does not exist:

1. Inspect `lib/db.ts`.
2. Determine whether the object already exists under another name.
3. Extend the canonical model only when necessary.
4. Update dependent code consistently.

Never create a duplicate interface inside a page or API route simply because it is convenient.

---

# 8. Canonical Operational State

`lib/store.ts` is the canonical operational state/data-access boundary.

All operational mutations should flow through the store.

Examples:

- Create order
- Update order status
- Cancel order
- Deplete inventory
- Restore inventory
- Record loss
- Record dispatch
- Record operational activity
- Read operational summaries

Do not create:

```text
globalInventory

inside individual API routes if the canonical store already provides inventory state.

Do not maintain multiple runtime copies of inventory.

Do not maintain multiple runtime copies of orders.


---

9. Single Source of Truth

There must be one operational truth.

For example:

Order:

Order Injection
      ↓
Canonical Order
      ↓
Store
      ↓
Live Orders
      ↓
Cook KDS
      ↓
Dispatch
      ↓
Analytics

Inventory:

Inventory
      ↓
Recipe consumption
      ↓
Order preparation
      ↓
Inventory movement
      ↓
Current stock
      ↓
Inventory alerts
      ↓
Owner analytics

The same order must be visible to every operational area that needs it.

The same inventory movement must be reflected everywhere.


---

10. No Isolated Screens

Do not build pages independently.

The following screens must be connected:

/login
   ↓
/owner
   ↓
Order Injection
   ↓
/orders or Live Orders
   ↓
/cook
   ↓
/dispatch
   ↓
Inventory
   ↓
Owner Analytics

A screen that displays data but cannot participate in the operational workflow is incomplete.


---

11. Screenshot Rules

Screenshots are visual and interaction references.

They may describe:

Layout

Navigation

Component placement

Information hierarchy

Visual density

Table structure

Cards

Filters

Buttons

Status indicators

User flow


Screenshots do NOT override:

lib/db.ts

lib/store.ts

API contracts

Business rules

Security rules

Permission rules

Existing verified architecture


Never copy a screenshot literally if doing so would break the application architecture.


---

12. UI Requirements

The application must behave like a real operational system.

Avoid:

Static mockups

Hard-coded fake operational results

Decorative dashboards

Placeholder buttons that do nothing

Fake order transitions

Fake inventory changes

Hard-coded analytics

Repeated sample data

Empty panels without explanation


Every important action should have a real operational consequence.


---

13. Required UI States

Operational pages should support:

Loading

Show a clear loading state while data is being retrieved.

Empty

Explain that there is currently no data.

Error

Show a useful error message.

Success

Confirm successful actions.

Permission denied

Clearly explain that the current employee does not have the required permission.

Stale / refresh

Where appropriate, allow the user to refresh or automatically refresh operational information.


---

14. Authentication

Authentication must use the existing project authentication architecture.

Do not invent another login mechanism.

Employee identity should be resolved consistently.

Permission checks must use canonical employee and permission data.

Do not duplicate permission definitions inside pages.


---

15. Permissions

Permissions are business rules.

Do not assume:

> Logged in = allowed to do everything.



Always verify the required permission.

Examples:

OWNER_VIEW
INVENTORY_VIEW
INVENTORY_MANAGE
COOK_ORDERS
DISPATCH_ORDERS
ORDER_CANCEL
STAFF_MANAGE

Use canonical permission definitions.


---

16. Order Lifecycle

The canonical order lifecycle is:

PENDING
↓
PREPARING
↓
READY_FOR_PICKUP
↓
DISPATCHED

If the existing domain model contains additional intermediate states such as:

DRIVER_ASSIGNED
PICKED_UP

those states must be respected rather than replaced arbitrarily.

Never invent a second lifecycle.


---

17. Order Injection

Order Injection is a real operational feature.

It must create a canonical order.

The order should include the required domain information such as:

Order ID

Brand

Kitchen

Channel

Customer information where applicable

Items

Quantities

Pricing where applicable

Status

timestamps

operational metadata


The injected order must become visible to downstream workflows.


---

18. Inventory

Inventory must use the canonical inventory model.

Do not introduce competing fields such as:

stock

when the canonical model uses:

currentStock

Likewise, use the canonical:

reorderThreshold

instead of inventing:

threshold

unless the existing domain model explicitly defines both.


---

19. Inventory Depletion

Inventory depletion must happen through the canonical operational logic.

Never allow:

Order API → depletion
Cook UI → depletion
Dispatch UI → depletion

to independently consume the same ingredients.

That would create double depletion.

Determine the correct business event that causes consumption and process it once.


---

20. Inventory Restoration

Cancellation before preparation may require inventory restoration.

Restoration must be:

Idempotent where practical

Linked to the affected order

Linked to the original inventory movement

Protected against duplicate restoration


Do not simply increase stock without recording why.


---

21. Cancellation Rules

Use these rules:

Before preparation

Attempt to restore consumed ingredients if operationally possible.

If restoration is not possible:

record consumed ingredients as loss

After preparation

Treat cancellation as:

food/labor loss

Do not silently return prepared food ingredients to usable inventory.

After pickup

Treat cancellation as:

aggregator/accounting claim case

Record the relevant dispatch evidence.

Where applicable, create a food-loss / claim record for reconciliation.


---

22. Idempotency

Operational mutations should be safe against accidental repetition.

Examples:

Double-clicking "Start Preparing"

Refreshing after an action

Repeating a cancellation request

Retrying an inventory mutation

Replaying an API request


Do not allow the same business event to execute twice.


---

23. Analytics

Analytics must be derived from operational data.

Do not create fake analytics merely to make a dashboard look populated.

Examples:

Kitchen performance may derive from:

Orders

Preparation timestamps

Completion timestamps

Dispatch timestamps

Cancellation counts

Loss

Throughput


Channel performance may derive from:

Orders by channel

Revenue where available

Cancellation

Preparation

Dispatch

Operational outcomes


If insufficient data exists, display:

No data available

with an explanation rather than inventing numbers.


---

24. Owner Command Center

The Owner page is the command center.

It should provide visibility into:

Current orders

Order status

Kitchen performance

Channel performance

Inventory alerts

Operational activity

Exceptions

Cancellations

Loss

Dispatch activity

Brand performance

Kitchen performance


It should not become another cooking or dispatch station.


---

25. Cook KDS

The Cook screen is an operational preparation interface.

It should show relevant orders and allow permitted staff to perform preparation actions.

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

The KDS must operate against the canonical order state.


---

26. Dispatch

Dispatch is an operational workflow.

It should allow permitted staff to:

View ready orders

Assign driver where supported

Mark pickup

Complete dispatch

Record dispatch evidence


The dispatch state must be visible to the rest of the system.


---

27. Order Visibility

When an order changes state:

Owner
Cook
Dispatch
Analytics
Activity

must reflect the same canonical order state where relevant.

Do not make each screen maintain its own status.


---

28. Operational Activity

Important events should be traceable.

Examples:

Order created
Order started
Order prepared
Order marked ready
Driver assigned
Order picked up
Order dispatched
Order cancelled
Inventory depleted
Inventory restored
Loss recorded

Activity records should contain enough information to understand:

What happened

Which order/item/inventory was affected

Who performed the action

When it happened

Why it happened where applicable



---

29. Error Handling

Errors must be explicit.

Do not silently swallow failures.

Avoid patterns such as:

catch {
  return [];
}

when doing so hides an operational failure.

Prefer meaningful error handling that allows the UI to distinguish:

No data

Unauthorized

Forbidden

Validation failure

Server failure

Dependency failure



---

30. API Rules

API routes should:

1. Validate authentication.


2. Validate permissions.


3. Validate input.


4. Execute domain/application logic.


5. Mutate/read through the canonical store.


6. Return consistent responses.


7. Handle errors explicitly.



Do not place large business systems directly inside route handlers.


---

31. Client Rules

Client components may:

Display state

Collect user input

Trigger API requests

Manage presentation state

Poll or refresh operational data


Client components should not become a second backend.

Do not duplicate business rules in React components when those rules belong in the domain/application layer.


---

32. Dependency Discipline

Before adding a dependency:

1. Check whether the repository already solves the problem.


2. Check whether the dependency is compatible with the existing Next.js version.


3. Consider deployment compatibility.


4. Consider Android/Termux limitations.


5. Avoid unnecessary dependencies.



Do not install packages merely because they are convenient.


---

33. Next.js Architecture

Use:

Next.js

App Router

TypeScript

React

Tailwind where already configured


Do not introduce an incompatible application architecture.

Do not migrate to another framework.

Do not create a second application inside the repository.


---

34. File Modification Rules

Before modifying a file:

1. Read it.


2. Understand its purpose.


3. Check its imports.


4. Check consumers.


5. Check related domain models.


6. Check API contracts.


7. Make the smallest coherent change.



Do not rewrite large sections unnecessarily.


---

35. No Hallucinated Files

Never claim that a file exists without checking.

Never claim an API exists without inspecting it.

Never claim a deployment passed without verification.

Never claim a test passed without running it.

Never invent:

database schemas

APIs

environment variables

permissions

fields

routes

components

deployment settings


when they are not present.


---

36. Repository Inspection

Before a substantial BUILD operation, inspect:

package.json
tsconfig.json
next.config.*
middleware.*
lib/
app/
components/
public/

Also inspect project instruction files.

Then create an implementation plan based on the actual repository.


---

37. Change Discipline

Prefer:

small coherent change
→ validate
→ integrate
→ validate again

over:

rewrite everything
→ hope it works

Never replace working architecture merely to make implementation easier.


---

38. Git Discipline

Before making major changes:

git status

After changes:

git diff

Then validate.

Do not commit unrelated files.

Do not commit secrets.

Do not commit:

.env
.env.local
API keys
tokens
passwords
credentials


---

39. Validation

At minimum, when available:

npm run build

Also perform:

TypeScript validation
API validation
Authentication validation
Permission validation
Core workflow validation
UI integration validation

If local development is unavailable because of platform-specific tooling, do not falsely report that the application is broken.

Distinguish:

application failure

from:

local environment limitation


---

40. Production Definition of Done

A feature is complete only when:

The UI exists.

The API exists where required.

Authentication works.

Permissions work.

Domain logic works.

Store integration works.

Data mutation works.

Downstream screens see the change.

Errors are handled.

Loading states exist.

Empty states exist.

The feature survives refresh where applicable.

Build passes.

No duplicate operational state was introduced.



---

41. Agent Handoff

When multiple agents or coding tools are used, every agent must document:

Files inspected
Files changed
Architecture decisions
APIs changed
Domain changes
Store changes
Tests run
Tests passed
Known issues
Next required action

Never leave another agent guessing what happened.


---

42. Conflict Resolution

If two implementation approaches conflict:

Prefer the approach that:

1. Preserves the canonical domain model.


2. Preserves the canonical store.


3. Minimizes duplicate state.


4. Preserves existing working behavior.


5. Maintains end-to-end workflow integrity.


6. Requires the fewest architectural changes.



Do not choose based merely on which implementation is shorter.


---

43. Final Rule

DarKitOS must behave as one Cloud Kitchen Operating System.

The objective is not:

> "Make every page look good."



The objective is:

> "Make every operational area share the same truth and work together."



The final system should allow a real operational journey:

LOGIN
  ↓
OWNER
  ↓
ORDER INJECTION
  ↓
LIVE ORDER
  ↓
COOK KDS
  ↓
READY
  ↓
DISPATCH
  ↓
COMPLETED
  ↓
INVENTORY
  ↓
ACTIVITY
  ↓
ANALYTICS

Every implementation decision should strengthen this chain rather than create another isolated feature.
