import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jobs } from "@/lib/schema";
import { sql, not, isNull, eq } from "drizzle-orm";
import { mockFunnelData } from "@/lib/mock-data";

export async function GET() {
  try {
    const [discovered, scored, cvReady, applied, interviewing, offered] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(jobs).then((r) => Number(r[0]?.count ?? 0)),
      db.select({ count: sql<number>`count(*)` }).from(jobs).where(not(isNull(jobs.compositeScore))).then((r) => Number(r[0]?.count ?? 0)),
      db.select({ count: sql<number>`count(*)` }).from(jobs).where(eq(jobs.readyToApply, true)).then((r) => Number(r[0]?.count ?? 0)),
      db.execute(sql`SELECT count(*)::int as count FROM applications WHERE current_state NOT IN ('accepted','declined','rejected','withdrawn','ghosted','expired')`).then((r) => Number(r.rows[0]?.count ?? 0)),
      db.execute(sql`SELECT count(*)::int as count FROM applications WHERE current_state = 'interviewing'`).then((r) => Number(r.rows[0]?.count ?? 0)),
      db.execute(sql`SELECT count(*)::int as count FROM applications WHERE current_state = 'offered'`).then((r) => Number(r.rows[0]?.count ?? 0)),
    ]);

    return NextResponse.json({ discovered, scored, cvReady, applied, interviewing, offered });
  } catch (error) {
    console.error("Pipeline API error:", error);
    return NextResponse.json(mockFunnelData);
  }
}
