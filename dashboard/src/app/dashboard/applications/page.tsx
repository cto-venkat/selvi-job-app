"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { mockApplications } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Download,
  FileText,
  X,
  LayoutGrid,
  TableIcon,
  Search,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Filter,
} from "lucide-react";

type AppState = "applied" | "acknowledged" | "interviewing" | "offered" | "rejected" | "ghosted";
type ViewMode = "kanban" | "table";
type SortField = "companyName" | "jobTitle" | "currentState" | "pipelineTrack" | "appliedAt" | "nextFollowUpAt" | "interviewCount";
type SortDir = "asc" | "desc";

const columns = [
  { key: ["applied"] as AppState[], label: "Applied", color: "bg-blue-50 dark:bg-blue-950/30", borderColor: "border-blue-200 dark:border-blue-800" },
  { key: ["acknowledged"] as AppState[], label: "Acknowledged", color: "bg-cyan-50 dark:bg-cyan-950/30", borderColor: "border-cyan-200 dark:border-cyan-800" },
  { key: ["interviewing"] as AppState[], label: "Interviewing", color: "bg-amber-50 dark:bg-amber-950/30", borderColor: "border-amber-200 dark:border-amber-800" },
  { key: ["offered"] as AppState[], label: "Offered", color: "bg-emerald-50 dark:bg-emerald-950/30", borderColor: "border-emerald-200 dark:border-emerald-800" },
  { key: ["rejected", "ghosted"] as AppState[], label: "Closed", color: "bg-zinc-50 dark:bg-zinc-900/30", borderColor: "border-zinc-200 dark:border-zinc-700" },
];

const stateBadgeColor: Record<string, string> = {
  applied: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  acknowledged: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300",
  interviewing: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  offered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  rejected: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400",
  ghosted: "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400",
};

function daysSince(d: Date | null): number {
  if (!d) return 0;
  return Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(d: Date | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function exportCsv(apps: typeof mockApplications) {
  const header = "Company,Job Title,Status,Track,Applied Date,Follow-up Date,Interviews,Source\n";
  const rows = apps.map((a) =>
    [a.companyName, a.jobTitle, a.currentState, a.pipelineTrack, a.appliedAt?.toISOString().split("T")[0] ?? "", a.nextFollowUpAt ? new Date(a.nextFollowUpAt).toISOString().split("T")[0] : "", a.interviewCount, a.discoverySource].join(",")
  ).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "applications.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function ApplicationsPage() {
  const searchParams = useSearchParams();
  const [showAddForm, setShowAddForm] = useState(searchParams.get("add") === "true");
  const [filterState, setFilterState] = useState<string>("all");
  const [filterTrack, setFilterTrack] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [sortField, setSortField] = useState<SortField>("appliedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterHasInterviews, setFilterHasInterviews] = useState(false);
  const [apps, setApps] = useState(mockApplications);

  // Quick add form
  const [newCompany, setNewCompany] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newStatus, setNewStatus] = useState("applied");
  const [newMethod, setNewMethod] = useState("direct_apply");

  const filteredApps = useMemo(() => {
    let result = apps;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          (a.companyName?.toLowerCase().includes(q)) ||
          (a.jobTitle?.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (filterState !== "all") {
      result = result.filter((a) => a.currentState === filterState);
    }

    // Track filter
    if (filterTrack !== "all") {
      result = result.filter((a) => a.pipelineTrack === filterTrack);
    }

    // Advanced filters
    if (filterDateFrom) {
      const from = new Date(filterDateFrom);
      result = result.filter((a) => a.appliedAt && new Date(a.appliedAt) >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo);
      to.setHours(23, 59, 59);
      result = result.filter((a) => a.appliedAt && new Date(a.appliedAt) <= to);
    }
    if (filterSource !== "all") {
      result = result.filter((a) => a.discoverySource === filterSource);
    }
    if (filterHasInterviews) {
      result = result.filter((a) => (a.interviewCount ?? 0) > 0);
    }

    // Sort
    return [...result].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const av = a[sortField];
      const bv = b[sortField];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av instanceof Date && bv instanceof Date) return (av.getTime() - bv.getTime()) * dir;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [apps, searchQuery, filterState, filterTrack, filterDateFrom, filterDateTo, filterSource, filterHasInterviews, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  }

  async function handleAddApplication() {
    if (!newCompany.trim() || !newTitle.trim()) return;

    const newApp = {
      id: `b-new-${Date.now()}`,
      tenantId: "t-0001",
      jobId: null,
      companyName: newCompany.trim(),
      jobTitle: newTitle.trim(),
      pipelineTrack: newMethod,
      currentState: newStatus,
      appliedAt: new Date(),
      followUpCount: 0,
      nextFollowUpAt: null,
      interviewCount: 0,
      discoverySource: "manual",
    };

    setApps([newApp, ...apps]);
    setNewCompany("");
    setNewTitle("");
    setShowAddForm(false);

    try {
      await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newApp),
      });
    } catch {
      // Silently fail in demo mode
    }
  }

  const uniqueSources = [...new Set(apps.map((a) => a.discoverySource).filter(Boolean))];

  if (apps.length === 0 && !showAddForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Applications</h1>
            <p className="text-sm text-muted-foreground">Track your job applications</p>
          </div>
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Application
          </Button>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">No applications yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Head to Jobs to find matches, or add an application manually.
            </p>
            <Button className="mt-4" onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Application
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Applications</h1>
          <p className="text-sm text-muted-foreground">
            {filteredApps.length} application{filteredApps.length !== 1 ? "s" : ""}
            {filterState !== "all" && ` (${filterState})`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("kanban")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "kanban" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              title="Kanban view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "table" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              title="Table view"
            >
              <TableIcon className="h-4 w-4" />
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => exportCsv(filteredApps)}>
            <Download className="h-3 w-3 mr-1" /> Export CSV
          </Button>
          <Button size="sm" onClick={() => setShowAddForm(true)}>
            <Plus className="h-3 w-3 mr-1" /> Add Application
          </Button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search company or job title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>

          {/* Status filter */}
          <select
            value={filterState}
            onChange={(e) => setFilterState(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="applied">Applied</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="interviewing">Interviewing</option>
            <option value="offered">Offered</option>
            <option value="rejected">Rejected</option>
            <option value="ghosted">Ghosted</option>
          </select>

          {/* Track filter */}
          <select
            value={filterTrack}
            onChange={(e) => setFilterTrack(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="all">All Tracks</option>
            <option value="direct_apply">Direct Apply</option>
            <option value="recruiter">Recruiter</option>
            <option value="referral">Referral</option>
          </select>

          <Button
            variant="ghost"
            size="xs"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          >
            <Filter className="h-3 w-3" />
            {showAdvancedFilters ? "Hide Filters" : "More Filters"}
          </Button>
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <Card>
            <CardContent className="p-3">
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="text-xs text-muted-foreground">From Date</label>
                  <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="h-8 w-36" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">To Date</label>
                  <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="h-8 w-36" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Source</label>
                  <select
                    value={filterSource}
                    onChange={(e) => setFilterSource(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm block"
                  >
                    <option value="all">All Sources</option>
                    {uniqueSources.map((s) => (
                      <option key={s} value={s ?? ""}>{s}</option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer pb-1">
                  <input
                    type="checkbox"
                    checked={filterHasInterviews}
                    onChange={(e) => setFilterHasInterviews(e.target.checked)}
                    className="rounded border-input"
                  />
                  Has interviews
                </label>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setFilterDateFrom("");
                    setFilterDateTo("");
                    setFilterSource("all");
                    setFilterHasInterviews(false);
                  }}
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Add Form */}
      {showAddForm && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Quick Add Application</h3>
              <Button variant="ghost" size="icon-xs" onClick={() => setShowAddForm(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <Input placeholder="Company" value={newCompany} onChange={(e) => setNewCompany(e.target.value)} />
              <Input placeholder="Job Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
                <option value="applied">Applied</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="interviewing">Interviewing</option>
              </select>
              <select value={newMethod} onChange={(e) => setNewMethod(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
                <option value="direct_apply">Direct Apply</option>
                <option value="recruiter">Recruiter</option>
                <option value="referral">Referral</option>
              </select>
            </div>
            <Button size="sm" className="mt-3" onClick={handleAddApplication} disabled={!newCompany.trim() || !newTitle.trim()}>
              Add Application
            </Button>
          </CardContent>
        </Card>
      )}

      {/* TABLE VIEW */}
      {viewMode === "table" && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button onClick={() => toggleSort("companyName")} className="flex items-center gap-1 hover:text-foreground">
                      Company <SortIcon field="companyName" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("jobTitle")} className="flex items-center gap-1 hover:text-foreground">
                      Job Title <SortIcon field="jobTitle" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("currentState")} className="flex items-center gap-1 hover:text-foreground">
                      Status <SortIcon field="currentState" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("pipelineTrack")} className="flex items-center gap-1 hover:text-foreground">
                      Track <SortIcon field="pipelineTrack" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("appliedAt")} className="flex items-center gap-1 hover:text-foreground">
                      Applied <SortIcon field="appliedAt" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("nextFollowUpAt")} className="flex items-center gap-1 hover:text-foreground">
                      Follow-up <SortIcon field="nextFollowUpAt" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("interviewCount")} className="flex items-center gap-1 hover:text-foreground">
                      Interviews <SortIcon field="interviewCount" />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApps.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No applications match your filters
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredApps.map((app) => {
                    const hasOverdueFollowUp = app.nextFollowUpAt && new Date(app.nextFollowUpAt) <= new Date();
                    return (
                      <TableRow key={app.id}>
                        <TableCell>
                          <Link href={`/dashboard/applications/${app.id}`} className="font-medium hover:text-primary hover:underline">
                            {app.companyName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">{app.jobTitle}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${stateBadgeColor[app.currentState ?? "applied"]}`}>
                            {app.currentState}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground capitalize">
                          {app.pipelineTrack?.replace("_", " ")}
                        </TableCell>
                        <TableCell className="text-xs">{formatDate(app.appliedAt)}</TableCell>
                        <TableCell className="text-xs">
                          {app.nextFollowUpAt ? (
                            <span className={hasOverdueFollowUp ? "text-red-500 dark:text-red-400 font-medium" : ""}>
                              {formatDate(app.nextFollowUpAt)}
                              {hasOverdueFollowUp && " (overdue)"}
                            </span>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-center">{app.interviewCount ?? 0}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* KANBAN VIEW */}
      {viewMode === "kanban" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {columns.map((col) => {
            const colApps = filteredApps.filter((a) =>
              col.key.includes(a.currentState as AppState)
            );

            return (
              <div key={col.label} className="space-y-3">
                <div className={`rounded-lg border p-3 ${col.borderColor} ${col.color}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{col.label}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {colApps.length}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  {colApps.map((app) => {
                    const days = daysSince(app.appliedAt);
                    const hasFollowUp = app.nextFollowUpAt && new Date(app.nextFollowUpAt) <= new Date();

                    return (
                      <Link key={app.id} href={`/dashboard/applications/${app.id}`}>
                        <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:ring-1 hover:ring-primary/20">
                          <CardContent className="p-3 space-y-2">
                            <div>
                              <p className="text-sm font-semibold leading-tight">{app.companyName}</p>
                              <p className="text-xs text-muted-foreground truncate">{app.jobTitle}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${stateBadgeColor[app.currentState ?? "applied"]}`}
                              >
                                {app.currentState}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">{days}d ago</span>
                            </div>
                            {hasFollowUp && (
                              <div className="text-[10px] text-red-500 dark:text-red-400 font-medium">
                                Follow-up overdue
                              </div>
                            )}
                            {app.interviewCount != null && app.interviewCount > 0 ? (
                              <div className="text-[10px] text-muted-foreground">
                                {app.interviewCount} interview{app.interviewCount > 1 ? "s" : ""}
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}

                  {colApps.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">No applications</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
