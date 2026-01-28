"use client";

import { useState, useRef } from "react";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  quickReplyChips?: string[];
}

export default function ChatInput({ onSend, disabled, quickReplyChips = [] }: ChatInputProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput("");
      // Keep focus on input after sending
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  const handleChipClick = (chip: string) => {
    if (!disabled) {
      onSend(chip);
      setInput("");
      // Keep focus on input after clicking chip
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  return (
    <div className="bg-[#F0F2F5] border-t border-gray-300">
      {/* Quick reply chips */}
      {quickReplyChips.length > 0 && (
        <div className="px-2 py-2 flex flex-wrap gap-2">
          {quickReplyChips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleChipClick(chip)}
              disabled={disabled}
              className="px-3 py-1.5 text-xs bg-white text-[#075E54] rounded-full border border-[#075E54] hover:bg-[#075E54] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex items-end gap-2 p-2">
        <div className="flex-1 flex items-end gap-2 bg-white rounded-full px-4 py-2 border border-gray-300">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message"
            disabled={disabled}
            className="flex-1 bg-transparent border-none outline-none text-sm text-[#111b21] placeholder-[#667781] disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="w-10 h-10 rounded-full whatsapp-green flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:opacity-90"
          aria-label="Send"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z" fill="white"/>
          </svg>
        </button>
      </form>
    </div>
  );
}
