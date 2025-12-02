import { Mic, Video } from "lucide-react";
import { useMemo } from "react";
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
import { useFilters } from "../context/FilterContext";
import type { TelegramData } from "../types";

interface VideoAudioProps {
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

export default function VideoAudio({ data }: VideoAudioProps) {
  const { filteredChats } = useFilters();

  // Total video and audio messages
  const totals = useMemo(() => {
    let video = 0;
    let audio = 0;

    filteredChats.forEach((chat) => {
      video += chat.media_breakdown?.video_file || 0;
      audio += chat.media_breakdown?.audio_file || 0;
    });

    return { video, audio };
  }, [filteredChats]);

  // Top chats by video messages
  const topVideoChats = useMemo(() => {
    return filteredChats
      .map((chat) => {
        const chatName = chat.chat_name || "Unknown";
        return {
          chatId: chat.chat_id,
          name: chatName.length > 15 ? chatName.slice(0, 15) + "..." : chatName,
          fullName: chatName,
          count: chat.media_breakdown?.video_file || 0,
        };
      })
      .filter((chat) => chat.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [filteredChats]);

  // Top chats by audio messages
  const topAudioChats = useMemo(() => {
    return filteredChats
      .map((chat) => {
        const chatName = chat.chat_name || "Unknown";
        return {
          chatId: chat.chat_id,
          name: chatName.length > 15 ? chatName.slice(0, 15) + "..." : chatName,
          fullName: chatName,
          count: chat.media_breakdown?.audio_file || 0,
        };
      })
      .filter((chat) => chat.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [filteredChats]);

  // Video messages by sender (across all filtered chats)
  const videoSenders = useMemo(() => {
    const senderData: Record<string, number> = {};

    filteredChats.forEach((chat) => {
      if (chat.senders) {
        Object.entries(chat.senders).forEach(([name, sender]) => {
          const count = sender.media_breakdown?.video_file || 0;
          if (count > 0) {
            senderData[name] = (senderData[name] || 0) + count;
          }
        });
      }
    });

    return Object.entries(senderData)
      .map(([name, count]) => ({
        name: name.length > 20 ? name.slice(0, 20) + "..." : name,
        fullName: name,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [filteredChats]);

  // Audio messages by sender (across all filtered chats)
  const audioSenders = useMemo(() => {
    const senderData: Record<string, number> = {};

    filteredChats.forEach((chat) => {
      if (chat.senders) {
        Object.entries(chat.senders).forEach(([name, sender]) => {
          const count = sender.media_breakdown?.audio_file || 0;
          if (count > 0) {
            senderData[name] = (senderData[name] || 0) + count;
          }
        });
      }
    });

    return Object.entries(senderData)
      .map(([name, count]) => ({
        name: name.length > 20 ? name.slice(0, 20) + "..." : name,
        fullName: name,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [filteredChats]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-display font-bold text-dark-100 mb-2">
          Tele Bubbles
        </h1>
        <p className="text-dark-400">
          Analyze video and audio message statistics across your chats
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in stagger-1 opacity-0">
        <StatCard
          title="Video Messages"
          value={totals.video}
          icon={<Video className="w-5 h-5" />}
        />
        <StatCard
          title="Audio Messages"
          value={totals.audio}
          icon={<Mic className="w-5 h-5" />}
        />
      </div>

      {/* Top Chats Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Video Chats */}
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 animate-fade-in stagger-2 opacity-0">
          <h2 className="text-lg font-display font-semibold text-dark-100 mb-6">
            Top Chats by Video Messages
          </h2>
          {topVideoChats.length === 0 ? (
            <p className="text-dark-500 text-center py-8">No video messages</p>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topVideoChats} layout="vertical">
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
                    width={120}
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
                      value.toLocaleString(),
                      "Video Messages",
                    ]}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {topVideoChats.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Top Audio Chats */}
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 animate-fade-in stagger-3 opacity-0">
          <h2 className="text-lg font-display font-semibold text-dark-100 mb-6">
            Top Chats by Audio Messages
          </h2>
          {topAudioChats.length === 0 ? (
            <p className="text-dark-500 text-center py-8">No audio messages</p>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topAudioChats} layout="vertical">
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
                    width={120}
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
                      value.toLocaleString(),
                      "Audio Messages",
                    ]}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {topAudioChats.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Video by Sender */}
      {videoSenders.length > 0 && (
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 animate-fade-in">
          <h2 className="text-lg font-display font-semibold text-dark-100 mb-6">
            Video Messages by Sender
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={videoSenders}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" />
                <XAxis
                  dataKey="name"
                  stroke="#565869"
                  tick={{ fill: "#acacbe", fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  stroke="#565869"
                  tick={{ fill: "#acacbe", fontSize: 11 }}
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
                    value.toLocaleString(),
                    "Video Messages",
                  ]}
                />
                <Bar
                  dataKey="count"
                  name="Video Messages"
                  radius={[4, 4, 0, 0]}
                >
                  {videoSenders.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Audio by Sender */}
      {audioSenders.length > 0 && (
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 animate-fade-in">
          <h2 className="text-lg font-display font-semibold text-dark-100 mb-6">
            Audio Messages by Sender
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={audioSenders}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" />
                <XAxis
                  dataKey="name"
                  stroke="#565869"
                  tick={{ fill: "#acacbe", fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  stroke="#565869"
                  tick={{ fill: "#acacbe", fontSize: 11 }}
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
                    value.toLocaleString(),
                    "Audio Messages",
                  ]}
                />
                <Bar
                  dataKey="count"
                  name="Audio Messages"
                  radius={[4, 4, 0, 0]}
                >
                  {audioSenders.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
