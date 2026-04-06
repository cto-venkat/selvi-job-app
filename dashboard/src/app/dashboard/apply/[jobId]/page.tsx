export const dynamic = "force-dynamic";

import { getCurrentTenantId } from "@/lib/auth";
import { getJobById } from "@/lib/queries";
import { detectAts } from "@/lib/ats/detector";
import { redirect } from "next/navigation";
import { ApplicationPackageClient } from "./client";

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;

  let tenantId: string;
  try {
    tenantId = await getCurrentTenantId();
  } catch {
    redirect("/sign-in");
  }

  const job = await getJobById(tenantId, jobId);
  if (!job) {
    redirect("/dashboard/jobs");
  }

  const atsInfo = job.url ? detectAts(job.url) : null;

  return (
    <ApplicationPackageClient
      job={job}
      atsInfo={atsInfo}
    />
  );
}
