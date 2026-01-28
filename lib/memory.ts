import type { Account, Session } from "@/types";

const ACCOUNT_KEY = "restaurant-concierge-account";

/**
 * Get the current account or null
 */
export function getAccount(): Account | null {
  if (typeof window === "undefined") return null;
  const account = localStorage.getItem(ACCOUNT_KEY);
  return account === "danny" || account === "raphael" ? account : null;
}

/**
 * Set the current account
 */
export function setAccount(account: Account): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCOUNT_KEY, account);
}

/**
 * Clear the current account
 */
export function clearAccount(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCOUNT_KEY);
}

/**
 * Generate a session key from account: session:${account}
 */
export function getSessionKey(account: Account): string {
  return `session:${account}`;
}

/**
 * Load a session by session key
 */
export function loadSession(sessionKey: string): Session | null {
  if (typeof window === "undefined") return null;

  const stored = localStorage.getItem(sessionKey);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as Session;
  } catch {
    return null;
  }
}

/**
 * Save a session by session key
 */
export function saveSession(sessionKey: string, session: Session): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(sessionKey, JSON.stringify(session));
}

/**
 * Create a new empty session
 */
export function createEmptySession(): Session {
  return {
    messages: [],
    profile: {
      preferences: {},
    },
    state: {
      turns: 0,
      confidence: 0,
      pendingBooking: null,
    },
  };
}

/**
 * Load or create a session for the current account
 */
export function loadOrCreateSession(account: Account): Session {
  const sessionKey = getSessionKey(account);
  const existing = loadSession(sessionKey);
  return existing || createEmptySession();
}

/**
 * Clear session for a specific account
 */
export function clearAccountSession(account: Account): void {
  if (typeof window === "undefined") return;
  const sessionKey = getSessionKey(account);
  localStorage.removeItem(sessionKey);
}

