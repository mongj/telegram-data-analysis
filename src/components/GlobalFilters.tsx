import { useState, useMemo, useEffect } from 'react';
import { Calendar, Filter, ChevronDown, X, Check, Minus } from 'lucide-react';
import { useFilters } from '../context/FilterContext';

// Checkbox with 3 states: checked, unchecked, indeterminate
function TriStateCheckbox({ 
  state 
}: { 
  state: 'checked' | 'unchecked' | 'indeterminate' 
}) {
  return (
    <div
      className={`w-4 h-4 rounded border flex items-center justify-center ${
        state === 'unchecked'
          ? 'border-dark-500'
          : 'bg-accent-blue border-accent-blue'
      }`}
    >
      {state === 'checked' && <Check className="w-3 h-3 text-white" />}
      {state === 'indeterminate' && <Minus className="w-3 h-3 text-white" />}
    </div>
  );
}

export default function GlobalFilters() {
  const {
    filters,
    setDateRange,
    setChatTypes,
    setSelectedChatIds,
    allChatTypes,
    chatSummary,
    filteredChats,
  } = useFilters();

  const [showChatTypes, setShowChatTypes] = useState(false);
  const [showChats, setShowChats] = useState(false);
  const [chatSearch, setChatSearch] = useState('');

  // Chats filtered by type for selection
  const availableChats = useMemo(() => 
    chatSummary
      .filter((c) => filters.chatTypes.length === 0 || filters.chatTypes.includes(c.chat_type))
      .sort((a, b) => b.total_messages - a.total_messages),
    [chatSummary, filters.chatTypes]
  );

  const availableChatIds = useMemo(() => 
    new Set(availableChats.map(c => c.chat_id)),
    [availableChats]
  );

  const searchedChats = useMemo(() => 
    availableChats.filter((c) =>
      (c.chat_name || '').toLowerCase().includes(chatSearch.toLowerCase())
    ),
    [availableChats, chatSearch]
  );

  // Auto-select all available chats when chat types change
  useEffect(() => {
    const availableIds = availableChats.map(c => c.chat_id);
    setSelectedChatIds(availableIds);
  }, [filters.chatTypes, availableChats.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Chat Types select all state
  const chatTypesSelectAllState = useMemo(() => {
    if (filters.chatTypes.length === 0) return 'unchecked';
    if (filters.chatTypes.length === allChatTypes.length) return 'checked';
    return 'indeterminate';
  }, [filters.chatTypes, allChatTypes]);

  // Chats select all state
  const chatsSelectAllState = useMemo(() => {
    const selectedInAvailable = filters.selectedChatIds.filter(id => availableChatIds.has(id));
    if (selectedInAvailable.length === 0) return 'unchecked';
    if (selectedInAvailable.length === availableChats.length) return 'checked';
    return 'indeterminate';
  }, [filters.selectedChatIds, availableChats, availableChatIds]);

  const toggleChatType = (type: string) => {
    if (filters.chatTypes.includes(type)) {
      setChatTypes(filters.chatTypes.filter((t) => t !== type));
    } else {
      setChatTypes([...filters.chatTypes, type]);
    }
  };

  const toggleAllChatTypes = () => {
    if (chatTypesSelectAllState === 'checked') {
      setChatTypes([]);
    } else {
      setChatTypes([...allChatTypes]);
    }
  };

  const toggleChat = (chatId: number) => {
    if (filters.selectedChatIds.includes(chatId)) {
      setSelectedChatIds(filters.selectedChatIds.filter((id) => id !== chatId));
    } else {
      setSelectedChatIds([...filters.selectedChatIds, chatId]);
    }
  };

  const toggleAllChats = () => {
    if (chatsSelectAllState === 'checked') {
      // Deselect all available chats
      setSelectedChatIds(filters.selectedChatIds.filter(id => !availableChatIds.has(id)));
    } else {
      // Select all available chats
      const otherSelected = filters.selectedChatIds.filter(id => !availableChatIds.has(id));
      setSelectedChatIds([...otherSelected, ...availableChats.map(c => c.chat_id)]);
    }
  };

  const formatChatType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const selectedChatsInView = filters.selectedChatIds.filter(id => availableChatIds.has(id));

  return (
    <div className="bg-dark-900 border-b border-dark-700 px-6 py-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* Date Range */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-dark-500" />
          <input
            type="date"
            value={filters.dateRange.start}
            onChange={(e) => setDateRange(e.target.value, filters.dateRange.end)}
            className="px-3 py-1.5 bg-dark-800 border border-dark-600 rounded-md text-sm text-dark-200 focus:outline-none focus:border-accent-blue"
          />
          <span className="text-dark-500">to</span>
          <input
            type="date"
            value={filters.dateRange.end}
            onChange={(e) => setDateRange(filters.dateRange.start, e.target.value)}
            className="px-3 py-1.5 bg-dark-800 border border-dark-600 rounded-md text-sm text-dark-200 focus:outline-none focus:border-accent-blue"
          />
        </div>

        {/* Chat Types */}
        <div className="relative">
          <button
            onClick={() => setShowChatTypes(!showChatTypes)}
            className="flex items-center gap-2 px-3 py-1.5 bg-dark-800 border border-dark-600 rounded-md text-sm hover:border-dark-500 transition-colors"
          >
            <Filter className="w-4 h-4 text-dark-500" />
            <span className="text-dark-300">
              {filters.chatTypes.length === 0
                ? 'No Types'
                : filters.chatTypes.length === allChatTypes.length
                ? 'All Types'
                : filters.chatTypes.length === 1
                ? formatChatType(filters.chatTypes[0])
                : `${filters.chatTypes.length} types`}
            </span>
            <ChevronDown className={`w-4 h-4 text-dark-500 transition-transform ${showChatTypes ? 'rotate-180' : ''}`} />
          </button>

          {showChatTypes && (
            <>
              <div 
                className="fixed inset-0" 
                style={{ zIndex: 2147483646 }}
                onClick={() => setShowChatTypes(false)} 
              />
              <div 
                className="absolute top-full left-0 mt-1 bg-dark-800 border border-dark-600 rounded-lg shadow-xl min-w-48 py-1"
                style={{ zIndex: 2147483647 }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Select All */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAllChatTypes();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-left text-sm hover:bg-dark-700 transition-colors border-b border-dark-700"
                >
                  <TriStateCheckbox state={chatTypesSelectAllState} />
                  <span className="text-dark-200 font-medium">Select All</span>
                </button>

                {allChatTypes.map((type) => (
                  <button
                    key={type}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleChatType(type);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-left text-sm hover:bg-dark-700 transition-colors"
                  >
                    <TriStateCheckbox state={filters.chatTypes.includes(type) ? 'checked' : 'unchecked'} />
                    <span className="text-dark-300">{formatChatType(type)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Chat Selection */}
        <div className="relative">
          <button
            onClick={() => setShowChats(!showChats)}
            className="flex items-center gap-2 px-3 py-1.5 bg-dark-800 border border-dark-600 rounded-md text-sm hover:border-dark-500 transition-colors"
          >
            <span className="text-dark-300">
              {selectedChatsInView.length === 0
                ? 'No Chats'
                : selectedChatsInView.length === availableChats.length
                ? `All Chats (${availableChats.length})`
                : `${selectedChatsInView.length}/${availableChats.length} chats`}
            </span>
            <ChevronDown className={`w-4 h-4 text-dark-500 transition-transform ${showChats ? 'rotate-180' : ''}`} />
          </button>

          {showChats && (
            <>
              <div 
                className="fixed inset-0" 
                style={{ zIndex: 2147483646 }}
                onClick={() => setShowChats(false)} 
              />
              <div 
                className="absolute top-full left-0 mt-1 bg-dark-800 border border-dark-600 rounded-lg shadow-xl w-72"
                style={{ zIndex: 2147483647 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-2 border-b border-dark-700">
                  <input
                    type="text"
                    value={chatSearch}
                    onChange={(e) => setChatSearch(e.target.value)}
                    placeholder="Search chats..."
                    className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-md text-sm text-dark-200 placeholder-dark-500 focus:outline-none focus:border-accent-blue"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {/* Select All */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAllChats();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-dark-700 transition-colors border-b border-dark-700"
                >
                  <TriStateCheckbox state={chatsSelectAllState} />
                  <span className="text-dark-200 font-medium">Select All ({availableChats.length})</span>
                </button>

                <div className="max-h-64 overflow-y-auto py-1">
                  {searchedChats.slice(0, 50).map((chat) => (
                    <button
                      key={chat.chat_id}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleChat(chat.chat_id);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-dark-700 transition-colors"
                    >
                      <TriStateCheckbox 
                        state={filters.selectedChatIds.includes(chat.chat_id) ? 'checked' : 'unchecked'} 
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-dark-200 truncate">{chat.chat_name || 'Unknown'}</p>
                        <p className="text-xs text-dark-500">{chat.total_messages.toLocaleString()} msgs</p>
                      </div>
                    </button>
                  ))}
                </div>
                {filters.selectedChatIds.length > 0 && (
                  <div className="p-2 border-t border-dark-700">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedChatIds([]);
                      }}
                      className="w-full px-3 py-1.5 text-sm text-dark-500 hover:text-accent-pink transition-colors"
                    >
                      Clear selection
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Active filter count */}
        <div className="text-sm text-dark-500">
          Showing <span className="text-dark-300">{filteredChats.length}</span> chats
        </div>

        {/* Selected chat tags */}
        {selectedChatsInView.length > 0 && selectedChatsInView.length <= 5 && selectedChatsInView.length < availableChats.length && (
          <div className="flex flex-wrap gap-1">
            {selectedChatsInView.map((id) => {
              const chat = chatSummary.find((c) => c.chat_id === id);
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-dark-700 rounded text-xs text-dark-300"
                >
                  {((chat?.chat_name || 'Unknown') as string).slice(0, 15)}
                  <button onClick={() => toggleChat(id)} className="text-dark-500 hover:text-dark-300">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
