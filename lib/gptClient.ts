/**
 * Client-side wrappers for GPT API routes
 */

export async function classifyAndExtractClient(userMessage: string): Promise<{
  intent: "greeting_or_offtopic" | "restaurant_request" | "slot_answer" | "refinement" | "other";
  extracted: {
    area: { value: string | null; confidence: number };
    cuisine: { value: string | null; confidence: number };
    budget: { label: string | null; range: 1 | 2 | 3 | 4 | null };
    partySize: number | null;
    date: { value: string | null; confidence: number };
    time: { value: string | null; confidence: number };
    notes: string | null;
  };
}> {
  const response = await fetch("/api/classify-extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userMessage }),
  });

  if (!response.ok) {
    throw new Error("Failed to classify and extract");
  }

  return response.json();
}

export async function validateSlotClient(
  slotName: "area" | "cuisine" | "budget" | "date" | "time" | "partySize" | "notes",
  userReply: string,
  supportedChoices?: string[]
): Promise<{
  slot: string;
  value: string | number | null;
  normalized: string | number | null;
  confidence: number;
}> {
  const response = await fetch("/api/validate-slot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slotName, userReply, supportedChoices }),
  });

  if (!response.ok) {
    throw new Error("Failed to validate slot");
  }

  return response.json();
}

export async function normalizeToDBClient(
  rawArea: string | null,
  rawCuisine: string | null,
  supportedAreas: string[],
  supportedCuisines: string[]
): Promise<{
  areaMatch: { input: string | null; matched: string | null; confidence: number };
  cuisineMatch: { input: string | null; matched: string | null; confidence: number };
  unavailable: { area: boolean; cuisine: boolean };
}> {
  const response = await fetch("/api/normalize-db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawArea, rawCuisine, supportedAreas, supportedCuisines }),
  });

  if (!response.ok) {
    throw new Error("Failed to normalize to DB");
  }

  return response.json();
}
