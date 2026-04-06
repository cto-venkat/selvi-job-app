/**
 * JD Analyzer — builds a prompt for Claude to extract structured
 * information from a job description.
 */

export type JdAnalysis = {
  mustHaveRequirements: string[];
  niceToHaveRequirements: string[];
  requiredSkills: string[];
  likelyScreeningQuestions: string[];
  companyCultureSignals: string[];
  seniorityLevel: string;
  teamContext: string;
  keyTerminology: string[];
  salaryIndicators?: string;
  remotePolicy?: string;
};

const jdAnalysisSchema = {
  type: "object" as const,
  properties: {
    mustHaveRequirements: {
      type: "array",
      items: { type: "string" },
      description: "Requirements explicitly stated as essential, mandatory, or must-have.",
    },
    niceToHaveRequirements: {
      type: "array",
      items: { type: "string" },
      description: "Requirements stated as desirable, preferred, or nice-to-have.",
    },
    requiredSkills: {
      type: "array",
      items: { type: "string" },
      description:
        "Technical and soft skills mentioned in the JD. Include tools, languages, frameworks, and methodologies.",
    },
    likelyScreeningQuestions: {
      type: "array",
      items: { type: "string" },
      description:
        "Questions the applicant is likely to face during screening, inferred from the JD requirements and company context.",
    },
    companyCultureSignals: {
      type: "array",
      items: { type: "string" },
      description:
        "Clues about company culture: values, working style, team dynamics, and language used.",
    },
    seniorityLevel: {
      type: "string",
      description:
        "Inferred seniority: Junior, Mid, Senior, Lead, Principal, Manager, Director, VP, or C-level.",
    },
    teamContext: {
      type: "string",
      description:
        "What is known about the team: size, reporting line, cross-functional relationships.",
    },
    keyTerminology: {
      type: "array",
      items: { type: "string" },
      description:
        "Domain-specific terms and phrases from the JD that should appear in the application to pass ATS and demonstrate familiarity.",
    },
    salaryIndicators: {
      type: "string",
      description: "Any salary, pay band, or compensation information mentioned.",
    },
    remotePolicy: {
      type: "string",
      description:
        "Remote/hybrid/on-site policy if mentioned. Include office location requirements.",
    },
  },
  required: [
    "mustHaveRequirements",
    "niceToHaveRequirements",
    "requiredSkills",
    "likelyScreeningQuestions",
    "companyCultureSignals",
    "seniorityLevel",
    "teamContext",
    "keyTerminology",
  ],
};

export function buildJdAnalysisPrompt(
  jobDescription: string,
  jobTitle: string,
  company: string
): { prompt: string; schema: object } {
  const prompt = `You are an expert UK recruitment analyst. Analyse the following job description and extract structured information that will help a candidate prepare a strong application.

Job Title: ${jobTitle}
Company: ${company}

Job Description:
---
${jobDescription}
---

Instructions:
- Separate requirements into must-haves (explicitly required) and nice-to-haves (preferred/desirable).
- List all technical and soft skills mentioned, including specific tools, languages, and frameworks.
- Infer likely screening questions based on the role requirements and common UK hiring practices.
- Identify signals about company culture from the language and values mentioned.
- Determine the seniority level from the title, responsibilities, and experience requirements.
- Extract key terminology that should appear in the candidate's CV and cover letter to pass ATS systems.
- Note any salary or remote working information.

Return your analysis as JSON matching the provided schema.`;

  return { prompt, schema: jdAnalysisSchema };
}
