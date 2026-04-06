"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  mockMetricsWeekly,
  mockSourceData,
  mockPipelineFunnel,
  mockMetricGoals,
  mockMetricInsights,
} from "@/lib/mock-data";

// Use empty arrays instead of mock data for production
const emptySourceData: typeof mockSourceData = [];
const emptyPipelineFunnel: typeof mockPipelineFunnel = [];
const emptyInsights: typeof mockMetricInsights = [];
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import {
  Download,
  Share2,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  Lightbulb,
  Check,
  X,
} from "lucide-react";

const COLORS = {
  blue: "#3b82f6",
  teal: "#14b8a6",
  amber: "#f59e0b",
  red: "#ef4444",
  slate: "#64748b",
  emerald: "#10b981",
};

const sourceColors = ["#3b82f6", "#14b8a6", "#f59e0b", "#8b5cf6", "#64748b"];

type DateRange = "1w" | "1m" | "3m" | "custom";
type SourceFilter = string | null;

export default function MetricsPage() {
  const [dateRange, setDateRange] = useState<DateRange>("3m");
  const [showComparison, setShowComparison] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(null);
  const [goals, setGoals] = useState<typeof mockMetricGoals>({ applicationsPerWeek: { target: 0, actual: 0 }, responseRate: { target: 0, actual: 0 }, interviewsPerMonth: { target: 0, actual: 0 }, offersPerQuarter: { target: 0, actual: 0 } });
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [goalInput, setGoalInput] = useState("");

  // Filter data by date range
  const data = useMemo(() => {
    return [] as typeof mockMetricsWeekly;
  }, [dateRange]);

  // Calculate comparison deltas
  const comparison = useMemo(() => {
    if (data.length < 2) return null;
    const half = Math.floor(data.length / 2);
    const recent = data.slice(half);
    const previous = data.slice(0, half);

    const avgRecent = (arr: typeof data, key: keyof typeof data[0]) =>
      arr.reduce((s, d) => s + (d[key] as number), 0) / arr.length;

    const responseRateNow = avgRecent(recent, "responseRate");
    const responseRatePrev = avgRecent(previous, "responseRate");
    const ghostingNow = avgRecent(recent, "ghostingRate");
    const ghostingPrev = avgRecent(previous, "ghostingRate");
    const appsNow = avgRecent(recent, "applications");
    const appsPrev = avgRecent(previous, "applications");

    return {
      responseRate: { now: responseRateNow, prev: responseRatePrev, delta: responseRateNow - responseRatePrev },
      ghostingRate: { now: ghostingNow, prev: ghostingPrev, delta: ghostingNow - ghostingPrev },
      applications: { now: appsNow, prev: appsPrev, delta: appsNow - appsPrev },
    };
  }, [data]);

  function handleExport(format: "csv" | "pdf") {
    if (format === "csv") {
      const header = "Week,Response Rate,Applications,Ghosting Rate\n";
      const rows = data
        .map((d) => `${d.week},${d.responseRate},${d.applications},${d.ghostingRate}`)
        .join("\n");
      const blob = new Blob([header + rows], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "metrics-export.csv";
      a.click();
      URL.revokeObjectURL(url);
      console.log("Exported CSV");
    } else {
      console.log("PDF export requested (would generate PDF)");
    }
  }

  function handleShare() {
    const summary = `JobPilot Metrics Summary\nResponse Rate: ${data[data.length - 1]?.responseRate}%\nGhosting Rate: ${data[data.length - 1]?.ghostingRate}%\nApplications (latest week): ${data[data.length - 1]?.applications}`;
    navigator.clipboard.writeText(summary);
    console.log("Report summary copied to clipboard");
  }

  function handleSetGoal(key: string) {
    const value = parseInt(goalInput);
    if (isNaN(value) || value <= 0) return;
    setGoals((prev) => ({
      ...prev,
      [key]: { ...prev[key as keyof typeof prev], target: value },
    }));
    setEditingGoal(null);
    setGoalInput("");
    console.log("Goal updated:", key, "=", value);
  }

  function handleSourceClick(source: string) {
    setSourceFilter(sourceFilter === source ? null : source);
    console.log("Source filter:", sourceFilter === source ? "cleared" : source);
  }

  const dateRangeOptions: { key: DateRange; label: string }[] = [
    { key: "1w", label: "This Week" },
    { key: "1m", label: "This Month" },
    { key: "3m", label: "Last 3 Months" },
  ];

  const trendIcon = (delta: number, invertPositive = false) => {
    const isPositive = invertPositive ? delta < 0 : delta > 0;
    if (Math.abs(delta) < 0.5)
      return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
    return isPositive ? (
      <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
    ) : (
      <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Metrics</h1>
          <p className="text-sm text-muted-foreground">
            Pipeline analytics and goal tracking
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}>
            <Download className="h-3.5 w-3.5" />
            Export PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="h-3.5 w-3.5" />
            Share Report
          </Button>
        </div>
      </div>

      {/* Date Range + Comparison */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {dateRangeOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setDateRange(opt.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                dateRange === opt.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <Button
          variant={showComparison ? "default" : "outline"}
          size="sm"
          onClick={() => setShowComparison(!showComparison)}
        >
          vs Previous Period
        </Button>
        {sourceFilter && (
          <Badge variant="secondary" className="text-xs">
            Filtered: {sourceFilter}
            <button onClick={() => setSourceFilter(null)} className="ml-1">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
      </div>

      {/* Goal Progress Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            { key: "applicationsPerWeek", label: "Apps / Week", unit: "" },
            { key: "responseRate", label: "Response Rate", unit: "%" },
            { key: "interviewsPerMonth", label: "Interviews / Month", unit: "" },
            { key: "offersPerQuarter", label: "Offers / Quarter", unit: "" },
          ] as const
        ).map(({ key, label, unit }) => {
          const g = goals[key];
          const pct = Math.round((g.actual / g.target) * 100);
          const color =
            pct >= 100
              ? "text-emerald-600 dark:text-emerald-400"
              : pct >= 60
              ? "text-amber-600 dark:text-amber-400"
              : "text-red-600 dark:text-red-400";

          return (
            <Card key={key}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground font-medium">
                    {label}
                  </p>
                  {editingGoal === key ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={goalInput}
                        onChange={(e) => setGoalInput(e.target.value)}
                        className="h-5 w-14 text-xs px-1"
                        placeholder={String(g.target)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSetGoal(key);
                          if (e.key === "Escape") setEditingGoal(null);
                        }}
                      />
                      <button onClick={() => handleSetGoal(key)}>
                        <Check className="h-3 w-3 text-emerald-500" />
                      </button>
                      <button onClick={() => setEditingGoal(null)}>
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => {
                        setEditingGoal(key);
                        setGoalInput(String(g.target));
                      }}
                    >
                      <Target className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">
                    {g.actual}
                    {unit}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    / {g.target}
                    {unit}
                  </span>
                </div>
                <div className="mt-2 w-full rounded-full bg-muted h-1.5">
                  <div
                    className={`rounded-full h-1.5 transition-all ${
                      pct >= 100
                        ? "bg-emerald-500"
                        : pct >= 60
                        ? "bg-amber-500"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <p className={`text-xs mt-1 font-medium ${color}`}>{pct}% of target</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Response Rate Trend */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Response Rate Trend
              </CardTitle>
              {showComparison && comparison && (
                <div className="flex items-center gap-1">
                  {trendIcon(comparison.responseRate.delta)}
                  <span
                    className={`text-xs font-medium ${
                      comparison.responseRate.delta >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {comparison.responseRate.delta >= 0 ? "+" : ""}
                    {comparison.responseRate.delta.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                  />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-popover)",
                      borderColor: "var(--color-border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value) => [`${value}%`, "Response Rate"]}
                  />
                  {goals.responseRate.target && (
                    <ReferenceLine
                      y={goals.responseRate.target}
                      stroke={COLORS.emerald}
                      strokeDasharray="5 5"
                      label={{
                        value: `Target: ${goals.responseRate.target}%`,
                        position: "right",
                        fontSize: 10,
                        fill: COLORS.emerald,
                      }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="responseRate"
                    stroke={COLORS.teal}
                    strokeWidth={2}
                    dot={{ r: 4, fill: COLORS.teal }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Applications by Source */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Applications by Source
              </CardTitle>
              <p className="text-[10px] text-muted-foreground">Click a bar to filter</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={emptySourceData}
                  layout="vertical"
                  onClick={(e) => {
                    if (e?.activeLabel) handleSourceClick(String(e.activeLabel));
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    dataKey="source"
                    type="category"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-popover)",
                      borderColor: "var(--color-border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    radius={[0, 4, 4, 0]}
                    className="cursor-pointer"
                  >
                    {emptySourceData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={sourceColors[index % sourceColors.length]}
                        opacity={
                          sourceFilter && sourceFilter !== entry.source
                            ? 0.3
                            : 1
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pipeline Funnel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pipeline Funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={emptyPipelineFunnel} layout="vertical">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    dataKey="stage"
                    type="category"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    width={90}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-popover)",
                      borderColor: "var(--color-border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill={COLORS.blue}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Ghosting Rate Trend */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ghosting Rate Trend
              </CardTitle>
              {showComparison && comparison && (
                <div className="flex items-center gap-1">
                  {trendIcon(comparison.ghostingRate.delta, true)}
                  <span
                    className={`text-xs font-medium ${
                      comparison.ghostingRate.delta <= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {comparison.ghostingRate.delta >= 0 ? "+" : ""}
                    {comparison.ghostingRate.delta.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                  />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-popover)",
                      borderColor: "var(--color-border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value) => [`${value}%`, "Ghosting Rate"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="ghostingRate"
                    stroke={COLORS.red}
                    strokeWidth={2}
                    dot={{ r: 4, fill: COLORS.red }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-sm font-medium text-muted-foreground">
              AI Insights
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {emptyInsights.map((insight, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-md border border-border p-3"
              >
                {insight.trend === "positive" ? (
                  <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : insight.trend === "negative" ? (
                  <TrendingDown className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                ) : (
                  <Minus className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                )}
                <p className="text-xs">{insight.text}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
