import {
  clerkMiddleware,
  // createRouteMatcher,
} from "@clerk/nextjs/server";

// INFO: USE THIS IS AN ALTERNATIVE WAY TO PROTECT API ROUTES WHEN YOU DON'T WANT TO DISPLAY AN UNAUTHORIZED VIEW OR A SIGN-IN BUTTON FOR UNAUTHORIZED USERS.

// const isPublicRoute = createRouteMatcher(["/api/inngest(.*)"]);

// export default clerkMiddleware(async (auth, req) => {
//   if (!isPublicRoute(req)) {
//     await auth.protect();
//   }
// });

export default clerkMiddleware();

export const config = {
  matcher: [
    /**
     * SKIP NEXT.JS INTERNALS AND ALL STATIC FILES, UNLESS FOUND IN SEARCH
     * PARAMS
     */
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // ALWAYS RUN FOR API ROUTES
    "/(api|trpc)(.*)",
  ],
};
