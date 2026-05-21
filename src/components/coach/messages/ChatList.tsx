/**
 * src/components/coach/messages/ChatList.tsx
 * ---------------------------------------------------------------------------
 * Aura Health System — Chat directory list (left column of the 3-column
 * messages workspace).
 *
 * Visual contract (DESIGN.md):
 *   - Outer container is now padding-only; the card surface + shadow are
 *     owned by the parent column shell (CoachMessages / ChatInterface).
 *   - Search input: `rounded-xl border-outline-variant`, focus transitions
 *     to primary + ambient outer glow (`shadow-[0_0_0_4px_rgb(0_86_133_/_0.12)]`).
 *   - Filter tabs: pill-shaped (`rounded-full`).
 *   - Conversation row: prominent avatar with telemetry ring (emerald when
 *     online, amber when unread but offline), recent message preview,
 *     active row tinted `bg-primary/5 border border-primary/10`.
 *   - All interactive surfaces fully accessible (focus-visible rings).
 *
 * State + parent contract:
 *   - All props preserved 1:1 (conversations, isLoading, selectedConversation,
 *     onSelectConversation, isOpen, onClose).
 *   - Local search/filter buffer state preserved.
 *   - No internal data fetching — pure presentational + light filtering.
 */
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Search, Radio, ArrowLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

export interface Conversation {
  athleteId: string;
  athleteName: string;
  avatarUrl: string | null;
  avatarInitials: string;
  lastMessage: string;
  lastMessageTime: Date | null;
  unreadCount: number;
  isOnline: boolean;
}

interface ChatListProps {
  conversations: Conversation[];
  isLoading: boolean;
  selectedConversation: Conversation | null;
  onSelectConversation: (conv: Conversation) => void;
  isOpen: boolean;
  onClose: () => void;
}

type FilterKey = "inbox" | "all" | "broadcasts";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "inbox", label: "Inbox" },
  { key: "all", label: "Tutti" },
  { key: "broadcasts", label: "Broadcast" },
];

export function ChatList({
  conversations,
  isLoading,
  selectedConversation,
  onSelectConversation,
  isOpen,
  onClose,
}: ChatListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterKey>("all");

  const getTimeAgo = (date: Date | null) => {
    if (!date) return "";
    return formatDistanceToNow(date, { addSuffix: false, locale: it });
  };

  // Filter conversations
  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch = conv.athleteName.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeTab === "inbox") {
      return matchesSearch && conv.unreadCount > 0;
    }
    return matchesSearch;
  });

  const unreadCount = conversations.filter((c) => c.unreadCount > 0).length;

  return (
    <div
      className={cn(
        // Outer column shell — flex column, full-height, the surface
        // (rounded-3xl + shadow + border) is owned by the PARENT in the
        // new Aura 3-column layout. ChatList only paints content.
        "flex flex-col overflow-hidden h-full font-sans",
        // Mobile slide-in remains intact for backward compatibility with
        // any consumer that still passes `isOpen`.
        "lg:relative lg:translate-x-0 lg:opacity-100",
        "fixed inset-y-0 left-0 z-50 w-80 transition-all duration-300 lg:w-full lg:static",
        "bg-surface-container-lowest lg:bg-transparent",
        isOpen
          ? "translate-x-0 opacity-100"
          : "-translate-x-full opacity-0 lg:translate-x-0 lg:opacity-100",
      )}
    >
      {/* Mobile Back Button */}
      <div className="lg:hidden flex items-center gap-2 px-4 py-3 border-b border-outline-variant/20">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Indietro"
          onClick={onClose}
          className="rounded-full"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="font-display text-label-md font-bold text-on-surface">Conversazioni</span>
      </div>

      {/* ── Header: filter pills + search ── */}
      <header className="flex-shrink-0 px-4 pt-5 pb-3 space-y-4">
        {/* Filter pills */}
        <nav
          className="flex items-center gap-1.5 bg-surface-container-low rounded-full p-1"
          aria-label="Filtri conversazioni"
        >
          {FILTERS.map((f) => {
            const isActive = activeTab === f.key;
            const isInbox = f.key === "inbox";
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setActiveTab(f.key)}
                aria-pressed={isActive}
                className={cn(
                  "inline-flex items-center gap-1.5 flex-1 h-7 px-3 rounded-full text-xs font-bold transition-all duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  isActive
                    ? "bg-primary-container text-white shadow-[0_2px_8px_rgb(0_62_98_/_0.20)]"
                    : "text-on-surface-variant hover:text-on-surface",
                )}
              >
                {f.label}
                {isInbox && unreadCount > 0 && (
                  <span
                    className={cn(
                      "inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-3xs font-bold tabular-nums",
                      isActive ? "bg-white/20 text-white" : "bg-destructive/10 text-destructive",
                    )}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Search field — Aura 16px radius + ambient outer glow on focus */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca atleta…"
            aria-label="Cerca atleta"
            className={cn(
              "w-full h-10 pl-10 pr-10 rounded-xl bg-surface-container-lowest",
              "border border-outline-variant text-sm text-on-surface placeholder:text-on-surface-variant/70",
              "transition-[box-shadow,border-color] duration-200",
              "focus:outline-none focus:border-primary focus:shadow-[0_0_0_4px_rgb(0_86_133_/_0.12)]",
            )}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Pulisci ricerca"
              className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 inline-flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* ── Conversations list (scrollable) ── */}
      <div className="flex-1 overflow-hidden relative">
        <ScrollArea className="h-full custom-scrollbar">
          {isLoading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <ChatRowSkeleton key={i} />
              ))}
            </div>
          ) : activeTab === "broadcasts" ? (
            <div className="px-6 py-12 text-center text-on-surface-variant">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-container/10 mb-3">
                <Radio className="h-6 w-6 text-primary" />
              </div>
              <p className="text-label-md font-bold text-on-surface mb-1">Broadcast</p>
              <p className="text-xs">Invia messaggi a più atleti contemporaneamente.</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-on-surface-variant">
                {activeTab === "inbox"
                  ? "Nessun messaggio non letto."
                  : searchQuery
                    ? `Nessun atleta trovato per "${searchQuery}"`
                    : "Nessuna conversazione."}
              </p>
            </div>
          ) : (
            <ul className="p-2 space-y-1" role="list">
              {filteredConversations.map((conv) => (
                <li key={conv.athleteId}>
                  <ChatRow
                    conv={conv}
                    isSelected={selectedConversation?.athleteId === conv.athleteId}
                    onSelect={() => onSelectConversation(conv)}
                    timeAgo={getTimeAgo(conv.lastMessageTime)}
                  />
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>

        {/* Floating Broadcast CTA */}
        <Button
          size="icon"
          aria-label="Trasmetti messaggio broadcast"
          className="absolute bottom-4 right-4 h-12 w-12 shadow-lg"
        >
          <Radio className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

// ===========================================================================
// Conversation row
// ===========================================================================
function ChatRow({
  conv,
  isSelected,
  onSelect,
  timeAgo,
}: {
  conv: Conversation;
  isSelected: boolean;
  onSelect: () => void;
  timeAgo: string;
}) {
  // System telemetry ring:
  //   - emerald (online & idle) — like Marco Rossi (verde)
  //   - amber (unread but offline) — like Giulia Bianchi (ambra)
  //   - otherwise no ring (neutral)
  const ringClass = conv.isOnline
    ? "ring-2 ring-emerald-500"
    : conv.unreadCount > 0
      ? "ring-2 ring-amber-500"
      : "";

  // Status dot — small overlapping pip on the avatar, mirrors the ring colour
  // so visually-impaired users get a stronger signal than just the ring.
  const dotClass = conv.isOnline ? "bg-emerald-500" : conv.unreadCount > 0 ? "bg-amber-500" : "";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      aria-label={`Conversazione con ${conv.athleteName}${
        conv.unreadCount > 0 ? `, ${conv.unreadCount} non letti` : ""
      }`}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isSelected
          ? "bg-primary/5 border border-primary/10"
          : "border border-transparent hover:bg-surface-container-low",
      )}
    >
      {/* Avatar with telemetry ring + status dot */}
      <div className="relative flex-shrink-0">
        <Avatar className={cn("h-11 w-11", ringClass)}>
          <AvatarImage src={conv.avatarUrl || undefined} alt={conv.athleteName} />
          <AvatarFallback className="bg-primary-container/15 text-primary text-sm font-bold">
            {conv.avatarInitials}
          </AvatarFallback>
        </Avatar>
        {dotClass && (
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface-container-lowest",
              dotClass,
            )}
            aria-hidden
          />
        )}
      </div>

      {/* Name + last message */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              "text-label-md truncate",
              conv.unreadCount > 0 ? "font-bold text-on-surface" : "font-semibold text-on-surface",
            )}
          >
            {conv.athleteName}
          </p>
          {timeAgo && (
            <span
              className={cn(
                "text-3xs shrink-0 tabular-nums",
                conv.unreadCount > 0 ? "text-primary font-bold" : "text-on-surface-variant",
              )}
            >
              {timeAgo}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p
            className={cn(
              "text-xs truncate",
              conv.unreadCount > 0 ? "text-on-surface font-medium" : "text-on-surface-variant",
            )}
          >
            {conv.lastMessage}
          </p>
          {conv.unreadCount > 0 && (
            <Badge
              variant="default"
              className="h-5 min-w-[20px] px-1.5 text-3xs tabular-nums shrink-0"
            >
              {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}

function ChatRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl">
      <Skeleton className="h-11 w-11 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-10" />
        </div>
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}
