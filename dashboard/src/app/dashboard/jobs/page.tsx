export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentTenantId } from "@/lib/auth";
import { getJobs } from "@/lib/queries";
import { redirect } from "next/navigation";
import { JobsTable } from "@/components/jobs-table";

export default async function JobsPage() {
  let tenantId: string;
  try {
    tenantId = await getCurrentTenantId();
  } catch {
    redirect("/sign-in");
  }

  const allJobs = await getJobs(tenantId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Jobs Feed</h1>
        <p className="text-sm text-muted-foreground">
          {allJobs.length} jobs from live database
        </p>
      </div>

      <JobsTable jobs={allJobs} />
    </div>
  );
}
