import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, AlertTriangle } from "lucide-react";
import type { Interview, Application } from "@/lib/schema";

function formatDateTime(d: Date | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysUntil(d: Date | null) {
  if (!d) return null;
  const diff = Math.ceil(
    (new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  return diff;
}

export function AlertsSection({
  interviews,
  ghostedApps,
}: {
  interviews: Interview[];
  ghostedApps: Application[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Alerts & Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upcoming Interviews */}
        {interviews.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              UPCOMING INTERVIEWS
            </p>
            <div className="space-y-2">
              {interviews.map((iv) => {
                const days = daysUntil(iv.interviewDate);
                return (
                  <div
                    key={iv.id}
                    className="flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/20 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{iv.companyName}</p>
                      <p className="text-xs text-muted-foreground">
                        {iv.roleTitle} &middot; {iv.interviewFormat}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        {formatDateTime(iv.interviewDate)}
                      </p>
                      {days !== null && days <= 3 && (
                        <Badge
                          variant="outline"
                          className="mt-1 text-[10px] border-amber-500 text-amber-600 dark:border-amber-600 dark:text-amber-400"
                        >
                          {days === 0
                            ? "Today"
                            : days === 1
                              ? "Tomorrow"
                              : `${days} days`}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Ghosted Applications */}
        {ghostedApps.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3" />
              NEEDS FOLLOW-UP
            </p>
            <div className="space-y-2">
              {ghostedApps.map((app) => (
                <div
                  key={app.id}
                  className="flex items-center gap-3 rounded-md border border-red-300 bg-red-50 dark:border-red-800/50 dark:bg-red-950/20 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{app.companyName}</p>
                    <p className="text-xs text-muted-foreground">
                      {app.jobTitle}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge
                      variant="outline"
                      className="text-[10px] border-red-400 text-red-600 dark:border-red-600 dark:text-red-400"
                    >
                      {app.followUpCount} follow-ups sent
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {interviews.length === 0 && ghostedApps.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No alerts right now
          </p>
        )}
      </CardContent>
    </Card>
  );
}
