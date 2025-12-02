import { useEffect, useState } from "react";
import type {
  ChatSummary,
  ReactionsSummary,
  TelegramData,
  TimePatterns,
  TimeSeriesAggregated,
  TopChatsOverTime,
} from "../types";

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
  }
  return response.json();
}

export function useData(): TelegramData {
  const [data, setData] = useState<TelegramData>({
    chatSummary: [],
    reactions: {
      reactions_given_by_user: {},
      reactions_received_by_user: {},
      reactions_by_chat: {},
      reaction_senders_by_chat: {},
      total_reactions_given_by_user: {},
      total_reactions_received_by_user: {},
      top_reaction_senders: {},
    },
    timePatterns: {
      by_hour: {},
      by_day_of_week: {},
      total_by_hour: { user: Array(24).fill(0), others: Array(24).fill(0) },
      total_by_day_of_week: {
        user: Array(7).fill(0),
        others: Array(7).fill(0),
      },
    },
    timeSeries: {
      by_day: {},
      by_week: {},
      by_month: {},
      by_year: {},
      totals_by_day: {},
      totals_by_week: {},
      totals_by_month: {},
      totals_by_year: {},
      by_sender_day: {},
      by_sender_week: {},
      by_sender_month: {},
      by_sender_year: {},
    },
    topChatsOverTime: {
      by_day: {},
      by_week: {},
      by_month: {},
      by_year: {},
    },
    loading: true,
    error: null,
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [
          chatSummary,
          reactions,
          timePatterns,
          timeSeries,
          topChatsOverTime,
        ] = await Promise.all([
          fetchJson<ChatSummary[]>("/data/chat_summary.json"),
          fetchJson<ReactionsSummary>("/data/reactions_summary.json"),
          fetchJson<TimePatterns>("/data/time_patterns.json"),
          fetchJson<TimeSeriesAggregated>("/data/time_series_aggregated.json"),
          fetchJson<TopChatsOverTime>("/data/top_chats_over_time.json"),
        ]);

        setData({
          chatSummary,
          reactions,
          timePatterns,
          timeSeries,
          topChatsOverTime,
          loading: false,
          error: null,
        });
      } catch (err) {
        setData((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load data",
        }));
      }
    }

    loadData();
  }, []);

  return data;
}

// Helper hook for chat lookup
export function useChatLookup(chatSummary: ChatSummary[]) {
  const chatMap = new Map<number, ChatSummary>();
  chatSummary.forEach((chat) => chatMap.set(chat.chat_id, chat));

  return {
    getChat: (id: number) => chatMap.get(id),
    getChatName: (id: number | string) => {
      const numId = typeof id === "string" ? parseInt(id, 10) : id;
      return chatMap.get(numId)?.chat_name ?? `Chat ${id}`;
    },
  };
}
