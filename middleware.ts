### Concrete Reasons Why Directives Are Missed by LLMs

When complex system directives, negative constraints, or strict formatting instructions are omitted during LLM interactions, it typically stems from four fundamental technical reasons:

1. **Attention Dilution & Context Saturation ("Lost in the Middle")**: As the prompt length grows across multi-turn conversations, transformer self-attention mechanisms distribute weight across thousands of tokens. Instructions placed in the middle of long prompts or large context blocks experience lower relative attention scores compared to tokens at the very beginning or immediate end of the sequence.
2. **Conflicting Precedence & Constraint Overlap**: When a system instruction (e.g., conversational framing, citation formatting) competes with a user constraint (e.g., "output code only"), the model attempts to satisfy both simultaneously. If these constraints are structurally opposed, one constraint can overwrite another during auto-regressive token sampling.
3. **Completion Priming & Pre-trained Biases**: Large language models are heavily fine-tuned on conversational patterns. When prompted for code, the model's high probability paths incline toward conversational preambles (e.g., *"Here is the file you requested..."*) rather than strict structural markup unless strictly forced.
4. **State Loss Across Multi-Turn Sequences**: Without explicit task tracking, earlier directives (such as precise file naming conventions or line-by-line output constraints) degrade as earlier assistant turns drop out of the immediate recency window.

---

code directory > /middleware.ts

```typescript
// File: middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const isCookRoute = path.startsWith('/cook');
  const isDispatchRoute = path.startsWith('/dispatch');
  const isOwnerRoute = path.startsWith('/owner');

  // Allow public routes, static assets, and auth endpoints through
  if (!isCookRoute && !isDispatchRoute && !isOwnerRoute) {
    return NextResponse.next();
  }

  // Check for active station PIN token or session cookie
  const pinCookie = request.cookies.get('kitchen_pin')?.value || request.cookies.get('dark_cloud_session')?.value;

  // Redirect unauthenticated traffic to the universal PIN gateway
  if (!pinCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Master Dev Bypass grants top-level access across all station views
  if (pinCookie === 'dev_token' || pinCookie.endsWith('_9999')) {
    return NextResponse.next();
  }

  // Strict role isolation per station route
  if (isCookRoute && !pinCookie.includes('cook')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isDispatchRoute && !pinCookie.includes('dispatch')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isOwnerRoute && !pinCookie.includes('owner')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/cook/:path*', '/dispatch/:path*', '/owner/:path*'],
};
```

---

Would you like to move on to the next file in the directory hierarchy sequence?
