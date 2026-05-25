// =============================================================================
// src/components/athlete/drawers/DrawerShell.tsx
// =============================================================================
// Phase 8 — Shared bottom-sheet shell for protocol execution drawers.
//
// All execution drawers (StandardSet / Superset / AMRAP / Intensity /
// Isometric) share the same chrome:
//   - z-[60] dimmed backdrop with `backdrop-blur-sm`
//   - Slide-up glassmorphic panel rounded-t-[32px]
//   - Drag handle pill at the top
//   - Escape key + backdrop click → onClose
//
// This shell owns NOTHING protocol-specific. Each drawer composes the
// shell with its own header / body / footer. Keeps the per-protocol
// components focused on their unique inputs without duplicating modal
// plumbing.
// =============================================================================

import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DrawerShellProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Accessible label for the drawer dialog (used by aria-label). */
  ariaLabel: string;
  /** Override the panel's max-height. Defaults to 88vh. */
  maxHeightClassName?: string;
}

export function DrawerShell({
  open,
  onClose,
  children,
  ariaLabel,
  maxHeightClassName = "max-h-[88vh]",
}: DrawerShellProps) {
  // Escape key → close (least-friction dismissal). Cleanup on unmount.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Body scroll lock while open — prevents the underlying page from
  // scrolling when the drawer's content is shorter than the viewport
  // and the user pans the backdrop.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={onClose}
      className={cn(
        // Sits above the ActiveWorkout overlay (z-50). z-[60] matches the
        // ExitWorkoutDialog convention; they should never be open at the
        // same time, but if they are the ExitDialog wins by JSX order
        // (declared after the drawer in the parent).
        "fixed inset-0 z-[60]",
        "flex flex-col justify-end",
        "bg-slate-900/40 backdrop-blur-sm",
      )}
    >
      <section
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full max-w-2xl mx-auto",
          "bg-surface",
          "rounded-t-[32px]",
          "border-t border-x border-[#c0c7d0]/30",
          "shadow-[0_-20px_60px_-15px_rgba(80,118,142,0.25)]",
          "flex flex-col",
          maxHeightClassName,
        )}
      >
        {/* Drag handle */}
        <div className="shrink-0 flex justify-center pt-3 pb-2">
          <div aria-hidden="true" className="h-1.5 w-12 rounded-full bg-on-surface-variant/25" />
        </div>

        {children}
      </section>
    </div>
  );
}
