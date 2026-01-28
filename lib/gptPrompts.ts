import { getOpenAIClient } from "./openai";

/**
 * GPT Helper: Call OpenAI with prompt and return parsed JSON
 */
async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<any> {
  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "response",
          strict: true,
          schema: {
            type: "object",
            properties: {},
            additionalProperties: true,
          },
        },
      },
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    return JSON.parse(content);
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw error;
  }
}

/**
 * Prompt A: Classify intent and extract normalized dining preferences
 */
export async function classifyAndExtract(userMessage: string): Promise<{
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
  const currentDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
  const systemPrompt = `You are a restaurant assistant message parser. Output strict JSON only. No extra text.`;
  
  const userPrompt = `Classify intent and extract normalized dining preferences from this message.
CURRENT DATE: ${currentDate} (use this as reference for relative dates like "today", "tomorrow")
intent must be one of:
"greeting_or_offtopic", "restaurant_request", "slot_answer", "refinement", "other"
Extract if present else null:
area, cuisine, budget_label, budget_range(1-4), partySize, date, time, notes
Normalization rules:
- If message mentions a dish/food, infer cuisine when reasonable:
  tiramisu/pasta/pizza -> Italian
  sushi/ramen -> Japanese
  tacos/burrito -> Mexican
  shawarma/manakish -> Lebanese
  steak -> Steakhouse/American
- Handle typos as best guess but include confidence 0-1 for area/cuisine.
- Budget mapping:
  low/cheap/budget -> 1
  mid/medium/moderate -> 2 (note: "mid" is common and valid)
  high/expensive -> 3
  luxury/fine dining -> 4
  Numbers: "1" -> 1, "2" -> 2, "3" -> 3, "4" -> 4 (direct mapping)
  Dollar amounts: "$50-100", "50-100" -> 1, "$100-200", "100-200" -> 2, "$200-400", "200-400" -> 3, "$400+", "400+" -> 4
- Date parsing (IMPORTANT: Current date is ${currentDate}):
  "today" -> ${currentDate}
  "tomorrow" -> ${new Date(Date.now() + 86400000).toISOString().split("T")[0]}
  Relative dates should be converted to YYYY-MM-DD format using current date as reference
  Examples: "next monday", "friday", "this weekend" -> convert to YYYY-MM-DD
- Time hints: 8pm, 20:00 -> normalize to HH:mm format
Return exactly:
{
  "intent": "...",
  "extracted": {
    "area": {"value": string|null, "confidence": number},
    "cuisine": {"value": string|null, "confidence": number},
    "budget": {"label": string|null, "range": 1|2|3|4|null},
    "partySize": number|null,
    "date": {"value": string|null, "confidence": number},
    "time": {"value": string|null, "confidence": number},
    "notes": string|null
  }
}
Message: """${userMessage}"""`;

  const schema = {
    type: "object",
    properties: {
      intent: {
        type: "string",
        enum: ["greeting_or_offtopic", "restaurant_request", "slot_answer", "refinement", "other"],
      },
      extracted: {
        type: "object",
        properties: {
          area: {
            type: "object",
            properties: {
              value: { type: ["string", "null"] },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["value", "confidence"],
            additionalProperties: false,
          },
          cuisine: {
            type: "object",
            properties: {
              value: { type: ["string", "null"] },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["value", "confidence"],
            additionalProperties: false,
          },
          budget: {
            type: "object",
            properties: {
              label: { type: ["string", "null"] },
              range: { type: ["integer", "null"], minimum: 1, maximum: 4 },
            },
            required: ["label", "range"],
            additionalProperties: false,
          },
          partySize: { type: ["integer", "null"] },
          date: {
            type: "object",
            properties: {
              value: { type: ["string", "null"] },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["value", "confidence"],
            additionalProperties: false,
          },
          time: {
            type: "object",
            properties: {
              value: { type: ["string", "null"] },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["value", "confidence"],
            additionalProperties: false,
          },
          notes: { type: ["string", "null"] },
        },
        required: ["area", "cuisine", "budget", "partySize", "date", "time", "notes"],
        additionalProperties: false,
      },
    },
    required: ["intent", "extracted"],
    additionalProperties: false,
  };

  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "classify_extract",
          strict: true,
          schema: schema as any,
        },
      },
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("No response from OpenAI");
    return JSON.parse(content);
  } catch (error) {
    console.error("Classify and extract error:", error);
    // Fallback
    return {
      intent: "other",
      extracted: {
        area: { value: null, confidence: 0 },
        cuisine: { value: null, confidence: 0 },
        budget: { label: null, range: null },
        partySize: null,
        date: { value: null, confidence: 0 },
        time: { value: null, confidence: 0 },
        notes: null,
      },
    };
  }
}

/**
 * Prompt B: Validate a slot answer
 */
export async function validateSlot(
  slotName: "area" | "cuisine" | "budget" | "date" | "time" | "partySize" | "notes",
  userReply: string,
  supportedChoices?: string[]
): Promise<{
  slot: string;
  value: string | number | null;
  normalized: string | number | null;
  confidence: number;
}> {
  const currentDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
  const systemPrompt = `You validate a short user reply to a specific slot question. Output strict JSON only.`;
  
  const choicesText = supportedChoices ? JSON.stringify(supportedChoices) : "[]";
  const dateRules = slotName === "date" ? `
- date (CURRENT DATE: ${currentDate}): normalize to yyyy-mm-dd format using current date as reference:
  "today" -> ${currentDate}
  "tomorrow" -> ${new Date(Date.now() + 86400000).toISOString().split("T")[0]}
  "next monday", "friday", etc. -> calculate and return as YYYY-MM-DD
  Relative dates MUST be converted to actual dates, not kept as natural language.` : `- date: normalize to yyyy-mm-dd if possible else keep natural language.`;
  
  const userPrompt = `Slot: "${slotName}" (area|cuisine|budget|date|time|partySize|notes)
CURRENT DATE: ${currentDate}${slotName === "date" ? " (use this as reference for relative dates)" : ""}
Supported choices (if any): ${choicesText}
User reply: """${userReply}"""
Return:
{
  "slot": "${slotName}",
  "value": string|number|null,
  "normalized": string|number|null,
  "confidence": number
}
Rules:
- If reply does NOT answer the slot, normalized must be null and confidence <= 0.3.
- budget: normalized must be 1-4 (number). Mapping:
  Text: low/cheap/budget -> 1, mid/medium/moderate -> 2, high/expensive -> 3, luxury/fine dining -> 4. "mid" is common and valid, map it to 2.
  Numbers: "1" -> 1, "2" -> 2, "3" -> 3, "4" -> 4 (direct mapping if user says just the number)
  Dollar amounts (per person, approximate): $50-100 or "50-100" -> 1, $100-200 or "100-200" -> 2, $200-400 or "200-400" -> 3, $400+ or "400+" -> 4
- partySize: normalized integer.
- time: normalize to HH:mm if possible.
${dateRules}`;

  const schema = {
    type: "object",
    properties: {
      slot: { type: "string" },
      value: { type: ["string", "number", "null"] },
      normalized: { type: ["string", "number", "null"] },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
    required: ["slot", "value", "normalized", "confidence"],
    additionalProperties: false,
  };

  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "validate_slot",
          strict: true,
          schema: schema as any,
        },
      },
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("No response from OpenAI");
    return JSON.parse(content);
  } catch (error) {
    console.error("Validate slot error:", error);
    return {
      slot: slotName,
      value: null,
      normalized: null,
      confidence: 0,
    };
  }
}

/**
 * Prompt C: Normalize area/cuisine to DB values
 */
export async function normalizeToDB(
  rawArea: string | null,
  rawCuisine: string | null,
  supportedAreas: string[],
  supportedCuisines: string[]
): Promise<{
  areaMatch: { input: string | null; matched: string | null; confidence: number };
  cuisineMatch: { input: string | null; matched: string | null; confidence: number };
  unavailable: { area: boolean; cuisine: boolean };
}> {
  const systemPrompt = `You map extracted values to the closest supported database values. Output strict JSON only.`;
  
  const userPrompt = `Supported areas: ${JSON.stringify(supportedAreas)}
Supported cuisines: ${JSON.stringify(supportedCuisines)}
Input:
{ "area": "${rawArea || ""}", "cuisine": "${rawCuisine || ""}" }
Return:
{
  "areaMatch": {"input": string|null, "matched": string|null, "confidence": number},
  "cuisineMatch": {"input": string|null, "matched": string|null, "confidence": number},
  "unavailable": {"area": boolean, "cuisine": boolean}
}
Rules:
- If input is null: matched null, unavailable false.
- If no close match exists: matched null and unavailable true.`;

  const schema = {
    type: "object",
    properties: {
      areaMatch: {
        type: "object",
        properties: {
          input: { type: ["string", "null"] },
          matched: { type: ["string", "null"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["input", "matched", "confidence"],
        additionalProperties: false,
      },
      cuisineMatch: {
        type: "object",
        properties: {
          input: { type: ["string", "null"] },
          matched: { type: ["string", "null"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["input", "matched", "confidence"],
        additionalProperties: false,
      },
      unavailable: {
        type: "object",
        properties: {
          area: { type: "boolean" },
          cuisine: { type: "boolean" },
        },
        required: ["area", "cuisine"],
        additionalProperties: false,
      },
    },
    required: ["areaMatch", "cuisineMatch", "unavailable"],
    additionalProperties: false,
  };

  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "normalize_db",
          strict: true,
          schema: schema as any,
        },
      },
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("No response from OpenAI");
    return JSON.parse(content);
  } catch (error) {
    console.error("Normalize to DB error:", error);
    return {
      areaMatch: { input: rawArea, matched: null, confidence: 0 },
      cuisineMatch: { input: rawCuisine, matched: null, confidence: 0 },
      unavailable: { area: !!rawArea, cuisine: !!rawCuisine },
    };
  }
}
