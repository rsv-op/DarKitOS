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
