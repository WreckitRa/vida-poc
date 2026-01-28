import { NextResponse } from "next/server";

/** Health check for Railway and load balancers. */
export async function GET() {
  return NextResponse.json({ status: "ok" }, { status: 200 });
}
