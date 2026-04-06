"use client";

import { useState, useEffect } from "react";
import { useData } from "@/lib/use-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  Eye,
  CalendarDays,
  CheckCircle,
  Copy,
  Check,
  RefreshCw,
  X,
  Pencil,
  Sparkles,
  ShieldCheck,
  ScanSearch,
  Clock,
  Hash,
} from "lucide-react";

type PostStatus = "planned" | "drafted" | "published" | "rejected";

const statusConfig: Record<string, { label: string; class: string }> = {
  planned: {
    label: "Planned",
    class: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  drafted: {
    label: "Drafted",
    class: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  published: {
    label: "Published",
    class: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  rejected: {
    label: "Rejected",
    class: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
};

const pillarLabel: Record<string, string> = {
  thought_leadership: "Thought Leadership",
  practical_tips: "Practical Tips",
  industry_trends: "Industry Trends",
};

export default function LinkedInPage() {
  type ContentItem = { id: string; topicTitle: string; contentPillar: string | null; draftText: string | null; suggestedPostDay: string | null; status: PostStatus; publishedAt: string | null; rejectReason: string | null; };
  type RecItem = { id: string; type: string; area: string; suggestion: string; current: string; proposed: string; rationale: string; status: "pending" | "implemented" | "dismissed" };
  type AlignItem = { id: string; issue: string; severity: string; snoozedUntil: Date | null };
  type HashItem = { tag: string; category: string; selected: boolean };

  const { data: calendar, loading } = useData<any>("content-calendar");
  const [content, setContent] = useState<ContentItem[]>([]);

  useEffect(() => {
    if (calendar.length > 0) {
      setContent(calendar.map((c: any) => ({
        id: c.id,
        topicTitle: c.topicTitle ?? c.topic_title ?? "Untitled",
        contentPillar: c.contentPillar ?? c.content_pillar,
        draftText: c.draftText ?? c.draft_text,
        suggestedPostDay: c.suggestedPostDay ?? c.suggested_post_day,
        status: (c.status ?? "planned") as PostStatus,
        publishedAt: c.publishedAt ?? c.published_at,
        rejectReason: c.rejectReason ?? c.reject_reason,
      })));
    }
  }, [calendar]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<RecItem[]>([]);
  const [alignmentIssues, setAlignmentIssues] = useState<AlignItem[]>([]);
  const [hashtags, setHashtags] = useState<HashItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const profile = { completenessScore: 0, recentViews: 0, alignmentIssues: [] as AlignItem[] };

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

  function handleEditStart(id: string, text: string) {
    setEditingId(id);
    setEditText(text);
  }

  function handleEditSave(id: string) {
    setContent((prev) =>
      prev.map((p) => (p.id === id ? { ...p, draftText: editText } : p))
    );
    setEditingId(null);
    setEditText("");
    console.log("Draft saved for", id);
  }

  function handleCopy(id: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    showToast("Copied to clipboard.");
  }

  function handlePublish(id: string) {
    setContent((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status: "published" as PostStatus, publishedAt: new Date().toISOString() }
          : p
      )
    );
    showToast("Post marked as published.");
  }

  function handleReject(id: string) {
    setContent((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status: "rejected" as PostStatus, rejectReason: rejectReason }
          : p
      )
    );
    setRejectingId(null);
    setRejectReason("");
    console.log("Rejected:", id, "Reason:", rejectReason);
  }

  function handleRegenerate(id: string) {
    setRegeneratingId(id);
    setContent((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status: "drafted" as PostStatus,
              draftText: "Regenerating draft...",
              rejectReason: null,
            }
          : p
      )
    );
    // Simulate AI regeneration delay
    setTimeout(() => {
      setContent((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                draftText: `[Regenerated] Fresh perspective on "${p.topicTitle}": Building on the latest research and my experience working with enterprise L&D teams, here's what I've observed...`,
              }
            : p
        )
      );
      setRegeneratingId(null);
      showToast("Draft regenerated.");
    }, 2000);
  }

  function handleImplementRec(id: string) {
    setRecommendations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "implemented" as typeof r.status } : r))
    );
    showToast("Recommendation marked as implemented.");
  }

  function handleDismissRec(id: string) {
    setRecommendations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "dismissed" as typeof r.status } : r))
    );
    showToast("Recommendation dismissed.");
  }

  function handleResolveIssue(id: string) {
    setAlignmentIssues((prev) => prev.filter((i) => i.id !== id));
    showToast("Alignment issue resolved.");
  }

  function handleSnoozeIssue(id: string) {
    const snoozeDate = new Date();
    snoozeDate.setDate(snoozeDate.getDate() + 7);
    setAlignmentIssues((prev) =>
      prev.map((i) => (i.id === id ? { ...i, snoozedUntil: snoozeDate } : i))
    );
    showToast("Issue snoozed for 7 days.");
  }

  function toggleHashtag(tag: string) {
    setHashtags((prev) =>
      prev.map((h) => (h.tag === tag ? { ...h, selected: !h.selected } : h))
    );
  }

  const activeIssues = alignmentIssues.filter(
    (i) => !i.snoozedUntil || new Date(i.snoozedUntil) < new Date()
  );
  const snoozedIssues = alignmentIssues.filter(
    (i) => i.snoozedUntil && new Date(i.snoozedUntil) >= new Date()
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">LinkedIn</h1>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">LinkedIn</h1>
        <p className="text-sm text-muted-foreground">
          Content calendar, profile optimisation, and alignment
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => console.log("Generate new post requested")}>
          <Sparkles className="h-3.5 w-3.5" />
          Generate New Post
        </Button>
        <Button variant="outline" size="sm" onClick={() => console.log("Profile audit requested")}>
          <ScanSearch className="h-3.5 w-3.5" />
          Run Profile Audit
        </Button>
        <Button variant="outline" size="sm" onClick={() => console.log("Alignment check requested")}>
          <ShieldCheck className="h-3.5 w-3.5" />
          Check Alignment
        </Button>
      </div>

      {/* Profile Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Profile Score</p>
                <p className="text-3xl font-bold tracking-tight mt-1">
                  {profile.completenessScore}%
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-cyan-500 opacity-80" />
            </div>
            <div className="mt-3 w-full rounded-full bg-muted h-2">
              <div
                className="rounded-full bg-cyan-500 h-2 transition-all"
                style={{ width: `${profile.completenessScore}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Profile Views</p>
                <p className="text-3xl font-bold tracking-tight mt-1">
                  {profile.recentViews}
                </p>
              </div>
              <Eye className="h-8 w-8 text-blue-500 opacity-80" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">Last 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Alignment Issues</p>
                <p className="text-3xl font-bold tracking-tight mt-1">
                  {activeIssues.length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-amber-500 opacity-80" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {snoozedIssues.length > 0
                ? `${snoozedIssues.length} snoozed`
                : "Items to address"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Content Calendar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Content Calendar
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {content.map((post) => {
            const cfg = statusConfig[post.status] ?? statusConfig.planned;
            const isEditing = editingId === post.id;
            const isRejecting = rejectingId === post.id;

            return (
              <div
                key={post.id}
                className="rounded-md border border-border p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold">{post.topicTitle}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-[10px]">
                        {pillarLabel[post.contentPillar ?? ""] ?? post.contentPillar}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {post.suggestedPostDay}
                      </span>
                      {post.publishedAt && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">
                          Published {new Date(post.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-xs shrink-0 ${cfg.class}`}>
                    {cfg.label}
                  </Badge>
                </div>

                {/* Draft text or editor */}
                {isEditing ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={4}
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleEditSave(post.id)}>
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  post.draftText && (
                    <p className="text-xs text-muted-foreground">
                      {post.draftText}
                    </p>
                  )
                )}

                {/* Reject reason input */}
                {isRejecting && (
                  <div className="space-y-2 border-t pt-2">
                    <p className="text-xs font-medium text-muted-foreground">Reason for rejection:</p>
                    <Textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={2}
                      placeholder="Not aligned with current strategy..."
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleReject(post.id)}
                      >
                        Confirm Reject
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRejectingId(null);
                          setRejectReason("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Hashtag suggestions for drafted/planned posts */}
                {(post.status === "drafted" || post.status === "planned") && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Hash className="h-3 w-3 text-muted-foreground" />
                    {hashtags.map((h) => (
                      <button
                        key={h.tag}
                        onClick={() => toggleHashtag(h.tag)}
                        className={`text-[10px] rounded-full px-2 py-0.5 border transition-colors ${
                          h.selected
                            ? "bg-primary/10 border-primary/30 text-primary dark:bg-primary/20"
                            : "bg-muted border-border text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {h.tag}
                      </button>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                {!isEditing && !isRejecting && (
                  <div className="flex items-center gap-2 flex-wrap border-t pt-2">
                    {post.status !== "published" && post.status !== "rejected" && (
                      <>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() =>
                            handleEditStart(post.id, post.draftText ?? "")
                          }
                        >
                          <Pencil className="h-3 w-3" />
                          Edit Draft
                        </Button>
                        <Button
                          size="xs"
                          onClick={() => handlePublish(post.id)}
                        >
                          <Check className="h-3 w-3" />
                          Mark Published
                        </Button>
                        <Button
                          variant="destructive"
                          size="xs"
                          onClick={() => setRejectingId(post.id)}
                        >
                          <X className="h-3 w-3" />
                          Reject
                        </Button>
                      </>
                    )}
                    {post.draftText && (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() =>
                          handleCopy(post.id, post.draftText ?? "")
                        }
                      >
                        {copiedId === post.id ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        {copiedId === post.id ? "Copied" : "Copy"}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleRegenerate(post.id)}
                      disabled={regeneratingId === post.id}
                    >
                      <RefreshCw className={`h-3 w-3 ${regeneratingId === post.id ? "animate-spin" : ""}`} />
                      {regeneratingId === post.id ? "Regenerating..." : "Regenerate"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Profile Optimisation Recommendations */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-cyan-500" />
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Profile Optimisation Recommendations
            </CardTitle>
            <Badge variant="secondary" className="text-[10px] ml-auto">
              {recommendations.filter((r) => r.status === "pending").length} pending
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className={`rounded-md border border-border p-4 space-y-2 ${
                rec.status !== "pending" ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {rec.area}
                    </Badge>
                    <span className={`text-sm font-medium ${rec.status === "implemented" ? "line-through text-muted-foreground" : rec.status === "dismissed" ? "text-muted-foreground" : ""}`}>
                      {rec.suggestion}
                    </span>
                  </div>
                </div>
                {rec.status !== "pending" && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${
                      rec.status === "implemented"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-400"
                    }`}
                  >
                    {rec.status === "implemented" ? "Implemented" : "Dismissed"}
                  </Badge>
                )}
              </div>

              {/* Text diff */}
              <div className="space-y-1 text-xs">
                <div className="flex gap-2">
                  <span className="text-red-500 dark:text-red-400 font-mono shrink-0">-</span>
                  <span className="text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">
                    {rec.current}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-emerald-500 dark:text-emerald-400 font-mono shrink-0">+</span>
                  <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">
                    {rec.proposed}
                  </span>
                </div>
              </div>

              {rec.status === "pending" && (
                <div className="flex gap-2 pt-1">
                  <Button
                    size="xs"
                    onClick={() => handleImplementRec(rec.id)}
                  >
                    <Check className="h-3 w-3" />
                    Implement
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => handleDismissRec(rec.id)}
                  >
                    Dismiss
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Alignment Issues */}
      {(activeIssues.length > 0 || snoozedIssues.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Profile Alignment Issues
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeIssues.map((issue) => (
              <div
                key={issue.id}
                className="flex items-start justify-between gap-3 rounded-md border border-border p-3"
              >
                <div className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5 shrink-0">&bull;</span>
                  <div>
                    <span className="text-sm">{issue.issue}</span>
                    <Badge
                      variant="outline"
                      className={`ml-2 text-[10px] ${
                        issue.severity === "high"
                          ? "border-red-300 text-red-600 dark:border-red-700 dark:text-red-400"
                          : "border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400"
                      }`}
                    >
                      {issue.severity}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="xs"
                    onClick={() => handleResolveIssue(issue.id)}
                  >
                    Resolve
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => handleSnoozeIssue(issue.id)}
                  >
                    <Clock className="h-3 w-3" />
                    Snooze 7d
                  </Button>
                </div>
              </div>
            ))}
            {snoozedIssues.map((issue) => (
              <div
                key={issue.id}
                className="flex items-start justify-between gap-3 rounded-md border border-dashed border-border p-3 opacity-50"
              >
                <div className="flex items-start gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-sm text-muted-foreground">{issue.issue}</span>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  Snoozed until{" "}
                  {issue.snoozedUntil
                    ? new Date(issue.snoozedUntil).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })
                    : ""}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 bg-foreground text-background px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}
    </div>
  );
}
