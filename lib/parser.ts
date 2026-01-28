import type { Slots } from "@/types";
import { RESTAURANTS, getAvailableCuisines } from "./restaurants";

/**
 * Get all unique areas from the restaurant database
 * Sorted by length (longest first) to prioritize more specific area names
 */
export function getAvailableAreas(): string[] {
  const areas = new Set<string>();
  RESTAURANTS.forEach((r) => areas.add(r.area));
  return Array.from(areas).sort((a, b) => b.length - a.length); // Sort by length descending
}

/**
 * Map restaurant price to slot budget format
 */
function mapPriceToBudget(price: "low" | "mid" | "high"): "cheap" | "mid" | "high" {
  return price === "low" ? "cheap" : price;
}

/**
 * Deterministic parser for user messages
 */
export function parseUserMessage(
  text: string,
  knownAreas: string[],
  knownCuisines: string[]
): {
  slotUpdates: Partial<Slots>;
  intent:
    | "select_option"
    | "book_option"
    | "more"
    | "reject"
    | "confirm"
    | "change"
    | "reset"
    | "profile"
    | "unknown";
  optionNumber?: 1 | 2 | 3;
} {
  const lower = text.toLowerCase().trim();

  // Commands (exact or prefix matches)
  if (lower === "reset" || lower.startsWith("reset ")) {
    return { slotUpdates: {}, intent: "reset" };
  }
  if (lower === "profile" || lower.startsWith("profile ")) {
    return { slotUpdates: {}, intent: "profile" };
  }
  if (lower === "more" || lower.startsWith("more ")) {
    return { slotUpdates: {}, intent: "more" };
  }

  // Option selection: "1", "2", "3", or "book 1", "book 2", "book 3"
  const bookMatch = lower.match(/^book\s+([123])$/);
  if (bookMatch) {
    const num = parseInt(bookMatch[1]) as 1 | 2 | 3;
    return { slotUpdates: {}, intent: "book_option", optionNumber: num };
  }

  const optionMatch = lower.match(/^([123])$/);
  if (optionMatch) {
    const num = parseInt(optionMatch[1]) as 1 | 2 | 3;
    return { slotUpdates: {}, intent: "select_option", optionNumber: num };
  }

  // Booking confirm/change
  if (lower === "confirm" || lower === "yes" || lower === "y") {
    return { slotUpdates: {}, intent: "confirm" };
  }
  if (lower === "change" || lower === "no" || lower === "n") {
    return { slotUpdates: {}, intent: "change" };
  }

  // Reject patterns
  const rejectPatterns = [
    "no",
    "not",
    "don't",
    "dont",
    "wrong",
    "not that",
    "too",
    "reject",
    "skip",
  ];
  const isReject = rejectPatterns.some((p) => lower.includes(p));
  if (isReject && (lower.includes("far") || lower.includes("expensive") || lower.includes("vibe"))) {
    return { slotUpdates: {}, intent: "reject" };
  }

  // Extract slot updates from natural language
  const slotUpdates: Partial<Slots> = {};

  // Area extraction
  for (const area of knownAreas) {
    const areaLower = area.toLowerCase();
    if (
      lower.includes(areaLower) ||
      lower.includes(areaLower.replace(/\s+/g, "")) ||
      lower.includes(areaLower.replace(/[^a-z]/g, ""))
    ) {
      slotUpdates.area = area;
      break;
    }
  }

  // Meal time extraction
  const mealTimePatterns = {
    breakfast: ["breakfast", "morning", "brunch", "early"],
    lunch: ["lunch", "noon", "midday"],
    dinner: ["dinner", "evening", "tonight", "night"],
    coffee: ["coffee", "cafe", "latte"],
    drinks: ["drinks", "cocktail", "bar", "happy hour"],
    "late-night": ["late", "late night", "midnight"],
  };
  for (const [mealTime, patterns] of Object.entries(mealTimePatterns)) {
    if (patterns.some((p) => lower.includes(p))) {
      slotUpdates.mealTime = mealTime as Slots["mealTime"];
      break;
    }
  }

  // Party size extraction (numbers 1-20)
  const partyMatch = lower.match(/\b(\d{1,2})\b/);
  if (partyMatch) {
    const num = parseInt(partyMatch[1]);
    if (num >= 1 && num <= 20) {
      // Check if context suggests party size (people, party, guests, etc.)
      const partyContext = /(people|party|guests|person|diner|table|group)/i.test(lower);
      const numberWords = [
        "one",
        "two",
        "three",
        "four",
        "five",
        "six",
        "seven",
        "eight",
        "nine",
        "ten",
      ];
      const hasNumberWord = numberWords.some((word, idx) => lower.includes(word) && idx + 1 === num);
      // If message is just a number (1-20), treat as party size
      const isJustNumber = /^\s*\d{1,2}\s*$/.test(text.trim());
      if (partyContext || hasNumberWord || isJustNumber) {
        slotUpdates.partySize = num;
      }
    }
  }
  
  // Also handle number words for party size
  const numberWordMap: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  for (const [word, num] of Object.entries(numberWordMap)) {
    if (lower === word || lower.trim() === word) {
      slotUpdates.partySize = num;
      break;
    }
  }

  // Budget extraction - check high first to catch "high budget" before "budget" matches cheap
  const budgetPatterns = {
    high: ["high", "expensive", "upscale", "fine dining", "premium", "fancy"],
    mid: ["mid", "medium", "moderate", "normal"],
    cheap: ["cheap", "low", "affordable", "inexpensive"], // Removed "budget" as it's ambiguous
  };
  for (const [budget, patterns] of Object.entries(budgetPatterns)) {
    if (patterns.some((p) => lower.includes(p))) {
      slotUpdates.budget = budget as Slots["budget"];
      break;
    }
  }

  // Cuisine extraction
  const cuisines: string[] = [];
  for (const cuisine of knownCuisines) {
    const cuisineLower = cuisine.toLowerCase();
    if (
      lower.includes(cuisineLower) ||
      lower.includes(cuisineLower.replace(/\s+/g, "")) ||
      lower.includes(cuisineLower.replace(/[^a-z]/g, ""))
    ) {
      cuisines.push(cuisine);
    }
  }
  if (cuisines.length > 0) {
    slotUpdates.cravingCuisines = cuisines;
  }

  // Vibe extraction (map to slot vibe enum)
  const vibeMap: Record<string, "romantic" | "lively" | "quiet" | "outdoor" | "family" | "business"> = {
    romantic: "romantic",
    intimate: "romantic",
    romantic: "romantic",
    lively: "lively",
    casual: "lively",
    fun: "lively",
    quiet: "quiet",
    peaceful: "quiet",
    calm: "quiet",
    outdoor: "outdoor",
    patio: "outdoor",
    garden: "outdoor",
    family: "family",
    "family-friendly": "family",
    business: "business",
    professional: "business",
  };

  const vibePatterns = [
    "romantic",
    "intimate",
    "lively",
    "casual",
    "fun",
    "quiet",
    "peaceful",
    "outdoor",
    "patio",
    "garden",
    "family",
    "business",
    "professional",
  ];

  for (const pattern of vibePatterns) {
    if (lower.includes(pattern)) {
      const mapped = vibeMap[pattern];
      if (mapped) {
        slotUpdates.vibe = mapped;
        break;
      }
    }
  }

  // Dietary extraction (common terms)
  const dietaryTerms: string[] = [];
  const dietaryPatterns = [
    "vegetarian",
    "vegan",
    "gluten-free",
    "gluten free",
    "pescatarian",
    "halal",
    "kosher",
  ];
  for (const pattern of dietaryPatterns) {
    if (lower.includes(pattern)) {
      dietaryTerms.push(pattern);
    }
  }
  if (dietaryTerms.length > 0) {
    slotUpdates.dietary = dietaryTerms;
  }

  return {
    slotUpdates,
    intent: Object.keys(slotUpdates).length > 0 ? "unknown" : "unknown",
  };
}
