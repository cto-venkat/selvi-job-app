import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { tenants, interviews, starStories } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { buildCompanyResearchPrompt } from "@/lib/prep/company-researcher";
import type { UserProfile } from "@/lib/prep/types";

export const dynamic = "force-dynamic";

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

  const { interviewId } = await request.json();
  if (!interviewId) {
    return NextResponse.json({ error: "interviewId required" }, { status: 400 });
  }

  // Get interview
  const interviewRows = await db
    .select()
    .from(interviews)
    .where(
      and(eq(interviews.tenantId, session.tenantId), eq(interviews.id, interviewId))
    )
    .limit(1);

  const interview = interviewRows[0];
  if (!interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  const userProfile = await getUserProfile(session.tenantId);
  if (!userProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Get STAR stories
  const stories = await db
    .select()
    .from(starStories)
    .where(eq(starStories.tenantId, session.tenantId));

  // Try to get job description if there's a linked application
  let jobDescription = "";
  if (interview.companyName && interview.roleTitle) {
    const jobResult = await db.execute(
      `SELECT description FROM jobs WHERE tenant_id = '${session.tenantId}' AND company ILIKE '%${(interview.companyName || "").replace(/'/g, "''")}%' LIMIT 1`
    );
    if (jobResult.rows[0]) {
      jobDescription = (jobResult.rows[0] as Record<string, unknown>).description as string || "";
    }
  }

  // Build company research prompt
  const { prompt: companyPrompt } = buildCompanyResearchPrompt(
    interview.companyName || "",
    interview.roleTitle || ""
  );

  try {
    // Get company research first
    const companyResponse = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: companyPrompt }],
    });
    const companyRaw = companyResponse.content.find((b) => b.type === "text")?.text || "";

    let companyResearch = null;
    try {
      companyResearch = JSON.parse(companyRaw);
    } catch {
      const match = companyRaw.match(/\{[\s\S]*\}/);
      if (match) {
        try { companyResearch = JSON.parse(match[0]); } catch { /* skip */ }
      }
    }

    // Build the prep brief prompt
    const storiesText = stories.length > 0
      ? stories.map((s, i) => `Story ${i + 1}: Situation: ${s.situation} | Task: ${s.task} | Action: ${s.action} | Result: ${s.result} | Skills: ${(s.skillsDemonstrated || []).join(", ")}`).join("\n")
      : "No STAR stories available yet.";

    const prepPrompt = `You are a UK-based interview coach preparing a detailed prep brief for an upcoming interview.

Interview Details:
- Company: ${interview.companyName}
- Role: ${interview.roleTitle}
- Format: ${interview.interviewFormat || "Not specified"}
- Date: ${interview.interviewDate || "Not specified"}

${jobDescription ? `Job Description:\n${jobDescription}\n` : "No job description available."}

Company Research:
${companyResearch ? JSON.stringify(companyResearch, null, 2) : "No research available."}

Candidate Profile:
- Name: ${userProfile.name}
- Summary: ${userProfile.professionalSummary || "Not provided"}
- Skills: ${userProfile.skills.join(", ") || "Not provided"}
- Experience: ${userProfile.experience.map((e) => `${e.title} at ${e.company}: ${e.bullets.slice(0, 2).join("; ")}`).join("\n  ") || "Not provided"}

STAR Stories Bank:
${storiesText}

Return JSON with this structure:
{
  "companyOverview": "2-3 sentence overview of the company relevant to this interview",
  "roleInsights": "What the company likely wants from this role based on JD and context",
  "talkingPoints": ["point 1", "point 2", ...],
  "predictedQuestions": [
    {
      "question": "Likely interview question",
      "suggestedApproach": "How to approach answering this",
      "relevantStoryIndex": null or number (0-based index of matching STAR story)
    }
  ],
  "companySpecificNotes": ["note about company culture", "recent news to reference", ...],
  "questionsToAsk": ["thoughtful question 1", "thoughtful question 2", ...],
  "prepChecklist": ["research item 1", "prepare item 2", ...]
}

Be specific to this company and role. Reference real facts where available. Match STAR stories to predicted questions where relevant.`;

    const prepResponse = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [{ role: "user", content: prepPrompt }],
    });

    const prepRaw = prepResponse.content.find((b) => b.type === "text")?.text || "";

    let prepBrief = null;
    try {
      prepBrief = JSON.parse(prepRaw);
    } catch {
      const match = prepRaw.match(/\{[\s\S]*\}/);
      if (match) {
        try { prepBrief = JSON.parse(match[0]); } catch { /* skip */ }
      }
    }

    return NextResponse.json({
      prepBrief,
      companyResearch,
      raw: prepRaw,
      stories: stories.map((s) => ({
        id: s.id,
        situation: s.situation,
        skillsDemonstrated: s.skillsDemonstrated,
      })),
    });
  } catch (error) {
    console.error("Interview prep generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
