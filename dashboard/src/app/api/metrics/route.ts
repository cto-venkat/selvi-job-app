import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { mockMetricsWeekly, mockSourceData, mockPipelineFunnel } from "@/lib/mock-data";

export async function GET() {
  try {
    // Query pipeline_metrics table for recent weekly metrics
    const metricsResult = await db.execute(sql`
      SELECT metric_name, metric_value::float as metric_value, dimensions, period_start, period_end, period_type
      FROM pipeline_metrics
      WHERE period_type = 'weekly'
      ORDER BY period_start DESC
      LIMIT 50
    `);

    // Query application sources
    const sourcesResult = await db.execute(sql`
      SELECT discovery_source as source, count(*)::int as count
      FROM applications
      WHERE discovery_source IS NOT NULL
      GROUP BY discovery_source
      ORDER BY count DESC
    `);

    // Build funnel from live data
    const funnelResult = await db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM jobs) as discovered,
        (SELECT count(*)::int FROM jobs WHERE composite_score IS NOT NULL) as scored,
        (SELECT count(*)::int FROM jobs WHERE ready_to_apply = true) as cv_ready,
        (SELECT count(*)::int FROM applications WHERE current_state NOT IN ('accepted','declined','rejected','withdrawn','ghosted','expired')) as applied,
        (SELECT count(*)::int FROM applications WHERE current_state = 'interviewing') as interviewing,
        (SELECT count(*)::int FROM applications WHERE current_state = 'offered') as offered
    `);

    const funnelRow = funnelResult.rows[0] as Record<string, unknown> | undefined;

    // If we have pipeline_metrics data, format it; otherwise fall back to mock
    const hasMetrics = metricsResult.rows.length > 0;
    const hasSources = sourcesResult.rows.length > 0;

    const funnel = funnelRow ? [
      { stage: "Discovered", count: Number(funnelRow.discovered ?? 0) },
      { stage: "Scored", count: Number(funnelRow.scored ?? 0) },
      { stage: "CV Ready", count: Number(funnelRow.cv_ready ?? 0) },
      { stage: "Applied", count: Number(funnelRow.applied ?? 0) },
      { stage: "Interviewing", count: Number(funnelRow.interviewing ?? 0) },
      { stage: "Offered", count: Number(funnelRow.offered ?? 0) },
    ] : mockPipelineFunnel;

    const sources = hasSources
      ? sourcesResult.rows.map((r: Record<string, unknown>) => ({ source: r.source as string, count: Number(r.count) }))
      : mockSourceData;

    return NextResponse.json({
      weekly: hasMetrics ? metricsResult.rows : mockMetricsWeekly,
      sources,
      funnel,
    });
  } catch (error) {
    console.error("Metrics API error:", error);
    return NextResponse.json({
      weekly: mockMetricsWeekly,
      sources: mockSourceData,
      funnel: mockPipelineFunnel,
    });
  }
}
