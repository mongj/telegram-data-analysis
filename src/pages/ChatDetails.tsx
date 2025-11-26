import {
  Activity,
  Clock,
  Image,
  MessageSquare,
  Mic,
  Sticker,
  TrendingDown,
  TrendingUp,
  Video,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChatSelector from "../components/ChatSelector";
import StatCard from "../components/StatCard";
import { useFilters } from "../context/FilterContext";
import type { TelegramData } from "../types";

interface ChatDetailsProps {
  data: TelegramData;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

const MEDIA_ICONS: Record<string, typeof MessageSquare> = {
  sticker: Sticker,
  voice_message: Mic,
  video_message: Video,
  video_file: Video,
  audio_file: Mic,
  animation: Image,
};

export default function ChatDetails({ data }: ChatDetailsProps) {
  const { reactions, timePatterns } = data;
  const { filteredChats } = useFilters();
  const [selectedChat, setSelectedChat] = useState<number[]>([]);

  const chat = useMemo(() => {
    if (selectedChat.length === 0) return null;
    return filteredChats.find((c) => c.chat_id === selectedChat[0]);
  }, [filteredChats, selectedChat]);

  // Sender breakdown
  const senderBreakdown = useMemo(() => {
    if (!chat) return [];
    return Object.entries(chat.senders)
      .map(([name, data]) => ({
        name: name.length > 15 ? name.slice(0, 15) + "..." : name,
        fullName: name,
        messages: data.message_count,
        photos: data.photo_count,
        avgLength: data.avg_message_length || 0,
      }))
      .sort((a, b) => b.messages - a.messages)
      .slice(0, 10);
  }, [chat]);

  // GitHub-style heatmap data for ALL years
  const heatmapData = useMemo(() => {
    if (!chat || !chat.active_days) return { grid: [], yearLabels: [] };

    // Create a map of date -> count for quick lookup
    const activeDaysMap = new Map<string, number>();
    Object.entries(chat.active_days).forEach(([date, count]) => {
      activeDaysMap.set(date, count);
    });

    // Get all years from the data, sorted oldest to newest
    const years = new Set<number>();
    Object.keys(chat.active_days).forEach((date) => {
      const year = parseInt(date.split("-")[0], 10);
      if (!isNaN(year)) years.add(year);
    });
    const sortedYears = Array.from(years).sort((a, b) => a - b);

    if (sortedYears.length === 0) return { grid: [], yearLabels: [] };

    // Build grid for all years
    const grid: Array<
      Array<{
        date: string;
        count: number;
      }>
    > = [];
    const yearLabels: Array<{ year: number; weekIndex: number }> = [];

    for (const year of sortedYears) {
      const yearStartWeekIndex = grid.length;
      yearLabels.push({ year, weekIndex: yearStartWeekIndex });

      const startDate = new Date(year, 0, 1); // Jan 1
      const endDate = new Date(year, 11, 31); // Dec 31

      // Adjust start to Sunday of the first week
      const startDayOfWeek = startDate.getDay();
      const adjustedStart = new Date(startDate);
      adjustedStart.setDate(adjustedStart.getDate() - startDayOfWeek);

      // Adjust end to Saturday of the last week
      const endDayOfWeek = endDate.getDay();
      const adjustedEnd = new Date(endDate);
      adjustedEnd.setDate(adjustedEnd.getDate() + (6 - endDayOfWeek));

      const current = new Date(adjustedStart);

      while (current <= adjustedEnd) {
        const week: Array<{
          date: string;
          count: number;
        }> = [];
        for (let i = 0; i < 7; i++) {
          const dateStr = current.toISOString().split("T")[0];
          const count = activeDaysMap.get(dateStr) || 0;
          week.push({
            date: dateStr,
            count,
          });
          current.setDate(current.getDate() + 1);
        }
        grid.push(week);
      }
    }

    return { grid, yearLabels };
  }, [chat]);

  // Format peak activity period
  const peakActivityText = useMemo(() => {
    if (!chat?.peak_activity_period) return null;
    const { start_hour, end_hour } = chat.peak_activity_period;
    const formatHour = (h: number) => {
      const period = h >= 12 ? "PM" : "AM";
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${hour12}:00 ${period}`;
    };
    return `${formatHour(start_hour)} - ${formatHour(end_hour)}`;
  }, [chat]);

  // Media breakdown
  const mediaBreakdown = useMemo(() => {
    if (!chat) return [];
    const entries = Object.entries(chat.media_breakdown);
    if (entries.length === 0) return [];
    return entries
      .map(([type, count]) => ({
        name: type.replace(/_/g, " "),
        value: count,
      }))
      .sort((a, b) => b.value - a.value);
  }, [chat]);

  // Reactions in this chat
  const chatReactions = useMemo(() => {
    if (!chat) return { given: [], received: [] };
    const chatId = chat.chat_id.toString();

    const given = Object.entries(
      reactions.reactions_given_by_user[chatId] || {}
    )
      .map(([emoji, count]) => ({ emoji, count }))
      .sort((a, b) => b.count - a.count);

    const received = Object.entries(
      reactions.reactions_received_by_user[chatId] || {}
    )
      .map(([emoji, count]) => ({ emoji, count }))
      .sort((a, b) => b.count - a.count);

    return { given, received };
  }, [chat, reactions]);

  // Hour of day heatmap data
  const hourHeatmapData = useMemo(() => {
    if (!chat) return null;
    const chatId = chat.chat_id.toString();
    const hourData = timePatterns.by_hour[chatId];
    if (!hourData) return null;

    const combined = HOURS.map((hour) => ({
      hour,
      user: hourData.user[hour] || 0,
      others: hourData.others[hour] || 0,
      total: (hourData.user[hour] || 0) + (hourData.others[hour] || 0),
    }));

    const maxTotal = Math.max(...combined.map((h) => h.total), 1);
    return { data: combined, maxTotal };
  }, [chat, timePatterns]);

  // Day of week heatmap data
  const dayOfWeekHeatmapData = useMemo(() => {
    if (!chat) return null;
    const chatId = chat.chat_id.toString();
    const dowData = timePatterns.by_day_of_week[chatId];
    if (!dowData) return null;

    const combined = DAYS_OF_WEEK.map((day, idx) => ({
      day,
      dayIndex: idx,
      user: dowData.user[idx] || 0,
      others: dowData.others[idx] || 0,
      total: (dowData.user[idx] || 0) + (dowData.others[idx] || 0),
    }));

    const maxTotal = Math.max(...combined.map((d) => d.total), 1);
    return { data: combined, maxTotal };
  }, [chat, timePatterns]);

  // Helper function to get heatmap color intensity
  const getHeatmapColor = (value: number, max: number, isUser: boolean) => {
    if (value === 0) return "#161b22";
    const intensity = Math.min(value / max, 1);
    if (isUser) {
      // Blue gradient for user messages
      if (intensity < 0.25) return "#0c4a6e";
      if (intensity < 0.5) return "#0369a1";
      if (intensity < 0.75) return "#0284c7";
      return "#0ea5e9";
    } else {
      // Purple gradient for others
      if (intensity < 0.25) return "#581c87";
      if (intensity < 0.5) return "#7c3aed";
      if (intensity < 0.75) return "#8b5cf6";
      return "#a78bfa";
    }
  };

  const getCombinedHeatmapColor = (value: number, max: number) => {
    if (value === 0) return "#161b22";
    const intensity = Math.min(value / max, 1);
    // Teal gradient for combined
    if (intensity < 0.2) return "#134e4a";
    if (intensity < 0.4) return "#0f766e";
    if (intensity < 0.6) return "#14b8a6";
    if (intensity < 0.8) return "#2dd4bf";
    return "#5eead4";
  };

  if (selectedChat.length === 0) {
    return (
      <div className="space-y-8">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-display font-bold text-dark-100 mb-2">
            Chat Details
          </h1>
          <p className="text-dark-400">
            Deep dive into individual chat analytics
          </p>
        </div>

        <div
          className="max-w-md animate-fade-in stagger-1 opacity-0 relative"
          style={{ zIndex: 1 }}
        >
          <label className="block text-sm text-dark-400 mb-2">
            Select a Chat
          </label>
          <ChatSelector
            chats={filteredChats}
            selected={selectedChat}
            onChange={setSelectedChat}
            placeholder="Choose a chat to analyze..."
          />
        </div>

        <div
          className="text-center py-16 text-dark-500 animate-fade-in stagger-2 opacity-0"
          style={{ pointerEvents: "none", position: "relative", zIndex: 0 }}
        >
          <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>Select a chat to view detailed analytics</p>
          <p className="text-sm mt-2">
            ({filteredChats.length} chats available)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-display font-bold text-dark-100 mb-2">
          Chat Details
        </h1>
        <p className="text-dark-400">
          Deep dive into individual chat analytics
        </p>
      </div>

      {/* Chat Selector */}
      <div
        className="max-w-md animate-fade-in stagger-1 opacity-0 relative"
        style={{ zIndex: 1 }}
      >
        <label className="block text-sm text-dark-400 mb-2">
          Select a Chat
        </label>
        <ChatSelector
          chats={filteredChats}
          selected={selectedChat}
          onChange={setSelectedChat}
          placeholder="Choose a chat to analyze..."
        />
      </div>

      {chat && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in stagger-2 opacity-0">
            <StatCard
              title="Total Messages"
              value={chat.total_messages}
              subtitle={chat.chat_type.replace(/_/g, " ")}
            />
            <StatCard
              title="Your Messages"
              value={chat.user_messages}
              subtitle={`${(
                (chat.user_messages / chat.total_messages) *
                100
              ).toFixed(1)}% of total`}
            />
            <StatCard
              title="Photos Shared"
              value={chat.photo_count}
              subtitle="in this chat"
            />
            <StatCard
              title="Avg Message Length"
              value={chat?.avg_message_length.toFixed(0) || "N/A"}
              subtitle="characters"
            />
          </div>

          {/* New Insights Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in stagger-3 opacity-0">
            <StatCard
              title="Longest Streak"
              value={chat.longest_conversation_streak_days || 0}
              subtitle="consecutive days"
            />
            <StatCard
              title="Longest Gap"
              value={chat.longest_gap_days || 0}
              subtitle="days between messages"
            />
            {chat.most_active_day_of_week && (
              <StatCard
                title="Most Active Day"
                value={chat.most_active_day_of_week}
                subtitle="of the week"
              />
            )}
            {chat.most_active_hour !== null &&
              chat.most_active_hour !== undefined && (
                <StatCard
                  title="Most Active Hour"
                  value={
                    chat.most_active_hour === 0
                      ? "12 AM"
                      : chat.most_active_hour < 12
                      ? `${chat.most_active_hour} AM`
                      : chat.most_active_hour === 12
                      ? "12 PM"
                      : `${chat.most_active_hour - 12} PM`
                  }
                  subtitle="peak messaging time"
                />
              )}
          </div>

          {/* Activity Pattern Info */}
          {(peakActivityText || chat.activity_trend) && (
            <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 animate-fade-in stagger-4 opacity-0">
              <h2 className="text-lg font-display font-semibold text-dark-100 mb-4">
                Activity Patterns
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {peakActivityText && (
                  <div className="flex items-center gap-3 p-4 bg-dark-800 rounded-lg">
                    <Clock className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="text-sm text-dark-400">
                        Peak Activity Period
                      </p>
                      <p className="text-lg font-semibold text-dark-100">
                        {peakActivityText}
                      </p>
                      <p className="text-xs text-dark-500 mt-1">
                        {chat.peak_activity_period?.message_count} messages
                      </p>
                    </div>
                  </div>
                )}
                {chat.activity_trend && (
                  <div className="flex items-center gap-3 p-4 bg-dark-800 rounded-lg">
                    {chat.activity_trend === "increasing" ? (
                      <TrendingUp className="w-5 h-5 text-green-400" />
                    ) : chat.activity_trend === "decreasing" ? (
                      <TrendingDown className="w-5 h-5 text-red-400" />
                    ) : (
                      <Activity className="w-5 h-5 text-yellow-400" />
                    )}
                    <div>
                      <p className="text-sm text-dark-400">Activity Trend</p>
                      <p className="text-lg font-semibold text-dark-100 capitalize">
                        {chat.activity_trend}
                      </p>
                      <p className="text-xs text-dark-500 mt-1">over time</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 gap-6">
            {/* Sender Breakdown */}
            <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 animate-fade-in stagger-3 opacity-0">
              <h2 className="text-lg font-display font-semibold text-dark-100 mb-6">
                Messages by Sender
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={senderBreakdown} layout="vertical">
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#2a2a32"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      stroke="#565869"
                      tick={{ fill: "#acacbe", fontSize: 11 }}
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
                      }}
                      labelFormatter={(label, payload) =>
                        payload[0]?.payload?.fullName || label
                      }
                    />
                    <Bar
                      dataKey="messages"
                      fill="#3b82f6"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Average Message Length by Sender */}
            {senderBreakdown.length > 0 && (
              <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 animate-fade-in stagger-4 opacity-0">
                <h2 className="text-lg font-display font-semibold text-dark-100 mb-6">
                  Average Message Length by Sender
                </h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={senderBreakdown} layout="vertical">
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#2a2a32"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        stroke="#565869"
                        tick={{ fill: "#acacbe", fontSize: 11 }}
                        label={{
                          value: "Characters",
                          position: "insideBottom",
                          offset: -5,
                          fill: "#acacbe",
                          fontSize: 12,
                        }}
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
                        }}
                        labelFormatter={(label, payload) =>
                          payload[0]?.payload?.fullName || label
                        }
                        formatter={(value: number) => [
                          `${value.toFixed(0)} chars`,
                          "Avg Length",
                        ]}
                      />
                      <Bar
                        dataKey="avgLength"
                        fill="#8b5cf6"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Active Days Heatmap - GitHub Style */}
            {heatmapData.grid.length > 0 && (
              <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 animate-fade-in stagger-5 opacity-0">
                <h2 className="text-lg font-display font-semibold text-dark-100 mb-4">
                  Activity Heatmap
                </h2>
                <div className="overflow-x-auto">
                  <div className="inline-block">
                    {/* Year labels */}
                    <div className="flex ml-8 mb-1">
                      {heatmapData.yearLabels.map((yearLabel, idx) => {
                        const nextYear = heatmapData.yearLabels[idx + 1];
                        const width = nextYear
                          ? (nextYear.weekIndex - yearLabel.weekIndex) * 12
                          : (heatmapData.grid.length - yearLabel.weekIndex) *
                            12;
                        return (
                          <div
                            key={yearLabel.year}
                            className="text-xs text-dark-400 font-medium"
                            style={{
                              width: `${width}px`,
                            }}
                          >
                            {yearLabel.year}
                          </div>
                        );
                      })}
                    </div>
                    {/* Grid with day labels */}
                    <div className="flex">
                      {/* Day of week labels */}
                      <div
                        className="flex flex-col justify-between pr-2 py-[2px] sticky left-0 bg-dark-900 z-10"
                        style={{ height: `${7 * 12 - 2}px` }}
                      >
                        <span className="text-[10px] text-dark-500 leading-none">
                          &nbsp;
                        </span>
                        <span className="text-[10px] text-dark-500 leading-none">
                          Mon
                        </span>
                        <span className="text-[10px] text-dark-500 leading-none">
                          &nbsp;
                        </span>
                        <span className="text-[10px] text-dark-500 leading-none">
                          Wed
                        </span>
                        <span className="text-[10px] text-dark-500 leading-none">
                          &nbsp;
                        </span>
                        <span className="text-[10px] text-dark-500 leading-none">
                          Fri
                        </span>
                        <span className="text-[10px] text-dark-500 leading-none">
                          &nbsp;
                        </span>
                      </div>
                      {/* Weeks grid */}
                      <div className="flex gap-[2px]">
                        {heatmapData.grid.map((week, weekIdx) => (
                          <div
                            key={weekIdx}
                            className="flex flex-col gap-[2px]"
                          >
                            {week.map((day) => {
                              // GitHub green color scale - fixed buckets
                              let bgColor: string;
                              if (day.count === 0) {
                                bgColor = "#161b22"; // Empty: dark grey
                              } else if (day.count <= 10) {
                                bgColor = "#0e4429"; // Level 1: 1-10 messages
                              } else if (day.count <= 40) {
                                bgColor = "#006d32"; // Level 2: 11-40 messages
                              } else if (day.count <= 100) {
                                bgColor = "#26a641"; // Level 3: 41-100 messages
                              } else {
                                bgColor = "#39d353"; // Level 4: 100+ messages
                              }

                              return (
                                <div
                                  key={day.date}
                                  className="w-[10px] h-[10px] rounded-[2px] hover:ring-1 hover:ring-dark-400 cursor-pointer"
                                  style={{ backgroundColor: bgColor }}
                                  title={`${day.date}: ${day.count} message${
                                    day.count !== 1 ? "s" : ""
                                  }`}
                                />
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Legend */}
                    <div className="flex items-center justify-end gap-2 mt-3 text-[10px] text-dark-500">
                      <span>0</span>
                      <div
                        className="w-[10px] h-[10px] rounded-[2px]"
                        style={{ backgroundColor: "#161b22" }}
                        title="0 messages"
                      />
                      <div
                        className="w-[10px] h-[10px] rounded-[2px]"
                        style={{ backgroundColor: "#0e4429" }}
                        title="1-10 messages"
                      />
                      <span className="ml-1">1-10</span>
                      <div
                        className="w-[10px] h-[10px] rounded-[2px]"
                        style={{ backgroundColor: "#006d32" }}
                        title="11-40 messages"
                      />
                      <span className="ml-1">11-40</span>
                      <div
                        className="w-[10px] h-[10px] rounded-[2px]"
                        style={{ backgroundColor: "#26a641" }}
                        title="41-100 messages"
                      />
                      <span className="ml-1">41-100</span>
                      <div
                        className="w-[10px] h-[10px] rounded-[2px]"
                        style={{ backgroundColor: "#39d353" }}
                        title="100+ messages"
                      />
                      <span className="ml-1">100+</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Hour of Day Heatmap */}
            {hourHeatmapData && (
              <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 animate-fade-in stagger-6 opacity-0">
                <h2 className="text-lg font-display font-semibold text-dark-100 mb-4">
                  Messages by Hour of Day
                </h2>
                <div className="space-y-4">
                  {/* Combined heatmap bar */}
                  <div>
                    <p className="text-sm text-dark-400 mb-2">All Messages</p>
                    <div className="flex gap-[2px]">
                      {hourHeatmapData.data.map((item) => (
                        <div key={item.hour} className="flex-1 relative group">
                          <div
                            className="h-10 rounded-sm transition-all hover:ring-1 hover:ring-dark-400"
                            style={{
                              backgroundColor: getCombinedHeatmapColor(
                                item.total,
                                hourHeatmapData.maxTotal
                              ),
                            }}
                          />
                          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-dark-500">
                            {item.hour % 6 === 0 ? item.hour : ""}
                          </div>
                          {/* Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-dark-700 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                            {item.hour}:00 - {item.total} messages
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between mt-6 text-[10px] text-dark-500">
                      <span>12 AM</span>
                      <span>6 AM</span>
                      <span>12 PM</span>
                      <span>6 PM</span>
                      <span>12 AM</span>
                    </div>
                  </div>

                  {/* Split view: You vs Others */}
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <div>
                      <p className="text-sm text-dark-400 mb-2 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm bg-sky-500"></span>
                        Your Messages
                      </p>
                      <div className="flex gap-[1px]">
                        {hourHeatmapData.data.map((item) => (
                          <div
                            key={item.hour}
                            className="flex-1 h-8 rounded-sm transition-all hover:ring-1 hover:ring-dark-400 cursor-pointer"
                            style={{
                              backgroundColor: getHeatmapColor(
                                item.user,
                                hourHeatmapData.maxTotal,
                                true
                              ),
                            }}
                            title={`${item.hour}:00 - ${item.user} messages`}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-dark-400 mb-2 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm bg-violet-500"></span>
                        Others' Messages
                      </p>
                      <div className="flex gap-[1px]">
                        {hourHeatmapData.data.map((item) => (
                          <div
                            key={item.hour}
                            className="flex-1 h-8 rounded-sm transition-all hover:ring-1 hover:ring-dark-400 cursor-pointer"
                            style={{
                              backgroundColor: getHeatmapColor(
                                item.others,
                                hourHeatmapData.maxTotal,
                                false
                              ),
                            }}
                            title={`${item.hour}:00 - ${item.others} messages`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center justify-end gap-2 mt-3 text-[10px] text-dark-500">
                    <span>Less</span>
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: "#161b22" }}
                    />
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: "#134e4a" }}
                    />
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: "#0f766e" }}
                    />
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: "#14b8a6" }}
                    />
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: "#5eead4" }}
                    />
                    <span>More</span>
                  </div>
                </div>
              </div>
            )}

            {/* Day of Week Heatmap */}
            {dayOfWeekHeatmapData && (
              <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 animate-fade-in stagger-7 opacity-0">
                <h2 className="text-lg font-display font-semibold text-dark-100 mb-4">
                  Messages by Day of Week
                </h2>
                <div className="space-y-4">
                  {/* Horizontal bar chart style heatmap */}
                  <div className="space-y-2">
                    {dayOfWeekHeatmapData.data.map((item) => (
                      <div key={item.day} className="flex items-center gap-3">
                        <span className="w-10 text-sm text-dark-400">
                          {item.day}
                        </span>
                        <div className="flex-1 flex gap-1">
                          {/* User bar */}
                          <div
                            className="h-6 rounded-l-sm transition-all relative group"
                            style={{
                              width: `${
                                (item.user / dayOfWeekHeatmapData.maxTotal) * 50
                              }%`,
                              minWidth: item.user > 0 ? "4px" : "0px",
                              backgroundColor: "#0ea5e9",
                            }}
                          >
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-[10px] text-white font-medium">
                                {item.user}
                              </span>
                            </div>
                          </div>
                          {/* Others bar */}
                          <div
                            className="h-6 rounded-r-sm transition-all relative group"
                            style={{
                              width: `${
                                (item.others / dayOfWeekHeatmapData.maxTotal) *
                                50
                              }%`,
                              minWidth: item.others > 0 ? "4px" : "0px",
                              backgroundColor: "#8b5cf6",
                            }}
                          >
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-[10px] text-white font-medium">
                                {item.others}
                              </span>
                            </div>
                          </div>
                        </div>
                        <span className="w-16 text-right text-sm text-dark-300">
                          {item.total.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Legend */}
                  <div className="flex items-center justify-center gap-6 mt-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-sm bg-sky-500"></span>
                      <span className="text-dark-400">Your Messages</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-sm bg-violet-500"></span>
                      <span className="text-dark-400">Others' Messages</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Media Breakdown */}
          {mediaBreakdown.length > 0 && (
            <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 animate-fade-in">
              <h2 className="text-lg font-display font-semibold text-dark-100 mb-6">
                Media Types
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {mediaBreakdown.map((item, index) => {
                  const Icon =
                    MEDIA_ICONS[item.name.replace(/ /g, "_")] || MessageSquare;
                  return (
                    <div
                      key={item.name}
                      className="p-4 bg-dark-800 rounded-lg border border-dark-700 text-center"
                    >
                      <Icon
                        className="w-6 h-6 mx-auto mb-2"
                        style={{ color: COLORS[index % COLORS.length] }}
                      />
                      <p className="text-xl font-display font-bold text-dark-100">
                        {item.value.toLocaleString()}
                      </p>
                      <p className="text-xs text-dark-500 mt-1 capitalize">
                        {item.name}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reactions */}
          {(chatReactions.given.length > 0 ||
            chatReactions.received.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
              {chatReactions.given.length > 0 && (
                <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
                  <h2 className="text-lg font-display font-semibold text-dark-100 mb-4">
                    Reactions You Gave
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    {chatReactions.given
                      .slice(0, 10)
                      .map(({ emoji, count }) => (
                        <div
                          key={emoji}
                          className="flex items-center gap-2 px-3 py-2 bg-dark-800 rounded-lg"
                        >
                          <span className="text-xl">{emoji}</span>
                          <span className="text-sm text-dark-300">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {chatReactions.received.length > 0 && (
                <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
                  <h2 className="text-lg font-display font-semibold text-dark-100 mb-4">
                    Reactions You Received
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    {chatReactions.received
                      .slice(0, 10)
                      .map(({ emoji, count }) => (
                        <div
                          key={emoji}
                          className="flex items-center gap-2 px-3 py-2 bg-dark-800 rounded-lg"
                        >
                          <span className="text-xl">{emoji}</span>
                          <span className="text-sm text-dark-300">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
