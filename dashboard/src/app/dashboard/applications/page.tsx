"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { mockApplications } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Download, FileText, X } from "lucide-react";

type AppState = "applied" | "acknowledged" | "interviewing" | "offered" | "rejected" | "ghosted";

const columns: { key: AppState[]; label: string; color: string; borderColor: string }[] = [
  { key: ["applied"], label: "Applied", color: "bg-blue-50 dark:bg-blue-950/30", borderColor: "border-blue-200 dark:border-blue-800" },
  { key: ["acknowledged"], label: "Acknowledged", color: "bg-cyan-50 dark:bg-cyan-950/30", borderColor: "border-cyan-200 dark:border-cyan-800" },
  { key: ["interviewing"], label: "Interviewing", color: "bg-amber-50 dark:bg-amber-950/30", borderColor: "border-amber-200 dark:border-amber-800" },
  { key: ["offered"], label: "Offered", color: "bg-emerald-50 dark:bg-emerald-950/30", borderColor: "border-emerald-200 dark:border-emerald-800" },
  { key: ["rejected", "ghosted"], label: "Closed", color: "bg-zinc-50 dark:bg-zinc-900/30", borderColor: "border-zinc-200 dark:border-zinc-700" },
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

function exportCsv() {
  const header = "Company,Job Title,Status,Applied Date,Follow-ups,Interviews,Source\n";
  const rows = mockApplications.map((a) =>
    [a.companyName, a.jobTitle, a.currentState, a.appliedAt?.toISOString().split("T")[0], a.followUpCount, a.interviewCount, a.discoverySource].join(",")
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
  const [apps, setApps] = useState(mockApplications);

  // Quick add form
  const [newCompany, setNewCompany] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newStatus, setNewStatus] = useState("applied");
  const [newMethod, setNewMethod] = useState("direct_apply");

  const filteredApps = filterState === "all"
    ? apps
    : apps.filter((a) => a.currentState === filterState);

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
      isActive: true,
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
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-3 w-3 mr-1" /> Export CSV
          </Button>
          <Button size="sm" onClick={() => setShowAddForm(true)}>
            <Plus className="h-3 w-3 mr-1" /> Add Application
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5">
        {["all", "applied", "acknowledged", "interviewing", "offered", "rejected", "ghosted"].map((s) => (
          <Button
            key={s}
            variant={filterState === s ? "default" : "outline"}
            size="xs"
            onClick={() => setFilterState(s)}
            className="text-xs capitalize"
          >
            {s === "all" ? "All" : s}
          </Button>
        ))}
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

      {/* Kanban Board */}
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
    </div>
  );
}
