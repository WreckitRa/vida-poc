import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai";

interface ParseDateRequest {
  dateString: string;
}

interface ParseDateResponse {
  date: string | null; // YYYY-MM-DD format or null if couldn't parse
  confidence: number; // 0-1
  originalInput: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ParseDateRequest = await request.json();
    const { dateString } = body;

    if (!dateString) {
      return NextResponse.json(
        { error: "Missing dateString field" },
        { status: 400 }
      );
    }

    const openai = getOpenAIClient();

    const outputSchema = {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "The parsed date in YYYY-MM-DD format, or null if the input cannot be interpreted as a date",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$|^null$",
        },
        confidence: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description: "Confidence that the parsed date is correct (0-1)",
        },
      },
      required: ["date", "confidence"],
      additionalProperties: false,
    };

    const systemPrompt = `You are a helpful assistant that parses human-written date expressions into YYYY-MM-DD format.

User Input: "${dateString}"

Your task:
1. Interpret the date expression using natural language understanding
2. Convert it to YYYY-MM-DD format (use the current date as reference: ${new Date().toISOString().split("T")[0]})
3. Examples:
   - "tomorrow" -> tomorrow's date in YYYY-MM-DD
   - "next monday" -> next Monday's date in YYYY-MM-DD
   - "friday" -> next Friday's date in YYYY-MM-DD (if today is Friday, that's today; if it's Saturday, it's the following Friday)
   - "in 3 days" -> date 3 days from today
   - "december 25" -> December 25 of the current year (or next year if it has passed)
   - "2024-12-25" -> return as-is if already in YYYY-MM-DD format
   - "january 15th" -> January 15 of the current year (or next year if it has passed)
   - "next week" -> 7 days from today
   - "this friday" -> this week's Friday (or next Friday if today is after Friday)
4. If the input cannot be interpreted as a date, return date: "null" and confidence: 0.3 or lower
5. Set confidence based on how clear the interpretation is (0.9+ for obvious dates like "tomorrow", 0.7-0.9 for ambiguous ones like "next monday")

Important: Always return dates in YYYY-MM-DD format. Use the current date as a reference point.`;

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
          name: "date_parsing",
          strict: true,
          schema: outputSchema,
        },
      },
      temperature: 0.2, // Low temperature for consistent date parsing
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const result = JSON.parse(content) as any;
    
    // Handle "null" string as null
    const parsedDate = result.date === "null" || result.date === null ? null : result.date;

    const response: ParseDateResponse = {
      date: parsedDate,
      confidence: result.confidence,
      originalInput: dateString,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Date parsing error:", error);
    return NextResponse.json(
      {
        error: "Failed to parse date",
        details: process.env.NODE_ENV === "development" ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}