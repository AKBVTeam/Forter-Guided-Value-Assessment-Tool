/**
 * Maps each calculator/benefit to a success story slide (1–16) from GVA Case Study Deck (1).
 * Slide numbers match the deck order. No entry or null = no story → Success Stories tab locked.
 * KYC (c14-kyc) has no success story and stays locked.
 *
 * Deck slide themes (for reference):
 *  1  Reduce false declines and approve more transactions
 *  2  Optimize payment funnel
 *  3  Reduce fraud chargebacks
 *  4  Reduce manual review workflow
 *  5  Increase chargeback recoveries
 *  6  Improve recovery efficiency (OpEx)
 *  7  Block/Disuade returns abusers
 *  8  Block/Disuade INR abusers
 *  9  Protect marketing budget against duplicate accounts
 * 10  Instant refunds CX uplift
 * 11  Reduced CS ticket handling OpEx
 * 12  Protect profitability from promotion abuse
 * 13  Reduction in ATO fraud
 * 14  Mitigate CLV loss due to ATO brand risk
 * 15  Protect marketing budget against duplicate accounts (alt)
 * 16  Reduce re-activation costs on fake accounts
 */
export const CASE_STUDY_SLIDE_BY_CALCULATOR: Record<string, number | undefined> = {
  // Payment fraud C1
  'c1-revenue': 1,       // Reduce false declines
  'c1-chargeback': 3,    // Reduce fraud chargebacks
  // Payment optimization C245
  'c245-revenue': 2,
  'c245-chargeback': 2,
  // Manual review C3
  'c3-review': 4,
  // Chargeback recovery C7
  'c7-disputes': 5,     // Increase chargeback recoveries
  'c7-opex': 6,         // Improve recovery efficiency (OpEx)
  // Returns & INR C8
  'c8-returns': 7,
  'c8-inr': 8,
  // Instant refunds C9
  'c9-cx-uplift': 10,
  'c9-cs-opex': 11,
  // Promotion abuse C10
  'c10-promotions': 12,
  // ATO C12-13
  'c12-ato-opex': 13,
  'c13-clv': 14,
  // Signup / new account C14-15
  'c14-marketing': 9,
  'c14-reactivation': 16,
  'c14-kyc': undefined, // No success story – tab stays locked
};

const CASE_STUDY_SLIDE_COUNT = 16;

export function getCaseStudySlideNumber(calculatorId: string): number | undefined {
  return CASE_STUDY_SLIDE_BY_CALCULATOR[calculatorId];
}

export function hasCaseStudy(calculatorId: string): boolean {
  const n = CASE_STUDY_SLIDE_BY_CALCULATOR[calculatorId];
  return typeof n === 'number' && n >= 1 && n <= CASE_STUDY_SLIDE_COUNT;
}

/** Public path for a case study slide image (slide1.png … slide16.png). */
export function getCaseStudyImagePath(calculatorId: string): string | undefined {
  const slide = getCaseStudySlideNumber(calculatorId);
  if (slide == null) return undefined;
  return `/case-studies/slide${slide}.png`;
}

/** All calculator IDs that have a case study (for PPTX Case Studies section). */
export function getCalculatorIdsWithCaseStudy(): string[] {
  return Object.entries(CASE_STUDY_SLIDE_BY_CALCULATOR)
    .filter(([, n]) => typeof n === 'number' && n >= 1 && n <= CASE_STUDY_SLIDE_COUNT)
    .map(([id]) => id);
}

/** Unique slide numbers that have a case study (for ordering Case Studies section). */
export function getCaseStudySlideNumbersInOrder(): number[] {
  const set = new Set(Object.values(CASE_STUDY_SLIDE_BY_CALCULATOR).filter((n): n is number => typeof n === 'number' && n >= 1 && n <= CASE_STUDY_SLIDE_COUNT));
  return Array.from(set).sort((a, b) => a - b);
}
