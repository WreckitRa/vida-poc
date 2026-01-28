/**
 * Mock booking function for demo purposes
 * Generates deterministic confirmation IDs
 */

export interface BookingInput {
  restaurantId: string;
  partySize: number;
  time: string;
}

export interface BookingResult {
  confirmationId: string;
  restaurantId: string;
  partySize: number;
  time: string;
}

/**
 * Generate a deterministic confirmation ID based on restaurant and time
 * Format: BK-XXXXXX (6 alphanumeric characters)
 */
function generateConfirmationId(restaurantId: string, time: string): string {
  // Create a simple hash from restaurantId and time for determinism
  const input = `${restaurantId}-${time}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to positive and create 6-char alphanumeric string
  const absHash = Math.abs(hash);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
  let result = 'BK-';
  let num = absHash;
  
  for (let i = 0; i < 6; i++) {
    result += chars[num % chars.length];
    num = Math.floor(num / chars.length);
  }
  
  return result;
}

/**
 * Mock booking function
 * Returns a booking confirmation
 */
export async function bookMock(input: BookingInput): Promise<BookingResult> {
  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const confirmationId = generateConfirmationId(input.restaurantId, input.time);
  
  return {
    confirmationId,
    restaurantId: input.restaurantId,
    partySize: input.partySize,
    time: input.time,
  };
}

