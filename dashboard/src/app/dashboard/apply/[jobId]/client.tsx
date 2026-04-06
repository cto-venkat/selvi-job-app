"use client";

import { useState } from "react";
import type { Job } from "@/lib/schema";
import type { AtsDetectionResult } from "@/lib/ats/detector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  MapPin,
  Briefcase,
  ExternalLink,
  FileText,
  MessageSquare,
  Search,
  Copy,
  Check,
  Loader2,
  ChevronRight,
} from "lucide-react";

type PrepSection = {
  id: string;
  title: string;
  icon: React.ReactNode;
  status: "pending" | "generating" | "ready" | "edited";
  content: string | null;
};

export function ApplicationPackageClient({
  job,
  atsInfo,
}: {
  job: Job;
  atsInfo: AtsDetectionResult | null;
}) {
  const [sections, setSections] = useState<PrepSection[]>([
    {
      id: "jd-analysis",
      title: "JD Analysis",
      icon: <Search className="h-4 w-4" />,
      status: "pending",
      content: null,
    },
    {
      id: "company-research",
      title: "Company Research",
      icon: <Building2 className="h-4 w-4" />,
      status: "pending",
      content: null,
    },
    {
      id: "tailored-cv",
      title: "Tailored CV",
      icon: <FileText className="h-4 w-4" />,
      status: "pending",
      content: null,
    },
    {
      id: "screening-answers",
      title: "Screening Answers",
      icon: <MessageSquare className="h-4 w-4" />,
      status: "pending",
      content: null,
    },
  ]);

  const [activeSection, setActiveSection] = useState<string>("jd-analysis");
  const [copied, setCopied] = useState<string | null>(null);

  const allReady = sections.every(
    (s) => s.status === "ready" || s.status === "edited"
  );

  async function generateSection(sectionId: string) {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, status: "generating" as const } : s
      )
    );

    // TODO: Call API to generate section content via Claude
    // For now, simulate with a placeholder
    await new Promise((r) => setTimeout(r, 1500));

    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              status: "ready" as const,
              content: `[Generated ${s.title} content will appear here once the Claude API is connected. This section will contain AI-generated analysis specific to this job and your profile.]`,
            }
          : s
      )
    );
  }

  async function generateAll() {
    for (const section of sections) {
      if (section.status === "pending") {
        await generateSection(section.id);
      }
    }
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  const statusColors = {
    pending: "bg-muted text-muted-foreground",
    generating: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
    ready: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
    edited: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  };

  const atsMethodLabel = {
    api: "API Submit Available",
    playwright: "Browser Assist Available",
    manual: "Manual Application",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{job.title}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" />
              {job.company}
            </span>
            {job.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {job.location}
              </span>
            )}
            {job.tier && (
              <Badge
                variant="secondary"
                className={
                  job.tier === "A+" || job.tier === "A"
                    ? "bg-green-100 text-green-800"
                    : job.tier === "B"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-muted"
                }
              >
                {job.tier}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View Job
            </a>
          )}
          <Button onClick={generateAll} disabled={allReady} size="sm">
            {allReady ? (
              "Package Ready"
            ) : (
              <>
                <Briefcase className="h-3.5 w-3.5 mr-1.5" />
                Generate All
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ATS Info Bar */}
      {atsInfo && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm">
          <span className="font-medium">Portal:</span>
          <Badge variant="outline">{atsInfo.platform}</Badge>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <Badge
            variant="secondary"
            className={
              atsInfo.submissionMethod === "api"
                ? "bg-green-100 text-green-800"
                : atsInfo.submissionMethod === "playwright"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-muted"
            }
          >
            {atsMethodLabel[atsInfo.submissionMethod]}
          </Badge>
        </div>
      )}

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Section Nav */}
        <div className="space-y-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                activeSection === section.id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50"
              }`}
            >
              {section.icon}
              <span className="flex-1 text-left">{section.title}</span>
              <Badge
                variant="secondary"
                className={`text-[10px] ${statusColors[section.status]}`}
              >
                {section.status}
              </Badge>
            </button>
          ))}

          <Separator className="my-3" />

          {/* Quick Copy Section */}
          <Card>
            <CardHeader className="py-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Quick Copy
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-1.5">
              {[
                { label: "Full Name", value: "Selvi Kumar" },
                { label: "Email", value: "chellamma.uk@gmail.com" },
                { label: "Phone", value: "" },
                { label: "Location", value: "Maidenhead, Berkshire" },
              ]
                .filter((f) => f.value)
                .map((field) => (
                  <button
                    key={field.label}
                    onClick={() => copyToClipboard(field.value, field.label)}
                    className="w-full flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-muted transition-colors"
                  >
                    <span className="text-muted-foreground">
                      {field.label}
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      {field.value}
                      {copied === field.label ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3 text-muted-foreground" />
                      )}
                    </span>
                  </button>
                ))}
            </CardContent>
          </Card>
        </div>

        {/* Content Panel */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              {sections.find((s) => s.id === activeSection)?.title}
            </CardTitle>
            <div className="flex gap-2">
              {sections.find((s) => s.id === activeSection)?.content && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const content = sections.find(
                      (s) => s.id === activeSection
                    )?.content;
                    if (content) copyToClipboard(content, activeSection);
                  }}
                >
                  {copied === activeSection ? (
                    <Check className="h-3.5 w-3.5 mr-1.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Copy
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => generateSection(activeSection)}
                disabled={
                  sections.find((s) => s.id === activeSection)?.status ===
                  "generating"
                }
              >
                {sections.find((s) => s.id === activeSection)?.status ===
                "generating" ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Generating...
                  </>
                ) : sections.find((s) => s.id === activeSection)?.status ===
                  "pending" ? (
                  "Generate"
                ) : (
                  "Regenerate"
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {sections.find((s) => s.id === activeSection)?.content ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">
                  {sections.find((s) => s.id === activeSection)?.content}
                </pre>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText className="h-8 w-8 mb-3 opacity-40" />
                <p className="text-sm">
                  Click Generate to create this section
                </p>
                <p className="text-xs mt-1 opacity-70">
                  AI will analyze the job and your profile
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
