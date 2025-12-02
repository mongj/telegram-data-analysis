// Chat summary data structure (includes insights)
export interface ChatSummary {
  chat_id: number;
  chat_name: string;
  chat_type: string;
  total_messages: number;
  user_messages: number;
  other_messages: number;
  media_breakdown: Record<string, number>;
  photo_count: number;
  senders: Record<string, SenderData>;
  // Insights fields
  reply_count: number;
  forwarded_count: number;
  first_message_date: string | null;
  last_message_date: string | null;
  avg_message_length: number;
  reply_rate: number;
  // New insights
  longest_conversation_streak_days: number;
  longest_gap_days: number;
  active_days: Record<string, number>; // day_key (YYYY-MM-DD) -> message_count
  most_active_day_of_week: string | null;
  most_active_hour: number | null;
  peak_activity_period: {
    start_hour: number;
    end_hour: number;
    message_count: number;
  } | null;
  activity_trend: "increasing" | "decreasing" | "stable" | null;
}

export interface SenderData {
  from_id: string;
  message_count: number;
  media_breakdown: Record<string, number>;
  photo_count: number;
  avg_message_length: number;
}

// Reactions data
export interface ReactionsSummary {
  reactions_given_by_user: Record<string, Record<string, number>>;
  reactions_received_by_user: Record<string, Record<string, number>>;
  reactions_by_chat: Record<string, Record<string, number>>;
  reaction_senders_by_chat: Record<string, Record<string, number>>;
  total_reactions_given_by_user: Record<string, number>;
  total_reactions_received_by_user: Record<string, number>;
  top_reaction_senders: Record<string, number>;
}

// Time patterns data
export interface TimePatterns {
  by_hour: Record<string, { user: number[]; others: number[] }>;
  by_day_of_week: Record<string, { user: number[]; others: number[] }>;
  total_by_hour: { user: number[]; others: number[] };
  total_by_day_of_week: { user: number[]; others: number[] };
}

// Additional insights (deprecated - merged into ChatSummary)
// @deprecated Use ChatSummary instead. This interface is kept for backward compatibility.
export interface AdditionalInsight {
  chat_id: number;
  chat_name: string;
  chat_type: string;
  reply_count: number;
  forwarded_count: number;
  first_message_date: string | null;
  last_message_date: string | null;
  avg_message_length: number;
  avg_response_time_seconds: number | null;
  median_response_time_seconds: number | null;
  response_time_sample_count: number;
  reply_rate: number;
}

// Time series aggregated data
export interface TimeSeriesAggregated {
  by_day: Record<string, Record<string, { user: number; others: number }>>;
  by_week: Record<string, Record<string, { user: number; others: number }>>;
  by_month: Record<string, Record<string, { user: number; others: number }>>;
  by_year: Record<string, Record<string, { user: number; others: number }>>;
  totals_by_day: Record<string, { user: number; others: number }>;
  totals_by_week: Record<string, { user: number; others: number }>;
  totals_by_month: Record<string, { user: number; others: number }>;
  totals_by_year: Record<string, { user: number; others: number }>;
  by_sender_day: Record<string, Record<string, number>>;
  by_sender_week: Record<string, Record<string, number>>;
  by_sender_month: Record<string, Record<string, number>>;
  by_sender_year: Record<string, Record<string, number>>;
}

// Combined data context
export interface TelegramData {
  chatSummary: ChatSummary[];
  reactions: ReactionsSummary;
  timePatterns: TimePatterns;
  timeSeries: TimeSeriesAggregated;
  topChatsOverTime: TopChatsOverTime;
  loading: boolean;
  error: string | null;
}

// Chart data types
export interface TimeSeriesDataPoint {
  date: string;
  user: number;
  others: number;
  total: number;
  [key: string]: string | number; // For chat-specific data
}

export interface ChatDataPoint {
  name: string;
  value: number;
  chatId: number;
}

export type TimeGranularity = "day" | "week" | "month" | "year";

// Top chats over time (preprocessed top 10 per time segment)
export interface TopChatsOverTime {
  by_day: Record<string, Record<string, number>>; // date -> chat_id -> user_messages
  by_week: Record<string, Record<string, number>>;
  by_month: Record<string, Record<string, number>>;
  by_year: Record<string, Record<string, number>>;
}
