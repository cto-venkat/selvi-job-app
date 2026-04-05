import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { mockAiActivity } from "@/lib/mock-data";

export async function GET() {
  try {
    // Query recent notification log and application events for activity feed
    const recentActivity = await db.execute(sql`
      SELECT 'notification' as type, notification_type as action, sent_at as ts
      FROM notification_log
      ORDER BY sent_at DESC
      LIMIT 10
    `);

    // Query today's job discovery counts
    const todayJobs = await db.execute(sql`
      SELECT count(*)::int as count FROM jobs
      WHERE discovered_at >= CURRENT_DATE
    `);

    // Query today's CV package count
    const todayCvs = await db.execute(sql`
      SELECT count(*)::int as count FROM cv_packages
      WHERE created_at >= CURRENT_DATE
    `);

    // Query today's ghosted detection count
    const todayGhosted = await db.execute(sql`
      SELECT count(*)::int as count FROM applications
      WHERE current_state = 'ghosted'
    `);

    const jobsFound = Number(todayJobs.rows[0]?.count ?? 0);
    const cvsTailored = Number(todayCvs.rows[0]?.count ?? 0);
    const ghostedDetected = Number(todayGhosted.rows[0]?.count ?? 0);

    // If we have real data, format it
    if (jobsFound > 0 || cvsTailored > 0 || recentActivity.rows.length > 0) {
      const lastAction = recentActivity.rows[0] as Record<string, unknown> | undefined;
      const lastScanDate = lastAction?.ts ? new Date(lastAction.ts as string) : new Date();
      const minutesAgo = Math.floor((Date.now() - lastScanDate.getTime()) / 60000);
      const lastScanTime = minutesAgo < 60 ? `${minutesAgo} min ago` : `${Math.floor(minutesAgo / 60)}h ago`;

      return NextResponse.json({
        lastScanTime,
        lastScanDate,
        todaySummary: {
          jobsFound,
          cvsTailored,
          ghostedDetected,
          emailsClassified: 0,
          followUpsSent: 0,
        },
        recentActions: recentActivity.rows.slice(0, 6).map((r: Record<string, unknown>) => ({
          time: new Date(r.ts as string).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
          action: r.action as string,
        })),
      });
    }

    // Fall back to mock data
    return NextResponse.json(mockAiActivity);
  } catch (error) {
    console.error("Activity API error:", error);
    return NextResponse.json(mockAiActivity);
  }
}
