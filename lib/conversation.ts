import type {
  ConversationState,
  Slots,
  BookingDraft,
  Profile,
  Restaurant,
  RestaurantRecommendation,
  Message,
} from "@/types";
import { parseUserMessage, getAvailableAreas } from "./parser";
import { getAvailableCuisines } from "./restaurants";
import { recommendRestaurants } from "./recommender";
import { getProfile, saveProfile, getHistory, saveHistory, addBooking } from "./storage";
import { RESTAURANTS } from "./restaurants";
import { analyzeAnswer, type QuestionType } from "./answerAnalyzer";
import { parseRelativeDate } from "./dateParser";
import { extractSlots } from "./slotExtractor";

export interface ConversationContext {
  state: ConversationState;
  slots: Slots;
  bookingDraft?: BookingDraft;
  recommendations?: {
    topPick: RestaurantRecommendation;
    alternatives: RestaurantRecommendation[];
    mapping: { 1: Restaurant; 2?: Restaurant; 3?: Restaurant };
    previousTopPickIds?: string[];
  };
  lastQuestion?: string; // Track the last question asked
  lastQuestionType?: QuestionType; // Track the type of last question
}

interface RecommendationMapping {
  1: Restaurant;
  2?: Restaurant;
  3?: Restaurant;
}

/**
 * Check if we have enough info to recommend
 */
function canRecommend(slots: Slots, profile: Profile): boolean {
  const hasArea = !!slots.area;
  const hasPartySize = !!slots.partySize;
  const hasBudget = !!slots.budget; // Only check slots.budget, not profile defaults
  const hasCuisineOrVibeOrMealTime =
    (slots.cravingCuisines && slots.cravingCuisines.length > 0) ||
    !!slots.vibe ||
    !!slots.mealTime;

  return hasArea && hasPartySize && hasBudget && hasCuisineOrVibeOrMealTime;
}

/**
 * Get the next question to ask during discovery
 */
function getNextDiscoveryQuestion(slots: Slots, profile: Profile): { question: string; type: QuestionType } {
  // Ask for area first (most important filter)
  if (!slots.area) {
    return { question: "What area or neighborhood are you thinking? I can help you find great spots in different locations.", type: "area" };
  }
  // Ask for meal time second
  if (!slots.mealTime) {
    return { question: "What meal time are you planning for? Options: breakfast, lunch, dinner, coffee, drinks, or late-night.", type: "mealTime" };
  }
  // Ask for party size third
  if (!slots.partySize) {
    return { question: "How many people will be joining you? Just let me know the number.", type: "partySize" };
  }
  // Ask for budget fourth - only check slots, not profile defaults
  if (!slots.budget) {
    return { question: "What's your budget preference? You can choose: cheap, mid, or high. I'll find the perfect match for you!", type: "budget" };
  }
  // Ask for cuisine or vibe fifth
  if (!slots.cravingCuisines && !slots.vibe) {
    return { question: "What type of cuisine are you in the mood for, or what kind of atmosphere are you looking for? I'm here to help you find something perfect!", type: "cuisine" };
  }
  // Ask for dietary last
  if (!slots.dietary) {
    return { question: "Do you have any dietary requirements or preferences? Just let me know if you have any restrictions or preferences.", type: "dietary" };
  }
  return { question: "", type: "cuisine" };
}

/**
 * Format price for display
 */
function formatPrice(price: "low" | "mid" | "high"): string {
  const map: Record<"low" | "mid" | "high", string> = {
    low: "$",
    mid: "$$",
    high: "$$$",
  };
  return map[price];
}

/**
 * Format recommendation message
 */
function formatRecommendationMessage(
  recommendations: ConversationContext["recommendations"],
  slots?: Slots
): string {
  if (!recommendations) return "";

  const { topPick, alternatives, mapping } = recommendations;
  const topRestaurant = topPick.restaurant;

  let message = "";
  
  // Check if requested cuisine wasn't found
  if (slots?.cravingCuisines && slots.cravingCuisines.length > 0) {
    const requestedCuisines = slots.cravingCuisines;
    const hasMatch = requestedCuisines.some((reqCuisine) =>
      topRestaurant.cuisines.some((rCuisine) =>
        rCuisine.toLowerCase().includes(reqCuisine.toLowerCase()) ||
        reqCuisine.toLowerCase().includes(rCuisine.toLowerCase())
      )
    );
    if (!hasMatch) {
      message += `I couldn't find ${requestedCuisines.join(" or ")} restaurants matching your criteria. Here are some great alternatives:\n\n`;
    }
  }

  message += `Top pick:\n`;
  message += `1) ${topRestaurant.name} (${topRestaurant.area}) price: ${formatPrice(topRestaurant.price)} | ${topRestaurant.cuisines.join(", ")} | ${topRestaurant.vibe.join(", ")}\n`;
  message += `   Why: ${topPick.reasons.join("; ")}\n`;

  if (alternatives.length > 0) {
    message += `\nAlternatives:\n`;
    alternatives.forEach((alt, idx) => {
      const optionNum = idx + 2;
      message += `${optionNum}) ${alt.restaurant.name} (${alt.restaurant.area}) price: ${formatPrice(alt.restaurant.price)} | ${alt.restaurant.cuisines.join(", ")} | ${alt.restaurant.vibe.join(", ")}\n`;
      message += `   Why: ${alt.reasons.join("; ")}\n`;
    });
  }

  message += `\nReply 1/2/3 to pick. Reply 'book 1' to book. Reply 'more' for other options.`;

  return message;
}

/**
 * Process user message and return response
 */
export async function processMessage(
  userText: string,
  context: ConversationContext,
  profile: Profile
): Promise<{
  context: ConversationContext;
  response: string;
  messages: Message[];
}> {
  const messages = getHistory();
  const knownAreas = getAvailableAreas();
  const knownCuisines = getAvailableCuisines();

  let newContext = { ...context };
  let response = "";

  // Handle reset
  const lower = userText.toLowerCase().trim();
  if (lower === "reset" || lower.startsWith("reset ")) {
    newContext = {
      state: "DISCOVERY",
      slots: {},
      bookingDraft: undefined,
      recommendations: undefined,
      lastQuestion: undefined,
      lastQuestionType: undefined,
    };
    response = "No problem! Let's start fresh. What are you in the mood for and what area are you thinking?";
    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      text: userText,
      ts: Date.now(),
    };
    const assistantMessage: Message = {
      id: `msg-${Date.now()}-assistant`,
      role: "assistant",
      text: response,
      ts: Date.now(),
    };
    const updatedMessages = [...messages, userMessage, assistantMessage];
    saveHistory(updatedMessages);
    return { context: newContext, response, messages: updatedMessages };
  }

  // Handle profile
  if (lower === "profile" || lower.startsWith("profile ")) {
    const profileLines: string[] = [];
    profileLines.push("Here's what I remember about your preferences:");
    if (Object.keys(profile.cuisinesLiked).length > 0) {
      const cuisines = Object.entries(profile.cuisinesLiked)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name)
        .join(", ");
      profileLines.push(`Cuisines you like: ${cuisines}`);
    }
    if (Object.keys(profile.vibePrefs).length > 0) {
      const vibes = Object.entries(profile.vibePrefs)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name)
        .join(", ");
      profileLines.push(`Vibe preferences: ${vibes}`);
    }
    if (profile.budgetDefault) {
      profileLines.push(`Your usual budget: ${profile.budgetDefault}`);
    }
    if (profile.dietary && profile.dietary.length > 0) {
      profileLines.push(`Dietary preferences: ${profile.dietary.join(", ")}`);
    }
    if (profile.lastArea) {
      profileLines.push(`Last area you visited: ${profile.lastArea}`);
    }
    response = profileLines.join("\n");
    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      text: userText,
      ts: Date.now(),
    };
    const assistantMessage: Message = {
      id: `msg-${Date.now()}-assistant`,
      role: "assistant",
      text: response,
      ts: Date.now(),
    };
    const updatedMessages = [...messages, userMessage, assistantMessage];
    saveHistory(updatedMessages);
    return { context: newContext, response, messages: updatedMessages };
  }

  // Parse user message (for commands and basic extraction)
  const parsed = parseUserMessage(userText, knownAreas, knownCuisines);

  // State machine logic
  switch (newContext.state) {
    case "WELCOME": {
      // User just answered the welcome question - extract ALL information using GPT
      newContext.state = "DISCOVERY";
      
      // Use GPT to extract ALL slot values from the message (no pattern matching)
      // No specific question context, so extract everything
      try {
        const extraction = await extractSlots(userText, newContext.slots);
        
        // Merge extracted slots with existing slots (GPT extraction takes precedence)
        newContext.slots = {
          ...newContext.slots,
          ...extraction.slots,
        };
      } catch (error) {
        console.error("GPT slot extraction error:", error);
        // On error, keep existing slots (don't use pattern matching fallback)
      }

      // Check if we can recommend now (user might have provided all info)
      if (canRecommend(newContext.slots, profile)) {
        const recommendations = recommendRestaurants(
          newContext.slots,
          profile,
          newContext.recommendations?.previousTopPickIds
        );
        const mapping: RecommendationMapping = {
          1: recommendations.topPick.restaurant,
        };
        if (recommendations.alternatives.length > 0) {
          mapping[2] = recommendations.alternatives[0].restaurant;
        }
        if (recommendations.alternatives.length > 1) {
          mapping[3] = recommendations.alternatives[1].restaurant;
        }
        newContext.recommendations = {
          ...recommendations,
          mapping,
          previousTopPickIds: [recommendations.topPick.restaurant.id],
        };
        newContext.state = "RECOMMEND";
        newContext.lastQuestion = undefined;
        newContext.lastQuestionType = undefined;
        response = formatRecommendationMessage(newContext.recommendations, newContext.slots);
        break;
      }

      // Ask next question
      const nextQuestionInfo = getNextDiscoveryQuestion(newContext.slots, profile);
      newContext.lastQuestion = nextQuestionInfo.question;
      newContext.lastQuestionType = nextQuestionInfo.type;
      response = nextQuestionInfo.question || "What else can you tell me to help you find the perfect restaurant?";
      break;
    }

    case "DISCOVERY": {
      // Check if we can recommend
      if (canRecommend(newContext.slots, profile)) {
        const recommendations = recommendRestaurants(
          newContext.slots,
          profile,
          newContext.recommendations?.previousTopPickIds
        );
        const mapping: RecommendationMapping = {
          1: recommendations.topPick.restaurant,
        };
        if (recommendations.alternatives.length > 0) {
          mapping[2] = recommendations.alternatives[0].restaurant;
        }
        if (recommendations.alternatives.length > 1) {
          mapping[3] = recommendations.alternatives[1].restaurant;
        }
        newContext.recommendations = {
          ...recommendations,
          mapping,
          previousTopPickIds: [recommendations.topPick.restaurant.id],
        };
        newContext.state = "RECOMMEND";
        newContext.lastQuestion = undefined;
        newContext.lastQuestionType = undefined;
        response = formatRecommendationMessage(newContext.recommendations, newContext.slots);
      } else {
        // Use GPT to extract slot values from the message, with prompt customized based on the question
        try {
          const extraction = await extractSlots(
            userText,
            newContext.slots,
            newContext.lastQuestion,
            newContext.lastQuestionType
          );
          
          // Merge extracted slots with existing slots (GPT extraction takes precedence)
          newContext.slots = {
            ...newContext.slots,
            ...extraction.slots,
          };
        } catch (error) {
          console.error("GPT slot extraction error:", error);
          // On error, keep existing slots (don't use pattern matching fallback)
        }

        // Check if we can recommend now
        if (canRecommend(newContext.slots, profile)) {
          const recommendations = recommendRestaurants(
            newContext.slots,
            profile,
            newContext.recommendations?.previousTopPickIds
          );
          const mapping: RecommendationMapping = {
            1: recommendations.topPick.restaurant,
          };
          if (recommendations.alternatives.length > 0) {
            mapping[2] = recommendations.alternatives[0].restaurant;
          }
          if (recommendations.alternatives.length > 1) {
            mapping[3] = recommendations.alternatives[1].restaurant;
          }
          newContext.recommendations = {
            ...recommendations,
            mapping,
            previousTopPickIds: [recommendations.topPick.restaurant.id],
          };
          newContext.state = "RECOMMEND";
          newContext.lastQuestion = undefined;
          newContext.lastQuestionType = undefined;
          response = formatRecommendationMessage(newContext.recommendations, newContext.slots);
          break;
        }

        // Ask next question
        const questionInfo = getNextDiscoveryQuestion(newContext.slots, profile);
        newContext.lastQuestion = questionInfo.question;
        newContext.lastQuestionType = questionInfo.type;
        response = questionInfo.question || "What else can you tell me to help you find the perfect restaurant?";
      }
      break;
    }

    case "RECOMMEND": {
      if (parsed.intent === "select_option" && parsed.optionNumber) {
        const selectedRestaurant = newContext.recommendations?.mapping[parsed.optionNumber];
        if (selectedRestaurant) {
          response = `Great choice! ${selectedRestaurant.name} looks perfect. Would you like me to book it? Just reply 'book ${parsed.optionNumber}' to start, or 'more' to see other options.`;
        } else {
          response = "I don't have that option. Please reply with 1, 2, or 3 to pick a restaurant.";
        }
      } else if (parsed.intent === "book_option" && parsed.optionNumber) {
        const selectedRestaurant = newContext.recommendations?.mapping[parsed.optionNumber];
        if (selectedRestaurant) {
          newContext.bookingDraft = {
            restaurantId: selectedRestaurant.id,
            partySize: newContext.slots.partySize,
          };
          newContext.state = "BOOKING_COLLECT";
          newContext.lastQuestion = "What date would you like to book for? You can say things like 'tomorrow', 'Friday', or a specific date like '2024-12-25'.";
          newContext.lastQuestionType = undefined;
          response = newContext.lastQuestion;
        } else {
          response = "I don't have that option. Please reply 'book 1', 'book 2', or 'book 3' to book a restaurant.";
        }
      } else if (parsed.intent === "more") {
        // Re-recommend with diversification
        const recommendations = recommendRestaurants(
          newContext.slots,
          profile,
          newContext.recommendations?.previousTopPickIds
        );
        
        // Check if we're stuck with the same restaurant (only one option or all alternatives are duplicates)
        const totalOptions = 1 + recommendations.alternatives.length;
        const allRestaurantIds = [
          recommendations.topPick.restaurant.id,
          ...recommendations.alternatives.map(alt => alt.restaurant.id)
        ];
        const previousIds = newContext.recommendations?.previousTopPickIds || [];
        const isStuck = totalOptions <= 1 || allRestaurantIds.every(id => previousIds.includes(id));
        
        if (isStuck) {
          // Only one or same restaurants - allow user to refine criteria
          newContext.state = "REFINE";
          newContext.lastQuestion = "I don't have many other options with your current criteria. What would you like to change? You can say 'area', 'budget', or 'cuisine', or just tell me the new value (like 'downtown' for area).";
          newContext.lastQuestionType = undefined;
          response = newContext.lastQuestion;
        } else {
          // We have different options
          const mapping: RecommendationMapping = {
            1: recommendations.topPick.restaurant,
          };
          if (recommendations.alternatives.length > 0) {
            mapping[2] = recommendations.alternatives[0].restaurant;
          }
          if (recommendations.alternatives.length > 1) {
            mapping[3] = recommendations.alternatives[1].restaurant;
          }
          newContext.recommendations = {
            ...recommendations,
            mapping,
            previousTopPickIds: [...previousIds, recommendations.topPick.restaurant.id].slice(-3),
          };
          newContext.lastQuestion = undefined;
          newContext.lastQuestionType = undefined;
          response = formatRecommendationMessage(newContext.recommendations, newContext.slots);
        }
      } else if (parsed.intent === "reject") {
        newContext.state = "REFINE";
        newContext.lastQuestion = "I'd love to help you find something better! Is it too far, too expensive, or the wrong vibe?";
        newContext.lastQuestionType = undefined;
        response = newContext.lastQuestion;
      } else {
        // Continue slot filling
        const questionInfo = getNextDiscoveryQuestion(newContext.slots, profile);
        if (questionInfo.question) {
          newContext.state = "DISCOVERY";
          newContext.lastQuestion = questionInfo.question;
          newContext.lastQuestionType = questionInfo.type;
          response = questionInfo.question;
        } else {
          response = "Reply 1/2/3 to pick. Reply 'book 1' to book. Reply 'more' for other options.";
        }
      }
      break;
    }

    case "REFINE": {
      // Handle user specifying what they want to change
      const lowerText = userText.toLowerCase().trim();
      
      // Check if user wants to change area
      if (lowerText === "area" || lowerText.includes("area") || lowerText.includes("location") || lowerText.includes("neighborhood")) {
        newContext.state = "DISCOVERY";
        newContext.slots.area = undefined; // Clear current area
        const questionInfo = getNextDiscoveryQuestion(newContext.slots, profile);
        newContext.lastQuestion = questionInfo.question;
        newContext.lastQuestionType = questionInfo.type;
        response = "Sure! Let's change the area. " + questionInfo.question;
        break;
      }
      
      // Check if user wants to change budget
      if (lowerText === "budget" || lowerText === "price" || lowerText.includes("budget") || lowerText.includes("price")) {
        newContext.state = "DISCOVERY";
        newContext.slots.budget = undefined; // Clear current budget
        const questionInfo = getNextDiscoveryQuestion(newContext.slots, profile);
        newContext.lastQuestion = questionInfo.question;
        newContext.lastQuestionType = questionInfo.type;
        response = "Sure! Let's change the budget. " + questionInfo.question;
        break;
      }
      
      // Check if user wants to change cuisine
      if (lowerText === "cuisine" || lowerText === "food" || lowerText.includes("cuisine") || lowerText.includes("food type")) {
        newContext.state = "DISCOVERY";
        newContext.slots.cravingCuisines = undefined; // Clear current cuisine
        const questionInfo = getNextDiscoveryQuestion(newContext.slots, profile);
        newContext.lastQuestion = questionInfo.question;
        newContext.lastQuestionType = questionInfo.type;
        response = "Sure! Let's change the cuisine. " + questionInfo.question;
        break;
      }
      
      // Try to extract value using GPT (e.g., they said "downtown" or "high budget" when asked what to change)
      try {
        const extraction = await extractSlots(userText, newContext.slots);
        
        // Update slots with GPT extraction
        if (extraction.slots.area) {
          newContext.slots.area = extraction.slots.area;
          newContext.state = "DISCOVERY";
          const questionInfo = getNextDiscoveryQuestion(newContext.slots, profile);
          newContext.lastQuestion = questionInfo.question;
          newContext.lastQuestionType = questionInfo.type;
          response = "Got it! I've updated the area. " + questionInfo.question;
          break;
        }
        
        if (extraction.slots.budget) {
          newContext.slots.budget = extraction.slots.budget;
          newContext.state = "DISCOVERY";
          const questionInfo = getNextDiscoveryQuestion(newContext.slots, profile);
          newContext.lastQuestion = questionInfo.question;
          newContext.lastQuestionType = questionInfo.type;
          response = "Got it! I've updated the budget. " + questionInfo.question;
          break;
        }
        
        if (extraction.slots.cravingCuisines && extraction.slots.cravingCuisines.length > 0) {
          newContext.slots.cravingCuisines = extraction.slots.cravingCuisines;
          newContext.state = "DISCOVERY";
          const questionInfo = getNextDiscoveryQuestion(newContext.slots, profile);
          newContext.lastQuestion = questionInfo.question;
          newContext.lastQuestionType = questionInfo.type;
          response = "Got it! I've updated the cuisine. " + questionInfo.question;
          break;
        }
        
        if (extraction.slots.vibe) {
          newContext.slots.vibe = extraction.slots.vibe;
          newContext.state = "DISCOVERY";
          const questionInfo = getNextDiscoveryQuestion(newContext.slots, profile);
          newContext.lastQuestion = questionInfo.question;
          newContext.lastQuestionType = questionInfo.type;
          response = "Got it! I've updated the vibe. " + questionInfo.question;
          break;
        }
      } catch (error) {
        console.error("GPT extraction error in REFINE:", error);
      }
      
      // If we can't parse it, ask for clarification
      response = "I'd love to help you adjust your preferences! You can change the area, budget, cuisine, or vibe. What would you like to change?";
      break;
    }

    case "BOOKING_COLLECT": {
      if (!newContext.bookingDraft) {
        newContext.state = "DISCOVERY";
        newContext.lastQuestion = undefined;
        newContext.lastQuestionType = undefined;
        response = "Booking cancelled. What are you looking for?";
        break;
      }

      // Collect booking info sequentially
      if (!newContext.bookingDraft.date) {
        // Parse date (handles relative dates like "tomorrow", "next monday", etc.)
        newContext.bookingDraft.date = await parseRelativeDate(userText);
        newContext.lastQuestion = "Perfect! What time would you like? You can say things like '7pm', '19:00', or '7:30 PM'.";
        newContext.lastQuestionType = undefined;
        response = newContext.lastQuestion;
      } else if (!newContext.bookingDraft.time) {
        // Parse time
        const timeMatch = userText.match(/(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)?/);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1]);
          const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
          const ampm = timeMatch[3]?.toLowerCase();

          if (ampm === "pm" && hours < 12) hours += 12;
          if (ampm === "am" && hours === 12) hours = 0;

          newContext.bookingDraft.time = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
        } else {
          newContext.bookingDraft.time = userText.trim();
        }

        if (!newContext.bookingDraft.partySize) {
          newContext.lastQuestion = "How many people will be joining?";
          newContext.lastQuestionType = "partySize";
          response = newContext.lastQuestion;
        } else {
          newContext.lastQuestion = "Any special notes or requests for the restaurant? If not, just say 'no'.";
          newContext.lastQuestionType = undefined;
          response = newContext.lastQuestion;
        }
      } else if (newContext.bookingDraft.partySize === undefined) {
        const partyMatch = userText.match(/\b(\d{1,2})\b/);
        if (partyMatch) {
          newContext.bookingDraft.partySize = parseInt(partyMatch[1]);
        } else {
          newContext.bookingDraft.partySize = newContext.slots.partySize || 2;
        }
        newContext.lastQuestion = "Any special notes or requests for the restaurant? If not, just say 'no'.";
        newContext.lastQuestionType = undefined;
        response = newContext.lastQuestion;
      } else if (newContext.bookingDraft.notes === undefined) {
        const lowerText = userText.toLowerCase();
        if (lowerText === "no" || lowerText === "n" || lowerText.trim() === "") {
          newContext.bookingDraft.notes = "";
        } else {
          newContext.bookingDraft.notes = userText.trim();
        }
        newContext.state = "BOOKING_CONFIRM";
        const restaurant = RESTAURANTS.find((r) => r.id === newContext.bookingDraft!.restaurantId);
        newContext.lastQuestion = `Here's your booking summary:\nRestaurant: ${restaurant?.name || "Unknown"}\nDate: ${newContext.bookingDraft.date}\nTime: ${newContext.bookingDraft.time}\nParty: ${newContext.bookingDraft.partySize} people\nNotes: ${newContext.bookingDraft.notes || "None"}\n\nDoes this look good? Reply 'confirm' to book or 'change' to modify.`;
        newContext.lastQuestionType = undefined;
        response = newContext.lastQuestion;
      }
      break;
    }

    case "BOOKING_CONFIRM": {
      if (parsed.intent === "confirm") {
        // Save booking
        if (newContext.bookingDraft && newContext.bookingDraft.date && newContext.bookingDraft.time && newContext.bookingDraft.partySize) {
          const booking = {
            id: `booking-${Date.now()}`,
            restaurantId: newContext.bookingDraft.restaurantId,
            date: newContext.bookingDraft.date,
            time: newContext.bookingDraft.time,
            partySize: newContext.bookingDraft.partySize,
            notes: newContext.bookingDraft.notes,
            ts: Date.now(),
          };
          addBooking(booking);

          // Update profile
          const restaurant = RESTAURANTS.find((r) => r.id === booking.restaurantId);
          if (restaurant) {
            const updatedProfile = { ...profile };
            restaurant.cuisines.forEach((cuisine) => {
              updatedProfile.cuisinesLiked[cuisine] = (updatedProfile.cuisinesLiked[cuisine] || 0) + 1;
            });
            restaurant.vibe.forEach((vibe) => {
              // Map restaurant vibe to slot vibe
              const slotVibe = ["romantic", "intimate", "elegant"].includes(vibe) ? "romantic" :
                ["lively", "casual", "fun"].includes(vibe) ? "lively" :
                ["quiet", "peaceful", "calm"].includes(vibe) ? "quiet" :
                ["outdoor", "patio", "garden"].includes(vibe) ? "outdoor" :
                ["family-friendly", "family"].includes(vibe) ? "family" :
                ["business", "professional", "upscale"].includes(vibe) ? "business" : null;
              if (slotVibe) {
                updatedProfile.vibePrefs[slotVibe] = (updatedProfile.vibePrefs[slotVibe] || 0) + 1;
              }
            });
            updatedProfile.lastArea = restaurant.area;
            saveProfile(updatedProfile);
          }

          response = `Perfect! Your booking is confirmed at ${restaurant?.name || "the restaurant"} for ${booking.partySize} people on ${booking.date} at ${booking.time}.${booking.notes ? ` I've noted: ${booking.notes}` : ""} Enjoy your meal!`;
        } else {
          response = "I'm sorry, there seems to be some missing information. Let's try again.";
        }
        newContext.state = "DISCOVERY";
        newContext.bookingDraft = undefined;
        newContext.lastQuestion = undefined;
        newContext.lastQuestionType = undefined;
      } else if (parsed.intent === "change") {
        newContext.state = "BOOKING_COLLECT";
        newContext.bookingDraft = {
          ...newContext.bookingDraft!,
          date: undefined,
          time: undefined,
          notes: undefined,
        };
        newContext.lastQuestion = "No problem! Let's adjust that. What date would you like?";
        newContext.lastQuestionType = undefined;
        response = newContext.lastQuestion;
      } else {
        response = "Please reply 'confirm' to book or 'change' to modify your booking.";
      }
      break;
    }
  }

  // Add messages
  const userMessage: Message = {
    id: `msg-${Date.now()}-user`,
    role: "user",
    text: userText,
    ts: Date.now(),
  };

  const assistantMessage: Message = {
    id: `msg-${Date.now()}-assistant`,
    role: "assistant",
    text: response,
    ts: Date.now(),
  };

  const updatedMessages = [...messages, userMessage, assistantMessage];
  saveHistory(updatedMessages);

  return { context: newContext, response, messages: updatedMessages };
}

/**
 * Initialize conversation context
 */
export function initializeConversation(profile: Profile): ConversationContext {
  const history = getHistory();
  const hasHistory = history.length > 0;

  return {
    state: hasHistory ? "DISCOVERY" : "WELCOME",
    slots: {},
    bookingDraft: undefined,
    recommendations: undefined,
    lastQuestion: undefined,
    lastQuestionType: undefined,
  };
}

/**
 * Get welcome message
 */
export function getWelcomeMessage(profile: Profile): string {
  const hasHistory = getHistory().length > 0;
  if (hasHistory) {
    return "Welcome back! I'm here to help you find the perfect restaurant. What are you in the mood for and what area are you thinking?";
  } else {
    return "Hey there! I'm your restaurant butler, and I'm excited to help you find the perfect spot. What are you in the mood for and what area are you thinking?";
  }
}
