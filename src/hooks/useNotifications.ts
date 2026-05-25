import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface AppNotification {
  id: string;
  user_id: string;
  sender_id: string | null;
  type: string;
  message: string;
  link_url: string | null;
  read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      return (data || []) as AppNotification[];
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const channelName = `notifications-${user.id}`;

    // Defensive: remove any stale channel with this topic before re-subscribing.
    // See useCoachAlerts.ts for full rationale (HMR / singleton client race).
    supabase
      .getChannels()
      .filter((c) => c.topic === `realtime:${channelName}`)
      .forEach((c) => {
        supabase.removeChannel(c);
      });

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const notifications = notificationsQuery.data || [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    isLoading: notificationsQuery.isLoading,
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
}
