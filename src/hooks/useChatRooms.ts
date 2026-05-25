import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ChatRoom {
  id: string;
  created_at: string;
  updated_at: string;
  type: "direct" | "group";
  name: string | null;
  participants: {
    user_id: string;
    last_read_at: string | null;
    profile: {
      id: string;
      full_name: string | null;
      avatar_url: string | null;
    };
  }[];
  last_message?: {
    id: string;
    content: string;
    media_type: string;
    created_at: string;
    sender_id: string;
  };
  unread_count: number;
}

export interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  media_url: string | null;
  media_type: "text" | "image" | "audio" | "loom";
  is_broadcast: boolean;
  created_at: string;
  sender?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export function useChatRooms() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const roomsQuery = useQuery({
    queryKey: ["chat-rooms", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Fetch rooms the user participates in
      const { data: participations, error: partError } = await supabase
        .from("chat_participants")
        .select("room_id")
        .eq("user_id", user.id);

      if (partError) throw partError;
      if (!participations?.length) return [];

      const roomIds = participations.map((p) => p.room_id);

      // Fetch room details
      const { data: rooms, error: roomsError } = await supabase
        .from("chat_rooms")
        .select("*")
        .in("id", roomIds)
        .order("updated_at", { ascending: false });

      if (roomsError) throw roomsError;
      if (!rooms) return [];

      // Fetch all participants for these rooms
      const { data: allParticipants, error: allPartError } = await supabase
        .from("chat_participants")
        .select("room_id, user_id, last_read_at")
        .in("room_id", roomIds);

      if (allPartError) throw allPartError;

      // Fetch profiles for all participants via the safe RPC
      // (`get_chat_partner_profiles` — see C4 audit fix). The function returns
      // ONLY id/full_name/avatar_url and enforces chat-room membership
      // server-side, so we cannot accidentally pull sensitive fields like
      // onboarding_data or red_flags via this query path.
      const userIds = [...new Set(allParticipants?.map((p) => p.user_id) || [])];
      const { data: profiles, error: profilesError } = await supabase.rpc(
        "get_chat_partner_profiles",
        { p_user_ids: userIds },
      );

      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      // Fetch last message for each room (batch query instead of N+1)
      const lastMessages: Map<string, Message> = new Map();
      if (roomIds.length > 0) {
        const { data: allMsgs } = await supabase
          .from("messages")
          .select("*")
          .in("room_id", roomIds)
          .order("created_at", { ascending: false });

        // Pick only the latest message per room
        if (allMsgs) {
          for (const msg of allMsgs) {
            if (!lastMessages.has(msg.room_id)) {
              lastMessages.set(msg.room_id, msg as Message);
            }
          }
        }
      }

      // Build enriched rooms
      const enrichedRooms: ChatRoom[] = rooms.map((room) => {
        const roomParticipants = (allParticipants || [])
          .filter((p) => p.room_id === room.id)
          .map((p) => ({
            user_id: p.user_id,
            last_read_at: p.last_read_at,
            profile: profileMap.get(p.user_id) || {
              id: p.user_id,
              full_name: null,
              avatar_url: null,
            },
          }));

        const myParticipation = roomParticipants.find((p) => p.user_id === user.id);
        const lastMessage = lastMessages.get(room.id);

        // Calculate unread count
        let unreadCount = 0;
        if (lastMessage && myParticipation?.last_read_at) {
          const lastReadTime = new Date(myParticipation.last_read_at).getTime();
          const messageTime = new Date(lastMessage.created_at).getTime();
          if (messageTime > lastReadTime && lastMessage.sender_id !== user.id) {
            unreadCount = 1; // Simplified: just show if there are unread
          }
        } else if (lastMessage && lastMessage.sender_id !== user.id) {
          unreadCount = 1;
        }

        return {
          id: room.id,
          created_at: room.created_at,
          updated_at: room.updated_at,
          type: room.type as "direct" | "group",
          name: room.name,
          participants: roomParticipants,
          last_message: lastMessage,
          unread_count: unreadCount,
        };
      });

      return enrichedRooms;
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getOrCreateDirectRoom = useMutation({
    mutationFn: async (otherUserId: string) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc("get_or_create_direct_room", {
        user_a: user.id,
        user_b: otherUserId,
      });

      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-rooms"] });
    },
  });

  const markRoomAsRead = useMutation({
    mutationFn: async (roomId: string) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("chat_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("room_id", roomId)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-rooms"] });
    },
  });

  return {
    rooms: roomsQuery.data || [],
    isLoading: roomsQuery.isLoading,
    error: roomsQuery.error,
    getOrCreateDirectRoom,
    markRoomAsRead,
    refetch: roomsQuery.refetch,
  };
}

export function useMessages(roomId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const messagesQuery = useQuery({
    queryKey: ["messages", roomId],
    queryFn: async () => {
      if (!roomId) return [];

      // Fetch messages without the FK embed on profiles. The audit C4 fix
      // dropped the over-broad "Read profiles of shared chat rooms" policy,
      // so the embed would return null sender objects for anyone outside the
      // caller's coach/athlete relationships. Instead we resolve sender
      // identities via the safe RPC and join client-side.
      const { data: rawMessages, error } = await supabase
        .from("messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      const messages = (rawMessages || []) as Message[];

      const senderIds = [...new Set(messages.map((m) => m.sender_id))];
      if (senderIds.length === 0) {
        return [] as (Message & {
          sender: { id: string; full_name: string | null; avatar_url: string | null };
        })[];
      }

      const { data: senderProfiles, error: senderError } = await supabase.rpc(
        "get_chat_partner_profiles",
        { p_user_ids: senderIds },
      );

      if (senderError) throw senderError;

      const senderMap = new Map<
        string,
        { id: string; full_name: string | null; avatar_url: string | null }
      >((senderProfiles || []).map((p) => [p.id, p]));

      return messages.map((m) => ({
        ...m,
        sender: senderMap.get(m.sender_id) ?? {
          id: m.sender_id,
          full_name: null,
          avatar_url: null,
        },
      })) as (Message & {
        sender: { id: string; full_name: string | null; avatar_url: string | null };
      })[];
    },
    enabled: !!roomId,
  });

  const sendMessage = useMutation({
    mutationFn: async (params: {
      content: string;
      media_url?: string;
      media_type?: "text" | "image" | "audio" | "loom";
    }) => {
      if (!roomId || !user?.id) throw new Error("Missing room or user");

      const { data, error } = await supabase
        .from("messages")
        .insert({
          room_id: roomId,
          sender_id: user.id,
          content: params.content,
          media_url: params.media_url || null,
          media_type: params.media_type || "text",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", roomId] });
      queryClient.invalidateQueries({ queryKey: ["chat-rooms"] });
    },
  });

  // Subscribe to realtime messages
  const subscribeToMessages = (callback: (message: Message) => void) => {
    if (!roomId) return () => {};

    const channelName = `room-${roomId}`;

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
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          callback(payload.new as Message);
          queryClient.invalidateQueries({ queryKey: ["messages", roomId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  return {
    messages: messagesQuery.data || [],
    isLoading: messagesQuery.isLoading,
    error: messagesQuery.error,
    sendMessage,
    subscribeToMessages,
    refetch: messagesQuery.refetch,
  };
}
