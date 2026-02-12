/**
 * ROI Calculations - Based on spreadsheet logic (Pages 13-14)
 * 
 * Features:
 * - 1, 2, 3 year projections
 * - Simple ROI calculation
 * - Payback period calculation
 * - Investment cost calculations with pricing lookups
 */
import { CalculatorData } from "@/pages/Index";

// Contract tenure options
export type ContractTenure = 1 | 2 | 3;

// Pricing lookup tables (from spreadsheet Pages 14, 18)
export interface PricingLookup {
  minAOV: number;
  maxAOV: number | null;
  price: number;
}

export const fraudManagementPricing: PricingLookup[] = [
  { minAOV: 0, maxAOV: 99, price: 0.03 },
  { minAOV: 100, maxAOV: 500, price: 0.03 },
  { minAOV: 501, maxAOV: null, price: 0.07 },
];

export const threeDSPricing: PricingLookup[] = [
  { minAOV: 0, maxAOV: 99, price: 0.02 },
  { minAOV: 100, maxAOV: 500, price: 0.02 },
  { minAOV: 501, maxAOV: null, price: 0.02 },
];

export const chargebackRecoveryPricing: PricingLookup[] = [
  { minAOV: 0, maxAOV: 99, price: 9.00 },
  { minAOV: 100, maxAOV: 500, price: 15.00 },
  { minAOV: 501, maxAOV: null, price: 15.00 },
];

export const abusePreventionPricing: PricingLookup[] = [
  { minAOV: 0, maxAOV: 99, price: 0.02 },
  { minAOV: 100, maxAOV: 500, price: 0.02 },
  { minAOV: 501, maxAOV: null, price: 0.02 },
];

export const loginProtectionPricing: PricingLookup[] = [
  { minAOV: 0, maxAOV: 99, price: 0.02 },
  { minAOV: 100, maxAOV: 500, price: 0.02 },
  { minAOV: 501, maxAOV: null, price: 0.02 },
];

export const signupProtectionPricing: PricingLookup[] = [
  { minAOV: 0, maxAOV: 99, price: 0.50 },
  { minAOV: 100, maxAOV: 500, price: 0.50 },
  { minAOV: 501, maxAOV: null, price: 0.50 },
];

// Get price from lookup table based on AOV
export function getPriceByAOV(pricingTable: PricingLookup[], aov: number): number {
  for (const tier of pricingTable) {
    if (tier.maxAOV === null) {
      if (aov >= tier.minAOV) return tier.price;
    } else if (aov >= tier.minAOV && aov <= tier.maxAOV) {
      return tier.price;
    }
  }
  return pricingTable[0].price;
}

// Investment input structure
export interface CustomInvestmentItem {
  id: string;
  name: string;
  amount: number;
  sourceUrl?: string;
}

export type InvestmentPricingMode = 'guided' | 'manual';

export interface InvestmentInputs {
  // Which pricing is active: selected tab in Enter Investment modal (guided = calculated, manual = custom cost)
  pricingMode: InvestmentPricingMode;
  manualInvestmentCost?: number;
  manualIntegrationCost?: number;
  manualSourceUrl?: string; // Optional link to Google Sheets or other calculator source
  /** @deprecated Use pricingMode === 'manual'. Kept for backward compatibility when loading saved data. */
  manualOverride?: boolean;

  // Track which currency the cost values are stored in
  // This allows proper rebasing when base currency changes
  pricingCurrency?: string;
  
  // Guided pricing
  fraudManagement: {
    enabled: boolean;
    coverage: 'covered' | 'uncovered';
    annualTransactions?: number;
    annualGMV?: number;
    aov?: number; // Average Order Value - calculated from GMV/transactions
    costPerDecision?: number; // Can be overridden
    discount?: number; // Percentage
    // Coverage-specific
    creditCardTrafficPct?: number;
    threeDSRateWithForter?: number;
    coverageFeeBps?: number;
    // Fraud chargeback coverage
    includesFraudCBCoverage?: boolean;
    fraudCBCoverageTakeRate?: number; // Basis points (e.g., 15 = 0.15%)
  };
  
  paymentOptimization: {
    enabled: boolean;
    annualTransactions?: number;
    annualGMV?: number;
    creditCardTrafficPct?: number;
    costPerDecision?: number;
    discount?: number;
  };
  
  disputeManagement: {
    enabled: boolean;
    /** 'revShare' = value of won chargebacks × revenue share %; 'costPerDispute' = number of disputes × cost per dispute */
    model?: 'revShare' | 'costPerDispute';
    valueOfWonChargebacks?: number;
    revenueSharePct?: number;
    numberOfDisputes?: number;
    costPerDispute?: number;
  };
  
  abusePrevention: {
    enabled: boolean;
    annualTransactions?: number;
    annualGMV?: number;
    costPerDecision?: number;
    discount?: number;
  };
  
  accountProtection: {
    enabled: boolean;
    annualLogins?: number;
    costPerAPICall?: number;
    annualSignups?: number;
    signupCostPerAPICall?: number;
  };
  
  // Custom investment items
  customItems?: CustomInvestmentItem[];
  
  // Contract
  monthsToIntegrate: number;
  contractTenure: ContractTenure;
  annualSalesGrowthPct: number;
  integrationCost: number;
  
  // Annual ACV Growth and Year-by-Year Discounts
  annualACVGrowthPct: number; // Annual growth rate for investment cost (e.g., 5%)
  year1DiscountPct: number; // Year 1 discount (e.g., 50 means 50% of full price)
  year2DiscountPct: number; // Year 2 discount (e.g., 75 means 75% of full price)
  year3DiscountPct: number; // Year 3 discount (e.g., 100 means full price)
}

export const defaultInvestmentInputs: InvestmentInputs = {
  pricingMode: 'guided',
  pricingCurrency: 'USD', // Default pricing is in USD
  fraudManagement: {
    enabled: false,
    coverage: 'uncovered',
    discount: 0,
    creditCardTrafficPct: 80,
    threeDSRateWithForter: 30,
    coverageFeeBps: 0.15,
    includesFraudCBCoverage: false,
    fraudCBCoverageTakeRate: 15, // 0.15% in basis points
  },
  paymentOptimization: {
    enabled: false,
    creditCardTrafficPct: 80,
    discount: 0,
  },
  disputeManagement: {
    enabled: false,
    model: 'revShare',
    revenueSharePct: 20,
  },
  abusePrevention: {
    enabled: false,
    discount: 0,
  },
  accountProtection: {
    enabled: false,
  },
  customItems: [],
  monthsToIntegrate: 2,
  contractTenure: 3,
  annualSalesGrowthPct: 5,
  integrationCost: 0,
  annualACVGrowthPct: 5, // default linked to annual sales growth
  year1DiscountPct: 0,
  year2DiscountPct: 0,
  year3DiscountPct: 0,
};

// Coerce to number; use 0 when empty/cleared so section total reverts to 0 when user clears fields
function numOrZero(v: unknown): number {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Use default price only when value was never set (undefined/null); when user clears (0 or '') use 0
function costOrZero(value: unknown, defaultPrice: number): number {
  if (value === undefined || value === null || value === '') return defaultPrice;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Calculate investment costs from guided inputs
export function calculateInvestmentCosts(
  inputs: InvestmentInputs,
  formData: CalculatorData
): { totalACV: number; integrationCost: number; breakdown: Record<string, number> } {
  const useManualCost = inputs.pricingMode === 'manual' || inputs.manualOverride === true;
  if (useManualCost) {
    return {
      totalACV: numOrZero(inputs.manualInvestmentCost),
      integrationCost: numOrZero(inputs.manualIntegrationCost),
      breakdown: { manual: numOrZero(inputs.manualInvestmentCost) },
    };
  }
  
  const breakdown: Record<string, number> = {};
  const aov = (formData.amerGrossAttempts || 0) > 0 
    ? (formData.amerAnnualGMV || 0) / (formData.amerGrossAttempts || 1)
    : 150; // Default AOV
  
  // Fraud Management: use only input values; when cleared, 0 so total reverts to 0
  if (inputs.fraudManagement.enabled) {
    const transactions = numOrZero(inputs.fraudManagement.annualTransactions);
    const gmv = numOrZero(inputs.fraudManagement.annualGMV);
    const costPerDecision = costOrZero(inputs.fraudManagement.costPerDecision, getPriceByAOV(fraudManagementPricing, aov));
    const discount = numOrZero(inputs.fraudManagement.discount) / 100;
    
    let fraudACV = 0;
    if (inputs.fraudManagement.coverage === 'uncovered') {
      fraudACV = transactions * costPerDecision * (1 - discount);
    } else {
      const ccPct = numOrZero(inputs.fraudManagement.creditCardTrafficPct) || 80;
      const threeDSRate = numOrZero(inputs.fraudManagement.threeDSRateWithForter) || 30;
      const coveragePct = (ccPct / 100) * (1 - threeDSRate / 100);
      const coverageFeeBps = numOrZero(inputs.fraudManagement.coverageFeeBps) || 0.15;
      const uncoveredCost = transactions * costPerDecision * (1 - discount);
      const coveredCost = gmv * coveragePct * (coverageFeeBps / 100);
      fraudACV = uncoveredCost + coveredCost;
    }
    
    if (inputs.fraudManagement.includesFraudCBCoverage) {
      const takeRateBps = numOrZero(inputs.fraudManagement.fraudCBCoverageTakeRate) || 15;
      const takeRate = takeRateBps / 10000;
      const cbCoverageCost = gmv * takeRate;
      breakdown['Fraud CB Coverage'] = cbCoverageCost;
    }
    
    breakdown['Fraud Management'] = fraudACV;
  }
  
  // Payment Optimization: when fields cleared, 0
  if (inputs.paymentOptimization.enabled) {
    const transactions = numOrZero(inputs.paymentOptimization.annualTransactions);
    const ccPct = numOrZero(inputs.paymentOptimization.creditCardTrafficPct) || 80;
    const costPerDecision = costOrZero(inputs.paymentOptimization.costPerDecision, 0.02);
    const discount = numOrZero(inputs.paymentOptimization.discount) / 100;
    const paymentACV = transactions * (ccPct / 100) * costPerDecision * (1 - discount);
    breakdown['Payment Optimization'] = paymentACV;
  }
  
  // Dispute Management: rev share or cost per dispute
  if (inputs.disputeManagement.enabled) {
    const model = inputs.disputeManagement.model || 'revShare';
    if (model === 'costPerDispute') {
      const numDisputes = numOrZero(inputs.disputeManagement.numberOfDisputes);
      const costPerDispute = numOrZero(inputs.disputeManagement.costPerDispute);
      breakdown['Dispute Management'] = numDisputes * costPerDispute;
    } else {
      const valueOfWonCBs = numOrZero(inputs.disputeManagement.valueOfWonChargebacks);
      const revenueSharePct = numOrZero(inputs.disputeManagement.revenueSharePct);
      breakdown['Dispute Management'] = valueOfWonCBs * (revenueSharePct / 100);
    }
  }
  
  // Abuse Prevention: when fields cleared, 0
  if (inputs.abusePrevention.enabled) {
    const transactions = numOrZero(inputs.abusePrevention.annualTransactions);
    const costPerDecision = costOrZero(inputs.abusePrevention.costPerDecision, getPriceByAOV(abusePreventionPricing, aov));
    const discount = numOrZero(inputs.abusePrevention.discount) / 100;
    const abuseACV = transactions * costPerDecision * (1 - discount);
    breakdown['Abuse Prevention'] = abuseACV;
  }
  
  // Account Protection (Login + Signup): use only input values; when cleared, 0 (no formData/cost defaults)
  if (inputs.accountProtection.enabled) {
    const annualLogins = numOrZero(inputs.accountProtection.annualLogins);
    const loginCost = numOrZero(inputs.accountProtection.costPerAPICall);
    const loginACV = annualLogins * loginCost;
    
    const annualSignups = numOrZero(inputs.accountProtection.annualSignups);
    const signupCost = numOrZero(inputs.accountProtection.signupCostPerAPICall);
    const signupACV = annualSignups * signupCost;
    
    breakdown['Login Protection'] = loginACV;
    breakdown['Sign-up Protection'] = signupACV;
  }
  
  // Custom Investment Items
  if (inputs.customItems && inputs.customItems.length > 0) {
    for (const item of inputs.customItems) {
      if (item.name && item.amount > 0) {
        breakdown[`Custom: ${item.name}`] = item.amount;
      }
    }
  }
  
  const totalACV = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
  
  return {
    totalACV,
    integrationCost: numOrZero(inputs.integrationCost),
    breakdown,
  };
}

// ROI projection for each year
export interface YearProjection {
  year: number;
  gmvUplift: number;
  profitabilityFromGMV: number;
  costReduction: number;
  riskMitigation: number;
  totalProfitabilityContribution: number;
  effectiveRealization: number; // Deployment ramp-up
  runRateGrossEBITDA: number;
  forterSaaSCost: number;
  integrationCost: number;
  netEBITDAContribution: number;
}

export interface ROIResults {
  yearProjections: YearProjection[];
  totalProjection: YearProjection;
  roi: number; // Simple ROI = (Total Benefit - Investment) / Investment
  paybackPeriodMonths: number;
  netEBITDAYear1: number;
  hasInvestment: boolean;
}

// Value totals interface (passed from ValueSummary)
export interface ValueTotals {
  gmvUplift: number;
  costReduction: number;
  riskMitigation: number;
}

// Calculate ROI projections
export function calculateROI(
  formData: CalculatorData,
  valueTotals: ValueTotals,
  investmentInputs: InvestmentInputs
): ROIResults {
  const contractTenure = investmentInputs.contractTenure;
  const annualGrowth = investmentInputs.annualSalesGrowthPct / 100;
  const monthsToIntegrate = investmentInputs.monthsToIntegrate;
  
  // Investment costs
  const investmentCosts = calculateInvestmentCosts(investmentInputs, formData);
  const hasInvestment = investmentCosts.totalACV > 0 || investmentCosts.integrationCost > 0;
  
  // Base values from passed totals
  const baseGMVUplift = valueTotals.gmvUplift;
  const baseCostReduction = valueTotals.costReduction;
  const baseRiskMitigation = valueTotals.riskMitigation;
  
  // Commission and margin for EBITDA calculation
  const commissionRate = formData.isMarketplace ? (formData.commissionRate || 25) / 100 : 1;
  const grossMargin = (formData.amerGrossMarginPercent || 50) / 100;
  const profitabilityFactor = formData.isMarketplace ? commissionRate * grossMargin : grossMargin;
  
  const yearProjections: YearProjection[] = [];
  
  for (let year = 1; year <= 3; year++) {
    // Growth factor applies to BENEFITS only (not SaaS cost)
    const growthFactor = Math.pow(1 + annualGrowth, year - 1);
    
    const gmvUplift = baseGMVUplift * growthFactor;
    const profitabilityFromGMV = gmvUplift * profitabilityFactor;
    const costReduction = baseCostReduction * growthFactor;
    const riskMitigation = baseRiskMitigation * growthFactor;
    const totalProfitabilityContribution = profitabilityFromGMV + costReduction + riskMitigation;
    
    // Year 1 has deployment ramp-up based on months to integrate
    const effectiveRealization = year === 1 
      ? (12 - monthsToIntegrate) / 12 
      : 1;
    
    const runRateGrossEBITDA = totalProfitabilityContribution * effectiveRealization;
    
    // SaaS costs with year-by-year discount and ACV growth
    // Discount is now entered as % off (e.g., 50 = 50% discount, pay 50% of price)
    const acvGrowthRate = (investmentInputs.annualACVGrowthPct || 0) / 100;
    const acvGrowthFactor = Math.pow(1 + acvGrowthRate, year - 1);
    const yearDiscountPercents = [
      investmentInputs.year1DiscountPct ?? 0,
      investmentInputs.year2DiscountPct ?? 0,
      investmentInputs.year3DiscountPct ?? 0,
    ];
    // Convert discount % to multiplier: 0% discount = pay 100%, 50% discount = pay 50%
    const yearMultiplier = (100 - (yearDiscountPercents[year - 1] || 0)) / 100;
    const forterSaaSCost = investmentCosts.totalACV * acvGrowthFactor * yearMultiplier;
    const integrationCost = year === 1 ? investmentCosts.integrationCost : 0;
    
    const netEBITDAContribution = runRateGrossEBITDA - forterSaaSCost - integrationCost;
    
    yearProjections.push({
      year,
      gmvUplift,
      profitabilityFromGMV,
      costReduction,
      riskMitigation,
      totalProfitabilityContribution,
      effectiveRealization,
      runRateGrossEBITDA,
      forterSaaSCost,
      integrationCost,
      netEBITDAContribution,
    });
  }
  
  // Total projection (sum of years up to contract tenure)
  const relevantYears = yearProjections.slice(0, contractTenure);
  const totalProjection: YearProjection = {
    year: 0,
    gmvUplift: relevantYears.reduce((sum, y) => sum + y.gmvUplift, 0),
    profitabilityFromGMV: relevantYears.reduce((sum, y) => sum + y.profitabilityFromGMV, 0),
    costReduction: relevantYears.reduce((sum, y) => sum + y.costReduction, 0),
    riskMitigation: relevantYears.reduce((sum, y) => sum + y.riskMitigation, 0),
    totalProfitabilityContribution: relevantYears.reduce((sum, y) => sum + y.totalProfitabilityContribution, 0),
    effectiveRealization: 1,
    runRateGrossEBITDA: relevantYears.reduce((sum, y) => sum + y.runRateGrossEBITDA, 0),
    forterSaaSCost: relevantYears.reduce((sum, y) => sum + y.forterSaaSCost, 0),
    integrationCost: investmentCosts.integrationCost,
    netEBITDAContribution: relevantYears.reduce((sum, y) => sum + y.netEBITDAContribution, 0),
  };
  
  // Simple ROI = (Total Benefit - Total Investment) / Total Investment
  const totalInvestment = totalProjection.forterSaaSCost + totalProjection.integrationCost;
  const totalBenefit = totalProjection.runRateGrossEBITDA;
  const roi = totalInvestment > 0 ? (totalBenefit - totalInvestment) / totalInvestment : 0;
  
  // Payback period in months
  // Benefits only start after integration is complete, so payback = integration months + time to recoup
  // Payback is based on Year 1 investment only (SaaS + integration), not multi-year total
  const year1Investment = yearProjections[0].forterSaaSCost + investmentCosts.integrationCost;
  const activeMonths = 12 - monthsToIntegrate;
  const year1MonthlyBenefit = activeMonths > 0 ? yearProjections[0].runRateGrossEBITDA / activeMonths : 0;
  
  let paybackPeriodMonths = 0;
  if (year1MonthlyBenefit > 0 && hasInvestment) {
    // Months to recoup Year 1 investment (after integration)
    const monthsToRecoup = Math.ceil(year1Investment / year1MonthlyBenefit);
    // Total payback = integration time + recoup time
    paybackPeriodMonths = monthsToIntegrate + monthsToRecoup;
  } else if (!hasInvestment) {
    paybackPeriodMonths = 0; // Immediate if no investment
  } else {
    paybackPeriodMonths = -1; // Never pays back
  }
  
  return {
    yearProjections,
    totalProjection,
    roi,
    paybackPeriodMonths,
    netEBITDAYear1: yearProjections[0].netEBITDAContribution,
    hasInvestment,
  };
}

// Get enabled solutions from selected challenges
export function getEnabledSolutions(selectedChallenges: Record<string, boolean>): {
  fraudManagement: boolean;
  paymentOptimization: boolean;
  disputeManagement: boolean;
  abusePrevention: boolean;
  accountProtection: boolean;
} {
  const challenges = Object.entries(selectedChallenges)
    .filter(([_, enabled]) => enabled)
    .map(([id]) => id);
  
  return {
    // Fraud Management: Challenges 1, 2, 3
    fraudManagement: ['1', '2', '3'].some(c => challenges.includes(c)),
    // Payment Optimization: Challenges 4, 5
    paymentOptimization: ['4', '5'].some(c => challenges.includes(c)),
    // Dispute Management: Challenge 7
    disputeManagement: challenges.includes('7'),
    // Abuse Prevention: Challenges 8, 9, 10, 11
    abusePrevention: ['8', '9', '10', '11'].some(c => challenges.includes(c)),
    // Account Protection: Challenges 12, 13, 14, 15
    accountProtection: ['12', '13', '14', '15'].some(c => challenges.includes(c)),
  };
}
