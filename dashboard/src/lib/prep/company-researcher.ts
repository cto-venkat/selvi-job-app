/**
 * Company Researcher — builds a prompt for Claude to structure
 * company data into an actionable research brief.
 */

export type CompanyResearch = {
  overview: string;
  size: string;
  sector: string;
  recentNews: string[];
  glassdoorSummary: string;
  hiringSignals: string[];
  talkingPoints: string[];
};

const companyResearchSchema = {
  type: "object" as const,
  properties: {
    overview: {
      type: "string",
      description:
        "One-paragraph summary of the company: what they do, who they serve, and their market position.",
    },
    size: {
      type: "string",
      description:
        "Company size: headcount range, revenue bracket if known, and growth stage (startup, scale-up, enterprise).",
    },
    sector: {
      type: "string",
      description: "Primary industry sector and any relevant sub-sectors.",
    },
    recentNews: {
      type: "array",
      items: { type: "string" },
      description:
        "Recent developments: funding rounds, product launches, expansions, leadership changes, or press mentions.",
    },
    glassdoorSummary: {
      type: "string",
      description:
        "Summary of employee sentiment if available: ratings, common praise, common complaints, interview process notes.",
    },
    hiringSignals: {
      type: "array",
      items: { type: "string" },
      description:
        "Signals about why they are hiring: growth, backfill, new team, transformation, restructuring.",
    },
    talkingPoints: {
      type: "array",
      items: { type: "string" },
      description:
        "Specific things the candidate should mention in their application or interview to show they have done their research. Reference real facts only.",
    },
  },
  required: [
    "overview",
    "size",
    "sector",
    "recentNews",
    "glassdoorSummary",
    "hiringSignals",
    "talkingPoints",
  ],
};

export function buildCompanyResearchPrompt(
  company: string,
  jobTitle: string,
  availableData?: string
): { prompt: string; schema: object } {
  const dataSection = availableData
    ? `\nAvailable data about the company:\n---\n${availableData}\n---`
    : "\nNo external data has been provided. Base your analysis on the company name and role context only. Mark any uncertain information as inferred.";

  const prompt = `You are a UK-based career researcher preparing a company brief for a job applicant.

Company: ${company}
Target Role: ${jobTitle}
${dataSection}

Instructions:
- Write a concise overview of the company suitable for interview preparation.
- Estimate company size and growth stage from available signals.
- Identify the sector and any relevant sub-sectors.
- List recent news or developments that the candidate could reference.
- Summarise employee sentiment if Glassdoor or similar data is available. If not, note that no review data was provided.
- Identify hiring signals: why is this role open? What does it tell us about the company's direction?
- Generate specific talking points the candidate can use to demonstrate genuine research. Only reference facts that are supported by the provided data or are widely known.

Return your research as JSON matching the provided schema.`;

  return { prompt, schema: companyResearchSchema };
}
