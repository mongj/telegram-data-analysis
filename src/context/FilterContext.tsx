import { createContext, useContext, useState, useMemo, type ReactNode } from 'react';
import type { ChatSummary } from '../types';

export interface FilterState {
  dateRange: {
    start: string; // YYYY-MM-DD
    end: string;
  };
  chatTypes: string[];
  selectedChatIds: number[]; // empty means all
}

interface FilterContextValue {
  filters: FilterState;
  setDateRange: (start: string, end: string) => void;
  setChatTypes: (types: string[]) => void;
  setSelectedChatIds: (ids: number[]) => void;
  // Derived data
  filteredChats: ChatSummary[];
  allChatTypes: string[];
  chatSummary: ChatSummary[];
  setChatSummary: (chats: ChatSummary[]) => void;
}

const FilterContext = createContext<FilterContextValue | null>(null);

// Get date one year ago
function getDefaultStartDate(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return date.toISOString().split('T')[0];
}

function getDefaultEndDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function FilterProvider({ children }: { children: ReactNode }) {
  const [chatSummary, setChatSummary] = useState<ChatSummary[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    dateRange: {
      start: getDefaultStartDate(),
      end: getDefaultEndDate(),
    },
    chatTypes: ['personal_chat'],
    selectedChatIds: [],
  });

  const setDateRange = (start: string, end: string) => {
    setFilters((prev) => ({ ...prev, dateRange: { start, end } }));
  };

  const setChatTypes = (types: string[]) => {
    setFilters((prev) => ({
      ...prev,
      chatTypes: types,
      selectedChatIds: [], // Reset chat selection when types change
    }));
  };

  const setSelectedChatIds = (ids: number[]) => {
    setFilters((prev) => ({ ...prev, selectedChatIds: ids }));
  };

  // Get all unique chat types
  const allChatTypes = useMemo(() => {
    const types = new Set(chatSummary.map((c) => c.chat_type));
    return Array.from(types).sort();
  }, [chatSummary]);

  // Filter chats by type, then by selection
  const filteredChats = useMemo(() => {
    let filtered = chatSummary.filter((c) =>
      filters.chatTypes.length === 0 || filters.chatTypes.includes(c.chat_type)
    );

    if (filters.selectedChatIds.length > 0) {
      filtered = filtered.filter((c) => filters.selectedChatIds.includes(c.chat_id));
    }

    return filtered;
  }, [chatSummary, filters.chatTypes, filters.selectedChatIds]);

  const value: FilterContextValue = {
    filters,
    setDateRange,
    setChatTypes,
    setSelectedChatIds,
    filteredChats,
    allChatTypes,
    chatSummary,
    setChatSummary,
  };

  return (
    <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within FilterProvider');
  }
  return context;
}

