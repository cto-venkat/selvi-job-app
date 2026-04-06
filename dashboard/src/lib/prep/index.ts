/**
 * Preparation Pipeline — re-exports all modules and defines
 * the combined PrepPackage type.
 */

// Types
export type { UserProfile, WorkExperience, Education } from "./types";
export type { JdAnalysis } from "./jd-analyzer";
export type { CompanyResearch } from "./company-researcher";
export type { TailoredCV, TailoredCVExperience, TailoredCVEducation } from "./cv-tailor";
export type { ScreeningAnswers, GeneratedAnswer } from "./screening-answers";

// Functions
export { buildJdAnalysisPrompt } from "./jd-analyzer";
export { buildCompanyResearchPrompt } from "./company-researcher";
export { buildCvTailoringPrompt } from "./cv-tailor";
export {
  getPrefilledAnswers,
  buildScreeningAnswerPrompt,
  COMMON_SCREENING_QUESTIONS,
} from "./screening-answers";

// Combined package
import type { JdAnalysis } from "./jd-analyzer";
import type { CompanyResearch } from "./company-researcher";
import type { TailoredCV } from "./cv-tailor";
import type { ScreeningAnswers } from "./screening-answers";

export type PrepPackage = {
  jobId: string;
  jdAnalysis: JdAnalysis;
  companyResearch: CompanyResearch;
  tailoredCV: TailoredCV;
  screeningAnswers: ScreeningAnswers;
  status: "draft" | "ready" | "submitted";
  createdAt: string;
};
