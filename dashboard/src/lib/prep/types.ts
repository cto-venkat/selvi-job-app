/**
 * Shared types for the preparation pipeline.
 *
 * UserProfile lives here until scorer.ts is created, at which point
 * this re-export should point there instead.
 */

export type UserProfile = {
  name: string;
  email: string;
  phone?: string;
  location: string;
  rightToWork: string; // e.g. "British Citizen", "Pre-Settled Status", "Tier 2 Visa"
  noticePeriod: string; // e.g. "1 month", "Immediately available"
  salaryExpectation?: string; // e.g. "GBP 55,000 - 65,000"
  visaSponsorship: boolean;
  willingToRelocate: boolean;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  professionalSummary: string;
  experience: WorkExperience[];
  education: Education[];
  skills: string[];
  certifications?: string[];
  languages?: string[];
};

export type TailoredCV = {
  /** The job this CV was tailored for */
  jobId: string;
  /** Tailored professional summary */
  summary: string;
  /** Tailored work experience bullets (keyed by company-title) */
  experience: {
    company: string;
    title: string;
    bullets: string[];
  }[];
  /** Tailored skills list (reordered/filtered for relevance) */
  skills: string[];
  /** Optional tailored cover letter text */
  coverLetter?: string;
  /** Match score from the tailoring process */
  matchScore?: number;
};

export type ScreeningAnswer = {
  questionId: string;
  question: string;
  answer: string;
  /** Field type hint from the ATS form */
  fieldType?: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'number';
};

export type ScreeningAnswers = ScreeningAnswer[];

export type WorkExperience = {
  company: string;
  title: string;
  startDate: string; // YYYY-MM
  endDate?: string; // YYYY-MM or undefined for current
  location: string;
  bullets: string[];
  metrics?: string[]; // real, verified metrics only
};

export type Education = {
  institution: string;
  qualification: string; // e.g. "BSc Computer Science", "MSc Data Science"
  startDate: string;
  endDate?: string;
  grade?: string;
};
