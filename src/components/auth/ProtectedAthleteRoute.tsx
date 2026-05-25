// =============================================================================
// src/components/auth/ProtectedAthleteRoute.tsx
// =============================================================================
// Auth + role gate for the new Athlete App routes.
//
// Decision tree (top to bottom — first match wins):
//   1. loading            → render <LoadingSpinner /> (don't flicker the UI)
//   2. !user              → redirect to /auth
//   3. !profile           → spinner (briefly; profile lands ~1 frame after user)
//   4. role !== "athlete" → redirect coaches to /coach (never to /auth — they
//                           ARE logged in, just on the wrong surface)
//   5. !onboarding_completed → redirect to /onboarding before they reach the
//                              athlete shell
//   6. otherwise          → render children
//
// We intentionally do NOT touch the legacy `SubscriptionGuard` used by the
// coach routes — coaches keep their existing flow (subscription-driven). This
// guard is athlete-only and lives next to SubscriptionGuard to mirror its
// "one guard component per role" pattern.
//
// The post-login routing (athlete → /athlete) is already handled by Index.tsx
// for the "/" landing route (see <Navigate to="/athlete"> branch), so this
// guard's only job here is to keep the door shut for everyone else.
// =============================================================================

import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/LoadingSpinner";

interface ProtectedAthleteRouteProps {
  children: ReactNode;
}

export function ProtectedAthleteRoute({ children }: ProtectedAthleteRouteProps) {
  const { user, profile, loading } = useAuth();

  // 1. Auth state still settling. Avoid the redirect race that the audit C6
  //    flagged on useAuth — we wait for `loading=false` before making any
  //    routing decision so we never flash the login page to a logged-in user.
  if (loading) {
    return <LoadingSpinner />;
  }

  // 2. No user → kick to /auth (the project's login page).
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // 3. User but profile row hasn't arrived yet (1-frame window after sign-in
  //    where session is set but the profile fetch hasn't returned). Treat as
  //    still-loading rather than redirecting to /auth, which would log them
  //    out visually.
  if (!profile) {
    return <LoadingSpinner />;
  }

  // 4. Wrong role. Send coaches to their dashboard rather than to /auth.
  if (profile.role !== "athlete") {
    return <Navigate to="/coach" replace />;
  }

  // 5. Athlete who hasn't finished onboarding. The athlete dashboard assumes
  //    onboarding data is present (neurotype, training_age, etc.); if it
  //    isn't, push them through onboarding first.
  if (!profile.onboarding_completed) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
