import { Heart, Send } from "lucide-react";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import StatCard from "../components/StatCard";
import { useFilters } from "../context/FilterContext";
import type { TelegramData } from "../types";

interface ReactionsProps {
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

export default function Reactions({ data }: ReactionsProps) {
  const { reactions } = data;
  const { filteredChats } = useFilters();

  const filteredChatIds = useMemo(
    () => new Set(filteredChats.map((c) => c.chat_id.toString())),
    [filteredChats]
  );

  // Identify the user's name from chat summaries
  // The user is identified as the sender with from_id starting with "user" in chats where user_messages > 0
  const userName = useMemo(() => {
    for (const chat of filteredChats) {
      if (chat.user_messages > 0 && chat.senders) {
        for (const [name, senderData] of Object.entries(chat.senders)) {
          if (senderData.from_id && senderData.from_id.startsWith("user")) {
            return name;
          }
        }
      }
    }
    return null;
  }, [filteredChats]);

  // Total reactions given/received (filtered)
  const totals = useMemo(() => {
    let given = 0;
    let received = 0;

    Object.entries(reactions.reactions_given_by_user).forEach(
      ([chatId, emojis]) => {
        if (filteredChatIds.has(chatId)) {
          Object.values(emojis).forEach((count) => {
            given += count;
          });
        }
      }
    );

    Object.entries(reactions.reactions_received_by_user).forEach(
      ([chatId, emojis]) => {
        if (filteredChatIds.has(chatId)) {
          Object.values(emojis).forEach((count) => {
            received += count;
          });
        }
      }
    );

    return { given, received };
  }, [reactions, filteredChatIds]);

  // Top emojis you give (filtered)
  const topGiven = useMemo(() => {
    const combined: Record<string, number> = {};
    Object.entries(reactions.reactions_given_by_user).forEach(
      ([chatId, emojis]) => {
        if (filteredChatIds.has(chatId)) {
          Object.entries(emojis).forEach(([emoji, count]) => {
            combined[emoji] = (combined[emoji] || 0) + count;
          });
        }
      }
    );
    return Object.entries(combined)
      .map(([emoji, count]) => ({ emoji, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [reactions, filteredChatIds]);

  // Top emojis you receive (filtered)
  const topReceived = useMemo(() => {
    const combined: Record<string, number> = {};
    Object.entries(reactions.reactions_received_by_user).forEach(
      ([chatId, emojis]) => {
        if (filteredChatIds.has(chatId)) {
          Object.entries(emojis).forEach(([emoji, count]) => {
            combined[emoji] = (combined[emoji] || 0) + count;
          });
        }
      }
    );
    return Object.entries(combined)
      .map(([emoji, count]) => ({ emoji, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [reactions, filteredChatIds]);

  // Top reaction senders (filtered) - exclude the user
  const topSenders = useMemo(() => {
    const combined: Record<string, number> = {};
    Object.entries(reactions.reaction_senders_by_chat).forEach(
      ([chatId, senders]) => {
        if (filteredChatIds.has(chatId)) {
          Object.entries(senders).forEach(([name, count]) => {
            // Filter out the user
            if (name !== userName) {
              combined[name] = (combined[name] || 0) + count;
            }
          });
        }
      }
    );
    return Object.entries(combined)
      .map(([name, count]) => ({
        name: name.length > 20 ? name.slice(0, 20) + "..." : name,
        fullName: name,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [reactions, filteredChatIds, userName]);

  // Reactions by chat (filtered) - split into given and received
  const reactionsByChat = useMemo(() => {
    const chatNames = new Map(
      filteredChats.map((c) => [c.chat_id.toString(), c.chat_name || "Unknown"])
    );

    const chatData: Record<string, { given: number; received: number }> = {};

    // Calculate reactions given by chat
    Object.entries(reactions.reactions_given_by_user).forEach(
      ([chatId, emojis]) => {
        if (filteredChatIds.has(chatId)) {
          const total = Object.values(emojis).reduce(
            (sum, count) => sum + count,
            0
          );
          if (!chatData[chatId]) {
            chatData[chatId] = { given: 0, received: 0 };
          }
          chatData[chatId].given = total;
        }
      }
    );

    // Calculate reactions received by chat
    Object.entries(reactions.reactions_received_by_user).forEach(
      ([chatId, emojis]) => {
        if (filteredChatIds.has(chatId)) {
          const total = Object.values(emojis).reduce(
            (sum, count) => sum + count,
            0
          );
          if (!chatData[chatId]) {
            chatData[chatId] = { given: 0, received: 0 };
          }
          chatData[chatId].received = total;
        }
      }
    );

    return Object.entries(chatData)
      .map(([chatId, data]) => {
        const name = chatNames.get(chatId) || `Chat ${chatId}`;
        const total = data.given + data.received;
        return {
          chatId,
          name: name.slice(0, 15),
          fullName: name,
          given: data.given,
          received: data.received,
          total,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);
  }, [reactions, filteredChatIds, filteredChats]);

  // Reactions per 1000 messages by chat (filtered) - split into given and received
  const reactionsPer1000Messages = useMemo(() => {
    const chatNames = new Map(
      filteredChats.map((c) => [c.chat_id.toString(), c.chat_name || "Unknown"])
    );
    const chatMessages = new Map(
      filteredChats.map((c) => [c.chat_id.toString(), c.total_messages])
    );

    const chatData: Record<string, { given: number; received: number }> = {};

    // Calculate reactions given by chat
    Object.entries(reactions.reactions_given_by_user).forEach(
      ([chatId, emojis]) => {
        if (filteredChatIds.has(chatId)) {
          const total = Object.values(emojis).reduce(
            (sum, count) => sum + count,
            0
          );
          if (!chatData[chatId]) {
            chatData[chatId] = { given: 0, received: 0 };
          }
          chatData[chatId].given = total;
        }
      }
    );

    // Calculate reactions received by chat
    Object.entries(reactions.reactions_received_by_user).forEach(
      ([chatId, emojis]) => {
        if (filteredChatIds.has(chatId)) {
          const total = Object.values(emojis).reduce(
            (sum, count) => sum + count,
            0
          );
          if (!chatData[chatId]) {
            chatData[chatId] = { given: 0, received: 0 };
          }
          chatData[chatId].received = total;
        }
      }
    );

    return Object.entries(chatData)
      .map(([chatId, data]) => {
        const totalMessages = chatMessages.get(chatId) || 0;
        const givenPer1000 =
          totalMessages > 0 ? (data.given / totalMessages) * 1000 : 0;
        const receivedPer1000 =
          totalMessages > 0 ? (data.received / totalMessages) * 1000 : 0;
        const totalPer1000 = givenPer1000 + receivedPer1000;
        const name = chatNames.get(chatId) || `Chat ${chatId}`;
        return {
          chatId,
          name: name.slice(0, 15),
          fullName: name,
          givenPer1000: Math.round(givenPer1000 * 100) / 100,
          receivedPer1000: Math.round(receivedPer1000 * 100) / 100,
          per1000: Math.round(totalPer1000 * 100) / 100,
          totalReactions: data.given + data.received,
          totalMessages,
        };
      })
      .filter((item) => item.totalMessages > 0) // Only include chats with messages
      .sort((a, b) => b.per1000 - a.per1000)
      .slice(0, 15);
  }, [reactions, filteredChatIds, filteredChats]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-display font-bold text-dark-100 mb-2">
          Reactions
        </h1>
        <p className="text-dark-400">
          Analyze emoji reactions given and received
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in stagger-1 opacity-0">
        <StatCard
          title="Reactions Given"
          value={totals.given}
          icon={<Send className="w-5 h-5" />}
        />
        <StatCard
          title="Reactions Received"
          value={totals.received}
          icon={<Heart className="w-5 h-5" />}
        />
      </div>

      {/* Emoji Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Given */}
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 animate-fade-in stagger-2 opacity-0">
          <h2 className="text-lg font-display font-semibold text-dark-100 mb-6">
            Top Emojis You Give
          </h2>
          {topGiven.length === 0 ? (
            <p className="text-dark-500 text-center py-8">No reactions data</p>
          ) : (
            <div className="space-y-3">
              {topGiven.map(({ emoji, count }, index) => {
                const maxCount = topGiven[0]?.count || 1;
                const percentage = (count / maxCount) * 100;
                return (
                  <div key={emoji} className="flex items-center gap-3">
                    <span className="text-2xl w-10 text-center">{emoji}</span>
                    <div className="flex-1">
                      <div className="h-6 bg-dark-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: COLORS[index % COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-sm text-dark-300 w-12 text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Received */}
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 animate-fade-in stagger-3 opacity-0">
          <h2 className="text-lg font-display font-semibold text-dark-100 mb-6">
            Top Emojis You Receive
          </h2>
          {topReceived.length === 0 ? (
            <p className="text-dark-500 text-center py-8">No reactions data</p>
          ) : (
            <div className="space-y-3">
              {topReceived.map(({ emoji, count }, index) => {
                const maxCount = topReceived[0]?.count || 1;
                const percentage = (count / maxCount) * 100;
                return (
                  <div key={emoji} className="flex items-center gap-3">
                    <span className="text-2xl w-10 text-center">{emoji}</span>
                    <div className="flex-1">
                      <div className="h-6 bg-dark-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: COLORS[index % COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-sm text-dark-300 w-12 text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top Reaction Senders */}
      <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 animate-fade-in">
        <h2 className="text-lg font-display font-semibold text-dark-100 mb-6">
          Who Sends the Most Reactions
        </h2>
        {topSenders.length === 0 ? (
          <p className="text-dark-500 text-center py-8">No reactions data</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topSenders} layout="vertical">
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
                  width={140}
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
                    "Reactions",
                  ]}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {topSenders.map((_, index) => (
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

      {/* Reactions by Chat */}
      {reactionsByChat.length > 0 && (
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 animate-fade-in">
          <h2 className="text-lg font-display font-semibold text-dark-100 mb-6">
            Total Reactions by Chat
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reactionsByChat}>
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
                  formatter={(value: number, name: string) => [
                    value.toLocaleString(),
                    name,
                  ]}
                />
                <Legend
                  wrapperStyle={{ paddingTop: "20px" }}
                  iconType="rect"
                  formatter={(value) => (
                    <span style={{ color: "#acacbe" }}>{value}</span>
                  )}
                />
                <Bar
                  dataKey="received"
                  name="Reactions Received"
                  stackId="a"
                  fill="#ec4899"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="given"
                  name="Reactions Given"
                  stackId="a"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Reactions per 1000 Messages by Chat */}
      {reactionsPer1000Messages.length > 0 && (
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 animate-fade-in">
          <h2 className="text-lg font-display font-semibold text-dark-100 mb-6">
            Total Reactions by Chat per 1000 Messages
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reactionsPer1000Messages}>
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
                  labelFormatter={(label, payload) => {
                    const data = payload[0]?.payload;
                    return data
                      ? `${
                          data.fullName
                        } (${data.totalReactions.toLocaleString()} reactions, ${data.totalMessages.toLocaleString()} messages)`
                      : label;
                  }}
                  formatter={(value: number, name: string) => [
                    value.toFixed(2),
                    name,
                  ]}
                />
                <Legend
                  wrapperStyle={{ paddingTop: "20px" }}
                  iconType="rect"
                  formatter={(value) => (
                    <span style={{ color: "#acacbe" }}>{value}</span>
                  )}
                />
                <Bar
                  dataKey="receivedPer1000"
                  name="Reactions Received per 1000 Messages"
                  stackId="a"
                  fill="#ec4899"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="givenPer1000"
                  name="Reactions Given per 1000 Messages"
                  stackId="a"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
