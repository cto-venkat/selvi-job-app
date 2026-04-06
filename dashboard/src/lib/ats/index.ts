/**
 * ATS detection and submission module.
 *
 * Re-exports all ATS-related types and functions, plus a convenience
 * function that detects the platform and returns the right tools.
 */

// Detector
export { detectAts } from './detector';
export type { AtsType, AtsDetectionResult } from './detector';

// Greenhouse
export {
  buildGreenhousePayload,
  getGreenhouseJobDetails,
} from './greenhouse';
export type { GreenhouseRequestConfig, GreenhousePayload } from './greenhouse';

// Lever
export { buildLeverPayload, getLeverPostingUrl } from './lever';
export type { LeverRequestConfig, LeverPayload } from './lever';

// Manual helper
export { buildCopyPastePackage } from './manual-helper';
export type { CopyPastePackage } from './manual-helper';

// Types re-exported for convenience
export type {
  UserProfile,
  TailoredCV,
  ScreeningAnswers,
} from '../prep/types';

// -------------------------------------------------------

import { detectAts } from './detector';
import type { AtsDetectionResult } from './detector';
import { buildGreenhousePayload, getGreenhouseJobDetails } from './greenhouse';
import { buildLeverPayload, getLeverPostingUrl } from './lever';
import { buildCopyPastePackage } from './manual-helper';

export type SubmissionStrategy = {
  detection: AtsDetectionResult;
  method: 'api' | 'playwright' | 'manual';
  /** Available functions for this platform — undefined means not applicable */
  api?: {
    buildPayload: typeof buildGreenhousePayload | typeof buildLeverPayload;
    getJobDetails: typeof getGreenhouseJobDetails | typeof getLeverPostingUrl;
  };
  manual?: {
    buildCopyPastePackage: typeof buildCopyPastePackage;
  };
};

/**
 * Detect the ATS from a URL and return the recommended submission
 * strategy along with the relevant module functions.
 */
export function getSubmissionStrategy(url: string): SubmissionStrategy {
  const detection = detectAts(url);

  const base: SubmissionStrategy = {
    detection,
    method: detection.submissionMethod,
  };

  switch (detection.platform) {
    case 'greenhouse':
      return {
        ...base,
        api: {
          buildPayload: buildGreenhousePayload,
          getJobDetails: getGreenhouseJobDetails,
        },
      };

    case 'lever':
      return {
        ...base,
        api: {
          buildPayload: buildLeverPayload,
          getJobDetails: getLeverPostingUrl,
        },
      };

    // Platforms that could use Playwright automation in future
    case 'ashby':
    case 'smartrecruiters':
      return {
        ...base,
        manual: { buildCopyPastePackage },
      };

    // Manual-only platforms
    case 'workday':
    case 'icims':
    case 'bamboohr':
    case 'indeed':
    case 'reed':
    case 'linkedin':
    case 'unknown':
    default:
      return {
        ...base,
        manual: { buildCopyPastePackage },
      };
  }
}
