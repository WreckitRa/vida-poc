"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAccount, loadOrCreateSession } from "@/lib/memory";
import { getAccountDisplay, accountFromDisplay } from "@/lib/storage";
import { RESTAURANTS } from "@/lib/restaurants";
import type { Account, AccountDisplay, Session } from "@/types";

export default function InsightsPage() {
  const router = useRouter();
  const [selectedAccount, setSelectedAccount] = useState<AccountDisplay>("Danny");
  const [session, setSession] = useState<Session | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showOnlyUserMessages, setShowOnlyUserMessages] = useState(false);

  // Load session and debug info when account changes
  useEffect(() => {
    const account = accountFromDisplay(selectedAccount);
    const loadedSession = loadOrCreateSession(account);
    setSession(loadedSession);

    // Load debug info from localStorage
    const debugKey = `debug:${account}`;
    const storedDebug = localStorage.getItem(debugKey);
    if (storedDebug) {
      try {
        setDebugInfo(JSON.parse(storedDebug));
      } catch {
        setDebugInfo(null);
      }
    } else {
      setDebugInfo(null);
    }
  }, [selectedAccount]);

  const account: Account = accountFromDisplay(selectedAccount);

  const filteredMessages = session?.messages.filter(
    (msg) => !showOnlyUserMessages || msg.role === "user"
  ) || [];

  const lastBookedRestaurant = session?.profile.lastBookedRestaurantId
    ? RESTAURANTS.find((r) => r.id === session.profile.lastBookedRestaurantId)
    : null;

  const pendingRestaurant = session?.state.pendingBooking
    ? RESTAURANTS.find((r) => r.id === session.state.pendingBooking?.restaurantId)
    : null;

  const testInputs = [
    "romantic italian tonight in Beirut, mid budget",
    "upscale japanese sushi, high budget, intimate vibe",
    "book",
    "casual pizza place for 4 people",
    "vegetarian options, downtown area",
    "what's the weather like?",
  ];

  const handleTestInput = (text: string) => {
    // Copy to clipboard
    navigator.clipboard.writeText(text);
    
    // Navigate to chat with prefill
    router.push(`/chat?prefill=${encodeURIComponent(text)}`);
  };

  const generateExplanation = () => {
    if (!debugInfo?.interpretation || !debugInfo?.planner) {
      return "No decision trace available.";
    }

    const interpretation = debugInfo.interpretation;
    const planner = debugInfo.planner;
    const confidence = interpretation.confidence;
    const classification = interpretation.classification;
    const action = planner.action;

    let explanation = `Based on interpretation confidence ${confidence.toFixed(2)} and classification "${classification}", `;

    // Check missing fields
    const missingFields: string[] = [];
    if (!session?.profile.preferences.cuisines?.length) missingFields.push("cuisines");
    if (!session?.profile.preferences.budget) missingFields.push("budget");
    if (!session?.profile.preferences.vibe?.length) missingFields.push("vibe");
    if (!session?.profile.preferences.location) missingFields.push("location");

    if (missingFields.length > 0) {
      explanation += `missing fields (${missingFields.join(", ")}), `;
    } else {
      explanation += "all required fields present, ";
    }

    explanation += `the planner chose action "${action}".`;

    if (planner.reason) {
      explanation += ` Reason: ${planner.reason}`;
    }

    return explanation;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-7xl mx-auto flex gap-6">
          <Link href="/" className="text-[#075E54] font-semibold text-lg">
            <span className="font-bold text-xl">Vida</span>
          </Link>
          <div className="flex gap-4 ml-auto">
            <Link href="/" className="text-gray-600 hover:text-[#075E54] transition-colors">
              Home
            </Link>
            <Link href="/chat" className="text-gray-600 hover:text-[#075E54] transition-colors">
              Chat
            </Link>
            <Link href="/restaurants" className="text-gray-600 hover:text-[#075E54] transition-colors">
              Restaurants
            </Link>
            <Link href="/insights" className="text-[#075E54] font-semibold">
              Insights
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Agent Insights</h1>
            <p className="text-gray-600">Transparency into Vida's decision-making process</p>
          </div>
          
          {/* Account Selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedAccount("Danny")}
              className={`px-4 py-2 rounded-lg transition-all ${
                selectedAccount === "Danny"
                  ? "whatsapp-green text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              Danny
            </button>
            <button
              onClick={() => setSelectedAccount("Raphael")}
              className={`px-4 py-2 rounded-lg transition-all ${
                selectedAccount === "Raphael"
                  ? "whatsapp-green text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              Raphael
            </button>
          </div>
        </div>

        {!session ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <span className="text-3xl">💭</span>
            </div>
            <p className="text-gray-600 text-lg">No session data found for {selectedAccount}.</p>
            <p className="text-sm text-gray-500 mt-2">Start a conversation in Chat to see insights.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 1. Memory Summary */}
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Memory Summary</h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-300 mb-3">Preferences:</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {session.profile.preferences.cuisines && session.profile.preferences.cuisines.length > 0 && (
                      <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                        <span className="text-gray-600">Cuisines:</span>{" "}
                        <span className="font-medium text-gray-800">{session.profile.preferences.cuisines.join(", ")}</span>
                      </div>
                    )}
                    {session.profile.preferences.budget && (
                      <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                        <span className="text-gray-600">Budget:</span>{" "}
                        <span className="font-medium text-gray-800">{session.profile.preferences.budget}</span>
                      </div>
                    )}
                    {session.profile.preferences.vibe && session.profile.preferences.vibe.length > 0 && (
                      <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                        <span className="text-gray-600">Vibe:</span>{" "}
                        <span className="font-medium text-gray-800">{session.profile.preferences.vibe.join(", ")}</span>
                      </div>
                    )}
                    {session.profile.preferences.dietary && session.profile.preferences.dietary.length > 0 && (
                      <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                        <span className="text-gray-600">Dietary:</span>{" "}
                        <span className="font-medium text-gray-800">{session.profile.preferences.dietary.join(", ")}</span>
                      </div>
                    )}
                    {session.profile.preferences.location && (
                      <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                        <span className="text-gray-600">Location:</span>{" "}
                        <span className="font-medium text-gray-800">{session.profile.preferences.location}</span>
                      </div>
                    )}
                    {session.profile.preferences.partySize && (
                      <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                        <span className="text-gray-600">Party Size:</span>{" "}
                        <span className="font-medium text-gray-800">{session.profile.preferences.partySize}</span>
                      </div>
                    )}
                    {session.profile.preferences.time && (
                      <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                        <span className="text-gray-600">Time:</span>{" "}
                        <span className="font-medium text-gray-800">{session.profile.preferences.time}</span>
                      </div>
                    )}
                  </div>
                  {Object.keys(session.profile.preferences).length === 0 && (
                    <p className="text-gray-500 text-sm">No preferences set yet.</p>
                  )}
                </div>

                {session.profile.dislikes && session.profile.dislikes.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2">Dislikes:</h3>
                    <p className="text-sm text-gray-700">{session.profile.dislikes.join(", ")}</p>
                  </div>
                )}

                {lastBookedRestaurant && (
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2">Last Booked:</h3>
                    <p className="text-sm">
                      <span className="font-medium text-gray-800">{lastBookedRestaurant.name}</span>{" "}
                      <span className="text-gray-500">({session.profile.lastBookedRestaurantId})</span>
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* 2. State */}
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">State</h2>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-gray-600">Turns:</span>{" "}
                  <span className="font-medium text-gray-800">{session.state.turns}</span>
                </div>
                <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-gray-600">Confidence:</span>{" "}
                  <span className="font-medium text-gray-800">{session.state.confidence.toFixed(2)}</span>
                </div>
                {session.state.lastAction && (
                  <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-gray-600">Last Action:</span>{" "}
                    <span className="font-medium text-[#075E54]">{session.state.lastAction}</span>
                  </div>
                )}
                {pendingRestaurant && (
                  <div className="px-3 py-2 bg-[#DCF8C6] rounded-lg border border-[#25D366]/30">
                    <span className="text-[#128C7E]">Pending Booking:</span>{" "}
                    <span className="font-medium text-gray-800">{pendingRestaurant.name}</span>
                  </div>
                )}
                {!session.state.pendingBooking && (
                  <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-gray-600">Pending Booking:</span>{" "}
                    <span className="text-gray-500">None</span>
                  </div>
                )}
              </div>
            </section>

            {/* 3. Conversation Timeline */}
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">Conversation Timeline</h2>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={showOnlyUserMessages}
                    onChange={(e) => setShowOnlyUserMessages(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Show only user messages
                </label>
              </div>

              {filteredMessages.length === 0 ? (
                <p className="text-gray-500 text-sm">No messages yet.</p>
              ) : (
                <div className="space-y-3">
                  {filteredMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-4 rounded-lg ${
                        message.role === "user"
                          ? "whatsapp-sent border-l-4 border-[#25D366]"
                          : "whatsapp-received border-l-4 border-gray-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm text-gray-800">
                          {message.role === "user" ? "User" : "Vida AI"}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(message.ts).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{message.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 4. Agent Decision Trace */}
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Agent Decision Trace</h2>

              {!debugInfo ? (
                <p className="text-gray-600 text-sm">No decision trace available. Make a request in Chat to see agent decisions.</p>
              ) : (
                <div className="space-y-4">
                  {/* Explanation */}
                  <div className="bg-[#DCF8C6] border border-[#25D366]/30 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-2">Explanation</h3>
                    <p className="text-sm text-gray-700">{generateExplanation()}</p>
                  </div>

                  {/* Interpretation */}
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-2">Interpretation</h3>
                    <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-xs text-gray-700 border border-gray-200">
                      {JSON.stringify(debugInfo.interpretation, null, 2)}
                    </pre>
                  </div>

                  {/* Planner */}
                  {debugInfo.planner && (
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-2">Planner</h3>
                      <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-xs text-gray-700 border border-gray-200">
                        {JSON.stringify(debugInfo.planner, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Plan */}
                  {debugInfo.plan && (
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-2">Plan</h3>
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
                        {debugInfo.plan}
                      </p>
                    </div>
                  )}

                  {/* Chosen Restaurants */}
                  {debugInfo.candidates && debugInfo.candidates.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-2">Chosen Restaurants</h3>
                      <div className="space-y-2">
                        {debugInfo.candidates.map((candidate: any, index: number) => (
                          <div
                            key={index}
                            className="bg-gray-50 p-3 rounded-lg flex items-center justify-between border border-gray-200"
                          >
                            <span className="font-medium text-sm text-gray-800">{candidate.name}</span>
                            <span className="text-xs text-[#075E54]">Score: {candidate.score}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* 5. Test Panel */}
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Test Panel</h2>
              <p className="text-sm text-gray-600 mb-4">
                Click a test input to copy it and navigate to Chat with it prefilled.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {testInputs.map((input, index) => (
                  <button
                    key={index}
                    onClick={() => handleTestInput(input)}
                    className="px-4 py-2.5 text-sm bg-gray-50 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors text-left border border-gray-200 hover:border-[#25D366]"
                  >
                    {input}
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

