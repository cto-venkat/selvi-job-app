/**
 * ATS platform detection from job URLs.
 *
 * Inspects URL patterns to determine which Applicant Tracking System
 * a job listing uses and whether API submission is available.
 */

export type AtsType =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'smartrecruiters'
  | 'workday'
  | 'icims'
  | 'bamboohr'
  | 'indeed'
  | 'reed'
  | 'linkedin'
  | 'unknown';

export type AtsDetectionResult = {
  platform: AtsType;
  /** Extracted company slug or identifier, if detectable */
  company?: string;
  /** Extracted job/posting ID, if detectable */
  jobId?: string;
  /** Whether the platform exposes a public application API */
  hasApi: boolean;
  /** Recommended submission approach */
  submissionMethod: 'api' | 'playwright' | 'manual';
};

type PatternDef = {
  platform: AtsType;
  match: (host: string, path: string) => { company?: string; jobId?: string } | null;
  hasApi: boolean;
  submissionMethod: 'api' | 'playwright' | 'manual';
};

const patterns: PatternDef[] = [
  // Greenhouse — two domain variants
  {
    platform: 'greenhouse',
    match: (host, path) => {
      const ghMatch = host.match(
        /^(?:job-boards|boards)\.greenhouse\.io$/
      );
      if (!ghMatch) return null;
      const parts = path.split('/').filter(Boolean);
      // /company/jobs/id or /company
      const company = parts[0];
      const jobId = parts.length >= 3 && parts[1] === 'jobs' ? parts[2] : undefined;
      return company ? { company, jobId } : null;
    },
    hasApi: true,
    submissionMethod: 'api',
  },

  // Lever
  {
    platform: 'lever',
    match: (host, path) => {
      if (host !== 'jobs.lever.co') return null;
      const parts = path.split('/').filter(Boolean);
      return parts[0]
        ? { company: parts[0], jobId: parts[1] }
        : null;
    },
    hasApi: true,
    submissionMethod: 'api',
  },

  // Ashby
  {
    platform: 'ashby',
    match: (host, path) => {
      if (host !== 'jobs.ashbyhq.com') return null;
      const parts = path.split('/').filter(Boolean);
      return parts[0]
        ? { company: parts[0], jobId: parts[1] }
        : null;
    },
    hasApi: false,
    submissionMethod: 'playwright',
  },

  // SmartRecruiters
  {
    platform: 'smartrecruiters',
    match: (host, path) => {
      if (host !== 'jobs.smartrecruiters.com') return null;
      const parts = path.split('/').filter(Boolean);
      return parts[0]
        ? { company: parts[0], jobId: parts[1] }
        : null;
    },
    hasApi: false,
    submissionMethod: 'playwright',
  },

  // Workday — {company}.wd{1-5}.myworkdayjobs.com
  {
    platform: 'workday',
    match: (host) => {
      const m = host.match(/^(.+?)\.wd[1-5]\.myworkdayjobs\.com$/);
      return m ? { company: m[1] } : null;
    },
    hasApi: false,
    submissionMethod: 'manual',
  },

  // iCIMS — careers-{company}.icims.com or {company}.icims.com
  {
    platform: 'icims',
    match: (host) => {
      const m = host.match(/^(?:careers-)?(.+?)\.icims\.com$/);
      return m ? { company: m[1] } : null;
    },
    hasApi: false,
    submissionMethod: 'manual',
  },

  // BambooHR
  {
    platform: 'bamboohr',
    match: (host) => {
      const m = host.match(/^(.+?)\.bamboohr\.com$/);
      return m ? { company: m[1] } : null;
    },
    hasApi: false,
    submissionMethod: 'manual',
  },

  // Indeed (UK-centric)
  {
    platform: 'indeed',
    match: (host) => {
      if (host === 'indeed.co.uk' || host === 'www.indeed.co.uk') return {};
      if (host === 'uk.indeed.com') return {};
      return null;
    },
    hasApi: false,
    submissionMethod: 'manual',
  },

  // Reed
  {
    platform: 'reed',
    match: (host) => {
      if (host === 'reed.co.uk' || host === 'www.reed.co.uk') return {};
      return null;
    },
    hasApi: false,
    submissionMethod: 'manual',
  },

  // LinkedIn
  {
    platform: 'linkedin',
    match: (host, path) => {
      if (
        (host === 'linkedin.com' || host === 'www.linkedin.com') &&
        path.startsWith('/jobs')
      ) {
        return {};
      }
      return null;
    },
    hasApi: false,
    submissionMethod: 'manual',
  },
];

/**
 * Detect the ATS platform from a job posting URL.
 *
 * Returns the platform type, any extractable company/job identifiers,
 * whether the platform has a public API, and the recommended submission method.
 */
export function detectAts(url: string): AtsDetectionResult {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      platform: 'unknown',
      hasApi: false,
      submissionMethod: 'manual',
    };
  }

  const host = parsed.hostname.replace(/^www\./, '');
  const path = parsed.pathname;

  for (const pattern of patterns) {
    const result = pattern.match(host, path);
    if (result !== null) {
      return {
        platform: pattern.platform,
        company: result.company,
        jobId: result.jobId,
        hasApi: pattern.hasApi,
        submissionMethod: pattern.submissionMethod,
      };
    }
  }

  return {
    platform: 'unknown',
    hasApi: false,
    submissionMethod: 'manual',
  };
}
