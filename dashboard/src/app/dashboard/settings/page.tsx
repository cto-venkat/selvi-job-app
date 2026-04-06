"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  User,
  Briefcase,
  SlidersHorizontal,
  Search,
  X,
  Plus,
  Check,
  Loader2,
  Trash2,
} from "lucide-react";

// ─── Types matching the JSONB shape stored in tenants.candidate_profile ───

type WorkExperience = {
  company: string;
  title: string;
  startDate: string;
  endDate: string; // "" means present
  location: string;
  bullets: string[];
  metrics: string[];
};

type Education = {
  institution: string;
  qualification: string;
  startDate: string;
  endDate: string;
  grade: string;
};

type CandidateProfile = {
  name: string;
  email: string;
  phone: string;
  city: string;
  linkedin_url: string;
  github_url: string;
  portfolio_url: string;
  professional_summary: string;
  experience: WorkExperience[];
  education: Education[];
  skills: string[];
  certifications: string[];
  salary_min: number;
  salary_max: number;
  contract_type: string; // permanent | contract | either
  seniority_level: string;
  notice_period: string;
  right_to_work: string;
  willing_to_relocate: boolean;
  visa_sponsorship_needed: boolean;
};

type SearchConfig = {
  keywords: string[];
  locations: string[];
  sources: Record<string, boolean>;
};

const emptyCandidateProfile: CandidateProfile = {
  name: "",
  email: "",
  phone: "",
  city: "",
  linkedin_url: "",
  github_url: "",
  portfolio_url: "",
  professional_summary: "",
  experience: [],
  education: [],
  skills: [],
  certifications: [],
  salary_min: 0,
  salary_max: 0,
  contract_type: "permanent",
  seniority_level: "",
  notice_period: "",
  right_to_work: "British Citizen",
  willing_to_relocate: false,
  visa_sponsorship_needed: false,
};

const emptySearchConfig: SearchConfig = {
  keywords: [],
  locations: [],
  sources: { Adzuna: true, Reed: true },
};

const emptyExperience: WorkExperience = {
  company: "",
  title: "",
  startDate: "",
  endDate: "",
  location: "",
  bullets: [""],
  metrics: [],
};

const emptyEducation: Education = {
  institution: "",
  qualification: "",
  startDate: "",
  endDate: "",
  grade: "",
};

// ─── Toggle switch ───

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        checked ? "bg-cyan-500" : "bg-muted"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

// ─── Main page ───

export default function SettingsPage() {
  const [profile, setProfile] = useState<CandidateProfile>(emptyCandidateProfile);
  const [search, setSearch] = useState<SearchConfig>(emptySearchConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // Tag inputs
  const [newSkill, setNewSkill] = useState("");
  const [newCert, setNewCert] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [newLocation, setNewLocation] = useState("");

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/profile");
      if (!res.ok) return;
      const data = await res.json();
      const cp = data.candidateProfile || {};
      const sc = data.searchConfig || {};

      setProfile({
        ...emptyCandidateProfile,
        name: cp.name || data.tenantName || "",
        email: cp.email || data.tenantEmail || "",
        phone: cp.phone || "",
        city: cp.city || "",
        linkedin_url: cp.linkedin_url || "",
        github_url: cp.github_url || "",
        portfolio_url: cp.portfolio_url || "",
        professional_summary: cp.professional_summary || "",
        experience: cp.experience || [],
        education: cp.education || [],
        skills: cp.skills || [],
        certifications: cp.certifications || [],
        salary_min: cp.salary_min || 0,
        salary_max: cp.salary_max || 0,
        contract_type: cp.contract_type || "permanent",
        seniority_level: cp.seniority_level || "",
        notice_period: cp.notice_period || "",
        right_to_work: cp.right_to_work || "British Citizen",
        willing_to_relocate: cp.willing_to_relocate || false,
        visa_sponsorship_needed: cp.visa_sponsorship_needed || false,
      });

      setSearch({
        keywords: sc.keywords || [],
        locations: sc.locations || [],
        sources: sc.sources || { Adzuna: true, Reed: true },
      });
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  async function saveAll(tab: string) {
    setSaving(tab);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateProfile: profile,
          searchConfig: search,
        }),
      });
      if (res.ok) {
        setSaved(tab);
        setTimeout(() => setSaved(null), 2000);
      }
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(null);
    }
  }

  function SaveButton({ tab }: { tab: string }) {
    const isSaving = saving === tab;
    const isSaved = saved === tab;
    return (
      <Button size="sm" onClick={() => saveAll(tab)} disabled={isSaving}>
        {isSaving ? (
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        ) : isSaved ? (
          <Check className="h-3 w-3 mr-1" />
        ) : null}
        {isSaved ? "Saved" : "Save Changes"}
      </Button>
    );
  }

  // ─── Experience helpers ───

  function updateExperience(idx: number, field: keyof WorkExperience, value: unknown) {
    const updated = [...profile.experience];
    updated[idx] = { ...updated[idx], [field]: value };
    setProfile({ ...profile, experience: updated });
  }

  function addBullet(expIdx: number) {
    const updated = [...profile.experience];
    updated[expIdx] = {
      ...updated[expIdx],
      bullets: [...updated[expIdx].bullets, ""],
    };
    setProfile({ ...profile, experience: updated });
  }

  function updateBullet(expIdx: number, bulletIdx: number, value: string) {
    const updated = [...profile.experience];
    const bullets = [...updated[expIdx].bullets];
    bullets[bulletIdx] = value;
    updated[expIdx] = { ...updated[expIdx], bullets };
    setProfile({ ...profile, experience: updated });
  }

  function removeBullet(expIdx: number, bulletIdx: number) {
    const updated = [...profile.experience];
    updated[expIdx] = {
      ...updated[expIdx],
      bullets: updated[expIdx].bullets.filter((_, i) => i !== bulletIdx),
    };
    setProfile({ ...profile, experience: updated });
  }

  // ─── Education helpers ───

  function updateEducation(idx: number, field: keyof Education, value: string) {
    const updated = [...profile.education];
    updated[idx] = { ...updated[idx], [field]: value };
    setProfile({ ...profile, education: updated });
  }

  // ─── Tag helpers ───

  function addTag(
    field: "skills" | "certifications",
    value: string,
    setter: (v: string) => void
  ) {
    if (!value.trim()) return;
    if (!profile[field].includes(value.trim())) {
      setProfile({ ...profile, [field]: [...profile[field], value.trim()] });
    }
    setter("");
  }

  function removeTag(field: "skills" | "certifications", value: string) {
    setProfile({
      ...profile,
      [field]: profile[field].filter((t) => t !== value),
    });
  }

  function addSearchTag(
    field: "keywords" | "locations",
    value: string,
    setter: (v: string) => void
  ) {
    if (!value.trim()) return;
    if (!search[field].includes(value.trim())) {
      setSearch({ ...search, [field]: [...search[field], value.trim()] });
    }
    setter("");
  }

  function removeSearchTag(field: "keywords" | "locations", value: string) {
    setSearch({
      ...search,
      [field]: search[field].filter((t) => t !== value),
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your profile feeds the CV tailoring and screening answer pipeline.
          Keep it current.
        </p>
      </div>

      <Tabs defaultValue={0}>
        <TabsList>
          <TabsTrigger value={0}>
            <User className="h-3.5 w-3.5" />
            Profile
          </TabsTrigger>
          <TabsTrigger value={1}>
            <Briefcase className="h-3.5 w-3.5" />
            CV / Experience
          </TabsTrigger>
          <TabsTrigger value={2}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value={3}>
            <Search className="h-3.5 w-3.5" />
            Search
          </TabsTrigger>
        </TabsList>

        {/* ════════════════════════ PROFILE TAB ════════════════════════ */}
        <TabsContent value={0}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Personal Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              <Field label="Full Name">
                <Input
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                />
              </Field>
              <Field label="Phone">
                <Input
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="+44 7xxx xxx xxx"
                />
              </Field>
              <Field label="City">
                <Input
                  value={profile.city}
                  onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                  placeholder="London"
                />
              </Field>
              <Field label="LinkedIn URL">
                <Input
                  value={profile.linkedin_url}
                  onChange={(e) =>
                    setProfile({ ...profile, linkedin_url: e.target.value })
                  }
                  placeholder="https://linkedin.com/in/..."
                />
              </Field>
              <Field label="GitHub URL">
                <Input
                  value={profile.github_url}
                  onChange={(e) =>
                    setProfile({ ...profile, github_url: e.target.value })
                  }
                  placeholder="https://github.com/..."
                />
              </Field>
              <Field label="Portfolio URL">
                <Input
                  value={profile.portfolio_url}
                  onChange={(e) =>
                    setProfile({ ...profile, portfolio_url: e.target.value })
                  }
                  placeholder="https://..."
                />
              </Field>
              <SaveButton tab="profile" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════════════ CV / EXPERIENCE TAB ════════════════════════ */}
        <TabsContent value={1}>
          <div className="space-y-6">
            {/* Professional Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Professional Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={profile.professional_summary}
                  onChange={(e) =>
                    setProfile({ ...profile, professional_summary: e.target.value })
                  }
                  placeholder="A concise summary of your professional background, key strengths, and what you bring to a role..."
                  className="min-h-[120px]"
                />
              </CardContent>
            </Card>

            {/* Work Experience */}
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Work Experience
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setProfile({
                      ...profile,
                      experience: [...profile.experience, { ...emptyExperience }],
                    })
                  }
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Role
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                {profile.experience.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No experience entries yet. Add your work history so the CV
                    tailoring pipeline can use it.
                  </p>
                )}
                {profile.experience.map((exp, idx) => (
                  <div
                    key={idx}
                    className="rounded-md border border-border p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        ROLE {idx + 1}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
                        onClick={() =>
                          setProfile({
                            ...profile,
                            experience: profile.experience.filter(
                              (_, i) => i !== idx
                            ),
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Company">
                        <Input
                          value={exp.company}
                          onChange={(e) =>
                            updateExperience(idx, "company", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="Title">
                        <Input
                          value={exp.title}
                          onChange={(e) =>
                            updateExperience(idx, "title", e.target.value)
                          }
                        />
                      </Field>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Start (YYYY-MM)">
                        <Input
                          value={exp.startDate}
                          onChange={(e) =>
                            updateExperience(idx, "startDate", e.target.value)
                          }
                          placeholder="2022-01"
                        />
                      </Field>
                      <Field label="End (or blank = present)">
                        <Input
                          value={exp.endDate}
                          onChange={(e) =>
                            updateExperience(idx, "endDate", e.target.value)
                          }
                          placeholder="2024-06"
                        />
                      </Field>
                      <Field label="Location">
                        <Input
                          value={exp.location}
                          onChange={(e) =>
                            updateExperience(idx, "location", e.target.value)
                          }
                          placeholder="London, UK"
                        />
                      </Field>
                    </div>

                    {/* Bullet points */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-muted-foreground">
                          Key Achievements / Responsibilities
                        </label>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 text-xs"
                          onClick={() => addBullet(idx)}
                        >
                          <Plus className="h-2.5 w-2.5 mr-0.5" />
                          Add
                        </Button>
                      </div>
                      <div className="space-y-1.5">
                        {exp.bullets.map((bullet, bIdx) => (
                          <div key={bIdx} className="flex gap-1.5 items-start">
                            <span className="text-xs text-muted-foreground mt-2.5 shrink-0">
                              {bIdx + 1}.
                            </span>
                            <Textarea
                              value={bullet}
                              onChange={(e) =>
                                updateBullet(idx, bIdx, e.target.value)
                              }
                              className="min-h-[40px] text-sm"
                              placeholder="Led a team of 5 engineers to deliver..."
                            />
                            {exp.bullets.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 mt-1 text-muted-foreground hover:text-red-500 shrink-0"
                                onClick={() => removeBullet(idx, bIdx)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Metrics */}
                    <Field label="Metrics (real numbers only, comma-separated)">
                      <Input
                        value={(exp.metrics || []).join(", ")}
                        onChange={(e) =>
                          updateExperience(
                            idx,
                            "metrics",
                            e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean)
                          )
                        }
                        placeholder="40% reduction in deploy time, 99.9% uptime"
                      />
                    </Field>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Education */}
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Education
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setProfile({
                      ...profile,
                      education: [...profile.education, { ...emptyEducation }],
                    })
                  }
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {profile.education.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No education entries yet.
                  </p>
                )}
                {profile.education.map((edu, idx) => (
                  <div
                    key={idx}
                    className="rounded-md border border-border p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        EDUCATION {idx + 1}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
                        onClick={() =>
                          setProfile({
                            ...profile,
                            education: profile.education.filter(
                              (_, i) => i !== idx
                            ),
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Institution">
                        <Input
                          value={edu.institution}
                          onChange={(e) =>
                            updateEducation(idx, "institution", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="Qualification">
                        <Input
                          value={edu.qualification}
                          onChange={(e) =>
                            updateEducation(idx, "qualification", e.target.value)
                          }
                          placeholder="BSc Computer Science"
                        />
                      </Field>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Start">
                        <Input
                          value={edu.startDate}
                          onChange={(e) =>
                            updateEducation(idx, "startDate", e.target.value)
                          }
                          placeholder="2018"
                        />
                      </Field>
                      <Field label="End">
                        <Input
                          value={edu.endDate}
                          onChange={(e) =>
                            updateEducation(idx, "endDate", e.target.value)
                          }
                          placeholder="2021"
                        />
                      </Field>
                      <Field label="Grade">
                        <Input
                          value={edu.grade}
                          onChange={(e) =>
                            updateEducation(idx, "grade", e.target.value)
                          }
                          placeholder="First Class"
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Skills */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Skills
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {profile.skills.map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-xs gap-1">
                      {skill}
                      <button
                        onClick={() => removeTag("skills", skill)}
                        className="ml-0.5 hover:text-red-500"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2 max-w-md">
                  <Input
                    placeholder="Add skill..."
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && addTag("skills", newSkill, setNewSkill)
                    }
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addTag("skills", newSkill, setNewSkill)}
                    disabled={!newSkill.trim()}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Certifications */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Certifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {profile.certifications.map((cert) => (
                    <Badge key={cert} variant="secondary" className="text-xs gap-1">
                      {cert}
                      <button
                        onClick={() => removeTag("certifications", cert)}
                        className="ml-0.5 hover:text-red-500"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2 max-w-md">
                  <Input
                    placeholder="Add certification..."
                    value={newCert}
                    onChange={(e) => setNewCert(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      addTag("certifications", newCert, setNewCert)
                    }
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addTag("certifications", newCert, setNewCert)}
                    disabled={!newCert.trim()}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <SaveButton tab="cv" />
          </div>
        </TabsContent>

        {/* ════════════════════════ PREFERENCES TAB ════════════════════════ */}
        <TabsContent value={2}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Job Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Target Salary Min (GBP)">
                  <Input
                    type="number"
                    value={profile.salary_min || ""}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        salary_min: Number(e.target.value),
                      })
                    }
                    placeholder="45000"
                  />
                </Field>
                <Field label="Target Salary Max (GBP)">
                  <Input
                    type="number"
                    value={profile.salary_max || ""}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        salary_max: Number(e.target.value),
                      })
                    }
                    placeholder="65000"
                  />
                </Field>
              </div>

              <Field label="Preferred Contract Type">
                <div className="flex gap-2">
                  {["permanent", "contract", "either"].map((ct) => (
                    <Button
                      key={ct}
                      variant={profile.contract_type === ct ? "default" : "outline"}
                      size="sm"
                      onClick={() => setProfile({ ...profile, contract_type: ct })}
                    >
                      {ct.charAt(0).toUpperCase() + ct.slice(1)}
                    </Button>
                  ))}
                </div>
              </Field>

              <Field label="Target Seniority Level">
                <Input
                  value={profile.seniority_level}
                  onChange={(e) =>
                    setProfile({ ...profile, seniority_level: e.target.value })
                  }
                  placeholder="Senior, Lead, Principal..."
                />
              </Field>

              <Field label="Notice Period">
                <Input
                  value={profile.notice_period}
                  onChange={(e) =>
                    setProfile({ ...profile, notice_period: e.target.value })
                  }
                  placeholder="1 month, Immediately available..."
                />
              </Field>

              <Field label="Right to Work Status">
                <Input
                  value={profile.right_to_work}
                  onChange={(e) =>
                    setProfile({ ...profile, right_to_work: e.target.value })
                  }
                  placeholder="British Citizen, Pre-Settled Status..."
                />
              </Field>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Willing to relocate
                </span>
                <Toggle
                  checked={profile.willing_to_relocate}
                  onChange={(v) =>
                    setProfile({ ...profile, willing_to_relocate: v })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Visa sponsorship needed
                </span>
                <Toggle
                  checked={profile.visa_sponsorship_needed}
                  onChange={(v) =>
                    setProfile({ ...profile, visa_sponsorship_needed: v })
                  }
                />
              </div>

              <SaveButton tab="preferences" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════════════ SEARCH TAB ════════════════════════ */}
        <TabsContent value={3}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Job Search Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 max-w-lg">
              {/* Keywords */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  SEARCH KEYWORDS
                </p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {search.keywords.map((kw) => (
                    <Badge key={kw} variant="secondary" className="text-xs gap-1">
                      {kw}
                      <button
                        onClick={() => removeSearchTag("keywords", kw)}
                        className="ml-0.5 hover:text-red-500"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. Senior DevOps Engineer..."
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      addSearchTag("keywords", newKeyword, setNewKeyword)
                    }
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      addSearchTag("keywords", newKeyword, setNewKeyword)
                    }
                    disabled={!newKeyword.trim()}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Target Locations */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  TARGET LOCATIONS
                </p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {search.locations.map((loc) => (
                    <Badge key={loc} variant="secondary" className="text-xs gap-1">
                      {loc}
                      <button
                        onClick={() => removeSearchTag("locations", loc)}
                        className="ml-0.5 hover:text-red-500"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. London, Remote, Manchester..."
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      addSearchTag("locations", newLocation, setNewLocation)
                    }
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      addSearchTag("locations", newLocation, setNewLocation)
                    }
                    disabled={!newLocation.trim()}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Job Board Sources */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  JOB BOARDS TO MONITOR
                </p>
                <div className="space-y-2">
                  {["Adzuna", "Reed"].map((source) => (
                    <label
                      key={source}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <span className="text-sm">{source}</span>
                      <Toggle
                        checked={search.sources[source] ?? false}
                        onChange={(v) =>
                          setSearch({
                            ...search,
                            sources: { ...search.sources, [source]: v },
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>

              <SaveButton tab="search" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Shared field wrapper ───

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
