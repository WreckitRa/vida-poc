import type { ActiveRequest, RequestMode, PendingSlot, Message, Restaurant } from "@/types";
import {
  getActiveRequest,
  saveActiveRequest,
  getMode,
  saveMode,
  getPendingSlot,
  savePendingSlot,
  getSelectedRestaurantId,
  saveSelectedRestaurantId,
  getHistory,
  saveHistory,
  addBooking,
} from "./storage";
import { getAvailableAreas } from "./parser";
import { getAvailableCuisines } from "./restaurants";
import { classifyAndExtractClient, validateSlotClient, normalizeToDBClient } from "./gptClient";
import { getTopRestaurants, generateReasons } from "./newRecommender";
import { RESTAURANTS } from "./restaurants";

/**
 * Get next missing slot in priority order
 */
function getNextMissingSlot(request: ActiveRequest): PendingSlot {
  if (!request.area) return "area";
  if (!request.cuisine) return "cuisine";
  if (!request.budget) return "budget";
  if (!request.date) return "date";
  if (!request.time) return "time";
  if (!request.partySize) return "partySize";
  return null;
}

/**
 * Get question text for a slot
 */
function getSlotQuestion(slot: PendingSlot, supportedChoices?: string[]): string {
  switch (slot) {
    case "area":
      return "Which area do you want to eat in?";
    case "cuisine":
      return "What are you in the mood for?";
    case "budget":
      return "What budget are we aiming for?";
    case "date":
      return "Which day?";
    case "time":
      return "What time?";
    case "partySize":
      return "How many people?";
    default:
      return "";
  }
}

/**
 * Process user message with new flow
 */
export async function processMessageNew(userText: string): Promise<{
  response: string;
  messages: Message[];
  recommendations?: { top: Restaurant; alternatives: Restaurant[] };
}> {
  const messages = getHistory();
  const activeRequest = getActiveRequest();
  const mode = getMode();
  const pendingSlot = getPendingSlot();
  const selectedRestaurantId = getSelectedRestaurantId();

  let newRequest = { ...activeRequest };
  let newMode: RequestMode = mode;
  let newPendingSlot: PendingSlot = pendingSlot;
  let response = "";
  let recommendations: { top: Restaurant; alternatives: Restaurant[] } | undefined;

  // Handle reset
  const lower = userText.toLowerCase().trim();
  if (lower === "reset") {
    newRequest = {
      area: null,
      cuisine: null,
      budget: null,
      partySize: null,
      date: null,
      time: null,
      notes: null,
    };
    newMode = "collecting";
    newPendingSlot = "area";
    saveActiveRequest(newRequest);
    saveMode(newMode);
    savePendingSlot(newPendingSlot);
    saveSelectedRestaurantId(null);
    
    const userMsg: Message = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      text: userText,
      ts: Date.now(),
    };
    const assistantMsg: Message = {
      id: `msg-${Date.now()}-assistant`,
      role: "assistant",
      text: "Starting fresh. Which area do you want to eat in?",
      ts: Date.now(),
    };
    const updatedMessages = [...messages, userMsg, assistantMsg];
    saveHistory(updatedMessages);
    return { response: assistantMsg.text, messages: updatedMessages };
  }

  // Handle "Continue chat" in recommending mode
  if (mode === "recommending" && (lower === "continue chat" || lower === "continue")) {
    newMode = "collecting";
    saveMode(newMode);
    
    const userMsg: Message = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      text: userText,
      ts: Date.now(),
    };
    const assistantMsg: Message = {
      id: `msg-${Date.now()}-assistant`,
      role: "assistant",
      text: "What would you like to change?",
      ts: Date.now(),
    };
    const updatedMessages = [...messages, userMsg, assistantMsg];
    saveHistory(updatedMessages);
    return { response: assistantMsg.text, messages: updatedMessages };
  }

  // Handle picking a restaurant (1, 2, 3, "Pick #1", etc.)
  if (mode === "recommending") {
    const pickMatch = lower.match(/^(pick\s*#?\s*)?([123])$/);
    if (pickMatch) {
      const num = parseInt(pickMatch[2]) as 1 | 2 | 3;
      const recs = getTopRestaurants(activeRequest);
      const restaurants = [recs.top, ...recs.alternatives];
      const selected = restaurants[num - 1];
      
      if (selected) {
        const userMsg: Message = {
          id: `msg-${Date.now()}-user`,
          role: "user",
          text: userText,
          ts: Date.now(),
        };
        let assistantText: string;

        if (!selected.bookingAvailable) {
          // Walk-in only: no booking, just tell them they can go and show discount code
          saveSelectedRestaurantId(null);
          newMode = "collecting";
          saveMode(newMode);
          assistantText =
            `You can just head over—no booking needed.` +
            (selected.discountCode
              ? ` Present this code at the door for a discount: **${selected.discountCode}**`
              : "");
        } else {
          saveSelectedRestaurantId(selected.id);
          newMode = "confirming";
          saveMode(newMode);
          const dateStr = activeRequest.date || "your date";
          const timeStr = activeRequest.time || "your time";
          const partyStr = activeRequest.partySize || "your party";
          assistantText = `Cool. Confirming ${selected.name} for ${partyStr} on ${dateStr} at ${timeStr}. Reply 'Skip' to skip, or type your note.`;
        }

        const assistantMsg: Message = {
          id: `msg-${Date.now()}-assistant`,
          role: "assistant",
          text: assistantText,
          ts: Date.now(),
        };
        const updatedMessages = [...messages, userMsg, assistantMsg];
        saveHistory(updatedMessages);
        return { response: assistantMsg.text, messages: updatedMessages };
      }
    }
  }

  // Handle confirming mode - notes
  if (mode === "confirming") {
    // Validate input: only accept "skip" to skip, or non-empty text as a note
    // Reject commands and empty strings
    const trimmed = userText.trim();
    const isSkip = lower === "skip" || lower === "no" || lower === "n";
    const isCommand = /^(pick\s*#?\s*[123]|continue\s+chat|reset)$/i.test(trimmed);
    const isEmpty = trimmed.length === 0;
    
    if (isCommand) {
      // Reject commands - stay in confirming mode and show error
      const userMsg: Message = {
        id: `msg-${Date.now()}-user`,
        role: "user",
        text: userText,
        ts: Date.now(),
      };
      const assistantMsg: Message = {
        id: `msg-${Date.now()}-assistant`,
        role: "assistant",
        text: "Please reply 'Skip' to skip notes, or type your note.",
        ts: Date.now(),
      };
      const updatedMessages = [...messages, userMsg, assistantMsg];
      saveHistory(updatedMessages);
      return { response: assistantMsg.text, messages: updatedMessages };
    }
    
    if (isEmpty && !isSkip) {
      // Reject empty strings - stay in confirming mode and show error
      const userMsg: Message = {
        id: `msg-${Date.now()}-user`,
        role: "user",
        text: userText,
        ts: Date.now(),
      };
      const assistantMsg: Message = {
        id: `msg-${Date.now()}-assistant`,
        role: "assistant",
        text: "Please reply 'Skip' to skip notes, or type your note.",
        ts: Date.now(),
      };
      const updatedMessages = [...messages, userMsg, assistantMsg];
      saveHistory(updatedMessages);
      return { response: assistantMsg.text, messages: updatedMessages };
    }
    
    if (isSkip) {
      newRequest.notes = null;
    } else {
      newRequest.notes = trimmed;
    }
    
    const selectedId = getSelectedRestaurantId();
    if (selectedId) {
      const restaurant = RESTAURANTS.find((r) => r.id === selectedId);
      if (restaurant && activeRequest.date && activeRequest.time && activeRequest.partySize) {
        const booking = {
          id: `booking-${Date.now()}`,
          restaurantId: selectedId,
          date: activeRequest.date,
          time: activeRequest.time,
          partySize: activeRequest.partySize,
          notes: newRequest.notes || undefined,
          ts: Date.now(),
        };
        addBooking(booking);
      }
    }
    
    // Reset for next request
    newRequest = {
      area: null,
      cuisine: null,
      budget: null,
      partySize: null,
      date: null,
      time: null,
      notes: null,
    };
    newMode = "collecting";
    newPendingSlot = "area";
    saveActiveRequest(newRequest);
    saveMode(newMode);
    savePendingSlot(newPendingSlot);
    saveSelectedRestaurantId(null);
    
    const userMsg: Message = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      text: userText,
      ts: Date.now(),
    };
    const assistantMsg: Message = {
      id: `msg-${Date.now()}-assistant`,
      role: "assistant",
      text: "Done. Saved. (POC)",
      ts: Date.now(),
    };
    const updatedMessages = [...messages, userMsg, assistantMsg];
    saveHistory(updatedMessages);
    return { response: assistantMsg.text, messages: updatedMessages };
  }

  // Main flow: classify and extract
  try {
    const classification = await classifyAndExtractClient(userText);

    // Handle greeting/off-topic
    if (classification.intent === "greeting_or_offtopic") {
      const userMsg: Message = {
        id: `msg-${Date.now()}-user`,
        role: "user",
        text: userText,
        ts: Date.now(),
      };
      const assistantMsg: Message = {
        id: `msg-${Date.now()}-assistant`,
        role: "assistant",
        text: "Hey! I'm your restaurant butler. Tell me what you're craving and I'll suggest the best spots from my list.",
        ts: Date.now(),
      };
      const updatedMessages = [...messages, userMsg, assistantMsg];
      saveHistory(updatedMessages);
      return { response: assistantMsg.text, messages: updatedMessages };
    }

    // Extract values
    const extracted = classification.extracted;
    const supportedAreas = getAvailableAreas();
    const supportedCuisines = getAvailableCuisines();

    // If pendingSlot exists, validate with Prompt B first
    let validatedValue: string | number | null = null;
    if (pendingSlot) {
      const supportedChoices =
        pendingSlot === "area" ? supportedAreas : pendingSlot === "cuisine" ? supportedCuisines : undefined;
      const validation = await validateSlotClient(pendingSlot, userText, supportedChoices);
      
      if (validation.confidence > 0.3 && validation.normalized !== null) {
        validatedValue = validation.normalized;
      }
    }

    // Normalize area and cuisine to DB from extracted values
    const dbNormalization = await normalizeToDBClient(
      extracted.area.value,
      extracted.cuisine.value,
      supportedAreas,
      supportedCuisines
    );

    // Check for unavailable area
    if (dbNormalization.unavailable.area && extracted.area.value) {
      const examples = supportedAreas.slice(0, 3).join(", ");
      const userMsg: Message = {
        id: `msg-${Date.now()}-user`,
        role: "user",
        text: userText,
        ts: Date.now(),
      };
      const assistantMsg: Message = {
        id: `msg-${Date.now()}-assistant`,
        role: "assistant",
        text: `I don't have ${extracted.area.value} in my list yet. Want one of these instead: ${examples}?`,
        ts: Date.now(),
      };
      newPendingSlot = "area";
      savePendingSlot(newPendingSlot);
      const updatedMessages = [...messages, userMsg, assistantMsg];
      saveHistory(updatedMessages);
      return { response: assistantMsg.text, messages: updatedMessages };
    }

    // Check for unavailable cuisine
    if (dbNormalization.unavailable.cuisine && extracted.cuisine.value) {
      const examples = supportedCuisines.slice(0, 3).join(", ");
      const userMsg: Message = {
        id: `msg-${Date.now()}-user`,
        role: "user",
        text: userText,
        ts: Date.now(),
      };
      const assistantMsg: Message = {
        id: `msg-${Date.now()}-assistant`,
        role: "assistant",
        text: `I don't have ${extracted.cuisine.value} spots in my list yet. I do have: ${examples}.`,
        ts: Date.now(),
      };
      newPendingSlot = "cuisine";
      savePendingSlot(newPendingSlot);
      const updatedMessages = [...messages, userMsg, assistantMsg];
      saveHistory(updatedMessages);
      return { response: assistantMsg.text, messages: updatedMessages };
    }

    // Apply validated value for pending slot (takes precedence)
    if (pendingSlot && validatedValue !== null) {
      switch (pendingSlot) {
        case "area":
          newRequest.area = validatedValue as string;
          break;
        case "cuisine":
          newRequest.cuisine = validatedValue as string;
          break;
        case "budget":
          const budgetRange = validatedValue as number;
          if (budgetRange >= 1 && budgetRange <= 4) {
            const labels = ["", "low", "medium", "high", "luxury"];
            newRequest.budget = { range: budgetRange as 1 | 2 | 3 | 4, label: labels[budgetRange] };
          }
          break;
        case "partySize":
          newRequest.partySize = validatedValue as number;
          break;
        case "date":
          newRequest.date = validatedValue as string;
          break;
        case "time":
          newRequest.time = validatedValue as string;
          break;
      }
    }

    // Merge extracted values from Prompt A (only if slot not already set and confidence is high)
    if (!newRequest.area && dbNormalization.areaMatch.matched && dbNormalization.areaMatch.confidence > 0.5) {
      newRequest.area = dbNormalization.areaMatch.matched;
    }
    if (!newRequest.cuisine && dbNormalization.cuisineMatch.matched && dbNormalization.cuisineMatch.confidence > 0.5) {
      newRequest.cuisine = dbNormalization.cuisineMatch.matched;
    }
    if (!newRequest.budget && extracted.budget.range) {
      const labels = ["", "low", "medium", "high", "luxury"];
      newRequest.budget = { range: extracted.budget.range, label: labels[extracted.budget.range] };
    }
    if (!newRequest.partySize && extracted.partySize) {
      newRequest.partySize = extracted.partySize;
    }
    if (!newRequest.date && extracted.date.value && extracted.date.confidence > 0.5) {
      newRequest.date = extracted.date.value;
    }
    if (!newRequest.time && extracted.time.value && extracted.time.confidence > 0.5) {
      newRequest.time = extracted.time.value;
    }

    saveActiveRequest(newRequest);

    // Check if all slots are filled
    const nextSlot = getNextMissingSlot(newRequest);
    if (nextSlot === null) {
      // All slots filled - generate recommendations
      const recs = getTopRestaurants(newRequest);
      recommendations = recs;
      newMode = "recommending";
      saveMode(newMode);
      savePendingSlot(null);

      const userMsg: Message = {
        id: `msg-${Date.now()}-user`,
        role: "user",
        text: userText,
        ts: Date.now(),
      };
      
      const topReasons = generateReasons(recs.top, newRequest);
      const alt1Reasons = recs.alternatives[0] ? generateReasons(recs.alternatives[0], newRequest) : [];
      const alt2Reasons = recs.alternatives[1] ? generateReasons(recs.alternatives[1], newRequest) : [];
      
      let recText = `Top pick:\n1) ${recs.top.name} (${recs.top.area}) price: ${recs.top.price === "low" ? "$" : recs.top.price === "mid" ? "$$" : "$$$"} | ${recs.top.cuisines.join(", ")}\n   Why: ${topReasons.join("; ")}\n`;
      if (recs.alternatives[0]) {
        recText += `\nAlternatives:\n2) ${recs.alternatives[0].name} (${recs.alternatives[0].area}) price: ${recs.alternatives[0].price === "low" ? "$" : recs.alternatives[0].price === "mid" ? "$$" : "$$$"} | ${recs.alternatives[0].cuisines.join(", ")}\n   Why: ${alt1Reasons.join("; ")}\n`;
      }
      if (recs.alternatives[1]) {
        recText += `3) ${recs.alternatives[1].name} (${recs.alternatives[1].area}) price: ${recs.alternatives[1].price === "low" ? "$" : recs.alternatives[1].price === "mid" ? "$$" : "$$$"} | ${recs.alternatives[1].cuisines.join(", ")}\n   Why: ${alt2Reasons.join("; ")}\n`;
      }

      const assistantMsg: Message = {
        id: `msg-${Date.now()}-assistant`,
        role: "assistant",
        text: recText,
        ts: Date.now(),
      };
      const updatedMessages = [...messages, userMsg, assistantMsg];
      saveHistory(updatedMessages);
      return { response: assistantMsg.text, messages: updatedMessages, recommendations: recs };
    } else {
      // Ask for next slot
      newPendingSlot = nextSlot;
      savePendingSlot(newPendingSlot);
      const question = getSlotQuestion(nextSlot);
      
      const userMsg: Message = {
        id: `msg-${Date.now()}-user`,
        role: "user",
        text: userText,
        ts: Date.now(),
      };
      const assistantMsg: Message = {
        id: `msg-${Date.now()}-assistant`,
        role: "assistant",
        text: question,
        ts: Date.now(),
      };
      const updatedMessages = [...messages, userMsg, assistantMsg];
      saveHistory(updatedMessages);
      return { response: assistantMsg.text, messages: updatedMessages };
    }
  } catch (error) {
    console.error("Process message error:", error);
    const userMsg: Message = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      text: userText,
      ts: Date.now(),
    };
    const assistantMsg: Message = {
      id: `msg-${Date.now()}-assistant`,
      role: "assistant",
      text: "Sorry, I encountered an error. Please try again.",
      ts: Date.now(),
    };
    const updatedMessages = [...messages, userMsg, assistantMsg];
    saveHistory(updatedMessages);
    return { response: assistantMsg.text, messages: updatedMessages };
  }
}
