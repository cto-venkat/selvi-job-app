/**
 * Greenhouse Job Board API integration.
 *
 * Builds request configs for the Greenhouse public job board API.
 * Does NOT make actual HTTP calls — returns objects ready for fetch().
 *
 * API docs: https://developers.greenhouse.io/job-board.html
 */

import type { UserProfile, TailoredCV, ScreeningAnswers } from '../prep/types';

export type GreenhouseRequestConfig = {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  /** Multipart form body — pass to fetch() as FormData or serialise manually */
  body?: Record<string, unknown>;
  /** When true, body should be sent as multipart/form-data (resume upload) */
  multipart: boolean;
};

export type GreenhousePayload = {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  location?: string;
  resume?: { content: string; filename: string; content_type: string };
  cover_letter?: string;
  linkedin_profile_url?: string;
  website_url?: string;
  custom_fields?: Record<string, string>;
};

/**
 * Build the Greenhouse apply endpoint URL.
 */
function applyUrl(boardToken: string, jobId: string): string {
  return `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs/${jobId}`;
}

/**
 * Split a full name into first + last. Handles single names gracefully.
 */
function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

/**
 * Build the POST body for the Greenhouse apply API.
 *
 * Returns a request config object — the caller is responsible for
 * constructing FormData and making the actual fetch() call.
 *
 * @param userProfile  The applicant's profile
 * @param tailoredCV   Tailored CV content (summary, bullets, cover letter)
 * @param screeningAnswers  Answers to screening questions
 * @param boardToken   The Greenhouse board token (company identifier)
 * @param jobId        The Greenhouse job ID
 */
export function buildGreenhousePayload(
  userProfile: UserProfile,
  tailoredCV: TailoredCV,
  screeningAnswers: ScreeningAnswers,
  boardToken: string,
  jobId: string
): GreenhouseRequestConfig {
  const { first, last } = splitName(userProfile.name);

  const payload: GreenhousePayload = {
    first_name: first,
    last_name: last,
    email: userProfile.email,
  };

  if (userProfile.phone) {
    payload.phone = userProfile.phone;
  }

  if (userProfile.location) {
    payload.location = userProfile.location;
  }

  if (tailoredCV.coverLetter) {
    payload.cover_letter = tailoredCV.coverLetter;
  }

  if (userProfile.linkedinUrl) {
    payload.linkedin_profile_url = userProfile.linkedinUrl;
  }

  // Greenhouse accepts one website URL — prefer portfolio, fall back to GitHub
  const websiteUrl = userProfile.portfolioUrl ?? userProfile.githubUrl;
  if (websiteUrl) {
    payload.website_url = websiteUrl;
  }

  // Map screening answers to custom fields keyed by question ID
  if (screeningAnswers.length > 0) {
    const customFields: Record<string, string> = {};
    for (const answer of screeningAnswers) {
      customFields[answer.questionId] = answer.answer;
    }
    payload.custom_fields = customFields;
  }

  return {
    url: applyUrl(boardToken, jobId),
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    body: payload as unknown as Record<string, unknown>,
    multipart: true,
  };
}

/**
 * Build the GET request config to fetch job details and screening questions.
 *
 * @param boardToken  The Greenhouse board token
 * @param jobId       The Greenhouse job ID
 */
export function getGreenhouseJobDetails(
  boardToken: string,
  jobId: string
): GreenhouseRequestConfig {
  return {
    url: `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs/${jobId}?questions=true`,
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    multipart: false,
  };
}
