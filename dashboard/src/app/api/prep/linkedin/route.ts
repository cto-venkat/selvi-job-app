import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { tenants } from "@/lib/schema";
import { eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import type { UserProfile } from "@/lib/prep/types";

export const dynamic = "force-dynamic";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function getUserProfile(tenantId: string): Promise<{ profile: UserProfile; searchConfig: Record<string, unknown> } | null> {
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
  const candidateProfile = (row?.candidate_profile as Record<string, unknown>) || {};
  const searchConfig = (row?.search_config as Record<string, unknown>) || {};

  const profile: UserProfile = {
    name: tenant.name || "",
    email: tenant.email || "",
    phone: (candidateProfile.phone as string) || "",
    location:
      (candidateProfile.city as string) ||
      (searchConfig.location as string) ||
      "United Kingdom",
    rightToWork: (candidateProfile.right_to_work as string) || "British Citizen",
    noticePeriod: (candidateProfile.notice_period as string) || "1 month",
    salaryExpectation: (candidateProfile.expected_salary as string) || "",
    visaSponsorship: false,
    willingToRelocate: (candidateProfile.willing_to_relocate as boolean) || false,
    linkedinUrl: (candidateProfile.linkedin_url as string) || "",
    professionalSummary: (candidateProfile.professional_summary as string) || "",
    experience: (candidateProfile.experience as UserProfile["experience"]) || [],
    education: (candidateProfile.education as UserProfile["education"]) || [],
    skills: (candidateProfile.skills as string[]) || [],
    certifications: (candidateProfile.certifications as string[]) || [],
  };

  return { profile, searchConfig };
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

  const data = await getUserProfile(session.tenantId);
  if (!data) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { profile, searchConfig } = data;
  const targetRoles = (searchConfig.searchTerms as string[]) || [];
  const targetLocations = (searchConfig.locations as string[]) || [];

  const prompt = `You are a UK-based LinkedIn profile optimisation expert. Analyse the following candidate profile and suggest improvements for their LinkedIn presence.

Candidate Profile:
- Name: ${profile.name}
- Current Summary: ${profile.professionalSummary || "Not provided"}
- Skills: ${profile.skills.join(", ") || "Not provided"}
- Experience: ${profile.experience.map((e) => `${e.title} at ${e.company}`).join("; ") || "Not provided"}
- Education: ${profile.education.map((e) => `${e.qualification} from ${e.institution}`).join("; ") || "Not provided"}
- Target Roles: ${targetRoles.join(", ") || "Not specified"}
- Target Locations: ${targetLocations.join(", ") || "UK"}
- LinkedIn URL: ${profile.linkedinUrl || "Not provided"}

Return JSON with this structure:
{
  "headline": "Suggested LinkedIn headline (max 220 chars, keyword-rich)",
  "headlineRationale": "Why this headline works",
  "aboutSection": "Suggested About section (first person, 3-4 paragraphs, includes keywords naturally)",
  "aboutRationale": "Why this About section works",
  "keywordSuggestions": ["keyword1", "keyword2", ...],
  "keywordRationale": "Why these keywords matter for their target roles",
  "openToWorkConfig": {
    "jobTitles": ["title1", "title2"],
    "locationTypes": ["Remote", "On-site", "Hybrid"],
    "locations": ["location1"],
    "startDate": "Immediately or specific timeframe",
    "visibility": "Recruiters only (recommended) or All LinkedIn members"
  },
  "quickWins": ["actionable tip 1", "actionable tip 2", ...]
}

Focus on UK job market conventions. Be specific with suggestions, not generic. Reference their actual experience and skills.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock ? textBlock.text : "";

    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          // fall through
        }
      }
    }

    return NextResponse.json({ suggestions: parsed, raw, profile: {
      name: profile.name,
      summary: profile.professionalSummary,
      skills: profile.skills,
      experience: profile.experience,
      linkedinUrl: profile.linkedinUrl,
      targetRoles,
    }});
  } catch (error) {
    console.error("LinkedIn optimization error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
