/**
 * Screening Answers — pre-fills factual answers from the user profile
 * and builds prompts for LLM-generated answers to job-specific questions.
 */

import type { UserProfile } from "./types";
import type { JdAnalysis } from "./jd-analyzer";
import type { CompanyResearch } from "./company-researcher";

export type ScreeningAnswers = {
  prefilled: Record<string, string>;
  generated: GeneratedAnswer[];
};

export type GeneratedAnswer = {
  question: string;
  answer: string;
  confidence: "high" | "medium" | "low";
};

/**
 * Returns factual answers that can be filled directly from the user's
 * profile without any LLM involvement.
 */
export function getPrefilledAnswers(userProfile: UserProfile): Record<string, string> {
  const answers: Record<string, string> = {};

  if (userProfile.rightToWork) {
    answers["Do you have the right to work in the UK?"] =
      `Yes - ${userProfile.rightToWork}`;
  }

  if (userProfile.noticePeriod) {
    answers["What is your notice period?"] = userProfile.noticePeriod;
  }

  if (userProfile.salaryExpectation) {
    answers["What are your salary expectations?"] = userProfile.salaryExpectation;
  }

  answers["Do you require visa sponsorship?"] = userProfile.visaSponsorship
    ? "Yes, I require visa sponsorship."
    : "No, I do not require visa sponsorship.";

  answers["Are you willing to relocate?"] = userProfile.willingToRelocate
    ? "Yes, I am open to relocation."
    : `I am based in ${userProfile.location} and prefer roles accessible from this location.`;

  return answers;
}

/**
 * Builds a prompt for Claude to answer a specific screening question
 * using all available context about the job, company, and candidate.
 */
export function buildScreeningAnswerPrompt(
  question: string,
  userProfile: UserProfile,
  jdAnalysis: JdAnalysis,
  companyResearch: CompanyResearch
): { prompt: string } {
  const prompt = `You are helping a UK job applicant write a screening question answer. The answer must be truthful, specific, and grounded in the candidate's real experience.

Question: "${question}"

Candidate Profile:
${JSON.stringify(userProfile, null, 2)}

JD Analysis:
${JSON.stringify(jdAnalysis, null, 2)}

Company Research:
${JSON.stringify(companyResearch, null, 2)}

Guidelines:
1. Keep the answer concise: 2-4 sentences for simple questions, up to a short paragraph for behavioural questions.
2. Reference specific, real details from the candidate's profile. Do not fabricate experience or metrics.
3. Connect the candidate's background to the role requirements identified in the JD analysis.
4. For "why this company" questions, use the company research talking points — but only reference facts, not speculation.
5. Use professional British English throughout.
6. Avoid generic filler phrases. Every sentence should add specific value.
7. Do not start answers with "I am writing to..." or similar cover letter openers. Answer the question directly.

Write the answer as plain text (not JSON).`;

  return { prompt };
}

/**
 * Common job-specific questions with prompt-building context hints.
 * These help the orchestrator know which questions to generate answers for.
 */
export const COMMON_SCREENING_QUESTIONS = [
  "Why do you want to work here?",
  "Describe your relevant experience for this role.",
  "What makes you a good fit for this position?",
  "Tell us about a challenging project you have worked on.",
  "Where do you see yourself in five years?",
  "Why are you looking to leave your current role?",
] as const;
