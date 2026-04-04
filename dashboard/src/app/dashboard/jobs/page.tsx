import { db } from "@/lib/db";
import { jobs } from "@/lib/schema";
import { desc } from "drizzle-orm";
import { mockJobs } from "@/lib/mock-data";
import { JobsTable } from "@/components/jobs-table";

async function getJobs() {
  try {
    const allJobs = await db.select().from(jobs).orderBy(desc(jobs.discoveredAt)).limit(200);
    return { jobs: allJobs, isLive: true };
  } catch {
    return { jobs: mockJobs, isLive: false };
  }
}

export default async function JobsPage() {
  const data = await getJobs();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Jobs Feed</h1>
        <p className="text-sm text-muted-foreground">
          {data.isLive
            ? `${data.jobs.length} jobs from live database`
            : "Sample data (DB not connected)"}
        </p>
      </div>

      <JobsTable jobs={data.jobs} />
    </div>
  );
}
