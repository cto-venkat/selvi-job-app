import { NextResponse } from "next/server";
import { mockFunnelData } from "@/lib/mock-data";

export async function GET() {
  // In production: query DB with tenant scoping
  return NextResponse.json(mockFunnelData);
}
