"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Calendar,
  FileText,
  Mail,
  MessageSquare,
  Send,
  Eye,
  Clock,
  AlertTriangle,
  CheckCircle,
  Briefcase,
} from "lucide-react";

const stateConfig: Record<string, { label: string; class: string }> = {
  applied: { label: "Applied", class: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" },
  acknowledged: { label: "Acknowledged", class: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300" },
  interviewing: { label: "Interviewing", class: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" },
  offered: { label: "Offered", class: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" },
  rejected: { label: "Rejected", class: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400" },
  ghosted: { label: "Ghosted", class: "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400" },
};

const allStates = ["applied", "acknowledged", "interviewing", "offered", "rejected", "ghosted"];

function formatDate(d: Date | string | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [app, setApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [notes, setNotes] = useState<any[]>([]);
  const [currentState, setCurrentState] = useState("applied");

  useEffect(() => {
    fetch(`/api/data?type=applications`)
      .then((r) => r.json())
      .then((d) => {
        const apps = d.data || [];
        const found = apps.find((a: any) => a.id === id);
        if (found) {
          const normalized = {
            ...found,
            companyName: found.companyName ?? found.company_name,
            jobTitle: found.jobTitle ?? found.job_title,
            currentState: found.currentState ?? found.current_state,
            pipelineTrack: found.pipelineTrack ?? found.pipeline_track,
            appliedAt: found.appliedAt ?? found.applied_at ? new Date(found.appliedAt ?? found.applied_at) : null,
            nextFollowUpAt: found.nextFollowUpAt ?? found.next_follow_up_at ? new Date(found.nextFollowUpAt ?? found.next_follow_up_at) : null,
            interviewCount: found.interviewCount ?? found.interview_count ?? 0,
            followUpCount: found.followUpCount ?? found.follow_up_count ?? 0,
            discoverySource: found.discoverySource ?? found.discovery_source,
          };
          setApp(normalized);
          setCurrentState(normalized.currentState ?? "applied");
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/applications")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Applications
        </Button>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/applications")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Applications
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">Application not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cfg = stateConfig[currentState] ?? stateConfig.applied;

  function handleAddNote() {
    if (!noteText.trim()) return;
    setNotes([
      ...notes,
      { id: `n-${Date.now()}`, date: new Date(), text: noteText.trim() },
    ]);
    setNoteText("");
  }

  async function handleStatusChange(newState: string) {
    setCurrentState(newState);
    try {
      await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentState: newState }),
      });
    } catch {
      // Silently fail in demo mode
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/applications")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Applications
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{app.companyName}</h1>
          <p className="text-muted-foreground">{app.jobTitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-xs ${cfg.class}`}>{cfg.label}</Badge>
          <select
            value={currentState}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            {allStates.map((s) => (
              <option key={s} value={s}>{stateConfig[s]?.label ?? s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Info row */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card size="sm">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Applied</p>
            <p className="text-sm font-medium">{formatDate(app.appliedAt)}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Track</p>
            <p className="text-sm font-medium capitalize">{app.pipelineTrack?.replace("_", " ")}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Interviews</p>
            <p className="text-sm font-medium">{app.interviewCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Follow-ups</p>
            <p className="text-sm font-medium">{app.followUpCount ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-4">
                No timeline events recorded yet.
              </p>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {notes.length > 0 ? (
                notes.map((note) => (
                  <div key={note.id} className="rounded-md border border-border p-3">
                    <p className="text-sm">{note.text}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{formatDate(note.date)}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">No notes yet.</p>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Add a note..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                />
                <Button size="sm" onClick={handleAddNote} disabled={!noteText.trim()}>Add</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-2">No documents.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Follow-up Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Follow-ups sent</span>
                  <span className="font-medium">{app.followUpCount ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Next follow-up</span>
                  <span className="font-medium">
                    {app.nextFollowUpAt ? formatDate(app.nextFollowUpAt) : "None scheduled"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discovery source</span>
                  <span className="font-medium capitalize">{app.discoverySource}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
