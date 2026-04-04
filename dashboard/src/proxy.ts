import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const hasClerkKeys =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  process.env.CLERK_SECRET_KEY;

export async function proxy(request: NextRequest) {
  if (hasClerkKeys) {
    // When Clerk keys are configured, use Clerk middleware
    const { clerkMiddleware } = await import("@clerk/nextjs/server");
    const middleware = clerkMiddleware();
    return middleware(request, {} as never);
  }

  // No Clerk keys -- pass through without auth
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
