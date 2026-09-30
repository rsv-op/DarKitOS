

# DarKitOS Cloud Development & Deployment Guide

## 1. Purpose

This document defines the development and deployment workflow for DarKitOS.

The intended workflow is:

```text
Android / Termux / Codespaces
          ↓
       GitHub
          ↓
       Vercel
          ↓
    Production App

The repository is the central source of truth.


---

2. Development Environments

DarKitOS may be developed from:

Android + Termux

GitHub Codespaces

Desktop development environments

Other compatible Linux environments


The application must remain compatible with the production environment even when local development has platform-specific limitations.


---

3. Termux Development

Termux may be used for:

Git operations

Repository inspection

File editing

TypeScript inspection

Running compatible Node.js commands

Installing dependencies

Running tests where supported

Creating commits

Pushing to GitHub


Typical repository location:

~/agents/DarKitOS

Before making changes:

cd ~/agents/DarKitOS
git status


---

4. Termux Is Not the Production Environment

A local Android/ARM64 limitation must not automatically be interpreted as a production application failure.

For example:

Local Android ARM64
        ↓
Platform-specific native dependency failure

may still be compatible with:

Vercel Linux
        ↓
Successful production build

Always distinguish:

Development environment limitation

from:

Application/build failure


---

5. Codespaces

GitHub Codespaces may be used when a Linux development environment is more convenient than Termux.

Use Codespaces for:

Repository development

Full Node.js tooling

TypeScript checks

Production builds

Debugging

Dependency management

Agent-assisted development


When Codespaces is not being used, stop the Codespace to avoid unnecessary resource consumption.


---

6. GitHub

GitHub is the source-control and collaboration layer.

The repository is:

DarKitOS

All intentional production changes should eventually be represented in Git.

Use:

git status

before changes.

Use:

git diff

after changes.


---

7. Git Safety

Never commit:

.env
.env.local
API keys
Passwords
Tokens
Database credentials
Private certificates
Authentication secrets

Check:

git status

before committing.


---

8. Git Ignore

The repository should ignore common generated and secret files.

Typical entries include:

node_modules/
.next/
out/
*.log

.env
.env.local
.env.development.local
.env.test.local
.env.production.local

.DS_Store

Do not modify .gitignore blindly.

Inspect the existing file first.


---

9. Git Commit Discipline

Do not blindly use:

git add .

if unrelated files may exist.

Prefer:

git add <specific-file>

or a carefully reviewed group of files.

Then:

git status

Verify the staged files.


---

10. Git Push

After validation:

git push origin main

if main is the intended deployment branch.

Do not push unverified production changes.


---

11. Vercel Deployment

The intended production deployment path is:

GitHub main
      ↓
Vercel
      ↓
Production deployment

Vercel should build the repository using the configured project settings.

The build command should normally be:

npm run build


---

12. Vercel Build Requirements

Before deployment verify:

npm run build

The production build should complete successfully.

A successful build confirms that the project can compile and integrate for the target environment.

It does not by itself prove that every operational workflow works.


---

13. Production Validation

After a successful deployment verify:

Login
Authentication
Authorization
Owner
Order Injection
Orders
Cook
Dispatch
Inventory
Cancellation
Activity
Analytics

Do not assume that:

Build successful

means:

Application fully functional


---

14. Deployment Verification

After deployment, test the actual deployed application.

At minimum verify:

1. Root route
2. Login
3. Protected route
4. API authentication
5. Owner
6. Order creation
7. Order visibility
8. Cook workflow
9. Dispatch workflow
10. Inventory


---

15. Authentication Deployment Testing

Authentication can behave differently between local and production environments.

Verify:

Login request
 ↓
Authentication response
 ↓
Cookie/session/token
 ↓
Protected route
 ↓
API request

If authentication fails:

Do not immediately assume the cookie mechanism is broken.

Inspect:

Hostname

Cookie attributes

Path

Secure setting

SameSite behavior

Middleware

API authentication

Employee lookup

Permission lookup



---

16. Cookie Rules

If the application uses cookies:

The cookie must be appropriate for the deployed environment.

Typical considerations include:

httpOnly
secure
sameSite
path
domain

Do not change cookie attributes randomly.

Determine the actual production requirement first.


---

17. Same-Origin Requests

For same-origin browser requests, browser cookie behavior should be understood before changing client fetch configuration.

Do not automatically add:

credentials: "include"

as a supposed universal fix.

Investigate the actual authentication flow first.


---

18. Middleware

Middleware may protect:

/owner
/cook
/dispatch

and other protected routes.

However:

Middleware

is not a replacement for:

API authorization
Domain authorization

Protected APIs must still validate the authenticated employee and required permissions.


---

19. API Production Checks

After deployment test important APIs independently.

For example:

/api/login
/api/orders
/api/inventory

Use the actual routes present in the repository.

Do not assume these routes exist simply because they are listed here.


---

20. Environment Variables

Production secrets must be configured in the deployment environment.

Do not place secrets inside source files.

Typical categories include:

Database URL
Authentication secret
External API key
Webhook secret
Third-party service credentials

The exact environment variables must be determined from the repository.

Do not invent variable names.


---

21. Environment Variable Rule

Before adding an environment variable:

Search:

process.env.

through the repository.

Determine:

Existing variable name

Where it is consumed

Whether it is server-only

Whether Vercel requires configuration


Do not create multiple variables representing the same secret.


---

22. Server-Only Secrets

Secrets must remain server-side.

Do not expose secret values through:

NEXT_PUBLIC_*

unless the value is intentionally public.

Do not return secrets through API responses.

Do not log secrets.


---

23. Production Logging

Production logs should help diagnose failures without exposing sensitive information.

Never log:

Passwords
Session secrets
API keys
Database credentials
Tokens

Debug logging added during troubleshooting should be reviewed before production use.


---

24. Build vs Runtime

Distinguish between:

Build-time failure

and:

Runtime failure

Examples of build failures:

TypeScript error
Missing module
Invalid import
Syntax error
Invalid Next.js configuration

Examples of runtime failures:

Unauthorized
API error
Database failure
State inconsistency
Broken interaction

The debugging approach is different.


---

25. Production Build Checklist

Before deployment:

[ ] package.json verified
[ ] Dependencies installed
[ ] TypeScript valid
[ ] Routes valid
[ ] Middleware valid
[ ] API routes valid
[ ] Environment requirements identified
[ ] No secrets committed
[ ] npm run build passes


---

26. Production Functional Checklist

After deployment:

[ ] Root loads
[ ] Login loads
[ ] Login succeeds with valid credentials
[ ] Invalid login is rejected
[ ] Protected route rejects unauthorized access
[ ] Correct employee identity is established
[ ] Permissions are enforced
[ ] Owner loads
[ ] Order can be created
[ ] Order appears in live workflow
[ ] Cook can process permitted orders
[ ] Dispatch can process permitted orders
[ ] Inventory reflects operational changes
[ ] Cancellation rules work
[ ] Activity is recorded
[ ] Analytics reflect operational data


---

27. End-to-End Production Test

The primary production workflow is:

LOGIN
 ↓
OWNER
 ↓
ORDER INJECTION
 ↓
CREATE ORDER
 ↓
LIVE ORDER
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

Run this against the deployed application where the relevant functionality exists.


---

28. Cancellation Production Test

Test each relevant scenario:

Cancellation before preparation
Cancellation during preparation
Cancellation after preparation
Cancellation after pickup
Repeated cancellation

Verify:

Order
Inventory
Loss
Activity
Claim/accounting state

where supported by the current implementation.


---

29. Deployment Debugging

When a deployment fails:

First identify:

GitHub problem
Vercel configuration problem
Build problem
Environment variable problem
Application runtime problem
Authentication problem
API problem

Do not change application code until the failure layer is known.


---

30. Vercel Build Failure Procedure

If Vercel reports a build failure:

1. Read the complete build error.


2. Identify the first meaningful error.


3. Inspect the referenced file.


4. Inspect its imports.


5. Inspect the canonical domain/store.


6. Reproduce locally where possible.


7. Fix the root cause.


8. Run npm run build.


9. Commit the fix.


10. Push.


11. Verify the new deployment.



Do not fix only the last error displayed if earlier errors caused it.


---

31. TypeScript Build Failures

For TypeScript errors:

Do not immediately use:

any

or:

@ts-ignore

unless there is a documented reason.

Prefer fixing:

Type mismatch
Incorrect import
Missing property
Invalid state
Wrong API contract

at the source.


---

32. Missing Export

If a build reports:

Module has no exported member

inspect the source module first.

Example:

app/owner/page.tsx
      ↓
lib/db.ts

If the page imports:

INITIAL_INVENTORY

but the canonical model exports:

INVENTORY_DB

do not immediately create a second inventory constant.

Determine which name is canonical and update the consumer.


---

33. Deployment Rollbacks

If a production deployment introduces a serious regression:

Prefer restoring the last known-good deployment or commit rather than making increasingly risky live edits.

Then:

Investigate
Fix
Test
Redeploy


---

34. Production Data Safety

Never use production data as a casual debugging sandbox.

Avoid destructive testing against production inventory or orders.

If production testing is required:

Use controlled test data and clearly identify it.


---

35. Runtime State

If the current application uses in-memory runtime state:

Understand that deployment instances may not provide durable shared persistence.

For example:

Runtime memory

is not equivalent to:

Persistent database

Do not claim that operational data is permanently stored unless the architecture actually provides persistence.


---

36. Future Persistence

The application should preserve the boundary:

UI
 ↓
API
 ↓
Domain
 ↓
Store
 ↓
Persistence

This allows future migration from development state to a real database without rewriting the entire application.


---

37. Multi-Instance Consideration

Production deployments may involve multiple application instances.

Therefore:

In-memory state

should not be treated as durable distributed state.

When persistent production operations are required, the persistence implementation must provide appropriate shared storage.


---

38. Webhooks and External Channels

If future integrations are added for:

Food aggregators
Payment providers
Delivery services
POS systems
External order platforms

they must enter the system through controlled integration/API boundaries.

Do not let external systems directly manipulate UI state.

Preferred flow:

External Platform
 ↓
Webhook/API
 ↓
Validation
 ↓
Domain
 ↓
Store
 ↓
Canonical Order


---

39. External API Secrets

External integrations must keep credentials server-side.

Never expose:

API key
Webhook signing secret
OAuth client secret
Access token

to browser code.


---

40. Webhook Validation

Future webhooks should validate:

Signature where supported

Request authenticity

Payload shape

Duplicate delivery

Order identity

Brand

Kitchen

Channel


External requests must not automatically be trusted.


---

41. Duplicate External Orders

External systems may retry requests.

Therefore external order ingestion should consider idempotency.

A repeated external order event must not automatically create a duplicate operational order.


---

42. Monitoring

Production monitoring should eventually cover:

Build failures
Runtime errors
API failures
Authentication failures
Order failures
Inventory inconsistencies
External integration failures

The exact monitoring system can be introduced later.

Do not add monitoring dependencies without a concrete requirement.


---

43. Health Checks

A future production health endpoint may verify:

Application availability
Store availability
Persistence availability
External dependency availability

Only implement this if required by the deployment architecture.


---

44. Performance

Do not confuse:

Fast page rendering

with:

Correct operational system

Correctness comes first.

After correctness is established, evaluate:

API latency
Database latency
Polling frequency
Rendering
Bundle size
Caching


---

45. Mobile / Termux Workflow

A practical workflow from Android is:

Termux
 ↓
cd ~/agents/DarKitOS
 ↓
git status
 ↓
Inspect / edit
 ↓
Validate
 ↓
git diff
 ↓
git commit
 ↓
git push
 ↓
GitHub
 ↓
Vercel
 ↓
Production verification


---

46. Codespaces Workflow

A practical Codespaces workflow is:

Open Codespace
 ↓
Clone / open repository
 ↓
Inspect
 ↓
Install dependencies
 ↓
Develop
 ↓
Run validation
 ↓
npm run build
 ↓
git diff
 ↓
commit
 ↓
push
 ↓
Vercel


---

47. Local Development Server

The existing development script should be respected.

If the project uses:

{
  "dev": "next dev -H 0.0.0.0"
}

do not remove the host binding without a reason.

This allows the development server to listen on all interfaces where required by the environment.


---

48. Local Development Limitations

If local development fails because of a platform-specific native dependency:

Do not immediately alter application architecture.

First determine:

Is this:
- application code?
- Node version?
- Next.js version?
- native SWC binary?
- ARM64 compatibility?
- dependency mismatch?

Document the result.


---

49. Deployment as Source of Truth

When local and Vercel behavior differ:

Compare:

Node version
Dependencies
Environment variables
Build command
Runtime
Platform architecture
Cookies
Host/domain

Do not assume the local environment is identical to Vercel.


---

50. Production Domain

The actual production URL must be verified from the deployment environment.

Do not hard-code a deployment URL into application logic merely because it is currently known.

Use environment/configuration where a canonical origin is genuinely required.


---

51. URL and Origin Safety

Avoid assumptions such as:

localhost
127.0.0.1
current preview URL
production URL

being interchangeable.

Authentication and callback behavior may depend on the actual origin.


---

52. Browser Testing

When testing production in a browser:

Check:

Normal browser
Private/incognito browser
Authenticated session
Logged-out session

When authentication behaves differently between sessions, inspect actual network requests, cookies, middleware, and server responses.

Do not guess.


---

53. Authentication Debugging Checklist

If a protected route returns:

401 Unauthorized

inspect:

[ ] Login request succeeded
[ ] Employee was found
[ ] Authentication cookie/session was created
[ ] Cookie path is correct
[ ] Cookie secure setting is appropriate
[ ] Cookie SameSite behavior is appropriate
[ ] Request reaches expected hostname
[ ] Middleware reads the expected identity
[ ] API reads the expected identity
[ ] Employee is active
[ ] Required permission exists
[ ] Required permission is assigned

Do not assume the problem is a single cookie setting.


---

54. Authorization Debugging Checklist

If login succeeds but an operation returns:

403 Forbidden

inspect:

Employee
Role
Permission
Required permission
Permission ID
Permission lookup
API authorization

Do not change the authentication system if authentication is already working.


---

55. Deployment Verification Report

After a significant deployment, record:

Commit:
Deployment:
Build:
Environment:
Routes tested:
Authentication:
Authorization:
Order workflow:
Inventory:
Dispatch:
Analytics:
Known issues:

This creates a useful deployment history.


---

56. No False Deployment Claims

Never state:

Deployed successfully

unless the deployment result was actually verified.

Never state:

Production works

when only the build was tested.

Use precise language:

Build passed.

or:

Deployment completed.

or:

Production workflow verified.

These are different claims.


---

57. Production Readiness Gate

DarKitOS should not be considered production-ready merely because:

The UI looks complete.

The production gate requires:

Architecture
+
Authentication
+
Authorization
+
Orders
+
Inventory
+
Cooking
+
Dispatch
+
Cancellation
+
Activity
+
Analytics
+
Error handling
+
Build
+
Deployment
+
Functional verification


---

58. Final Cloud Architecture

The intended cloud flow is:

┌──────────────┐
                  │   Developer  │
                  │ Termux / CS  │
                  └──────┬───────┘
                         │
                         ▼
                  ┌──────────────┐
                  │    GitHub    │
                  │ Source Code  │
                  └──────┬───────┘
                         │
                         ▼
                  ┌──────────────┐
                  │    Vercel    │
                  │ Build/Deploy │
                  └──────┬───────┘
                         │
                         ▼
                ┌──────────────────┐
                │  DarKitOS Cloud  │
                │    Application   │
                └────────┬─────────┘
                         │
                         ▼
                ┌──────────────────┐
                │ Operational API  │
                └────────┬─────────┘
                         │
                         ▼
                ┌──────────────────┐
                │   Store Layer    │
                └────────┬─────────┘
                         │
                         ▼
                ┌──────────────────┐
                │ Persistence      │
                │ Current / Future │
                └──────────────────┘


---

59. Final Cloud Principle

The cloud environment is not the architecture.

The architecture is:

UI
 ↓
API
 ↓
Domain
 ↓
Store
 ↓
Persistence

GitHub and Vercel provide the development and deployment pipeline around that architecture.

Do not allow deployment convenience to dictate business architecture.


---

60. Final Rule

Before saying:

"Ready for production"

ask:

Does the complete operational workflow work?

If the answer is unknown:

Test it.

If it fails:

Fix it.

If it cannot yet be tested:

Report the limitation honestly.

Never replace verification with assumption.
