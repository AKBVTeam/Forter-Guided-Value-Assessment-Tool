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

// Forter brand colors from official template (hex without #)
const FORTER_BLUE = '0066FF';        // Primary accent blue (for headers/accents)
const FORTER_NAVY = '1A2B4A';        // Dark navy for title slide backgrounds
const FORTER_DARK = '1E3A5F';        // Dark blue for headings
const FORTER_GRAY = '666666';        // Body text gray
const FORTER_LIGHT_BG = 'EEF2F6';    // Light grayish-blue background
const FORTER_LIGHT_GRAY = 'F5F5F5';  // Light gray for table backgrounds
const FORTER_WHITE = 'FFFFFF';       // White
const FORTER_GREEN = FORTER_BLUE;    // Alias: use blue instead of green for brand consistency

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

// Get problem statements from active benefit groups
function getSelectedChallengeProblems(challenges: Record<string, boolean>): string[] {
  const activeGroups = getActiveBenefitGroups(challenges);
  return activeGroups.slice(0, 4).map(g => g.problem);
}

// Get solution approaches from active benefit groups
function getSolutionApproaches(challenges: Record<string, boolean>): string[] {
  const activeGroups = getActiveBenefitGroups(challenges);
  return activeGroups.slice(0, 4).map(g => g.solution);
}

// Generate headline based on value
function generateHeadline(formData: CalculatorData, valueTotals: ValueTotals): string {
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
 * For segmented analysis: generates one slide per segment + a Total slide
 * For non-segmented: generates a single slide
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
  const analysisName = (formData as any)._analysisName || formData.customerName || 'Customer';
  const currency = formData.baseCurrency || 'USD';
  
  // Define default font for all text
  const FONT_FACE = 'Proxima Nova';
  const withFont = (opts: any) => ({ ...opts, fontFace: FONT_FACE });
  
  // Get benefit content for the calculator
  const benefitContent = getChallengeBenefitContent(calculatorId);
  
  // Helper function to create a TBD narrative slide (no calculator table)
  const createTBDNarrativeSlide = (
    slideTitle: string,
    challengeDescription: string,
    benefitDescription: string,
    benefitPoints?: { title: string; description: string }[],
    segmentLabel?: string
  ) => {
    const slide = pptx.addSlide();
    
    // Title = Benefit Name (+ segment label if applicable)
    const fullTitle = segmentLabel ? `${slideTitle} - ${segmentLabel}` : slideTitle;
    slide.addText(fullTitle, withFont({
      x: 0.3, y: 0.2, w: '95%', h: 0.5,
      fontSize: 22, bold: true, color: FORTER_DARK,
    }));
    
    // Challenge Section
    slide.addText('The Challenge', withFont({
      x: 0.3, y: 1.15, w: '95%', h: 0.3,
      fontSize: 14, bold: true, color: FORTER_DARK,
    }));
    
    slide.addText(challengeDescription, withFont({
      x: 0.3, y: 1.45, w: '95%', h: 0.8,
      fontSize: 10, color: FORTER_GRAY,
      valign: 'top',
    }));
    
    // Benefit Section
    slide.addText('The Forter Solution', withFont({
      x: 0.3, y: 2.35, w: '95%', h: 0.3,
      fontSize: 14, bold: true, color: FORTER_BLUE,
    }));
    
    slide.addText(benefitDescription, withFont({
      x: 0.3, y: 2.65, w: '95%', h: 0.7,
      fontSize: 10, color: FORTER_GRAY,
      valign: 'top',
    }));
    
    // Key Benefits Section (bullet points)
    if (benefitPoints && benefitPoints.length > 0) {
      slide.addText('Key Benefits', withFont({
        x: 0.3, y: 3.45, w: '95%', h: 0.3,
        fontSize: 12, bold: true, color: FORTER_DARK,
      }));
      
      let bulletY = 3.75;
      benefitPoints.forEach((point, idx) => {
        // Bullet point with title and description
        slide.addText([
          { text: '• ', options: { bold: true, color: FORTER_BLUE } },
          { text: `${point.title}: `, options: { bold: true, color: FORTER_DARK } },
          { text: point.description, options: { color: FORTER_GRAY } },
        ], withFont({
          x: 0.4, y: bulletY, w: '90%', h: 0.35,
          fontSize: 9,
          valign: 'top',
        }));
        bulletY += 0.35;
      });
    }
    
    // Footer note
    slide.addText('Complete the customer inputs to generate detailed value calculations for this benefit.', withFont({
      x: 0.3, y: 5.0, w: '95%', h: 0.3,
      fontSize: 9, italic: true, color: FORTER_GRAY,
    }));
  };

  // Helper function to create a slide with a calculator table
  const createCalculatorSlide = (
    slideTitle: string,
    slideSubtitle: string | undefined,
    rows: CalculatorRow[],
    segmentLabel?: string
  ) => {
    const slide = pptx.addSlide();
    
    // Title = Benefit Name (+ segment label if applicable)
    const fullTitle = segmentLabel ? `${slideTitle} - ${segmentLabel}` : slideTitle;
    slide.addText(fullTitle, withFont({
      x: 0.3, y: 0.2, w: '95%', h: 0.45,
      fontSize: 18, bold: true, color: FORTER_DARK,
    }));
    
    // Benefit text paragraph
    if (slideSubtitle) {
      slide.addText(slideSubtitle, withFont({
        x: 0.3, y: 0.6, w: '95%', h: 0.4,
        fontSize: 9, color: FORTER_GRAY,
      }));
    }
    
    let yPosition = slideSubtitle ? 1.05 : 0.7;
    
    // Build the full calculator table
    const calcTableRows: Array<Array<{ text: string; options?: any }>> = [
      [
        { text: 'Formula', options: { bold: true, fill: { color: FORTER_DARK }, color: 'FFFFFF', fontFace: FONT_FACE } },
        { text: 'Description', options: { bold: true, fill: { color: FORTER_DARK }, color: 'FFFFFF', fontFace: FONT_FACE } },
        { text: 'Customer inputs', options: { bold: true, fill: { color: FORTER_DARK }, color: 'FFFFFF', align: 'right', fontFace: FONT_FACE } },
        { text: 'Forter improvement', options: { bold: true, fill: { color: FORTER_BLUE }, color: 'FFFFFF', align: 'right', fontFace: FONT_FACE } },
        { text: 'Forter outcome', options: { bold: true, fill: { color: FORTER_DARK }, color: 'FFFFFF', align: 'right', fontFace: FONT_FACE } },
      ],
    ];
    
    // Track totals for value driver rows
    // For each value driver type (revenue, profit, cost), we want the LAST row
    // because that represents the final/deduplicated value
    const valueDriverTotals: { [key: string]: { value: number; label: string } } = {};
    
    rows.forEach(row => {
      // Track value driver totals - use Forter improvement (delta) instead of outcome
      // Take the LAST value for each driver type (deduplicated value, not raw)
      if (row.valueDriver && row.forterImprovement) {
        const numericValue = parseFloat(row.forterImprovement.replace(/[^0-9.-]/g, ''));
        if (!isNaN(numericValue)) {
          const label = row.valueDriver === 'revenue' ? 'Total GMV Uplift' : 
                       row.valueDriver === 'profit' ? 'Total EBITDA Contribution' : 
                       row.valueDriver === 'cost' ? 'Total Cost Reduction' : 'Total Value';
          // Override previous value of same type - we want the final/deduplicated row
          valueDriverTotals[row.valueDriver] = { value: numericValue, label };
        }
      }
      
      // Skip section headers
      if (!row.formula && row.label && !row.customerInput && !row.forterOutcome) {
        calcTableRows.push([
          { text: row.label, options: { bold: true, fill: { color: FORTER_LIGHT_GRAY }, fontFace: FONT_FACE, colspan: 5 } },
          { text: '', options: {} },
          { text: '', options: {} },
          { text: '', options: {} },
          { text: '', options: {} },
        ]);
      } else {
        const isValueDriver = !!row.valueDriver;
        const rowBg = isValueDriver ? FORTER_LIGHT_BG : undefined;
        
        calcTableRows.push([
          { text: row.formula || '', options: { fontFace: 'Courier New', fontSize: 7, fill: rowBg ? { color: rowBg } : undefined } },
          { text: row.label || '', options: { fontFace: FONT_FACE, fontSize: 7, fill: rowBg ? { color: rowBg } : undefined } },
          { text: row.customerInput || '', options: { align: 'right', fontFace: FONT_FACE, fontSize: 7, fill: rowBg ? { color: rowBg } : undefined } },
          { text: row.forterImprovement || '', options: { align: 'right', fontFace: FONT_FACE, fontSize: 7, color: row.forterImprovement?.startsWith('-') || row.forterImprovement?.startsWith('(') ? 'CC0000' : FORTER_GREEN, fill: rowBg ? { color: rowBg } : undefined } },
          { text: row.forterOutcome || '', options: { align: 'right', fontFace: FONT_FACE, fontSize: 7, bold: isValueDriver, fill: rowBg ? { color: rowBg } : undefined } },
        ]);
      }
    });
    
    // Calculate font size to fit
    const baseRowHeight = 0.18;
    const availableHeight = 3.8;
    const neededHeight = calcTableRows.length * baseRowHeight;
    let fontSize = 7;
    let rowHeight = baseRowHeight;
    
    if (neededHeight > availableHeight) {
      const scale = availableHeight / neededHeight;
      fontSize = Math.max(5, Math.floor(7 * scale));
      rowHeight = Math.max(0.12, baseRowHeight * scale);
    }
    
    slide.addTable(calcTableRows, {
      x: 0.2, y: yPosition, w: 9.6,
      colW: [0.75, 3.8, 1.5, 1.5, 2.05],
      fontSize: fontSize,
      fontFace: FONT_FACE,
      border: { pt: 0.5, color: 'DDDDDD' },
      rowH: rowHeight,
    });
    
    // Callouts removed - the Forter improvement column already shows the value
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
  const [{ Document, Paragraph, Table, TableRow, TableCell, AlignmentType, WidthType, TextRun, Packer }, { saveAs }] = await Promise.all([
    import('docx'),
    import('file-saver'),
  ]);

  const analysisName = (formData as any)._analysisName || formData.customerName || 'Value Assessment';
  const customerName = formData.customerName || 'Customer';
  const currency = formData.baseCurrency || 'USD';
  const headline = generateHeadline(formData, valueTotals);
  const solutions = getSolutionApproaches(challenges);
  const performanceHighlights = buildPerformanceHighlights(formData, challenges);
  const topDrivers = getAllValueDrivers(challenges, valueTotals);
  
  // Determine if we should use strategic alignment (user selected strategic objectives)
  const useStrategicAlignment = options.selectedObjectives.length > 0;
  const strategicObjectives = getStrategicObjectiveDetails(options.selectedObjectives);
  const useCases = getUseCasesForChallenges(challenges);
  const problems = getSelectedChallengeProblems(challenges);

  // Template-style opportunity statement (from template)
  const opportunityStatement = `Because of rising fraud sophistication and payment friction, ${customerName} should implement an automated fraud decisioning solution by [TIMELINE]. After, ${customerName} will avoid ${formatCurrency(valueTotals.riskMitigation, currency, true)} in fraud losses while unlocking ${formatCurrency(valueTotals.gmvUplift, currency, true)} in recovered GMV.`;

  // Build document sections
  const documentChildren: any[] = [
    // Analysis name (included in all exports)
    new Paragraph({
      children: [
        new TextRun({
          text: `Analysis: ${analysisName}`,
          bold: true,
          size: 24,
          color: FORTER_DARK,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    // Priority-driven headline (template style)
    new Paragraph({
      children: [
        new TextRun({
          text: headline,
          bold: true,
          size: 32, // 16pt
          color: FORTER_DARK,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    
    // Developed by line
    new Paragraph({
      children: [
        new TextRun({
          text: 'Developed by: [Champion Name], [Key Deal Players]',
          italics: true,
          size: 20, // 10pt
          color: FORTER_GRAY,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    
    // HEADLINE section (template format)
    new Paragraph({
      children: [
        new TextRun({
          text: 'Headline',
          bold: true,
          size: 24, // 12pt
          color: FORTER_DARK,
        }),
      ],
      spacing: { before: 200, after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: opportunityStatement,
          size: 20,
        }),
      ],
      spacing: { after: 300 },
    }),
  ];

  // STRATEGIC ALIGNMENT or PROBLEM STATEMENT section
  if (useStrategicAlignment) {
    // Strategic Alignment section - focus on company priorities and use cases
    documentChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Strategic Alignment:',
            bold: true,
            size: 24,
            color: FORTER_DARK,
          }),
        ],
        spacing: { before: 200, after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `This initiative directly supports ${customerName}'s key strategic priorities:`,
            size: 20,
          }),
        ],
        spacing: { after: 120 },
      }),
      ...strategicObjectives.map(obj => 
        new Paragraph({
          children: [
            new TextRun({
              text: `• ${obj.name}: `,
              bold: true,
              size: 20,
            }),
            new TextRun({
              text: obj.description,
              size: 20,
            }),
          ],
          spacing: { after: 80 },
          indent: { left: 360 },
        })
      ),
      // Use Cases subsection
      new Paragraph({
        children: [
          new TextRun({
            text: 'Targeted Use Cases:',
            bold: true,
            size: 22,
            color: FORTER_DARK,
          }),
        ],
        spacing: { before: 200, after: 100 },
      }),
      ...useCases.map(uc => 
        new Paragraph({
          children: [
            new TextRun({
              text: `• ${uc.name}`,
              size: 20,
            }),
          ],
          spacing: { after: 60 },
          indent: { left: 360 },
        })
      )
    );
  } else {
    // Traditional Problem Statement section
    const problemStatementItems = problems.map((p, i) => {
      const driver = topDrivers[i];
      const cost = driver ? formatCurrency(driver.value, currency, true) : '[calculated cost]';
      return `${p}, costing approximately ${cost} annually`;
    });

    documentChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'The Problem Statement:',
            bold: true,
            size: 24,
            color: FORTER_DARK,
          }),
        ],
        spacing: { before: 200, after: 100 },
      }),
      ...problemStatementItems.map(item => 
        new Paragraph({
          children: [
            new TextRun({
              text: `• ${item}`,
              size: 20,
            }),
          ],
          spacing: { after: 80 },
          indent: { left: 360 },
        })
      )
    );
  }

  // RECOMMENDED APPROACH section
  documentChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Recommended Approach:',
          bold: true,
          size: 24,
          color: FORTER_DARK,
        }),
      ],
      spacing: { before: 300, after: 100 },
    }),
    ...solutions.map((solution, idx) => 
      new Paragraph({
        children: [
          new TextRun({
            text: `${idx + 1}. ${solution}`,
            size: 20,
          }),
        ],
        spacing: { after: 80 },
        indent: { left: 360 },
      })
    ),
    new Paragraph({
      children: [
        new TextRun({
          text: 'Forter was found to meet and exceed all requirements for this solution.',
          italics: true,
          size: 20,
          color: FORTER_GREEN,
        }),
      ],
      spacing: { before: 120, after: 200 },
      indent: { left: 360 },
    }),
    
    // TARGET OUTCOMES section (template table style)
    new Paragraph({
      children: [
        new TextRun({
          text: 'Target Outcomes:',
          bold: true,
          size: 24,
          color: FORTER_DARK,
        }),
      ],
      spacing: { before: 300, after: 150 },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({
              children: [new Paragraph({ 
                children: [new TextRun({ text: 'Key Metric', bold: true, size: 20, color: 'FFFFFF' })],
                alignment: AlignmentType.LEFT,
              })],
              width: { size: 40, type: WidthType.PERCENTAGE },
              shading: { fill: FORTER_DARK },
            }),
            new TableCell({
              children: [new Paragraph({ 
                children: [new TextRun({ text: 'Current Measure', bold: true, size: 20, color: 'FFFFFF' })],
                alignment: AlignmentType.CENTER,
              })],
              width: { size: 30, type: WidthType.PERCENTAGE },
              shading: { fill: FORTER_DARK },
            }),
            new TableCell({
              children: [new Paragraph({ 
                children: [new TextRun({ text: 'Target by [Date]', bold: true, size: 20, color: 'FFFFFF' })],
                alignment: AlignmentType.CENTER,
              })],
              width: { size: 30, type: WidthType.PERCENTAGE },
              shading: { fill: FORTER_DARK },
            }),
          ],
        }),
        ...performanceHighlights.map(m => 
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ 
                  children: [new TextRun({ text: m.metric, size: 20 })],
                })],
              }),
              new TableCell({
                children: [new Paragraph({ 
                  children: [new TextRun({ text: m.current, size: 20 })],
                  alignment: AlignmentType.CENTER,
                })],
              }),
              new TableCell({
                children: [new Paragraph({ 
                  children: [new TextRun({ text: m.target, size: 20, color: FORTER_GREEN, bold: true })],
                  alignment: AlignmentType.CENTER,
                })],
              }),
            ],
          })
        ),
      ],
    })
  );

  // INVESTMENT or NEXT STEPS section based on whether investment was entered
  if (options.hasInvestment) {
    // Show Required Investment section
    documentChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Required Investment:',
            bold: true,
            size: 24,
            color: FORTER_DARK,
          }),
        ],
        spacing: { before: 300, after: 100 },
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: 'Annual Investment', size: 20 })] })],
                width: { size: 50, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ 
                  children: [new TextRun({ 
                    text: formatCurrency(roiResults.yearProjections[0]?.forterSaaSCost || 0, currency),
                    size: 20, 
                    bold: true 
                  })],
                  alignment: AlignmentType.RIGHT,
                })],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: 'EBITDA Contribution', size: 20 })] })],
              }),
              new TableCell({
                children: [new Paragraph({ 
                  children: [new TextRun({ 
                    text: formatCurrency(valueTotals.ebitdaContribution, currency),
                    size: 20, 
                    bold: true,
                    color: FORTER_GREEN,
                  })],
                  alignment: AlignmentType.RIGHT,
                })],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: 'ROI', size: 20 })] })],
              }),
              new TableCell({
                children: [new Paragraph({ 
                  children: [new TextRun({ 
                    text: `${roiResults.roi.toFixed(1)}x`,
                    size: 20, 
                    bold: true,
                    color: FORTER_GREEN,
                  })],
                  alignment: AlignmentType.RIGHT,
                })],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: 'Payback Period', size: 20 })] })],
              }),
              new TableCell({
                children: [new Paragraph({ 
                  children: [new TextRun({ 
                    text: roiResults.paybackPeriodMonths > 0 ? `${roiResults.paybackPeriodMonths} months` : 'Immediate',
                    size: 20, 
                    bold: true,
                  })],
                  alignment: AlignmentType.RIGHT,
                })],
              }),
            ],
          }),
        ],
      })
    );
  } else {
    // Show Projected Value without investment details, and add investment as next step
    documentChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Projected Value:',
            bold: true,
            size: 24,
            color: FORTER_DARK,
          }),
        ],
        spacing: { before: 300, after: 100 },
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: 'GMV Uplift', size: 20 })] })],
                width: { size: 50, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ 
                  children: [new TextRun({ 
                    text: formatCurrency(valueTotals.gmvUplift, currency),
                    size: 20, 
                    bold: true 
                  })],
                  alignment: AlignmentType.RIGHT,
                })],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: 'Cost Reduction', size: 20 })] })],
              }),
              new TableCell({
                children: [new Paragraph({ 
                  children: [new TextRun({ 
                    text: formatCurrency(valueTotals.costReduction, currency),
                    size: 20, 
                    bold: true 
                  })],
                  alignment: AlignmentType.RIGHT,
                })],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: 'Risk Mitigation', size: 20 })] })],
              }),
              new TableCell({
                children: [new Paragraph({ 
                  children: [new TextRun({ 
                    text: formatCurrency(valueTotals.riskMitigation, currency),
                    size: 20, 
                    bold: true 
                  })],
                  alignment: AlignmentType.RIGHT,
                })],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ 
                  children: [new TextRun({ text: 'EBITDA Contribution', size: 20, bold: true })]
                })],
                shading: { fill: FORTER_LIGHT_GRAY },
              }),
              new TableCell({
                children: [new Paragraph({ 
                  children: [new TextRun({ 
                    text: formatCurrency(valueTotals.ebitdaContribution, currency),
                    size: 20, 
                    bold: true,
                    color: FORTER_GREEN,
                  })],
                  alignment: AlignmentType.RIGHT,
                })],
                shading: { fill: FORTER_LIGHT_GRAY },
              }),
            ],
          }),
        ],
      }),
      // Next Steps with investment as first item
      new Paragraph({
        children: [
          new TextRun({
            text: 'Next Steps:',
            bold: true,
            size: 24,
            color: FORTER_DARK,
          }),
        ],
        spacing: { before: 300, after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: '1. Finalize investment and pricing discussion to complete ROI analysis',
            size: 20,
          }),
        ],
        spacing: { after: 80 },
        indent: { left: 360 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: '2. [EDIT: Define additional next steps, timeline, and key stakeholders]',
            italics: true,
            size: 20,
            color: FORTER_GRAY,
          }),
        ],
        spacing: { after: 80 },
        indent: { left: 360 },
      })
    );
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 720,    // 0.5 inch
            bottom: 720,
            left: 1080,  // 0.75 inch
            right: 1080,
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
  // Dynamic import to avoid React version conflicts
  const [pptxModule, { saveAs }] = await Promise.all([
    import('pptxgenjs'),
    import('file-saver'),
  ]);
  
  const PptxGenJS = pptxModule.default;
  const pptx = new PptxGenJS();
  
  const analysisName = (formData as any)._analysisName || formData.customerName || 'Value Assessment';
  const customerName = formData.customerName || 'Customer';
  const currency = formData.baseCurrency || 'USD';
  const headline = generateHeadline(formData, valueTotals);
  const allDrivers = getAllValueDrivers(challenges, valueTotals);
  const performanceHighlights = buildPerformanceHighlights(formData, challenges);
  
  // Determine content based on strategic objectives
  const useStrategicAlignment = options.selectedObjectives.length > 0;
  const strategicObjectives = getStrategicObjectiveDetails(options.selectedObjectives);
  const useCases = getUseCasesForChallenges(challenges);
  const problems = getSelectedChallengeProblems(challenges);
  
  // Configure presentation with Proxima Nova font
  pptx.author = 'Forter Value Calculator';
  pptx.title = `${analysisName} Value Assessment`;
  pptx.subject = 'Value Assessment';
  pptx.company = 'Forter';
  
  // Define default font for all text
  const FONT_FACE = 'Proxima Nova';
  
  // Helper to add Proxima Nova fontFace to text options
  const withFont = (opts: any) => ({ ...opts, fontFace: FONT_FACE });
  
  // ===== SLIDE 1: Executive Summary =====
  const slide1 = pptx.addSlide();
  slide1.addText(`Analysis: ${analysisName}`, withFont({
    x: 0.5, y: 0.1, w: '90%', h: 0.35,
    fontSize: 14, color: FORTER_GRAY,
  }));
  slide1.addText('Executive Summary', withFont({
    x: 0.5, y: 0.3, w: '90%', h: 0.6,
    fontSize: 28, bold: true, color: FORTER_DARK,
  }));
  slide1.addText(headline, withFont({
    x: 0.5, y: 1.0, w: '90%', h: 0.8,
    fontSize: 18, bold: true, color: FORTER_GREEN,
  }));
  
  // Show strategic objectives or problems based on user path
  if (useStrategicAlignment) {
    slide1.addText('Strategic Alignment:', withFont({
      x: 0.5, y: 1.8, w: '90%', h: 0.4,
      fontSize: 14, bold: true, color: FORTER_DARK,
    }));
    const objectiveBullets = strategicObjectives.map(o => ({ text: o.name, options: { bullet: true, fontSize: 12, fontFace: FONT_FACE } }));
    slide1.addText(objectiveBullets, withFont({
      x: 0.5, y: 2.2, w: 4.5, h: 2.0,
      color: '333333',
      valign: 'top',
    }));
  } else {
    const problemBullets = problems.map(p => ({ text: p, options: { bullet: true, fontSize: 12, fontFace: FONT_FACE } }));
    slide1.addText(problemBullets, withFont({
      x: 0.5, y: 2.0, w: 4.5, h: 2.5,
      color: '333333',
      valign: 'top',
    }));
  }
  
  // Key value metrics
  slide1.addTable([
    [
      { text: 'Total EBITDA Value', options: { bold: true, fill: { color: FORTER_DARK }, color: 'FFFFFF', fontFace: FONT_FACE } },
      { text: formatCurrency(valueTotals.ebitdaContribution, currency), options: { bold: true, fill: { color: FORTER_LIGHT_GRAY }, fontFace: FONT_FACE } },
    ],
    ...(options.hasInvestment ? [
      [
        { text: 'Payback Period', options: { bold: true, fontFace: FONT_FACE } },
        { text: roiResults.paybackPeriodMonths > 0 ? `${roiResults.paybackPeriodMonths} months` : 'Immediate', options: { color: FORTER_GREEN, bold: true, fontFace: FONT_FACE } },
      ],
      [
        { text: 'ROI', options: { bold: true, fontFace: FONT_FACE } },
        { text: `${roiResults.roi.toFixed(1)}x`, options: { color: FORTER_GREEN, bold: true, fontFace: FONT_FACE } },
      ],
    ] : []),
  ], {
    x: 5.0, y: 2.0, w: 4.5,
    colW: [2.2, 2.3],
    fontSize: 12,
    fontFace: FONT_FACE,
    border: { pt: 0.5, color: 'CCCCCC' },
  });
  
  // ===== SLIDE 2: Strategic Alignment / Use Cases (if strategic path) =====
  if (useStrategicAlignment) {
    const slide2 = pptx.addSlide();
    slide2.addText('Strategic Alignment & Use Cases', withFont({
      x: 0.5, y: 0.3, w: '90%', h: 0.6,
      fontSize: 28, bold: true, color: FORTER_DARK,
    }));
    
    // Strategic Objectives
    slide2.addText('Company Priorities:', withFont({
      x: 0.5, y: 1.0, w: 4.5, h: 0.5,
      fontSize: 16, bold: true, color: FORTER_DARK,
    }));
    
    strategicObjectives.forEach((obj, idx) => {
      slide2.addText(`• ${obj.name}`, withFont({
        x: 0.5, y: 1.5 + (idx * 0.4), w: 4.5, h: 0.4,
        fontSize: 14, bold: true, color: FORTER_GREEN,
      }));
    });
    
    // Use Cases
    slide2.addText('Targeted Use Cases:', withFont({
      x: 5.0, y: 1.0, w: 4.5, h: 0.5,
      fontSize: 16, bold: true, color: FORTER_DARK,
    }));
    
    useCases.forEach((uc, idx) => {
      slide2.addText(`• ${uc.name}`, withFont({
        x: 5.0, y: 1.5 + (idx * 0.4), w: 4.5, h: 0.4,
        fontSize: 12, color: '333333',
      }));
    });
  }
  
  // ===== SLIDE: Value Summary =====
  const slideValueSummary = pptx.addSlide();
  slideValueSummary.addText('Value Summary', withFont({
    x: 0.5, y: 0.3, w: '90%', h: 0.6,
    fontSize: 28, bold: true, color: FORTER_DARK,
  }));
  
  // Three value category boxes
  const categories = [
    { label: 'GMV Uplift', value: valueTotals.gmvUplift, breakdown: valueTotals.gmvUpliftBreakdown },
    { label: 'Cost Reduction', value: valueTotals.costReduction, breakdown: valueTotals.costReductionBreakdown },
    { label: 'Risk Mitigation', value: valueTotals.riskMitigation, breakdown: valueTotals.riskMitigationBreakdown },
  ];
  
  categories.forEach((cat, idx) => {
    const xPos = 0.5 + (idx * 3.2);
    
    // Category header
    slideValueSummary.addText(cat.label, withFont({
      x: xPos, y: 1.0, w: 3.0, h: 0.5,
      fontSize: 16, bold: true, color: FORTER_DARK,
      align: 'center',
    }));
    
    // Value
    slideValueSummary.addText(formatCurrency(cat.value, currency), withFont({
      x: xPos, y: 1.5, w: 3.0, h: 0.6,
      fontSize: 24, bold: true, color: FORTER_GREEN,
      align: 'center',
    }));
    
    // Breakdown items
    const breakdownItems = (cat.breakdown || []).slice(0, 4);
    breakdownItems.forEach((item, itemIdx) => {
      slideValueSummary.addText(`• ${item.label}`, withFont({
        x: xPos + 0.1, y: 2.3 + (itemIdx * 0.35), w: 2.8, h: 0.35,
        fontSize: 9, color: FORTER_GRAY,
      }));
    });
  });
  
  // Total EBITDA bar
  slideValueSummary.addShape('rect', {
    x: 0.5, y: 4.5, w: 9.0, h: 0.8,
    fill: { color: FORTER_LIGHT_GRAY },
    line: { color: FORTER_DARK, pt: 1 },
  });
  slideValueSummary.addText('Annual EBITDA Contribution:', withFont({
    x: 0.7, y: 4.6, w: 4.0, h: 0.6,
    fontSize: 14, bold: true, color: FORTER_DARK,
  }));
  slideValueSummary.addText(formatCurrency(valueTotals.ebitdaContribution, currency), withFont({
    x: 5.0, y: 4.6, w: 4.3, h: 0.6,
    fontSize: 20, bold: true, color: FORTER_GREEN,
    align: 'right',
  }));
  
  // ===== SLIDE: Value Drivers (ALL, with auto-shrink) =====
  const slideDrivers = pptx.addSlide();
  slideDrivers.addText('Value Drivers', withFont({
    x: 0.5, y: 0.3, w: '90%', h: 0.6,
    fontSize: 28, bold: true, color: FORTER_DARK,
  }));
  
  // Create driver table with ALL value drivers
  const driverTableRows: Array<Array<{ text: string; options?: any }>> = [
    [
      { text: 'Value Driver', options: { bold: true, fill: { color: FORTER_DARK }, color: 'FFFFFF', fontFace: FONT_FACE } },
      { text: 'Annual Value', options: { bold: true, fill: { color: FORTER_DARK }, color: 'FFFFFF', align: 'right', fontFace: FONT_FACE } },
    ],
  ];
  
  allDrivers.forEach(driver => {
    driverTableRows.push([
      { text: driver.label, options: { fontFace: FONT_FACE } },
      { text: formatCurrency(driver.value, currency), options: { align: 'right', color: FORTER_GREEN, bold: true, fontFace: FONT_FACE } },
    ]);
  });
  
  // Auto-shrink font size based on row count
  const baseDriverRowHeight = 0.5;
  const availableDriverHeight = 3.8;
  const neededDriverHeight = driverTableRows.length * baseDriverRowHeight;
  let driverFontSize = 14;
  let driverRowHeight = baseDriverRowHeight;
  
  if (neededDriverHeight > availableDriverHeight) {
    const scale = availableDriverHeight / neededDriverHeight;
    driverFontSize = Math.max(9, Math.floor(14 * scale));
    driverRowHeight = Math.max(0.3, baseDriverRowHeight * scale);
  }
  
  slideDrivers.addTable(driverTableRows, {
    x: 0.5, y: 1.2, w: 9.0,
    colW: [6.5, 2.5],
    fontSize: driverFontSize,
    fontFace: FONT_FACE,
    border: { pt: 0.5, color: 'CCCCCC' },
    rowH: driverRowHeight,
  });
  
  // ===== SLIDE: Target Outcomes (KPIs) =====
  const slideKPIs = pptx.addSlide();
  slideKPIs.addText('Target Outcomes', withFont({
    x: 0.5, y: 0.3, w: '90%', h: 0.6,
    fontSize: 28, bold: true, color: FORTER_DARK,
  }));
  
  const kpiTableRows: Array<Array<{ text: string; options?: any }>> = [
    [
      { text: 'Key Metric', options: { bold: true, fill: { color: FORTER_DARK }, color: 'FFFFFF', fontFace: FONT_FACE } },
      { text: 'Current', options: { bold: true, fill: { color: FORTER_DARK }, color: 'FFFFFF', align: 'center', fontFace: FONT_FACE } },
      { text: 'Target', options: { bold: true, fill: { color: FORTER_DARK }, color: 'FFFFFF', align: 'center', fontFace: FONT_FACE } },
    ],
  ];
  
  performanceHighlights.forEach(m => {
    kpiTableRows.push([
      { text: m.metric, options: { fontFace: FONT_FACE } },
      { text: m.current, options: { align: 'center', fontFace: FONT_FACE } },
      { text: m.target, options: { align: 'center', color: FORTER_GREEN, bold: true, fontFace: FONT_FACE } },
    ]);
  });
  
  slideKPIs.addTable(kpiTableRows, {
    x: 0.5, y: 1.2, w: 9.0,
    colW: [4.0, 2.5, 2.5],
    fontSize: 14,
    fontFace: FONT_FACE,
    border: { pt: 0.5, color: 'CCCCCC' },
    rowH: 0.5,
  });
  
  // ===== SLIDE: ROI Summary (only if investment is present) =====
  if (options.hasInvestment) {
    const slideROI = pptx.addSlide();
    slideROI.addText('ROI Summary', withFont({
      x: 0.5, y: 0.3, w: '90%', h: 0.6,
      fontSize: 28, bold: true, color: FORTER_DARK,
    }));
    
    // Key metrics cards
    const contractTenure = roiResults.yearProjections.length || 3;
    const roiMetrics = [
      { label: 'ROI', value: `${roiResults.roi.toFixed(1)}x` },
      { label: 'Payback Period', value: roiResults.paybackPeriodMonths > 0 ? `${roiResults.paybackPeriodMonths} mo` : 'Immediate' },
      { label: 'Contract Tenure', value: `${contractTenure} years` },
    ];
    
    roiMetrics.forEach((metric, idx) => {
      const xPos = 0.5 + (idx * 3.2);
      slideROI.addShape('rect', {
        x: xPos, y: 1.0, w: 3.0, h: 1.2,
        fill: { color: FORTER_LIGHT_GRAY },
        line: { color: FORTER_GREEN, pt: 2 },
      });
      slideROI.addText(metric.label, withFont({
        x: xPos, y: 1.1, w: 3.0, h: 0.4,
        fontSize: 12, color: FORTER_GRAY, align: 'center',
      }));
      slideROI.addText(metric.value, withFont({
        x: xPos, y: 1.5, w: 3.0, h: 0.6,
        fontSize: 24, bold: true, color: FORTER_GREEN, align: 'center',
      }));
    });
    
    // Year-by-year projection table
    const roiTableRows: Array<Array<{ text: string; options?: any }>> = [
      [
        { text: 'Year', options: { bold: true, fill: { color: FORTER_DARK }, color: 'FFFFFF', fontFace: FONT_FACE } },
        { text: 'Gross EBITDA', options: { bold: true, fill: { color: FORTER_DARK }, color: 'FFFFFF', align: 'right', fontFace: FONT_FACE } },
        { text: 'Forter Cost', options: { bold: true, fill: { color: FORTER_DARK }, color: 'FFFFFF', align: 'right', fontFace: FONT_FACE } },
        { text: 'Net EBITDA', options: { bold: true, fill: { color: FORTER_DARK }, color: 'FFFFFF', align: 'right', fontFace: FONT_FACE } },
      ],
    ];
    
    roiResults.yearProjections.forEach(y => {
      roiTableRows.push([
        { text: `Year ${y.year}`, options: { fontFace: FONT_FACE } },
        { text: formatCurrency(y.runRateGrossEBITDA, currency), options: { align: 'right', fontFace: FONT_FACE } },
        { text: formatCurrency(y.forterSaaSCost + y.integrationCost, currency), options: { align: 'right', fontFace: FONT_FACE } },
        { text: formatCurrency(y.netEBITDAContribution, currency), options: { align: 'right', color: FORTER_GREEN, bold: true, fontFace: FONT_FACE } },
      ]);
    });
    
    // Total row
    roiTableRows.push([
      { text: 'Total', options: { bold: true, fill: { color: FORTER_LIGHT_GRAY }, fontFace: FONT_FACE } },
      { text: formatCurrency(roiResults.totalProjection.runRateGrossEBITDA, currency), options: { align: 'right', bold: true, fill: { color: FORTER_LIGHT_GRAY }, fontFace: FONT_FACE } },
      { text: formatCurrency(roiResults.totalProjection.forterSaaSCost + roiResults.totalProjection.integrationCost, currency), options: { align: 'right', bold: true, fill: { color: FORTER_LIGHT_GRAY }, fontFace: FONT_FACE } },
      { text: formatCurrency(roiResults.totalProjection.netEBITDAContribution, currency), options: { align: 'right', bold: true, color: FORTER_GREEN, fill: { color: FORTER_LIGHT_GRAY }, fontFace: FONT_FACE } },
    ]);
    
    slideROI.addTable(roiTableRows, {
      x: 0.5, y: 2.6, w: 9.0,
      colW: [1.5, 2.5, 2.5, 2.5],
      fontSize: 12,
      fontFace: FONT_FACE,
      border: { pt: 0.5, color: 'CCCCCC' },
      rowH: 0.45,
    });
  }
  
  // ===== SLIDE: Next Steps =====
  const slideNextSteps = pptx.addSlide();
  slideNextSteps.addText('Next Steps', withFont({
    x: 0.5, y: 0.3, w: '90%', h: 0.6,
    fontSize: 28, bold: true, color: FORTER_DARK,
  }));
  
  // Placeholder action items - include investment if not yet entered
  const placeholderSteps = options.hasInvestment
    ? [
        '1. Technical integration discussion with [Stakeholder]',
        '2. Proof of concept timeline and scope',
        '3. Business case review with executive sponsors',
        '4. Contract and implementation planning',
      ]
    : [
        '1. Finalize investment and pricing discussion to complete ROI analysis',
        '2. Technical integration discussion with [Stakeholder]',
        '3. Proof of concept timeline and scope',
        '4. Business case review with executive sponsors',
      ];
  
  slideNextSteps.addText('[EDIT: Define specific next steps, timeline, and key stakeholders for this opportunity]', withFont({
    x: 0.5, y: 1.2, w: '90%', h: 0.6,
    fontSize: 14, italic: true, color: FORTER_GRAY,
  }));
  
  slideNextSteps.addText(placeholderSteps.map(s => ({ text: s, options: { bullet: false, fontSize: 14, fontFace: FONT_FACE } })), withFont({
    x: 0.5, y: 2.0, w: '90%', h: 2.5,
    color: '333333',
    valign: 'top',
  }));
  
  // ===== APPENDIX SLIDES: Calculator Details =====
  // Build appendix data from active benefit groups (not individual challenges)
  const activeBenefitGroups = getActiveBenefitGroups(challenges);
  
  if (activeBenefitGroups.length > 0) {
    // Appendix title slide
    const slideAppendixTitle = pptx.addSlide();
    slideAppendixTitle.addText('Appendix', withFont({
      x: 0.5, y: 2.0, w: '90%', h: 1.0,
      fontSize: 36, bold: true, color: FORTER_DARK,
      align: 'center',
    }));
    slideAppendixTitle.addText('Calculator Details & Methodology', withFont({
      x: 0.5, y: 3.0, w: '90%', h: 0.6,
      fontSize: 18, color: FORTER_GRAY,
      align: 'center',
    }));
    
    // Create slides for each calculator within active benefit groups
    // Each calculator gets its own slide with: title, benefit text, full table, total
    activeBenefitGroups.forEach(group => {
      // Get calculator rows for this benefit group
      const calculatorTables = getCalculatorRowsForBenefitGroup(group, formData);
      
      // Create a slide for EACH calculator in the group (not grouped)
      calculatorTables.forEach(calc => {
        // Get the benefit content for this specific calculator
        const calcId = group.calculatorIds.find(id => {
          const content = getChallengeBenefitContent(id);
          return content?.benefitTitle === calc.title || 
                 content?.benefitTitle?.toLowerCase().includes(calc.title.toLowerCase()) ||
                 calc.title.toLowerCase().includes(content?.benefitTitle?.toLowerCase() || '');
        }) || group.calculatorIds[0];
        
        const benefitContent = getChallengeBenefitContent(calcId);
        
        // Title = Benefit Name (from content library)
        const slideTitle = benefitContent?.benefitTitle || calc.title;
        const benefitDescription = benefitContent?.benefitDescription || group.solution;
        const challengeDescription = benefitContent?.challengeDescription || group.problem;
        
        // Check if calculator is TBD (missing inputs)
        const isTBD = isCalculatorTBD(calc.rows);
        
        if (isTBD) {
          // Create TBD narrative slide instead of calculator table
          const slideCalc = pptx.addSlide();
          
          // Title
          slideCalc.addText(slideTitle, withFont({
            x: 0.3, y: 0.2, w: '95%', h: 0.5,
            fontSize: 22, bold: true, color: FORTER_DARK,
          }));
          
          // Challenge Section
          slideCalc.addText('The Challenge', withFont({
            x: 0.3, y: 1.15, w: '95%', h: 0.3,
            fontSize: 14, bold: true, color: FORTER_DARK,
          }));
          
          slideCalc.addText(challengeDescription, withFont({
            x: 0.3, y: 1.45, w: '95%', h: 0.8,
            fontSize: 10, color: FORTER_GRAY,
            valign: 'top',
          }));
          
          // Benefit Section
          slideCalc.addText('The Forter Solution', withFont({
            x: 0.3, y: 2.35, w: '95%', h: 0.3,
            fontSize: 14, bold: true, color: FORTER_BLUE,
          }));
          
          slideCalc.addText(benefitDescription, withFont({
            x: 0.3, y: 2.65, w: '95%', h: 0.7,
            fontSize: 10, color: FORTER_GRAY,
            valign: 'top',
          }));
          
          // Key Benefits Section (bullet points from content library)
          const benefitPointsData = benefitContent?.benefitPoints;
          if (benefitPointsData && benefitPointsData.length > 0) {
            slideCalc.addText('Key Benefits', withFont({
              x: 0.3, y: 3.45, w: '95%', h: 0.3,
              fontSize: 12, bold: true, color: FORTER_DARK,
            }));
            
            let bulletY = 3.75;
            benefitPointsData.forEach((point) => {
              // Bullet point with title and description
              slideCalc.addText([
                { text: '• ', options: { bold: true, color: FORTER_BLUE } },
                { text: `${point.title}: `, options: { bold: true, color: FORTER_DARK } },
                { text: point.description, options: { color: FORTER_GRAY } },
              ], withFont({
                x: 0.4, y: bulletY, w: '90%', h: 0.35,
                fontSize: 9,
                valign: 'top',
              }));
              bulletY += 0.35;
            });
          }
          
          // Footer note
          slideCalc.addText('Complete the customer inputs to generate detailed value calculations for this benefit.', withFont({
            x: 0.3, y: 5.0, w: '95%', h: 0.3,
            fontSize: 9, italic: true, color: FORTER_GRAY,
          }));
        } else {
          // Create standard calculator table slide
          const slideCalc = pptx.addSlide();
          
          slideCalc.addText(slideTitle, withFont({
            x: 0.3, y: 0.2, w: '95%', h: 0.45,
            fontSize: 20, bold: true, color: FORTER_DARK,
          }));
          
          slideCalc.addText(benefitDescription, withFont({
            x: 0.3, y: 0.65, w: '95%', h: 0.5,
            fontSize: 10, color: FORTER_GRAY,
          }));
          
          let yPosition = 1.2;
          
          // Build the full calculator table (all rows, not just key rows)
          const calcTableRows: Array<Array<{ text: string; options?: any }>> = [
          [
            { text: 'Formula', options: { bold: true, fill: { color: FORTER_DARK }, color: 'FFFFFF', fontFace: FONT_FACE } },
            { text: 'Description', options: { bold: true, fill: { color: FORTER_DARK }, color: 'FFFFFF', fontFace: FONT_FACE } },
            { text: 'Customer inputs', options: { bold: true, fill: { color: FORTER_DARK }, color: 'FFFFFF', align: 'right', fontFace: FONT_FACE } },
            { text: 'Forter improvement', options: { bold: true, fill: { color: FORTER_BLUE }, color: 'FFFFFF', align: 'right', fontFace: FONT_FACE } },
            { text: 'Forter outcome', options: { bold: true, fill: { color: FORTER_DARK }, color: 'FFFFFF', align: 'right', fontFace: FONT_FACE } },
          ],
          ];
          
          
          calc.rows.forEach(row => {
            if (!row.formula && row.label && !row.customerInput && !row.forterOutcome) {
              // Section header row
              calcTableRows.push([
                { text: row.label, options: { bold: true, fill: { color: FORTER_LIGHT_GRAY }, fontFace: FONT_FACE, colspan: 5 } },
                { text: '', options: {} },
                { text: '', options: {} },
                { text: '', options: {} },
                { text: '', options: {} },
              ]);
            } else {
              // Highlight value driver rows
              const isValueDriver = !!row.valueDriver;
              const rowBg = isValueDriver ? FORTER_LIGHT_BG : undefined;
              
              calcTableRows.push([
                { text: row.formula || '', options: { fontFace: 'Courier New', fontSize: 7, fill: rowBg ? { color: rowBg } : undefined } },
                { text: row.label || '', options: { fontFace: FONT_FACE, fontSize: 7, fill: rowBg ? { color: rowBg } : undefined } },
                { text: row.customerInput || '', options: { align: 'right', fontFace: FONT_FACE, fontSize: 7, fill: rowBg ? { color: rowBg } : undefined } },
                { text: row.forterImprovement || '', options: { align: 'right', fontFace: FONT_FACE, fontSize: 7, color: row.forterImprovement?.startsWith('-') || row.forterImprovement?.startsWith('(') ? 'CC0000' : FORTER_GREEN, fill: rowBg ? { color: rowBg } : undefined } },
                { text: row.forterOutcome || '', options: { align: 'right', fontFace: FONT_FACE, fontSize: 7, bold: isValueDriver, fill: rowBg ? { color: rowBg } : undefined } },
              ]);
            }
          });
          
          // Calculate font size to fit - auto-shrink for long tables
          const baseRowHeight = 0.2;
          const availableHeight = 4.0; // Space for table content (leaving room for total)
          const neededHeight = calcTableRows.length * baseRowHeight;
          let fontSize = 7;
          let rowHeight = baseRowHeight;
          
          if (neededHeight > availableHeight) {
            // Shrink font and row height proportionally (minimum 6pt)
            const scale = availableHeight / neededHeight;
            fontSize = Math.max(6, Math.floor(7 * scale));
            rowHeight = Math.max(0.14, baseRowHeight * scale);
          }
          
          slideCalc.addTable(calcTableRows, {
            x: 0.2, y: yPosition, w: 9.6,
            colW: [0.6, 4.0, 1.5, 1.5, 2.0],
            fontSize: fontSize,
            fontFace: FONT_FACE,
            border: { pt: 0.5, color: 'DDDDDD' },
            rowH: rowHeight,
          });
          
          // Full calculator table is shown - no summary footer needed
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
