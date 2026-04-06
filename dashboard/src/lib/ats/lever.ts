/**
 * Lever Postings API integration.
 *
 * Builds request configs for the Lever public postings API.
 * Does NOT make actual HTTP calls — returns objects ready for fetch().
 *
 * API docs: https://github.com/lever/postings-api
 * Rate limit: 2 POST requests per second.
 */

import type { UserProfile, TailoredCV, ScreeningAnswers } from '../prep/types';

export type LeverRequestConfig = {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  /** Form body — should be sent as multipart/form-data */
  body?: Record<string, unknown>;
  multipart: boolean;
  /** Lever rate-limits POST to 2/sec — callers should respect this */
  rateLimitNote?: string;
};

export type LeverPayload = {
  name: string;
  email: string;
  phone?: string;
  org?: string;
  urls?: Record<string, string>;
  comments?: string;
  resume?: { content: string; filename: string; content_type: string };
  cards?: Record<string, string>;
};

/**
 * Build the POST body for the Lever apply API.
 *
 * The Lever postings API accepts multipart form data with name, email,
 * resume, and optional fields. Screening question answers map to "cards".
 *
 * @param userProfile       The applicant's profile
 * @param tailoredCV        Tailored CV content
 * @param screeningAnswers  Answers to screening questions
 * @param site              The Lever site slug (company identifier)
 * @param postingId         The Lever posting ID
 */
export function buildLeverPayload(
  userProfile: UserProfile,
  tailoredCV: TailoredCV,
  screeningAnswers: ScreeningAnswers,
  site: string,
  postingId: string
): LeverRequestConfig {
  const payload: LeverPayload = {
    name: userProfile.name,
    email: userProfile.email,
  };

  if (userProfile.phone) {
    payload.phone = userProfile.phone;
  }

  // Collect URLs — Lever accepts multiple named URLs
  const urls: Record<string, string> = {};
  if (userProfile.linkedinUrl) urls['LinkedIn'] = userProfile.linkedinUrl;
  if (userProfile.githubUrl) urls['GitHub'] = userProfile.githubUrl;
  if (userProfile.portfolioUrl) urls['Portfolio'] = userProfile.portfolioUrl;
  if (Object.keys(urls).length > 0) {
    payload.urls = urls;
  }

  // Use cover letter or professional summary as the comments field
  if (tailoredCV.coverLetter) {
    payload.comments = tailoredCV.coverLetter;
  }

  // Map screening answers to Lever "cards"
  if (screeningAnswers.length > 0) {
    const cards: Record<string, string> = {};
    for (const answer of screeningAnswers) {
      cards[answer.questionId] = answer.answer;
    }
    payload.cards = cards;
  }

  return {
    url: `https://api.lever.co/v0/postings/${site}/${postingId}`,
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    body: payload as unknown as Record<string, unknown>,
    multipart: true,
    rateLimitNote: 'Lever limits POST requests to 2 per second',
  };
}

/**
 * Build the URL to fetch posting details (job description, questions, etc.).
 *
 * @param site       The Lever site slug
 * @param postingId  The Lever posting ID
 */
export function getLeverPostingUrl(
  site: string,
  postingId: string
): LeverRequestConfig {
  return {
    url: `https://api.lever.co/v0/postings/${site}/${postingId}`,
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    multipart: false,
  };
}
