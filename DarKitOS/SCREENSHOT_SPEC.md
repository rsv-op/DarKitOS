

# DarKitOS Screenshot & Screen Specification

## 1. Purpose

This document defines the visual, functional, and operational expectations for the major DarKitOS screens.

The target screens are:

1. Login
2. Owner Command Center
3. Order Injection
4. Live Orders
5. Cook KDS
6. Dispatch
7. Inventory Management

These screens must operate as parts of one Cloud Kitchen Operating System.

They must not become seven independent mockups.

---

# 2. Screenshot Interpretation Rule

A screenshot communicates:

- Visual hierarchy
- Layout
- Navigation
- Information density
- Component placement
- Interaction patterns
- Status presentation
- User workflow

A screenshot does NOT define:

- Database schema
- Domain types
- API contracts
- Authentication architecture
- Permission architecture
- Inventory rules
- Order lifecycle
- Persistence
- Business logic

The implementation must follow:

```text
Screenshot
    ↓
Operational Requirement
    ↓
Canonical Domain
    ↓
Store
    ↓
API
    ↓
UI


---

3. Visual Reference vs Functional Reference

When a screenshot and the existing application architecture disagree:

Preserve

Canonical domain model

Canonical store

Security

Permissions

Business rules

Data integrity

Existing working integrations


Adapt

Layout

Typography

Spacing

Cards

Tables

Navigation

Responsive behavior

Visual hierarchy


The screenshot should influence the experience without breaking the system.


---

4. Global Design Direction

DarKitOS should feel like an operational control system.

The interface should prioritize:

Clarity
Speed
Status visibility
Actionability
Information density
Traceability

Avoid making it resemble a marketing website.

The user should be able to understand the operational state quickly.


---

5. Global Layout

A typical desktop layout should support:

┌─────────────────────────────────────────────────────────┐
│ Header / Brand / User / Context                         │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│ Navigation   │              Main Content                │
│              │                                          │
│              │                                          │
│              │                                          │
└──────────────┴──────────────────────────────────────────┘

The exact implementation should follow the existing application.

Do not create a second navigation architecture.


---

6. Global Navigation

The major operational destinations should be accessible through clear navigation.

Conceptually:

Owner
Orders
Order Injection
Cook
Dispatch
Inventory
Performance

Only show destinations appropriate to the authenticated employee where permission-based navigation is supported.

Navigation visibility is not a replacement for authorization.


---

7. Global Header Context

Where useful, the header may display:

DarKitOS identity

Current employee

Employee role

Current brand

Current kitchen

Notifications

Refresh

Logout


Only display information that exists in the canonical application model.


---

8. Status System

Operational statuses should be visually distinguishable.

Examples:

PENDING
PREPARING
READY_FOR_PICKUP
DRIVER_ASSIGNED
PICKED_UP
DISPATCHED
CANCELLED

Only use states actually defined by the domain.

Do not create visual statuses that imply unsupported business states.


---

9. Status Labels

Use clear human-readable labels.

For example:

PENDING
→ Pending

PREPARING
→ Preparing

READY_FOR_PICKUP
→ Ready for Pickup

The displayed label may differ from the internal enum.

Never change the underlying canonical status merely to improve presentation.


---

10. Screen 1: Login

Purpose

Authenticate an employee before allowing access to protected operational areas.


---

Expected Elements

The screen should communicate:

DarKitOS
Cloud Kitchen Operating System

Employee / Employee Code
Password / PIN where applicable

Sign In

Only include authentication fields supported by the actual implementation.


---

Functional Requirements

Login must:

Validate credentials.

Reject invalid credentials.

Establish authentication state.

Establish employee identity.

Respect employee active/inactive state.

Redirect appropriately.

Protect application routes.



---

Error States

Examples:

Invalid credentials
Employee inactive
Authentication failed
Server unavailable

Do not expose sensitive authentication details.


---

Loading State

During authentication:

Signing in...

The submit control should prevent accidental repeated submissions.


---

Success

Successful authentication should lead to the appropriate application area based on the existing routing architecture.

Do not assume every employee should automatically land on /owner.


---

11. Screen 2: Owner Command Center

Purpose

The Owner screen is the operational command center.

It provides a consolidated view of the kitchen operation.


---

Primary Information

The screen may contain:

Active Orders
Pending Orders
Orders Preparing
Ready Orders
Dispatched Orders
Inventory Alerts
Kitchen Performance
Channel Performance
Brand Performance
Operational Activity
Exceptions

Only show metrics that can be derived from actual operational data.


---

12. Owner Layout

A suitable structure may be:

┌─────────────────────────────────────────────────────────┐
│ Owner Command Center                    Date / Refresh │
├──────────┬──────────┬──────────┬───────────────────────┤
│ Orders   │ Preparing│ Ready    │ Inventory Alerts      │
├──────────┴──────────┴──────────┴───────────────────────┤
│                                                         │
│ Kitchen Performance        Channel Performance          │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ Operational Activity                                    │
│                                                         │
└─────────────────────────────────────────────────────────┘

The exact layout may differ based on the existing design.


---

13. Owner KPI Rules

A KPI must have a real source.

For example:

Active Orders

must be calculated from canonical orders.

Do not hard-code:

24 Active Orders

just to make the dashboard look populated.


---

14. Owner Empty States

If there are no operational records:

No active orders.

If there is no performance data:

No performance data available yet.

If there is no activity:

No operational activity available.

Do not generate fake activity.


---

15. Owner Inventory Alerts

Inventory alerts should derive from:

currentStock
reorderThreshold

or the actual canonical inventory fields.

Possible states:

Healthy
Low Stock
Critical
Out of Stock

Only implement states supported by the domain.


---

16. Owner Operational Activity

The activity section should show meaningful recent events.

Examples:

Order created
Preparation started
Order ready
Order dispatched
Order cancelled
Inventory adjusted
Loss recorded

Where available, display:

Time
Employee
Entity
Action


---

17. Owner Performance

Kitchen performance may derive from:

Orders
Preparation timestamps
Ready timestamps
Dispatch timestamps
Cancellations
Loss
Throughput

Channel performance may derive from:

Order volume
Channel
Cancellation
Preparation
Dispatch
Revenue where available

Never fabricate metrics.


---

18. Owner Actionability

The Owner Command Center should provide useful navigation into operational details.

For example:

Inventory Alert
→ Inventory

Active Orders
→ Orders

Order Exception
→ Order details

Operational Activity
→ Activity / relevant workflow

Only implement navigation where the target functionality exists.


---

19. Screen 3: Order Injection

Purpose

Create a real operational order.

This is not a demo order generator.


---

20. Order Injection Structure

Conceptually:

┌─────────────────────────────────────────────────────────┐
│ Create Order                                            │
├─────────────────────────────────────────────────────────┤
│ Brand                                                   │
│ [ Select Brand ]                                        │
│                                                         │
│ Kitchen                                                 │
│ [ Select Kitchen ]                                      │
│                                                         │
│ Channel                                                 │
│ [ Select Channel ]                                      │
├─────────────────────────────────────────────────────────┤
│ Items                                                   │
│                                                         │
│ Item                     Quantity                       │
│ ───────────────────────────────────────                 │
│ Menu Item                [-] 1 [+]                      │
│ Menu Item                [-] 2 [+]                      │
├─────────────────────────────────────────────────────────┤
│ Customer information where applicable                   │
├─────────────────────────────────────────────────────────┤
│                         [ Create Order ]                 │
└─────────────────────────────────────────────────────────┘

The actual fields must follow the canonical order model.


---

21. Order Injection Validation

Validate:

Brand

Kitchen

Channel

Items

Quantities

Customer information where required

Required pricing information

Other required order fields


Invalid orders must not be created.


---

22. Order Injection Success

After successful creation:

Order created

Then the order must be available to downstream operational screens.

Do not merely clear the form.


---

23. Order Injection Failure

Display meaningful errors.

Examples:

Unable to create order.
Invalid menu item.
Kitchen unavailable.
Required field missing.

Do not expose internal stack traces to ordinary users.


---

24. Screen 4: Live Orders

Purpose

Provide a live operational view of current orders.

This screen is the bridge between:

Order Injection

and:

Cook / Dispatch


---

25. Live Orders Layout

A suitable structure may be:

┌──────────────────────────────────────────────────────────┐
│ Live Orders                            Search / Filters  │
├──────────────────────────────────────────────────────────┤
│ Pending     Preparing     Ready      Dispatching         │
├──────────────────────────────────────────────────────────┤
│ Order Card / Table                                      │
│                                                          │
│ #ORD-001   Brand A   Kitchen 1   Preparing              │
│ Items: 3                                                │
│                                                          │
│ #ORD-002   Brand B   Kitchen 1   Pending                │
│ Items: 2                                                │
└──────────────────────────────────────────────────────────┘

The actual layout may be table, cards, Kanban, or a hybrid.


---

26. Live Order Information

Where available, show:

Order ID

Brand

Kitchen

Channel

Items

Quantity

Status

Time

Priority

Customer information where operationally relevant


Do not overwhelm the screen with information that does not help operations.


---

27. Live Order Filtering

Useful filters may include:

Brand
Kitchen
Channel
Status
Time

Only implement filters backed by actual data.


---

28. Live Order Refresh

The screen may use polling or another refresh strategy.

Requirements:

Avoid duplicate polling.

Clean up timers.

Handle failed requests.

Avoid replacing valid data with misleading empty states.

Keep operational status current.



---

29. Screen 5: Cook KDS

Purpose

The Cook KDS is the kitchen preparation workstation.

It should prioritize:

Speed
Readability
Order priority
Item visibility
Status
Timing


---

30. Cook KDS Layout

A suitable structure may be:

┌──────────────────────────────────────────────────────────┐
│ Kitchen Display System                  Kitchen / Brand  │
├──────────────────────────────────────────────────────────┤
│ PENDING                  PREPARING                       │
│                                                          │
│ ┌─────────────────┐      ┌─────────────────┐             │
│ │ #ORD-001        │      │ #ORD-002        │             │
│ │ Brand A         │      │ Brand B         │             │
│ │                 │      │                 │             │
│ │ 2 × Item A      │      │ 1 × Item B      │             │
│ │ 1 × Item C      │      │ 3 × Item C      │             │
│ │                 │      │                 │             │
│ │ [ START ]       │      │ [ READY ]       │             │
│ └─────────────────┘      └─────────────────┘             │
└──────────────────────────────────────────────────────────┘

The exact layout should follow the application's visual direction.


---

31. Cook Actions

Typical actions:

Start Preparing
Mark Ready

Additional actions should only exist if supported by the domain.


---

32. Cook Permissions

Only employees with the appropriate permission may perform preparation actions.

The API must enforce the permission.


---

33. Cook Status Flow

Typical flow:

PENDING
 ↓
PREPARING
 ↓
READY_FOR_PICKUP

If the existing model supports additional states, preserve them.


---

34. Cook Timing

Where timestamps exist, display useful timing information.

Examples:

Waiting 12 min
Preparing 7 min

Do not fabricate timing data.


---

35. Cook Empty State

Example:

No orders waiting for preparation.

This is preferable to displaying fake orders.


---

36. Cook Error State

Example:

Unable to load kitchen orders.
Retry

Do not silently show an empty KDS when the API failed.


---

37. Screen 6: Dispatch

Purpose

Dispatch handles orders that are ready to leave the kitchen.


---

38. Dispatch Layout

Conceptually:

┌──────────────────────────────────────────────────────────┐
│ Dispatch                                                │
├──────────────────────────────────────────────────────────┤
│ Ready for Pickup                                        │
│                                                          │
│ Order      Brand      Kitchen      Status                │
│ -------------------------------------------------------  │
│ ORD-001    Brand A    Kitchen 1    Ready                │
│ ORD-002    Brand B    Kitchen 1    Ready                │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ Selected Order                                           │
│                                                          │
│ Driver: [ Select ]                                      │
│                                                          │
│ [ Assign ]    [ Pickup ]    [ Dispatch ]                │
└──────────────────────────────────────────────────────────┘

Only implement driver assignment/pickup actions if supported by the existing domain.


---

39. Dispatch Information

Where available show:

Order ID

Brand

Kitchen

Channel

Items / summary

Ready time

Driver

Pickup state

Dispatch state



---

40. Dispatch Workflow

Typical flow:

READY_FOR_PICKUP
 ↓
DRIVER_ASSIGNED
 ↓
PICKED_UP
 ↓
DISPATCHED

The actual lifecycle must follow the canonical domain.


---

41. Dispatch Permissions

Only authorized employees may:

Assign drivers

Mark pickup

Dispatch orders


The server must enforce permissions.


---

42. Dispatch Evidence

When an order is dispatched, preserve relevant operational evidence where supported:

Order
Employee
Driver
Timestamp
Dispatch state
Pickup state

This becomes particularly important for post-pickup cancellation/accounting cases.


---

43. Dispatch Empty State

Example:

No orders ready for dispatch.

Do not create fake dispatch records.


---

44. Screen 7: Inventory Management

Purpose

Provide operational control over inventory.


---

45. Inventory Layout

Conceptually:

┌──────────────────────────────────────────────────────────┐
│ Inventory                              Search / Filter  │
├──────────────────────────────────────────────────────────┤
│ Total Items     Low Stock     Critical     Out of Stock │
├──────────────────────────────────────────────────────────┤
│ Item         Current Stock   Reorder Level   Status     │
│ -------------------------------------------------------  │
│ Ingredient A  42             20              Healthy     │
│ Ingredient B  12             20              Low         │
│ Ingredient C   0             10              Out         │
├──────────────────────────────────────────────────────────┤
│ Inventory Actions                                        │
│ [ Restock ] [ Adjust ] [ View Movement ]                │
└──────────────────────────────────────────────────────────┘

The exact fields must come from the canonical inventory model.


---

46. Inventory Fields

Do not assume field names.

If the canonical model uses:

currentStock
reorderThreshold

use those.

Do not create:

stock
threshold

as competing operational fields.


---

47. Inventory Status

Status should be derived from actual stock.

For example:

currentStock > reorderThreshold
→ Healthy

currentStock <= reorderThreshold
→ Low Stock

Additional critical/out-of-stock states may be implemented if supported.

The exact business rules should come from the domain.


---

48. Inventory Actions

Possible actions include:

Restock
Adjust
Record Loss
View Movement

Only provide actions supported by the user's permissions and the canonical store.


---

49. Inventory Movement

Every meaningful adjustment should have a reason.

Examples:

Restock
Sale Consumption
Waste
Loss
Cancellation Restoration
Manual Adjustment

Use canonical movement types where available.


---

50. Inventory Security

Inventory modification should require appropriate permission.

A user who can view inventory should not automatically be able to modify it.


---

51. Inventory Error Handling

If inventory cannot load:

Unable to load inventory.
Retry

Do not display:

No inventory items

unless the API successfully returned an empty collection.


---

52. Inventory Empty State

Example:

No inventory items found.

Filters should explain whether no data exists or whether the current filter produced no results.


---

53. Cross-Screen Integration

The seven screens must share the same operational truth.

Example:

Order Injection
      ↓
Live Orders
      ↓
Cook
      ↓
Dispatch
      ↓
Owner
      ↓
Analytics

Inventory:

Order
 ↓
Recipe
 ↓
Consumption
 ↓
Inventory
 ↓
Owner Alert


---

54. Cross-Screen Order Test

Create an order through Order Injection.

Then verify:

[ ] Order exists
[ ] Correct brand
[ ] Correct kitchen
[ ] Correct channel
[ ] Correct items
[ ] Correct status
[ ] Live Orders displays it
[ ] Cook can see it
[ ] Cook can transition it
[ ] Dispatch can see it when ready
[ ] Dispatch can process it
[ ] Owner sees the relevant operational state
[ ] Activity reflects important actions


---

55. Cross-Screen Inventory Test

When an order causes inventory consumption:

Verify:

[ ] Correct inventory item affected
[ ] Correct quantity affected
[ ] Stock changes once
[ ] Movement is recorded where supported
[ ] Owner inventory alert updates
[ ] No duplicate depletion occurs


---

56. Cross-Screen Cancellation Test

Test cancellation before preparation.

Verify:

[ ] Order becomes cancelled
[ ] Inventory is restored when operationally possible
[ ] Otherwise loss is recorded
[ ] Restoration is not duplicated
[ ] Activity is recorded


---

57. Post-Preparation Cancellation Test

Verify:

[ ] Order becomes cancelled
[ ] Prepared food is not incorrectly returned to usable inventory
[ ] Food/labor loss is recorded where supported
[ ] Activity is recorded


---

58. Post-Pickup Cancellation Test

Verify:

[ ] Order cancellation is recorded
[ ] Pickup/dispatch evidence remains available
[ ] Claim/accounting case can be represented where supported
[ ] Food-loss evidence is preserved where required
[ ] Activity is recorded


---

59. Permission-Based Screen Behavior

Screens should adapt to permissions.

For example:

View permission
→ Can inspect data

Management permission
→ Can modify data

But remember:

UI restriction ≠ security

The API must enforce the permission.


---

60. Responsive Screen Requirements

Each screen must be evaluated at:

Mobile
Tablet
Desktop

Mobile

Prioritize:

Status
Order identity
Critical actions
Navigation

Tablet

Prioritize:

Operational cards
Tables
Touch-friendly actions

Desktop

Prioritize:

High information density
Multiple panels
Tables
Analytics


---

61. Typography

Typography should prioritize readability.

Avoid:

Tiny operational text

Excessively decorative fonts

Huge headings consuming operational space

Inconsistent type scales


Use the existing Tailwind/design system where available.


---

62. Cards

Cards should communicate useful information.

A card should answer:

What is this?
What is its current state?
What action can I take?

Avoid cards that contain only decorative statistics.


---

63. Tables

Tables should be used where comparison and scanning benefit from tabular structure.

Examples:

Orders
Inventory
Dispatch
Performance

Tables should remain usable on smaller screens through:

Responsive scrolling

Reduced columns

Alternate mobile layouts


Do not allow tables to break the entire page width.


---

64. Forms

Operational forms should:

Label inputs clearly.

Validate required fields.

Show errors near the relevant field.

Prevent duplicate submission.

Show submission state.

Confirm successful completion.

Preserve useful input after recoverable failures where appropriate.



---

65. Buttons

Buttons should communicate action clearly.

Examples:

Create Order
Start Preparing
Mark Ready
Assign Driver
Mark Pickup
Dispatch
Cancel Order
Restock
Adjust Inventory

Do not use vague labels such as:

Do It
Go
Process
Action

unless the context makes the action unambiguous.


---

66. Destructive Actions

Destructive actions should require appropriate confirmation where appropriate.

Examples:

Cancel Order
Delete
Reset
Record Loss

Do not make destructive actions easy to trigger accidentally.


---

67. Action Feedback

After an operational action:

Submitting...

then:

Success

or:

Error

The interface should reflect the server-confirmed state.


---

68. Refresh Behavior

After a successful mutation:

Prefer:

Server mutation
 ↓
Fetch canonical state
 ↓
Update UI

rather than assuming the client knows the resulting state.


---

69. Accessibility

Operational interfaces should support:

Keyboard navigation

Visible focus

Readable contrast

Clear labels

Semantic controls

Meaningful error messages


Do not rely solely on color to communicate status.


---

70. Visual Consistency

Across all seven screens maintain consistent:

Navigation
Spacing
Typography
Buttons
Status badges
Cards
Tables
Forms
Modals
Error messages

Do not redesign each screen as a different application.


---

71. Screen Completion Gate

A screen is not complete merely because:

The screenshot looks similar.

It must also satisfy:

[ ] Correct route
[ ] Correct authentication
[ ] Correct permissions
[ ] Correct data source
[ ] Real API integration
[ ] Real operational actions
[ ] Loading state
[ ] Empty state
[ ] Error state
[ ] Responsive layout
[ ] Cross-screen integration


---

72. Screenshot-to-Implementation Checklist

For every screenshot-driven screen:

[ ] Identify screen purpose
[ ] Identify user role
[ ] Identify required permissions
[ ] Identify visible data
[ ] Identify available actions
[ ] Map data to canonical model
[ ] Identify API
[ ] Identify store operation
[ ] Implement UI
[ ] Implement actions
[ ] Handle loading
[ ] Handle empty
[ ] Handle errors
[ ] Test responsive layout
[ ] Test operational workflow


---

73. No Static Mockups

Do not leave implementation as:

Hard-coded cards
Hard-coded tables
Fake buttons
Fake charts
Fake status changes
Static sample orders
Static inventory numbers

unless the item is explicitly identified as development seed/demo data.


---

74. No Fake Analytics

If no data exists:

No data available.

If there is insufficient data:

Not enough operational data yet.

Do not invent a chart merely because the screenshot contains one.


---

75. No Fake Operational Activity

Activity must come from real operational events.

Do not create:

Order dispatched 2 minutes ago

unless an actual dispatch event exists.


---

76. Owner Command Center Must Not Become a Mockup

The Owner screen should be one of the strongest integration points in the system.

It should consume real:

Orders
Inventory
Activity
Performance
Exceptions

where available.


---

77. Operational Density

A Cloud Kitchen OS should allow staff to scan information quickly.

Prefer:

Clear status
Compact metadata
Useful actions
High signal

over:

Large decorative cards
Excessive whitespace
Long explanatory text


---

78. Visual Polish

Once functionality works, improve:

Spacing
Alignment
Typography
Hierarchy
Responsive behavior
Status presentation
Micro-interactions
Empty states
Error states

Do not polish before the operational workflow works.


---

79. Final Seven-Screen Architecture

The complete application should conceptually behave as:

LOGIN
                           │
                           ▼
                    AUTH + PERMISSIONS
                           │
             ┌─────────────┴─────────────┐
             │                           │
             ▼                           ▼
          OWNER                    ORDER INJECTION
             │                           │
             │                           ▼
             │                      LIVE ORDERS
             │                           │
             │                           ▼
             │                        COOK KDS
             │                           │
             │                           ▼
             │                       DISPATCH
             │                           │
             └─────────────┬─────────────┘
                           │
                           ▼
                     INVENTORY
                           │
                           ▼
                    OPERATIONAL DATA
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
         ACTIVITY                    ANALYTICS

All paths ultimately depend on the same operational truth.


---

80. Final Screen Principle

The objective is not:

Make seven screenshots look correct.

The objective is:

Make seven operational views of the same Cloud Kitchen OS.

The screenshots define the desired experience.

The canonical domain, store, business rules, APIs, permissions, and operational state define how that experience must actually work.

That distinction must be preserved throughout the entire DarKitOS build.
