"use client";

import { useState } from "react";
import { mockCvPackages } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FileCheck, Eye, Download, Loader2, AlertCircle, Send, X } from "lucide-react";

const statusConfig: Record<string, { label: string; icon: typeof FileCheck; class: string }> = {
  ready: {
    label: "Ready",
    icon: FileCheck,
    class: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  generating: {
    label: "Generating...",
    icon: Loader2,
    class: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  sent: {
    label: "Sent",
    icon: Send,
    class: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  failed: {
    label: "Failed",
    icon: AlertCircle,
    class: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
};

// Mock CV content for each package
const mockCvContent: Record<string, string> = {
  "cv-001": `SELVI CHELLAMMA
Senior L&D Consultant

PROFILE
Accomplished Learning & Development professional with 10+ years of experience designing and delivering strategic L&D programmes for enterprise clients across FTSE 100 organisations. CIPD qualified with deep expertise in change management, leadership development, and organisational transformation.

KEY SKILLS
- Enterprise L&D Strategy & Programme Design
- Change Management & Organisational Development
- Stakeholder Management at Board Level
- LMS Implementation & Digital Learning
- CIPD Level 7 Qualified

EXPERIENCE

Senior People Development Lead | Global Consultancy | 2020 - Present
- Designed and delivered leadership development programme for 200+ managers, improving 360-feedback scores by 28% within 6 months
- Led L&D strategy for 3 FTSE 100 clients, managing budgets of up to 2M GBP
- Implemented new LMS platform across 5,000+ users with 94% adoption rate

Learning & Development Manager | Financial Services | 2016 - 2020
- Built onboarding programme that reduced time-to-competency by 35%
- Managed team of 6 L&D professionals delivering 50+ programmes annually
- Achieved 4.7/5.0 average participant satisfaction across all programmes

EDUCATION
MSc Organisational Psychology | University College London | 2015
BA (Hons) Business Management | University of Manchester | 2013
CIPD Level 7 | Chartered Institute of Personnel and Development | 2017`,

  "cv-002": `SELVI CHELLAMMA
Head of People Development

PROFILE
Strategic people development leader with extensive EMEA experience in high-growth fintech and technology environments. Proven track record of building people development functions from scratch and scaling programmes across multiple regions.

KEY SKILLS
- EMEA People Strategy & Development
- Fintech & High-Growth Company Experience
- Executive Coaching & Leadership Programmes
- Data-Driven L&D with ROI Measurement
- Cross-Cultural Programme Design

EXPERIENCE

Senior People Development Lead | Global Consultancy | 2020 - Present
- Designed EMEA-wide leadership development framework adopted by 12 offices across 8 countries
- Built executive coaching programme for C-suite, achieving 92% NPS
- Pioneered data-driven L&D approach, demonstrating 22% improvement in internal promotion rates

Learning & Development Manager | Financial Services | 2016 - 2020
- Led cross-functional talent development initiatives for 3,000+ employees
- Designed competency frameworks aligned to business strategy
- Managed 1.5M GBP annual L&D budget with consistent under-budget delivery

EDUCATION
MSc Organisational Psychology | University College London | 2015
CIPD Level 7 | Chartered Institute of Personnel and Development | 2017`,

  "cv-003": `SELVI CHELLAMMA
Organisational Development Specialist

PROFILE
OD specialist with deep expertise in culture transformation and organisational design within FMCG and consumer goods sectors. Combines academic rigour in organisational psychology with practical programme delivery experience.

KEY SKILLS
- OD Frameworks & Diagnostics
- Culture Transformation Programmes
- FMCG Industry Experience
- Team Effectiveness & High-Performance Culture
- Organisational Design & Restructuring

EXPERIENCE

Senior People Development Lead | Global Consultancy | 2020 - Present
- Led culture transformation programme for major FMCG client, improving employee engagement scores by 18 points
- Designed OD diagnostic toolkit adopted by 15+ consulting teams
- Facilitated senior leadership team effectiveness workshops for 20+ executive teams

Learning & Development Manager | Financial Services | 2016 - 2020
- Implemented organisation-wide competency framework supporting restructure of 2,000+ roles
- Designed and delivered team effectiveness interventions for 40+ business units

EDUCATION
MSc Organisational Psychology | University College London | 2015
CIPD Level 7 | Chartered Institute of Personnel and Development | 2017`,

  "cv-004": `SELVI CHELLAMMA
Digital Learning Lead

PROFILE
Digital learning specialist with extensive experience in LMS implementation, digital transformation, and e-learning programme design within Big 4 consulting and professional services environments.

KEY SKILLS
- LMS Implementation & Administration
- Digital Learning Transformation
- E-Learning Content Design (Articulate, Captivate)
- Learning Analytics & Data Insights
- Big 4 Consulting Environment Experience

EXPERIENCE

Senior People Development Lead | Global Consultancy | 2020 - Present
- Led implementation of enterprise LMS platform for 5,000+ users across 3 countries
- Designed blended learning programmes combining digital and in-person delivery
- Built learning analytics dashboard providing real-time programme effectiveness data

Learning & Development Manager | Financial Services | 2016 - 2020
- Transitioned 60% of classroom training to digital delivery, maintaining satisfaction scores above 4.5/5.0
- Developed microlearning library of 200+ resources with 85% completion rate

EDUCATION
MSc Organisational Psychology | University College London | 2015
CIPD Level 7 | Chartered Institute of Personnel and Development | 2017`,

  "cv-005": `[CV is currently being generated by AI... Please check back shortly.]`,

  "cv-006": `SELVI CHELLAMMA
L&D Business Partner

PROFILE
Strategic L&D business partner with proven ability to align learning initiatives with business objectives in professional services environments. Expert in building trusted advisory relationships with senior stakeholders.

KEY SKILLS
- Strategic L&D Business Partnering
- Stakeholder Relationship Management
- Programme ROI Measurement
- Professional Services Industry Experience
- Needs Analysis & Learning Design

EXPERIENCE

Senior People Development Lead | Global Consultancy | 2020 - Present
- Acted as strategic L&D partner to 4 business units, aligning learning programmes to revenue targets
- Conducted 30+ learning needs analyses resulting in targeted programme interventions
- Achieved measurable business impact: 15% reduction in staff turnover in partnered units

Learning & Development Manager | Financial Services | 2016 - 2020
- Built and maintained relationships with 12 senior business leaders as L&D point of contact
- Designed quarterly L&D reporting framework adopted organisation-wide

EDUCATION
MSc Organisational Psychology | University College London | 2015
CIPD Level 7 | Chartered Institute of Personnel and Development | 2017`,
};

function formatDate(d: Date | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function downloadCv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function CvPage() {
  const packages: typeof mockCvPackages = [];
  const [previewId, setPreviewId] = useState<string | null>(null);

  const previewPkg = previewId ? packages.find((p) => p.id === previewId) : null;
  const previewContent = previewId ? (mockCvContent[previewId] ?? "No content available.") : "";

  if (packages.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CV Packages</h1>
          <p className="text-sm text-muted-foreground">AI-generated tailored CVs</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <FileCheck className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">No CV packages yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Head to Jobs to find matches -- CVs will be generated automatically for A-tier jobs.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">CV Packages</h1>
        <p className="text-sm text-muted-foreground">
          {packages.length} tailored CV package{packages.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg) => {
          const cfg = statusConfig[pkg.status] ?? statusConfig.ready;
          const StatusIcon = cfg.icon;

          return (
            <Card key={pkg.id} className="relative overflow-hidden">
              {/* Match bar */}
              <div
                className="absolute top-0 left-0 h-1 bg-cyan-500"
                style={{ width: `${pkg.matchPercentage}%` }}
              />
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold leading-tight">{pkg.jobTitle}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{pkg.company}</p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${cfg.class}`}>
                    <StatusIcon className={`h-3 w-3 mr-1 ${pkg.status === "generating" ? "animate-spin" : ""}`} />
                    {cfg.label}
                  </Badge>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span className="font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
                    {pkg.matchPercentage}% match
                  </span>
                  <span className="text-muted-foreground">{pkg.cvType}</span>
                  <span className="text-muted-foreground">{formatDate(pkg.createdAt)}</span>
                </div>

                {pkg.highlights && pkg.highlights.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {pkg.highlights.map((h: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">
                        {h}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={pkg.status === "generating"}
                    onClick={() => setPreviewId(pkg.id)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Preview
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={pkg.status === "generating"}
                    onClick={() => {
                      const content = mockCvContent[pkg.id] ?? "No content available.";
                      const filename = `CV - ${pkg.company} ${pkg.jobTitle}.txt`;
                      downloadCv(filename, content);
                    }}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewId} onOpenChange={(open) => { if (!open) setPreviewId(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {previewPkg ? `CV Preview -- ${previewPkg.company} ${previewPkg.jobTitle}` : "CV Preview"}
            </DialogTitle>
          </DialogHeader>
          <div className="bg-muted/30 rounded-md p-4 font-mono text-xs whitespace-pre-wrap leading-relaxed border">
            {previewContent}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (previewPkg) {
                  const content = mockCvContent[previewPkg.id] ?? "";
                  downloadCv(`CV - ${previewPkg.company} ${previewPkg.jobTitle}.txt`, content);
                }
              }}
            >
              <Download className="h-3 w-3 mr-1" />
              Download
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreviewId(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
