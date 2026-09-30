

# DarKitOS Contribution & Development Rules

## 1. Purpose

This document defines how DarKitOS should be modified, extended, tested, and maintained.

DarKitOS is a unified Cloud Kitchen Operating System.

Contributors and coding agents must preserve the system's operational integrity while making changes.

The goal is not simply to add code.

The goal is to add working functionality without breaking:

- Authentication
- Authorization
- Orders
- Inventory
- Cooking
- Dispatch
- Analytics
- Brands
- Kitchens
- Channels
- Operational activity
- Existing working functionality

---

# 2. Before Changing Anything

Do not immediately start writing code.

First inspect the repository.

At minimum inspect:

```text
package.json
tsconfig.json
next.config.*
middleware.*
lib/
app/
components/
public/

Also inspect:

agents.md
architecture.md
CLAUDE.md
cloud.md
full-stack-feature.md
SCREENSHOT_SPEC.md
MASTER_BUILD_PROMPT.md

if they exist.


---

3. Understand Before Modifying

Before modifying a file, determine:

1. What does this file do?


2. Who imports it?


3. What does it import?


4. What data does it consume?


5. What data does it mutate?


6. Is it part of the canonical architecture?


7. Does another file already perform the same function?



Do not modify code merely because it looks different from the desired implementation.

Existing code may contain intentional architecture.


---

4. Repository Search First

Before creating a new:

Function

Interface

Type

API route

State container

Utility

Component

Data structure

Permission

Status

Event


search the repository.

The question is:

Does this already exist?

If yes:

Reuse it.

If it is incomplete:

Extend it.

Only create a new abstraction when there is a genuine architectural reason.


---

5. Canonical Sources

The primary architectural sources are:

lib/db.ts
lib/store.ts

lib/db.ts defines the canonical domain model.

lib/store.ts defines the canonical operational data-access/state boundary.

Do not create competing versions.


---

6. Never Duplicate Domain Types

Do not write:

interface Order {
  ...
}

inside a page or API route if a canonical Order already exists.

Instead import the canonical type.

The same rule applies to:

Brand
Kitchen
Channel
Employee
Permission
InventoryItem
Recipe
MenuItem
OrderItem
Order
Station
Event


---

7. Never Duplicate Operational State

Avoid creating independent state such as:

const globalInventory = ...

inside an API route if the application already has canonical inventory state.

Likewise avoid:

const orders = [...]

inside individual screens when those orders represent the application's operational orders.

A page may maintain presentation state.

It must not create a competing operational truth.


---

8. Required Data Flow

The application must follow:

UI
 ↓
API Route
 ↓
Domain / Application Logic
 ↓
Store
 ↓
Persistence

Do not bypass the architecture without a documented reason.


---

9. UI Responsibilities

UI code may:

Render data

Collect input

Display state

Call APIs

Manage presentation state

Show loading states

Show errors

Show empty states

Refresh operational data


UI code should not be the authoritative location for:

Permission decisions

Inventory mutations

Order lifecycle rules

Cancellation business rules

Loss calculations

Security checks


Those belong in the server/domain/application layers.


---

10. API Responsibilities

API routes should:

1. Authenticate the request.


2. Resolve the employee.


3. Verify permissions.


4. Validate input.


5. Call appropriate application/domain logic.


6. Use the canonical store.


7. Return a predictable response.


8. Handle errors correctly.



Avoid turning a route handler into an entire business application.


---

11. Authentication

Do not create a new authentication mechanism unless explicitly required.

Use the existing project authentication architecture.

When modifying authentication:

Inspect:

middleware.ts
app/api/login/
app/login/
employee definitions
permission definitions

before making changes.

Authentication changes must be tested against all protected routes.


---

12. Authorization

Authentication and authorization are different.

Authentication:

Who is the employee?

Authorization:

What may this employee do?

Never rely on a hidden UI button as a security mechanism.

The API/domain layer must enforce permissions.


---

13. Permission Changes

Before adding or changing a permission:

1. Search lib/db.ts.


2. Search API routes.


3. Search middleware.


4. Search UI references.


5. Determine whether the permission already exists.


6. Update all affected consumers consistently.



Never create a permission only inside one page.


---

14. Order Changes

Before modifying order behavior inspect:

Order type
OrderItem type
Order status definitions
Order API
Store
Inventory logic
Cook UI
Dispatch UI
Owner UI

An order change is rarely isolated.


---

15. Order Lifecycle

Respect the canonical lifecycle:

PENDING
 ↓
PREPARING
 ↓
READY_FOR_PICKUP
 ↓
DISPATCHED

If the repository supports additional states, preserve them.

Never create a second incompatible lifecycle.


---

16. Status Transition Rules

Every status-changing operation must verify:

Current status
+
Employee
+
Permission
+
Allowed transition

The client must not be trusted to decide whether a transition is valid.


---

17. Order Injection

Order Injection must create a real canonical order.

Do not build an Order Injection screen that merely displays:

Order created successfully

without actually creating the order.

After creation, verify that the order appears in the appropriate operational views.


---

18. Inventory Changes

Inventory changes must use the canonical inventory model.

Use canonical fields.

For example, if the domain defines:

currentStock
reorderThreshold

do not introduce:

stock
threshold

as alternative operational fields.


---

19. Inventory Mutation

Inventory mutation must occur through the appropriate domain/store operation.

Avoid direct UI mutations such as:

inventory.stock -= quantity;

when business logic belongs in the store.

Inventory movement should be traceable.


---

20. Inventory Depletion

Before implementing inventory consumption determine:

1. When consumption occurs.


2. Which business event causes it.


3. Which store function performs it.


4. Whether it can be repeated.


5. How the movement is recorded.



Do not allow multiple parts of the system to consume the same stock.


---

21. Cancellation

Cancellation must follow the business rules.

Before preparation

Attempt to restore ingredients where operationally possible.

If restoration is impossible:

Record loss.

After preparation

Treat as food/labor loss.

Do not automatically return prepared food ingredients to usable stock.

After pickup

Treat as an aggregator/accounting claim case.

Preserve dispatch evidence.


---

22. Cancellation Must Be Traceable

A cancellation should identify:

Order
Employee
Time
Operational stage
Inventory consequence
Loss consequence
Claim consequence where applicable

The exact fields must follow the existing domain model.


---

23. Idempotency

Operational mutations must be protected against repeated execution.

Examples:

Double-click
Browser refresh
Network retry
API retry
Repeated cancellation
Repeated status update
Repeated inventory restoration

Repeated execution must not create duplicate business effects.


---

24. Adding a New API Route

Before creating a route:

1. Search for an existing route handling the same resource.


2. Inspect related store functions.


3. Inspect domain types.


4. Check authentication requirements.


5. Check permissions.


6. Define the API contract.


7. Implement validation.


8. Test success and failure cases.



Do not create:

/api/orders2
/api/new-orders
/api/inventory-new

merely because the existing route is inconvenient.


---

25. API Response Consistency

Responses should clearly distinguish:

Success
Unauthorized
Forbidden
Validation error
Not found
Conflict
Server error

Do not return a successful HTTP response containing an error merely to simplify client code.


---

26. Error Handling

Never silently hide operational failures.

Avoid:

catch {
  return [];
}

when the underlying operation failed.

The UI should be able to distinguish:

No data

from:

Failed to load data


---

27. Loading States

Async pages should show an appropriate loading state.

Do not immediately show:

No orders

while the application is still fetching orders.


---

28. Empty States

Empty data is valid.

Examples:

No active orders.
No low-stock items.
No recent activity.
No dispatches pending.

Empty states should explain what the user is seeing.

Do not insert fake records simply to populate the interface.


---

29. Fake Data Policy

Development seed data may exist where appropriate.

However:

Do not confuse seed data with production data.

Do not fabricate analytics.

Do not fabricate operational events.

Do not fabricate completed orders to make dashboards look impressive.


If there is no real data, say so.


---

30. Screenshot Implementation

Screenshots are reference material.

They may influence:

Layout

Navigation

Spacing

Information hierarchy

Component arrangement

Visual density

Interaction patterns


They do not override the domain model.

Never copy a screenshot into code as a static mockup when the screen is supposed to be operational.


---

31. Responsive Design

Every major screen should be evaluated at:

Mobile
Tablet
Desktop

Check:

Navigation

Tables

Cards

Buttons

Forms

Modals

Filters

Status badges

Scroll behavior


Operational information must remain usable.


---

32. Component Reuse

Reuse components when they represent the same concept.

Examples:

StatusBadge
OrderCard
InventoryAlert
Navigation
Modal
DataTable

Do not create:

OrderCardA
OrderCardB
OrderCardOwner
OrderCardCook

if they represent the same reusable concept.

However, do not force unrelated workflows into one giant component.


---

33. Component Size

If a component becomes difficult to reason about, consider splitting it.

Good boundaries include:

Data fetching
Presentation
Form
Table
Modal
Status display
Operational action

Do not split components merely to increase the file count.


---

34. State Management

Use the simplest state architecture compatible with the existing project.

Do not introduce a global state library merely because it is popular.

Before adding one, determine whether:

React state
Server state
Store
API

already solve the requirement.


---

35. Polling

Operational pages may refresh periodically.

When implementing polling:

Use reasonable intervals.

Clean up timers.

Avoid duplicate polling.

Avoid requests after unmount.

Handle failed requests.

Preserve the latest known valid state where appropriate.



---

36. Performance

Do not optimize prematurely.

First ensure:

Correctness
Integrity
Security
Workflow

Then optimize:

Rendering
API requests
Polling
Data processing
Bundle size

Do not sacrifice correctness to reduce a few requests.


---

37. Dependencies

Before installing a package:

1. Search the repository.


2. Check whether the functionality already exists.


3. Check package compatibility.


4. Check Next.js compatibility.


5. Check Vercel compatibility.


6. Check whether the dependency is actually necessary.



Avoid dependency bloat.


---

38. Next.js Rules

DarKitOS uses the Next.js App Router.

Do not introduce another framework.

Do not create a parallel:

pages/

application unless the existing project explicitly requires it.

Prefer the existing App Router structure.


---

39. TypeScript

Do not solve TypeScript errors by weakening the type system unnecessarily.

Avoid unnecessary:

any

Prefer:

Existing canonical types
Explicit interfaces
Type guards
Validated input

Fix the actual type mismatch.


---

40. Environment Compatibility

DarKitOS may be developed from:

Android / Termux
GitHub
Codespaces
Vercel

A local platform limitation should not automatically be interpreted as an application failure.

For example:

Local ARM64 tooling issue

is different from:

Production build failure

Record the distinction.


---

41. Vercel Compatibility

Before deployment ensure:

npm run build

passes.

Verify:

Routes compile.

TypeScript passes.

Environment variables are configured.

No secrets are committed.

Server-only functionality is not accidentally executed in the browser.



---

42. Git Workflow

Before changes:

git status

After changes:

git diff

Inspect the diff before committing.

Commit only intended files.

Do not commit:

.env
.env.local
node_modules/
.next/
secrets
credentials
API keys
tokens


---

43. Avoid Blind git add .

Do not automatically use:

git add .

when unrelated files may exist.

Prefer explicitly staging intended files.

Example:

git add app/api/orders/route.ts
git add lib/store.ts

Then inspect:

git status


---

44. Commit Messages

Commit messages should describe the actual change.

Good:

Fix canonical inventory access

Good:

Add order injection workflow

Avoid:

changes
fix
update
final
working


---

45. Testing Before Commit

At minimum run the relevant checks.

For a production build:

npm run build

For a targeted feature:

Feature test
API test
Permission test
Workflow test

If a test cannot be run, explicitly report that.

Never claim it passed.


---

46. Full-Stack Feature Completion

A feature is not complete merely because:

The page renders.

A feature is complete when:

UI
 ↓
API
 ↓
Domain
 ↓
Store
 ↓
Operational State
 ↓
Other affected screens

works correctly.


---

47. Cross-Screen Verification

If an order is created:

Verify it appears where expected.

If an order status changes:

Verify downstream screens reflect it.

If inventory changes:

Verify inventory screens reflect it.

If an order is cancelled:

Verify the correct inventory/loss/activity effects.

If dispatch completes:

Verify owner activity/analytics can see the result where supported.


---

48. Documentation

When adding significant functionality, document:

What changed
Why it changed
Architecture impact
API changes
Domain changes
Store changes
Testing
Known limitations

Do not write documentation that claims functionality that does not exist.


---

49. Debugging Procedure

When something fails:

Step 1

Reproduce the problem.

Step 2

Identify the exact layer:

UI
API
Authentication
Authorization
Domain
Store
Persistence
Deployment

Step 3

Trace the data flow.

Step 4

Identify the root cause.

Step 5

Fix the smallest correct layer.

Step 6

Run the relevant test again.

Step 7

Run broader validation if the change affects shared architecture.


---

50. Do Not Patch Symptoms

Example:

If inventory is incorrect because two APIs maintain separate inventory state:

Do not patch the UI to display a different number.

Fix the state architecture.

Correct approach:

Duplicate state
      ↓
Remove duplication
      ↓
Canonical store
      ↓
All consumers use store


---

51. Do Not Hide Errors

Do not solve an error by:

Suppressing it
Returning fake data
Ignoring it
Removing the feature
Hard-coding a result

unless explicitly instructed.

Fix the underlying problem.


---

52. Security

Never expose:

Passwords

Tokens

API keys

Database credentials

Authentication secrets


in:

Client components

Logs

Git

Screenshots

Error responses


Use server-side environment variables where appropriate.


---

53. Logging

Debug logging may be added temporarily.

Logs should:

Identify the relevant operation.

Avoid sensitive information.

Be removable or appropriately controlled for production.


Do not log:

Passwords
Tokens
Session secrets
API keys


---

54. Database / Persistence Changes

If persistence is currently abstracted behind the store:

Do not bypass the store to directly access the persistence layer from UI code.

Future database integration should be possible without redesigning the UI.


---

55. Backward Compatibility

When changing an existing contract, inspect all consumers first.

For example:

Change Order.status

requires checking:

Owner
Orders
Cook
Dispatch
API
Store
Analytics
Tests

Do not modify one consumer and assume the rest will adapt automatically.


---

56. Refactoring

A refactor must preserve behavior unless the purpose of the refactor is explicitly to change behavior.

Before refactoring:

Understand existing behavior.

After refactoring:

Verify existing behavior.


---

57. Large Changes

For large features, use dependency order:

1. Domain
2. Store
3. API
4. Authentication / Permissions
5. UI
6. Integration
7. Testing

Do not build seven independent screens and attempt to connect them afterward.


---

58. Feature Branching

If branches are used:

Keep changes logically grouped.

Avoid mixing:

Authentication
+
Inventory
+
UI redesign
+
Unrelated formatting

in one change unless the architecture genuinely requires them together.


---

59. Review Checklist

Before declaring a change complete:

[ ] Existing architecture inspected
[ ] Canonical types reused
[ ] Canonical store reused
[ ] No duplicate operational state
[ ] Authentication verified
[ ] Permissions verified
[ ] API validation implemented
[ ] Error handling implemented
[ ] Loading state implemented
[ ] Empty state implemented
[ ] UI connected to real data
[ ] Downstream workflow verified
[ ] Inventory effects verified where applicable
[ ] Activity/events verified where applicable
[ ] Build tested
[ ] Git diff reviewed
[ ] No secrets committed


---

60. Definition of Done

A contribution is complete only when:

The requested functionality works.
+
Existing functionality still works.
+
The architecture remains coherent.
+
The operational data remains canonical.
+
Security is preserved.
+
The build passes.
+
The feature is integrated with affected workflows.


---

61. Final Contribution Principle

Every change should answer three questions:

Question 1

Does this solve the requested problem?

Question 2

Does it preserve the DarKitOS architecture?

Question 3

Does it keep the operational system internally consistent?

If the answer to any of these is no, the implementation is not ready.


---

62. Final Rule

Do not measure a contribution by how much code was written.

Measure it by whether the change makes DarKitOS:

More coherent
More reliable
More traceable
More secure
More operational

without creating another isolated subsystem.
