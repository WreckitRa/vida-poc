import { NextRequest, NextResponse } from "next/server";
import { validateSlot } from "@/lib/gptPrompts";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slotName, userReply, supportedChoices } = body;

    if (!slotName || !userReply) {
      return NextResponse.json(
        { error: "Missing slotName or userReply" },
        { status: 400 }
      );
    }

    const result = await validateSlot(
      slotName as any,
      userReply,
      supportedChoices
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("Validate slot error:", error);
    return NextResponse.json(
      { error: "Failed to validate slot" },
      { status: 500 }
    );
  }
}
