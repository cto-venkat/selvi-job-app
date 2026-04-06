import { db } from "./db";
import {
  jobs,
  applications,
  applicationNotes,
  interviews,
  prepBriefs,
  cvPackages,
  emails,
  emailClassifications,
  contentCalendar,
  pipelineMetrics,
  notificationQueue,
} from "./schema";
import { eq, desc, sql, and, count } from "drizzle-orm";

// ─── Jobs ──────────────────────────────────────────────

export async function getJobs(tenantId: string, limit = 200) {
  return db
    .select()
    .from(jobs)
    .where(eq(jobs.tenantId, tenantId))
    .orderBy(desc(jobs.discoveredAt))
    .limit(limit);
}

export async function getJobById(tenantId: string, jobId: string) {
  const rows = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getJobStats(tenantId: string) {
  const result = await db
    .select({
      total: count(),
      tierA: sql<number>`count(*) filter (where tier in ('A+', 'A'))`,
      tierB: sql<number>`count(*) filter (where tier = 'B')`,
      tierC: sql<number>`count(*) filter (where tier = 'C')`,
    })
    .from(jobs)
    .where(eq(jobs.tenantId, tenantId));
  return result[0];
}

// ─── Applications ──────────────────────────────────────
// Note: applications.is_active is GENERATED ALWAYS — use raw SQL

export async function getApplications(tenantId: string) {
  const result = await db.execute(sql`
    SELECT id, tenant_id, job_id, company_name, job_title,
           pipeline_track, current_state, applied_at,
           follow_up_count, next_follow_up_at, interview_count,
           discovery_source, is_active
    FROM applications
    WHERE tenant_id = ${tenantId}
    ORDER BY applied_at DESC NULLS LAST
  `);
  return result.rows;
}

export async function getApplicationById(tenantId: string, appId: string) {
  const result = await db.execute(sql`
    SELECT id, tenant_id, job_id, company_name, job_title,
           pipeline_track, current_state, applied_at,
           follow_up_count, next_follow_up_at, interview_count,
           discovery_source, is_active
    FROM applications
    WHERE tenant_id = ${tenantId} AND id = ${appId}
    LIMIT 1
  `);
  return result.rows[0] ?? null;
}

export async function getApplicationNotes(tenantId: string, appId: string) {
  return db
    .select()
    .from(applicationNotes)
    .where(
      and(
        eq(applicationNotes.tenantId, tenantId),
        eq(applicationNotes.applicationId, appId)
      )
    )
    .orderBy(desc(applicationNotes.createdAt));
}

export async function getPipelineCounts(tenantId: string) {
  const result = await db.execute(sql`
    SELECT
      count(*) filter (where current_state = 'discovered') as discovered,
      count(*) filter (where current_state = 'applied') as applied,
      count(*) filter (where current_state = 'screening') as screening,
      count(*) filter (where current_state = 'interviewing') as interviewing,
      count(*) filter (where current_state = 'offered') as offered,
      count(*) filter (where current_state = 'rejected') as rejected,
      count(*) filter (where current_state = 'ghosted') as ghosted,
      count(*) as total
    FROM applications
    WHERE tenant_id = ${tenantId}
  `);
  return result.rows[0];
}

// ─── Interviews ────────────────────────────────────────

export async function getInterviews(tenantId: string) {
  return db
    .select()
    .from(interviews)
    .where(eq(interviews.tenantId, tenantId))
    .orderBy(desc(interviews.interviewDate));
}

export async function getInterviewById(tenantId: string, interviewId: string) {
  const rows = await db
    .select()
    .from(interviews)
    .where(
      and(eq(interviews.tenantId, tenantId), eq(interviews.id, interviewId))
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getPrepBrief(tenantId: string, interviewId: string) {
  const rows = await db
    .select()
    .from(prepBriefs)
    .where(
      and(
        eq(prepBriefs.tenantId, tenantId),
        eq(prepBriefs.interviewId, interviewId)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

// ─── CV Packages ───────────────────────────────────────

export async function getCvPackages(tenantId: string) {
  return db
    .select()
    .from(cvPackages)
    .where(eq(cvPackages.tenantId, tenantId))
    .orderBy(desc(cvPackages.createdAt));
}

// ─── Emails ────────────────────────────────────────────

export async function getEmails(tenantId: string, limit = 100) {
  const result = await db.execute(sql`
    SELECT e.*, ec.classification, ec.confidence, ec.is_urgent
    FROM emails e
    LEFT JOIN email_classifications ec ON ec.email_id = e.id AND ec.tenant_id = e.tenant_id
    WHERE e.tenant_id = ${tenantId}
    ORDER BY e.date DESC NULLS LAST
    LIMIT ${limit}
  `);
  return result.rows;
}

export async function getEmailById(tenantId: string, emailId: string) {
  const result = await db.execute(sql`
    SELECT e.*, ec.classification, ec.confidence, ec.is_urgent
    FROM emails e
    LEFT JOIN email_classifications ec ON ec.email_id = e.id AND ec.tenant_id = e.tenant_id
    WHERE e.tenant_id = ${tenantId} AND e.id = ${emailId}
    LIMIT 1
  `);
  return result.rows[0] ?? null;
}

// ─── Metrics ───────────────────────────────────────────

export async function getWeeklyMetrics(tenantId: string) {
  return db
    .select()
    .from(pipelineMetrics)
    .where(
      and(
        eq(pipelineMetrics.tenantId, tenantId),
        eq(pipelineMetrics.periodType, "weekly")
      )
    )
    .orderBy(desc(pipelineMetrics.periodStart))
    .limit(12);
}

// ─── Content Calendar ──────────────────────────────────

export async function getContentCalendar(tenantId: string) {
  return db
    .select()
    .from(contentCalendar)
    .where(eq(contentCalendar.tenantId, tenantId));
}

// ─── Dashboard Overview ────────────────────────────────

export async function getDashboardOverview(tenantId: string) {
  const [jobStats, pipeline, recentJobs, upcomingInterviews] =
    await Promise.all([
      getJobStats(tenantId),
      getPipelineCounts(tenantId),
      db
        .select()
        .from(jobs)
        .where(eq(jobs.tenantId, tenantId))
        .orderBy(desc(jobs.discoveredAt))
        .limit(10),
      db
        .select()
        .from(interviews)
        .where(
          and(
            eq(interviews.tenantId, tenantId),
            sql`interview_date >= CURRENT_DATE`
          )
        )
        .orderBy(interviews.interviewDate)
        .limit(5),
    ]);

  return { jobStats, pipeline, recentJobs, upcomingInterviews };
}
