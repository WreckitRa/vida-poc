import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai";
import { getAvailableCuisines } from "@/lib/restaurants";
import { getAvailableAreas } from "@/lib/parser";
import type { Slots } from "@/types";

interface ExtractSlotsRequest {
  userMessage: string;
  currentSlots?: Partial<Slots>;
  question?: string;
  questionType?: "area" | "mealTime" | "partySize" | "budget" | "cuisine" | "vibe" | "dietary";
}

interface ExtractSlotsResponse {
  slots: Partial<Slots>;
  confidence: number;
}

/**
 * Check if user message is just a greeting or casual response with no real content
 */
function isGreetingOrCasualResponse(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  const greetings = ["hello", "hi", "hey", "hiya", "hola", "greetings"];
  const casualResponses = ["ok", "okay", "sure", "thanks", "thank you", "cool", "yeah", "yep", "nah", "nope", "yes", "no"];
  
  // Check if message is just a greeting or casual response
  if (greetings.includes(normalized)) return true;
  if (casualResponses.includes(normalized)) return true;
  
  // Check if message is very short (1-2 words) and matches common patterns
  const words = normalized.split(/\s+/).filter(w => w.length > 0);
  if (words.length <= 2 && (greetings.some(g => normalized.includes(g)) || casualResponses.some(r => normalized.includes(r)))) {
    return true;
  }
  
  return false;
}

/**
 * Validate that extracted slots are reasonable given the user message
 * Returns true if extraction is valid, false if it contains values not mentioned
 */
function validateExtraction(userMessage: string, extractedSlots: Partial<Slots>): boolean {
  const normalized = userMessage.toLowerCase();
  
  // If only area is extracted, that's fine (user might just mention location)
  const hasOnlyArea = extractedSlots.area && 
    !extractedSlots.mealTime && 
    !extractedSlots.partySize && 
    !extractedSlots.budget && 
    (!extractedSlots.cravingCuisines || extractedSlots.cravingCuisines.length === 0) &&
    !extractedSlots.vibe &&
    (!extractedSlots.dietary || extractedSlots.dietary.length === 0);
  
  if (hasOnlyArea) return true;
  
  // Check if mealTime was extracted - should have time-related keywords
  if (extractedSlots.mealTime) {
    const timeKeywords = ["breakfast", "lunch", "dinner", "coffee", "drinks", "morning", "afternoon", "evening", "night", "noon", "pm", "am", "time"];
    if (!timeKeywords.some(kw => normalized.includes(kw))) {
      return false; // Meal time extracted but no time keywords in message
    }
  }
  
  // Check if partySize was extracted - should have number or people-related keywords
  if (extractedSlots.partySize) {
    const numberPattern = /\d+|one|two|three|four|five|six|seven|eight|nine|ten/;
    const peopleKeywords = ["people", "person", "party", "guests", "group"];
    if (!numberPattern.test(normalized) && !peopleKeywords.some(kw => normalized.includes(kw))) {
      return false; // Party size extracted but no number/people keywords
    }
  }
  
  // Check if budget was extracted - should have budget-related keywords
  if (extractedSlots.budget) {
    const budgetKeywords = ["budget", "price", "cheap", "expensive", "affordable", "upscale", "premium", "mid", "medium", "moderate", "high", "low"];
    if (!budgetKeywords.some(kw => normalized.includes(kw))) {
      return false; // Budget extracted but no budget keywords in message
    }
  }
  
  // Check if cuisines were extracted - should have cuisine-related keywords
  if (extractedSlots.cravingCuisines && extractedSlots.cravingCuisines.length > 0) {
    // This is harder to validate precisely, but if user only mentioned area, cuisines shouldn't be extracted
    // For now, if message is very short (just area), reject cuisine extraction
    const words = normalized.split(/\s+/).filter(w => w.length > 0);
    if (words.length <= 3) {
      // Very short message - likely just area, reject cuisine extraction
      return false;
    }
  }
  
  // Check if vibe was extracted - should have vibe-related keywords
  if (extractedSlots.vibe) {
    const vibeKeywords = ["romantic", "lively", "quiet", "outdoor", "family", "business", "casual", "intimate", "fun", "peaceful", "atmosphere", "vibe"];
    if (!vibeKeywords.some(kw => normalized.includes(kw))) {
      return false; // Vibe extracted but no vibe keywords in message
    }
  }
  
  // Check if dietary was extracted - should have dietary-related keywords
  if (extractedSlots.dietary && extractedSlots.dietary.length > 0) {
    const dietaryKeywords = ["vegetarian", "vegan", "gluten", "halal", "kosher", "dietary", "allergy", "allergies", "restriction"];
    if (!dietaryKeywords.some(kw => normalized.includes(kw))) {
      return false; // Dietary extracted but no dietary keywords in message
    }
  }
  
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const body: ExtractSlotsRequest = await request.json();
    const { userMessage, currentSlots = {}, question, questionType } = body;

    if (!userMessage) {
      return NextResponse.json(
        { error: "Missing userMessage" },
        { status: 400 }
      );
    }

    // Validate: If user message is just a greeting/casual response, return empty slots immediately
    if (isGreetingOrCasualResponse(userMessage)) {
      return NextResponse.json({
        slots: {},
        confidence: 0,
      });
    }

    const openai = getOpenAIClient();
    const knownAreas = getAvailableAreas();
    const knownCuisines = getAvailableCuisines();

    const outputSchema = {
      type: "object",
      properties: {
        area: {
          type: "string",
          nullable: true,
          description: `The area/location from: ${knownAreas.join(", ")}. Extract the most specific match. For example, "dubai marina" should map to "Dubai Marina" not just "Dubai". Return null if no area is mentioned.`,
          enum: knownAreas.length > 0 ? knownAreas : undefined,
        },
        mealTime: {
          type: "string",
          nullable: true,
          enum: ["breakfast", "lunch", "dinner", "coffee", "drinks", "late-night"],
          description: "The meal time. Interpret time expressions contextually (e.g., '8pm', 'evening' -> 'dinner', 'noon' -> 'lunch'). Return null if not mentioned.",
        },
        partySize: {
          type: "number",
          nullable: true,
          description: "Number of people (1-20). Extract from phrases like 'for three people', 'for 3', 'party of 4', etc. Return null if not mentioned.",
          minimum: 1,
          maximum: 20,
        },
        budget: {
          type: "string",
          nullable: true,
          enum: ["cheap", "mid", "high"],
          description: "Budget level. ONLY extract if budget is EXPLICITLY mentioned. Interpret: 'high budget', 'expensive', 'upscale', 'premium' -> 'high'; 'low budget', 'cheap', 'affordable' -> 'cheap'; 'mid', 'medium', 'moderate' -> 'mid'. Return null if budget is NOT explicitly mentioned in the message.",
        },
        cravingCuisines: {
          type: "array",
          items: {
            type: "string",
            enum: knownCuisines.length > 0 ? knownCuisines : undefined,
          },
          description: `Array of cuisine types from: ${knownCuisines.join(", ")}. Extract from mentions like 'italian restaurant', 'i want sushi', 'chinese food', etc. Return empty array if not mentioned.`,
        },
        vibe: {
          type: "string",
          nullable: true,
          enum: ["romantic", "lively", "quiet", "outdoor", "family", "business"],
          description: "Atmosphere/vibe. ONLY extract if vibe/atmosphere is EXPLICITLY mentioned. Interpret: 'romantic', 'intimate' -> 'romantic'; 'lively', 'casual', 'fun' -> 'lively'; 'quiet', 'peaceful' -> 'quiet'; etc. Return null if vibe is NOT explicitly mentioned in the message.",
        },
        dietary: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Dietary requirements like 'vegetarian', 'vegan', 'gluten-free', 'halal', etc. Return empty array if not mentioned.",
        },
      },
      required: ["area", "mealTime", "partySize", "budget", "cravingCuisines", "vibe", "dietary"],
      additionalProperties: false,
    };

    // Build question-specific guidance
    let questionGuidance = "";
    if (question && questionType) {
      questionGuidance = `\n\nIMPORTANT CONTEXT: The user is answering this specific question:
Question: "${question}"
Question Type: ${questionType}

Focus on extracting the answer to this question, but also extract any other restaurant-related information the user might provide.

${questionType === "area" ? `The user is being asked for a LOCATION/AREA. Extract the most specific area match from: ${knownAreas.join(", ")}. For example, "dubai marina" should map to "Dubai Marina" not just "Dubai".` : ""}
${questionType === "budget" ? `The user is being asked for a BUDGET LEVEL. Interpret phrases like "high budget", "expensive", "upscale", "premium" -> "high"; "cheap", "affordable", "low budget" -> "cheap"; "mid", "medium", "moderate" -> "mid".` : ""}
${questionType === "mealTime" ? `The user is being asked for a MEAL TIME. Interpret time expressions contextually (e.g., "8pm", "evening" -> "dinner"; "noon", "midday", "lunchtime" -> "lunch"; "morning", "breakfast time" -> "breakfast").` : ""}
${questionType === "cuisine" ? `The user is being asked for a CUISINE TYPE. Interpret food names contextually (e.g., "burgers" -> "American", "pizza" -> "Italian", "sushi" -> "Japanese"). Available cuisines: ${knownCuisines.join(", ")}.` : ""}
${questionType === "vibe" ? `The user is being asked for a VIBE/ATMOSPHERE. Interpret descriptions contextually (e.g., "romantic", "intimate" -> "romantic"; "lively", "casual", "fun" -> "lively"; "quiet", "peaceful" -> "quiet").` : ""}
${questionType === "partySize" ? `The user is being asked for NUMBER OF PEOPLE. Extract from phrases like "for three people", "party of 4", "just me", "two of us", etc.` : ""}
${questionType === "dietary" ? `The user is being asked for DIETARY REQUIREMENTS. Extract terms like "vegetarian", "vegan", "gluten-free", "halal", etc.` : ""}`;
    }

    const systemPrompt = `You are a helpful restaurant assistant extracting information from user messages.

Current known information: ${JSON.stringify(currentSlots, null, 2)}
Available areas: ${knownAreas.join(", ")}
Available cuisines: ${knownCuisines.join(", ")}${questionGuidance}

Your task:
1. Extract ONLY restaurant-related information that is EXPLICITLY mentioned in the user's message
2. Use natural language understanding to interpret what the user means, but ONLY if they are clearly providing information
3. Map to the exact values from the available lists
4. For areas: Use the MOST SPECIFIC match (e.g., "dubai marina" -> "Dubai Marina", not just "Dubai")
5. For budgets: Interpret phrases like "high budget", "expensive", "upscale" -> "high"; "cheap", "affordable", "low budget" -> "cheap". ONLY extract if budget is explicitly mentioned.
6. For meal times: Interpret times and phrases (e.g., "8pm", "evening" -> "dinner"; "noon", "lunchtime" -> "lunch"). ONLY extract if time/meal is explicitly mentioned.
7. CRITICAL: Do NOT infer or assume values. Return null/empty for ALL fields if the message contains only greetings (like "hello", "hi", "hey"), casual responses, or does not contain explicit restaurant-related information.
8. Do NOT overwrite existing values in currentSlots unless the user explicitly mentions changing them
9. Examples of messages that should return ALL null/empty values: "hello", "hi", "hey", "ok", "sure", "thanks", "cool"

Be precise and use the exact enum values from the schema. Only extract what is explicitly stated.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "slot_extraction",
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

    // Build the slots object, only including non-null/non-empty values
    const slots: Partial<Slots> = {};
    if (result.area && result.area !== "null") {
      slots.area = result.area;
    }
    if (result.mealTime && result.mealTime !== "null") {
      slots.mealTime = result.mealTime as Slots["mealTime"];
    }
    if (result.partySize !== null && result.partySize !== undefined) {
      slots.partySize = result.partySize;
    }
    if (result.budget && result.budget !== "null") {
      slots.budget = result.budget as Slots["budget"];
    }
    if (result.cravingCuisines && Array.isArray(result.cravingCuisines) && result.cravingCuisines.length > 0) {
      slots.cravingCuisines = result.cravingCuisines.filter((c: string) => c !== "null");
    }
    if (result.vibe && result.vibe !== "null") {
      slots.vibe = result.vibe as Slots["vibe"];
    }
    if (result.dietary && Array.isArray(result.dietary) && result.dietary.length > 0) {
      slots.dietary = result.dietary.filter((d: string) => d !== "null");
    }

    // Validate extraction - if values were extracted that don't match the user message, reject them
    if (!validateExtraction(userMessage, slots)) {
      // Extraction is invalid - only keep area if it was extracted, clear everything else
      const validatedSlots: Partial<Slots> = {};
      if (slots.area) {
        validatedSlots.area = slots.area;
      }
      return NextResponse.json({
        slots: validatedSlots,
        confidence: 0.5, // Lower confidence due to validation rejection
      });
    }

    const response: ExtractSlotsResponse = {
      slots,
      confidence: 0.9, // GPT extraction is generally high confidence
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Slot extraction error:", error);
    return NextResponse.json(
      {
        error: "Failed to extract slots",
        details: process.env.NODE_ENV === "development" ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}
