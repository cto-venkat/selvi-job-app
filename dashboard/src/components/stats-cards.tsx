import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, Send, TrendingUp, Calendar } from "lucide-react";

interface Stats {
  totalActiveJobs: number;
  applicationsThisWeek: number;
  responseRate: number;
  upcomingInterviews: number;
}

const cards = [
  {
    key: "totalActiveJobs",
    label: "Total Active Jobs",
    icon: Briefcase,
    color: "text-cyan-500",
    format: (v: number) => v.toString(),
  },
  {
    key: "applicationsThisWeek",
    label: "Applications This Week",
    icon: Send,
    color: "text-blue-500",
    format: (v: number) => v.toString(),
  },
  {
    key: "responseRate",
    label: "Response Rate",
    icon: TrendingUp,
    color: "text-emerald-500",
    format: (v: number) => `${v}%`,
  },
  {
    key: "upcomingInterviews",
    label: "Upcoming Interviews",
    icon: Calendar,
    color: "text-amber-500",
    format: (v: number) => v.toString(),
  },
] as const;

export function StatsCards({ stats }: { stats: Stats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.key}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className="text-3xl font-bold tracking-tight mt-1">
                  {card.format(stats[card.key])}
                </p>
              </div>
              <card.icon className={`h-8 w-8 ${card.color} opacity-80`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
