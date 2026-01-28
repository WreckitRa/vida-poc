"use client";

import type { Message } from "@/types";

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-1 px-4`}>
      <div
        className={`max-w-[65%] rounded-lg px-2 py-1 shadow-sm ${
          isUser
            ? "whatsapp-sent rounded-tr-none"
            : "whatsapp-received rounded-tl-none"
        }`}
      >
        <p className="text-sm whitespace-pre-wrap leading-relaxed mb-0.5">{message.text}</p>
        <div className={`flex justify-end gap-1 ${isUser ? "text-[#667781]" : "text-[#667781]"}`}>
          <span className="text-[10px] leading-none">
            {new Date(message.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isUser && (
            <span className="text-[10px] leading-none">✓✓</span>
          )}
        </div>
      </div>
    </div>
  );
}

