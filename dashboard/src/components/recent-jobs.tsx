import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Job } from "@/lib/schema";

function tierColor(tier: string | null) {
  switch (tier) {
    case "A+":
      return "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700";
    case "A":
      return "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-700";
    case "B":
      return "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700";
    default:
      return "bg-zinc-100 text-zinc-500 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-600";
  }
}

function formatDate(d: Date | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function RecentJobs({ jobs }: { jobs: Job[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Recent High-Tier Jobs
        </CardTitle>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No recent jobs found
          </p>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center gap-3 rounded-md border border-border p-3"
              >
                <Badge
                  variant="outline"
                  className={`shrink-0 text-xs font-mono ${tierColor(job.tier)}`}
                >
                  {job.tier ?? "-"}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{job.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {job.company} &middot; {job.location}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-mono text-cyan-600 dark:text-cyan-400">
                    {job.compositeScore ?? "-"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(job.discoveredAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
