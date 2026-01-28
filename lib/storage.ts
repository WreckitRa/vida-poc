import type { Profile, Booking, Message, Account, AccountDisplay, ActiveRequest, RequestMode, PendingSlot } from "@/types";

const PROFILE_KEY = "rb_profile_v1";
const HISTORY_KEY = "rb_history_v1";
const BOOKINGS_KEY = "rb_bookings_v1";
const ACTIVE_REQUEST_KEY = "rb_active_request_v1";
const MODE_KEY = "rb_mode_v1";
const PENDING_SLOT_KEY = "rb_pending_slot_v1";
const SELECTED_RESTAURANT_KEY = "rb_selected_restaurant_v1";

/**
 * Get display name for account (for compatibility)
 */
export function getAccountDisplay(account: Account): AccountDisplay {
  return account === "danny" ? "Danny" : "Raphael";
}

/**
 * Convert display name to account
 */
export function accountFromDisplay(display: AccountDisplay): Account {
  return display === "Danny" ? "danny" : "raphael";
}

/**
 * Get user profile from localStorage
 */
export function getProfile(): Profile {
  if (typeof window === "undefined") {
    return {
      cuisinesLiked: {},
      vibePrefs: {},
    };
  }

  const stored = localStorage.getItem(PROFILE_KEY);
  if (!stored) {
    return {
      cuisinesLiked: {},
      vibePrefs: {},
    };
  }

  try {
    return JSON.parse(stored) as Profile;
  } catch {
    return {
      cuisinesLiked: {},
      vibePrefs: {},
    };
  }
}

/**
 * Save user profile to localStorage
 */
export function saveProfile(profile: Profile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

/**
 * Get conversation history (messages) from localStorage
 */
export function getHistory(): Message[] {
  if (typeof window === "undefined") return [];

  const stored = localStorage.getItem(HISTORY_KEY);
  if (!stored) return [];

  try {
    return JSON.parse(stored) as Message[];
  } catch {
    return [];
  }
}

/**
 * Save conversation history to localStorage
 */
export function saveHistory(messages: Message[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(messages));
}

/**
 * Get bookings from localStorage
 */
export function getBookings(): Booking[] {
  if (typeof window === "undefined") return [];

  const stored = localStorage.getItem(BOOKINGS_KEY);
  if (!stored) return [];

  try {
    return JSON.parse(stored) as Booking[];
  } catch {
    return [];
  }
}

/**
 * Save bookings to localStorage
 */
export function saveBookings(bookings: Booking[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings));
}

/**
 * Add a new booking
 */
export function addBooking(booking: Booking): void {
  const bookings = getBookings();
  bookings.push(booking);
  saveBookings(bookings);
}

/**
 * Get active request from localStorage
 */
export function getActiveRequest(): ActiveRequest {
  if (typeof window === "undefined") {
    return {
      area: null,
      cuisine: null,
      budget: null,
      partySize: null,
      date: null,
      time: null,
      notes: null,
    };
  }

  const stored = localStorage.getItem(ACTIVE_REQUEST_KEY);
  if (!stored) {
    return {
      area: null,
      cuisine: null,
      budget: null,
      partySize: null,
      date: null,
      time: null,
      notes: null,
    };
  }

  try {
    return JSON.parse(stored) as ActiveRequest;
  } catch {
    return {
      area: null,
      cuisine: null,
      budget: null,
      partySize: null,
      date: null,
      time: null,
      notes: null,
    };
  }
}

/**
 * Save active request to localStorage
 */
export function saveActiveRequest(request: ActiveRequest): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_REQUEST_KEY, JSON.stringify(request));
}

/**
 * Get mode from localStorage
 */
export function getMode(): RequestMode {
  if (typeof window === "undefined") return "collecting";
  const stored = localStorage.getItem(MODE_KEY);
  return (stored as RequestMode) || "collecting";
}

/**
 * Save mode to localStorage
 */
export function saveMode(mode: RequestMode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MODE_KEY, mode);
}

/**
 * Get pending slot from localStorage
 */
export function getPendingSlot(): PendingSlot {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(PENDING_SLOT_KEY);
  return (stored as PendingSlot) || null;
}

/**
 * Save pending slot to localStorage
 */
export function savePendingSlot(slot: PendingSlot): void {
  if (typeof window === "undefined") return;
  if (slot === null) {
    localStorage.removeItem(PENDING_SLOT_KEY);
  } else {
    localStorage.setItem(PENDING_SLOT_KEY, slot);
  }
}

/**
 * Get selected restaurant ID from localStorage
 */
export function getSelectedRestaurantId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SELECTED_RESTAURANT_KEY);
}

/**
 * Save selected restaurant ID to localStorage
 */
export function saveSelectedRestaurantId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id === null) {
    localStorage.removeItem(SELECTED_RESTAURANT_KEY);
  } else {
    localStorage.setItem(SELECTED_RESTAURANT_KEY, id);
  }
}
