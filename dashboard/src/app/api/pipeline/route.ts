import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPipelineCounts } from "@/lib/queries";
import { db } from "@/lib/db";
import { jobs } from "@/lib/schema";
import { sql, not, isNull, eq } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauth" }, { status: 401 });
  }

  try {
    const [discovered, scored, cvReady, pipeline] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(jobs).where(eq(jobs.tenantId, session.tenantId)).then((r) => Number(r[0]?.count ?? 0)),
      db.select({ count: sql<number>`count(*)` }).from(jobs).where(sql`tenant_id = ${session.tenantId} AND composite_score IS NOT NULL`).then((r) => Number(r[0]?.count ?? 0)),
      db.select({ count: sql<number>`count(*)` }).from(jobs).where(sql`tenant_id = ${session.tenantId} AND ready_to_apply = true`).then((r) => Number(r[0]?.count ?? 0)),
      getPipelineCounts(session.tenantId),
    ]);

    return NextResponse.json({
      discovered,
      scored,
      cvReady,
      applied: Number((pipeline as any)?.applied ?? 0),
      interviewing: Number((pipeline as any)?.interviewing ?? 0),
      offered: Number((pipeline as any)?.offered ?? 0),
    });
  } catch (error) {
    console.error("Pipeline API error:", error);
    return NextResponse.json({ discovered: 0, scored: 0, cvReady: 0, applied: 0, interviewing: 0, offered: 0 });
  }
}
