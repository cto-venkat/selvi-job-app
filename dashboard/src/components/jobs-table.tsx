"use client";

import { useState, useMemo, Fragment } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChevronDown, ChevronUp, ArrowUpDown, ExternalLink, XCircle, FileCheck, Download, Briefcase,
} from "lucide-react";
import type { Job } from "@/lib/schema";

function tierColor(tier: string | null) {
  switch (tier) {
    case "A+": return "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700";
    case "A": return "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-700";
    case "B": return "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700";
    case "C": return "bg-zinc-100 text-zinc-500 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-600";
    default: return "bg-zinc-100 text-zinc-500 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-600";
  }
}

function statusColor(status: string | null) {
  switch (status) {
    case "new": return "bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-900/50 dark:text-cyan-300 dark:border-cyan-700";
    case "scored": return "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700";
    case "cv_ready": return "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-700";
    case "applied": return "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700";
    case "dismissed": return "bg-zinc-100 text-zinc-400 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-600";
    default: return "bg-zinc-100 text-zinc-500 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-600";
  }
}

function formatDate(d: Date | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

type SortKey = "title" | "company" | "compositeScore" | "discoveredAt" | "tier";
type SortDir = "asc" | "desc";

export function JobsTable({ jobs: initialJobs }: { jobs: Job[] }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("discoveredAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const tiers = useMemo(() => [...new Set(jobs.map((j) => j.tier).filter(Boolean))].sort(), [jobs]);
  const sources = useMemo(() => [...new Set(jobs.map((j) => j.source).filter(Boolean))].sort(), [jobs]);
  const statuses = useMemo(() => [...new Set(jobs.map((j) => j.status).filter(Boolean))].sort(), [jobs]);

  const filtered = useMemo(() => {
    let result = jobs;
    if (tierFilter !== "all") result = result.filter((j) => j.tier === tierFilter);
    if (sourceFilter !== "all") result = result.filter((j) => j.source === sourceFilter);
    if (statusFilter !== "all") result = result.filter((j) => j.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((j) => j.title?.toLowerCase().includes(q) || j.company?.toLowerCase().includes(q) || j.location?.toLowerCase().includes(q));
    }
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "title": cmp = (a.title ?? "").localeCompare(b.title ?? ""); break;
        case "company": cmp = (a.company ?? "").localeCompare(b.company ?? ""); break;
        case "compositeScore": cmp = Number(a.compositeScore ?? 0) - Number(b.compositeScore ?? 0); break;
        case "discoveredAt": cmp = new Date(a.discoveredAt ?? 0).getTime() - new Date(b.discoveredAt ?? 0).getTime(); break;
        case "tier": {
          const order: Record<string, number> = { "A+": 0, A: 1, B: 2, C: 3 };
          cmp = (order[a.tier ?? "C"] ?? 4) - (order[b.tier ?? "C"] ?? 4);
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [jobs, tierFilter, sourceFilter, statusFilter, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  async function dismissJob(jobId: string) {
    setJobs(jobs.map((j) => j.id === jobId ? { ...j, status: "dismissed" } : j));
    try {
      await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "dismissed" }),
      });
    } catch { /* demo mode */ }
  }

  function exportCsv() {
    const header = "Title,Company,Tier,Score,Source,Location,Status,Discovered\n";
    const rows = filtered.map((j) =>
      [j.title, j.company, j.tier, j.compositeScore, j.source, j.location, j.status, j.discoveredAt?.toISOString().split("T")[0]].map((v) => `"${v ?? ""}"`).join(",")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "jobs.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function SortButton({ col, children }: { col: SortKey; children: React.ReactNode }) {
    return (
      <button onClick={() => toggleSort(col)} className="flex items-center gap-1 hover:text-foreground transition-colors">
        {children}
        {sortKey === col ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </button>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Briefcase className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground font-medium">No jobs discovered yet</p>
          <p className="text-sm text-muted-foreground mt-1">Your AI search is running. Check back soon.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input placeholder="Search jobs..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-64" />
        <Select value={tierFilter} onValueChange={(v) => setTierFilter(v ?? "all")}>
          <SelectTrigger className="w-[120px]"><SelectValue placeholder="Tier" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            {tiers.map((t) => (<SelectItem key={t} value={t!}>{t}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v ?? "all")}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {sources.map((s) => (<SelectItem key={s} value={s!}>{s}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statuses.map((s) => (<SelectItem key={s} value={s!}>{s}</SelectItem>))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="h-3 w-3 mr-1" /> Export
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} job{filtered.length !== 1 ? "s" : ""}</p>

      {/* Table */}
      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[260px]"><SortButton col="title">Title</SortButton></TableHead>
              <TableHead className="w-[140px]"><SortButton col="company">Company</SortButton></TableHead>
              <TableHead className="w-[70px]"><SortButton col="tier">Tier</SortButton></TableHead>
              <TableHead className="w-[80px]"><SortButton col="compositeScore">Score</SortButton></TableHead>
              <TableHead className="w-[80px]">Source</TableHead>
              <TableHead className="hidden lg:table-cell">Location</TableHead>
              <TableHead className="w-[90px]">Status</TableHead>
              <TableHead className="w-[110px]"><SortButton col="discoveredAt">Discovered</SortButton></TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No jobs match the current filters</TableCell>
              </TableRow>
            ) : (
              filtered.map((job) => {
                return (
                  <Fragment key={job.id}>
                    <TableRow
                      className={`cursor-pointer hover:bg-accent/50 ${job.status === "dismissed" ? "opacity-50" : ""}`}
                      onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
                    >
                      <TableCell className="font-medium"><span className="line-clamp-1">{job.title}</span></TableCell>
                      <TableCell className="text-muted-foreground">{job.company}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs font-mono ${tierColor(job.tier)}`}>{job.tier ?? "-"}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-cyan-600 dark:text-cyan-400">{job.compositeScore ?? "-"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{job.source}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{job.location}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${statusColor(job.status)}`}>{job.status ?? "-"}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(job.discoveredAt)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {job.status !== "dismissed" && (
                            <>
                              <Button variant="ghost" size="icon-xs" title="Start CV" className="text-cyan-600 dark:text-cyan-400">
                                <FileCheck className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon-xs" title="Dismiss" onClick={() => dismissJob(job.id)} className="text-muted-foreground hover:text-red-500">
                                <XCircle className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedId === job.id && (
                      <TableRow>
                        <TableCell colSpan={9} className="bg-accent/20 p-0">
                          <Card className="m-2 border-border">
                            <CardContent className="pt-4 space-y-3">
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                                <div><span className="text-muted-foreground">Job Type:</span> {job.jobType ?? "-"}</div>
                                <div><span className="text-muted-foreground">Salary:</span> {job.salaryMin && job.salaryMax ? `${job.salaryMin} - ${job.salaryMax}` : "-"}</div>
                                <div><span className="text-muted-foreground">CV Status:</span> {job.cvPackageStatus ?? "not started"}</div>
                                <div><span className="text-muted-foreground">Ready to Apply:</span> {job.readyToApply ? "Yes" : "No"}</div>
                              </div>
                              {job.description && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Description</p>
                                  <p className="text-sm line-clamp-4">{job.description}</p>
                                </div>
                              )}
                              <div className="flex items-center gap-3">
                                {job.url && (
                                  <a href={job.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-cyan-600 dark:text-cyan-400 hover:underline">
                                    View listing <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                                <a
                                  href={`/dashboard/apply/${job.id}`}
                                  className="inline-flex items-center gap-1.5 rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-700 transition-colors"
                                >
                                  <Briefcase className="h-3 w-3" />
                                  Prepare Application
                                </a>
                              </div>
                            </CardContent>
                          </Card>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
