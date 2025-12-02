import * as d3 from "d3";
import { FileText, MessageSquare, TrendingUp, Users } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import StatCard from "../components/StatCard";
import TimeGranularityToggle from "../components/TimeGranularityToggle";
import { useFilters } from "../context/FilterContext";
import { useChatLookup } from "../hooks/useData";
import type { TelegramData, TimeGranularity } from "../types";

interface OverviewProps {
  data: TelegramData;
}

const COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#22c55e",
  "#06b6d4",
  "#eab308",
  "#ef4444",
  "#14b8a6",
  "#a855f7",
];

export default function Overview({ data }: OverviewProps) {
  const { filters, filteredChats, hoveredChatId, setHoveredChatId } =
    useFilters();
  const { topChatsOverTime } = data;
  const { getChatName } = useChatLookup(data.chatSummary);
  const [granularity, setGranularity] = useState<TimeGranularity>("month");

  // Calculate summary stats from filtered chats
  const stats = useMemo(() => {
    const totalMessages = filteredChats.reduce(
      (sum, c) => sum + c.total_messages,
      0
    );
    const userMessages = filteredChats.reduce(
      (sum, c) => sum + c.user_messages,
      0
    );
    const totalChats = filteredChats.length;

    // Calculate total words by summing word counts from all senders in all chats
    const totalWords = filteredChats.reduce((sum, chat) => {
      const chatWords = Object.values(chat.senders).reduce(
        (chatSum, sender) => {
          // Calculate total words: avg_message_length * message_count
          return (
            chatSum +
            Math.round((sender.avg_message_length || 0) * sender.message_count)
          );
        },
        0
      );
      return sum + chatWords;
    }, 0);

    // Calculate words sent by the user
    // The user is identified as the sender with from_id starting with "user"
    // whose message_count matches chat.user_messages
    const userWords = filteredChats.reduce((sum, chat) => {
      if (chat.user_messages === 0) return sum;

      // Find the sender whose message_count matches user_messages and from_id starts with "user"
      const userSender = Object.values(chat.senders).find(
        (sender) =>
          sender.from_id &&
          sender.from_id.startsWith("user") &&
          sender.message_count === chat.user_messages
      );

      if (userSender) {
        return (
          sum +
          Math.round(
            (userSender.avg_message_length || 0) * userSender.message_count
          )
        );
      }
      return sum;
    }, 0);

    // Date range from filtered chats
    const dates = filteredChats
      .filter((c) => c.first_message_date)
      .map((c) => new Date(c.first_message_date!));
    const minDate = dates.length > 0 ? d3.min(dates) : null;
    const maxDate = dates.length > 0 ? d3.max(dates) : null;

    return {
      totalMessages,
      userMessages,
      otherMessages: totalMessages - userMessages,
      totalChats,
      totalWords,
      userWords,
      dateRange:
        minDate && maxDate
          ? `${minDate.toLocaleDateString()} - ${maxDate.toLocaleDateString()}`
          : "N/A",
    };
  }, [filteredChats]);

  // Create consistent color mapping based on total messages (global across all charts)
  // This ensures the same chat always gets the same color regardless of which chart it appears in
  const chatColorMap = useMemo(() => {
    const sortedChats = [...filteredChats].sort(
      (a, b) => b.total_messages - a.total_messages
    );
    const colorMap = new Map<string, string>();
    sortedChats.forEach((chat, index) => {
      colorMap.set(chat.chat_id.toString(), COLORS[index % COLORS.length]);
    });
    return colorMap;
  }, [filteredChats]);

  // Top 10 chats by total messages (sorted in descending order)
  const topChats = useMemo(() => {
    return [...filteredChats]
      .sort((a, b) => b.total_messages - a.total_messages)
      .slice(0, 10)
      .map((chat) => ({
        name:
          (chat.chat_name || "Unknown").length > 20
            ? (chat.chat_name || "Unknown").slice(0, 20) + "..."
            : chat.chat_name || "Unknown",
        fullName: chat.chat_name || "Unknown",
        value: chat.total_messages,
        chatId: chat.chat_id,
        userMessages: chat.user_messages,
        otherMessages: chat.other_messages,
      }));
  }, [filteredChats]);

  // Top 10 chats over time - stacked bar chart data
  const topChatsOverTimeData = useMemo(() => {
    const source =
      granularity === "day"
        ? topChatsOverTime.by_day
        : granularity === "week"
        ? topChatsOverTime.by_week
        : granularity === "month"
        ? topChatsOverTime.by_month
        : topChatsOverTime.by_year;

    if (!source || Object.keys(source).length === 0) {
      return { chartData: [], allChatIds: [] };
    }

    // Create a set of filtered chat IDs for quick lookup
    const filteredChatIdsSet = new Set(
      filteredChats.map((c) => c.chat_id.toString())
    );

    // Filter by date range
    const startDate = filters.dateRange.start;
    const endDate = filters.dateRange.end;

    const inDateRange = (date: string) => {
      if (granularity === "year") {
        return date >= startDate.slice(0, 4) && date <= endDate.slice(0, 4);
      } else if (granularity === "month") {
        return date >= startDate.slice(0, 7) && date <= endDate.slice(0, 7);
      } else if (granularity === "week") {
        // Week format: YYYY-Www
        const dateYear = date.slice(0, 4);
        const startYear = startDate.slice(0, 4);
        const endYear = endDate.slice(0, 4);
        if (dateYear < startYear || dateYear > endYear) return false;
        // For weeks, do a simple string comparison (works for ISO weeks)
        return date >= startDate.slice(0, 7) && date <= endDate.slice(0, 7);
      }
      return date >= startDate && date <= endDate;
    };

    // Create chart data: one entry per time period
    // For each period, filter to only include chats in filteredChats, then take top 10
    const chartData = Object.entries(source)
      .filter(([date]) => inDateRange(date))
      .map(([date, chats]) => {
        // Filter chats to only those in filteredChats, then sort and take top 10
        const filteredChatsForPeriod = Object.entries(chats)
          .filter(([chatId]) => filteredChatIdsSet.has(chatId))
          .map(([chatId, count]) => ({ chatId, count: count as number }))
          .sort((a, b) => b.count - a.count) // Sort descending
          .slice(0, 10); // Take top 10

        const dataPoint: Record<string, string | number> = { date };
        filteredChatsForPeriod.forEach(({ chatId, count }) => {
          dataPoint[chatId] = count;
        });
        return dataPoint;
      })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    // Collect all unique chat IDs that appear in the filtered data (for consistent colors)
    const allChatIds = new Set<string>();
    chartData.forEach((dataPoint) => {
      Object.keys(dataPoint).forEach((key) => {
        if (key !== "date") {
          allChatIds.add(key);
        }
      });
    });

    // Sort chat IDs by total value (largest first) so largest segments appear at bottom of stack
    const chatTotals = new Map<string, number>();
    chartData.forEach((dataPoint) => {
      Object.keys(dataPoint).forEach((key) => {
        if (key !== "date") {
          const value = dataPoint[key];
          if (typeof value === "number" && value > 0) {
            chatTotals.set(key, (chatTotals.get(key) || 0) + value);
          }
        }
      });
    });

    const sortedChatIds = Array.from(allChatIds).sort((a, b) => {
      const totalA = chatTotals.get(a) || 0;
      const totalB = chatTotals.get(b) || 0;
      return totalB - totalA; // Largest first (will be at bottom of stack)
    });

    return { chartData, allChatIds: sortedChatIds };
  }, [topChatsOverTime, granularity, filters.dateRange, filteredChats]);

  const formatXAxis = (value: string) => {
    if (granularity === "year") return value;
    if (granularity === "month") return value.slice(2, 7);
    if (granularity === "week") return value.slice(2); // YYYY-MM-DD -> YY-MM-DD (Monday date)
    return value.slice(5); // YYYY-MM-DD -> MM-DD
  };

  // Helper function to convert hex color to rgba with opacity
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const formatTooltipLabel = (label: string | undefined) => {
    if (!label) return "";
    const trimmedLabel = String(label).trim();
    if (granularity === "year") return trimmedLabel;
    if (granularity === "month") {
      // Format YYYY-MM as "Month YYYY"
      const parts = trimmedLabel.split("-");
      if (parts.length !== 2) {
        return trimmedLabel;
      }
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        return trimmedLabel;
      }
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      return `${monthNames[month - 1]} ${year}`;
    }
    if (granularity === "week") {
      // Format YYYY-MM-DD (Monday date) as a readable date
      const date = new Date(label);
      if (isNaN(date.getTime())) return label;
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    // Day format: YYYY-MM-DD
    const date = new Date(label);
    if (isNaN(date.getTime())) return label;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-display font-bold text-dark-100 mb-2">
          Overview
        </h1>
        <p className="text-dark-400">
          Your Telegram messaging analytics at a glance
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Messages"
          value={stats.totalMessages}
          subtitle={`${stats.userMessages.toLocaleString()} sent by you`}
          icon={<MessageSquare className="w-5 h-5" />}
          className="animate-fade-in stagger-1 opacity-0"
        />
        <StatCard
          title="Total Chats"
          value={stats.totalChats}
          subtitle="Conversations analyzed"
          icon={<Users className="w-5 h-5" />}
          className="animate-fade-in stagger-2 opacity-0"
        />
        <StatCard
          title="Your Messages"
          value={
            stats.totalMessages > 0
              ? `${((stats.userMessages / stats.totalMessages) * 100).toFixed(
                  1
                )}%`
              : "0%"
          }
          subtitle={`${stats.userMessages.toLocaleString()} messages sent`}
          icon={<TrendingUp className="w-5 h-5" />}
          className="animate-fade-in stagger-3 opacity-0"
        />
        <StatCard
          title="Total Words"
          value={stats.totalWords.toLocaleString()}
          subtitle={`${stats.userWords.toLocaleString()} sent by you`}
          icon={<FileText className="w-5 h-5" />}
          className="animate-fade-in stagger-4 opacity-0"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6">
        {/* Top 10 Chats Over Time - Stacked Bar Chart */}
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 animate-fade-in stagger-7 opacity-0">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-display font-semibold text-dark-100">
              Top 10 Chats Over Time
            </h2>
            <TimeGranularityToggle
              value={granularity}
              onChange={setGranularity}
            />
          </div>
          <div className="h-80">
            {topChatsOverTimeData.chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-dark-500">
                No data for selected filters
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topChatsOverTimeData.chartData}
                  onMouseLeave={() => setHoveredChatId(null)}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#2a2a32"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    stroke="#565869"
                    tick={{ fill: "#acacbe", fontSize: 11 }}
                    tickFormatter={formatXAxis}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis
                    stroke="#565869"
                    tick={{ fill: "#acacbe", fontSize: 11 }}
                    tickFormatter={(v) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
                    }
                  />
                  <Tooltip
                    shared={false}
                    contentStyle={{
                      backgroundColor: "#1e1e22",
                      border: "1px solid #2a2a32",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "#acacbe" }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) {
                        return null;
                      }
                      const hoveredItem = payload[0];
                      if (!hoveredItem || hoveredItem.value === 0) {
                        return null;
                      }
                      const hoveredChatIdFromPayload =
                        hoveredItem.dataKey as string;
                      const chatName = getChatName(hoveredChatIdFromPayload);
                      const dataPoint = hoveredItem.payload as any;
                      const dateValue = dataPoint?.date ?? label ?? "";
                      const formattedLabel = formatTooltipLabel(
                        String(dateValue)
                      );
                      return (
                        <div
                          style={{
                            backgroundColor: "#1e1e22",
                            border: "1px solid #2a2a32",
                            borderRadius: "8px",
                            padding: "8px 12px",
                            fontSize: "12px",
                          }}
                        >
                          <p style={{ color: "#acacbe", margin: "0 0 4px 0" }}>
                            {formattedLabel || "Unknown"}
                          </p>
                          <p style={{ color: "#ffffff", margin: 0 }}>
                            <span
                              style={{
                                display: "inline-block",
                                width: "8px",
                                height: "8px",
                                backgroundColor: hoveredItem.color,
                                marginRight: "6px",
                                borderRadius: "2px",
                              }}
                            />
                            {chatName !== `Chat ${hoveredItem.dataKey}`
                              ? chatName
                              : hoveredItem.dataKey}
                            : {hoveredItem.value?.toLocaleString() || 0}
                          </p>
                        </div>
                      );
                    }}
                  />
                  {topChatsOverTimeData.allChatIds.map((chatId) => {
                    const baseColor = chatColorMap.get(chatId) || COLORS[0];
                    const isHovered = hoveredChatId === chatId;
                    const hasHover = hoveredChatId !== null;
                    const opacity = hasHover ? (isHovered ? 1 : 0.3) : 1;

                    return (
                      <Bar
                        key={chatId}
                        dataKey={chatId}
                        stackId="1"
                        fill={hexToRgba(baseColor, opacity)}
                        name={chatId}
                        onMouseEnter={() => setHoveredChatId(chatId)}
                        onMouseLeave={() => setHoveredChatId(null)}
                      />
                    );
                  })}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        {/* Top Chats */}
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 animate-fade-in stagger-6 opacity-0">
          <h2 className="text-lg font-display font-semibold text-dark-100 mb-6">
            Top 10 Chats by Messages
          </h2>
          <div className="h-72">
            {topChats.length === 0 ? (
              <div className="h-full flex items-center justify-center text-dark-500">
                No chats match filters
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topChats}
                  layout="vertical"
                  onMouseMove={(state) => {
                    if (state?.activePayload?.[0]?.payload) {
                      const data = state.activePayload[0]
                        .payload as (typeof topChats)[0];
                      const chatIdStr = data.chatId.toString();
                      if (hoveredChatId !== chatIdStr) {
                        setHoveredChatId(chatIdStr);
                      }
                    }
                  }}
                  onMouseLeave={() => setHoveredChatId(null)}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#2a2a32"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    stroke="#565869"
                    tick={{ fill: "#acacbe", fontSize: 11 }}
                    tickFormatter={(value) =>
                      value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#565869"
                    tick={{ fill: "#acacbe", fontSize: 10 }}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e1e22",
                      border: "1px solid #2a2a32",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "#acacbe" }}
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) {
                        return null;
                      }
                      const item = payload[0];
                      const data = item?.payload as (typeof topChats)[0];
                      if (!data) return null;

                      const color =
                        chatColorMap.get(data.chatId.toString()) || COLORS[0];

                      return (
                        <div
                          style={{
                            backgroundColor: "#1e1e22",
                            border: "1px solid #2a2a32",
                            borderRadius: "8px",
                            padding: "8px 12px",
                            fontSize: "12px",
                          }}
                        >
                          <p style={{ color: "#acacbe", margin: "0 0 4px 0" }}>
                            {data.fullName}
                          </p>
                          <p style={{ color: "#ffffff", margin: 0 }}>
                            <span
                              style={{
                                display: "inline-block",
                                width: "8px",
                                height: "8px",
                                backgroundColor: color,
                                marginRight: "6px",
                                borderRadius: "2px",
                              }}
                            />
                            Total Messages: {data.value.toLocaleString()}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {topChats.map((chat, index) => {
                      const chatIdStr = chat.chatId.toString();
                      const baseColor =
                        chatColorMap.get(chatIdStr) || COLORS[0];
                      const isHovered = hoveredChatId === chatIdStr;
                      const hasHover = hoveredChatId !== null;
                      const opacity = hasHover ? (isHovered ? 1 : 0.3) : 1;

                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={hexToRgba(baseColor, opacity)}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
