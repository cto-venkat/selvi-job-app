import { NextResponse } from "next/server";
import { mockMetricsWeekly, mockSourceData, mockPipelineFunnel } from "@/lib/mock-data";

export async function GET() {
  // In production: query pipeline_metrics table with tenant scoping
  return NextResponse.json({
    weekly: mockMetricsWeekly,
    sources: mockSourceData,
    funnel: mockPipelineFunnel,
  });
}
