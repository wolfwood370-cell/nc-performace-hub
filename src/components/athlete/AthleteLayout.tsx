// =============================================================================
// src/components/athlete/AthleteLayout.tsx
// =============================================================================
// Shell layout for the new Athlete App.
//
// Visual language is the "Aura Health System" defined in DESIGN.md:
//   - Mobile-first, glassmorphism over a bright surface (#f5faff)
//   - Slate / Sky Blue palette (brand #005685, primary container #226fa3)
//   - Manrope for headlines/data, Inter for body
//   - Ultra-rounded corners on widgets (24–32px)
//   - Bottom nav as a "frosted" floating bar with backdrop blur
//
// Scope right now is Training + Readiness only — nutrition is intentionally
// omitted from the nav per the current product brief. The route shape is:
//
//   /athlete            → Oggi          (Home icon)
//   /athlete/training   → Allenamenti   (Dumbbell icon)
//   /athlete/profile    → Profilo       (top-right header avatar)
//
// Profile lives on the header (not the bottom bar) because (a) the brief
// asked for exactly two nav items and (b) it matches the reference HTML's
// header treatment.
//
// No Supabase wiring here — this is the deterministic UI scaffold; data
// hooks land in a follow-up commit.
// =============================================================================

import { NavLink, Outlet } from "react-router-dom";
import { Home, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
  /** end=true on the index route so it doesn't stay "active" on /athlete/training */
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/athlete", label: "Oggi", icon: Home, end: true },
  { to: "/athlete/training", label: "Allenamenti", icon: Dumbbell },
];

function AthleteLayout() {
  return (
    <div className="min-h-[100dvh] bg-surface text-on-surface font-sans antialiased flex flex-col">
      {/*
        Main canvas. The fixed bottom nav is 80–96px tall (pb-8 + py-4 + content),
        so we reserve pb-28 on the scrollable area. Top safe area is small —
        each page renders its own header section so the layout stays neutral.
      */}
      <main className="flex-1 w-full max-w-lg mx-auto px-5 pt-6 pb-28 overflow-y-auto">
        <Outlet />
      </main>

      {/*
        Bottom Navigation Bar — fixed, glassmorphic, rounded top corners.
        Two items per the brief: "Oggi" and "Allenamenti".
      */}
      <nav
        aria-label="Navigazione principale atleta"
        className={cn(
          "fixed bottom-0 inset-x-0 z-50",
          "flex justify-around items-center",
          "px-4 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)]",
          "backdrop-blur-3xl bg-white/85",
          "border-t border-[#c0c7d0]/40",
          "rounded-t-[32px]",
          "shadow-[0_-10px_40px_rgba(80,118,142,0.08)]",
        )}
      >
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            aria-label={label}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-1",
                "rounded-full px-5 py-2 min-w-[88px]",
                "transition-all duration-300 active:scale-90",
                isActive
                  ? "bg-brand-container text-white shadow-[0_4px_14px_rgba(34,111,163,0.35)]"
                  : "text-on-surface-variant hover:text-on-surface",
              )
            }
          >
            <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            <span className="font-display text-[10px] font-semibold tracking-wide uppercase">
              {label}
            </span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default AthleteLayout;
