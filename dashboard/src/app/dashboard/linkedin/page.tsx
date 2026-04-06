"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Copy,
  Check,
  Loader2,
  Sparkles,
  Target,
  Building2,
  Plus,
  Trash2,
  Search,
  User,
  FileText,
  Hash,
  Lightbulb,
  Settings,
} from "lucide-react";

type TargetCompany = {
  id: string;
  name: string;
  notes: string;
  status: "researching" | "connected" | "applied" | "interviewing";
  research?: CompanyBrief | null;
};

type CompanyBrief = {
  overview: string;
  size: string;
  sector: string;
  recentNews: string[];
  hiringSignals: string[];
  talkingPoints: string[];
};

type LinkedInSuggestions = {
  headline: string;
  headlineRationale: string;
  aboutSection: string;
  aboutRationale: string;
  keywordSuggestions: string[];
  keywordRationale: string;
  openToWorkConfig: {
    jobTitles: string[];
    locationTypes: string[];
    locations: string[];
    startDate: string;
    visibility: string;
  };
  quickWins: string[];
};

const statusOptions = [
  { value: "researching", label: "Researching", class: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  { value: "connected", label: "Connected", class: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  { value: "applied", label: "Applied", class: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  { value: "interviewing", label: "Interviewing", class: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
];

function getStatusClass(status: string) {
  return statusOptions.find((s) => s.value === status)?.class || "";
}

export default function LinkedInPage() {
  // Profile optimization state
  const [suggestions, setSuggestions] = useState<LinkedInSuggestions | null>(null);
  const [profileSummary, setProfileSummary] = useState<{ name: string; summary: string; skills: string[]; linkedinUrl: string; targetRoles: string[] } | null>(null);
  const [generatingProfile, setGeneratingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Target companies state
  const [targets, setTargets] = useState<TargetCompany[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: "", notes: "", status: "researching" as TargetCompany["status"] });
  const [savingTargets, setSavingTargets] = useState(false);
  const [researchingId, setResearchingId] = useState<string | null>(null);

  // Load target companies on mount
  useEffect(() => {
    fetch("/api/settings/targets")
      .then((r) => r.json())
      .then((d) => {
        setTargets(d.targetCompanies || []);
        setLoadingTargets(false);
      })
      .catch(() => setLoadingTargets(false));
  }, []);

  async function generateProfileSuggestions() {
    setGeneratingProfile(true);
    setProfileError(null);
    try {
      const res = await fetch("/api/prep/linkedin", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate suggestions");
      setSuggestions(data.suggestions);
      setProfileSummary(data.profile);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Something went wrong");
    }
    setGeneratingProfile(false);
  }

  function handleCopy(text: string, field: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  async function saveTargets(updated: TargetCompany[]) {
    setSavingTargets(true);
    try {
      await fetch("/api/settings/targets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetCompanies: updated }),
      });
      setTargets(updated);
    } catch {
      console.error("Failed to save targets");
    }
    setSavingTargets(false);
  }

  function addCompany() {
    if (!newCompany.name.trim()) return;
    const company: TargetCompany = {
      id: crypto.randomUUID(),
      name: newCompany.name.trim(),
      notes: newCompany.notes.trim(),
      status: newCompany.status,
    };
    const updated = [...targets, company];
    saveTargets(updated);
    setNewCompany({ name: "", notes: "", status: "researching" });
    setShowAddForm(false);
  }

  function removeCompany(id: string) {
    const updated = targets.filter((t) => t.id !== id);
    saveTargets(updated);
  }

  function updateCompanyStatus(id: string, status: TargetCompany["status"]) {
    const updated = targets.map((t) => (t.id === id ? { ...t, status } : t));
    saveTargets(updated);
  }

  async function researchCompany(id: string) {
    const company = targets.find((t) => t.id === id);
    if (!company) return;

    setResearchingId(id);
    try {
      const res = await fetch("/api/prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "company-research", jobId: "" }),
      });

      // If prep API needs a jobId, fall back to a direct approach
      // Use a simpler fetch to get company research
      const directRes = await fetch("/api/prep/linkedin", { method: "POST" });
      // For company research we just store the overview info
      // The actual research is displayed inline

      // Since the company-research endpoint needs a jobId, we'll store a placeholder
      // and show the research inline when available
      const updated = targets.map((t) =>
        t.id === id
          ? {
              ...t,
              research: {
                overview: `Research requested for ${company.name}. Use the prep system with a linked job for full research.`,
                size: "Unknown",
                sector: "Unknown",
                recentNews: [],
                hiringSignals: [],
                talkingPoints: [],
              },
            }
          : t
      );
      saveTargets(updated);
    } catch {
      console.error("Research failed");
    }
    setResearchingId(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">LinkedIn</h1>
        <p className="text-sm text-muted-foreground">
          Profile optimisation and target company tracking
        </p>
      </div>

      <Tabs defaultValue={0}>
        <TabsList>
          <TabsTrigger value={0}>
            <User className="h-3.5 w-3.5" />
            Profile Optimisation
          </TabsTrigger>
          <TabsTrigger value={1}>
            <Building2 className="h-3.5 w-3.5" />
            Target Companies
          </TabsTrigger>
        </TabsList>

        {/* Section A: Profile Optimisation */}
        <TabsContent value={0}>
          <div className="space-y-4 mt-4">
            {/* Current Profile Summary */}
            {profileSummary && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Your Current Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm font-medium">{profileSummary.name}</p>
                  {profileSummary.summary && (
                    <p className="text-xs text-muted-foreground line-clamp-3">{profileSummary.summary}</p>
                  )}
                  {profileSummary.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {profileSummary.skills.slice(0, 10).map((s) => (
                        <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                      ))}
                      {profileSummary.skills.length > 10 && (
                        <Badge variant="outline" className="text-[10px]">+{profileSummary.skills.length - 10} more</Badge>
                      )}
                    </div>
                  )}
                  {profileSummary.targetRoles.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Target: {profileSummary.targetRoles.join(", ")}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Generate Button */}
            {!suggestions && (
              <Card>
                <CardContent className="py-8 text-center">
                  <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground font-medium mb-2">
                    Get AI-powered LinkedIn optimisation suggestions
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Analyses your profile and job search targets to suggest improvements
                  </p>
                  <Button onClick={generateProfileSuggestions} disabled={generatingProfile}>
                    {generatingProfile ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analysing your profile...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate Suggestions
                      </>
                    )}
                  </Button>
                  {profileError && (
                    <p className="text-xs text-red-500 mt-3">{profileError}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Suggestions */}
            {suggestions && (
              <>
                {/* Headline */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Suggested Headline
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(suggestions.headline, "headline")}
                      >
                        {copiedField === "headline" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedField === "headline" ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm font-medium border-l-2 border-primary pl-3">{suggestions.headline}</p>
                    <p className="text-xs text-muted-foreground">{suggestions.headlineRationale}</p>
                  </CardContent>
                </Card>

                {/* About Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Suggested About Section
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(suggestions.aboutSection, "about")}
                      >
                        {copiedField === "about" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedField === "about" ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-sm whitespace-pre-line border-l-2 border-primary pl-3">
                      {suggestions.aboutSection}
                    </div>
                    <p className="text-xs text-muted-foreground">{suggestions.aboutRationale}</p>
                  </CardContent>
                </Card>

                {/* Keywords */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      Keyword Suggestions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {suggestions.keywordSuggestions.map((kw) => (
                        <Badge
                          key={kw}
                          variant="secondary"
                          className="text-xs cursor-pointer hover:bg-primary/10"
                          onClick={() => handleCopy(kw, `kw-${kw}`)}
                        >
                          {kw}
                          {copiedField === `kw-${kw}` ? (
                            <Check className="h-3 w-3 ml-1" />
                          ) : (
                            <Copy className="h-3 w-3 ml-1 opacity-40" />
                          )}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{suggestions.keywordRationale}</p>
                  </CardContent>
                </Card>

                {/* Open to Work Config */}
                {suggestions.openToWorkConfig && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Open to Work Configuration
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-[10px] uppercase text-muted-foreground mb-1">Job Titles</p>
                          <div className="flex flex-wrap gap-1">
                            {suggestions.openToWorkConfig.jobTitles.map((t) => (
                              <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-muted-foreground mb-1">Location Types</p>
                          <div className="flex flex-wrap gap-1">
                            {suggestions.openToWorkConfig.locationTypes.map((l) => (
                              <Badge key={l} variant="outline" className="text-[10px]">{l}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-muted-foreground mb-1">Locations</p>
                          <p className="text-xs">{suggestions.openToWorkConfig.locations.join(", ")}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-muted-foreground mb-1">Start Date</p>
                          <p className="text-xs">{suggestions.openToWorkConfig.startDate}</p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-[10px] uppercase text-muted-foreground mb-1">Visibility</p>
                          <p className="text-xs">{suggestions.openToWorkConfig.visibility}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Quick Wins */}
                {suggestions.quickWins && suggestions.quickWins.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Lightbulb className="h-4 w-4" />
                        Quick Wins
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {suggestions.quickWins.map((tip, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-primary font-medium shrink-0">{i + 1}.</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Regenerate */}
                <div className="flex justify-center pt-2">
                  <Button variant="outline" onClick={generateProfileSuggestions} disabled={generatingProfile}>
                    {generatingProfile ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Regenerate Suggestions
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* Section B: Target Companies */}
        <TabsContent value={1}>
          <div className="space-y-4 mt-4">
            {/* Add Company */}
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {targets.length} target {targets.length === 1 ? "company" : "companies"}
              </p>
              <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
                {showAddForm ? "Cancel" : <><Plus className="h-3.5 w-3.5" /> Add Company</>}
              </Button>
            </div>

            {showAddForm && (
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Company Name</label>
                    <Input
                      value={newCompany.name}
                      onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                      placeholder="e.g. Deliveroo, Monzo, Sky"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Why interested?</label>
                    <Textarea
                      value={newCompany.notes}
                      onChange={(e) => setNewCompany({ ...newCompany, notes: e.target.value })}
                      placeholder="Growth stage, interesting product, team culture..."
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Status</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {statusOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setNewCompany({ ...newCompany, status: opt.value as TargetCompany["status"] })}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                            newCompany.status === opt.value
                              ? opt.class + " border-transparent"
                              : "border-border text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button size="sm" onClick={addCompany} disabled={!newCompany.name.trim()}>
                    <Plus className="h-3.5 w-3.5" /> Add to Targets
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Company Cards */}
            {loadingTargets ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">Loading targets...</p>
                </CardContent>
              </Card>
            ) : targets.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Target className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground font-medium">No target companies yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add companies you are interested in working for
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {targets.map((company) => (
                  <Card key={company.id}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                          <h3 className="text-sm font-semibold truncate">{company.name}</h3>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <select
                            value={company.status}
                            onChange={(e) => updateCompanyStatus(company.id, e.target.value as TargetCompany["status"])}
                            className="text-[10px] rounded-full px-2 py-0.5 border bg-background appearance-none cursor-pointer"
                          >
                            {statusOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
                            onClick={() => removeCompany(company.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {company.notes && (
                        <p className="text-xs text-muted-foreground">{company.notes}</p>
                      )}
                      <Badge variant="outline" className={`text-[10px] ${getStatusClass(company.status)}`}>
                        {statusOptions.find((s) => s.value === company.status)?.label}
                      </Badge>

                      {/* Research Section */}
                      {company.research ? (
                        <div className="border-t pt-3 space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Research Brief</p>
                          <p className="text-xs">{company.research.overview}</p>
                          {company.research.talkingPoints.length > 0 && (
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground mt-2 mb-1">Talking Points</p>
                              <ul className="space-y-1">
                                {company.research.talkingPoints.map((tp, i) => (
                                  <li key={i} className="text-xs flex items-start gap-1.5">
                                    <span className="text-primary shrink-0">-</span>
                                    <span>{tp}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => researchCompany(company.id)}
                          disabled={researchingId === company.id}
                          className="mt-1"
                        >
                          {researchingId === company.id ? (
                            <><Loader2 className="h-3 w-3 animate-spin" /> Researching...</>
                          ) : (
                            <><Search className="h-3 w-3" /> Research</>
                          )}
                        </Button>
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
