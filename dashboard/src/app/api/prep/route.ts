import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getJobById } from "@/lib/queries";
import { db } from "@/lib/db";
import { tenants } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { buildJdAnalysisPrompt } from "@/lib/prep/jd-analyzer";
import { buildCompanyResearchPrompt } from "@/lib/prep/company-researcher";
import { buildCvTailoringPrompt } from "@/lib/prep/cv-tailor";
import {
  buildScreeningAnswerPrompt,
  getPrefilledAnswers,
} from "@/lib/prep/screening-answers";
import type { JdAnalysis } from "@/lib/prep/jd-analyzer";
import type { CompanyResearch } from "@/lib/prep/company-researcher";
import type { UserProfile } from "@/lib/prep/types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function getUserProfile(tenantId: string): Promise<UserProfile | null> {
  const rows = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!rows[0]) return null;

  const tenant = rows[0];
  // candidate_profile is stored as JSONB on the tenants table in the DB
  // but not in the Drizzle schema — use raw SQL
  const profileResult = await db.execute(
    `SELECT candidate_profile, search_config FROM tenants WHERE id = '${tenantId}'`
  );
  const row = profileResult.rows[0] as Record<string, unknown> | undefined;
  const profile = (row?.candidate_profile as Record<string, unknown>) || {};
  const search = (row?.search_config as Record<string, unknown>) || {};

  return {
    name: tenant.name || "",
    email: tenant.email || "",
    phone: (profile.phone as string) || "",
    location:
      (profile.city as string) ||
      (search.location as string) ||
      "United Kingdom",
    rightToWork: (profile.right_to_work as string) || "British Citizen",
    noticePeriod: (profile.notice_period as string) || "1 month",
    salaryExpectation: (profile.expected_salary as string) || "",
    visaSponsorship: false,
    willingToRelocate: (profile.willing_to_relocate as boolean) || false,
    linkedinUrl: (profile.linkedin_url as string) || "",
    professionalSummary: (profile.professional_summary as string) || "",
    experience: (profile.experience as UserProfile["experience"]) || [],
    education: (profile.education as UserProfile["education"]) || [],
    skills: (profile.skills as string[]) || [],
    certifications: (profile.certifications as string[]) || [],
  };
}

async function callClaude(
  prompt: string,
  model: string = "claude-haiku-4-5-20251001"
): Promise<string> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock ? textBlock.text : "";
}

function extractJson(text: string): unknown {
  // Try to parse the whole response as JSON first
  try {
    return JSON.parse(text);
  } catch {
    // Look for JSON in code blocks
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1].trim());
      } catch {
        // Fall through
      }
    }
    // Try to find JSON object in the text
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]);
      } catch {
        // Fall through
      }
    }
    return null;
  }
}

// GET — load saved prep package for a job
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const result = await db.execute(
    sql`SELECT prep_package, prep_status FROM jobs WHERE id = ${jobId} AND tenant_id = ${session.tenantId}`
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;

  return NextResponse.json({
    prepPackage: row?.prep_package || null,
    prepStatus: row?.prep_status || "none",
  });
}

async function savePrepSection(jobId: string, tenantId: string, section: string, content: unknown) {
  // Load existing prep_package, merge in the new section
  const result = await db.execute(
    sql`SELECT prep_package FROM jobs WHERE id = ${jobId} AND tenant_id = ${tenantId}`
  );
  const existing = (result.rows[0] as Record<string, unknown>)?.prep_package || {};
  const updated = { ...(existing as Record<string, unknown>), [section]: content };

  await db.execute(
    sql`UPDATE jobs SET prep_package = ${JSON.stringify(updated)}::jsonb, prep_status = 'partial' WHERE id = ${jobId} AND tenant_id = ${tenantId}`
  );
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  const { section, jobId } = await request.json();

  if (!section || !jobId) {
    return NextResponse.json(
      { error: "section and jobId required" },
      { status: 400 }
    );
  }

  const job = await getJobById(session.tenantId, jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const userProfile = await getUserProfile(session.tenantId);
  if (!userProfile) {
    return NextResponse.json(
      { error: "User profile not found" },
      { status: 404 }
    );
  }

  try {
    switch (section) {
      case "jd-analysis": {
        const { prompt } = buildJdAnalysisPrompt(
          job.description || "",
          job.title || "",
          job.company || ""
        );
        const raw = await callClaude(prompt);
        const parsed = extractJson(raw) as JdAnalysis | null;
        const content = parsed || raw;
        await savePrepSection(jobId, session.tenantId, section, content);
        return NextResponse.json({ content, raw });
      }

      case "company-research": {
        const { prompt } = buildCompanyResearchPrompt(
          job.company || "",
          job.title || ""
        );
        // Use Sonnet for research (needs more reasoning)
        const raw = await callClaude(prompt, "claude-haiku-4-5-20251001");
        const parsed = extractJson(raw) as CompanyResearch | null;
        const compContent = parsed || raw;
        await savePrepSection(jobId, session.tenantId, section, compContent);
        return NextResponse.json({ content: compContent, raw });
      }

      case "tailored-cv": {
        // Need JD analysis first — try to get it from the request or generate
        const jdPrompt = buildJdAnalysisPrompt(
          job.description || "",
          job.title || "",
          job.company || ""
        );
        const jdRaw = await callClaude(jdPrompt.prompt);
        const jdAnalysis = extractJson(jdRaw) as JdAnalysis;

        if (!jdAnalysis) {
          return NextResponse.json(
            { error: "Failed to analyze JD" },
            { status: 500 }
          );
        }

        const baseCV = userProfile.professionalSummary
          ? `${userProfile.professionalSummary}\n\n${userProfile.experience.map((e) => `${e.title} at ${e.company}\n${e.bullets.join("\n")}`).join("\n\n")}`
          : "No base CV available. Please add your experience in Settings.";

        const { prompt } = buildCvTailoringPrompt(
          userProfile,
          jdAnalysis,
          baseCV
        );
        // Use Sonnet for CV writing quality
        const raw = await callClaude(prompt, "claude-haiku-4-5-20251001");
        const parsed = extractJson(raw);
        const cvContent = parsed || raw;
        await savePrepSection(jobId, session.tenantId, section, cvContent);
        return NextResponse.json({ content: cvContent, raw });
      }

      case "screening-answers": {
        // Get prefilled answers
        const prefilled = getPrefilledAnswers(userProfile);

        // Generate answers for common screening questions
        const jdPrompt = buildJdAnalysisPrompt(
          job.description || "",
          job.title || "",
          job.company || ""
        );
        const jdRaw = await callClaude(jdPrompt.prompt);
        const jdAnalysis = extractJson(jdRaw) as JdAnalysis;

        const companyPrompt = buildCompanyResearchPrompt(
          job.company || "",
          job.title || ""
        );
        const companyRaw = await callClaude(companyPrompt.prompt);
        const companyResearch = extractJson(companyRaw) as CompanyResearch;

        const questions = [
          "Why do you want to work at this company?",
          "Describe your relevant experience for this role.",
          "What makes you a strong candidate for this position?",
        ];

        const answers: Record<string, string> = { ...prefilled };

        for (const q of questions) {
          const { prompt } = buildScreeningAnswerPrompt(
            q,
            userProfile,
            jdAnalysis || ({} as JdAnalysis),
            companyResearch || ({} as CompanyResearch)
          );
          const answer = await callClaude(prompt);
          answers[q] = answer.trim();
        }

        await savePrepSection(jobId, session.tenantId, section, answers);
        return NextResponse.json({ content: answers });
      }

      default:
        return NextResponse.json(
          { error: `Unknown section: ${section}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error(`Prep generation error (${section}):`, error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Generation failed",
      },
      { status: 500 }
    );
  }
}
