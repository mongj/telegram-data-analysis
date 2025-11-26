import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import type { ChatSummary } from '../types';

interface ChatSelectorProps {
  chats: ChatSummary[];
  selected: number[];
  onChange: (selected: number[]) => void;
  multi?: boolean;
  placeholder?: string;
}

export default function ChatSelector({
  chats,
  selected,
  onChange,
  multi = false,
  placeholder = 'Select chat...',
}: ChatSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const sortedChats = useMemo(
    () => [...chats].sort((a, b) => b.total_messages - a.total_messages),
    [chats]
  );

  const filteredChats = useMemo(
    () =>
      sortedChats.filter((chat) =>
        (chat.chat_name || '').toLowerCase().includes(search.toLowerCase())
      ),
    [sortedChats, search]
  );

  const selectedChats = useMemo(
    () => chats.filter((c) => selected.includes(c.chat_id)),
    [chats, selected]
  );

  const toggleChat = (chatId: number) => {
    if (multi) {
      if (selected.includes(chatId)) {
        onChange(selected.filter((id) => id !== chatId));
      } else {
        onChange([...selected, chatId]);
      }
    } else {
      onChange([chatId]);
      setIsOpen(false);
    }
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-dark-800 border border-dark-600 rounded-lg text-left hover:border-dark-500 transition-colors"
      >
        <span className="text-sm truncate">
          {selected.length === 0 ? (
            <span className="text-dark-500">{placeholder}</span>
          ) : selected.length === 1 ? (
            selectedChats[0]?.chat_name
          ) : (
            <span className="text-dark-300">
              {selected.length} chats selected
            </span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-dark-500 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Selected tags (multi-select) */}
      {multi && selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selectedChats.slice(0, 5).map((chat) => (
            <span
              key={chat.chat_id}
              className="inline-flex items-center gap-1 px-2 py-1 bg-dark-700 rounded-md text-xs"
            >
              {chat.chat_name}
              <button
                onClick={() => toggleChat(chat.chat_id)}
                className="text-dark-500 hover:text-dark-300"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {selected.length > 5 && (
            <span className="text-xs text-dark-500 py-1">
              +{selected.length - 5} more
            </span>
          )}
          <button
            onClick={clearAll}
            className="text-xs text-dark-500 hover:text-accent-pink py-1"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0"
          style={{ zIndex: 2147483646 }}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Dropdown */}
      {isOpen && (
        <div 
          className="absolute w-full mt-2 bg-dark-800 border border-dark-600 rounded-lg shadow-xl overflow-hidden"
          style={{ zIndex: 2147483647 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search */}
          <div className="p-2 border-b border-dark-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chats..."
                className="w-full pl-9 pr-4 py-2 bg-dark-900 border border-dark-600 rounded-md text-sm text-dark-200 placeholder-dark-500 focus:outline-none focus:border-accent-blue"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Chat list */}
          <div className="max-h-64 overflow-y-auto">
            {filteredChats.length === 0 ? (
              <p className="p-4 text-sm text-dark-500 text-center">
                No chats found
              </p>
            ) : (
              filteredChats.map((chat) => (
                <button
                  key={chat.chat_id}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleChat(chat.chat_id);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-dark-700 transition-colors ${
                    selected.includes(chat.chat_id) ? 'bg-dark-700' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-dark-200 truncate">
                      {chat.chat_name || 'Unknown'}
                    </p>
                    <p className="text-xs text-dark-500">
                      {chat.total_messages.toLocaleString()} messages
                    </p>
                  </div>
                  {selected.includes(chat.chat_id) && (
                    <div className="w-2 h-2 rounded-full bg-accent-blue ml-2" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

