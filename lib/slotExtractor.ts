import type { Slots } from "@/types";

export interface SlotExtractionResult {
  slots: Partial<Slots>;
  confidence: number;
}

/**
 * Extract slot values from user message using GPT
 */
export async function extractSlots(
  userMessage: string,
  currentSlots?: Partial<Slots>,
  question?: string,
  questionType?: "area" | "mealTime" | "partySize" | "budget" | "cuisine" | "vibe" | "dietary"
): Promise<SlotExtractionResult> {
  try {
    const response = await fetch("/api/extract-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userMessage,
        currentSlots,
        question,
        questionType,
      }),
    });

    if (!response.ok) {
      throw new Error("Slot extraction API failed");
    }

    return await response.json();
  } catch (error) {
    console.error("Slot extraction error:", error);
    // Fallback: return empty slots
    return {
      slots: {},
      confidence: 0,
    };
  }
}
