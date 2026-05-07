import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
]);

const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, orgId, sessionClaims } = await auth();

  // Allow public routes through
  if (isPublicRoute(req)) return NextResponse.next();

  // Not signed in → redirect to sign-in
  if (!userId) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect_url", req.url);
    return NextResponse.redirect(signInUrl);
  }

  // Signed in but no org → redirect to create-org onboarding
  if (userId && !orgId && !isOnboardingRoute(req)) {
    const onboardingUrl = new URL("/onboarding/create-org", req.url);
    return NextResponse.redirect(onboardingUrl);
  }

  // Check if org needs plan selection (no active billing on paid plan)
  // This is handled inside the onboarding flow itself

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
