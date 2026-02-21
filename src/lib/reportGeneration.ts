/**
 * Report Generation Service
 * Generates Executive Summary (DOCX) and Value Assessment Deck (PPTX)
 * Uses dynamic imports to avoid React version conflicts
 */
import { CalculatorData } from '@/pages/Index';
import { ValueTotals } from '@/components/calculator/ValueSummaryOptionA';
import { ROIResults } from '@/lib/roiCalculations';
import { getCurrencySymbol } from '@/lib/benchmarkData';
import { StrategicObjectiveId, STRATEGIC_OBJECTIVES, USE_CASES } from '@/lib/useCaseMapping';
import { getChallengeBenefitContent } from '@/lib/challengeBenefitContent';
import { getCaseStudySlideNumbersInOrder, hasCaseStudy, getCaseStudySlideNumber } from '@/lib/caseStudyMapping';
import { 
  calculateChallenge1, 
  calculateChallenge245, 
  calculateChallenge3,
  calculateChallenge7,
  calculateChallenge8,
  calculateChallenge9,
  calculateChallenge10,
  calculateChallenge12_13,
  calculateChallenge14_15,
  CalculatorRow,
  defaultDeduplicationAssumptions 
} from '@/lib/calculations';
import { getGmvToNetSalesDeductionPct } from '@/lib/gmvToNetSalesDeductionByCountry';

// Forter brand design system (hex without #)
const NAVY = '0D1B3E';       // slide titles, table headers, dark backgrounds
const BLUE = '2563EB';      // accents, section labels, Forter improvement col header
const GREEN = '16A34A';     // positive values, uplift figures
const RED = 'DC2626';       // negative values, cost figures
const GRAY = '6B7280';      // body text, subtitles, footers
const LIGHT_BG = 'F5F7FA';  // content slide background
const WHITE = 'FFFFFF';
const CARD_BG = 'FFFFFF';   // white cards
const GREEN_FILL = 'D1FAE5'; // value driver row highlight fill
const GREEN_TEXT = '065F46'; // value driver row highlight text
const AMBER = 'F59E0B';     // warning accents
const ALT_ROW = 'F9FAFB';   // alternating table row

// Legacy aliases for DOCX and generateCalculatorSlide (same hex values)
const FORTER_BLUE = BLUE;
const FORTER_NAVY = NAVY;
const FORTER_DARK = NAVY;
const FORTER_GRAY = GRAY;
const FORTER_LIGHT_BG = LIGHT_BG;
const FORTER_LIGHT_GRAY = ALT_ROW;
const FORTER_WHITE = WHITE;
const FORTER_GREEN = GREEN;

// Forter white logo (base64 PNG) for title slide and footer
const FORTER_LOGO_B64 = 'iVBORw0KGgoAAAANSUhEUgAAA8YAAADiCAYAAACMRN58AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAANLFJREFUeNrsnetV3EgThuXv+L/ZCCxH4CECiwgMEXgmAkMEQAQMETCOABwBIgIPEViOYMcR7KaCml3t7Fy6W7e+PM85OvgidGn1pd6u6uosAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAvnlDEQDANv7666/C4LTlmzdvVpQWAAAAACCMASBE4ZvXPyZ6vK+PvHHYIuJ4WR9VffyqjxLRDAAAAAAIYwDwTQgX9Q85PqkYPhrgtpWK5Kf6eEAoAwAAAADCGACGFMJ5/eNUhfCpJ48lXuVvKpIrvhIAAAAAIIwBoC8x/CV79Qr7TCkiuRbIC74cAAAAACCMAaCtIJ7WPz5n/niGbZDw6tv6mBNqDQAAAAAI4+FEhHjSbvj80XNRC61lxPU4r3+IIP6aDbNeGIFMPzMEVfaawK359+plwHrzpmRMgmQMtDdvTizq0CMlhl2zo25I3zKh6KyRcv7d+Pt6/KlYCoYwjs0IETFxx+ePnpMYDWkVxJcqimMkCoFcf6dzxE5vlFpPntV4qUKeBNPEeAgb2BTGbyzq0F+UGHbNjrohfUtB0fViq7AbR2S8TfS9cz59ElSRCWIZ2MQ7bBIuvR441zOe6w68aXSVO+7RZP33j9mrV3qIwfVIhf+X+nlkdvwh0E92RBPsjXU9PG3U3XW9l3ouWdDLgAwUvDngPH5pxAGkgcsEIKK4vzG+WbaX2h6rjXFoSVEhjH3nHZ8+fmIJdak7Wel8xfM43fivVaPzrfRoNVu5RSxvE8959jq5JANCn1s/yT3u6/uJMJ4FOAv7nlY4imCW41zrqrSP79lrFnSfjRMmUcBZGFN/krJr8Eb6z9pGOtVxaKW21HosSuYbqrNlXR5NvI30SjWUmrCSBIyKusF9iKS+Sodyl/0TOlpmnoXrqMdC2tTnntrWSsXxQ0DfjX7GP6Eh9efWt0mzuq7cZ2EmzoP+EAP6zLD+TDOWh2HX7B6bf1B0frXtWEWyOnJOM/NksCstj2++LH38H/UTIjaCo0CMeEnCIkZSfVxJ5+FbZyqzfvUx12Qxf4iI1c6uK6SzFe/xnXa8IYAXxy/y7NWT/LOuQz9UTFBXwFeeLes2YNfQt4SBCMY7HYvuYlgKIXZZfVzJO+m7nVrUTxmLH8WZsGU5H8J4IAraZfQQbjSeSF7J3sTq7RCRfNHhRMW6Aw3BEGTdn9/fRgySP2Uw92CyBWEDbWB5GMKYviU81qLwhy+i0FEUn6ogvsz+OxEjdbasj3l9XOtR7qjLhdp3oyYtxWMMsfJMEXgjkuca/iXe5EVHouaHz7OsAXm1MUxeB/OfIwtkjFfYpLTsEyF+ftG3RMtaFAYjkNVLLN7h+w1BXKkA/iC2n0Y8XmnE45X+XWxCObY5Ts61HEYZj5MTxmRvBBhNJEsI+Ew7w7YC+UgHkamnr0s/E6ZAHjzEmkkU6Kj+Qvy4RMIRTRCuQM59FsXZ6xaD0436OVMxfHUol4cuE1w7Tq63lMM9wpgBBLqjpAi8FchVQyA/tGzLdx6LYwiPXOvUkEYJkyiwrZ8sqUOwgUsGX+pGuAL5p67b9VUUN+vWInv1EC8c+zt5z+Ps35M/xRhh1SkKYzoJSA4x8iU8p3HkYz+TCmRZhywh1lWLS/mojgtqXfBGyQ8mXQAgcHAGhc2lJovMfXiYHaJYvMStt9TUrZs+bIjj84FDy9/SSUCkRLuhui4HkHqc6/Fuo5MqDK+z+U+rRrnJz9/ZAHvNqWfkg86MXrYQx5nrbCXAjrFC6pXs1X3RYyb4gqIG1/Er1IQ94DxW2oIzKHzWeVUuPLBx7raI4sVGn3Rl0sdt275Txtn694VZ0txiTOzCcqgXTFEYv6eNJTGABJ2VWmflJnq8159rIdynECi2Gesqopd6PEkn1fVesBJKU99HOsp7x/cUEVN5shfeR1phNEyl/dV168y3';

// Report generation options
export interface ReportOptions {
  selectedObjectives: StrategicObjectiveId[];
  hasInvestment: boolean;
  companyLogoBase64?: string; // Optional base64-encoded logo image
}

// Format date as MMDDYY for filenames
function formatDateMMDDYY(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  return `${mm}${dd}${yy}`;
}

/** Encode ArrayBuffer to base64 in chunks to avoid "too many arguments" for large images. */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

// Currency formatting helper
function formatCurrency(value: number, currencyCode: string = 'USD', inMillions: boolean = false): string {
  const symbol = getCurrencySymbol(currencyCode);
  const absValue = Math.abs(value);
  
  if (inMillions && absValue >= 1000000) {
    return `${symbol}${(value / 1000000).toFixed(1)}M`;
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Check if calculator rows indicate TBD status (missing required inputs)
 * A calculator is TBD if:
 * - All value driver rows have $0 or empty values
 * - Key input rows show 0 or missing data
 */
function isCalculatorTBD(rows: CalculatorRow[]): boolean {
  // Find value driver rows and check if they have actual calculated values
  const valueDriverRows = rows.filter(row => row.valueDriver);
  
  if (valueDriverRows.length === 0) {
    // No value driver rows = something is wrong, treat as TBD
    return true;
  }
  
  // Check if ALL value driver rows have zero or no improvement
  const allZeroOrEmpty = valueDriverRows.every(row => {
    if (!row.forterImprovement) return true;
    // Extract numeric value - handle formats like "$0", "0", "$0.00", "(0)"
    const numericStr = row.forterImprovement.replace(/[^0-9.-]/g, '');
    const numericValue = parseFloat(numericStr);
    return isNaN(numericValue) || numericValue === 0;
  });
  
  return allZeroOrEmpty;
}

// Challenge descriptions for problem statements and slides
// Use the exact labels from ValueSummaryOptionA.tsx to maintain consistency
// 'benefitName' is used as the appendix slide title - these must match the tool exactly

// Mapping from calculatorId to exact label and challenge ID used in ValueSummaryOptionA
const CALCULATOR_ID_TO_LABEL: Record<string, { label: string; challengeIds: string[] }> = {
  'c1-revenue': { label: 'Reduce false declines and approve more transactions', challengeIds: ['1'] },
  'c1-chargeback': { label: 'Reduce fraud chargebacks', challengeIds: ['1'] },
  'c245-revenue': { label: 'Optimize payment funnel', challengeIds: ['2', '4', '5'] },
  'c245-chargeback': { label: 'Reduce fraud chargebacks', challengeIds: ['2', '4', '5'] },
  'c3-review': { label: 'Reduce manual review costs', challengeIds: ['3'] },
  'c7-disputes': { label: 'Increase chargeback recoveries', challengeIds: ['7'] },
  'c7-opex': { label: 'Improve recovery efficiency (OpEx)', challengeIds: ['7'] },
  'c8-returns': { label: 'Block returns abusers', challengeIds: ['8'] },
  'c8-inr': { label: 'Block INR abusers', challengeIds: ['8'] },
  'c9-cx-uplift': { label: 'Instant refunds CX uplift', challengeIds: ['9'] },
  'c9-cs-opex': { label: 'Reduced CS ticket handling', challengeIds: ['9'] },
  'c10-promotions': { label: 'Protect profitability from promotion abuse', challengeIds: ['10', '11'] },
  'c12-ato-opex': { label: 'ATO protection OpEx savings', challengeIds: ['12', '13'] },
  'c13-clv': { label: 'Mitigate CLV loss from ATO churn', challengeIds: ['12', '13'] },
  'c14-marketing': { label: 'Protect marketing budget', challengeIds: ['14', '15'] },
  'c14-reactivation': { label: 'Reduce re-activation costs', challengeIds: ['14', '15'] },
  'c14-kyc': { label: 'Optimize KYC costs', challengeIds: ['14', '15'] },
};

// Group calculators by logical benefit groupings for appendix slides
// Each group represents a single appendix slide with all related calculators
interface BenefitGroup {
  id: string;
  title: string; // Slide title - matches tool terminology
  calculatorIds: string[];
  problem: string;
  solution: string;
  benefit: string;
}

const BENEFIT_GROUPS: BenefitGroup[] = [
  {
    id: 'payment-fraud-c1',
    title: 'Reduce false declines and approve more transactions',
    calculatorIds: ['c1-revenue', 'c1-chargeback'],
    problem: 'Revenue lost to false fraud declines',
    solution: 'Approve more good customers instantly with AI-powered fraud decisioning',
    benefit: 'Increase approval rates without increasing fraud risk',
  },
  {
    id: 'payment-optimization-c245',
    title: 'Optimize payment funnel',
    calculatorIds: ['c245-revenue', 'c245-chargeback'],
    problem: 'Payment friction and 3DS challenges causing cart abandonment',
    solution: 'Apply 3DS exemptions intelligently based on transaction risk',
    benefit: 'Reduce 3DS challenges while maintaining strong authentication',
  },
  {
    id: 'manual-review-c3',
    title: 'Reduce manual review costs',
    calculatorIds: ['c3-review'],
    problem: 'Manual review bottlenecks consuming operational resources',
    solution: 'Automate fraud decisions to free up review teams',
    benefit: 'Reduce manual review volume and improve operational efficiency',
  },
  {
    id: 'chargeback-recovery-c7',
    title: 'Chargeback recovery',
    calculatorIds: ['c7-disputes', 'c7-opex'],
    problem: 'Low chargeback dispute recovery rates',
    solution: 'Automated dispute management with AI-powered evidence',
    benefit: 'Improve win rates and recover more revenue',
  },
  {
    id: 'returns-abuse-c8',
    title: 'Returns & INR abuse prevention',
    calculatorIds: ['c8-returns', 'c8-inr'],
    problem: 'Returns and INR abuse eroding profit margins',
    solution: 'Detect and prevent policy abuse at the point of action',
    benefit: 'Protect margins from abusive return behavior',
  },
  {
    id: 'instant-refunds-c9',
    title: 'Instant refunds',
    calculatorIds: ['c9-cx-uplift', 'c9-cs-opex'],
    problem: 'Delayed refund processes hurting customer experience',
    solution: 'Enable instant refunds for trusted customers',
    benefit: 'Improve NPS and reduce support costs',
  },
  {
    id: 'promotion-abuse-c10',
    title: 'Protect profitability from promotion abuse',
    calculatorIds: ['c10-promotions'],
    problem: 'Promotion and coupon abuse draining marketing budgets',
    solution: 'Identify serial abusers and block misuse in real-time',
    benefit: 'Protect promotional ROI and marketing spend',
  },
  {
    id: 'ato-protection-c12-13',
    title: 'Account takeover protection',
    calculatorIds: ['c12-ato-opex', 'c13-clv'],
    problem: 'Account takeover attacks causing remediation costs and customer churn',
    solution: 'Block account takeovers at login and transaction',
    benefit: 'Protect customers and reduce ATO remediation costs',
  },
  {
    id: 'signup-protection-c14-15',
    title: 'New account fraud protection',
    calculatorIds: ['c14-marketing', 'c14-reactivation', 'c14-kyc'],
    problem: 'Fake account creation wasting acquisition and KYC spend',
    solution: 'Block fake accounts at registration',
    benefit: 'Protect acquisition costs and maintain data quality',
  },
];

// Helper to get benefit groups that are active based on selected challenges
// CRITICAL: Replicates the UI logic where C1 is hidden when C245 is selected
function getActiveBenefitGroups(challenges: Record<string, boolean>): BenefitGroup[] {
  const isChallenge1Selected = challenges['1'];
  const isChallenge245Selected = challenges['2'] || challenges['4'] || challenges['5'];
  
  return BENEFIT_GROUPS.filter(group => {
    // OVERRIDE LOGIC: C1 is only shown if C245 is NOT selected
    // This matches the UI behavior in ValueSummaryOptionA.tsx
    if (group.id === 'payment-fraud-c1') {
      return isChallenge1Selected && !isChallenge245Selected;
    }
    
    // Check if any calculator in this group has an active challenge
    return group.calculatorIds.some(calcId => {
      const mapping = CALCULATOR_ID_TO_LABEL[calcId];
      if (!mapping) return false;
      return mapping.challengeIds.some(cid => challenges[cid]);
    });
  });
}

// Get ALL active value drivers sorted by value contribution (no limit)
function getAllValueDrivers(
  challenges: Record<string, boolean>,
  valueTotals: ValueTotals
): Array<{ id: string; label: string; value: number }> {
  const drivers: Array<{ id: string; label: string; value: number }> = [];
  
  // Combine all breakdowns
  const allBreakdown = [
    ...(valueTotals.gmvUpliftBreakdown || []),
    ...(valueTotals.costReductionBreakdown || []),
    ...(valueTotals.riskMitigationBreakdown || []),
  ];
  
  // Only include drivers that have value
  allBreakdown.forEach(b => {
    if (b.value > 0) {
      drivers.push({
        id: b.label,
        label: b.label,
        value: b.value,
      });
    }
  });
  
  // Sort by value descending - return ALL drivers
  return drivers.sort((a, b) => b.value - a.value);
}

// Map calculatorIds to their breakdown label keywords for matching
const CALCULATOR_ID_TO_KEYWORDS: Record<string, string[]> = {
  'c1-revenue': ['false decline', 'approve more'],
  'c1-chargeback': ['fraud chargeback'],
  'c245-revenue': ['payment funnel', 'optimize payment'],
  'c245-chargeback': ['fraud chargeback'],
  'c3-review': ['manual review'],
  'c7-disputes': ['chargeback recover', 'increase chargeback'],
  'c7-opex': ['recovery efficiency', 'opex'],
  'c8-returns': ['return', 'returns abuser'],
  'c8-inr': ['inr', 'item not received'],
  'c9-cx-uplift': ['instant refund', 'cx uplift'],
  'c9-cs-opex': ['cs ticket', 'cs handling'],
  'c10-promotions': ['promotion', 'profitability'],
  'c12-ato-opex': ['ato', 'opex'],
  'c13-clv': ['clv', 'churn'],
  'c14-marketing': ['marketing budget'],
  'c14-reactivation': ['re-activation', 'reactivation'],
  'c14-kyc': ['kyc'],
};

// Get all value drivers for a benefit group
function getValueDriversForBenefitGroup(
  group: BenefitGroup,
  valueTotals: ValueTotals
): Array<{ label: string; value: number }> {
  const allBreakdown = [
    ...(valueTotals.gmvUpliftBreakdown || []),
    ...(valueTotals.costReductionBreakdown || []),
    ...(valueTotals.riskMitigationBreakdown || []),
  ];
  
  // Collect keywords from all calculators in this group
  const keywords: string[] = [];
  group.calculatorIds.forEach(calcId => {
    const calcKeywords = CALCULATOR_ID_TO_KEYWORDS[calcId] || [];
    keywords.push(...calcKeywords);
  });
  
  // Also match by exact label from CALCULATOR_ID_TO_LABEL
  const exactLabels = group.calculatorIds
    .map(cid => CALCULATOR_ID_TO_LABEL[cid]?.label.toLowerCase())
    .filter(Boolean);
  
  return allBreakdown.filter(b => {
    const label = b.label.toLowerCase();
    // Match either by keyword or exact label match
    return keywords.some(keyword => label.includes(keyword)) ||
           exactLabels.some(exactLabel => label.includes(exactLabel!) || exactLabel!.includes(label));
  });
}

// Generate calculator rows for a benefit group based on form data
function getCalculatorRowsForBenefitGroup(
  group: BenefitGroup,
  formData: CalculatorData,
  includesFraudCBCoverage: boolean = false
): { title: string; rows: CalculatorRow[] }[] {
  const calculators: { title: string; rows: CalculatorRow[] }[] = [];
  const currencyCode = formData.baseCurrency || 'USD';
  const forterKPIs: Record<string, number> = (formData.forterKPIs || {}) as Record<string, number>;
  const abuseBenchmarks: Record<string, number> = (formData.abuseBenchmarks || {}) as Record<string, number>;
  
  try {
    if (group.id === 'payment-fraud-c1') {
      // Challenge 1: False declines
      const result = calculateChallenge1({
        transactionAttempts: formData.amerGrossAttempts || 0,
        transactionAttemptsValue: formData.amerAnnualGMV || 0,
        grossMarginPercent: formData.amerGrossMarginPercent || 30,
        approvalRate: formData.amerPreAuthApprovalRate || 95,
        fraudChargebackRate: formData.fraudCBRate || 0.5,
        isMarketplace: formData.isMarketplace || false,
        commissionRate: formData.commissionRate || 100,
        currencyCode,
        completedAOV: formData.completedAOV,
        forterCompletedAOV: forterKPIs.forterCompletedAOV,
        recoveredAovMultiplier: forterKPIs.recoveredAovMultiplier ?? 1.15,
        forterApprovalRateImprovement: forterKPIs.approvalRateImprovement || 2,
        forterChargebackReduction: forterKPIs.chargebackReduction || 50,
        deduplication: defaultDeduplicationAssumptions,
      });
      calculators.push({ title: 'Reduce false declines', rows: result.calculator1.rows });
      calculators.push({ title: 'Reduce fraud chargebacks', rows: result.calculator2.rows });
    }
    
    if (group.id === 'payment-optimization-c245') {
      // Challenge 2/4/5: Payment optimization
      const result = calculateChallenge245({
        transactionAttempts: formData.amerGrossAttempts || 0,
        transactionAttemptsValue: formData.amerAnnualGMV || 0,
        grossMarginPercent: formData.amerGrossMarginPercent || 30,
        preAuthApprovalRate: formData.amerPreAuthApprovalRate || 95,
        postAuthApprovalRate: formData.amerPostAuthApprovalRate || 98,
        creditCardPct: formData.amerCreditCardPct || 60,
        creditCard3DSPct: formData.amer3DSChallengeRate || 20,
        threeDSFailureRate: formData.amer3DSAbandonmentRate || 15,
        issuingBankDeclineRate: formData.amerIssuingBankDeclineRate || 5,
        fraudChargebackRate: formData.fraudCBRate || 0.5,
        isMarketplace: formData.isMarketplace || false,
        commissionRate: formData.commissionRate || 100,
        currencyCode,
        completedAOV: formData.completedAOV,
        forterCompletedAOV: forterKPIs.forterCompletedAOV,
        recoveredAovMultiplier: forterKPIs.recoveredAovMultiplier ?? 1.15,
        forterPreAuthImprovement: forterKPIs.preAuthApprovalImprovement || 2,
        forterPostAuthImprovement: forterKPIs.postAuthApprovalImprovement || 1,
        forter3DSReduction: forterKPIs.threeDSReduction || 50,
        forterChargebackReduction: forterKPIs.chargebackReduction || 50,
        forterTargetCBRate: forterKPIs.targetCBRate || 0.25,
        deduplication: defaultDeduplicationAssumptions,
      });
      calculators.push({ title: 'Optimize payment funnel', rows: result.calculator1.rows });
      calculators.push({ title: 'Reduce fraud chargebacks', rows: result.calculator2.rows });
    }
    
    if (group.id === 'manual-review-c3') {
      // Challenge 3: Manual review
      const result = calculateChallenge3({
        transactionAttempts: formData.amerGrossAttempts || 0,
        manualReviewPct: formData.amerManualReviewRate || formData.manualReviewPct || 5,
        timePerReview: formData.timePerReview || 5,
        hourlyReviewerCost: formData.hourlyReviewerCost || 25,
        forterReviewReduction: forterKPIs.manualReviewReduction || 80,
        forterTimeReduction: forterKPIs.reviewTimeReduction || 50,
        currencyCode,
      });
      calculators.push({ title: 'Reduce manual review costs', rows: result.calculator1.rows });
    }
    
    if (group.id === 'chargeback-recovery-c7') {
      // Challenge 7: Chargeback recovery
      const valueOfApprovedTx = (formData.amerAnnualGMV || 0) * ((formData.amerPreAuthApprovalRate || 95) / 100);
      const result = calculateChallenge7({
        transactionAttempts: formData.amerGrossAttempts || 0,
        transactionAttemptsValue: formData.amerAnnualGMV || 0,
        fraudChargebackRate: formData.fraudCBRate || 0.5,
        fraudDisputeRate: formData.fraudDisputeRate || 80,
        fraudWinRate: formData.fraudWinRate || 15,
        serviceChargebackRate: formData.serviceCBRate || 0.3,
        serviceDisputeRate: formData.serviceDisputeRate || 80,
        serviceWinRate: formData.serviceWinRate || 25,
        avgTimeToReviewCB: formData.avgTimeToReviewCB || 15,
        annualCBDisputes: formData.annualCBDisputes || 1000,
        costPerHourAnalyst: formData.costPerHourAnalyst || 25,
        forterFraudDisputeImprovement: forterKPIs.fraudDisputeImprovement || 15,
        forterFraudWinChange: forterKPIs.fraudWinRateChange || 30,
        forterServiceDisputeImprovement: forterKPIs.serviceDisputeImprovement || 10,
        forterServiceWinChange: forterKPIs.serviceWinRateChange || 35,
        forterTargetReviewTime: forterKPIs.targetReviewTime || 5,
        currencyCode,
        includesFraudCBCoverage,
      });
      calculators.push({ title: 'Increase chargeback recoveries', rows: result.calculator1.rows });
      calculators.push({ title: 'Improve recovery efficiency', rows: result.calculator2.rows });
    }
    
    if (group.id === 'returns-abuse-c8') {
      // Challenge 8: Returns abuse
      const result = calculateChallenge8({
        expectedRefundsVolume: formData.expectedRefundsVolume || 10000,
        avgRefundValue: formData.avgRefundValue || 75,
        isMarketplace: formData.isMarketplace || false,
        commissionRate: formData.commissionRate || 100,
        grossMarginPercent: formData.amerGrossMarginPercent || 30,
        avgOneWayShipping: formData.avgOneWayShipping || 8,
        avgFulfilmentCost: formData.avgFulfilmentCost || 5,
        txProcessingFeePct: formData.txProcessingFeePct || 2.5,
        avgCSTicketCost: formData.avgCSTicketCost || 8,
        pctINRClaims: formData.pctINRClaims || 10,
        pctReplacedCredits: formData.pctReplacedCredits || 50,
        forterCatchRate: (forterKPIs.forterCatchRate ?? abuseBenchmarks.forterCatchRate) || 90,
        abuseAovMultiplier: (forterKPIs.abuseAovMultiplier ?? abuseBenchmarks.abuseAovMultiplier) || 1.5,
        egregiousReturnsAbusePct: abuseBenchmarks.egregiousReturnsAbusePct || 5,
        egregiousInventoryLossPct: abuseBenchmarks.egregiousInventoryLossPct || 50,
        egregiousINRAbusePct: abuseBenchmarks.egregiousINRAbusePct || 10,
        nonEgregiousReturnsAbusePct: abuseBenchmarks.nonEgregiousReturnsAbusePct || 15,
        nonEgregiousInventoryLossPct: abuseBenchmarks.nonEgregiousInventoryLossPct || 20,
        forterEgregiousReturnsReduction: abuseBenchmarks.forterEgregiousReturnsReduction || 90,
        forterEgregiousINRReduction: abuseBenchmarks.forterEgregiousINRReduction || 85,
        forterNonEgregiousReturnsReduction: abuseBenchmarks.forterNonEgregiousReturnsReduction || 50,
        currencyCode,
      });
      calculators.push({ title: 'Block returns abusers', rows: result.calculator1.rows });
      calculators.push({ title: 'Block INR abusers', rows: result.calculator2.rows });
    }
    
    if (group.id === 'instant-refunds-c9') {
      // Challenge 9: Instant refunds
      const result = calculateChallenge9({
        currentEcommerceSales: formData.amerAnnualGMV || 0,
        commissionRate: formData.commissionRate || 100,
        grossMarginPercent: formData.amerGrossMarginPercent || 30,
        refundRate: formData.refundRate || 15,
        expectedRefundsVolume: formData.expectedRefundsVolume || 10000,
        pctRefundsToCS: formData.pctRefundsToCS ?? 0,
        costPerCSContact: formData.costPerCSContact ?? 0,
        isMarketplace: formData.isMarketplace || false,
        npsIncreaseFromInstantRefunds: forterKPIs.npsIncreaseFromInstantRefunds || 10,
        lseNPSBenchmark: forterKPIs.lseNPSBenchmark || 1,
        forterCSReduction: forterKPIs.csReduction || 50,
        currencyCode,
      });
      calculators.push({ title: 'Instant refunds CX uplift', rows: result.calculator1.rows });
      calculators.push({ title: 'Reduced CS ticket handling', rows: result.calculator2.rows });
    }
    
    if (group.id === 'promotion-abuse-c10') {
      // Challenge 10: Promotion abuse
      const result = calculateChallenge10({
        transactionAttemptsValue: formData.amerAnnualGMV || 0,
        avgDiscountByAbusers: formData.avgDiscountByAbusers || 25,
        isMarketplace: formData.isMarketplace || false,
        commissionRate: formData.commissionRate || 100,
        grossMarginPercent: formData.amerGrossMarginPercent || 30,
        forterCatchRate: (forterKPIs.forterCatchRate ?? abuseBenchmarks.forterCatchRate) || 90,
        abuseAovMultiplier: (forterKPIs.abuseAovMultiplier ?? abuseBenchmarks.abuseAovMultiplier) || 1.5,
        promotionAbuseAsGMVPct: abuseBenchmarks.promotionAbuseAsGMVPct || 2,
        currencyCode,
      });
      calculators.push({ title: 'Protect profitability from promotion abuse', rows: result.calculator1.rows });
    }
    
    if (group.id === 'ato-protection-c12-13') {
      // Challenge 12/13: ATO protection
      const result = calculateChallenge12_13({
        monthlyLogins: formData.monthlyLogins || 100000,
        customerLTV: formData.customerLTV || 500,
        avgAppeasementValue: formData.avgAppeasementValue || 50,
        avgSalaryPerCSMember: formData.avgSalaryPerCSMember || 50000,
        avgHandlingTimePerATOClaim: formData.avgHandlingTimePerATOClaim || 60,
        pctChurnFromATO: formData.pctChurnFromATO || 30,
        commissionRate: formData.commissionRate || 100,
        grossMarginPercent: formData.amerGrossMarginPercent || 30,
        isMarketplace: formData.isMarketplace || false,
        pctFraudulentLogins: forterKPIs.pctFraudulentLogins || 1,
        churnLikelihoodFromATO: forterKPIs.churnLikelihoodFromATO || 30,
        atoCatchRate: forterKPIs.atoCatchRate || 95,
        currencyCode,
        gmvToNetSalesDeductionPct: getGmvToNetSalesDeductionPct(formData),
      });
      calculators.push({ title: 'ATO protection OpEx savings', rows: result.calculator1.rows });
      calculators.push({ title: 'Mitigate CLV loss from ATO churn', rows: result.calculator2.rows });
    }
    
    if (group.id === 'signup-protection-c14-15') {
      // Challenge 14/15: Signup fraud
      const result = calculateChallenge14_15({
        monthlySignups: formData.monthlySignups || 10000,
        avgNewMemberBonus: formData.avgNewMemberBonus || 10,
        numDigitalCommunicationsPerYear: formData.numDigitalCommunicationsPerYear || 52,
        avgCostPerOutreach: formData.avgCostPerOutreach || 0.05,
        avgKYCCostPerAccount: formData.avgKYCCostPerAccount || 2,
        pctAccountsGoingThroughKYC: formData.pctAccountsGoingThroughKYC || 100,
        pctFraudulentSignups: forterKPIs.pctFraudulentSignups || 5,
        forterFraudulentSignupReduction: forterKPIs.forterFraudulentSignupReduction || 90,
        forterKYCReduction: forterKPIs.forterKYCReduction || 50,
        currencyCode,
      });
      calculators.push({ title: 'Protect marketing budget', rows: result.calculator1.rows });
      calculators.push({ title: 'Reduce re-activation costs', rows: result.calculator2.rows });
      calculators.push({ title: 'Optimize KYC costs', rows: result.calculator3.rows });
    }
  } catch (err) {
    console.error('Error generating calculator rows for benefit group:', group.id, err);
  }
  
  return calculators;
}

// Get strategic objectives with their descriptions
function getStrategicObjectiveDetails(selectedObjectives: StrategicObjectiveId[]): Array<{ name: string; description: string }> {
  return selectedObjectives
    .map(id => STRATEGIC_OBJECTIVES.find(o => o.id === id))
    .filter((o): o is typeof STRATEGIC_OBJECTIVES[0] => !!o)
    .map(o => ({ name: o.name, description: o.description }));
}

// Get use cases for selected challenges
function getUseCasesForChallenges(challenges: Record<string, boolean>): Array<{ name: string; description: string }> {
  const activeChallengeIds = Object.entries(challenges)
    .filter(([_, enabled]) => enabled)
    .map(([id]) => id);
  
  const matchingUseCases = USE_CASES.filter(uc => 
    uc.challengeIds.some(cid => activeChallengeIds.includes(cid))
  );
  
  // Deduplicate by use case id
  const seen = new Set<string>();
  return matchingUseCases
    .filter(uc => {
      if (seen.has(uc.id)) return false;
      seen.add(uc.id);
      return true;
    })
    .slice(0, 5)
    .map(uc => ({ name: uc.name, description: uc.description }));
}

// Get problem statements from active benefit groups (exported for ReportPreview)
export function getSelectedChallengeProblems(challenges: Record<string, boolean>): string[] {
  const activeGroups = getActiveBenefitGroups(challenges);
  return activeGroups.slice(0, 4).map(g => g.problem);
}

// Get solution approaches from active benefit groups (exported for ReportPreview)
export function getSolutionApproaches(challenges: Record<string, boolean>): string[] {
  const activeGroups = getActiveBenefitGroups(challenges);
  return activeGroups.slice(0, 4).map(g => g.solution);
}

// Generate headline based on value (exported for ReportPreview)
export function generateHeadline(formData: CalculatorData, valueTotals: ValueTotals): string {
  const totalValue = formatCurrency(valueTotals.ebitdaContribution, formData.baseCurrency || 'USD', true);
  return `Unlocking ${totalValue} in Annual EBITDA Through Identity Risk Managed Revenue Growth`;
}

// Build metrics table data from top value drivers
// Build comprehensive performance highlights table for Target Outcomes
function buildPerformanceHighlights(
  formData: CalculatorData,
  challenges: Record<string, boolean>
): Array<{ metric: string; current: string; target: string; improvement?: string }> {
  const highlights: Array<{ metric: string; current: string; target: string; improvement?: string }> = [];
  
  // Challenge 1: Fraud approval rate
  if (challenges['1'] && formData.amerPreAuthApprovalRate) {
    const improvement = formData.forterKPIs?.approvalRateImprovement || 2;
    const target = Math.min(formData.amerPreAuthApprovalRate + improvement, 99.5);
    highlights.push({
      metric: 'Fraud approval rate',
      current: `${formData.amerPreAuthApprovalRate}%`,
      target: `${target.toFixed(1)}%`,
      improvement: `+${improvement.toFixed(1)}%`,
    });
  }
  
  // Challenge 2/4: 3DS Challenge Rate Reduction
  if ((challenges['2'] || challenges['4']) && formData.amer3DSChallengeRate) {
    const reduction = formData.forterKPIs?.threeDSReduction || 50;
    const target = formData.amer3DSChallengeRate * (1 - reduction / 100);
    highlights.push({
      metric: '3DS Challenge Rate',
      current: `${formData.amer3DSChallengeRate}%`,
      target: `${target.toFixed(1)}%`,
      improvement: `-${reduction}%`,
    });
  }
  
  // Challenge 1/5: Fraud Chargeback Rate
  if ((challenges['1'] || challenges['5']) && formData.fraudCBRate) {
    const targetRate = formData.forterKPIs?.chargebackReduction || 0.25;
    const reductionPct = ((formData.fraudCBRate - targetRate) / formData.fraudCBRate * 100).toFixed(0);
    highlights.push({
      metric: 'Fraud Chargeback Rate',
      current: `${formData.fraudCBRate}%`,
      target: `${targetRate}%`,
      improvement: `-${reductionPct}%`,
    });
  }
  
  // Challenge 3: Manual Review Rate
  if (challenges['3'] && formData.amerManualReviewRate) {
    const targetReviewRate = formData.forterKPIs?.manualReviewReduction || 0;
    highlights.push({
      metric: 'Manual Review Rate',
      current: `${formData.amerManualReviewRate}%`,
      target: `${targetReviewRate}%`,
      improvement: `-${(formData.amerManualReviewRate - targetReviewRate).toFixed(0)}%`,
    });
  }
  
  // Challenge 7: Fraud Dispute Win Rate
  if (challenges['7'] && formData.fraudWinRate !== undefined) {
    const targetWinRate = formData.forterKPIs?.fraudWinRateChange || 30;
    highlights.push({
      metric: 'Fraud Dispute Win Rate',
      current: `${formData.fraudWinRate || 15}%`,
      target: `${targetWinRate}%`,
      improvement: `+${(targetWinRate - (formData.fraudWinRate || 15))}%`,
    });
  }
  
  // Challenge 8/10/11: Abuse Catch Rate
  if ((challenges['8'] || challenges['10'] || challenges['11']) && formData.forterKPIs?.forterCatchRate) {
    const catchRate = formData.forterKPIs.forterCatchRate;
    highlights.push({
      metric: 'Abuse Catch Rate',
      current: '0%',
      target: `${catchRate}%`,
      improvement: `${catchRate}%`,
    });
  }
  
  // Challenge 9: NPS Increase
  if (challenges['9']) {
    const npsIncrease = formData.forterKPIs?.npsIncreaseFromInstantRefunds || 10;
    highlights.push({
      metric: 'Expected NPS Increase',
      current: '-',
      target: `+${npsIncrease} pts`,
    });
  }
  
  // Challenge 12/13: ATO Catch Rate
  if ((challenges['12'] || challenges['13']) && formData.forterKPIs?.atoCatchRate) {
    highlights.push({
      metric: 'ATO Catch Rate',
      current: '0%',
      target: `${formData.forterKPIs.atoCatchRate}%`,
    });
  }
  
  // Challenge 14/15: Fake Account Prevention
  if ((challenges['14'] || challenges['15']) && formData.forterKPIs?.forterFraudulentSignupReduction) {
    highlights.push({
      metric: 'Fraudulent Signup Reduction',
      current: '0%',
      target: `${formData.forterKPIs.forterFraudulentSignupReduction}%`,
    });
  }
  
  return highlights;
}

// Legacy function for backward compatibility
function buildMetricsTable(formData: CalculatorData): Array<{ metric: string; current: string; target: string }> {
  return buildPerformanceHighlights(formData, { '1': true, '2': true, '5': true });
}

/**
 * Generate and download calculator slide(s) as PPTX
 * Used from the calculator modal "Download Slide" button
 *
 * Layout: Single-slide per benefit (no multi-page table split). Table fits on one slide
 * with dynamic row height. If the benefit has a case study, an additional Success Story
 * slide is appended.
 *
 * For segmented analysis: one slide per segment + Total slide (+ success story if applicable)
 * For non-segmented: one calculator slide (+ success story if applicable)
 */
export async function generateCalculatorSlide(
  calculatorId: string,
  calculatorTitle: string,
  calculatorRows: CalculatorRow[],
  formData: CalculatorData,
  // Segment-related parameters for accurate calculation
  isSegmented?: boolean,
  segmentData?: Array<{ name: string; rows: CalculatorRow[] }>,
  totalRows?: CalculatorRow[]
): Promise<void> {
  const [pptxGenJS, { saveAs }] = await Promise.all([
    import('pptxgenjs'),
    import('file-saver'),
  ]);

  const pptx = new pptxGenJS.default();
  pptx.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 });
  pptx.layout = 'WIDE';

  const analysisName = (formData as any)._analysisName || formData.customerName || 'Customer';
  const customerName = formData.customerName || 'Customer';
  const currency = formData.baseCurrency || 'USD';

  const FONT_HEAD = 'Poppins';
  const FONT_BODY = 'Proxima Nova';
  const colWCalc = [1.07, 4.07, 1.97, 1.97, 3.25];

  const applyContentSlide = (slide: any) => {
    slide.background = { color: LIGHT_BG };
    slide.addText(`${customerName} x Forter Business Value Assessment`, {
      x: 0.5, y: 0.18, w: 12, h: 0.2,
      fontSize: 7.5, bold: true, color: BLUE, fontFace: FONT_HEAD, charSpacing: 1.5,
    });
    slide.addText('© Forter, Inc. All rights Reserved  |  Confidential', {
      x: 7.0, y: 7.15, w: 6.0, h: 0.2,
      fontSize: 7.5, color: GRAY, align: 'right', fontFace: FONT_BODY,
    });
  };

  const benefitContent = getChallengeBenefitContent(calculatorId);

  // TBD narrative slide – matches main deck appendix layout (single slide, no table)
  const createTBDNarrativeSlide = (
    slideTitle: string,
    challengeDescription: string,
    benefitDescription: string,
    benefitPoints?: { title: string; description: string }[],
    segmentLabel?: string
  ) => {
    const slide = pptx.addSlide();
    applyContentSlide(slide);
    const fullTitle = segmentLabel ? `${slideTitle} - ${segmentLabel}` : slideTitle;
    slide.addText(fullTitle, { x: 0.5, y: 0.38, w: 12.33, h: 0.5, fontSize: 22, bold: true, color: NAVY, fontFace: FONT_HEAD });
    slide.addText('The Challenge', { x: 0.5, y: 1.0, w: 12.33, h: 0.25, fontSize: 12, bold: true, color: NAVY, fontFace: FONT_HEAD });
    slide.addText(challengeDescription, { x: 0.5, y: 1.28, w: 12.33, h: 0.9, fontSize: 10, color: GRAY, fontFace: FONT_BODY, valign: 'top' });
    slide.addText('The Forter Solution', { x: 0.5, y: 2.3, w: 12.33, h: 0.25, fontSize: 12, bold: true, color: BLUE, fontFace: FONT_HEAD });
    slide.addText(benefitDescription, { x: 0.5, y: 2.58, w: 12.33, h: 0.8, fontSize: 10, color: GRAY, fontFace: FONT_BODY, valign: 'top' });
    if (benefitPoints && benefitPoints.length > 0) {
      slide.addText('Key Benefits', { x: 0.5, y: 3.5, w: 12.33, h: 0.25, fontSize: 12, bold: true, color: NAVY, fontFace: FONT_HEAD });
      let bulletY = 3.8;
      benefitPoints.forEach((point: { title: string; description: string }) => {
        slide.addText([
          { text: '• ', options: { bold: true, color: BLUE } },
          { text: `${point.title}: `, options: { bold: true, color: NAVY } },
          { text: point.description, options: { color: GRAY } },
        ], { x: 0.6, y: bulletY, w: 12.0, h: 0.35, fontSize: 9, fontFace: FONT_BODY, valign: 'top' });
        bulletY += 0.35;
      });
    }
    slide.addText('Complete the customer inputs to generate detailed value calculations for this benefit.', { x: 0.5, y: 6.5, w: 12.33, h: 0.25, fontSize: 9, italic: true, color: GRAY, fontFace: FONT_BODY });
  };

  // Calculator table slide – single slide only, matches main deck appendix styling (no multi-page split)
  const headerRow = [
    { text: 'Formula', options: { bold: true, fill: { color: '374151' }, color: WHITE, fontFace: FONT_HEAD, fontSize: 10 } },
    { text: 'Description', options: { bold: true, fill: { color: NAVY }, color: WHITE, fontFace: FONT_HEAD, fontSize: 10 } },
    { text: 'Customer Inputs', options: { bold: true, fill: { color: NAVY }, color: WHITE, align: 'right', fontFace: FONT_HEAD, fontSize: 10 } },
    { text: 'Forter Improvement', options: { bold: true, fill: { color: BLUE }, color: WHITE, align: 'right', fontFace: FONT_HEAD, fontSize: 10 } },
    { text: 'Forter Outcome', options: { bold: true, fill: { color: NAVY }, color: WHITE, align: 'right', fontFace: FONT_HEAD, fontSize: 10 } },
  ];

  const createCalculatorSlide = (
    slideTitle: string,
    slideSubtitle: string | undefined,
    rows: CalculatorRow[],
    segmentLabel?: string
  ) => {
    const slide = pptx.addSlide();
    applyContentSlide(slide);
    const fullTitle = segmentLabel ? `${slideTitle} - ${segmentLabel}` : slideTitle;
    slide.addText(fullTitle, { x: 0.5, y: 0.38, w: 12.33, h: 0.5, fontSize: 22, bold: true, color: NAVY, fontFace: FONT_HEAD });
    slide.addText(slideSubtitle ?? '', { x: 0.5, y: 0.92, w: 12.33, h: 0.35, fontSize: 10, color: GRAY, fontFace: FONT_BODY });
    const dataRows: Array<{ isSection: boolean; row: CalculatorRow }> = [];
    rows.forEach(row => {
      const isSection = !row.formula && !!row.label && !row.customerInput && !row.forterOutcome;
      dataRows.push({ isSection, row: row });
    });
    const calcTableRows: Array<Array<{ text: string; options?: any }>> = [headerRow.map(c => ({ text: c.text, options: { ...c.options } }))];
    dataRows.forEach(({ isSection, row: r }, idx) => {
      if (isSection) {
        calcTableRows.push([
          { text: (r.label || '').toUpperCase(), options: { bold: true, fill: { color: 'E5E7EB' }, color: NAVY, fontFace: FONT_HEAD, fontSize: 8.5, colspan: 5 } },
          { text: '', options: {} }, { text: '', options: {} }, { text: '', options: {} }, { text: '', options: {} },
        ]);
      } else {
        const isValueDriver = !!r.valueDriver;
        const rowFill = isValueDriver ? GREEN_FILL : (calcTableRows.length % 2 === 0 ? ALT_ROW : WHITE);
        const textColor = isValueDriver ? GREEN_TEXT : undefined;
        const impColor = r.forterImprovement?.startsWith('-') || r.forterImprovement?.startsWith('(') ? RED : GREEN;
        const formulaOpts = { fontFace: 'Courier New', fontSize: 8, fill: { color: rowFill }, color: isValueDriver ? GREEN_TEXT : GRAY };
        calcTableRows.push([
          { text: r.formula || '', options: formulaOpts },
          { text: r.label || '', options: { fontFace: FONT_BODY, fontSize: 8, fill: { color: rowFill }, color: textColor, bold: isValueDriver } },
          { text: r.customerInput || '', options: { align: 'right', fontFace: FONT_BODY, fontSize: 8, fill: { color: rowFill }, color: textColor, bold: isValueDriver } },
          { text: r.forterImprovement || '', options: { align: 'right', fontFace: FONT_BODY, fontSize: 8, color: impColor, fill: { color: rowFill }, bold: isValueDriver } },
          { text: r.forterOutcome || '', options: { align: 'right', fontFace: FONT_BODY, fontSize: 8, bold: isValueDriver, fill: { color: rowFill }, color: textColor } },
        ]);
      }
    });
    const tableHeight = 5.6;
    const rowH = Math.min(0.22, tableHeight / Math.max(calcTableRows.length, 1));
    slide.addTable(calcTableRows, {
      x: 0.5, y: 1.4, w: 12.33,
      colW: colWCalc,
      fontSize: 8,
      fontFace: FONT_BODY,
      border: { pt: 0.5, color: 'E5E7EB' },
      rowH,
    });
  };
  
  const slideTitle = benefitContent?.benefitTitle || calculatorTitle;
  const slideSubtitle = benefitContent?.benefitDescription || '';
  const challengeDescription = benefitContent?.challengeDescription || 'Customer inputs are required to calculate the value for this benefit.';
  
  // Check if calculator is TBD (missing inputs)
  const isTBD = isCalculatorTBD(calculatorRows);
  
  // Get benefit points for TBD slides
  const benefitPoints = benefitContent?.benefitPoints;
  
  // If TBD, create a narrative slide instead of calculator table
  if (isTBD) {
    createTBDNarrativeSlide(slideTitle, challengeDescription, slideSubtitle, benefitPoints);
  } else if (isSegmented && segmentData && segmentData.length > 0) {
    // Individual segment slides
    for (const segment of segmentData) {
      if (isCalculatorTBD(segment.rows)) {
        createTBDNarrativeSlide(slideTitle, challengeDescription, slideSubtitle, benefitPoints, segment.name);
      } else {
        createCalculatorSlide(slideTitle, slideSubtitle, segment.rows, segment.name);
      }
    }
    
    // Total slide
    if (totalRows && totalRows.length > 0) {
      if (isCalculatorTBD(totalRows)) {
        createTBDNarrativeSlide(slideTitle, challengeDescription, slideSubtitle, benefitPoints, 'Total');
      } else {
        createCalculatorSlide(slideTitle, slideSubtitle, totalRows, 'Total');
      }
    }
  } else {
    // Single slide for non-segmented
    createCalculatorSlide(slideTitle, slideSubtitle, calculatorRows);
  }

  // Append Success Story slide when this benefit has a case study
  if (hasCaseStudy(calculatorId)) {
    const slideNum = getCaseStudySlideNumber(calculatorId);
    if (slideNum != null) {
      const imageUrl = `/case-studies/slide${slideNum}.png`;
      try {
        const resp = await fetch(imageUrl);
        if (resp.ok) {
          const buf = await resp.arrayBuffer();
          const base64 = arrayBufferToBase64(buf);
          const slideStory = pptx.addSlide();
          applyContentSlide(slideStory);
          slideStory.addText('Success Story', {
            x: 0.5, y: 0.38, w: 12.33, h: 0.4,
            fontSize: 18, bold: true, color: NAVY, fontFace: FONT_HEAD,
          });
          slideStory.addImage({ data: `image/png;base64,${base64}`, x: 0.5, y: 0.9, w: 12.33, h: 6.0 });
        }
      } catch {
        // Skip success story slide if image fails to load
      }
    }
  }

  // Save - Format: AnalysisName_CalculatorTitle (MMDDYY).pptx
  const blob = await pptx.write({ outputType: 'blob' }) as Blob;
  const dateStr = formatDateMMDDYY();
  const sanitizedAnalysisName = analysisName.replace(/[^a-zA-Z0-9]/g, '_');
  const sanitizedTitle = calculatorTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40);
  const segmentSuffix = isSegmented ? '_Segmented' : '';
  const filename = `${sanitizedAnalysisName}_${sanitizedTitle}${segmentSuffix} (${dateStr}).pptx`;
  saveAs(blob, filename);
}

/**
 * Generate Executive Summary DOCX
 * Follows the Forter template format with focus on strategic alignment when objectives are selected
 */
export async function generateExecutiveSummaryDocx(
  formData: CalculatorData,
  valueTotals: ValueTotals,
  challenges: Record<string, boolean>,
  roiResults: ROIResults,
  options: ReportOptions
): Promise<void> {
  // Dynamic imports to avoid React version conflicts
  const [docxModule, { saveAs }] = await Promise.all([
    import('docx'),
    import('file-saver'),
  ]);
  const {
    Document, Paragraph, Table, TableRow, TableCell, AlignmentType, WidthType, TextRun, Packer,
    BorderStyle, ShadingType, convertInchesToTwip,
  } = docxModule as typeof import('docx') & {
    BorderStyle?: { SINGLE: string };
    ShadingType?: { SOLID: string };
    convertInchesToTwip?: (inches: number) => number;
  };
  const borderSingle = BorderStyle?.SINGLE ?? 'single';
  const shadingSolid = ShadingType?.SOLID ?? 'clear';
  const toTwip = convertInchesToTwip ?? ((inches: number) => Math.round(inches * 1440)); // 1 inch = 1440 twips

  const analysisName = (formData as any)._analysisName || formData.customerName || 'Value Assessment';
  const customerName = formData.customerName || 'Customer';
  const currency = formData.baseCurrency || 'USD';
  const headline = generateHeadline(formData, valueTotals);
  const solutions = getSolutionApproaches(challenges);
  const performanceHighlights = buildPerformanceHighlights(formData, challenges);
  const topDrivers = getAllValueDrivers(challenges, valueTotals);
  
  const useStrategicAlignment = options.selectedObjectives.length > 0;
  const strategicObjectives = getStrategicObjectiveDetails(options.selectedObjectives);
  const useCases = getUseCasesForChallenges(challenges);
  const problems = getSelectedChallengeProblems(challenges);

  const opportunityStatement = `Because of rising fraud sophistication and payment friction, ${customerName} should implement an automated fraud decisioning solution by [TIMELINE]. After, ${customerName} will avoid ${formatCurrency(valueTotals.riskMitigation, currency, true)} in fraud losses while unlocking ${formatCurrency(valueTotals.gmvUplift, currency, true)} in recovered GMV.`;

  // Style helpers (consulting-style formatting)
  const sectionHeader = (label: string): Paragraph[] => [
    new Paragraph({
      children: [
        new TextRun({
          text: label.toUpperCase(),
          bold: true,
          size: 22,
          color: FORTER_NAVY,
          font: 'Poppins',
        }),
      ],
      spacing: { before: 340, after: 60 },
      border: {
        bottom: {
          color: FORTER_NAVY,
          space: 4,
          style: borderSingle,
          size: 12,
        },
      },
    }),
  ];

  const bulletItem = (parts: Array<{ text: string; bold?: boolean; color?: string }>): Paragraph =>
    new Paragraph({
      children: [
        new TextRun({ text: '→  ', bold: true, color: FORTER_BLUE, size: 20, font: 'Proxima Nova' }),
        ...parts.map(p => new TextRun({
          text: p.text,
          bold: p.bold ?? false,
          color: p.color ?? '374151',
          size: 20,
          font: 'Proxima Nova',
        })),
      ],
      spacing: { after: 100 },
      indent: { left: toTwip(0.2) },
    });

  const numberedItem = (num: number, text: string): Paragraph =>
    new Paragraph({
      children: [
        new TextRun({ text: `${num}.  `, bold: true, color: FORTER_BLUE, size: 20, font: 'Proxima Nova' }),
        new TextRun({ text, size: 20, color: '374151', font: 'Proxima Nova' }),
      ],
      spacing: { after: 100 },
      indent: { left: toTwip(0.2) },
    });

  const bodyPara = (text: string, options?: { italic?: boolean; color?: string; size?: number }): Paragraph =>
    new Paragraph({
      children: [
        new TextRun({
          text,
          size: options?.size ?? 20,
          italics: options?.italic ?? false,
          color: options?.color ?? '374151',
          font: 'Proxima Nova',
        }),
      ],
      spacing: { after: 120 },
    });

  // Build document sections
  const documentChildren: any[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: `VALUE ASSESSMENT  ·  ${analysisName}`,
          size: 16,
          bold: true,
          color: FORTER_BLUE,
          font: 'Poppins',
        }),
      ],
      spacing: { before: 0, after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: headline,
          bold: true,
          size: 40,
          color: FORTER_NAVY,
          font: 'Poppins',
        }),
      ],
      spacing: { after: 120 },
      border: {
        bottom: { color: FORTER_BLUE, style: borderSingle, size: 18, space: 6 },
      },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Developed by:  ', bold: true, size: 18, color: FORTER_GRAY, font: 'Proxima Nova' }),
        new TextRun({ text: '[Champion Name], [Key Deal Players]', size: 18, italics: true, color: FORTER_GRAY, font: 'Proxima Nova' }),
      ],
      spacing: { after: 300 },
    }),
    ...sectionHeader('Headline'),
    bodyPara(opportunityStatement),
  ];

  // STRATEGIC ALIGNMENT or PROBLEM STATEMENT section
  if (useStrategicAlignment) {
    documentChildren.push(
      ...sectionHeader('Strategic Alignment'),
      bodyPara(`This initiative directly supports ${customerName}'s key strategic priorities:`),
      ...strategicObjectives.map(obj =>
        bulletItem([
          { text: `${obj.name}: `, bold: true, color: FORTER_NAVY },
          { text: obj.description },
        ])
      ),
      new Paragraph({ spacing: { after: 120 } }),
      ...sectionHeader('Targeted Use Cases'),
      ...useCases.map(uc => bulletItem([{ text: uc.name }]))
    );
  } else {
    const problemStatementItems = problems.map((p, i) => {
      const driver = topDrivers[i];
      const cost = driver ? formatCurrency(driver.value, currency, true) : '[calculated cost]';
      return `${p}, costing approximately ${cost} annually`;
    });
    documentChildren.push(
      ...sectionHeader('The Problem Statement'),
      bodyPara(`This initiative addresses the following high-priority challenges for ${customerName}:`),
      ...problemStatementItems.map(item => bulletItem([{ text: item }]))
    );
  }

  // RECOMMENDED APPROACH section
  documentChildren.push(
    ...sectionHeader('Recommended Approach'),
    ...solutions.map((solution, idx) => numberedItem(idx + 1, solution)),
    new Paragraph({
      children: [
        new TextRun({
          text: 'Forter was found to meet and exceed all requirements for this solution.',
          size: 20,
          italics: true,
          color: FORTER_GREEN,
          font: 'Proxima Nova',
        }),
      ],
      spacing: { before: 80, after: 200 },
      indent: { left: toTwip(0.2) },
    }),
    ...sectionHeader('Target Outcomes'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: borderSingle, color: 'E5E7EB', size: 4 },
        bottom: { style: borderSingle, color: 'E5E7EB', size: 4 },
        left: { style: 'none' as any },
        right: { style: 'none' as any },
        insideH: { style: borderSingle, color: 'E5E7EB', size: 4 },
        insideV: { style: 'none' as any },
      },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: 'Key Metric', bold: true, size: 20, color: 'FFFFFF', font: 'Poppins' })],
              })],
              width: { size: 45, type: WidthType.PERCENTAGE },
              shading: { type: shadingSolid, fill: FORTER_NAVY, color: FORTER_NAVY },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: 'Current Measure', bold: true, size: 20, color: 'FFFFFF', font: 'Poppins' })],
                alignment: AlignmentType.CENTER,
              })],
              width: { size: 27, type: WidthType.PERCENTAGE },
              shading: { type: shadingSolid, fill: FORTER_NAVY, color: FORTER_NAVY },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: 'Target with Forter', bold: true, size: 20, color: 'FFFFFF', font: 'Poppins' })],
                alignment: AlignmentType.CENTER,
              })],
              width: { size: 28, type: WidthType.PERCENTAGE },
              shading: { type: shadingSolid, fill: FORTER_NAVY, color: FORTER_NAVY },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
            }),
          ],
        }),
        ...performanceHighlights.map((m, idx) =>
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({
                  children: [new TextRun({ text: m.metric, size: 20, font: 'Proxima Nova', color: '374151' })],
                })],
                shading: { type: shadingSolid, fill: idx % 2 === 0 ? 'FFFFFF' : 'F9FAFB', color: idx % 2 === 0 ? 'FFFFFF' : 'F9FAFB' },
                margins: { top: 70, bottom: 70, left: 120, right: 120 },
              }),
              new TableCell({
                children: [new Paragraph({
                  children: [new TextRun({ text: m.current, size: 20, font: 'Proxima Nova', color: FORTER_GRAY })],
                  alignment: AlignmentType.CENTER,
                })],
                shading: { type: shadingSolid, fill: idx % 2 === 0 ? 'FFFFFF' : 'F9FAFB', color: idx % 2 === 0 ? 'FFFFFF' : 'F9FAFB' },
                margins: { top: 70, bottom: 70, left: 120, right: 120 },
              }),
              new TableCell({
                children: [new Paragraph({
                  children: [new TextRun({ text: m.target, size: 20, bold: true, color: FORTER_GREEN, font: 'Proxima Nova' })],
                  alignment: AlignmentType.CENTER,
                })],
                shading: { type: shadingSolid, fill: idx % 2 === 0 ? 'FFFFFF' : 'F9FAFB', color: idx % 2 === 0 ? 'FFFFFF' : 'F9FAFB' },
                margins: { top: 70, bottom: 70, left: 120, right: 120 },
              }),
            ],
          })
        ),
      ],
    }),
    new Paragraph({ spacing: { after: 200 } })
  );

  // INVESTMENT or PROJECTED VALUE / NEXT STEPS section
  if (options.hasInvestment) {
    documentChildren.push(
      ...sectionHeader('Required Investment'),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: borderSingle, color: 'E5E7EB', size: 4 },
          bottom: { style: borderSingle, color: 'E5E7EB', size: 4 },
          left: { style: 'none' as any },
          right: { style: 'none' as any },
          insideH: { style: borderSingle, color: 'E5E7EB', size: 4 },
          insideV: { style: 'none' as any },
        },
        rows: [
          ...[
            { label: 'Annual Investment', val: formatCurrency(roiResults.yearProjections?.[0]?.forterSaaSCost || 0, currency), green: false },
            { label: 'EBITDA Contribution', val: formatCurrency(valueTotals.ebitdaContribution, currency), green: true },
            { label: 'Return on Investment', val: `${roiResults.roi.toFixed(1)}×`, green: true },
            { label: 'Payback Period', val: roiResults.paybackPeriodMonths > 0 ? `${roiResults.paybackPeriodMonths} months` : 'Immediate', green: false },
          ].map((row, idx) => new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: row.label, size: 20, font: 'Proxima Nova', color: '374151' })] })],
                shading: { type: shadingSolid, fill: idx % 2 === 0 ? 'FFFFFF' : 'F9FAFB', color: idx % 2 === 0 ? 'FFFFFF' : 'F9FAFB' },
                margins: { top: 70, bottom: 70, left: 120, right: 120 },
                width: { size: 60, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({
                  children: [new TextRun({ text: row.val, size: 20, bold: true, color: row.green ? FORTER_GREEN : FORTER_NAVY, font: 'Proxima Nova' })],
                  alignment: AlignmentType.RIGHT,
                })],
                shading: { type: shadingSolid, fill: idx % 2 === 0 ? 'FFFFFF' : 'F9FAFB', color: idx % 2 === 0 ? 'FFFFFF' : 'F9FAFB' },
                margins: { top: 70, bottom: 70, left: 120, right: 120 },
              }),
            ],
          })),
        ],
      })
    );
  } else {
    const projectedRows = [
      { label: 'GMV Uplift', val: formatCurrency(valueTotals.gmvUplift, currency), green: false, bold: false },
      { label: 'Cost Reduction', val: formatCurrency(valueTotals.costReduction, currency), green: false, bold: false },
      { label: 'Risk Mitigation', val: formatCurrency(valueTotals.riskMitigation, currency), green: false, bold: false },
      { label: 'Annual EBITDA Contribution', val: formatCurrency(valueTotals.ebitdaContribution, currency), green: true, bold: true },
    ].filter(row => {
      if (row.label === 'Annual EBITDA Contribution') return true;
      const key = row.label === 'GMV Uplift' ? valueTotals.gmvUplift
        : row.label === 'Cost Reduction' ? valueTotals.costReduction
        : valueTotals.riskMitigation;
      return key > 0;
    });
    documentChildren.push(
      ...sectionHeader('Projected Value'),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: borderSingle, color: 'E5E7EB', size: 4 },
          bottom: { style: borderSingle, color: 'E5E7EB', size: 4 },
          left: { style: 'none' as any },
          right: { style: 'none' as any },
          insideH: { style: borderSingle, color: 'E5E7EB', size: 4 },
          insideV: { style: 'none' as any },
        },
        rows: projectedRows.map((row, idx) =>
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({
                  children: [new TextRun({ text: row.label, size: 20, bold: row.bold, font: row.bold ? 'Poppins' : 'Proxima Nova', color: row.bold ? FORTER_NAVY : '374151' })],
                })],
                shading: { type: shadingSolid, fill: row.bold ? 'F0F4FF' : (idx % 2 === 0 ? 'FFFFFF' : 'F9FAFB'), color: row.bold ? 'F0F4FF' : (idx % 2 === 0 ? 'FFFFFF' : 'F9FAFB') },
                margins: { top: 70, bottom: 70, left: 120, right: 120 },
                width: { size: 60, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({
                  children: [new TextRun({ text: row.val, size: 20, bold: row.bold, color: row.green ? FORTER_GREEN : FORTER_NAVY, font: 'Proxima Nova' })],
                  alignment: AlignmentType.RIGHT,
                })],
                shading: { type: shadingSolid, fill: row.bold ? 'F0F4FF' : (idx % 2 === 0 ? 'FFFFFF' : 'F9FAFB'), color: row.bold ? 'F0F4FF' : (idx % 2 === 0 ? 'FFFFFF' : 'F9FAFB') },
                margins: { top: 70, bottom: 70, left: 120, right: 120 },
              }),
            ],
          })
        ),
      }),
      new Paragraph({ spacing: { after: 160 } }),
      ...sectionHeader('Next Steps'),
      numberedItem(1, 'Finalize investment and pricing discussion to complete ROI analysis'),
      numberedItem(2, '[EDIT: Define additional next steps, timeline, and key stakeholders]')
    );
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Proxima Nova', size: 20, color: '374151' },
          paragraph: { spacing: { line: 276 } },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: toTwip(0.85),
            bottom: toTwip(0.85),
            left: toTwip(0.9),
            right: toTwip(0.9),
          },
        },
      },
      children: documentChildren,
    }],
  });
  
  const blob = await Packer.toBlob(doc);
  const dateStr = formatDateMMDDYY();
  const sanitizedName = analysisName.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${sanitizedName}_Executive_Summary (${dateStr}).docx`;
  saveAs(blob, filename);
}

/**
 * Generate Value Assessment PowerPoint Deck
 * Creates slides for Executive Summary, Value Summary, Use Cases, ROI, and Appendix
 * Uses Proxima Nova font throughout
 */
export async function generateValueDeckPptx(
  formData: CalculatorData,
  valueTotals: ValueTotals,
  challenges: Record<string, boolean>,
  roiResults: ROIResults,
  options: ReportOptions
): Promise<void> {
  const [pptxModule, { saveAs }] = await Promise.all([
    import('pptxgenjs'),
    import('file-saver'),
  ]);
  const PptxGenJS = pptxModule.default;
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 });
  pptx.layout = 'WIDE';

  const analysisName = (formData as any)._analysisName || formData.customerName || 'Value Assessment';
  const customerName = formData.customerName || 'Customer';
  const currency = formData.baseCurrency || 'USD';
  const headline = generateHeadline(formData, valueTotals);
  const allDrivers = getAllValueDrivers(challenges, valueTotals);
  const performanceHighlights = buildPerformanceHighlights(formData, challenges);
  const problems = getSelectedChallengeProblems(challenges);
  const solutions = getSolutionApproaches(challenges);

  pptx.author = 'Forter Value Calculator';
  pptx.title = `${analysisName} Value Assessment`;
  pptx.subject = 'Value Assessment';
  pptx.company = 'Forter';

  const FONT_HEAD = 'Poppins';
  const FONT_BODY = 'Proxima Nova';

  const applyContentSlide = (slide: any, pageNum: number, sectionLabel: string = `${customerName} x Forter Business Value Assessment`) => {
    slide.background = { color: LIGHT_BG };
    if (sectionLabel) {
      slide.addText(sectionLabel, {
        x: 0.5, y: 0.18, w: 12, h: 0.2,
        fontSize: 7.5, bold: true, color: BLUE, fontFace: FONT_HEAD, charSpacing: 1.5,
      });
    }
    slide.addText(String(pageNum), {
      x: 0.28, y: 7.15, w: 1.0, h: 0.2,
      fontSize: 7.5, color: GRAY, fontFace: FONT_BODY,
    });
    slide.addText('© Forter, Inc. All rights Reserved  |  Confidential', {
      x: 7.0, y: 7.15, w: 6.0, h: 0.2,
      fontSize: 7.5, color: GRAY, align: 'right', fontFace: FONT_BODY,
    });
  };

  const applyDarkSlide = (slide: any) => {
    slide.background = { color: NAVY };
  };

  const addSlideTitle = (slide: any, title: string, subtitle?: string) => {
    slide.addText(title, {
      x: 0.5, y: 0.38, w: 12.33, h: 0.65,
      fontSize: 26, bold: true, color: NAVY, fontFace: FONT_HEAD,
    });
    if (subtitle) {
      slide.addText(subtitle, {
        x: 0.5, y: 0.95, w: 12.33, h: 0.3,
        fontSize: 10, color: GRAY, fontFace: FONT_BODY,
      });
    }
  };

  const hdr = (label: string, align: 'left'|'right'|'center' = 'left', blue = false) => ({
    text: label,
    options: {
      bold: true, color: WHITE, fill: { color: blue ? BLUE : NAVY },
      align, fontFace: FONT_HEAD, fontSize: 10,
    },
  });

  const vdRow = (cells: string[]) => cells.map(t => ({
    text: t, options: { fill: { color: GREEN_FILL }, color: GREEN_TEXT, bold: true, fontFace: FONT_BODY, fontSize: 9 },
  }));

  // ===== SLIDE 0: How to Use =====
  const slideHowTo = pptx.addSlide();
  applyContentSlide(slideHowTo, 0, '');
  slideHowTo.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.45, fill: { color: LIGHT_BG }, line: { color: 'E5E7EB', pt: 1 } });
  slideHowTo.addText('⚠️  DELETE THIS PAGE PRIOR TO SHARING', {
    x: 3.5, y: 0.06, w: 9.0, h: 0.32,
    fontSize: 16, bold: true, color: RED, fontFace: FONT_HEAD,
  });
  slideHowTo.addText('General template guidelines', {
    x: 0.5, y: 0.65, w: 12.33, h: 0.5,
    fontSize: 20, bold: true, color: NAVY, fontFace: FONT_HEAD,
  });
  slideHowTo.addText('Slides will pre-populate based on the Guided Value Calculator Inputs', {
    x: 0.5, y: 1.1, w: 12.33, h: 0.3,
    fontSize: 10, color: GRAY, fontFace: FONT_BODY,
  });
  const bullets = [
    ['Resubmitting the ', 'Generate Value Slides', ' button will always create a new presentation'],
    ['Save this copy into a folder of yours for future reference', '', ''],
    ['Use judgement to determine what slides to share externally', '', ''],
    ['If materials are used to paste into another slide deck, ensure formatting is aligned', '', ''],
    ['The ', 'Next Steps', ' slide contains highlighted placeholders that must be completed manually'],
    ['Appendix calculator slides may span multiple pages for longer models — review before presenting', '', ''],
  ];
  bullets.forEach((b, i) => {
    slideHowTo.addText([
      { text: '●  ', options: { color: BLUE, bold: true } },
      { text: b[0], options: { color: '374151' } },
      ...(b[1] ? [{ text: b[1], options: { color: BLUE, bold: true } }] : []),
      ...(b[2] ? [{ text: b[2], options: { color: '374151' } }] : []),
    ], { x: 0.5, y: 1.52 + i * 0.38, w: 12.33, h: 0.34, fontSize: 10.5, fontFace: FONT_BODY });
  });
  const mapRows = [
    [{ text: 'Slide', options: { bold: true, fill: { color: NAVY }, color: WHITE, fontFace: FONT_HEAD } }, { text: 'Content', options: { bold: true, fill: { color: NAVY }, color: WHITE, fontFace: FONT_HEAD } }, { text: 'Notes', options: { bold: true, fill: { color: NAVY }, color: WHITE, fontFace: FONT_HEAD } }],
    [{ text: '1 — Title', options: { fontFace: FONT_BODY } }, { text: 'Customer name, report type, date', options: { fontFace: FONT_BODY } }, { text: 'Auto-populated', options: { fontFace: FONT_BODY, color: GREEN } }],
    [{ text: '2 — Executive Summary', options: { fontFace: FONT_BODY } }, { text: 'Challenges, approach, value metrics', options: { fontFace: FONT_BODY } }, { text: 'Auto-populated', options: { fontFace: FONT_BODY, color: GREEN } }],
    [{ text: '3 — Value Summary', options: { fontFace: FONT_BODY } }, { text: 'Active value category cards + KPI pills', options: { fontFace: FONT_BODY } }, { text: 'Auto-populated', options: { fontFace: FONT_BODY, color: GREEN } }],
    [{ text: '4 — Value Drivers', options: { fontFace: FONT_BODY } }, { text: 'Ranked breakdown of value contributors', options: { fontFace: FONT_BODY } }, { text: 'Auto-populated', options: { fontFace: FONT_BODY, color: GREEN } }],
    [{ text: '5 — Target Outcomes', options: { fontFace: FONT_BODY } }, { text: 'Current vs Forter KPI table', options: { fontFace: FONT_BODY } }, { text: 'Auto-populated', options: { fontFace: FONT_BODY, color: GREEN } }],
    [{ text: '6 — ROI Summary', options: { fontFace: FONT_BODY } }, { text: '3-year projection (if investment entered)', options: { fontFace: FONT_BODY } }, { text: 'Auto-populated', options: { fontFace: FONT_BODY, color: GREEN } }],
    [{ text: '7 — Next Steps ✏️', options: { fontFace: FONT_BODY, bold: true } }, { text: 'Action items and stakeholder names', options: { fontFace: FONT_BODY } }, { text: 'MUST BE EDITED MANUALLY', options: { fontFace: FONT_BODY, color: RED, bold: true } }],
    [{ text: '8+ — Appendix', options: { fontFace: FONT_BODY } }, { text: 'Calculator detail slides (may span multiple pages)', options: { fontFace: FONT_BODY } }, { text: 'Auto-populated', options: { fontFace: FONT_BODY, color: GREEN } }],
  ];
  slideHowTo.addTable(mapRows, {
    x: 0.5, y: 3.85, w: 12.33,
    colW: [2.8, 5.8, 3.73],
    fontSize: 9, fontFace: FONT_BODY,
    border: { pt: 0.5, color: 'E5E7EB' },
    rowH: 0.28,
  });

  // ===== SLIDE 1: Title =====
  const slide1 = pptx.addSlide();
  applyDarkSlide(slide1);
  slide1.addText(customerName, {
    x: 0.44, y: 1.28, w: 7.5, h: 1.2,
    fontSize: 52, bold: true, color: WHITE, fontFace: FONT_HEAD,
  });
  slide1.addText(`${customerName} x Forter Business Value Assessment`, {
    x: 0.44, y: 2.48, w: 7.5, h: 0.7,
    fontSize: 28, bold: true, color: WHITE, fontFace: FONT_HEAD,
  });
  slide1.addText(headline, {
    x: 0.44, y: 3.28, w: 7.5, h: 0.7,
    fontSize: 11, color: 'A5C8FF', fontFace: FONT_BODY, italic: false,
  });
  slide1.addShape('line', {
    x: 0.44, y: 4.15, w: 7.0, h: 0,
    line: { color: WHITE, pt: 0.5, transparency: 75 },
  });
  slide1.addText(new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), {
    x: 0.44, y: 4.35, w: 4.0, h: 0.35,
    fontSize: 11, bold: true, color: WHITE, fontFace: FONT_BODY,
  });

  // ===== SLIDE 2: Executive Summary =====
  const slide2 = pptx.addSlide();
  applyContentSlide(slide2, 2);
  addSlideTitle(slide2, 'Executive Summary', headline);
  slide2.addText('Key Challenges Identified', {
    x: 0.5, y: 1.28, w: 5.8, h: 0.22,
    fontSize: 9, bold: true, color: BLUE, fontFace: FONT_HEAD, charSpacing: 1.5,
  });
  problems.slice(0, 3).forEach((p, i) => {
    slide2.addText([
      { text: '→  ', options: { color: BLUE, bold: true } },
      { text: p, options: { color: '374151' } },
    ], { x: 0.5, y: 1.52 + i * 0.44, w: 5.8, h: 0.38, fontSize: 11, fontFace: FONT_BODY });
  });
  slide2.addText('Recommended Approach', {
    x: 0.5, y: 2.9, w: 5.8, h: 0.22,
    fontSize: 9, bold: true, color: BLUE, fontFace: FONT_HEAD, charSpacing: 1.5,
  });
  solutions.slice(0, 2).forEach((s, i) => {
    slide2.addText([
      { text: '→  ', options: { color: BLUE, bold: true } },
      { text: s, options: { color: '374151' } },
    ], { x: 0.5, y: 3.14 + i * 0.44, w: 5.8, h: 0.38, fontSize: 11, fontFace: FONT_BODY });
  });
  slide2.addText('Value at Stake', {
    x: 6.8, y: 1.28, w: 6.0, h: 0.22,
    fontSize: 9, bold: true, color: BLUE, fontFace: FONT_HEAD, charSpacing: 1.5,
  });
  const valueCategories = [
    valueTotals.gmvUplift > 0 && { label: 'GMV Uplift', sub: 'Revenue recovered from false declines & funnel', val: formatCurrency(valueTotals.gmvUplift, currency) },
    valueTotals.costReduction > 0 && { label: 'Cost Reduction', sub: 'Operational & chargeback savings', val: formatCurrency(valueTotals.costReduction, currency) },
    valueTotals.riskMitigation > 0 && { label: 'Risk Mitigation', sub: 'Fraud & abuse losses prevented', val: formatCurrency(valueTotals.riskMitigation, currency) },
  ].filter(Boolean) as { label: string; sub: string; val: string }[];
  const cardH = 0.72;
  const cardGap = 0.08;
  valueCategories.forEach((card, i) => {
    const yPos = 1.52 + i * (cardH + cardGap);
    slide2.addShape('rect', { x: 6.8, y: yPos, w: 6.0, h: cardH, fill: { color: WHITE }, line: { color: 'E5E7EB', pt: 0.75 } });
    slide2.addText(card.label, { x: 6.95, y: yPos + 0.06, w: 3.5, h: 0.22, fontSize: 10.5, color: GRAY, fontFace: FONT_BODY });
    slide2.addText(card.sub, { x: 6.95, y: yPos + 0.3, w: 3.5, h: 0.18, fontSize: 8, color: '9CA3AF', fontFace: FONT_BODY });
    slide2.addText(card.val, { x: 9.5, y: yPos + 0.1, w: 3.1, h: 0.5, fontSize: 22, bold: true, color: GREEN, align: 'right', fontFace: FONT_HEAD });
  });
  const ebitdaY = 1.52 + valueCategories.length * (cardH + cardGap) + 0.14;
  // Annual EBITDA block: dark navy (same shape API as Slide 3 navy bar so fill renders reliably)
  slide2.addShape('rect', {
    x: 6.8, y: ebitdaY, w: 6.0, h: 0.95,
    fill: { color: '0D1B3E' },
  });
  // Title and value: keep value right-aligned; title and description stay left so they don't overlap
  const ebitdaValueX = 9.5;
  const ebitdaLeftW = ebitdaValueX - 6.95 - 0.08; // width for left column (title + description) so value has clear space
  slide2.addText('Annual EBITDA Contribution', {
    x: 6.95, y: ebitdaY + 0.06, w: ebitdaLeftW, h: 0.26,
    fontSize: 11, bold: true, color: 'FFFFFF', fontFace: FONT_HEAD,
  });
  slide2.addText('Total of above, applying commission & gross margin to GMV Uplift · Net of deduplication', {
    x: 6.95, y: ebitdaY + 0.32, w: ebitdaLeftW, h: 0.5,
    fontSize: 8, color: '86EFAC', fontFace: FONT_BODY, wrap: true, valign: 'top',
  });
  slide2.addText(formatCurrency(valueTotals.ebitdaContribution, currency), {
    x: ebitdaValueX, y: ebitdaY + 0.12, w: 12.8 - ebitdaValueX, h: 0.6,
    fontSize: 22, bold: true, color: '86EFAC', align: 'right', fontFace: FONT_HEAD,
  });
  const roiY = ebitdaY + 0.95 + 0.1;
  const miniCards = [
    options.hasInvestment && { label: 'Return on Investment', val: `${roiResults.roi.toFixed(1)}×` },
    { label: 'Expected 3yr EBITDA (incl. ramp time)', val: formatCurrency(roiResults.totalProjection?.netEBITDAContribution ?? 0, currency) },
  ].filter(Boolean) as { label: string; val: string }[];
  const miniW = miniCards.length === 1 ? 6.0 : 2.94;
  miniCards.forEach((mc, i) => {
    const xPos = 6.8 + i * (miniW + 0.12);
    slide2.addShape('rect', { x: xPos, y: roiY, w: miniW, h: 0.7, fill: { color: WHITE }, line: { color: 'E5E7EB', pt: 0.75 } });
    slide2.addText(mc.label, { x: xPos + 0.12, y: roiY + 0.06, w: miniW - 0.2, h: 0.22, fontSize: 8, color: GRAY, fontFace: FONT_BODY });
    slide2.addText(mc.val, { x: xPos + 0.12, y: roiY + 0.3, w: miniW - 0.2, h: 0.32, fontSize: 16, bold: true, color: BLUE, fontFace: FONT_HEAD });
  });

  // ===== SLIDE 3: Value Summary =====
  const slide3 = pptx.addSlide();
  applyContentSlide(slide3, 3);
  addSlideTitle(slide3, 'Value Summary');
  const activeCategories = [
    valueTotals.gmvUplift > 0 && {
      label: 'GMV Uplift', value: formatCurrency(valueTotals.gmvUplift, currency),
      items: (valueTotals.gmvUpliftBreakdown || []).filter(b => b.value > 0),
    },
    valueTotals.costReduction > 0 && {
      label: 'Cost Reduction', value: formatCurrency(valueTotals.costReduction, currency),
      items: (valueTotals.costReductionBreakdown || []).filter(b => b.value > 0),
    },
    valueTotals.riskMitigation > 0 && {
      label: 'Risk Mitigation', value: formatCurrency(valueTotals.riskMitigation, currency),
      items: (valueTotals.riskMitigationBreakdown || []).filter(b => b.value > 0),
    },
  ].filter(Boolean) as { label: string; value: string; items: { label: string; value: number }[] }[];
const cardW = activeCategories.length === 1 ? 5.5 : activeCategories.length === 2 ? 6.0 : 4.1;
    const valueSummaryGap = 0.15;
    activeCategories.forEach((cat, i) => {
      const xPos = 0.5 + i * (cardW + valueSummaryGap);
    slide3.addShape('rect', { x: xPos, y: 1.28, w: cardW, h: 2.6, fill: { color: WHITE }, line: { color: 'E5E7EB', pt: 0.75 } });
    slide3.addText(cat.label.toUpperCase(), { x: xPos + 0.18, y: 1.38, w: cardW - 0.36, h: 0.2, fontSize: 9, bold: true, color: BLUE, fontFace: FONT_HEAD, charSpacing: 1.5 });
    slide3.addText(cat.value, { x: xPos + 0.18, y: 1.6, w: cardW - 0.36, h: 0.6, fontSize: 28, bold: true, color: GREEN, fontFace: FONT_HEAD });
    slide3.addShape('line', { x: xPos + 0.18, y: 2.25, w: cardW - 0.36, h: 0, line: { color: 'E5E7EB', pt: 0.5 } });
    cat.items.slice(0, 3).forEach((item, j) => {
      slide3.addText(item.label, { x: xPos + 0.18, y: 2.34 + j * 0.34, w: cardW - 1.0, h: 0.3, fontSize: 9, color: GRAY, fontFace: FONT_BODY });
      slide3.addText(formatCurrency(item.value, currency), { x: xPos + cardW - 1.1, y: 2.34 + j * 0.34, w: 0.9, h: 0.3, fontSize: 9, bold: true, color: NAVY, align: 'right', fontFace: FONT_BODY });
    });
  });
  slide3.addShape('rect', { x: 0.5, y: 4.08, w: 12.33, h: 0.72, fill: { color: NAVY } });
  slide3.addText('Annual EBITDA Contribution', { x: 0.75, y: 4.18, w: 7.0, h: 0.3, fontSize: 14, bold: true, color: WHITE, fontFace: FONT_HEAD });
  slide3.addText('Net of deduplication assumptions', { x: 0.75, y: 4.46, w: 7.0, h: 0.22, fontSize: 8, color: '9CA3AF', fontFace: FONT_BODY });
  slide3.addText(formatCurrency(valueTotals.ebitdaContribution, currency), { x: 7.0, y: 4.12, w: 5.63, h: 0.6, fontSize: 24, bold: true, color: '86EFAC', align: 'right', fontFace: FONT_HEAD });
  slide3.addText('KEY PERFORMANCE IMPROVEMENTS', { x: 0.5, y: 4.95, w: 12.33, h: 0.22, fontSize: 8, bold: true, color: NAVY, fontFace: FONT_HEAD, charSpacing: 1 });
  const positiveKPIs = performanceHighlights
    .filter(kpi => kpi.improvement && !kpi.improvement.startsWith('-'))
    .slice(0, 10);
  positiveKPIs.forEach((kpi, i) => {
    const col = i % 5;
    const row = Math.floor(i / 5);
    const pillX = 0.5 + col * 2.42;
    const pillY = 5.18 + row * 1.0;
    const impDisplay = (kpi.improvement ?? '').replace(/^\+/, '');
    slide3.addShape('rect', { x: pillX, y: pillY, w: 2.38, h: 0.88, fill: { color: WHITE }, line: { color: 'E5E7EB', pt: 0.75 } });
    slide3.addText(kpi.metric, { x: pillX + 0.12, y: pillY + 0.06, w: 2.14, h: 0.22, fontSize: 8, color: GRAY, fontFace: FONT_BODY });
    slide3.addText(impDisplay, { x: pillX + 0.12, y: pillY + 0.3, w: 2.14, h: 0.34, fontSize: 16, bold: true, color: GREEN, fontFace: FONT_HEAD });
    slide3.addText(`${kpi.current} → ${kpi.target}`, { x: pillX + 0.12, y: pillY + 0.66, w: 2.14, h: 0.2, fontSize: 7, color: '9CA3AF', fontFace: FONT_BODY });
  });
  
  // ===== SLIDE 4: Value Drivers =====
  const slideDrivers = pptx.addSlide();
  applyContentSlide(slideDrivers, 4);
  addSlideTitle(slideDrivers, 'Value Drivers');
  const driverTableRows: Array<Array<{ text: string; options?: any }>> = [
    [hdr('Value Driver', 'left'), hdr('Annual Value', 'right')],
  ];
  allDrivers.forEach((driver, idx) => {
    const rowBg = idx % 2 === 1 ? ALT_ROW : WHITE;
    driverTableRows.push([
      { text: driver.label, options: { fontFace: FONT_BODY, fill: { color: rowBg } } },
      { text: formatCurrency(driver.value, currency), options: { align: 'right', color: GREEN, bold: true, fontFace: FONT_BODY, fill: { color: rowBg } } },
    ]);
  });
  driverTableRows.push([
    { text: 'Total', options: { bold: true, fill: { color: NAVY }, color: WHITE, fontFace: FONT_HEAD } },
    { text: formatCurrency(valueTotals.ebitdaContribution, currency), options: { align: 'right', bold: true, fill: { color: NAVY }, color: WHITE, fontFace: FONT_HEAD } },
  ]);
  const baseDriverRowHeight = 0.62;
  const availableDriverHeight = 5.5;
  const neededDriverHeight = driverTableRows.length * baseDriverRowHeight;
  let driverFontSize = 14;
  let driverRowHeight = baseDriverRowHeight;
  if (neededDriverHeight > availableDriverHeight) {
    const scale = availableDriverHeight / neededDriverHeight;
    driverFontSize = Math.max(12, Math.floor(14 * scale));
    driverRowHeight = Math.max(0.38, baseDriverRowHeight * scale);
  }
  slideDrivers.addTable(driverTableRows, {
    x: 0.5, y: 1.15, w: 12.33,
    colW: [9.5, 2.83],
    fontSize: driverFontSize,
    fontFace: FONT_BODY,
    border: { pt: 0.5, color: 'E5E7EB' },
    rowH: driverRowHeight,
  });

  // ===== SLIDE 5: Target Outcomes =====
  const slideKPIs = pptx.addSlide();
  applyContentSlide(slideKPIs, 5);
  addSlideTitle(slideKPIs, 'Target Outcomes');
  const kpiTableRows: Array<Array<{ text: string; options?: any }>> = [
    [hdr('Key Metric', 'left'), hdr('Current', 'center'), hdr('With Forter', 'center'), hdr('Improvement', 'center')],
  ];
  performanceHighlights.forEach(m => {
    const impColor = m.improvement?.startsWith('-') ? RED : GREEN;
    kpiTableRows.push([
      { text: m.metric, options: { fontFace: FONT_BODY } },
      { text: m.current, options: { align: 'center', fontFace: FONT_BODY } },
      { text: m.target, options: { align: 'center', color: GREEN, bold: true, fontFace: FONT_BODY } },
      { text: m.improvement ?? '—', options: { align: 'center', color: impColor, bold: true, fontFace: FONT_HEAD } },
    ]);
  });
  slideKPIs.addTable(kpiTableRows, {
    x: 0.5, y: 1.15, w: 12.33,
    colW: [5.0, 2.5, 2.5, 2.33],
    fontSize: 13,
    fontFace: FONT_BODY,
    border: { pt: 0.5, color: 'E5E7EB' },
    rowH: 0.72,
  });

  // ===== SLIDE 6: ROI Summary (only if investment is present) =====
  if (options.hasInvestment) {
    const slideROI = pptx.addSlide();
    applyContentSlide(slideROI, 6);
    addSlideTitle(slideROI, 'ROI Summary');
    const contractTenure = roiResults.yearProjections.length || 3;
    const roiMetrics = [
      { label: 'ROI', value: `${roiResults.roi.toFixed(1)}×`, greenBorder: false },
      { label: 'Payback Period', value: roiResults.paybackPeriodMonths > 0 ? `${roiResults.paybackPeriodMonths} mo` : 'Immediate', greenBorder: false },
      { label: 'Contract Tenure', value: `${contractTenure} years`, greenBorder: false },
      { label: 'Expected 3yr EBITDA (incl. ramp time)', value: formatCurrency(roiResults.totalProjection?.netEBITDAContribution ?? 0, currency), greenBorder: true },
    ];
    roiMetrics.forEach((metric, idx) => {
      const xPos = 0.5 + (idx % 2) * 6.4;
      const yPos = 1.2 + Math.floor(idx / 2) * 1.5;
      slideROI.addShape('rect', {
        x: xPos, y: yPos, w: 6.0, h: 1.35,
        fill: { color: WHITE },
        line: { color: metric.greenBorder ? GREEN : BLUE, pt: 2 },
      });
      slideROI.addText(metric.label, { x: xPos + 0.15, y: yPos + 0.1, w: 5.7, h: 0.3, fontSize: 11, color: GRAY, fontFace: FONT_BODY });
      slideROI.addText(metric.value, { x: xPos + 0.15, y: yPos + 0.5, w: 5.7, h: 0.7, fontSize: 24, bold: true, color: metric.greenBorder ? GREEN : BLUE, fontFace: FONT_HEAD });
    });
    const roiTableRows: Array<Array<{ text: string; options?: any }>> = [
      [hdr('Year', 'left'), hdr('Gross EBITDA', 'right'), hdr('Forter Cost', 'right'), hdr('Net EBITDA', 'right')],
    ];
    roiResults.yearProjections.forEach(y => {
      roiTableRows.push([
        { text: `Year ${y.year}`, options: { fontFace: FONT_BODY } },
        { text: formatCurrency(y.runRateGrossEBITDA, currency), options: { align: 'right', fontFace: FONT_BODY } },
        { text: formatCurrency(y.forterSaaSCost + y.integrationCost, currency), options: { align: 'right', fontFace: FONT_BODY } },
        { text: formatCurrency(y.netEBITDAContribution, currency), options: { align: 'right', color: GREEN, bold: true, fontFace: FONT_BODY } },
      ]);
    });
    roiTableRows.push([
      { text: 'Total', options: { bold: true, fill: { color: NAVY }, color: WHITE, fontFace: FONT_HEAD } },
      { text: formatCurrency(roiResults.totalProjection.runRateGrossEBITDA, currency), options: { align: 'right', bold: true, fill: { color: NAVY }, color: WHITE, fontFace: FONT_HEAD } },
      { text: formatCurrency(roiResults.totalProjection.forterSaaSCost + roiResults.totalProjection.integrationCost, currency), options: { align: 'right', bold: true, fill: { color: NAVY }, color: WHITE, fontFace: FONT_HEAD } },
      { text: formatCurrency(roiResults.totalProjection.netEBITDAContribution, currency), options: { align: 'right', bold: true, fill: { color: NAVY }, color: '86EFAC', fontFace: FONT_HEAD } },
    ]);
    slideROI.addTable(roiTableRows, {
      x: 0.5, y: 4.2, w: 12.33,
      colW: [1.5, 3.5, 3.5, 3.83],
      fontSize: 10,
      fontFace: FONT_BODY,
      border: { pt: 0.5, color: 'E5E7EB' },
      rowH: 0.45,
    });
  }
  
  // ===== SLIDE 7: Next Steps =====
  const slideNext = pptx.addSlide();
  applyContentSlide(slideNext, options.hasInvestment ? 7 : 6);
  addSlideTitle(slideNext, 'Next Steps');
  slideNext.addShape('rect', { x: 0.5, y: 1.28, w: 12.33, h: 0.62, fill: { color: 'FEF3C7' }, line: { color: AMBER, pt: 1.5 } });
  slideNext.addText('✏️   Action required — Account Executive: All ', { x: 0.7, y: 1.38, w: 12.0, h: 0.42, fontSize: 10, color: '92400E', fontFace: FONT_BODY, bold: true });
  slideNext.addText('highlighted fields', { x: 4.15, y: 1.38, w: 1.5, h: 0.42, fontSize: 10, color: '78350F', fontFace: FONT_BODY, bold: true });
  slideNext.addText(' must be completed manually before sharing with the customer.', { x: 5.55, y: 1.38, w: 7.2, h: 0.42, fontSize: 10, color: '92400E', fontFace: FONT_BODY });
  const steps = options.hasInvestment
    ? [
        { num: '1', title: 'Investment & Pricing Discussion', body: 'Align on final investment structure with [Champion Name] to complete the full ROI model.' },
        { num: '2', title: 'Technical Integration Review', body: 'Schedule integration scoping session with [Technical Stakeholder] — target go-live [Target Date].' },
        { num: '3', title: 'Proof of Concept', body: 'Define POC success metrics and scope with [Stakeholder]. Timeline: [X weeks].' },
        { num: '4', title: 'Executive Alignment & Sign-off', body: 'Present business case to [Executive Sponsor] by [Date] and initiate contract review.' },
      ]
    : [
        { num: '1', title: 'Finalise Investment Discussion', body: 'Complete pricing and investment structure with [Champion Name] to finish ROI analysis.' },
        { num: '2', title: 'Technical Integration Review', body: 'Schedule scoping session with [Technical Stakeholder] — target go-live [Target Date].' },
        { num: '3', title: 'Proof of Concept', body: 'Define POC success metrics with [Stakeholder]. Timeline: [X weeks].' },
        { num: '4', title: 'Executive Alignment & Sign-off', body: 'Present to [Executive Sponsor] by [Date] and initiate contract review.' },
      ];
  steps.forEach((step, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const xPos = 0.5 + col * 6.3;
    const yPos = 2.05 + row * 2.3;
    slideNext.addShape('rect', { x: xPos, y: yPos, w: 6.02, h: 2.1, fill: { color: WHITE }, line: { color: 'E5E7EB', pt: 0.75 } });
    slideNext.addShape('ellipse', { x: xPos + 0.18, y: yPos + 0.18, w: 0.44, h: 0.44, fill: { color: BLUE } });
    slideNext.addText(step.num, { x: xPos + 0.18, y: yPos + 0.18, w: 0.44, h: 0.44, fontSize: 14, bold: true, color: WHITE, align: 'center', valign: 'middle', fontFace: FONT_HEAD });
    slideNext.addText(step.title, { x: xPos + 0.72, y: yPos + 0.2, w: 5.1, h: 0.38, fontSize: 13, bold: true, color: NAVY, fontFace: FONT_HEAD });
    slideNext.addText(step.body, { x: xPos + 0.18, y: yPos + 0.66, w: 5.65, h: 1.3, fontSize: 11, color: '374151', fontFace: FONT_BODY, valign: 'top' });
  });

  // ===== CASE STUDIES: One slide per benefit with a case study (before Appendix) =====
  const caseStudySlideNumbers = getCaseStudySlideNumbersInOrder();
  let caseStudiesPageNum = options.hasInvestment ? 8 : 7;
  if (caseStudySlideNumbers.length > 0) {
    const slideCaseStudiesTitle = pptx.addSlide();
    applyDarkSlide(slideCaseStudiesTitle);
    slideCaseStudiesTitle.addText('Case Studies', {
      x: 0.5, y: 2.8, w: 12.3, h: 1.2,
      fontSize: 52, bold: true, color: WHITE, align: 'center', fontFace: FONT_HEAD,
    });
    slideCaseStudiesTitle.addText('Success stories from the GVA Case Study Deck', {
      x: 0.5, y: 4.0, w: 12.3, h: 0.5,
      fontSize: 16, color: 'A5C8FF', align: 'center', fontFace: FONT_BODY,
    });
    caseStudiesPageNum += 1;
    for (const slideNum of caseStudySlideNumbers) {
      const imageUrl = `/case-studies/slide${slideNum}.png`;
      try {
        const resp = await fetch(imageUrl);
        if (!resp.ok) continue;
        const buf = await resp.arrayBuffer();
        const base64 = arrayBufferToBase64(buf);
        const slideCase = pptx.addSlide();
        applyContentSlide(slideCase, caseStudiesPageNum++);
        slideCase.addImage({
          data: `image/png;base64,${base64}`,
          x: 0.5, y: 0.5, w: 12.33, h: 6.2,
        });
      } catch {
        // Skip this slide if image fails to load
      }
    }
  }

  // ===== APPENDIX: Calculator Details (with multi-page split, max 18 rows per slide) =====
  const activeBenefitGroups = getActiveBenefitGroups(challenges);
  const MAX_ROWS_PER_SLIDE = 18;
  let appendixPageNum = caseStudiesPageNum;

  if (activeBenefitGroups.length > 0) {
    const slideAppendixTitle = pptx.addSlide();
    applyDarkSlide(slideAppendixTitle);
    slideAppendixTitle.addText('Appendix', {
      x: 0.5, y: 2.8, w: 12.3, h: 1.2,
      fontSize: 52, bold: true, color: WHITE, align: 'center', fontFace: FONT_HEAD,
    });
    slideAppendixTitle.addText('Calculator Details & Methodology', {
      x: 0.5, y: 4.0, w: 12.3, h: 0.5,
      fontSize: 16, color: 'A5C8FF', align: 'center', fontFace: FONT_BODY,
    });

    const colWCalc = [1.07, 4.07, 1.97, 1.97, 3.25];
    const headerRow = [
      { text: 'Formula', options: { bold: true, fill: { color: '374151' }, color: WHITE, fontFace: FONT_HEAD, fontSize: 10 } },
      { text: 'Description', options: { bold: true, fill: { color: NAVY }, color: WHITE, fontFace: FONT_HEAD, fontSize: 10 } },
      { text: 'Customer Inputs', options: { bold: true, fill: { color: NAVY }, color: WHITE, align: 'right', fontFace: FONT_HEAD, fontSize: 10 } },
      { text: 'Forter Improvement', options: { bold: true, fill: { color: BLUE }, color: WHITE, align: 'right', fontFace: FONT_HEAD, fontSize: 10 } },
      { text: 'Forter Outcome', options: { bold: true, fill: { color: NAVY }, color: WHITE, align: 'right', fontFace: FONT_HEAD, fontSize: 10 } },
    ];

    const getCategoryBadge = (group: BenefitGroup): { label: string; bgColor: string; textColor: string } | null => {
      if (['payment-fraud-c1', 'payment-optimization-c245'].includes(group.id)) {
        return { label: 'GMV Uplift', bgColor: 'DBEAFE', textColor: '1D4ED8' };
      }
      if (['manual-review-c3', 'chargeback-recovery-c7', 'instant-refunds-c9', 'ato-protection-c12-13', 'signup-protection-c14-15'].includes(group.id)) {
        return { label: 'Cost Reduction', bgColor: 'FEF3C7', textColor: '92400E' };
      }
      if (['returns-abuse-c8', 'promotion-abuse-c10'].includes(group.id)) {
        return { label: 'Risk Mitigation', bgColor: 'FCE7F3', textColor: '9D174D' };
      }
      return null;
    };
    activeBenefitGroups.forEach(group => {
      const calculatorTables = getCalculatorRowsForBenefitGroup(group, formData);
      calculatorTables.forEach(calc => {
        const calcId = group.calculatorIds.find(id => {
          const content = getChallengeBenefitContent(id);
          return content?.benefitTitle === calc.title || (content?.benefitTitle?.toLowerCase().includes(calc.title.toLowerCase()) || calc.title.toLowerCase().includes(content?.benefitTitle?.toLowerCase() || ''));
        }) || group.calculatorIds[0];
        const benefitContent = getChallengeBenefitContent(calcId);
        const slideTitle = benefitContent?.benefitTitle || calc.title;
        const benefitDescription = benefitContent?.benefitDescription || group.solution;
        const challengeDescription = benefitContent?.challengeDescription || group.problem;
        const isTBD = isCalculatorTBD(calc.rows);

        if (isTBD) {
          const slideCalc = pptx.addSlide();
          applyContentSlide(slideCalc, appendixPageNum++);
          const badge = getCategoryBadge(group);
          if (badge) {
            slideCalc.addShape('rect', {
              x: 11.5, y: 0.1, w: 1.6, h: 0.26,
              fill: { color: badge.bgColor },
              line: { color: badge.bgColor, pt: 0 },
            });
            slideCalc.addText(badge.label, {
              x: 11.5, y: 0.1, w: 1.6, h: 0.26,
              fontSize: 7, bold: true, color: badge.textColor,
              align: 'center', valign: 'middle', fontFace: FONT_HEAD,
            });
          }
          slideCalc.addText(slideTitle, { x: 0.5, y: 0.38, w: 12.33, h: 0.5, fontSize: 22, bold: true, color: NAVY, fontFace: FONT_HEAD });
          slideCalc.addText('The Challenge', { x: 0.5, y: 1.0, w: 12.33, h: 0.25, fontSize: 12, bold: true, color: NAVY, fontFace: FONT_HEAD });
          slideCalc.addText(challengeDescription, { x: 0.5, y: 1.28, w: 12.33, h: 0.9, fontSize: 10, color: GRAY, fontFace: FONT_BODY, valign: 'top' });
          slideCalc.addText('The Forter Solution', { x: 0.5, y: 2.3, w: 12.33, h: 0.25, fontSize: 12, bold: true, color: BLUE, fontFace: FONT_HEAD });
          slideCalc.addText(benefitDescription, { x: 0.5, y: 2.58, w: 12.33, h: 0.8, fontSize: 10, color: GRAY, fontFace: FONT_BODY, valign: 'top' });
          if (benefitContent?.benefitPoints?.length) {
            slideCalc.addText('Key Benefits', { x: 0.5, y: 3.5, w: 12.33, h: 0.25, fontSize: 12, bold: true, color: NAVY, fontFace: FONT_HEAD });
            let bulletY = 3.8;
            benefitContent.benefitPoints.forEach((point: { title: string; description: string }) => {
              slideCalc.addText([
                { text: '• ', options: { bold: true, color: BLUE } },
                { text: `${point.title}: `, options: { bold: true, color: NAVY } },
                { text: point.description, options: { color: GRAY } },
              ], { x: 0.6, y: bulletY, w: 12.0, h: 0.35, fontSize: 9, fontFace: FONT_BODY, valign: 'top' });
              bulletY += 0.35;
            });
          }
          slideCalc.addText('Complete the customer inputs to generate detailed value calculations for this benefit.', { x: 0.5, y: 6.5, w: 12.33, h: 0.25, fontSize: 9, italic: true, color: GRAY, fontFace: FONT_BODY });
        } else {
          const dataRows: Array<{ isSection: boolean; row: typeof calc.rows[0] }> = [];
          calc.rows.forEach(row => {
            const isSection = !row.formula && !!row.label && !row.customerInput && !row.forterOutcome;
            dataRows.push({ isSection, row });
          });
          const totalPages = Math.ceil(dataRows.length / MAX_ROWS_PER_SLIDE) || 1;
          for (let page = 0; page < totalPages; page++) {
            const slideCalc = pptx.addSlide();
            applyContentSlide(slideCalc, appendixPageNum++);
            const badge = getCategoryBadge(group);
            if (badge) {
              slideCalc.addShape('rect', {
                x: 11.5, y: 0.1, w: 1.6, h: 0.26,
                fill: { color: badge.bgColor },
                line: { color: badge.bgColor, pt: 0 },
              });
              slideCalc.addText(badge.label, {
                x: 11.5, y: 0.1, w: 1.6, h: 0.26,
                fontSize: 7, bold: true, color: badge.textColor,
                align: 'center', valign: 'middle', fontFace: FONT_HEAD,
              });
            }
            const pageLabel = totalPages > 1 ? ` (Page ${page + 1} of ${totalPages})` : '';
            slideCalc.addText(slideTitle + pageLabel, { x: 0.5, y: 0.38, w: 12.33, h: 0.5, fontSize: 22, bold: true, color: NAVY, fontFace: FONT_HEAD });
            slideCalc.addText(benefitDescription, { x: 0.5, y: 0.92, w: 12.33, h: 0.35, fontSize: 10, color: GRAY, fontFace: FONT_BODY });
            const start = page * MAX_ROWS_PER_SLIDE;
            const end = Math.min(start + MAX_ROWS_PER_SLIDE, dataRows.length);
            const pageRows = dataRows.slice(start, end);
            const calcTableRows: Array<Array<{ text: string; options?: any }>> = [headerRow.map(c => ({ text: c.text, options: { ...c.options } }))];
            pageRows.forEach(({ isSection, row: r }) => {
              if (isSection) {
                calcTableRows.push([
                  { text: (r.label || '').toUpperCase(), options: { bold: true, fill: { color: 'E5E7EB' }, color: NAVY, fontFace: FONT_HEAD, fontSize: 8.5, colspan: 5 } },
                  { text: '', options: {} }, { text: '', options: {} }, { text: '', options: {} }, { text: '', options: {} },
                ]);
              } else {
                const isValueDriver = !!r.valueDriver;
                const rowFill = isValueDriver ? GREEN_FILL : (calcTableRows.length % 2 === 0 ? ALT_ROW : WHITE);
                const textColor = isValueDriver ? GREEN_TEXT : undefined;
                const impColor = r.forterImprovement?.startsWith('-') || r.forterImprovement?.startsWith('(') ? RED : GREEN;
                const formulaOpts = { fontFace: 'Courier New', fontSize: 8, fill: { color: rowFill }, color: isValueDriver ? GREEN_TEXT : GRAY };
                calcTableRows.push([
                  { text: r.formula || '', options: formulaOpts },
                  { text: r.label || '', options: { fontFace: FONT_BODY, fontSize: 8, fill: { color: rowFill }, color: textColor, bold: isValueDriver } },
                  { text: r.customerInput || '', options: { align: 'right', fontFace: FONT_BODY, fontSize: 8, fill: { color: rowFill }, color: textColor, bold: isValueDriver } },
                  { text: r.forterImprovement || '', options: { align: 'right', fontFace: FONT_BODY, fontSize: 8, color: impColor, fill: { color: rowFill }, bold: isValueDriver } },
                  { text: r.forterOutcome || '', options: { align: 'right', fontFace: FONT_BODY, fontSize: 8, bold: isValueDriver, fill: { color: rowFill }, color: textColor } },
                ]);
              }
            });
            if (page < totalPages - 1 && pageRows.length > 0) {
              calcTableRows.push([
                { text: '→ Continued on next slide', options: { italic: true, fontSize: 8, color: GRAY, fontFace: FONT_BODY, colspan: 5 } },
                { text: '', options: {} }, { text: '', options: {} }, { text: '', options: {} }, { text: '', options: {} },
              ]);
            }
            const rowH = Math.min(0.22, (4.2 - 1.5) / Math.max(calcTableRows.length, 1));
            slideCalc.addTable(calcTableRows, {
              x: 0.5, y: 1.4, w: 12.33,
              colW: colWCalc,
              fontSize: 8,
              fontFace: FONT_BODY,
              border: { pt: 0.5, color: 'E5E7EB' },
              rowH,
            });
          }
        }
      });
    });
  }

  // Save using blob and file-saver for compatibility
  // Format: Forter_x_AnalysisName_Value_Assessment (MMDDYY).pptx
  const blob = await pptx.write({ outputType: 'blob' }) as Blob;
  const dateStr = formatDateMMDDYY();
  const sanitizedName = analysisName.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Forter_x_${sanitizedName}_Value_Assessment (${dateStr}).pptx`;
  saveAs(blob, filename);
}
