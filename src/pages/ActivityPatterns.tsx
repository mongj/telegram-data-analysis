import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import * as d3 from 'd3';
import type { TelegramData } from '../types';
import { useFilters } from '../context/FilterContext';

interface ActivityPatternsProps {
  data: TelegramData;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function ActivityPatterns({ data }: ActivityPatternsProps) {
  const { timePatterns } = data;
  const { filteredChats } = useFilters();

  const filteredChatIds = useMemo(
    () => new Set(filteredChats.map((c) => c.chat_id.toString())),
    [filteredChats]
  );

  // Get hourly data (filtered)
  const hourlyData = useMemo(() => {
    return HOURS.map((hour) => {
      let user = 0;
      let others = 0;
      Object.entries(timePatterns.by_hour).forEach(([chatId, data]) => {
        if (filteredChatIds.has(chatId)) {
          user += data.user[hour];
          others += data.others[hour];
        }
      });
      return {
        hour: `${hour.toString().padStart(2, '0')}:00`,
        user,
        others,
        total: user + others,
      };
    });
  }, [timePatterns, filteredChatIds]);

  // Get daily data (filtered)
  const dailyData = useMemo(() => {
    return DAYS.map((day, index) => {
      let user = 0;
      let others = 0;
      Object.entries(timePatterns.by_day_of_week).forEach(([chatId, data]) => {
        if (filteredChatIds.has(chatId)) {
          user += data.user[index];
          others += data.others[index];
        }
      });
      return { day, user, others, total: user + others };
    });
  }, [timePatterns, filteredChatIds]);

  // Heatmap data (filtered)
  const heatmapData = useMemo(() => {
    const data: { day: number; hour: number; value: number }[] = [];
    
    // Get total messages per day for weighting
    const dayTotals = DAYS.map((_, dayIndex) => {
      let total = 0;
      Object.entries(timePatterns.by_day_of_week).forEach(([chatId, chatData]) => {
        if (filteredChatIds.has(chatId)) {
          total += chatData.user[dayIndex] + chatData.others[dayIndex];
        }
      });
      return total;
    });

    const totalAllDays = dayTotals.reduce((a, b) => a + b, 0);

    DAYS.forEach((_, dayIndex) => {
      HOURS.forEach((hour) => {
        let hourTotal = 0;
        Object.entries(timePatterns.by_hour).forEach(([chatId, chatData]) => {
          if (filteredChatIds.has(chatId)) {
            hourTotal += chatData.user[hour] + chatData.others[hour];
          }
        });

        // Weight by day distribution
        const dayWeight = totalAllDays > 0 ? dayTotals[dayIndex] / totalAllDays : 1/7;
        const value = Math.round(hourTotal * dayWeight);
        
        data.push({ day: dayIndex, hour, value });
      });
    });

    return data;
  }, [timePatterns, filteredChatIds]);

  const maxHeatmapValue = useMemo(() => {
    return d3.max(heatmapData, (d) => d.value) || 1;
  }, [heatmapData]);

  const colorScale = useMemo(() => {
    return d3.scaleSequential()
      .domain([0, maxHeatmapValue])
      .interpolator(d3.interpolateBlues);
  }, [maxHeatmapValue]);

  // Peak activity stats
  const peakStats = useMemo(() => {
    const peakHour = hourlyData.reduce((max, curr) => 
      curr.total > max.total ? curr : max
    );
    const peakDay = dailyData.reduce((max, curr) =>
      curr.total > max.total ? curr : max
    );
    return { peakHour, peakDay };
  }, [hourlyData, dailyData]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-display font-bold text-dark-100 mb-2">
          Activity Patterns
        </h1>
        <p className="text-dark-400">
          Discover when you're most active on Telegram
        </p>
      </div>

      {/* Peak Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in stagger-1 opacity-0">
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
          <p className="text-dark-400 text-sm mb-2">Most Active Hour</p>
          <p className="text-3xl font-display font-bold text-dark-100">
            {peakStats.peakHour.hour}
          </p>
          <p className="text-dark-500 text-sm mt-1">
            {peakStats.peakHour.total.toLocaleString()} messages
          </p>
        </div>
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
          <p className="text-dark-400 text-sm mb-2">Most Active Day</p>
          <p className="text-3xl font-display font-bold text-dark-100">
            {peakStats.peakDay.day}
          </p>
          <p className="text-dark-500 text-sm mt-1">
            {peakStats.peakDay.total.toLocaleString()} messages
          </p>
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 animate-fade-in stagger-2 opacity-0">
        <h2 className="text-lg font-display font-semibold text-dark-100 mb-6">
          Activity Heatmap
        </h2>
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Hour labels */}
            <div className="flex mb-1 ml-12">
              {HOURS.filter((_, i) => i % 3 === 0).map((hour) => (
                <div
                  key={hour}
                  className="text-xs text-dark-500"
                  style={{ width: `${100 / 8}%` }}
                >
                  {hour.toString().padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Grid */}
            {DAYS.map((day, dayIndex) => (
              <div key={day} className="flex items-center mb-1">
                <div className="w-12 text-xs text-dark-500 text-right pr-2">
                  {day}
                </div>
                <div className="flex flex-1 gap-[2px]">
                  {HOURS.map((hour) => {
                    const cell = heatmapData.find(
                      (d) => d.day === dayIndex && d.hour === hour
                    );
                    const value = cell?.value || 0;
                    return (
                      <div
                        key={hour}
                        className="flex-1 h-6 rounded-sm transition-colors"
                        style={{
                          backgroundColor: value > 0 ? colorScale(value) : '#1e1e22',
                        }}
                        title={`${day} ${hour}:00 - ${value} messages`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Legend */}
            <div className="flex items-center justify-end mt-4 gap-2">
              <span className="text-xs text-dark-500">Less</span>
              <div className="flex gap-[2px]">
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
                  <div
                    key={ratio}
                    className="w-4 h-4 rounded-sm"
                    style={{
                      backgroundColor: ratio === 0 ? '#1e1e22' : colorScale(ratio * maxHeatmapValue),
                    }}
                  />
                ))}
              </div>
              <span className="text-xs text-dark-500">More</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Hour */}
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 animate-fade-in stagger-3 opacity-0">
          <h2 className="text-lg font-display font-semibold text-dark-100 mb-6">
            Messages by Hour
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" />
                <XAxis
                  dataKey="hour"
                  stroke="#565869"
                  tick={{ fill: '#acacbe', fontSize: 10 }}
                  tickFormatter={(v) => v.slice(0, 2)}
                />
                <YAxis
                  stroke="#565869"
                  tick={{ fill: '#acacbe', fontSize: 11 }}
                  tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e1e22',
                    border: '1px solid #2a2a32',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => value.toLocaleString()}
                />
                <Legend />
                <Bar dataKey="others" stackId="a" fill="#8b5cf6" name="Others" radius={[0, 0, 0, 0]} />
                <Bar dataKey="user" stackId="a" fill="#3b82f6" name="You" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* By Day of Week */}
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 animate-fade-in stagger-4 opacity-0">
          <h2 className="text-lg font-display font-semibold text-dark-100 mb-6">
            Messages by Day of Week
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" />
                <XAxis
                  dataKey="day"
                  stroke="#565869"
                  tick={{ fill: '#acacbe', fontSize: 11 }}
                />
                <YAxis
                  stroke="#565869"
                  tick={{ fill: '#acacbe', fontSize: 11 }}
                  tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e1e22',
                    border: '1px solid #2a2a32',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => value.toLocaleString()}
                />
                <Legend />
                <Bar dataKey="others" stackId="a" fill="#8b5cf6" name="Others" radius={[0, 0, 0, 0]} />
                <Bar dataKey="user" stackId="a" fill="#3b82f6" name="You" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* User vs Others breakdown */}
      <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 animate-fade-in">
        <h2 className="text-lg font-display font-semibold text-dark-100 mb-6">
          Your Activity vs Others
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {dailyData.map(({ day, user, others, total }) => (
            <div key={day} className="text-center">
              <p className="text-dark-400 text-sm mb-2">{day}</p>
              <div className="h-24 flex flex-col justify-end items-center gap-1">
                <div
                  className="w-full bg-gradient-to-t from-accent-blue to-accent-blue/50 rounded-t"
                  style={{
                    height: `${Math.max(1, (user / Math.max(...dailyData.map(d => d.total), 1)) * 80)}%`,
                  }}
                />
                <div
                  className="w-full bg-gradient-to-t from-accent-purple to-accent-purple/50 rounded-t -mt-1"
                  style={{
                    height: `${Math.max(1, (others / Math.max(...dailyData.map(d => d.total), 1)) * 80)}%`,
                  }}
                />
              </div>
              <p className="text-dark-300 text-sm mt-2">
                {total.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-accent-blue" />
            <span className="text-xs text-dark-400">You</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-accent-purple" />
            <span className="text-xs text-dark-400">Others</span>
          </div>
        </div>
      </div>
    </div>
  );
}
