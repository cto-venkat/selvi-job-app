import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";

interface FunnelData {
  discovered: number;
  scored: number;
  cvReady: number;
  applied: number;
  interviewing: number;
  offered: number;
}

const stages = [
  { key: "discovered", label: "Discovered", color: "bg-zinc-500 dark:bg-zinc-600" },
  { key: "scored", label: "Scored", color: "bg-zinc-400 dark:bg-zinc-500" },
  { key: "cvReady", label: "CV Ready", color: "bg-cyan-600 dark:bg-cyan-800" },
  { key: "applied", label: "Applied", color: "bg-cyan-500 dark:bg-cyan-600" },
  { key: "interviewing", label: "Interviewing", color: "bg-amber-500 dark:bg-amber-600" },
  { key: "offered", label: "Offered", color: "bg-emerald-500 dark:bg-emerald-600" },
] as const;

export function PipelineFunnel({ data }: { data: FunnelData }) {
  const values = stages.map((s) => data[s.key]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Pipeline Funnel
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {stages.map((stage, i) => {
            const conversionPct =
              i > 0 && values[i - 1] > 0
                ? Math.round((values[i] / values[i - 1]) * 100)
                : null;

            return (
              <div key={stage.key} className="flex items-center gap-1">
                <div
                  className={`${stage.color} rounded-md px-4 py-3 min-w-[100px] text-center`}
                >
                  <div className="text-2xl font-bold text-white">
                    {data[stage.key]}
                  </div>
                  <div className="text-xs text-white/70 whitespace-nowrap">
                    {stage.label}
                  </div>
                </div>
                {i < stages.length - 1 && (
                  <div className="flex flex-col items-center gap-0.5 shrink-0">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    {conversionPct !== null && i < stages.length - 1 && (
                      <span className="text-[9px] font-mono text-muted-foreground whitespace-nowrap">
                        {values[i] > 0 ? Math.round((values[i + 1] / values[i]) * 100) : 0}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
