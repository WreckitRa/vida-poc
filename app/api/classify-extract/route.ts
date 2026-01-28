import { NextRequest, NextResponse } from "next/server";
import { classifyAndExtract } from "@/lib/gptPrompts";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userMessage } = body;

    if (!userMessage) {
      return NextResponse.json({ error: "Missing userMessage" }, { status: 400 });
    }

    const result = await classifyAndExtract(userMessage);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Classify extract error:", error);
    return NextResponse.json(
      { error: "Failed to classify and extract" },
      { status: 500 }
    );
  }
}
