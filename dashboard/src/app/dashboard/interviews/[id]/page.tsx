"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Video,
  Phone,
  MessageSquare,
  CheckCircle,
  BookOpen,
  AlertTriangle,
  Loader2,
  Sparkles,
  Plus,
  Trash2,
  Target,
  HelpCircle,
  Lightbulb,
  ClipboardList,
  Star,
} from "lucide-react";

type PrepBrief = {
  companyOverview: string;
  roleInsights: string;
  talkingPoints: string[];
  predictedQuestions: {
    question: string;
    suggestedApproach: string;
    relevantStoryIndex: number | null;
  }[];
  companySpecificNotes: string[];
  questionsToAsk: string[];
  prepChecklist: string[];
};

type StarStory = {
  id: string;
  situation: string | null;
  task: string | null;
  action: string | null;
  result: string | null;
  skillsDemonstrated: string[] | null;
  rolesApplicable: string[] | null;
  createdAt: string | null;
};

const locationIcons: Record<string, typeof Video> = {
  video: Video,
  in_person: MapPin,
  phone: Phone,
};

function formatDate(d: Date | string | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function InterviewPrepPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [interview, setInterview] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);

  // Prep brief state
  const [prepBrief, setPrepBrief] = useState<PrepBrief | null>(null);
  const [generatingPrep, setGeneratingPrep] = useState(false);
  const [prepError, setPrepError] = useState<string | null>(null);

  // STAR stories state
  const [stories, setStories] = useState<StarStory[]>([]);
  const [loadingStories, setLoadingStories] = useState(true);
  const [showAddStory, setShowAddStory] = useState(false);
  const [newStory, setNewStory] = useState({
    situation: "",
    task: "",
    action: "",
    result: "",
    skillsDemonstrated: "",
    rolesApplicable: "",
  });
  const [savingStory, setSavingStory] = useState(false);

  // Load interview
  useEffect(() => {
    fetch(`/api/data?type=interviews`)
      .then((r) => r.json())
      .then((d) => {
        const interviews = d.data || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const found = interviews.find((iv: any) => iv.id === id);
        if (found) {
          setInterview({
            ...found,
            companyName: found.companyName ?? found.company_name,
            roleTitle: found.roleTitle ?? found.role_title,
            interviewFormat: found.interviewFormat ?? found.interview_format,
            interviewDate: found.interviewDate ?? found.interview_date,
            interviewStartTime: found.interviewStartTime ?? found.interview_start_time,
            locationType: found.locationType ?? found.location_type,
            videoLink: found.videoLink ?? found.video_link,
            physicalAddress: found.physicalAddress ?? found.physical_address,
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  // Load STAR stories
  useEffect(() => {
    fetch("/api/stories")
      .then((r) => r.json())
      .then((d) => {
        setStories(d.stories || []);
        setLoadingStories(false);
      })
      .catch(() => setLoadingStories(false));
  }, []);

  async function generatePrepBrief() {
    setGeneratingPrep(true);
    setPrepError(null);
    try {
      const res = await fetch("/api/prep/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate prep brief");
      setPrepBrief(data.prepBrief);
    } catch (err) {
      setPrepError(err instanceof Error ? err.message : "Something went wrong");
    }
    setGeneratingPrep(false);
  }

  async function addStory() {
    if (!newStory.situation.trim() || !newStory.task.trim() || !newStory.action.trim() || !newStory.result.trim()) return;
    setSavingStory(true);
    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          situation: newStory.situation.trim(),
          task: newStory.task.trim(),
          action: newStory.action.trim(),
          result: newStory.result.trim(),
          skillsDemonstrated: newStory.skillsDemonstrated
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          rolesApplicable: newStory.rolesApplicable
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json();
      if (data.story) {
        setStories((prev) => [data.story, ...prev]);
        setNewStory({ situation: "", task: "", action: "", result: "", skillsDemonstrated: "", rolesApplicable: "" });
        setShowAddStory(false);
      }
    } catch {
      console.error("Failed to add story");
    }
    setSavingStory(false);
  }

  async function deleteStory(storyId: string) {
    try {
      await fetch(`/api/stories?id=${storyId}`, { method: "DELETE" });
      setStories((prev) => prev.filter((s) => s.id !== storyId));
    } catch {
      console.error("Failed to delete story");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/interviews")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Interviews
        </Button>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/interviews")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Interviews
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">Interview not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const LocationIcon = locationIcons[(interview.locationType as string) ?? "video"] ?? Video;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/interviews")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Interviews
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{interview.companyName as string}</h1>
          <p className="text-muted-foreground">{interview.roleTitle as string}</p>
        </div>
        <div className="flex items-center gap-2">
          {interview.locationType === "video" && interview.videoLink && (
            <a href={interview.videoLink as string} target="_blank" rel="noreferrer">
              <Button>
                <Video className="h-4 w-4 mr-1" /> Join Call
              </Button>
            </a>
          )}
          <Button
            variant={completed ? "secondary" : "outline"}
            onClick={() => setCompleted(!completed)}
          >
            <CheckCircle className={`h-4 w-4 mr-1 ${completed ? "text-emerald-500" : ""}`} />
            {completed ? "Completed" : "Mark Complete"}
          </Button>
        </div>
      </div>

      {/* Interview Details */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-amber-500 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Date</p>
              <p className="text-sm font-medium">{formatDate(interview.interviewDate as string)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Time</p>
              <p className="text-sm font-medium">{interview.interviewStartTime as string}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <LocationIcon className="h-4 w-4 text-cyan-500 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Location</p>
              <p className="text-sm font-medium capitalize">{(interview.locationType as string)?.replace("_", " ")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-emerald-500 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Format</p>
              <p className="text-sm font-medium capitalize">{(interview.interviewFormat as string)?.replace("_", " ")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Prep Brief and STAR Stories */}
      <Tabs defaultValue={0}>
        <TabsList>
          <TabsTrigger value={0}>
            <BookOpen className="h-3.5 w-3.5" />
            Prep Brief
          </TabsTrigger>
          <TabsTrigger value={1}>
            <Star className="h-3.5 w-3.5" />
            STAR Stories ({stories.length})
          </TabsTrigger>
        </TabsList>

        {/* Prep Brief Tab */}
        <TabsContent value={0}>
          <div className="space-y-4 mt-4">
            {!prepBrief && (
              <Card>
                <CardContent className="py-8 text-center">
                  <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground font-medium mb-2">No prep brief generated yet</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Generate an AI-powered interview prep brief with company overview, predicted questions, and talking points
                  </p>
                  <Button onClick={generatePrepBrief} disabled={generatingPrep}>
                    {generatingPrep ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating prep brief...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate Prep Brief
                      </>
                    )}
                  </Button>
                  {prepError && (
                    <p className="text-xs text-red-500 mt-3">{prepError}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {prepBrief && (
              <>
                {/* Company Overview */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Company Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{prepBrief.companyOverview}</p>
                  </CardContent>
                </Card>

                {/* Role Insights */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Lightbulb className="h-4 w-4" />
                      Role Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{prepBrief.roleInsights}</p>
                  </CardContent>
                </Card>

                {/* Talking Points */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Key Talking Points
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {prepBrief.talkingPoints.map((point, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-primary font-medium shrink-0">{i + 1}.</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Predicted Questions */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <HelpCircle className="h-4 w-4" />
                      Predicted Questions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {prepBrief.predictedQuestions.map((pq, i) => (
                      <div key={i} className="rounded-md border border-border p-3 space-y-2">
                        <p className="text-sm font-medium">{pq.question}</p>
                        <p className="text-xs text-muted-foreground">{pq.suggestedApproach}</p>
                        {pq.relevantStoryIndex !== null && pq.relevantStoryIndex !== undefined && stories[pq.relevantStoryIndex] && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <Star className="h-3 w-3 text-amber-500" />
                            <span className="text-[10px] text-amber-600 dark:text-amber-400">
                              Use STAR Story: &quot;{stories[pq.relevantStoryIndex]?.situation?.slice(0, 60)}...&quot;
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Company-Specific Notes */}
                {prepBrief.companySpecificNotes.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <ClipboardList className="h-4 w-4" />
                        Company-Specific Notes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1.5">
                        {prepBrief.companySpecificNotes.map((note, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-muted-foreground shrink-0">-</span>
                            <span>{note}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Questions to Ask */}
                {prepBrief.questionsToAsk.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <HelpCircle className="h-4 w-4" />
                        Questions to Ask Them
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1.5">
                        {prepBrief.questionsToAsk.map((q, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-primary font-medium shrink-0">{i + 1}.</span>
                            <span>{q}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Prep Checklist */}
                {prepBrief.prepChecklist.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <ClipboardList className="h-4 w-4" />
                        Prep Checklist
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1.5">
                        {prepBrief.prepChecklist.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <input type="checkbox" className="mt-0.5 rounded" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Regenerate */}
                <div className="flex justify-center pt-2">
                  <Button variant="outline" onClick={generatePrepBrief} disabled={generatingPrep}>
                    {generatingPrep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Regenerate Prep Brief
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* STAR Stories Tab */}
        <TabsContent value={1}>
          <div className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Your STAR story bank for interview answers
              </p>
              <Button size="sm" onClick={() => setShowAddStory(!showAddStory)}>
                {showAddStory ? "Cancel" : <><Plus className="h-3.5 w-3.5" /> Add Story</>}
              </Button>
            </div>

            {/* Add Story Form */}
            {showAddStory && (
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Situation</label>
                    <Textarea
                      value={newStory.situation}
                      onChange={(e) => setNewStory({ ...newStory, situation: e.target.value })}
                      placeholder="Describe the context and background..."
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Task</label>
                    <Textarea
                      value={newStory.task}
                      onChange={(e) => setNewStory({ ...newStory, task: e.target.value })}
                      placeholder="What was your responsibility or challenge?"
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Action</label>
                    <Textarea
                      value={newStory.action}
                      onChange={(e) => setNewStory({ ...newStory, action: e.target.value })}
                      placeholder="What specific steps did you take?"
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Result</label>
                    <Textarea
                      value={newStory.result}
                      onChange={(e) => setNewStory({ ...newStory, result: e.target.value })}
                      placeholder="What was the outcome? Include metrics if possible."
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Skills Demonstrated (comma-separated)</label>
                    <Input
                      value={newStory.skillsDemonstrated}
                      onChange={(e) => setNewStory({ ...newStory, skillsDemonstrated: e.target.value })}
                      placeholder="leadership, problem-solving, communication"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Applicable Roles (comma-separated)</label>
                    <Input
                      value={newStory.rolesApplicable}
                      onChange={(e) => setNewStory({ ...newStory, rolesApplicable: e.target.value })}
                      placeholder="Project Manager, Team Lead, Product Owner"
                      className="mt-1"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={addStory}
                    disabled={savingStory || !newStory.situation.trim() || !newStory.task.trim() || !newStory.action.trim() || !newStory.result.trim()}
                  >
                    {savingStory ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Save Story
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Stories List */}
            {loadingStories ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">Loading stories...</p>
                </CardContent>
              </Card>
            ) : stories.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Star className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground font-medium">No STAR stories yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add stories from your experience to use in interview answers
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {stories.map((story) => (
                  <Card key={story.id}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {story.skillsDemonstrated && story.skillsDemonstrated.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {story.skillsDemonstrated.map((skill) => (
                                <Badge key={skill} variant="secondary" className="text-[10px]">{skill}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500 shrink-0"
                          onClick={() => deleteStory(story.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-[10px] uppercase text-muted-foreground font-medium mb-0.5">Situation</p>
                          <p className="text-xs">{story.situation}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-muted-foreground font-medium mb-0.5">Task</p>
                          <p className="text-xs">{story.task}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-muted-foreground font-medium mb-0.5">Action</p>
                          <p className="text-xs">{story.action}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-muted-foreground font-medium mb-0.5">Result</p>
                          <p className="text-xs">{story.result}</p>
                        </div>
                      </div>

                      {story.rolesApplicable && story.rolesApplicable.length > 0 && (
                        <div className="border-t pt-2">
                          <p className="text-[10px] text-muted-foreground">
                            Applicable to: {story.rolesApplicable.join(", ")}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
