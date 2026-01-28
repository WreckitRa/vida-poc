export type Account = "danny" | "raphael";
export type AccountDisplay = "Danny" | "Raphael";

export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  ts: number;
}

export interface Restaurant {
  id: string;
  name: string;
  area: string;
  city: string;
  cuisines: string[];
  price: "low" | "mid" | "high"; // Note: maps to "cheap"|"mid"|"high" in slots
  vibe: string[];
  dietary: string[];
  rating: number;
  highlights: string[];
  bookingAvailable: boolean;
  /** For walk-in-only venues: code to present at the door for a discount */
  discountCode?: string;
}

// Slots for conversation state
export interface Slots {
  mealTime?: "breakfast" | "lunch" | "dinner" | "coffee" | "drinks" | "late-night";
  area?: string;
  partySize?: number;
  budget?: "cheap" | "mid" | "high";
  cravingCuisines?: string[];
  vibe?: "romantic" | "lively" | "quiet" | "outdoor" | "family" | "business";
  dietary?: string[];
  avoid?: {
    cuisines?: string[];
    tags?: string[];
  };
}

// Booking draft during booking flow
export interface BookingDraft {
  restaurantId: string;
  date?: string;
  time?: string;
  partySize?: number;
  notes?: string;
}

// User profile for personalization
export interface Profile {
  cuisinesLiked: Record<string, number>;
  vibePrefs: Record<string, number>;
  budgetDefault?: "cheap" | "mid" | "high";
  dietary?: string[];
  lastArea?: string;
}

// Booking history entry
export interface Booking {
  id: string;
  restaurantId: string;
  date: string;
  time: string;
  partySize: number;
  notes?: string;
  ts: number;
}

// Conversation state
export type ConversationState =
  | "WELCOME"
  | "DISCOVERY"
  | "RECOMMEND"
  | "BOOKING_COLLECT"
  | "BOOKING_CONFIRM"
  | "REFINE";

// New flow types
export type RequestMode = "collecting" | "recommending" | "confirming";

export type PendingSlot = "area" | "cuisine" | "budget" | "date" | "time" | "partySize" | null;

export interface ActiveRequest {
  area: string | null;
  cuisine: string | null;
  budget: { range: 1 | 2 | 3 | 4; label: string } | null;
  partySize: number | null;
  date: string | null; // yyyy-mm-dd if possible else natural text
  time: string | null; // HH:mm if possible else natural text
  notes: string | null;
}

// Restaurant recommendation with reasons
export interface RestaurantRecommendation {
  restaurant: Restaurant;
  reasons: string[];
}

// Session state for conversation memory
export interface Session {
  messages: Message[];
  profile: {
    preferences: {
      cuisines?: string[];
      budget?: string;
      vibe?: string[];
      dietary?: string[];
      location?: string;
      partySize?: number;
      time?: string;
    };
    dislikes?: string[];
    lastBookedRestaurantId?: string;
  };
  state: {
    turns: number;
    confidence: number;
    pendingBooking: BookingDraft | null;
    lastAction?: string;
  };
}
