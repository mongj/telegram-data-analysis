import * as d3 from "d3";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import TimeGranularityToggle from "../components/TimeGranularityToggle";
import { useFilters } from "../context/FilterContext";
import type { TelegramData, TimeGranularity } from "../types";

interface MessageTrendsProps {
  data: TelegramData;
}

export default function MessageTrends({ data }: MessageTrendsProps) {
  const { timeSeries } = data;
  const { filters, filteredChats } = useFilters();
  const [granularity, setGranularity] = useState<TimeGranularity>("month");

  const filteredChatIds = useMemo(
    () => new Set(filteredChats.map((c) => c.chat_id.toString())),
    [filteredChats]
  );

  // Get the appropriate time series data based on granularity
  const timeSeriesData = useMemo(() => {
    const source =
      granularity === "day"
        ? timeSeries.by_day
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
      }
      return date >= startDate && date <= endDate;
    };

    // Show totals for filtered chats
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
  }, [timeSeries, granularity, filteredChatIds, filters.dateRange]);

  // Proportion data - not used since we removed chat comparison
  const proportionData: never[] = [];

  const formatXAxis = (value: string) => {
    if (granularity === "year") return value;
    if (granularity === "month") return value.slice(2, 7);
    return value.slice(5);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-display font-bold text-dark-100 mb-2">
          Message Trends
        </h1>
        <p className="text-dark-400">
          Analyze messaging patterns over time with granular control
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-start gap-4 animate-fade-in stagger-1 opacity-0">
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

      {/* Main Chart */}
      <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 animate-fade-in stagger-2 opacity-0">
        <h2 className="text-lg font-display font-semibold text-dark-100 mb-6">
          All Messages Over Time
        </h2>
        <div className="h-80">
          {timeSeriesData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-dark-500">
              No data for selected filters
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeriesData}>
                <defs>
                  <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="othersGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                <Area
                  type="monotone"
                  dataKey="others"
                  stackId="1"
                  stroke="#8b5cf6"
                  fill="url(#othersGrad)"
                  name="Others"
                />
                <Area
                  type="monotone"
                  dataKey="user"
                  stackId="1"
                  stroke="#3b82f6"
                  fill="url(#userGrad)"
                  name="You"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Proportion Chart - Removed since chat comparison removed */}
      {false && proportionData.length > 0 && (
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 animate-fade-in">
          <h2 className="text-lg font-display font-semibold text-dark-100 mb-2">
            Chat Proportion Over Time
          </h2>
          <p className="text-sm text-dark-400 mb-6">
            How your attention shifted between chats
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={proportionData}>
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
                  tickFormatter={(v) => `${v.toFixed(0)}%`}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e1e22",
                    border: "1px solid #2a2a32",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "#acacbe" }}
                  formatter={(value: number) => `${value.toFixed(1)}%`}
                />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
          <p className="text-dark-400 text-sm mb-2">Data Points</p>
          <p className="text-2xl font-display font-bold text-dark-100">
            {timeSeriesData.length}
          </p>
          <p className="text-dark-500 text-sm mt-1">
            {granularity === "day"
              ? "days"
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
    </div>
  );
}
