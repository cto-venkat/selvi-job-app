import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jobs } from "@/lib/schema";
import { sql } from "drizzle-orm";

export async function GET() {
  const results: Record<string, unknown> = {};

  try {
    const jobCount = await db.select({ count: sql<number>`count(*)` }).from(jobs);
    results.jobCount = Number(jobCount[0]?.count ?? 0);
  } catch (e: unknown) {
    results.jobCountError = e instanceof Error ? e.message : String(e);
  }

  try {
    const rawJobs = await db.execute(sql`SELECT count(*) as cnt FROM jobs`);
    results.rawJobCount = rawJobs.rows?.[0]?.cnt ?? rawJobs;
  } catch (e: unknown) {
    results.rawJobCountError = e instanceof Error ? e.message : String(e);
  }

  try {
    const rawApps = await db.execute(sql`SELECT count(*) as cnt FROM applications`);
    results.rawAppCount = rawApps.rows?.[0]?.cnt ?? rawApps;
  } catch (e: unknown) {
    results.rawAppCountError = e instanceof Error ? e.message : String(e);
  }

  try {
    const sample = await db.execute(sql`SELECT id, title, company, tier, status FROM jobs ORDER BY discovered_at DESC LIMIT 3`);
    results.sampleJobs = sample.rows ?? sample;
  } catch (e: unknown) {
    results.sampleJobsError = e instanceof Error ? e.message : String(e);
  }

  try {
    const tables = await db.execute(sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name LIMIT 10`);
    results.tables = tables.rows?.map((r: Record<string, unknown>) => r.table_name) ?? tables;
  } catch (e: unknown) {
    results.tablesError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(results);
}
