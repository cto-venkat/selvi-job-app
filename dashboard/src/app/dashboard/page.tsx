export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentTenantId } from "@/lib/auth";
import { getDashboardOverview, getPipelineCounts } from "@/lib/queries";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { PipelineFunnel } from "@/components/pipeline-funnel";
import { StatsCards } from "@/components/stats-cards";
import { RecentJobs } from "@/components/recent-jobs";
import { AlertsSection } from "@/components/alerts-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Calendar, AlertTriangle, Clock, Zap } from "lucide-react";

async function getDashboardData(tenantId: string) {
  const now = new Date();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const [overview, pipeline] = await Promise.all([
    getDashboardOverview(tenantId),
    getPipelineCounts(tenantId),
  ]);

  // Additional stats
  const [appsThisWeek, totalApps, respondedApps] = await Promise.all([
    db
      .execute(
        sql`SELECT count(*)::int as count FROM applications WHERE tenant_id = ${tenantId} AND applied_at >= ${oneWeekAgo}`
      )
      .then((r) => Number(r.rows[0]?.count ?? 0)),
    db
      .execute(
        sql`SELECT count(*)::int as count FROM applications WHERE tenant_id = ${tenantId}`
      )
      .then((r) => Number(r.rows[0]?.count ?? 0)),
    db
      .execute(
        sql`SELECT count(*)::int as count FROM applications WHERE tenant_id = ${tenantId} AND current_state IN ('interviewing', 'offered', 'rejected')`
      )
      .then((r) => Number(r.rows[0]?.count ?? 0)),
  ]);

  // Ghosted apps
  const ghostedResult = await db.execute(sql`
    SELECT id, company_name, job_title, current_state, applied_at, next_follow_up_at
    FROM applications WHERE tenant_id = ${tenantId} AND current_state = 'ghosted' LIMIT 5
  `);
  const ghostedApps = ghostedResult.rows.map(
    (r: Record<string, unknown>) => ({
      id: r.id as string,
      tenantId,
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
    })
  );

  return {
    funnel: {
      discovered: Number(pipeline?.discovered ?? 0),
      scored: Number(overview.jobStats?.tierA ?? 0) + Number(overview.jobStats?.tierB ?? 0),
      cvReady: 0,
      applied: Number(pipeline?.applied ?? 0),
      interviewing: Number(pipeline?.interviewing ?? 0),
      offered: Number(pipeline?.offered ?? 0),
    },
    stats: {
      totalActiveJobs: Number(overview.jobStats?.total ?? 0),
      applicationsThisWeek: appsThisWeek,
      responseRate:
        totalApps > 0 ? Math.round((respondedApps / totalApps) * 100) : 0,
      upcomingInterviews: overview.upcomingInterviews.length,
    },
    recentJobs: overview.recentJobs,
    upcomingInterviews: overview.upcomingInterviews,
    ghostedApps,
  };
}

export default async function DashboardPage() {
  let tenantId: string;
  try {
    tenantId = await getCurrentTenantId();
  } catch {
    redirect("/sign-in");
  }

  const data = await getDashboardData(tenantId);

  const todayInterviews = data.upcomingInterviews.filter((iv) => {
    if (!iv.interviewDate) return false;
    const d = new Date(iv.interviewDate);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  const hasTodayItems = todayInterviews.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Today</h1>
        <p className="text-sm text-muted-foreground">Live data</p>
      </div>

      {/* Today Section */}
      {hasTodayItems && (
        <div className="grid gap-4 md:grid-cols-3">
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
                    <span className="text-muted-foreground">
                      {" "}
                      at {iv.interviewStartTime}
                    </span>
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
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">
                22 n8n workflows active
              </span>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-cyan-500" />
                <span className="font-semibold">
                  {data.stats.totalActiveJobs}
                </span>
                <span className="text-muted-foreground">jobs discovered</span>
              </span>
              <span className="text-muted-foreground">|</span>
              <span>
                <span className="font-semibold">
                  {data.stats.applicationsThisWeek}
                </span>{" "}
                <span className="text-muted-foreground">apps this week</span>
              </span>
              <span className="text-muted-foreground">|</span>
              <span>
                <span className="font-semibold">
                  {data.ghostedApps.length}
                </span>{" "}
                <span className="text-muted-foreground">ghosted</span>
              </span>
            </div>
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
