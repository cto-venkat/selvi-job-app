import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauth" }, { status: 401 });
  }

  try {
    // Query today's job discovery counts
    const todayJobs = await db.execute(sql`
      SELECT count(*)::int as count FROM jobs
      WHERE discovered_at >= CURRENT_DATE AND tenant_id = ${session.tenantId}
    `);

    // Query today's CV package count
    const todayCvs = await db.execute(sql`
      SELECT count(*)::int as count FROM cv_packages
      WHERE created_at >= CURRENT_DATE AND tenant_id = ${session.tenantId}
    `);

    // Query ghosted detection count
    const todayGhosted = await db.execute(sql`
      SELECT count(*)::int as count FROM applications
      WHERE current_state = 'ghosted' AND tenant_id = ${session.tenantId}
    `);

    const jobsFound = Number(todayJobs.rows[0]?.count ?? 0);
    const cvsTailored = Number(todayCvs.rows[0]?.count ?? 0);
    const ghostedDetected = Number(todayGhosted.rows[0]?.count ?? 0);

    return NextResponse.json({
      lastScanTime: "N/A",
      lastScanDate: new Date().toISOString(),
      todaySummary: {
        jobsFound,
        cvsTailored,
        ghostedDetected,
        emailsClassified: 0,
        followUpsSent: 0,
      },
      recentActions: [],
    });
  } catch (error) {
    console.error("Activity API error:", error);
    return NextResponse.json({
      lastScanTime: "N/A",
      lastScanDate: new Date().toISOString(),
      todaySummary: {
        jobsFound: 0,
        cvsTailored: 0,
        ghostedDetected: 0,
        emailsClassified: 0,
        followUpsSent: 0,
      },
      recentActions: [],
    });
  }
}
