// Industry-based smart defaults for input fields
// These are typical benchmark values by industry that can be auto-populated

import { verticalBenchmarks, getVerticalApprovalRate } from "./benchmarkData";

export interface IndustryDefaults {
  // Approval rates
  preAuthApprovalRate?: number;
  postAuthApprovalRate?: number;
  issuingBankDeclineRate?: number;
  
  // 3DS
  creditCardPct?: number;
  threeDSChallengeRate?: number;
  threeDSAbandonmentRate?: number;
  
  // Chargebacks
  fraudCBRate?: number;
  serviceCBRate?: number;
  
  // Manual review
  manualReviewPct?: number;
  timePerReview?: number;
  
  // Abuse
  refundRate?: number;
  promotionAbuseCatchRate?: number;
  
  // Margin
  grossMarginPercent?: number;
}

// Industry-specific default values
const industryDefaultsMap: Record<string, IndustryDefaults> = {
  "Apparel": {
    preAuthApprovalRate: 99.5,
    creditCardPct: 65,
    threeDSChallengeRate: 8,
    threeDSAbandonmentRate: 18,
    fraudCBRate: 0.3,
    serviceCBRate: 0.15,
    manualReviewPct: 8,
    timePerReview: 4,
    refundRate: 18,
    promotionAbuseCatchRate: 25,
    grossMarginPercent: 50,
  },
  "Electronic Goods": {
    preAuthApprovalRate: 97.5,
    creditCardPct: 75,
    threeDSChallengeRate: 10,
    threeDSAbandonmentRate: 15,
    fraudCBRate: 0.5,
    serviceCBRate: 0.1,
    manualReviewPct: 12,
    timePerReview: 5,
    refundRate: 8,
    promotionAbuseCatchRate: 20,
    grossMarginPercent: 25,
  },
  "Gaming": {
    preAuthApprovalRate: 96,
    creditCardPct: 80,
    threeDSChallengeRate: 12,
    threeDSAbandonmentRate: 20,
    fraudCBRate: 0.7,
    serviceCBRate: 0.05,
    manualReviewPct: 15,
    timePerReview: 3,
    refundRate: 5,
    promotionAbuseCatchRate: 30,
    grossMarginPercent: 70,
  },
  "Financial Services": {
    preAuthApprovalRate: 95.5,
    creditCardPct: 40,
    threeDSChallengeRate: 20,
    threeDSAbandonmentRate: 12,
    fraudCBRate: 0.6,
    serviceCBRate: 0.05,
    manualReviewPct: 18,
    timePerReview: 8,
    refundRate: 3,
    promotionAbuseCatchRate: 35,
    grossMarginPercent: 60,
  },
  "OTA": {
    preAuthApprovalRate: 98,
    creditCardPct: 85,
    threeDSChallengeRate: 15,
    threeDSAbandonmentRate: 22,
    fraudCBRate: 0.4,
    serviceCBRate: 0.2,
    manualReviewPct: 10,
    timePerReview: 6,
    refundRate: 12,
    promotionAbuseCatchRate: 20,
    grossMarginPercent: 15,
  },
  "Ticket Brokers": {
    preAuthApprovalRate: 94,
    creditCardPct: 90,
    threeDSChallengeRate: 18,
    threeDSAbandonmentRate: 25,
    fraudCBRate: 0.8,
    serviceCBRate: 0.1,
    manualReviewPct: 20,
    timePerReview: 4,
    refundRate: 6,
    promotionAbuseCatchRate: 15,
    grossMarginPercent: 20,
  },
  "Jewelry & Watch": {
    preAuthApprovalRate: 99,
    creditCardPct: 70,
    threeDSChallengeRate: 12,
    threeDSAbandonmentRate: 15,
    fraudCBRate: 0.6,
    serviceCBRate: 0.08,
    manualReviewPct: 15,
    timePerReview: 7,
    refundRate: 10,
    promotionAbuseCatchRate: 25,
    grossMarginPercent: 45,
  },
  "Grocery": {
    preAuthApprovalRate: 99.5,
    creditCardPct: 55,
    threeDSChallengeRate: 5,
    threeDSAbandonmentRate: 12,
    fraudCBRate: 0.15,
    serviceCBRate: 0.2,
    manualReviewPct: 3,
    timePerReview: 2,
    refundRate: 8,
    promotionAbuseCatchRate: 30,
    grossMarginPercent: 25,
  },
  "Beauty": {
    preAuthApprovalRate: 99.5,
    creditCardPct: 60,
    threeDSChallengeRate: 7,
    threeDSAbandonmentRate: 16,
    fraudCBRate: 0.25,
    serviceCBRate: 0.12,
    manualReviewPct: 6,
    timePerReview: 3,
    refundRate: 12,
    promotionAbuseCatchRate: 25,
    grossMarginPercent: 55,
  },
  "Furniture": {
    preAuthApprovalRate: 99,
    creditCardPct: 65,
    threeDSChallengeRate: 8,
    threeDSAbandonmentRate: 14,
    fraudCBRate: 0.2,
    serviceCBRate: 0.15,
    manualReviewPct: 8,
    timePerReview: 5,
    refundRate: 10,
    promotionAbuseCatchRate: 20,
    grossMarginPercent: 40,
  },
};

// Generic defaults for industries not specifically mapped
const genericDefaults: IndustryDefaults = {
  preAuthApprovalRate: 98,
  creditCardPct: 70,
  threeDSChallengeRate: 10,
  threeDSAbandonmentRate: 18,
  fraudCBRate: 0.35,
  serviceCBRate: 0.12,
  manualReviewPct: 8,
  timePerReview: 4,
  refundRate: 10,
  promotionAbuseCatchRate: 25,
  grossMarginPercent: 35,
};

/**
 * Get industry-specific default values
 * Falls back to generic defaults if industry not found
 */
export const getIndustryDefaults = (industry: string): IndustryDefaults => {
  // First try exact match
  if (industryDefaultsMap[industry]) {
    return industryDefaultsMap[industry];
  }
  
  // Use the vertical benchmark approval rate if available
  const benchmarkRate = getVerticalApprovalRate(industry);
  if (benchmarkRate !== undefined) {
    return {
      ...genericDefaults,
      preAuthApprovalRate: benchmarkRate,
    };
  }
  
  return genericDefaults;
};

/**
 * Get all available industries that have specific defaults
 */
export const getIndustriesWithDefaults = (): string[] => {
  return Object.keys(industryDefaultsMap);
};

/**
 * Check if an industry has specific defaults configured
 */
export const hasIndustryDefaults = (industry: string): boolean => {
  return industry in industryDefaultsMap;
};
