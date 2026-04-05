"use client";

import { useState, useMemo } from "react";
import {
  mockInterviews,
  mockPastInterviews,
  mockInterviewDebriefs,
} from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  Phone,
  Plus,
  FileText,
  ExternalLink,
  X,
  CheckCircle,
  StickyNote,
  CalendarDays,
  ChevronRight,
  LayoutGrid,
  TableIcon,
  Search,
  ArrowUpDown,
  ChevronUp as ChevronUpIcon,
  ChevronDown as ChevronDownIcon,
} from "lucide-react";
import Link from "next/link";

type ViewMode = "upcoming" | "past" | "all";
type InterviewOutcome = "progressed" | "rejected" | "pending" | "offered";

const formatBadge: Record<string, string> = {
  competency: "Competency",
  case_study: "Case Study",
  behavioral: "Behavioural",
  panel: "Panel",
  technical: "Technical",
};

const locationIcon: Record<string, typeof Video> = {
  video: Video,
  in_person: MapPin,
  phone: Phone,
};

function getCountdown(date: Date | string | null): string {
  if (!date) return "";
  const now = new Date();
  const target = new Date(date);
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "Passed";
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return `In ${diffDays} days`;
}

function getCountdownColor(date: Date | string | null): string {
  if (!date) return "";
  const diffDays = Math.ceil(
    (new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays <= 0) return "text-red-600 dark:text-red-400";
  if (diffDays <= 2) return "text-amber-600 dark:text-amber-400";
  return "text-blue-600 dark:text-blue-400";
}

function formatDate(d: Date | string | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(d: Date | string | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

const outcomeConfig: Record<
  InterviewOutcome,
  { label: string; class: string }
> = {
  progressed: {
    label: "Progressed",
    class: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  rejected: {
    label: "Rejected",
    class: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  pending: {
    label: "Pending",
    class: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  offered: {
    label: "Offered",
    class: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
};

type DisplayMode = "cards" | "table";
type FilterFormat = "all" | "video" | "in_person" | "phone";
type FilterTrack = "all" | "standard" | "executive";

export default function InterviewsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("upcoming");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("cards");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterFormat, setFilterFormat] = useState<FilterFormat>("all");
  const [filterTrack, setFilterTrack] = useState<FilterTrack>("all");
  const [sortDateDir, setSortDateDir] = useState<"asc" | "desc">("asc");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [debriefs, setDebriefs] = useState<
    Record<string, { outcome: InterviewOutcome; notes: string; date: Date }>
  >(mockInterviewDebriefs);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completionOutcome, setCompletionOutcome] = useState<InterviewOutcome>("pending");
  const [completionNotes, setCompletionNotes] = useState("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set());
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newInterview, setNewInterview] = useState({
    company: "",
    role: "",
    date: "",
    time: "",
    format: "competency",
    locationType: "video",
    link: "",
  });
  const [addedInterviews, setAddedInterviews] = useState<typeof mockInterviews>([]);
  const [debriefEditId, setDebriefEditId] = useState<string | null>(null);
  const [debriefText, setDebriefText] = useState("");

  const allUpcoming = [...mockInterviews, ...addedInterviews].filter(
    (iv) => !cancelledIds.has(iv.id)
  );
  const allPast = mockPastInterviews;

  const displayInterviews = useMemo(() => {
    let items =
      viewMode === "upcoming"
        ? allUpcoming
        : viewMode === "past"
        ? allPast
        : [...allUpcoming, ...allPast];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (iv) =>
          iv.companyName?.toLowerCase().includes(q) ||
          iv.roleTitle?.toLowerCase().includes(q)
      );
    }

    // Format filter
    if (filterFormat !== "all") {
      items = items.filter((iv) => iv.locationType === filterFormat);
    }

    // Track filter
    if (filterTrack !== "all") {
      items = items.filter((iv) => iv.interviewTrack === filterTrack);
    }

    return [...items].sort((a, b) => {
      const da = a.interviewDate ? new Date(a.interviewDate).getTime() : 0;
      const db_ = b.interviewDate ? new Date(b.interviewDate).getTime() : 0;
      const dir = sortDateDir === "asc" ? 1 : -1;
      return (da - db_) * dir;
    });
  }, [viewMode, allUpcoming, allPast, cancelledIds, addedInterviews, searchQuery, filterFormat, filterTrack, sortDateDir]);

  // Mini calendar for this week
  const thisWeekDays = useMemo(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const interviewsOnDay = allUpcoming.filter((iv) => {
        if (!iv.interviewDate) return false;
        const id = new Date(iv.interviewDate);
        return (
          id.getDate() === d.getDate() &&
          id.getMonth() === d.getMonth() &&
          id.getFullYear() === d.getFullYear()
        );
      });
      days.push({ date: d, interviews: interviewsOnDay });
    }
    return days;
  }, [allUpcoming]);

  function handleAddInterview() {
    if (!newInterview.company || !newInterview.role || !newInterview.date) return;
    const id = `manual-${Date.now()}`;
    const iv = {
      id,
      tenantId: "t-0001",
      companyName: newInterview.company,
      roleTitle: newInterview.role,
      interviewTrack: "standard",
      interviewFormat: newInterview.format,
      interviewDate: newInterview.date,
      interviewStartTime: newInterview.time || "09:00",
      status: "scheduled",
      locationType: newInterview.locationType,
      videoLink: newInterview.locationType === "video" ? newInterview.link : null,
      physicalAddress: newInterview.locationType === "in_person" ? newInterview.link : null,
    };
    setAddedInterviews((prev) => [...prev, iv]);
    setAddDialogOpen(false);
    setNewInterview({
      company: "",
      role: "",
      date: "",
      time: "",
      format: "competency",
      locationType: "video",
      link: "",
    });
    console.log("Added interview:", iv);
  }

  function handleMarkComplete(id: string) {
    setDebriefs((prev) => ({
      ...prev,
      [id]: {
        outcome: completionOutcome,
        notes: completionNotes,
        date: new Date(),
      },
    }));
    setCompletingId(null);
    setCompletionOutcome("pending");
    setCompletionNotes("");
    console.log("Marked complete:", id, completionOutcome);
  }

  function handleCancel(id: string) {
    setCancelledIds((prev) => new Set([...prev, id]));
    setCancellingId(null);
    setCancelReason("");
    console.log("Cancelled interview:", id, "Reason:", cancelReason);
  }

  function handleSaveNote(id: string) {
    setNotes((prev) => ({ ...prev, [id]: noteText }));
    setEditingNoteId(null);
    setNoteText("");
    console.log("Note saved for:", id);
  }

  function handleSaveDebrief(id: string) {
    setDebriefs((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? { outcome: "pending" as InterviewOutcome, date: new Date() }),
        notes: debriefText,
      },
    }));
    setDebriefEditId(null);
    setDebriefText("");
    console.log("Debrief saved for:", id);
  }

  const isPast = (iv: typeof mockInterviews[0]) =>
    iv.status === "completed" ||
    (iv.interviewDate && new Date(iv.interviewDate) < new Date());

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Interviews</h1>
          <p className="text-sm text-muted-foreground">
            {allUpcoming.length} upcoming &middot; {allPast.length} past
          </p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger
            render={
              <Button size="sm">
                <Plus className="h-3.5 w-3.5" />
                Add Interview
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Interview</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Company</label>
                <Input
                  value={newInterview.company}
                  onChange={(e) =>
                    setNewInterview((p) => ({ ...p, company: e.target.value }))
                  }
                  placeholder="e.g., Deloitte"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Role</label>
                <Input
                  value={newInterview.role}
                  onChange={(e) =>
                    setNewInterview((p) => ({ ...p, role: e.target.value }))
                  }
                  placeholder="e.g., Senior L&D Consultant"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Date</label>
                  <Input
                    type="date"
                    value={newInterview.date}
                    onChange={(e) =>
                      setNewInterview((p) => ({ ...p, date: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Time</label>
                  <Input
                    type="time"
                    value={newInterview.time}
                    onChange={(e) =>
                      setNewInterview((p) => ({ ...p, time: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Format</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {["competency", "case_study", "behavioral", "panel", "technical"].map(
                      (f) => (
                        <button
                          key={f}
                          onClick={() =>
                            setNewInterview((p) => ({ ...p, format: f }))
                          }
                          className={`text-[10px] rounded-full px-2 py-0.5 border transition-colors ${
                            newInterview.format === f
                              ? "bg-primary/10 border-primary/30 text-primary"
                              : "bg-muted border-border text-muted-foreground"
                          }`}
                        >
                          {formatBadge[f] ?? f}
                        </button>
                      )
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Location Type</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {["video", "in_person", "phone"].map((l) => (
                      <button
                        key={l}
                        onClick={() =>
                          setNewInterview((p) => ({ ...p, locationType: l }))
                        }
                        className={`text-[10px] rounded-full px-2 py-0.5 border transition-colors ${
                          newInterview.locationType === l
                            ? "bg-primary/10 border-primary/30 text-primary"
                            : "bg-muted border-border text-muted-foreground"
                        }`}
                      >
                        {l === "in_person" ? "In Person" : l.charAt(0).toUpperCase() + l.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {newInterview.locationType === "video"
                    ? "Video Link"
                    : newInterview.locationType === "in_person"
                    ? "Address"
                    : "Phone Number"}
                </label>
                <Input
                  value={newInterview.link}
                  onChange={(e) =>
                    setNewInterview((p) => ({ ...p, link: e.target.value }))
                  }
                  placeholder={
                    newInterview.locationType === "video"
                      ? "https://teams.microsoft.com/..."
                      : newInterview.locationType === "in_person"
                      ? "123 Main St, London"
                      : "+44..."
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddInterview}>Add Interview</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Mini Week Calendar */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">This Week</span>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {thisWeekDays.map((day) => {
              const isToday =
                day.date.toDateString() === new Date().toDateString();
              const hasInterview = day.interviews.length > 0;
              return (
                <div
                  key={day.date.toISOString()}
                  className={`text-center rounded-md p-1.5 ${
                    isToday
                      ? "bg-primary/10 border border-primary/20"
                      : hasInterview
                      ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                      : "bg-muted/30"
                  }`}
                >
                  <p className="text-[10px] text-muted-foreground">
                    {day.date.toLocaleDateString("en-GB", { weekday: "short" })}
                  </p>
                  <p
                    className={`text-sm font-medium ${
                      isToday ? "text-primary" : ""
                    }`}
                  >
                    {day.date.getDate()}
                  </p>
                  {hasInterview && (
                    <div className="flex justify-center gap-0.5 mt-0.5">
                      {day.interviews.map((iv) => (
                        <div
                          key={iv.id}
                          className="h-1 w-1 rounded-full bg-amber-500"
                          title={`${iv.companyName} - ${iv.interviewStartTime}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Controls Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* View Toggle: upcoming/past/all */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
          {(["upcoming", "past", "all"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                viewMode === mode
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Display Mode Toggle: cards/table */}
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setDisplayMode("cards")}
            className={`p-1.5 rounded-md transition-colors ${displayMode === "cards" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            title="Card view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDisplayMode("table")}
            className={`p-1.5 rounded-md transition-colors ${displayMode === "table" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            title="Table view"
          >
            <TableIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search company or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Format filter */}
        <select
          value={filterFormat}
          onChange={(e) => setFilterFormat(e.target.value as FilterFormat)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="all">All Formats</option>
          <option value="video">Video</option>
          <option value="in_person">In Person</option>
          <option value="phone">Phone</option>
        </select>

        {/* Track filter */}
        <select
          value={filterTrack}
          onChange={(e) => setFilterTrack(e.target.value as FilterTrack)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="all">All Tracks</option>
          <option value="standard">Standard</option>
          <option value="executive">Executive</option>
        </select>
      </div>

      {/* Interview Table View */}
      {displayMode === "table" && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>
                    <button onClick={() => setSortDateDir(sortDateDir === "asc" ? "desc" : "asc")} className="flex items-center gap-1 hover:text-foreground">
                      Date {sortDateDir === "asc" ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />}
                    </button>
                  </TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prep</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayInterviews.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No interviews match your filters
                    </TableCell>
                  </TableRow>
                ) : (
                  displayInterviews.map((iv) => {
                    const past = isPast(iv);
                    const debrief = debriefs[iv.id];
                    return (
                      <TableRow key={iv.id} className="cursor-pointer" onClick={() => window.location.href = `/dashboard/interviews/${iv.id}`}>
                        <TableCell className="font-medium">{iv.companyName}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[180px] truncate">{iv.roleTitle}</TableCell>
                        <TableCell className="text-xs">
                          {iv.interviewDate ? new Date(iv.interviewDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                        </TableCell>
                        <TableCell className="text-xs">{iv.interviewStartTime}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">
                            {formatBadge[iv.interviewFormat ?? ""] ?? iv.interviewFormat}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {debrief ? (
                            <Badge variant="outline" className={`text-[10px] ${outcomeConfig[debrief.outcome].class}`}>
                              {outcomeConfig[debrief.outcome].label}
                            </Badge>
                          ) : past ? (
                            <Badge variant="outline" className="text-[10px] text-zinc-500">Completed</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-blue-600 dark:text-blue-400">Scheduled</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {debrief?.notes ? "Debriefed" : notes[iv.id] ? "Notes" : "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground capitalize">
                          {iv.locationType?.replace("_", " ") ?? "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Interview Cards */}
      {displayMode === "cards" && displayInterviews.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">
              No interviews to show
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {viewMode === "upcoming"
                ? "Keep applying -- interviews will appear here."
                : "No past interviews recorded."}
            </p>
          </CardContent>
        </Card>
      ) : displayMode === "cards" ? (
        <div className="grid gap-4 md:grid-cols-2">
          {displayInterviews.map((iv) => {
            const past = isPast(iv);
            const countdown = getCountdown(iv.interviewDate);
            const countdownColor = getCountdownColor(iv.interviewDate);
            const LocationIcon =
              locationIcon[iv.locationType ?? "video"] ?? Video;
            const debrief = debriefs[iv.id];
            const note = notes[iv.id];

            return (
              <Card
                key={iv.id}
                className="relative overflow-hidden"
              >
                <div
                  className={`absolute top-0 left-0 w-1 h-full ${
                    past ? "bg-zinc-400" : "bg-amber-500"
                  }`}
                />
                <CardContent className="p-5 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {iv.companyName}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {iv.roleTitle}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {debrief && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${outcomeConfig[debrief.outcome].class}`}
                        >
                          {outcomeConfig[debrief.outcome].label}
                        </Badge>
                      )}
                      {!past && (
                        <Badge
                          className={`text-xs font-semibold ${countdownColor} bg-transparent border-current`}
                        >
                          {countdown}
                        </Badge>
                      )}
                      {past && !debrief && (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-zinc-500"
                        >
                          Completed
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Date/time */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-foreground">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {past ? formatShortDate(iv.interviewDate) : formatDate(iv.interviewDate)}
                    </div>
                    <div className="flex items-center gap-1.5 text-foreground">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {iv.interviewStartTime}
                    </div>
                  </div>

                  {/* Format & location */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {formatBadge[iv.interviewFormat ?? ""] ??
                        iv.interviewFormat}
                    </Badge>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <LocationIcon className="h-3.5 w-3.5" />
                      {iv.locationType === "video" ? (
                        <span className="text-blue-600 dark:text-blue-400">
                          Video call
                        </span>
                      ) : iv.locationType === "in_person" &&
                        iv.physicalAddress ? (
                        <span className="truncate max-w-[250px]">
                          {iv.physicalAddress}
                        </span>
                      ) : (
                        <span className="capitalize">
                          {iv.locationType?.replace("_", " ")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Saved note */}
                  {note && editingNoteId !== iv.id && (
                    <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
                      <StickyNote className="h-3 w-3 inline mr-1" />
                      {note}
                    </div>
                  )}

                  {/* Debrief notes */}
                  {debrief?.notes && debriefEditId !== iv.id && (
                    <div className="text-xs bg-muted/50 rounded px-2 py-1.5 border-l-2 border-primary/30">
                      <p className="font-medium text-muted-foreground mb-0.5">Debrief:</p>
                      {debrief.notes}
                    </div>
                  )}

                  {/* Inline note editor */}
                  {editingNoteId === iv.id && (
                    <div className="space-y-2">
                      <Textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Add interview notes..."
                        rows={3}
                        className="text-xs"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="xs"
                          onClick={() => handleSaveNote(iv.id)}
                        >
                          Save Note
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setEditingNoteId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Debrief editor */}
                  {debriefEditId === iv.id && (
                    <div className="space-y-2">
                      <Textarea
                        value={debriefText}
                        onChange={(e) => setDebriefText(e.target.value)}
                        placeholder="How did it go? Key takeaways, what went well, areas to improve..."
                        rows={4}
                        className="text-xs"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="xs"
                          onClick={() => handleSaveDebrief(iv.id)}
                        >
                          Save Debrief
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setDebriefEditId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Mark complete form */}
                  {completingId === iv.id && (
                    <div className="space-y-2 border-t pt-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Interview outcome:
                      </p>
                      <div className="flex gap-1 flex-wrap">
                        {(
                          ["progressed", "rejected", "pending", "offered"] as InterviewOutcome[]
                        ).map((o) => (
                          <button
                            key={o}
                            onClick={() => setCompletionOutcome(o)}
                            className={`text-[10px] rounded-full px-2 py-0.5 border transition-colors ${
                              completionOutcome === o
                                ? `${outcomeConfig[o].class}`
                                : "bg-muted border-border text-muted-foreground"
                            }`}
                          >
                            {outcomeConfig[o].label}
                          </button>
                        ))}
                      </div>
                      <Textarea
                        value={completionNotes}
                        onChange={(e) => setCompletionNotes(e.target.value)}
                        placeholder="Brief notes on how it went..."
                        rows={2}
                        className="text-xs"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="xs"
                          onClick={() => handleMarkComplete(iv.id)}
                        >
                          Confirm
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setCompletingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Cancel form */}
                  {cancellingId === iv.id && (
                    <div className="space-y-2 border-t pt-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Reason for cancellation:
                      </p>
                      <Textarea
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="e.g., Accepted another offer..."
                        rows={2}
                        className="text-xs"
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          size="xs"
                          onClick={() => handleCancel(iv.id)}
                        >
                          Confirm Cancel
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setCancellingId(null)}
                        >
                          Back
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  {completingId !== iv.id && cancellingId !== iv.id && (
                    <div className="flex items-center gap-1.5 flex-wrap border-t pt-2">
                      {!past && (
                        <>
                          <Link href={`/dashboard/interviews/${iv.id}`}>
                            <Button variant="outline" size="xs">
                              <FileText className="h-3 w-3" />
                              Prep Brief
                            </Button>
                          </Link>
                          {iv.locationType === "video" && iv.videoLink && (
                            <a
                              href={iv.videoLink}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button
                                size="xs"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Join Call
                              </Button>
                            </a>
                          )}
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => {
                              console.log("Reschedule requested:", iv.id);
                            }}
                          >
                            <Calendar className="h-3 w-3" />
                            Reschedule
                          </Button>
                          <Button
                            variant="destructive"
                            size="xs"
                            onClick={() => setCancellingId(iv.id)}
                          >
                            <X className="h-3 w-3" />
                            Cancel
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => {
                              setEditingNoteId(iv.id);
                              setNoteText(notes[iv.id] ?? "");
                            }}
                          >
                            <StickyNote className="h-3 w-3" />
                            {notes[iv.id] ? "Edit Notes" : "Add Notes"}
                          </Button>
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => setCompletingId(iv.id)}
                          >
                            <CheckCircle className="h-3 w-3" />
                            Mark Complete
                          </Button>
                        </>
                      )}
                      {past && (
                        <>
                          <Link href={`/dashboard/interviews/${iv.id}`}>
                            <Button variant="outline" size="xs">
                              <FileText className="h-3 w-3" />
                              View Brief
                            </Button>
                          </Link>
                          {!debrief ? (
                            <Button
                              size="xs"
                              onClick={() => {
                                setDebriefEditId(iv.id);
                                setDebriefText("");
                              }}
                            >
                              <StickyNote className="h-3 w-3" />
                              Add Debrief
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => {
                                setDebriefEditId(iv.id);
                                setDebriefText(debrief.notes);
                              }}
                            >
                              <StickyNote className="h-3 w-3" />
                              Edit Debrief
                            </Button>
                          )}
                          {!debrief && (
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => setCompletingId(iv.id)}
                            >
                              <CheckCircle className="h-3 w-3" />
                              Set Outcome
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
