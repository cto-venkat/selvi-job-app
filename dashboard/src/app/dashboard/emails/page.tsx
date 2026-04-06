"use client";

import { useState, useEffect, useCallback } from "react";
import { useData } from "@/lib/use-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Mail,
  Calendar,
  MapPin,
  ExternalLink,
  Archive,
  StickyNote,
  ThumbsUp,
  ThumbsDown,
  Link2,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Send,
  Loader2,
  Copy,
} from "lucide-react";

type EmailCategory =
  | "interview_invitation"
  | "recruiter_outreach"
  | "acknowledgement"
  | "rejection"
  | "job_alert";

type FilterTab =
  | "all"
  | "needs_action"
  | "interview_invitation"
  | "recruiter_outreach"
  | "job_alert";

type EmailAction = "reply" | "confirm-interview" | "decline" | "draft";

const categoryConfig: Record<
  EmailCategory,
  { label: string; accent: string; badgeClass: string }
> = {
  interview_invitation: {
    label: "Interview Invitation",
    accent: "border-l-red-500",
    badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  recruiter_outreach: {
    label: "Recruiter Outreach",
    accent: "border-l-amber-500",
    badgeClass:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  acknowledgement: {
    label: "Acknowledgement",
    accent: "border-l-emerald-500",
    badgeClass:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  rejection: {
    label: "Rejection",
    accent: "border-l-zinc-400 dark:border-l-zinc-600",
    badgeClass:
      "bg-zinc-100 text-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-400",
  },
  job_alert: {
    label: "Job Alert",
    accent: "border-l-blue-500",
    badgeClass:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
};

const filterTabs: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "needs_action", label: "Needs Action" },
  { key: "interview_invitation", label: "Interview" },
  { key: "recruiter_outreach", label: "Recruiter" },
  { key: "job_alert", label: "Alerts" },
];

function formatDate(d: Date | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EmailsPage() {
  const { data: liveEmails, loading } = useData<Record<string, unknown>>("emails");
  const [emailStates, setEmailStates] = useState<
    Record<
      string,
      {
        reviewed: boolean;
        archived: boolean;
        declined: boolean;
        interested: boolean | null;
        note: string;
        linkedApp: string | null;
      }
    >
  >({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteEditingId, setNoteEditingId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [toast, setToast] = useState<string | null>(null);

  // Draft dialog state
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const [draftEmailId, setDraftEmailId] = useState<string | null>(null);
  const [draftAction, setDraftAction] = useState<EmailAction | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);

  // Initialize email states when data loads
  useEffect(() => {
    if (liveEmails.length > 0) {
      setEmailStates((prev) => {
        const next = { ...prev };
        liveEmails.forEach((e: Record<string, unknown>) => {
          const id = e.id as string;
          if (!next[id]) {
            next[id] = {
              reviewed: false,
              archived: false,
              declined: false,
              interested: null,
              note: "",
              linkedApp: null,
            };
          }
        });
        return next;
      });
    }
  }, [liveEmails]);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

  const emails = liveEmails.map((e: Record<string, unknown>) => ({
    ...e,
    fromName: (e.fromName ?? e.from_name) as string | null,
    date: e.date ? new Date(e.date as string) : null,
    isUrgent: (e.isUrgent ?? e.is_urgent) as boolean | undefined,
    id: e.id as string,
    subject: e.subject as string,
    status: e.status as string,
    classification: e.classification as string,
  }));
  const unreadCount = emails.filter(
    (e: { status: string }) => e.status === "unread"
  ).length;

  const needsAction = (e: (typeof emails)[0]) => {
    const cls = e.classification as EmailCategory;
    return (
      cls === "interview_invitation" ||
      cls === "recruiter_outreach" ||
      e.status === "unread"
    );
  };

  const filteredEmails = emails.filter((e: (typeof emails)[0]) => {
    const state = emailStates[e.id];
    if (state?.archived) return false;
    if (activeFilter === "all") return true;
    if (activeFilter === "needs_action") return needsAction(e);
    return e.classification === activeFilter;
  });

  function toggleReviewed(id: string) {
    setEmailStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], reviewed: !prev[id].reviewed },
    }));
  }

  function handleArchive(id: string) {
    setEmailStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], archived: true },
    }));
    showToast("Email archived.");
  }

  function handleSaveNote(id: string) {
    setEmailStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], note: noteText },
    }));
    setNoteEditingId(null);
    setNoteText("");
  }

  function handleLinkApp(emailId: string, appId: string) {
    setEmailStates((prev) => ({
      ...prev,
      [emailId]: { ...prev[emailId], linkedApp: appId },
    }));
    setLinkingId(null);
  }

  // --- Email action API integration ---

  const generateDraft = useCallback(
    async (emailId: string, action: EmailAction, message?: string) => {
      setDraftEmailId(emailId);
      setDraftAction(action);
      setDraftContent("");
      setDraftLoading(true);
      setDraftDialogOpen(true);

      try {
        const resp = await fetch("/api/email-actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            emailId,
            customMessage: message,
          }),
        });

        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error || "Failed to generate draft");
        }

        const data = await resp.json();
        setDraftContent(data.draft);
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "Failed to generate draft";
        showToast(msg);
        setDraftDialogOpen(false);
      } finally {
        setDraftLoading(false);
      }
    },
    []
  );

  async function handleSendReply() {
    if (!draftEmailId || !draftContent) return;

    setSendLoading(true);
    try {
      const resp = await fetch("/api/email-actions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailId: draftEmailId,
          replyContent: draftContent,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Failed to send reply");
      }

      // Mark as reviewed
      setEmailStates((prev) => ({
        ...prev,
        [draftEmailId]: {
          ...prev[draftEmailId],
          reviewed: true,
          ...(draftAction === "decline" ? { declined: true } : {}),
          ...(draftAction === "confirm-interview"
            ? { interested: true }
            : {}),
        },
      }));

      setDraftDialogOpen(false);
      setDraftContent("");
      setDraftEmailId(null);
      setDraftAction(null);
      showToast("Reply sent successfully.");
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to send reply";
      showToast(msg);
    } finally {
      setSendLoading(false);
    }
  }

  function handleConfirmCalendar(id: string) {
    generateDraft(id, "confirm-interview");
  }

  function handleDecline(id: string) {
    generateDraft(id, "decline");
  }

  function handleInterested(id: string) {
    setEmailStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], reviewed: true, interested: true },
    }));
    generateDraft(id, "reply", "I'm interested in this role and would like to discuss further.");
  }

  function handleNotInterested(id: string) {
    setEmailStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], reviewed: true, interested: false },
    }));
    showToast("Marked as not interested.");
  }

  function handleReplyDraft(id: string) {
    setShowCustomPrompt(true);
    setDraftEmailId(id);
    setCustomMessage("");
  }

  function submitCustomReply() {
    if (!draftEmailId) return;
    setShowCustomPrompt(false);
    generateDraft(
      draftEmailId,
      "reply",
      customMessage || undefined
    );
    setCustomMessage("");
  }

  const needsActionCount = emails.filter(
    (e: (typeof emails)[0]) => needsAction(e) && !emailStates[e.id]?.archived
  ).length;

  const draftEmail = draftEmailId
    ? emails.find((e: (typeof emails)[0]) => e.id === draftEmailId)
    : null;

  const actionLabel: Record<EmailAction, string> = {
    "confirm-interview": "Confirm Interview",
    decline: "Decline",
    reply: "Reply",
    draft: "Draft",
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Emails</h1>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Emails</h1>
          <p className="text-sm text-muted-foreground">
            {filteredEmails.length} emails
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-2 text-[10px]">
                {unreadCount} unread
              </Badge>
            )}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeFilter === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.key === "needs_action" && needsActionCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px]">
                {needsActionCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Email List */}
      <div className="space-y-2">
        {filteredEmails.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground font-medium">
                No emails match this filter
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredEmails.map((email: (typeof emails)[0]) => {
            const cat =
              categoryConfig[
                (email.classification as EmailCategory) ?? "acknowledgement"
              ];
            const state = emailStates[email.id];
            // details will be populated when email parsing adds structured data
            const details = null as {
              interviewDate?: string;
              interviewTime?: string;
              interviewLocation?: string;
              interviewFormat?: string;
              roleTitle?: string;
              company?: string;
              recruiterNote?: string;
              jobLinks?: { url: string; title: string }[];
            } | null;
            const isExpanded = expandedId === email.id;

            return (
              <div
                key={email.id}
                className={`rounded-md border border-l-4 ${cat.accent} p-3 space-y-2 transition-colors ${
                  state?.reviewed ? "bg-muted/30" : ""
                }`}
              >
                {/* Header row */}
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleReviewed(email.id)}
                    className={`mt-0.5 shrink-0 h-4 w-4 rounded border transition-colors ${
                      state?.reviewed
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-input hover:border-primary"
                    } flex items-center justify-center`}
                  >
                    {state?.reviewed && <CheckCircle className="h-3 w-3" />}
                  </button>
                  <Mail className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p
                        className={`text-sm font-medium ${
                          email.status === "unread"
                            ? "text-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {email.subject}
                      </p>
                      {email.status === "unread" && (
                        <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                      )}
                      {email.isUrgent && (
                        <Badge
                          variant="destructive"
                          className="text-[10px] px-1.5 py-0"
                        >
                          Urgent
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {email.fromName}
                      </span>
                      <span className="text-xs text-muted-foreground/50">
                        &middot;
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(email.date)}
                      </span>
                      {state?.linkedApp && (
                        <>
                          <span className="text-xs text-muted-foreground/50">
                            &middot;
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            <Link2 className="h-2.5 w-2.5 mr-0.5" />
                            {"Linked"}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {state?.declined && (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                      >
                        Declined
                      </Badge>
                    )}
                    {state?.interested === true && (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      >
                        Interested
                      </Badge>
                    )}
                    {state?.interested === false && (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-zinc-100 text-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-400"
                      >
                        Not Interested
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${cat.badgeClass}`}
                    >
                      {cat.label}
                    </Badge>
                    {details && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : email.id)
                        }
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && details && (
                  <div className="ml-11 space-y-3 border-t pt-2">
                    {details.interviewDate && (
                      <div className="grid gap-2 sm:grid-cols-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">
                            {details.interviewDate as string}
                          </span>
                          <span className="text-muted-foreground">
                            at {details.interviewTime as string}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span>{details.interviewLocation as string}</span>
                        </div>
                        {details.interviewFormat && (
                          <div className="flex items-center gap-1.5">
                            <FileText className="h-3 w-3 text-muted-foreground" />
                            <span>
                              Format: {details.interviewFormat as string}
                            </span>
                          </div>
                        )}
                        {details.roleTitle && (
                          <div className="text-muted-foreground">
                            {details.roleTitle as string} at{" "}
                            {details.company as string}
                          </div>
                        )}
                      </div>
                    )}

                    {details.recruiterNote && (
                      <div className="text-xs bg-muted/50 rounded p-2">
                        <p className="text-muted-foreground">
                          {details.recruiterNote as string}
                        </p>
                        {details.roleTitle && (
                          <p className="mt-1 font-medium">
                            {details.roleTitle as string} at{" "}
                            {details.company as string}
                          </p>
                        )}
                      </div>
                    )}

                    {details.jobLinks && (
                      <div className="space-y-1">
                        {(
                          details.jobLinks as { url: string; title: string }[]
                        ).map((link, i: number) => (
                          <a
                            key={i}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {link.title}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 flex-wrap ml-11">
                  {/* Interview-specific actions */}
                  {email.classification === "interview_invitation" && (
                    <>
                      <Button
                        size="xs"
                        onClick={() => handleConfirmCalendar(email.id)}
                      >
                        <Calendar className="h-3 w-3" />
                        Confirm & Reply
                      </Button>
                      <Button
                        variant="destructive"
                        size="xs"
                        onClick={() => handleDecline(email.id)}
                      >
                        Decline
                      </Button>
                      {!isExpanded && details && (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setExpandedId(email.id)}
                        >
                          View Details
                        </Button>
                      )}
                    </>
                  )}

                  {/* Recruiter-specific actions */}
                  {email.classification === "recruiter_outreach" && (
                    <>
                      <Button
                        size="xs"
                        onClick={() => handleInterested(email.id)}
                      >
                        <ThumbsUp className="h-3 w-3" />
                        Interested
                      </Button>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => handleNotInterested(email.id)}
                      >
                        <ThumbsDown className="h-3 w-3" />
                        Not Interested
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleReplyDraft(email.id)}
                      >
                        <Send className="h-3 w-3" />
                        Reply
                      </Button>
                    </>
                  )}

                  {/* Acknowledgement-specific actions */}
                  {email.classification === "acknowledgement" && (
                    <>
                      {linkingId === email.id ? (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-xs text-muted-foreground">
                            Link to:
                          </span>
                          <span className="text-xs text-muted-foreground">
                            No applications loaded
                          </span>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => setLinkingId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => setLinkingId(email.id)}
                        >
                          <Link2 className="h-3 w-3" />
                          Link to Application
                        </Button>
                      )}
                    </>
                  )}

                  {/* Rejection-specific actions */}
                  {email.classification === "rejection" && (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => handleArchive(email.id)}
                    >
                      <Archive className="h-3 w-3" />
                      Archive
                    </Button>
                  )}

                  {/* Job alert actions */}
                  {email.classification === "job_alert" &&
                    !isExpanded &&
                    details?.jobLinks && (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => setExpandedId(email.id)}
                      >
                        <ExternalLink className="h-3 w-3" />
                        View Jobs (
                        {
                          (details.jobLinks as { url: string; title: string }[])
                            .length
                        }
                        )
                      </Button>
                    )}

                  {/* Common actions for all */}
                  {noteEditingId === email.id ? (
                    <div className="flex items-center gap-1 w-full mt-1">
                      <Textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Add a note..."
                        rows={2}
                        className="text-xs flex-1"
                      />
                      <div className="flex flex-col gap-1">
                        <Button
                          size="xs"
                          onClick={() => handleSaveNote(email.id)}
                        >
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => {
                            setNoteEditingId(null);
                            setNoteText("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        setNoteEditingId(email.id);
                        setNoteText(state?.note ?? "");
                      }}
                    >
                      <StickyNote className="h-3 w-3" />
                      {state?.note ? "Edit Note" : "Note"}
                    </Button>
                  )}
                </div>

                {/* Saved note display */}
                {state?.note && noteEditingId !== email.id && (
                  <div className="ml-11 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                    <StickyNote className="h-3 w-3 inline mr-1" />
                    {state.note}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Custom reply prompt dialog */}
      <Dialog
        open={showCustomPrompt}
        onOpenChange={(open) => {
          if (!open) {
            setShowCustomPrompt(false);
            setCustomMessage("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Write Reply</DialogTitle>
            <DialogDescription>
              Describe what you want to say, and AI will draft a professional
              reply.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="e.g. Thank them and ask about the role requirements..."
            rows={3}
            className="text-sm"
          />
          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" size="sm" />}
            >
              Cancel
            </DialogClose>
            <Button size="sm" onClick={submitCustomReply}>
              <Send className="h-3 w-3" />
              Generate Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Draft review dialog */}
      <Dialog
        open={draftDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDraftDialogOpen(false);
            setDraftContent("");
            setDraftEmailId(null);
            setDraftAction(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {draftAction ? actionLabel[draftAction] : "Reply"} Draft
            </DialogTitle>
            {draftEmail && (
              <DialogDescription>
                Replying to: {draftEmail.subject}
              </DialogDescription>
            )}
          </DialogHeader>

          {draftLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating draft...
            </div>
          ) : (
            <div className="space-y-3">
              <Textarea
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                rows={8}
                className="text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Edit the draft above before sending. The reply will be sent via
                your connected email.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              disabled={!draftContent || draftLoading}
              onClick={() => {
                navigator.clipboard.writeText(draftContent);
                showToast("Copied to clipboard.");
              }}
            >
              <Copy className="h-3 w-3" />
              Copy
            </Button>
            <DialogClose
              render={<Button variant="outline" size="sm" />}
            >
              Discard
            </DialogClose>
            <Button
              size="sm"
              disabled={!draftContent || sendLoading || draftLoading}
              onClick={handleSendReply}
            >
              {sendLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              Send Reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 bg-foreground text-background px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}
    </div>
  );
}
