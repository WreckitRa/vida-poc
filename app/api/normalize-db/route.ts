import { NextRequest, NextResponse } from "next/server";
import { normalizeToDB } from "@/lib/gptPrompts";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rawArea, rawCuisine, supportedAreas, supportedCuisines } = body;

    if (!supportedAreas || !supportedCuisines) {
      return NextResponse.json(
        { error: "Missing supportedAreas or supportedCuisines" },
        { status: 400 }
      );
    }

    const result = await normalizeToDB(
      rawArea || null,
      rawCuisine || null,
      supportedAreas,
      supportedCuisines
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("Normalize DB error:", error);
    return NextResponse.json(
      { error: "Failed to normalize to DB" },
      { status: 500 }
    );
  }
}
