import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai";
import { getAvailableCuisines, getAvailableVibes, getAvailableDietary } from "@/lib/restaurants";
import { getAvailableAreas } from "@/lib/parser";

interface AnalyzeAnswerRequest {
  question: string;
  userAnswer: string;
  questionType: "area" | "mealTime" | "partySize" | "budget" | "cuisine" | "vibe" | "dietary";
  availableValues?: string[];
}

interface AnalyzeAnswerResponse {
  interpretation: string | null; // The mapped value (e.g., "American" for "burgers")
  confidence: number; // 0-1
  isOffTopic: boolean;
  offTopicConfidence: number; // 0-1
  message?: string; // Message to show user if validation fails
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeAnswerRequest = await request.json();
    const { question, userAnswer, questionType, availableValues } = body;

    if (!question || !userAnswer || !questionType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const openai = getOpenAIClient();

    // Build context based on question type
    let contextPrompt = "";
    let outputSchema: any;

    if (questionType === "cuisine") {
      const cuisines = availableValues || getAvailableCuisines();
      contextPrompt = `Available cuisines: ${cuisines.join(", ")}`;
      outputSchema = {
        type: "object",
        properties: {
          interpretation: {
            type: "string",
            description: `The exact cuisine name from the available list that best matches the user's answer, or null if no good match`,
            enum: cuisines.length > 0 ? cuisines : undefined,
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
            description: "Confidence that the interpretation is correct (0-1)",
          },
          isOffTopic: {
            type: "boolean",
            description: "True if the answer is clearly off-topic (not about cuisine/restaurants)",
          },
          offTopicConfidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
            description: "Confidence that the answer is off-topic (0-1)",
          },
          message: {
            type: "string",
            description: "Friendly message to show user if interpretation is unclear or off-topic",
          },
        },
        required: ["interpretation", "confidence", "isOffTopic", "offTopicConfidence", "message"],
        additionalProperties: false,
      };
    } else if (questionType === "area") {
      const areas = availableValues || getAvailableAreas();
      contextPrompt = `Available areas: ${areas.join(", ")}`;
      outputSchema = {
        type: "object",
        properties: {
          interpretation: {
            type: "string",
            description: `The exact area name from the available list that best matches the user's answer. Must be one of: ${areas.join(", ")}. If the answer is a cuisine/food type (like "italian", "pizza") instead of a location, return the string "null"`,
            enum: areas.length > 0 ? areas : undefined,
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
          },
          isOffTopic: {
            type: "boolean",
          },
          offTopicConfidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
          },
          message: {
            type: "string",
          },
        },
        required: ["interpretation", "confidence", "isOffTopic", "offTopicConfidence", "message"],
        additionalProperties: false,
      };
    } else if (questionType === "budget") {
      contextPrompt = "Available budgets: cheap, mid, high";
      outputSchema = {
        type: "object",
        properties: {
          interpretation: {
            type: "string",
            enum: ["cheap", "mid", "high"],
            description: "The budget level, or null if unclear",
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
          },
          isOffTopic: {
            type: "boolean",
          },
          offTopicConfidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
          },
          message: {
            type: "string",
          },
        },
        required: ["interpretation", "confidence", "isOffTopic", "offTopicConfidence", "message"],
        additionalProperties: false,
      };
    } else if (questionType === "mealTime") {
      contextPrompt = "Available meal times: breakfast, lunch, dinner, coffee, drinks, late-night";
      outputSchema = {
        type: "object",
        properties: {
          interpretation: {
            type: "string",
            enum: ["breakfast", "lunch", "dinner", "coffee", "drinks", "late-night"],
            description: "The meal time, or null if unclear",
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
          },
          isOffTopic: {
            type: "boolean",
          },
          offTopicConfidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
          },
          message: {
            type: "string",
          },
        },
        required: ["interpretation", "confidence", "isOffTopic", "offTopicConfidence", "message"],
        additionalProperties: false,
      };
    } else if (questionType === "vibe") {
      contextPrompt = "Available vibes: romantic, lively, quiet, outdoor, family, business";
      outputSchema = {
        type: "object",
        properties: {
          interpretation: {
            type: "string",
            enum: ["romantic", "lively", "quiet", "outdoor", "family", "business"],
            description: "The vibe, or null if unclear",
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
          },
          isOffTopic: {
            type: "boolean",
          },
          offTopicConfidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
          },
          message: {
            type: "string",
          },
        },
        required: ["interpretation", "confidence", "isOffTopic", "offTopicConfidence", "message"],
        additionalProperties: false,
      };
    } else {
      // For partySize and dietary, use simpler validation
      return NextResponse.json({
        interpretation: userAnswer,
        confidence: 0.8,
        isOffTopic: false,
        offTopicConfidence: 0.1,
      });
    }

    // Build context-specific instructions
    let typeSpecificGuidance = "";
    if (questionType === "area") {
      const areas = availableValues || getAvailableAreas();
      typeSpecificGuidance = `This question asks for a LOCATION/NEIGHBORHOOD/AREA from the available areas: ${areas.join(", ")}.

IMPORTANT: Use natural language understanding to interpret location-related expressions.
- Only match if the answer clearly refers to one of the available locations
- If the user answers with a CUISINE (like "italian") or FOOD TYPE (like "pizza"), mark as OFF-TOPIC
- If the user answers with a location NOT in the available list (like "dubai", "new york"), mark as OFF-TOPIC and explain it's not in our database
- Only mark as off-topic if the answer cannot be reasonably interpreted as one of the available areas`;
    } else if (questionType === "cuisine") {
      const cuisines = availableValues || getAvailableCuisines();
      typeSpecificGuidance = `This question asks for a CUISINE TYPE from the available cuisines: ${cuisines.join(", ")}.

IMPORTANT: Use natural language understanding to interpret food-related expressions.
- Interpret food names and dishes contextually (e.g., "burgers" -> "American", "pizza" -> "Italian", "sushi" -> "Japanese")
- Be generous - if it makes sense in context, map it to the closest match
- If the user answers with a LOCATION/AREA instead, mark as OFF-TOPIC
- If the user answers with a cuisine type NOT in the available list, mark as OFF-TOPIC and explain it's not in our database
- Only mark as off-topic if the answer cannot be reasonably interpreted as a cuisine`;
    } else if (questionType === "budget") {
      typeSpecificGuidance = `This question asks for a BUDGET LEVEL: cheap, mid, or high.

IMPORTANT: Use natural language understanding to interpret price-related expressions.
- Interpret cost-related terms contextually (e.g., "affordable", "expensive", "budget-friendly", "$", "$$$")
- Be generous - if it makes sense in context, map it to the closest match
- Only mark as off-topic if the answer cannot be reasonably interpreted as a budget level`;
    } else if (questionType === "mealTime") {
      typeSpecificGuidance = `This question asks for a MEAL TIME: breakfast, lunch, dinner, coffee, drinks, or late-night.

IMPORTANT: Use natural language understanding to interpret time-related expressions.
- Interpret time expressions contextually (e.g., "noon"/"midday"/"during the day"/"lunchtime" -> "lunch")
- Interpret meal names and time periods that relate to meal times
- Be generous - if it makes sense in context, map it to the closest match
- Only mark as off-topic if the answer cannot be reasonably interpreted as a meal time`;
    } else if (questionType === "vibe") {
      typeSpecificGuidance = `This question asks for a VIBE: romantic, lively, quiet, outdoor, family, or business.

IMPORTANT: Use natural language understanding to interpret atmosphere-related expressions.
- Interpret atmosphere descriptions contextually (e.g., "casual", "fancy", "cozy", "energetic")
- Be generous - if it makes sense in context, map it to the closest match
- Only mark as off-topic if the answer cannot be reasonably interpreted as an atmosphere/vibe`;
    }

    const systemPrompt = `You are a helpful restaurant assistant analyzing user answers to questions.

Question: "${question}"
User Answer: "${userAnswer}"
Question Type: ${questionType}
${contextPrompt}

${typeSpecificGuidance}

Your task:
1. Use your natural language understanding to interpret what the user means
2. Try to map the user's answer to one of the available values using common sense and context
   - Interpret expressions contextually (e.g., "noon" -> "lunch", "burgers" -> "American", "affordable" -> "cheap")
   - Be GENEROUS with interpretations - if it makes sense contextually, map it to the closest match
3. If you can reasonably interpret the answer as matching one of the available values:
   - Set isOffTopic = false
   - Set offTopicConfidence = 0.1 or lower
   - Set interpretation to the matched value
   - Set confidence based on how clear the match is (0.7+ for obvious matches, 0.5-0.7 for reasonable interpretations)
   - Only provide a message if confidence is low and you need clarification
4. If you truly cannot interpret the answer as matching any available value:
   - Set isOffTopic = true
   - Set offTopicConfidence = 0.9 or higher
   - Set confidence = 0.3 or lower
   - Use the FIRST available value as interpretation (placeholder, will be ignored)
   - Provide a helpful message listing available options

CRITICAL PRINCIPLE: Use your natural language understanding FIRST. Only mark as off-topic if the answer genuinely cannot be understood in the context of the question category. Be generous with interpretations that make sense contextually.

Guidelines:
- Use friendly, supportive tone in messages
- When marking as off-topic because the answer isn't in the database, explain it's not available and list some options
- When off-topic, the interpretation value will be ignored, so use any enum value as placeholder`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "answer_analysis",
          strict: true,
          schema: outputSchema,
        },
      },
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const result = JSON.parse(content) as any;
    
    // Handle "null" string as null (OpenAI may return string "null" for enum values)
    const interpretation = result.interpretation === "null" || result.interpretation === null ? null : result.interpretation;

    const response: AnalyzeAnswerResponse = {
      interpretation,
      confidence: result.confidence,
      isOffTopic: result.isOffTopic,
      offTopicConfidence: result.offTopicConfidence,
      message: result.message,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Answer analysis error:", error);
    return NextResponse.json(
      {
        error: "Failed to analyze answer",
        details: process.env.NODE_ENV === "development" ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}
