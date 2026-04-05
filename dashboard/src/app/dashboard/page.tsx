export const dynamic = "force-dynamic";
export const revalidate = 0;

import { db } from "@/lib/db";
import { jobs, applications, interviews } from "@/lib/schema";
import { desc, eq, gte, and, or, sql, isNull, not } from "drizzle-orm";
import {
  mockJobs,
  mockApplications,
  mockInterviews,
  mockFunnelData,
  mockStats,
  mockAiActivity,
  mockEmails,
} from "@/lib/mock-data";
// Raw SQL queries avoid Drizzle ORM issues with generated columns
import { PipelineFunnel } from "@/components/pipeline-funnel";
import { StatsCards } from "@/components/stats-cards";
import { RecentJobs } from "@/components/recent-jobs";
import { AlertsSection } from "@/components/alerts-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Calendar, Mail, AlertTriangle, Clock, Zap } from "lucide-react";

async function getDashboardData() {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const now = new Date();

    // Use raw SQL for application queries to avoid GENERATED ALWAYS column issues
    const [
      discoveredCount,
      scoredCount,
      cvReadyCount,
      appliedCount,
      interviewingCount,
      offeredCount,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(jobs).then((r) => Number(r[0]?.count ?? 0)),
      db.select({ count: sql<number>`count(*)` }).from(jobs).where(not(isNull(jobs.compositeScore))).then((r) => Number(r[0]?.count ?? 0)),
      db.select({ count: sql<number>`count(*)` }).from(jobs).where(eq(jobs.readyToApply, true)).then((r) => Number(r[0]?.count ?? 0)),
      db.execute(sql`SELECT count(*)::int as count FROM applications WHERE current_state NOT IN ('accepted', 'declined', 'rejected', 'withdrawn', 'ghosted', 'expired')`).then((r) => Number(r.rows[0]?.count ?? 0)),
      db.execute(sql`SELECT count(*)::int as count FROM applications WHERE current_state = 'interviewing'`).then((r) => Number(r.rows[0]?.count ?? 0)),
      db.execute(sql`SELECT count(*)::int as count FROM applications WHERE current_state = 'offered'`).then((r) => Number(r.rows[0]?.count ?? 0)),
    ]);

    const appsThisWeek = await db.execute(sql`SELECT count(*)::int as count FROM applications WHERE applied_at >= ${oneWeekAgo}`).then((r) => Number(r.rows[0]?.count ?? 0));
    const totalApps = await db.execute(sql`SELECT count(*)::int as count FROM applications`).then((r) => Number(r.rows[0]?.count ?? 0));
    const respondedApps = await db.execute(sql`SELECT count(*)::int as count FROM applications WHERE current_state IN ('interviewing', 'offered', 'rejected')`).then((r) => Number(r.rows[0]?.count ?? 0));
    const upcomingInterviewCount = await db.execute(sql`SELECT count(*)::int as count FROM interviews WHERE interview_date >= ${now.toISOString().split("T")[0]} AND status = 'scheduled'`).then((r) => Number(r.rows[0]?.count ?? 0));

    const recentJobs = await db.select().from(jobs).where(or(eq(jobs.tier, "A+"), eq(jobs.tier, "A"), eq(jobs.tier, "B"))).orderBy(desc(jobs.discoveredAt)).limit(5);

    // Raw SQL for interviews to handle date column properly
    const upcomingInterviewsResult = await db.execute(sql`
      SELECT id, company_name, role_title, interview_track, interview_format,
             interview_date, interview_start_time, status, location_type, video_link, physical_address
      FROM interviews
      WHERE interview_date >= ${now.toISOString().split("T")[0]} AND status = 'scheduled'
      ORDER BY interview_date ASC LIMIT 5
    `);
    const upcomingInterviews = upcomingInterviewsResult.rows.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      tenantId: null,
      companyName: r.company_name as string,
      roleTitle: r.role_title as string,
      interviewTrack: r.interview_track as string,
      interviewFormat: r.interview_format as string,
      interviewDate: r.interview_date as string,
      interviewStartTime: r.interview_start_time as string,
      status: r.status as string,
      locationType: r.location_type as string,
      videoLink: r.video_link as string | null,
      physicalAddress: r.physical_address as string | null,
    }));

    // Raw SQL for ghosted applications to avoid generated column
    const ghostedResult = await db.execute(sql`
      SELECT id, company_name, job_title, current_state, applied_at, next_follow_up_at
      FROM applications WHERE current_state = 'ghosted' LIMIT 5
    `);
    const ghostedApps = ghostedResult.rows.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      tenantId: null,
      jobId: null,
      companyName: r.company_name as string,
      jobTitle: r.job_title as string,
      pipelineTrack: null,
      currentState: r.current_state as string,
      appliedAt: r.applied_at as Date | null,
      followUpCount: 0,
      nextFollowUpAt: r.next_follow_up_at as Date | null,
      interviewCount: 0,
      discoverySource: null,
    }));

    return {
      funnel: { discovered: discoveredCount, scored: scoredCount, cvReady: cvReadyCount, applied: appliedCount, interviewing: interviewingCount, offered: offeredCount },
      stats: { totalActiveJobs: discoveredCount, applicationsThisWeek: appsThisWeek, responseRate: totalApps > 0 ? Math.round((respondedApps / totalApps) * 100) : 0, upcomingInterviews: upcomingInterviewCount },
      recentJobs, upcomingInterviews, ghostedApps, isLive: true,
    };
  } catch (error) {
    console.error("Dashboard DB error:", error);
    return {
      funnel: mockFunnelData,
      stats: mockStats,
      recentJobs: mockJobs.filter((j) => j.tier === "A+" || j.tier === "A" || j.tier === "B").slice(0, 5),
      upcomingInterviews: mockInterviews,
      ghostedApps: mockApplications.filter((a) => a.currentState === "ghosted"),
      isLive: false,
    };
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  const activity = mockAiActivity;

  // Today items
  const todayInterviews = data.upcomingInterviews.filter((iv) => {
    if (!iv.interviewDate) return false;
    const d = new Date(iv.interviewDate);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  const overdueFollowUps = (data.isLive ? [] : mockApplications).filter(
    (a) => a.nextFollowUpAt && new Date(a.nextFollowUpAt) <= new Date() && a.currentState !== "rejected" && a.currentState !== "withdrawn"
  );

  const urgentEmails = mockEmails.filter((e) => e.isUrgent && e.status === "unread");

  const hasTodayItems = todayInterviews.length > 0 || overdueFollowUps.length > 0 || urgentEmails.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Today</h1>
          <p className="text-sm text-muted-foreground">
            {data.isLive ? "Live data" : "Sample data (DB not connected)"}
          </p>
        </div>
      </div>

      {/* Today Section */}
      {hasTodayItems && (
        <div className="grid gap-4 md:grid-cols-3">
          {/* Today Interviews */}
          {todayInterviews.length > 0 && (
            <Card className="border-amber-200 dark:border-amber-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-amber-500" />
                  Interviews Today
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {todayInterviews.map((iv) => (
                  <div key={iv.id} className="text-sm">
                    <span className="font-medium">{iv.companyName}</span>
                    <span className="text-muted-foreground"> at {iv.interviewStartTime}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Follow-ups Due */}
          {overdueFollowUps.length > 0 && (
            <Card className="border-red-200 dark:border-red-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Follow-ups Due
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {overdueFollowUps.slice(0, 3).map((app) => (
                  <div key={app.id} className="text-sm">
                    <span className="font-medium">{app.companyName}</span>
                    <span className="text-muted-foreground"> -- {app.jobTitle}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Urgent Emails */}
          {urgentEmails.length > 0 && (
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-500" />
                  Urgent Emails
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {urgentEmails.slice(0, 3).map((email) => (
                  <div key={email.id} className="text-sm truncate">
                    <span className="font-medium">{email.fromName}</span>
                    <span className="text-muted-foreground"> -- {email.subject}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* AI Activity Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Bot className="h-4 w-4 text-cyan-500" />
            AI Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Last scan:</span>
              <span className="font-medium">{activity.lastScanTime}</span>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-cyan-500" />
                <span className="text-muted-foreground">Found</span>
                <span className="font-semibold">{activity.todaySummary.jobsFound}</span>
                <span className="text-muted-foreground">jobs</span>
              </span>
              <span className="text-muted-foreground">|</span>
              <span>
                <span className="text-muted-foreground">Tailored</span>{" "}
                <span className="font-semibold">{activity.todaySummary.cvsTailored}</span>{" "}
                <span className="text-muted-foreground">CVs</span>
              </span>
              <span className="text-muted-foreground">|</span>
              <span>
                <span className="text-muted-foreground">Detected</span>{" "}
                <span className="font-semibold text-red-600 dark:text-red-400">{activity.todaySummary.ghostedDetected}</span>{" "}
                <span className="text-muted-foreground">ghosted</span>
              </span>
            </div>
          </div>
          <div className="mt-3 space-y-1">
            {activity.recentActions.slice(0, 4).map((action, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="font-mono text-muted-foreground shrink-0 w-10">{action.time}</span>
                <span className="text-muted-foreground">{action.action}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Funnel */}
      <PipelineFunnel data={data.funnel} />

      {/* Stats */}
      <StatsCards stats={data.stats} />

      {/* Needs Attention + Recent Jobs */}
      <div className="grid gap-6 lg:grid-cols-2">
        <AlertsSection
          interviews={data.upcomingInterviews}
          ghostedApps={data.ghostedApps}
        />
        <RecentJobs jobs={data.recentJobs} />
      </div>
    </div>
  );
}
