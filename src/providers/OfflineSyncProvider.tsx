import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { WifiOff } from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

type UserRole = "coach" | "athlete" | null;

interface OfflineContextValue {
  isOnline: boolean;
  /** Gate for coach actions - blocks and shows toast if offline */
  requireOnline: (actionName?: string) => boolean;
  /** Check if a specific action is allowed based on role + connectivity */
  canPerformAction: (
    action: "save_program" | "send_message" | "log_workout" | "update_profile",
  ) => boolean;
}

const OfflineContext = createContext<OfflineContextValue>({
  isOnline: true,
  requireOnline: () => true,
  canPerformAction: () => true,
});

// ============================================================================
// PROVIDER
// ============================================================================

interface OfflineSyncProviderProps {
  children: React.ReactNode;
  userRole?: UserRole;
}

export function OfflineSyncProvider({ children, userRole }: OfflineSyncProviderProps) {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const { toast } = useToast();

  // Gatekeeper: blocks action and shows toast if offline
  const requireOnline = useCallback(
    (actionName?: string): boolean => {
      if (navigator.onLine) return true;

      toast({
        title: "Connessione richiesta",
        description: actionName
          ? `${actionName} non disponibile offline.`
          : "Questa azione richiede una connessione internet.",
        variant: "destructive",
      });
      return false;
    },
    [toast],
  );

  // Role-aware action permission checker
  const canPerformAction = useCallback(
    (action: "save_program" | "send_message" | "log_workout" | "update_profile"): boolean => {
      // Always allow if online
      if (navigator.onLine) return true;

      // COACH: Block everything offline
      if (userRole === "coach") {
        return false;
      }

      // ATHLETE: Only allow workout logging offline
      if (userRole === "athlete") {
        return action === "log_workout";
      }

      // Unknown role: block all offline actions
      return false;
    },
    [userRole],
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: "Sei online",
        description: "Sincronizzazione in corso...",
      });
    };

    const handleOffline = () => {
      setIsOnline(false);

      if (userRole === "coach") {
        toast({
          title: "Sei offline",
          description: "Modifica disabilitata per prevenire conflitti.",
          variant: "destructive",
        });
      } else if (userRole === "athlete") {
        toast({
          title: "Sei offline",
          description: "Solo il salvataggio workout è disponibile.",
          variant: "destructive",
        });
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [toast, userRole]);

  return (
    <OfflineContext.Provider value={{ isOnline, requireOnline, canPerformAction }}>
      {children}
    </OfflineContext.Provider>
  );
}

function useOfflineStatus() {
  return useContext(OfflineContext);
}

// ============================================================================
// UI COMPONENTS
// ============================================================================

/** Persistent banner for coaches when offline */
function CoachOfflineBanner() {
  const { isOnline } = useOfflineStatus();

  if (isOnline) return null;

  return (
    <div className="sticky top-0 z-50 bg-destructive text-destructive-foreground px-4 py-2 text-sm flex items-center gap-2">
      <WifiOff className="h-4 w-4" />
      <span>
        <strong>Sei offline.</strong> Modifica disabilitata per prevenire conflitti.
      </span>
    </div>
  );
}

/** Warning banner for specific features */
function OfflineWarningBanner({ feature }: { feature: string }) {
  const { isOnline } = useOfflineStatus();

  if (isOnline) return null;

  return (
    <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex items-center gap-2">
      <WifiOff className="h-4 w-4 flex-shrink-0" />
      <span>
        <strong>Sei offline.</strong> {feature} non disponibile.
      </span>
    </div>
  );
}

/** Read-only overlay that blocks interaction */
function OfflineReadOnlyOverlay({
  children,
  feature,
}: {
  children: React.ReactNode;
  feature: string;
}) {
  const { isOnline } = useOfflineStatus();

  if (isOnline) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none opacity-50 select-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="text-center p-4">
          <WifiOff className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground font-medium">Modalità solo lettura</p>
          <p className="text-sm text-muted-foreground">{feature} richiede connessione</p>
        </div>
      </div>
    </div>
  );
}
