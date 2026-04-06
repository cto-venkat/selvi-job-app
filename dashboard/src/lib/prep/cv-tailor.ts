/**
 * CV Tailor — builds a prompt for Claude to tailor a CV for
 * a specific job based on JD analysis and user profile.
 */

import type { UserProfile } from "./types";
import type { JdAnalysis } from "./jd-analyzer";

export type TailoredCVExperience = {
  company: string;
  title: string;
  startDate: string;
  endDate?: string;
  location: string;
  bullets: string[];
};

export type TailoredCVEducation = {
  institution: string;
  qualification: string;
  dates: string;
  grade?: string;
};

export type TailoredCV = {
  professionalSummary: string;
  experience: TailoredCVExperience[];
  education: TailoredCVEducation[];
  skills: string[];
  certifications?: string[];
};

const tailoredCVSchema = {
  type: "object" as const,
  properties: {
    professionalSummary: {
      type: "string",
      description:
        "2-3 sentence professional summary tailored to this specific role. UK CV style: no first person, factual, and direct.",
    },
    experience: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company: { type: "string" },
          title: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          location: { type: "string" },
          bullets: {
            type: "array",
            items: { type: "string" },
            description:
              "Achievement-focused bullet points. Use STAR format where natural. Only include real metrics from the source profile.",
          },
        },
        required: ["company", "title", "startDate", "location", "bullets"],
      },
      description: "Work experience entries ordered by relevance to this role, then by date.",
    },
    education: {
      type: "array",
      items: {
        type: "object",
        properties: {
          institution: { type: "string" },
          qualification: { type: "string" },
          dates: { type: "string" },
          grade: { type: "string" },
        },
        required: ["institution", "qualification", "dates"],
      },
    },
    skills: {
      type: "array",
      items: { type: "string" },
      description:
        "Skills list prioritised by relevance to the JD. Include key terminology from the JD where the candidate genuinely has the skill.",
    },
    certifications: {
      type: "array",
      items: { type: "string" },
      description: "Relevant certifications, if any.",
    },
  },
  required: ["professionalSummary", "experience", "education", "skills"],
};

export function buildCvTailoringPrompt(
  userProfile: UserProfile,
  jdAnalysis: JdAnalysis,
  baseCV: string
): { prompt: string; schema: object } {
  const prompt = `You are an expert UK CV writer. Tailor the candidate's CV for a specific job based on the JD analysis provided.

Candidate Profile:
${JSON.stringify(userProfile, null, 2)}

Base CV Text:
---
${baseCV}
---

JD Analysis:
${JSON.stringify(jdAnalysis, null, 2)}

Rules — follow these strictly:
1. UK CV conventions: no photograph, no date of birth, no marital status, professional summary at the top.
2. Use STAR format (Situation, Task, Action, Result) for achievement bullets where it fits naturally. Do not force it.
3. NEVER fabricate metrics, numbers, or achievements. Only use figures that appear in the candidate's profile or base CV. If no metric exists, describe the achievement qualitatively.
4. Reframe existing experience to highlight relevance to the JD requirements. Change wording, not facts.
5. Prioritise bullet points by relevance to this specific job. The most relevant achievements come first within each role.
6. Order experience sections by relevance to the role, then reverse-chronologically within equal relevance.
7. Mirror key terminology from the JD where the candidate genuinely possesses the skill or experience.
8. Keep the CV concise: maximum 2 pages worth of content. Cut less relevant details rather than cramming.
9. Skills section should lead with the skills most relevant to the JD.

Return the tailored CV as JSON matching the provided schema.`;

  return { prompt, schema: tailoredCVSchema };
}
