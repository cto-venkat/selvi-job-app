/**
 * JobPilot Hybrid Job Scorer
 *
 * Evaluates jobs across 8 dimensions:
 *   4 deterministic (computed locally, no LLM)
 *   4 LLM-scored (prompt built here, call made externally)
 *
 * Final composite score 0-100 maps to tier: Apply >= 70, Maybe 50-69, Skip < 50.
 */

import type { Job } from "./schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserProfile {
  name: string;
  email: string;
  homeLocation: string; // city or postcode
  targetSalaryMin: number;
  targetSalaryMax: number;
  preferredContractType: "permanent" | "contract" | "either";
  targetSeniorityLevel: SeniorityLevel;
  skills: string[];
  experienceSummary: string;
  yearsOfExperience: number;
}

export type SeniorityLevel =
  | "junior"
  | "mid"
  | "senior"
  | "lead"
  | "head"
  | "director";

export type Tier = "Apply" | "Maybe" | "Skip";

export type Grade = "A" | "B" | "C" | "D" | "F";

export interface DimensionScore {
  dimension: string;
  score: number; // 0-100
  weight: number; // 0-1
  grade: Grade;
  evidence: string;
}

export interface LlmDimensionScore {
  score: number; // 0-100
  grade: Grade;
  evidence: string;
}

export interface LlmScores {
  roleMatch: LlmDimensionScore;
  skillsAlignment: LlmDimensionScore;
  growthPotential: LlmDimensionScore;
  companyQuality: LlmDimensionScore;
}

export interface DeterministicScores {
  location: DimensionScore;
  compensation: DimensionScore;
  contractType: DimensionScore;
  seniority: DimensionScore;
}

export interface ScoringResult {
  compositeScore: number;
  tier: Tier;
  gatePassApplied: boolean;
  dimensions: DimensionScore[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WEIGHTS = {
  location: 0.15,
  compensation: 0.15,
  contractType: 0.05,
  seniority: 0.05,
  roleMatch: 0.25,
  skillsAlignment: 0.2,
  growthPotential: 0.08,
  companyQuality: 0.07,
} as const;

// ---------------------------------------------------------------------------
// Seniority lookup
// ---------------------------------------------------------------------------

const SENIORITY_LEVELS: SeniorityLevel[] = [
  "junior",
  "mid",
  "senior",
  "lead",
  "head",
  "director",
];

/** Maps title keywords/patterns to a seniority level. Order matters: first match wins. */
const TITLE_SENIORITY_MAP: Array<{ patterns: string[]; level: SeniorityLevel }> = [
  {
    level: "director",
    patterns: [
      "director",
      "vp ",
      "vice president",
      "chief ",
      "cto",
      "cio",
      "cfo",
      "ceo",
      "managing director",
      "md ",
    ],
  },
  {
    level: "head",
    patterns: [
      "head of",
      "head,",
      "principal",
      "staff ",
      "distinguished",
      "fellow",
    ],
  },
  {
    level: "lead",
    patterns: [
      "lead ",
      "lead,",
      "team lead",
      "tech lead",
      "technical lead",
      "engineering manager",
      "programme manager",
      "program manager",
      "project manager",
      "delivery manager",
      "scrum master",
      "architect",
    ],
  },
  {
    level: "senior",
    patterns: [
      "senior",
      "sr ",
      "sr.",
      "snr ",
      "snr.",
      "experienced",
      "specialist",
      "iii",
    ],
  },
  {
    level: "mid",
    patterns: [
      "mid",
      "intermediate",
      "ii",
      "analyst",
      "consultant",
      "advisor",
      "officer",
      "executive",
      "coordinator",
      "administrator",
    ],
  },
  {
    level: "junior",
    patterns: [
      "junior",
      "jr ",
      "jr.",
      "jnr",
      "trainee",
      "graduate",
      "grad ",
      "entry level",
      "entry-level",
      "apprentice",
      "intern",
      "placement",
      "assistant",
      "associate",
    ],
  },
];

function inferSeniorityFromTitle(title: string): SeniorityLevel | null {
  const lower = title.toLowerCase();
  for (const { patterns, level } of TITLE_SENIORITY_MAP) {
    for (const p of patterns) {
      if (lower.includes(p)) return level;
    }
  }
  return null;
}

function seniorityDistance(a: SeniorityLevel, b: SeniorityLevel): number {
  return Math.abs(SENIORITY_LEVELS.indexOf(a) - SENIORITY_LEVELS.indexOf(b));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gradeFromScore(score: number): Grade {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 50) return "C";
  if (score >= 30) return "D";
  return "F";
}

function normalise(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9 ]/g, "");
}

/** UK regions grouped by broad area for approximate matching. */
const UK_REGIONS: Record<string, string[]> = {
  london: ["london", "city of london", "greater london"],
  southeast: [
    "surrey", "kent", "sussex", "hampshire", "berkshire", "oxfordshire",
    "buckinghamshire", "hertfordshire", "essex", "brighton", "reading",
    "slough", "guildford", "oxford", "milton keynes",
  ],
  southwest: [
    "bristol", "bath", "devon", "cornwall", "dorset", "somerset",
    "wiltshire", "gloucestershire", "exeter", "plymouth",
  ],
  eastanglia: [
    "cambridge", "cambridgeshire", "norfolk", "suffolk", "norwich",
    "ipswich", "peterborough",
  ],
  midlands: [
    "birmingham", "coventry", "nottingham", "leicester", "derby",
    "wolverhampton", "stoke", "warwickshire", "west midlands",
    "east midlands", "staffordshire", "northamptonshire",
  ],
  northwest: [
    "manchester", "liverpool", "chester", "lancashire", "cheshire",
    "preston", "blackpool", "bolton", "salford",
  ],
  northeast: [
    "newcastle", "sunderland", "durham", "middlesbrough", "tyne and wear",
    "northumberland", "teesside",
  ],
  yorkshire: [
    "leeds", "sheffield", "bradford", "york", "hull", "huddersfield",
    "doncaster", "south yorkshire", "west yorkshire",
  ],
  scotland: [
    "edinburgh", "glasgow", "aberdeen", "dundee", "scotland", "inverness",
    "stirling",
  ],
  wales: [
    "cardiff", "swansea", "newport", "wales", "bangor",
  ],
  northernireland: [
    "belfast", "derry", "northern ireland", "londonderry",
  ],
};

function findRegion(location: string): string | null {
  const norm = normalise(location);
  for (const [region, cities] of Object.entries(UK_REGIONS)) {
    for (const city of cities) {
      if (norm.includes(city) || city.includes(norm)) return region;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Deterministic scoring functions
// ---------------------------------------------------------------------------

function scoreLocation(job: Job, user: UserProfile): DimensionScore {
  const jobLoc = normalise(job.location ?? "");
  const userLoc = normalise(user.homeLocation);

  let score: number;
  let evidence: string;

  if (!jobLoc || jobLoc === "not specified") {
    score = 50;
    evidence = "Job location not specified; scored as unknown.";
  } else if (
    jobLoc.includes("remote") ||
    jobLoc.includes("work from home") ||
    jobLoc.includes("wfh")
  ) {
    score = 100;
    evidence = "Remote role -- no commute required.";
  } else if (jobLoc.includes("hybrid") && jobLoc.includes(userLoc)) {
    score = 90;
    evidence = `Hybrid role in ${job.location}, same as home location.`;
  } else if (jobLoc.includes(userLoc) || userLoc.includes(jobLoc)) {
    score = 100;
    evidence = `Job location matches home location (${user.homeLocation}).`;
  } else {
    const jobRegion = findRegion(jobLoc);
    const userRegion = findRegion(userLoc);
    if (jobRegion && userRegion && jobRegion === userRegion) {
      score = 60;
      evidence = `Same region (${jobRegion}) but different city.`;
    } else if (jobLoc.includes("hybrid")) {
      score = 40;
      evidence = `Hybrid role in ${job.location}, different region from ${user.homeLocation}.`;
    } else {
      score = 30;
      evidence = `${job.location} is in a different region from ${user.homeLocation}.`;
    }
  }

  return {
    dimension: "Location",
    score,
    weight: WEIGHTS.location,
    grade: gradeFromScore(score),
    evidence,
  };
}

function scoreCompensation(job: Job, user: UserProfile): DimensionScore {
  const jobMin = job.salaryMin ? Number(job.salaryMin) : null;
  const jobMax = job.salaryMax ? Number(job.salaryMax) : null;

  let score: number;
  let evidence: string;

  if (jobMin === null && jobMax === null) {
    score = 50;
    evidence = "Salary not disclosed; scored as unknown.";
  } else {
    // Use the midpoint of the job range as the representative figure
    const jobMid =
      jobMin !== null && jobMax !== null
        ? (jobMin + jobMax) / 2
        : jobMin ?? jobMax!;
    const userMid = (user.targetSalaryMin + user.targetSalaryMax) / 2;

    if (jobMid >= user.targetSalaryMin) {
      score = 100;
      evidence = `Salary (~${formatSalary(jobMid)}) meets or exceeds target range.`;
    } else {
      const shortfall = (user.targetSalaryMin - jobMid) / user.targetSalaryMin;
      if (shortfall <= 0.2) {
        score = 60;
        evidence = `Salary (~${formatSalary(jobMid)}) is ${Math.round(shortfall * 100)}% below target minimum.`;
      } else {
        score = 20;
        evidence = `Salary (~${formatSalary(jobMid)}) is significantly below target (${Math.round(shortfall * 100)}% under).`;
      }
    }
  }

  return {
    dimension: "Compensation",
    score,
    weight: WEIGHTS.compensation,
    grade: gradeFromScore(score),
    evidence,
  };
}

function formatSalary(n: number): string {
  if (n >= 1000) return `£${Math.round(n / 1000)}k`;
  return `£${n}`;
}

function scoreContractType(job: Job, user: UserProfile): DimensionScore {
  const jobType = normalise(job.jobType ?? "");

  let score: number;
  let evidence: string;

  if (!jobType) {
    score = 50;
    evidence = "Contract type not specified.";
  } else if (user.preferredContractType === "either") {
    score = 100;
    evidence = `User accepts either type; job is ${job.jobType}.`;
  } else if (jobType.includes(user.preferredContractType)) {
    score = 100;
    evidence = `Contract type (${job.jobType}) matches preference (${user.preferredContractType}).`;
  } else {
    score = 30;
    evidence = `Contract type (${job.jobType}) does not match preference (${user.preferredContractType}).`;
  }

  return {
    dimension: "Contract Type",
    score,
    weight: WEIGHTS.contractType,
    grade: gradeFromScore(score),
    evidence,
  };
}

function scoreSeniority(job: Job, user: UserProfile): DimensionScore {
  const title = job.title ?? "";
  const inferred = inferSeniorityFromTitle(title);

  let score: number;
  let evidence: string;

  if (!inferred) {
    score = 50;
    evidence = `Could not infer seniority from title "${title}".`;
  } else {
    const dist = seniorityDistance(inferred, user.targetSeniorityLevel);
    if (dist === 0) {
      score = 100;
      evidence = `Title "${title}" matches target level (${user.targetSeniorityLevel}).`;
    } else if (dist === 1) {
      score = 60;
      evidence = `Title "${title}" (${inferred}) is one level from target (${user.targetSeniorityLevel}).`;
    } else {
      score = 20;
      evidence = `Title "${title}" (${inferred}) is ${dist} levels from target (${user.targetSeniorityLevel}).`;
    }
  }

  return {
    dimension: "Seniority",
    score,
    weight: WEIGHTS.seniority,
    grade: gradeFromScore(score),
    evidence,
  };
}

// ---------------------------------------------------------------------------
// Public: deterministic scoring
// ---------------------------------------------------------------------------

export function scoreJobDeterministic(
  job: Job,
  userProfile: UserProfile,
): DeterministicScores {
  return {
    location: scoreLocation(job, userProfile),
    compensation: scoreCompensation(job, userProfile),
    contractType: scoreContractType(job, userProfile),
    seniority: scoreSeniority(job, userProfile),
  };
}

// ---------------------------------------------------------------------------
// Public: LLM prompt builder
// ---------------------------------------------------------------------------

/** JSON schema the LLM must return. */
export const LLM_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    roleMatch: {
      type: "object",
      properties: {
        score: { type: "number", minimum: 0, maximum: 100 },
        grade: { type: "string", enum: ["A", "B", "C", "D", "F"] },
        evidence: { type: "string", maxLength: 200 },
      },
      required: ["score", "grade", "evidence"],
    },
    skillsAlignment: {
      type: "object",
      properties: {
        score: { type: "number", minimum: 0, maximum: 100 },
        grade: { type: "string", enum: ["A", "B", "C", "D", "F"] },
        evidence: { type: "string", maxLength: 200 },
      },
      required: ["score", "grade", "evidence"],
    },
    growthPotential: {
      type: "object",
      properties: {
        score: { type: "number", minimum: 0, maximum: 100 },
        grade: { type: "string", enum: ["A", "B", "C", "D", "F"] },
        evidence: { type: "string", maxLength: 200 },
      },
      required: ["score", "grade", "evidence"],
    },
    companyQuality: {
      type: "object",
      properties: {
        score: { type: "number", minimum: 0, maximum: 100 },
        grade: { type: "string", enum: ["A", "B", "C", "D", "F"] },
        evidence: { type: "string", maxLength: 200 },
      },
      required: ["score", "grade", "evidence"],
    },
  },
  required: ["roleMatch", "skillsAlignment", "growthPotential", "companyQuality"],
} as const;

export function buildLlmScoringPrompt(
  job: Job,
  userProfile: UserProfile,
): { prompt: string; responseSchema: typeof LLM_RESPONSE_SCHEMA } {
  const prompt = `You are a UK job market analyst scoring how well a job matches a candidate.

## Candidate Profile
- Name: ${userProfile.name}
- Experience: ${userProfile.yearsOfExperience} years
- Skills: ${userProfile.skills.join(", ")}
- Summary: ${userProfile.experienceSummary}
- Target level: ${userProfile.targetSeniorityLevel}

## Job Details
- Title: ${job.title ?? "Unknown"}
- Company: ${job.company ?? "Unknown"}
- Location: ${job.location ?? "Not specified"}
- Type: ${job.jobType ?? "Not specified"}
- Description:
${(job.description ?? "No description available.").slice(0, 3000)}

## Scoring Dimensions

Score each dimension 0-100, assign a letter grade (A/B/C/D/F), and give 1-2 sentences of evidence.

1. **Role Match** (25% weight): How well do the job responsibilities align with the candidate's experience? Consider day-to-day tasks, domain, and scope.
2. **Skills Alignment** (20% weight): What proportion of required/desired skills does the candidate have? Penalise hard gaps in must-haves; partial credit for transferable skills.
3. **Growth Potential** (8% weight): Does this role offer career progression? Look for mentorship, training budget, promotion pathways, growing teams, or stretch responsibilities.
4. **Company Quality** (7% weight): Consider company reputation, stability, sector appeal, Glassdoor-type signals in the description, and whether the company is known in the UK market.

## Calibration Anchors

**Strong match (~85):**
A senior backend engineer with 8 years Python/AWS experience applying for a "Senior Platform Engineer" at a Series B fintech. The role needs Python, AWS, Terraform, and Kubernetes. The candidate has all except Kubernetes but has Docker and ECS experience. The company is growing, well-funded, and offers clear Staff Engineer progression.
- roleMatch: 88, A, "Platform engineering is a natural evolution from backend; scope and seniority align well."
- skillsAlignment: 80, B, "Strong overlap on Python and AWS; Kubernetes is a gap but container experience is transferable."
- growthPotential: 90, A, "Series B with defined Staff Engineer track and engineering blog culture."
- companyQuality: 82, B, "Well-funded fintech with strong Glassdoor reviews; sector is competitive for talent."

**Weak match (~35):**
A junior frontend developer with 1 year React experience applying for a "Head of Data Engineering" at a large bank. The role requires 10+ years experience, Spark, Airflow, and team leadership of 15 engineers.
- roleMatch: 15, F, "Frontend development has minimal overlap with data engineering leadership."
- skillsAlignment: 10, F, "No relevant data engineering skills; React experience does not transfer."
- growthPotential: 60, C, "Large bank has structured progression but role is far above candidate level."
- companyQuality: 70, B, "Established bank with stable employment but less appealing for early-career frontend."

## Output Format

Return ONLY valid JSON matching this schema -- no markdown, no explanation outside the JSON:
${JSON.stringify(LLM_RESPONSE_SCHEMA, null, 2)}`;

  return { prompt, responseSchema: LLM_RESPONSE_SCHEMA };
}

// ---------------------------------------------------------------------------
// Public: composite score
// ---------------------------------------------------------------------------

export function computeCompositeScore(
  deterministic: DeterministicScores,
  llm: LlmScores,
): ScoringResult {
  // Build all 8 dimension scores
  const allDimensions: DimensionScore[] = [
    deterministic.location,
    deterministic.compensation,
    deterministic.contractType,
    deterministic.seniority,
    {
      dimension: "Role Match",
      score: llm.roleMatch.score,
      weight: WEIGHTS.roleMatch,
      grade: llm.roleMatch.grade,
      evidence: llm.roleMatch.evidence,
    },
    {
      dimension: "Skills Alignment",
      score: llm.skillsAlignment.score,
      weight: WEIGHTS.skillsAlignment,
      grade: llm.skillsAlignment.grade,
      evidence: llm.skillsAlignment.evidence,
    },
    {
      dimension: "Growth Potential",
      score: llm.growthPotential.score,
      weight: WEIGHTS.growthPotential,
      grade: llm.growthPotential.grade,
      evidence: llm.growthPotential.evidence,
    },
    {
      dimension: "Company Quality",
      score: llm.companyQuality.score,
      weight: WEIGHTS.companyQuality,
      grade: llm.companyQuality.grade,
      evidence: llm.companyQuality.evidence,
    },
  ];

  // Weighted sum
  let raw = 0;
  for (const d of allDimensions) {
    raw += d.score * d.weight;
  }
  raw = Math.round(raw);

  // Gate-pass: if Role Match or Skills Alignment < 40, cap at 40
  const gatePassApplied =
    llm.roleMatch.score < 40 || llm.skillsAlignment.score < 40;
  const compositeScore = gatePassApplied ? Math.min(raw, 40) : raw;

  // Tier
  let tier: Tier;
  if (compositeScore >= 70) tier = "Apply";
  else if (compositeScore >= 50) tier = "Maybe";
  else tier = "Skip";

  return {
    compositeScore,
    tier,
    gatePassApplied,
    dimensions: allDimensions,
  };
}
