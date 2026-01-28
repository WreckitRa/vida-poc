"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAccount } from "@/lib/memory";
import { getAccountDisplay, getProfile, getHistory, saveHistory, getActiveRequest, saveActiveRequest, getMode, saveMode, getPendingSlot, savePendingSlot, getSelectedRestaurantId } from "@/lib/storage";
import type { Message, Account } from "@/types";
import type { ConversationContext } from "@/lib/conversation";
import { initializeConversation, processMessage, getWelcomeMessage } from "@/lib/conversation";
import { processMessageNew } from "@/lib/newConversation";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";

export default function ChatPage() {
  const router = useRouter();
  const [account, setAccountState] = useState<Account | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [context, setContext] = useState<ConversationContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentAccount = getAccount();
    if (!currentAccount) {
      router.push("/");
      return;
    }
    setAccountState(currentAccount);

    // Load profile and initialize conversation
    const profile = getProfile();
    const history = getHistory();
    const convContext = initializeConversation(profile);

    setContext(convContext);
    
    // Initialize new flow state if needed
    const activeRequest = getActiveRequest();
    const mode = getMode();
    const pendingSlot = getPendingSlot();
    
    // If no messages and no active request, initialize new flow
    if (history.length === 0 && !activeRequest.area && mode === "collecting") {
      const emptyRequest = {
        area: null,
        cuisine: null,
        budget: null,
        partySize: null,
        date: null,
        time: null,
        notes: null,
      };
      saveActiveRequest(emptyRequest);
      saveMode("collecting");
      savePendingSlot("area");
      // Don't show welcome message - user must initiate
      setMessages([]);
      saveHistory([]);
    } else {
      setMessages(history);
    }
  }, [router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text: string) => {
    if (isLoading) return;

    setIsLoading(true);

    try {
      // Use new flow
      const result = await processMessageNew(text);
      setMessages(result.messages);
      // Update context for debug panel if needed
      if (context) {
        const newContext = { ...context };
        setContext(newContext);
      }
    } catch (error) {
      console.error("Error processing message:", error);
      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`,
        role: "assistant",
        text: "Sorry, I encountered an error. Please try again.",
        ts: Date.now(),
      };
      const errorMessages = [...messages, errorMessage];
      setMessages(errorMessages);
      saveHistory(errorMessages);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchAccount = () => {
    router.push("/");
  };

  if (!account) {
    return null;
  }

  const accountDisplay = getAccountDisplay(account);

  // Determine which quick-reply chips to show based on new flow
  const getQuickReplyChips = (): string[] => {
    const chips: string[] = [];
    const mode = getMode();
    
    if (mode === "recommending") {
      chips.push("Continue chat", "Pick #1", "Pick #2", "Pick #3");
    } else if (mode === "confirming") {
      chips.push("Skip");
    }
    
    chips.push("reset");
    
    return chips;
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex gap-6 items-center justify-between">
          <div className="flex gap-6 items-center">
            <Link href="/" className="text-[#075E54] font-semibold text-lg">
              <span className="font-bold text-xl">Restaurant Butler</span>
            </Link>
                  <div className="flex gap-4">
                    <Link href="/" className="text-gray-600 hover:text-[#075E54] transition-colors">
                      Home
                    </Link>
                    <Link href="/chat" className="text-[#075E54] font-semibold">
                      Chat
                    </Link>
                  </div>
                </div>
                <div className="flex gap-3 items-center">
                  <button
                    onClick={() => setShowDebug(!showDebug)}
                    className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    title="Toggle debug panel"
                  >
                    {showDebug ? "Hide Debug" : "Show Debug"}
                  </button>
                  <span className="text-sm text-gray-600">
                    Account: <span className="text-[#075E54] font-medium">{accountDisplay}</span>
                  </span>
                  <button
                    onClick={handleSwitchAccount}
                    className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                  >
                    Switch
                  </button>
                </div>
        </div>
      </nav>

      {/* WhatsApp-style Header */}
      <div className="whatsapp-header px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">
            RB
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Restaurant Butler</h1>
            <p className="text-xs text-white/80">Your dining assistant</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Debug Panel */}
        {showDebug && (
          <div className="w-80 bg-gray-50 border-r border-gray-300 overflow-y-auto p-4 text-xs">
            <div className="mb-4">
              <h3 className="font-bold text-sm mb-2 text-gray-800">Debug Panel</h3>
              <button
                onClick={() => setShowDebug(false)}
                className="text-gray-600 hover:text-gray-800 underline"
              >
                Hide
              </button>
            </div>

            {/* Mode */}
            <div className="mb-4 p-2 bg-white rounded border border-gray-200">
              <div className="font-semibold text-gray-700 mb-1">Mode</div>
              <div className="text-gray-900 font-mono">{getMode()}</div>
            </div>

            {/* Pending Slot */}
            <div className="mb-4 p-2 bg-white rounded border border-gray-200">
              <div className="font-semibold text-gray-700 mb-1">Pending Slot</div>
              <div className="text-gray-900 font-mono">{getPendingSlot() || "none"}</div>
            </div>

            {/* Active Request */}
            <div className="mb-4 p-2 bg-white rounded border border-gray-200">
              <div className="font-semibold text-gray-700 mb-1">Active Request</div>
              <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono">
                {JSON.stringify(getActiveRequest(), null, 2)}
              </pre>
            </div>

            {/* Selected Restaurant */}
            {getSelectedRestaurantId() && (
              <div className="mb-4 p-2 bg-white rounded border border-gray-200">
                <div className="font-semibold text-gray-700 mb-1">Selected Restaurant ID</div>
                <div className="text-gray-900 font-mono text-xs">{getSelectedRestaurantId()}</div>
              </div>
            )}

            {/* Profile Summary */}
            <div className="mb-4 p-2 bg-white rounded border border-gray-200">
              <div className="font-semibold text-gray-700 mb-1">Profile Summary</div>
              <div className="text-gray-800 text-xs">
                <div>Budget Default: {getProfile().budgetDefault || "none"}</div>
                <div>Cuisines Liked: {Object.keys(getProfile().cuisinesLiked).length}</div>
                <div>Vibe Prefs: {Object.keys(getProfile().vibePrefs).length}</div>
              </div>
            </div>
          </div>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto whatsapp-bg py-2">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#25D366] flex items-center justify-center text-white text-2xl font-bold">
                    RB
                  </div>
                  <p className="text-gray-600 text-lg">No messages yet</p>
                  <p className="text-gray-500 text-sm mt-2">Start a conversation</p>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <ChatInput 
            onSend={handleSend} 
            disabled={isLoading} 
            quickReplyChips={getQuickReplyChips()}
          />
        </div>
      </div>
    </div>
  );
}
