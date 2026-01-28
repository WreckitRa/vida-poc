/**
 * Analyze user answer using GPT to validate and interpret
 */

export interface AnswerAnalysis {
  interpretation: string | null;
  confidence: number;
  isOffTopic: boolean;
  offTopicConfidence: number;
  message?: string;
}

export type QuestionType = "area" | "mealTime" | "partySize" | "budget" | "cuisine" | "vibe" | "dietary";

/**
 * Analyze user answer against a question using GPT
 */
export async function analyzeAnswer(
  question: string,
  userAnswer: string,
  questionType: QuestionType,
  availableValues?: string[]
): Promise<AnswerAnalysis> {
  try {
    const response = await fetch("/api/analyze-answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        userAnswer,
        questionType,
        availableValues,
      }),
    });

    if (!response.ok) {
      throw new Error("Analysis API failed");
    }

    return await response.json();
  } catch (error) {
    console.error("Answer analysis error:", error);
    // Fallback: return answer as-is with medium confidence
    return {
      interpretation: userAnswer,
      confidence: 0.6,
      isOffTopic: false,
      offTopicConfidence: 0.2,
    };
  }
}
