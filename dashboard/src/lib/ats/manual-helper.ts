/**
 * Manual application helper for portals without API support.
 *
 * Generates a structured "copy-paste package" — all applicant data
 * organised by common form field names so the user can quickly copy
 * values into Workday, iCIMS, Indeed, LinkedIn, or any unknown portal.
 */

import type { UserProfile, TailoredCV, ScreeningAnswers } from '../prep/types';

export type CopyPastePackage = {
  personal: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    postcode: string;
  };
  professional: {
    currentJobTitle: string;
    employer: string;
    yearsExperience: number;
    noticePeriod: string;
  };
  links: {
    linkedin: string;
    github: string;
    portfolio: string;
  };
  content: {
    professionalSummary: string;
    workExperience: string[];
    education: string;
    skills: string;
  };
  answers: Record<string, string>;
  salary: {
    expectedSalary: string;
    currentSalary: string;
  };
};

/**
 * Parse location string into city / postcode components.
 * Common UK formats: "London", "Manchester, M1 2AB", "Bristol BS1 4DJ"
 */
function parseLocation(location: string): { city: string; postcode: string } {
  // Try to extract UK postcode (e.g. SW1A 1AA, M1 2AB, BS1 4DJ)
  const postcodeRegex = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;
  const postcodeMatch = location.match(postcodeRegex);
  const postcode = postcodeMatch ? postcodeMatch[1].toUpperCase() : '';

  // Remove postcode and punctuation to get city
  const city = location
    .replace(postcodeRegex, '')
    .replace(/[,\s]+$/, '')
    .replace(/^\s*,\s*/, '')
    .trim();

  return { city: city || location, postcode };
}

/**
 * Split full name into first and last.
 */
function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

/**
 * Estimate total years of experience from the work history.
 */
function estimateYearsExperience(
  experience: UserProfile['experience']
): number {
  if (experience.length === 0) return 0;

  const dates = experience.map((exp) => {
    const start = new Date(exp.startDate + '-01');
    const end = exp.endDate ? new Date(exp.endDate + '-01') : new Date();
    return { start, end };
  });

  // Sort by start date
  dates.sort((a, b) => a.start.getTime() - b.start.getTime());

  // Merge overlapping periods
  const merged: { start: Date; end: Date }[] = [];
  for (const d of dates) {
    const last = merged[merged.length - 1];
    if (last && d.start <= last.end) {
      last.end = d.end > last.end ? d.end : last.end;
    } else {
      merged.push({ start: d.start, end: d.end });
    }
  }

  const totalMs = merged.reduce(
    (sum, d) => sum + (d.end.getTime() - d.start.getTime()),
    0
  );
  return Math.round(totalMs / (1000 * 60 * 60 * 24 * 365.25));
}

/**
 * Format a single work experience entry as readable text for copy-paste.
 */
function formatWorkEntry(
  exp: UserProfile['experience'][number]
): string {
  const endLabel = exp.endDate ?? 'Present';
  const lines = [
    `${exp.title} — ${exp.company}`,
    `${exp.startDate} to ${endLabel} | ${exp.location}`,
    ...exp.bullets.map((b) => `• ${b}`),
  ];
  return lines.join('\n');
}

/**
 * Build a structured copy-paste package from the user's profile and
 * tailored CV data. Every field is a plain string ready to paste into
 * a form input.
 */
export function buildCopyPastePackage(
  userProfile: UserProfile,
  tailoredCV: TailoredCV,
  screeningAnswers: ScreeningAnswers
): CopyPastePackage {
  const { first, last } = splitName(userProfile.name);
  const { city, postcode } = parseLocation(userProfile.location);

  // Current / most recent role
  const currentRole = userProfile.experience[0];

  // Format work experience — use tailored bullets where available
  const workExperience = userProfile.experience.map((exp) => {
    const tailored = tailoredCV.experience.find(
      (t) => t.company === exp.company && t.title === exp.title
    );
    if (tailored) {
      return formatWorkEntry({ ...exp, bullets: tailored.bullets });
    }
    return formatWorkEntry(exp);
  });

  // Education as a single text block
  const education = userProfile.education
    .map((edu) => {
      const period = edu.endDate
        ? `${edu.startDate} – ${edu.endDate}`
        : `${edu.startDate} – Present`;
      const grade = edu.grade ? ` (${edu.grade})` : '';
      return `${edu.qualification}${grade} — ${edu.institution}, ${period}`;
    })
    .join('\n');

  // Skills as comma-separated (tailored order preferred)
  const skills = tailoredCV.skills.join(', ');

  // Screening answers as key-value pairs
  const answers: Record<string, string> = {};
  for (const a of screeningAnswers) {
    answers[a.question] = a.answer;
  }

  return {
    personal: {
      firstName: first,
      lastName: last,
      email: userProfile.email,
      phone: userProfile.phone ?? '',
      address: userProfile.location,
      city,
      postcode,
    },
    professional: {
      currentJobTitle: currentRole?.title ?? '',
      employer: currentRole?.company ?? '',
      yearsExperience: estimateYearsExperience(userProfile.experience),
      noticePeriod: userProfile.noticePeriod,
    },
    links: {
      linkedin: userProfile.linkedinUrl ?? '',
      github: userProfile.githubUrl ?? '',
      portfolio: userProfile.portfolioUrl ?? '',
    },
    content: {
      professionalSummary: tailoredCV.summary,
      workExperience,
      education,
      skills,
    },
    answers,
    salary: {
      expectedSalary: userProfile.salaryExpectation ?? '',
      currentSalary: '',
    },
  };
}
