
# DarKitOS Full-Stack Feature Implementation Protocol

## 1. Purpose

This document defines how a complete DarKitOS feature must be designed, implemented, integrated, and verified.

A feature is not considered complete when:

```text
The page renders.

A feature is complete when:

UI
 ↓
API
 ↓
Domain / Application Logic
 ↓
Store
 ↓
Operational State
 ↓
Affected Screens
 ↓
Analytics / Activity where applicable

works as one connected system.


---

2. Core Principle

Never build an isolated feature.

Every feature must be evaluated against:

Authentication
Authorization
Domain
Store
API
UI
Operational State
Inventory
Orders
Activity
Analytics
Deployment

Only the layers affected by the feature need to change.

Do not modify unrelated layers unnecessarily.


---

3. Feature Lifecycle

Every substantial feature follows:

REQUIREMENT
     ↓
REPOSITORY INSPECTION
     ↓
ARCHITECTURE MAPPING
     ↓
DOMAIN CHECK
     ↓
STORE CHECK
     ↓
API DESIGN
     ↓
PERMISSION CHECK
     ↓
UI IMPLEMENTATION
     ↓
INTEGRATION
     ↓
TESTING
     ↓
BUILD
     ↓
END-TO-END VERIFICATION

Do not skip directly from requirement to UI.


---

4. Step 1: Requirement Extraction

Before coding, determine:

What is being requested?
Who uses it?
What problem does it solve?
What data does it require?
What data does it change?
What permissions are required?
Which screens are affected?
Which APIs are affected?
Which business rules are affected?

Write down the answers before implementation when the feature is substantial.


---

5. Step 2: Repository Inspection

Search the repository for:

Relevant routes
Relevant components
Relevant domain types
Relevant store functions
Relevant APIs
Relevant permissions
Relevant statuses
Relevant events
Relevant tests

Do not create a new implementation before determining whether one already exists.


---

6. Step 3: Architecture Mapping

Map the requested feature onto:

UI
 ↓
API
 ↓
Domain
 ↓
Store
 ↓
Persistence

Example:

Order Injection
 ↓
POST /api/orders
 ↓
Order creation logic
 ↓
Store.createOrder()
 ↓
Operational state

Then determine which screens consume the resulting state.


---

7. Step 4: Domain Check

Inspect lib/db.ts.

Determine:

Does the required entity already exist?
Does the required field already exist?
Does the required status already exist?
Does the required permission already exist?
Does the required event already exist?

If yes:

Reuse it.

If incomplete:

Extend it carefully.

If genuinely missing:

Add it to the canonical domain model.

Do not define a second domain model elsewhere.


---

8. Step 5: Store Check

Inspect lib/store.ts.

Determine whether the feature can use an existing operation.

For example:

Create
Read
Update
Delete
Transition
Cancel
Restore
Consume
Record

If the required operation exists:

Reuse it.

If it is incomplete:

Extend it.

Do not create another runtime state source.


---

9. Step 6: Permission Check

Determine:

Who may view this feature?
Who may create?
Who may modify?
Who may cancel?
Who may approve?
Who may dispatch?

Use canonical permissions.

Never make authorization depend only on the UI.


---

10. Step 7: API Contract

Before implementing the UI, establish the API contract.

Define:

HTTP method
Route
Request
Authentication
Permission
Validation
Success response
Error responses

Use existing API conventions.

Do not create duplicate routes.


---

11. API Request Flow

The preferred flow is:

Request
 ↓
Authenticate
 ↓
Resolve Employee
 ↓
Authorize
 ↓
Validate Input
 ↓
Domain/Application Logic
 ↓
Store
 ↓
Return Result


---

12. API Validation

Validate all required input.

Examples:

Missing order item
Invalid quantity
Unknown brand
Unknown kitchen
Unknown channel
Invalid status transition
Invalid inventory quantity
Unauthorized employee

Invalid input must not silently enter operational state.


---

13. API Error Contract

Where supported by the existing application, distinguish:

400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
500 Internal Server Error

The exact response structure should follow existing project conventions.

Do not create a different error format for every feature.


---

14. Step 8: Domain/Application Logic

Business rules belong here.

Examples:

Order creation
Order transition
Inventory consumption
Inventory restoration
Cancellation
Loss
Dispatch

Do not move complex business logic into React components.


---

15. Step 9: Store Mutation

Operational changes must pass through the canonical store.

Example:

Create Order
 ↓
Store
 ↓
Canonical Operational State

not:

Create Order
 ↓
React state


---

16. Step 10: UI Implementation

Only after understanding the data flow should the UI be implemented.

The UI must:

Display real data
Collect valid input
Call real APIs
Handle responses
Handle errors
Respect permissions
Refresh operational state


---

17. UI State Model

Every asynchronous feature should consider:

INITIAL
 ↓
LOADING
 ↓
SUCCESS

or:

LOADING
 ↓
EMPTY

or:

LOADING
 ↓
ERROR

Actions should support:

IDLE
 ↓
SUBMITTING
 ↓
SUCCESS / ERROR


---

18. UI Must Not Fake Success

Never display:

Order created!

unless the server actually confirmed creation.

Never display:

Inventory updated!

unless the mutation succeeded.

Never transition a UI card permanently to another status merely because the button was clicked.

The canonical operational state must confirm the change.


---

19. Optimistic UI

Optimistic updates may be used only when:

The operation is safe to retry.

Failure can be rolled back.

The canonical state will be revalidated.

The UX genuinely benefits.


For critical operational mutations, prefer confirmed server state.


---

20. Order Feature Protocol

For an order-related feature:

1. Inspect Order type.
2. Inspect OrderItem type.
3. Inspect order status.
4. Inspect store.
5. Inspect order API.
6. Inspect inventory interaction.
7. Inspect permissions.
8. Inspect Cook.
9. Inspect Dispatch.
10. Inspect Owner.
11. Implement.
12. Test downstream effects.


---

21. Order Injection Protocol

Order Injection should follow:

User Input
 ↓
Validation
 ↓
Brand Selection
 ↓
Kitchen Selection
 ↓
Channel Selection
 ↓
Menu / Item Selection
 ↓
Quantity
 ↓
Order Creation
 ↓
Canonical Store
 ↓
Live Order

After creation verify:

Order exists
Correct brand
Correct kitchen
Correct channel
Correct items
Correct quantity
Correct status


---

22. Live Orders Protocol

Live Orders must consume canonical order data.

The screen must support the actual states defined by the domain.

It should not maintain a separate fake status system.


---

23. Cook Protocol

The Cook KDS should:

Load eligible orders
 ↓
Display operational information
 ↓
Allow permitted transition
 ↓
Call API
 ↓
Update canonical state
 ↓
Refresh

After a transition verify the order state.


---

24. Dispatch Protocol

Dispatch should:

Load ready orders
 ↓
Display dispatch information
 ↓
Perform permitted action
 ↓
Call API
 ↓
Update canonical state
 ↓
Record operational event
 ↓
Refresh


---

25. Inventory Feature Protocol

For inventory features inspect:

InventoryItem
Recipe
RecipeIngredient
Order
Store
Inventory API
Permissions
Consumption logic
Restoration logic
Activity

Before changing inventory logic determine exactly where consumption currently occurs.


---

26. Inventory Mutation Protocol

A mutation should conceptually follow:

Request
 ↓
Validate item
 ↓
Validate quantity
 ↓
Validate permission
 ↓
Determine movement reason
 ↓
Apply movement
 ↓
Update current stock
 ↓
Record movement/activity
 ↓
Return canonical result


---

27. Inventory Depletion

Do not automatically deplete inventory at every workflow stage.

Determine the canonical business event.

For example:

Order creation

may or may not consume inventory depending on the domain rules.

The repository's existing implementation and business rules must be inspected first.


---

28. Inventory Restoration

Restoration must be associated with:

Order
Inventory item
Quantity
Reason
Original consumption where available
Employee
Timestamp

Use existing domain fields where available.

Do not invent a large new schema merely to satisfy this conceptual model.


---

29. Cancellation Feature Protocol

Cancellation requires stage-aware behavior.

First determine:

Current order status
Preparation state
Pickup state
Inventory consumed

Then apply the correct business rule.


---

30. Cancellation Before Preparation

Conceptually:

Cancel
 ↓
Determine consumed ingredients
 ↓
Can they be restored?
 ├── YES → Restore
 └── NO  → Record Loss
 ↓
Update Order
 ↓
Record Event


---

31. Cancellation After Preparation

Conceptually:

Cancel
 ↓
Food/Labor Loss
 ↓
Update Order
 ↓
Record Loss/Event

Do not return prepared ingredients to usable inventory without a domain-approved reason.


---

32. Cancellation After Pickup

Conceptually:

Cancel
 ↓
Preserve dispatch/pickup evidence
 ↓
Aggregator/accounting claim
 ↓
Record operational event

The exact claim mechanism depends on the existing domain.


---

33. Cancellation Idempotency

Repeated cancellation must not cause:

Double restoration
Double loss
Duplicate claim
Duplicate event

A second cancellation request should recognize that the order has already been processed.


---

34. Cross-Screen Integration

When a feature changes operational data, identify every affected consumer.

Example:

Create Order
 ↓
Orders
 ↓
Cook
 ↓
Dispatch
 ↓
Owner
 ↓
Analytics
 ↓
Activity

Not every screen needs modification.

Every affected screen must be evaluated.


---

35. Owner Integration

If a feature changes operational data, determine whether the Owner Command Center should reflect:

New count
New status
New alert
New activity
New metric
New exception

Do not hard-code a new metric.

Derive it from operational state.


---

36. Activity Integration

If an action is operationally meaningful, determine whether an activity/event should be recorded.

Examples:

Order Created
Order Started
Order Ready
Order Dispatched
Order Cancelled
Inventory Adjusted
Loss Recorded

Use canonical event definitions where available.


---

37. Analytics Integration

Do not add analytics simply because a new feature exists.

Ask:

Does this feature create data that an existing analytic should consume?

If yes:

Update the analytic derivation.

Do not create fake metrics.


---

38. Multi-Brand Integration

When a feature involves an order:

Verify that the feature respects:

Brand
Kitchen
Channel

Do not assume a single-brand environment.


---

39. Multi-Kitchen Integration

When a feature involves production:

Verify that the kitchen is explicitly resolved.

Do not assume:

One brand = one kitchen

The architecture supports brands operating from multiple physical kitchens.


---

40. Channel Integration

Orders may originate from different channels.

The channel must remain part of the canonical order context.

Examples may include:

Direct
Aggregator
Phone
Website
Manual

Use the actual configured channel definitions.


---

41. Employee Context

Operational actions should be attributable to an employee where the domain supports it.

Examples:

Created by
Prepared by
Dispatched by
Cancelled by
Adjusted by

Use canonical employee information.


---

42. Feature Validation

After implementation test:

Happy path
Invalid input
Unauthorized user
Forbidden user
Missing data
Empty state
Server failure
Repeated action
Refresh


---

43. End-to-End Feature Test

A complete feature test should answer:

Can the user start the workflow?
 ↓
Can the system validate it?
 ↓
Can the server authorize it?
 ↓
Can the domain process it?
 ↓
Can the store mutate state?
 ↓
Can the UI display the result?
 ↓
Can downstream screens see it?
 ↓
Can analytics/activity reflect it?


---

44. Build Validation

After implementing a substantial feature:

npm run build

must be run where the environment supports it.

If the build fails:

Do not declare completion.


---

45. Type Validation

Fix genuine type errors.

Do not hide them with:

any
@ts-ignore
@ts-expect-error

unless there is a documented, deliberate reason.


---

46. Runtime Validation

A successful build is insufficient.

Test the actual workflow.

For example:

Build passes

does not prove:

Order Injection works

Test both.


---

47. Deployment Validation

If the feature is intended for production:

Build
 ↓
Commit
 ↓
Push
 ↓
Deployment
 ↓
Production verification

Do not assume deployment is successful merely because GitHub accepted the commit.


---

48. Regression Testing

After changing shared architecture:

Test the features that depend on it.

For example, changing:

lib/store.ts

may require testing:

Orders
Cook
Dispatch
Inventory
Owner
Analytics


---

49. Change Impact Analysis

Before modifying a shared file:

Identify:

Consumers
Imports
API dependencies
UI dependencies
Domain dependencies
Tests

Then assess the impact.


---

50. Smallest Correct Change

Prefer:

Smallest change
+
Correct architecture
+
Complete integration

over:

Large rewrite
+
Unnecessary migration


---

51. Do Not Rewrite the Repository

Do not replace the entire project because:

The UI is ugly.

One component is inconvenient.

One API is poorly structured.

A screenshot looks different.

A cleaner framework seems available.


Improve the existing system unless a deliberate architectural migration has been approved.


---

52. Visual Redesign Protocol

If the request is primarily visual:

Inspect existing functionality
 ↓
Preserve APIs
 ↓
Preserve domain
 ↓
Preserve store
 ↓
Redesign UI
 ↓
Verify behavior

Do not accidentally break operational functionality while redesigning.


---

53. Functional Redesign Protocol

If the request changes behavior:

Inspect domain
 ↓
Inspect store
 ↓
Inspect APIs
 ↓
Implement business rule
 ↓
Update UI
 ↓
Update affected workflows
 ↓
Test


---

54. New Screen Protocol

Before creating a new screen:

Ask:

Does an existing screen already serve this purpose?

If yes:

Extend the existing screen.

If no:

Create the screen.

Then determine:

Route
Permission
Data
API
Store
Navigation
Responsive behavior


---

55. New API Protocol

Before creating a new API:

Search existing APIs
 ↓
Determine resource boundary
 ↓
Determine method
 ↓
Determine permissions
 ↓
Determine validation
 ↓
Determine store operation
 ↓
Implement
 ↓
Test


---

56. New Domain Field Protocol

Before adding a field:

Search existing fields
 ↓
Determine whether an existing field is sufficient
 ↓
Determine all consumers
 ↓
Add field to canonical model
 ↓
Update affected consumers
 ↓
Test

Do not add the field only to a UI interface.


---

57. New Status Protocol

Before adding an order status:

Determine:

Why is the status necessary?
Who enters it?
Who exits it?
What actions are allowed?
What inventory effect exists?
What activity is recorded?
What analytics depend on it?

A status is part of the domain, not merely a label.


---

58. New Permission Protocol

Before adding a permission:

Determine:

What action does it protect?
Who should have it?
Which API requires it?
Which UI uses it?
Which role receives it?

Do not create permissions merely to hide buttons.


---

59. New Operational Event Protocol

Before adding an event:

Determine:

What business event occurred?
What entity changed?
Who caused it?
When?
Why?

Use the canonical event model.


---

60. Data Integrity Gate

Before completion verify:

[ ] No duplicate operational state
[ ] No duplicate domain type
[ ] No duplicate permission
[ ] No duplicate order lifecycle
[ ] No double inventory mutation
[ ] No silent business rule bypass
[ ] No fake success


---

61. Security Gate

Verify:

[ ] Authentication
[ ] Authorization
[ ] Input validation
[ ] Server-side permission enforcement
[ ] No secret exposure
[ ] No sensitive logging


---

62. UI Gate

Verify:

[ ] Loading
[ ] Empty
[ ] Error
[ ] Success
[ ] Disabled/submitting state
[ ] Responsive behavior
[ ] Accessible interaction
[ ] Real data


---

63. Integration Gate

Verify:

[ ] API connected
[ ] Domain connected
[ ] Store connected
[ ] Operational state updated
[ ] Affected screens updated
[ ] Activity updated where applicable
[ ] Analytics updated where applicable


---

64. Build Gate

Verify:

[ ] TypeScript
[ ] Next.js build
[ ] Routes
[ ] Imports
[ ] Dependencies

Run:

npm run build

where supported.


---

65. Deployment Gate

For production-bound features:

[ ] Commit reviewed
[ ] No secrets
[ ] Push successful
[ ] Deployment successful
[ ] Production route loads
[ ] Authentication works
[ ] Feature works
[ ] Downstream workflow works


---

66. Feature Completion Report

At the end of implementation report:

Requirement

What was requested.

Implementation

What was implemented.

Domain

What changed in the domain model.

Store

What changed in the operational store.

API

What routes changed or were added.

UI

What screens/components changed.

Permissions

What permissions were used or changed.

Integration

Which downstream systems were affected.

Testing

What was actually tested.

Build

Whether npm run build passed.

Deployment

Whether deployment was tested.

Known Issues

What remains unresolved.


---

67. No False Completion

Do not say:

Feature complete.

if any of the following are unknown:

API behavior
Store mutation
Permission behavior
Data integrity
Build
End-to-end workflow

Use:

Partially complete

when necessary.


---

68. Master Feature Acceptance

A feature is considered complete only if:

FEATURE
                       │
                       ▼
                ┌────────────┐
                │    UI      │
                └─────┬──────┘
                      │
                      ▼
                ┌────────────┐
                │    API     │
                └─────┬──────┘
                      │
                      ▼
                ┌────────────┐
                │   DOMAIN   │
                └─────┬──────┘
                      │
                      ▼
                ┌────────────┐
                │   STORE    │
                └─────┬──────┘
                      │
                      ▼
             OPERATIONAL STATE
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
       ORDERS      INVENTORY   ACTIVITY
          │                       │
          └───────────┬───────────┘
                      ▼
                  ANALYTICS

Only the relevant branches need to be updated for a particular feature.


---

69. Master Principle

Every feature must strengthen the single operational truth.

Do not create:

One UI truth
+
One API truth
+
One inventory truth
+
One analytics truth

Create:

One operational truth
        ↓
Many views


---

70. Final Rule

When implementing any feature, ask:

Where does the truth live?
Who is allowed to change it?
Which business rule controls the change?
Which API exposes it?
Which store operation performs it?
Which screens consume it?
What happens if the operation fails?
What happens if it is repeated?
What happens to inventory?
What happens to activity?
What happens to analytics?

If these questions cannot be answered:

STOP

Inspect the architecture before coding.


---

71. Final Implementation Sequence

The preferred implementation sequence is:

1. Understand requirement
2. Inspect repository
3. Identify canonical domain
4. Identify canonical store
5. Identify permissions
6. Identify affected APIs
7. Implement domain/application logic
8. Implement store operation
9. Implement/update API
10. Implement/update UI
11. Connect navigation
12. Test happy path
13. Test failure paths
14. Test permissions
15. Test idempotency
16. Test downstream effects
17. Run build
18. Review diff
19. Deploy if required
20. Verify production


---

72. Final Definition

A DarKitOS full-stack feature is:

Not a page.

Not a component.

Not an API.

Not a database change.

It is a complete operational capability
that participates in the application's
single source of truth.

That is the standard every substantial feature must meet.
