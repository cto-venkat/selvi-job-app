import { NextResponse } from "next/server";
import { mockAiActivity } from "@/lib/mock-data";

export async function GET() {
  // In production: query recent AI activity logs with tenant scoping
  return NextResponse.json(mockAiActivity);
}
