import * as d3 from "d3";
import {
  Calendar,
  Check,
  MessageSquare,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import StatCard from "../components/StatCard";
import TimeGranularityToggle from "../components/TimeGranularityToggle";
import { useFilters } from "../context/FilterContext";
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
  const { timeSeries } = data;
  const { filters, filteredChats } = useFilters();
  const [granularity, setGranularity] = useState<TimeGranularity>("month");
  const [selectedSenders, setSelectedSenders] = useState<Set<string>>(
    new Set()
  );

  const filteredChatIds = useMemo(
    () => new Set(filteredChats.map((c) => c.chat_id.toString())),
    [filteredChats]
  );

  // Get all sender names from filtered chats
  const allSenderNames = useMemo(() => {
    const allSenders = new Set<string>();
    filteredChats.forEach((chat) => {
      if (chat.senders) {
        Object.keys(chat.senders).forEach((sender) => allSenders.add(sender));
      }
    });
    return Array.from(allSenders).sort();
  }, [filteredChats]);

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
      dateRange:
        minDate && maxDate
          ? `${minDate.toLocaleDateString()} - ${maxDate.toLocaleDateString()}`
          : "N/A",
    };
  }, [filteredChats]);

  // Time series data with configurable granularity
  const timeSeriesData = useMemo(() => {
    const source =
      granularity === "day"
        ? timeSeries.by_day
        : granularity === "week"
        ? timeSeries.by_week
        : granularity === "month"
        ? timeSeries.by_month
        : timeSeries.by_year;

    const startDate = filters.dateRange.start;
    const endDate = filters.dateRange.end;

    // Filter function for date range
    const inDateRange = (date: string) => {
      if (granularity === "year") {
        return date >= startDate.slice(0, 4) && date <= endDate.slice(0, 4);
      } else if (granularity === "month") {
        return date >= startDate.slice(0, 7) && date <= endDate.slice(0, 7);
      } else if (granularity === "week") {
        // For week format YYYY-Www, we need to convert startDate/endDate to week format
        // For simplicity, compare year and use string comparison for week keys
        // Week format YYYY-Www sorts correctly as strings
        const dateYear = parseInt(date.slice(0, 4));
        const startYear = parseInt(startDate.slice(0, 4));
        const endYear = parseInt(endDate.slice(0, 4));

        if (dateYear < startYear || dateYear > endYear) return false;

        // Convert startDate and endDate to week format for comparison
        // We'll approximate by using the first week of the start month and last week of end month
        // For more accuracy, we'd need to calculate ISO week numbers, but this is simpler
        const startWeekKey = `${startYear}-W${String(
          Math.ceil(parseInt(startDate.slice(5, 7)) * 4.33)
        ).padStart(2, "0")}`;
        const endWeekKey = `${endYear}-W${String(
          Math.ceil(parseInt(endDate.slice(5, 7)) * 4.33)
        ).padStart(2, "0")}`;

        // Simple comparison: if date is between startYear-W01 and endYear-W53, include it
        // More precise filtering would require ISO week calculation
        return date >= `${startYear}-W01` && date <= `${endYear}-W53`;
      }
      return date >= startDate && date <= endDate;
    };

    // Show individual sender lines (not aggregated as "others")
    const senderSource =
      granularity === "day"
        ? timeSeries.by_sender_day
        : granularity === "week"
        ? timeSeries.by_sender_week
        : granularity === "month"
        ? timeSeries.by_sender_month
        : timeSeries.by_sender_year;

    // If sender source data is not available (e.g., data not regenerated), fall back to aggregated view
    if (!senderSource || typeof senderSource !== "object") {
      return Object.entries(source)
        .filter(([date]) => inDateRange(date))
        .map(([date, chats]) => {
          let user = 0;
          let others = 0;
          Object.entries(chats).forEach(([chatId, counts]) => {
            if (filteredChatIds.has(chatId)) {
              user += counts.user;
              others += counts.others;
            }
          });
          return { date, user, others, total: user + others };
        })
        .filter((d) => d.total > 0)
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    // Get all senders from filtered chats (only include selected senders)
    const selectedSendersSet =
      selectedSenders.size > 0 ? selectedSenders : new Set(allSenderNames);

    // Get all dates that have data for selected senders
    const allDates = new Set<string>();
    if (senderSource) {
      Object.keys(senderSource).forEach((date) => {
        if (inDateRange(date)) {
          // Check if any selected sender has data on this date
          const hasData = Array.from(selectedSendersSet).some(
            (sender) =>
              senderSource[date]?.[sender] && senderSource[date][sender] > 0
          );
          if (hasData) {
            allDates.add(date);
          }
        }
      });
    }

    // Build data with one line per selected sender
    return Array.from(allDates)
      .sort()
      .map((date) => {
        const entry: Record<string, string | number> = { date };
        selectedSendersSet.forEach((sender) => {
          const count = senderSource?.[date]?.[sender] || 0;
          if (count > 0) {
            entry[sender] = count;
          }
        });
        return entry;
      })
      .filter((d) => {
        // Only include dates where at least one sender has messages
        return Object.keys(d).some(
          (key) => key !== "date" && (d[key] as number) > 0
        );
      });
  }, [
    timeSeries,
    granularity,
    filteredChatIds,
    filters.dateRange,
    filteredChats,
    selectedSenders,
    allSenderNames,
  ]);

  // Initialize selected senders with all senders when filtered chats change
  useEffect(() => {
    if (allSenderNames.length > 0) {
      // Check if we need to initialize (first time) or clean up invalid senders
      const validSenders = new Set(allSenderNames);
      const currentSenders = Array.from(selectedSenders);

      // If no senders selected, initialize with all
      if (selectedSenders.size === 0) {
        setSelectedSenders(new Set(allSenderNames));
      }
      // If some selected senders are no longer valid, remove them
      else if (currentSenders.some((s) => !validSenders.has(s))) {
        const updated = new Set(
          currentSenders.filter((s) => validSenders.has(s))
        );
        setSelectedSenders(updated);
      }
    }
  }, [allSenderNames]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get selected sender names for chart (filtered to only show selected ones)
  const chartLineNames = useMemo(() => {
    return allSenderNames.filter((name) => selectedSenders.has(name));
  }, [allSenderNames, selectedSenders]);

  const formatXAxis = (value: string) => {
    if (granularity === "year") return value;
    if (granularity === "month") return value.slice(2, 7);
    if (granularity === "week") return value.slice(2, 8); // YYYY-Www -> YY-Www
    return value.slice(5);
  };

  // Top 10 chats by message count (from filtered)
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
          title="Date Range"
          value={filters.dateRange.start}
          subtitle={`to ${filters.dateRange.end}`}
          icon={<Calendar className="w-5 h-5" />}
          className="animate-fade-in stagger-4 opacity-0"
        />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-start gap-4 animate-fade-in stagger-5 opacity-0">
        <div>
          <label className="block text-sm text-dark-400 mb-2">
            Time Granularity
          </label>
          <TimeGranularityToggle
            value={granularity}
            onChange={setGranularity}
          />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Messages Over Time */}
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 animate-fade-in stagger-6 opacity-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold text-dark-100">
              Messages Over Time - {chartLineNames.length} Sender
              {chartLineNames.length !== 1 ? "s" : ""}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedSenders(new Set(allSenderNames))}
                className="text-xs px-2 py-1 bg-dark-800 border border-dark-600 rounded text-dark-300 hover:bg-dark-700 transition-colors"
              >
                Select All
              </button>
              <button
                onClick={() => setSelectedSenders(new Set())}
                className="text-xs px-2 py-1 bg-dark-800 border border-dark-600 rounded text-dark-300 hover:bg-dark-700 transition-colors"
              >
                Deselect All
              </button>
            </div>
          </div>

          {/* Sender Selection */}
          <div className="mb-4 max-h-32 overflow-y-auto border border-dark-700 rounded-lg p-2 bg-dark-800">
            <div className="flex flex-wrap gap-2">
              {allSenderNames.slice(0, 50).map((sender, index) => {
                const isSelected = selectedSenders.has(sender);
                return (
                  <button
                    key={sender}
                    onClick={() => {
                      const newSelected = new Set(selectedSenders);
                      if (isSelected) {
                        newSelected.delete(sender);
                      } else {
                        newSelected.add(sender);
                      }
                      setSelectedSenders(newSelected);
                    }}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                      isSelected
                        ? "bg-dark-600 border border-dark-500 text-dark-100"
                        : "bg-dark-700 border border-dark-600 text-dark-400 hover:bg-dark-600"
                    }`}
                    style={
                      isSelected
                        ? {
                            borderLeftColor: COLORS[index % COLORS.length],
                            borderLeftWidth: "3px",
                          }
                        : {}
                    }
                  >
                    {isSelected ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <div className="w-3 h-3 rounded border border-dark-500" />
                    )}
                    <span className="truncate max-w-[120px]" title={sender}>
                      {sender}
                    </span>
                  </button>
                );
              })}
              {allSenderNames.length > 50 && (
                <span className="text-xs text-dark-500 px-2 py-1">
                  +{allSenderNames.length - 50} more
                </span>
              )}
            </div>
          </div>

          <div className="h-80">
            {timeSeriesData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-dark-500">
                No data for selected filters
              </div>
            ) : (
              // Show individual lines (either for chats or senders)
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" />
                  <XAxis
                    dataKey="date"
                    stroke="#565869"
                    tick={{ fill: "#acacbe", fontSize: 11 }}
                    tickFormatter={formatXAxis}
                  />
                  <YAxis
                    stroke="#565869"
                    tick={{ fill: "#acacbe", fontSize: 11 }}
                    tickFormatter={(v) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e1e22",
                      border: "1px solid #2a2a32",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "#acacbe" }}
                    formatter={(value: number) => value.toLocaleString()}
                  />
                  <Legend />
                  {chartLineNames.slice(0, 20).map((name, index) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={COLORS[index % COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          {chartLineNames.length > 20 && (
            <p className="text-xs text-dark-500 mt-2 text-center">
              Showing first 20 of {chartLineNames.length} selected senders. Use
              checkboxes above to filter.
            </p>
          )}
          {chartLineNames.length === 0 && allSenderNames.length > 0 && (
            <p className="text-xs text-dark-500 mt-2 text-center">
              No senders selected. Use checkboxes above to select senders to
              display.
            </p>
          )}
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
                <BarChart data={topChats} layout="vertical">
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
                    formatter={(value: number, name: string) => [
                      value.toLocaleString(),
                      name === "value" ? "Total Messages" : name,
                    ]}
                    labelFormatter={(label, payload) =>
                      payload[0]?.payload?.fullName || label
                    }
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {topChats.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in stagger-7 opacity-0">
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
          <p className="text-dark-400 text-sm mb-2">Data Points</p>
          <p className="text-2xl font-display font-bold text-dark-100">
            {timeSeriesData.length}
          </p>
          <p className="text-dark-500 text-sm mt-1">
            {granularity === "day"
              ? "days"
              : granularity === "week"
              ? "weeks"
              : granularity === "month"
              ? "months"
              : "years"}
          </p>
        </div>
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
          <p className="text-dark-400 text-sm mb-2">Peak Activity</p>
          <p className="text-2xl font-display font-bold text-dark-100">
            {timeSeriesData.length > 0
              ? d3
                  .max(timeSeriesData, (d) => d.total as number)
                  ?.toLocaleString() || 0
              : 0}
          </p>
          <p className="text-dark-500 text-sm mt-1">
            messages in a {granularity}
          </p>
        </div>
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
          <p className="text-dark-400 text-sm mb-2">Average</p>
          <p className="text-2xl font-display font-bold text-dark-100">
            {timeSeriesData.length > 0
              ? Math.round(
                  d3.mean(timeSeriesData, (d) => d.total as number) || 0
                ).toLocaleString()
              : 0}
          </p>
          <p className="text-dark-500 text-sm mt-1">
            messages per {granularity}
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      {topChats.length > 0 && (
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 animate-fade-in stagger-8 opacity-0">
          <h2 className="text-lg font-display font-semibold text-dark-100 mb-6">
            Quick Stats
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {topChats.slice(0, 4).map((chat, index) => (
              <div
                key={chat.chatId}
                className="p-4 bg-dark-800 rounded-lg border border-dark-700"
              >
                <div
                  className="w-3 h-3 rounded-full mb-3"
                  style={{ backgroundColor: COLORS[index] }}
                />
                <p
                  className="text-sm text-dark-400 mb-1 truncate"
                  title={chat.fullName}
                >
                  {chat.name}
                </p>
                <p className="text-xl font-display font-bold text-dark-100">
                  {chat.value.toLocaleString()}
                </p>
                <p className="text-xs text-dark-500 mt-1">
                  {chat.userMessages.toLocaleString()} from you
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
