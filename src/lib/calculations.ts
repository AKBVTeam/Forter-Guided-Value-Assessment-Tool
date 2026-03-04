/**
 * Value Assessment Calculations - Based on spreadsheet as single source of truth
 * 
 * Challenges implemented:
 * 1. False fraud declines blocking incremental revenue potential
 * 2. Rigid rules based fraud system implemented (includes 4, 5)
 * 3. Manual review process hinders scalability
 * 7. Difficulty in managing and disputing fraud & service chargebacks
 */

// Currency formatter helper - uses brackets for negative numbers
export const createCurrencyFormatter = (currencyCode: string = 'USD') => {
  return (n: number) => {
    const absValue = Math.abs(n);
    const formatted = new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: currencyCode, 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }).format(absValue);
    // Use brackets for negative values instead of minus sign
    return n < 0 ? `(${formatted})` : formatted;
  };
};

/** Currency formatter with fixed decimal places (e.g. 2 for fraud chargebacks). Uses brackets for negative numbers. */
export const createCurrencyFormatterWithDecimals = (currencyCode: string = 'USD', fractionDigits: number = 2) => {
  return (n: number) => {
    const absValue = Math.abs(n);
    const formatted = new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: currencyCode, 
      minimumFractionDigits: fractionDigits, 
      maximumFractionDigits: fractionDigits 
    }).format(absValue);
    return n < 0 ? `(${formatted})` : formatted;
  };
};

/** Relative % improvement for display: (forter - customer) / customer * 100. Use for % improvements (not %pts). */
export const formatPctImprovementRel = (customerVal: number, forterVal: number, decimals = 1): string => {
  if (typeof customerVal !== 'number' || typeof forterVal !== 'number' || customerVal === 0) return '—';
  const rel = ((forterVal - customerVal) / customerVal) * 100;
  const sign = rel >= 0 ? '+' : '';
  return `${sign}${rel.toFixed(decimals)}%`;
};

// ============================================================
// CHALLENGE 1: False fraud declines
// ============================================================

// Deduplication assumptions (shared across GMV uplift calculators)
export interface DeduplicationAssumptions {
  enabled: boolean;
  retryRate: number; // e.g., 50 for 50%
  successRate: number; // e.g., 50 for 50%
}

export const defaultDeduplicationAssumptions: DeduplicationAssumptions = {
  enabled: true,
  retryRate: 50,
  successRate: 75,
};

export interface Challenge1Inputs {
  transactionAttempts: number;
  transactionAttemptsValue: number;
  grossMarginPercent: number;
  approvalRate: number;
  fraudChargebackRate: number;
  // Marketplace fields
  isMarketplace?: boolean;
  commissionRate?: number;
  // Currency
  currencyCode?: string;
  // Completed AOV - used for value of approved transactions (can differ from calculated AOV)
  completedAOV?: number;
  /** Forter outcome override for Completed AOV ($); when set, used for Forter value of approved transactions. */
  forterCompletedAOV?: number;
  /** AOV uplift applied to recovered transactions only (default 1.15). */
  recoveredAovMultiplier?: number;
  // Forter KPIs
  forterApprovalRateImprovement: number; // e.g., 4 for 4%
  forterChargebackReduction: number; // e.g., 50 for 50% reduction
  // Deduplication
  deduplication?: DeduplicationAssumptions;
  // Fraud chargeback coverage - when enabled, Forter assumes chargeback liability (outcome $0)
  includesFraudCBCoverage?: boolean;
  /** GMV to Net sales deductions (%); default 20. Applied to value of approved before margin/EBITDA. */
  gmvToNetSalesDeductionPct?: number;
}

export interface DeduplicationBreakdown {
  /** For C245 simplified: Forter improvement in Approved transactions (#). When set, Total delta = -this. */
  approvedTxImprovement?: number;
  fraudTxDropOff: number;
  threeDSDropOff?: number;
  bankDeclineDelta?: number;
  nonFraudDelta: number;
  retryRate: number;
  successRate: number;
  duplicateSuccessfulTx: number;
  aov: number;
  gmvReduction: number;
}

export interface Challenge1Results {
  // Calculator 1: Reduce false declines
  calculator1: {
    rows: CalculatorRow[];
    revenueUplift: number;
    profitUplift: number;
    deduplicatedRevenueUplift?: number;
    deduplicatedProfitUplift?: number;
    deduplicationApplied?: boolean;
    deduplicationBreakdown?: DeduplicationBreakdown;
    /** Current-state completed transaction count (for refund volume formula: attempts × completion rate × refund rate) */
    customerCompletedTransactionCount: number;
  };
  // Calculator 2: Reduce fraud chargebacks
  calculator2: {
    rows: CalculatorRow[];
    costReduction: number;
  };
}

export interface CalculatorRow {
  formula: string;
  label: string;
  customerInput: string;
  forterImprovement: string;
  forterOutcome: string;
  valueDriver?: 'revenue' | 'profit' | 'cost';
  isCalculation?: boolean; // true for calculated rows (e.g., c = a*b), false for input rows (e.g., a, b)
  // Editable field identifiers for bi-directional updates
  editableCustomerField?: string; // formData field key (e.g., 'amerPreAuthApprovalRate')
  editableForterField?: string; // forterKPIs field key (e.g., 'preAuthApprovalImprovement')
  rawCustomerValue?: number; // Raw numeric value for editing
  rawForterValue?: number; // Raw numeric value for editing
  valueType?: 'currency' | 'percent' | 'number'; // How to parse/format the editable value
  footnote?: string; // Optional footnote text (e.g., for Fraud Coverage)
  readOnlyForterOutcome?: boolean; // If true, Forter outcome column is read-only (calculated from catch rate)
}

export function calculateChallenge1(inputs: Challenge1Inputs): Challenge1Results {
  const {
    transactionAttempts,
    transactionAttemptsValue,
    grossMarginPercent,
    approvalRate,
    fraudChargebackRate,
    isMarketplace = false,
    commissionRate = 100,
    currencyCode = 'USD',
    completedAOV,
    forterCompletedAOV,
    recoveredAovMultiplier,
    forterApprovalRateImprovement,
    forterChargebackReduction,
    deduplication = defaultDeduplicationAssumptions,
    includesFraudCBCoverage = false,
    gmvToNetSalesDeductionPct = 20,
  } = inputs;

  const aovMultiplier = recoveredAovMultiplier ?? 1.15;

  const fmt = (n: number) => n.toLocaleString('en-US');
  const fmtCur = createCurrencyFormatter(currencyCode);
  const fmtCur2 = createCurrencyFormatterWithDecimals(currencyCode, 2);
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;
  const fmtPct2 = (n: number) => `${n.toFixed(2)}%`; // Fraud chargeback rate: 2 decimals

  // Calculator 1: Reduce false declines
  // AOV used for display/reference
  const calculatedAOV = transactionAttempts > 0 ? transactionAttemptsValue / transactionAttempts : 0;
  // Completed AOV used for value of approved transactions (q = Completed AOV × p)
  const effectiveCompletedAOV = completedAOV ?? calculatedAOV;
  const forterEffectiveAOV = forterCompletedAOV ?? effectiveCompletedAOV;
  
  const customerApprovalDecimal = approvalRate / 100;
  const forterApprovalRate = approvalRate + forterApprovalRateImprovement;
  const forterApprovalDecimal = forterApprovalRate / 100;
  const grossMarginDecimal = grossMarginPercent / 100;
  const commissionDecimal = commissionRate / 100;
  // For marketplaces: profitability = GMV × Commission × Gross Margin (both applied)
  // For retailers: profitability = GMV × Gross Margin (only gross margin)
  const profitabilityMultiplier = isMarketplace 
    ? commissionDecimal * grossMarginDecimal 
    : grossMarginDecimal;

  const customerApprovedTx = transactionAttempts * customerApprovalDecimal;
  const forterApprovedTx = transactionAttempts * forterApprovalDecimal;
  const approvedTxImprovement = forterApprovedTx - customerApprovedTx;

  // Use Completed AOV for value of approved transactions; apply recovered AOV multiplier only to incremental recovered
  const customerApprovedValue = customerApprovedTx * effectiveCompletedAOV;
  const baseApprovedValue = customerApprovedTx * effectiveCompletedAOV;
  const incrementalRecoveredValue = approvedTxImprovement * effectiveCompletedAOV * aovMultiplier;
  const forterApprovedValue = baseApprovedValue + incrementalRecoveredValue;
  const weightedForterAOV_c1 = forterApprovedTx > 0 ? forterApprovedValue / forterApprovedTx : forterEffectiveAOV;
  const approvedValueImprovement = forterApprovedValue - customerApprovedValue;

  // Deduplication calculation for Challenge 1
  // Apply defaults so deduplication always applies when switch is on (treat missing .enabled as true)
  const dedup = { ...defaultDeduplicationAssumptions, ...deduplication };
  const deduplicationEnabled = dedup.enabled !== false;
  const retryRate = dedup.retryRate / 100;
  const successRate = dedup.successRate / 100;
  
  const fraudTxDropOff = approvedTxImprovement; // New approved transactions
  const duplicateSuccessfulTx = fraudTxDropOff * retryRate * successRate;
  const deduplicationGMVReduction = duplicateSuccessfulTx * effectiveCompletedAOV;
  
  // Deduplicated value = Value of approved transactions (Forter outcome) + Deduplication GMV reduction
  const forterApprovedValueDeduplicated = deduplicationEnabled 
    ? forterApprovedValue + deduplicationGMVReduction 
    : forterApprovedValue;
  const approvedValueImprovementDeduplicated = forterApprovedValueDeduplicated - customerApprovedValue;

  // Net sales = value of approved × (1 - GMV to Net sales deductions %)
  const netSalesMultiplier = 1 - gmvToNetSalesDeductionPct / 100;
  const customerNetSales = customerApprovedValue * netSalesMultiplier;
  const forterNetSales = forterApprovedValue * netSalesMultiplier;
  const forterNetSalesDeduplicated = forterApprovedValueDeduplicated * netSalesMultiplier;
  const netSalesImprovement = forterNetSales - customerNetSales;
  const netSalesImprovementDeduplicated = forterNetSalesDeduplicated - customerNetSales;

  // Profitability calculation: apply margin to net sales (not raw GMV)
  // For marketplaces: Net sales × Commission = Revenue, then Revenue × Gross Margin = Profitability
  // For retailers: Net sales × Gross Margin = Profitability
  const customerRevenue = isMarketplace ? customerNetSales * commissionDecimal : customerNetSales;
  const forterRevenue = isMarketplace ? forterNetSales * commissionDecimal : forterNetSales;
  const forterRevenueDeduplicated = isMarketplace ? forterNetSalesDeduplicated * commissionDecimal : forterNetSalesDeduplicated;
  
  const customerProfitability = customerNetSales * profitabilityMultiplier;
  const forterProfitability = forterNetSales * profitabilityMultiplier;
  const forterProfitabilityDeduplicated = forterNetSalesDeduplicated * profitabilityMultiplier;
  const profitabilityImprovement = forterProfitability - customerProfitability;
  const profitabilityImprovementDeduplicated = forterProfitabilityDeduplicated - customerProfitability;

  // Labels for margin rows
  const marginLabel = isMarketplace ? 'Commission / Take rate (%)' : 'Gross margin (%)';
  const effectiveMarginPercent = isMarketplace ? commissionRate : grossMarginPercent;

  // Display values depending on deduplication
  const displayForterApprovedValue = deduplicationEnabled ? forterApprovedValueDeduplicated : forterApprovedValue;
  const displayApprovedValueImprovement = deduplicationEnabled ? approvedValueImprovementDeduplicated : approvedValueImprovement;
  const displayForterRevenue = deduplicationEnabled ? forterRevenueDeduplicated : forterRevenue;
  const displayRevenueImprovement = displayForterRevenue - customerRevenue;
  const displayForterProfitability = deduplicationEnabled ? forterProfitabilityDeduplicated : forterProfitability;
  const displayProfitabilityImprovement = deduplicationEnabled ? profitabilityImprovementDeduplicated : profitabilityImprovement;
  
  // Completion rate = Value of approved transactions / eCommerce sales attempts ($)
  // When dedup is on, Forter side uses f'/b (displayForterApprovedValue = forterApprovedValueDeduplicated)
  const customerCompletionRate = transactionAttemptsValue > 0 
    ? (customerApprovedValue / transactionAttemptsValue) * 100 
    : approvalRate;
  const forterCompletionRate = transactionAttemptsValue > 0 
    ? (displayForterApprovedValue / transactionAttemptsValue) * 100 
    : forterApprovalRate;
  const completionRateImprovement = forterCompletionRate - customerCompletionRate;

  // When deduplication is enabled, we show BOTH the raw value and the deduplicated value
  // When disabled, we show just the raw value (no deduplication row)
  
  // Build calculator rows - marketplace has additional Revenue row between Commission and Profitability
  const calculator1Rows: CalculatorRow[] = [
    { formula: 'a', label: 'Transaction Attempts (#)', customerInput: fmt(transactionAttempts), forterImprovement: '', forterOutcome: fmt(transactionAttempts), editableCustomerField: 'amerGrossAttempts', rawCustomerValue: transactionAttempts, valueType: 'number' },
    { formula: 'b', label: 'Transaction Attempts ($)', customerInput: fmtCur(transactionAttemptsValue), forterImprovement: '', forterOutcome: fmtCur(transactionAttemptsValue), editableCustomerField: 'amerAnnualGMV', rawCustomerValue: transactionAttemptsValue, valueType: 'currency' },
    { formula: 'c = b/a', label: 'Average order value (calculated)', customerInput: fmtCur(calculatedAOV), forterImprovement: '', forterOutcome: fmtCur(calculatedAOV), isCalculation: true },
    { formula: 'd', label: 'Fraud approval rate (%)', customerInput: fmtPct(approvalRate), forterImprovement: formatPctImprovementRel(approvalRate, forterApprovalRate), forterOutcome: fmtPct(forterApprovalRate), editableCustomerField: 'amerPreAuthApprovalRate', rawCustomerValue: approvalRate, editableForterField: 'approvalRateImprovement', rawForterValue: forterApprovalRate, valueType: 'percent' },
    { formula: 'e = a*d', label: 'Approved transactions (#)', customerInput: fmt(Math.round(customerApprovedTx)), forterImprovement: fmt(Math.round(approvedTxImprovement)), forterOutcome: fmt(Math.round(forterApprovedTx)), isCalculation: true },
    { formula: 'c\'', label: 'Completed AOV (for value of approved transactions)', customerInput: fmtCur(effectiveCompletedAOV), forterImprovement: aovMultiplier !== 1 ? `+${fmtCur(weightedForterAOV_c1 - effectiveCompletedAOV)}` : '', forterOutcome: fmtCur(weightedForterAOV_c1), editableCustomerField: 'completedAOV', rawCustomerValue: effectiveCompletedAOV, readOnlyForterOutcome: true, valueType: 'currency' },
    ...(aovMultiplier !== 1 ? [{ formula: '', label: `  ↳ Recovered transactions at ${aovMultiplier}× AOV (Forter KPI assumption)`, customerInput: '', forterImprovement: '', forterOutcome: '' } as CalculatorRow] : []),
    // Always show the non-deduplicated value first
    { formula: 'f = c\'*e', label: 'Value of approved transactions ($)', customerInput: fmtCur(customerApprovedValue), forterImprovement: fmtCur(approvedValueImprovement), forterOutcome: fmtCur(forterApprovedValue), valueDriver: deduplicationEnabled ? undefined : 'revenue', isCalculation: true },
    // When deduplication is enabled, show the deduplicated row as well (this becomes the value driver)
    ...(deduplicationEnabled ? [
      { formula: 'f\' = f - dedup', label: 'Deduplicated value of approved transactions ($)', customerInput: fmtCur(customerApprovedValue), forterImprovement: fmtCur(approvedValueImprovementDeduplicated), forterOutcome: fmtCur(forterApprovedValueDeduplicated), valueDriver: 'revenue' as const, isCalculation: true } as CalculatorRow,
    ] : []),
    { formula: 'g = f/b', label: 'Completion rate (%)', customerInput: fmtPct(customerCompletionRate), forterImprovement: formatPctImprovementRel(customerCompletionRate, forterCompletionRate), forterOutcome: fmtPct(forterCompletionRate), isCalculation: true },
    { formula: 'h', label: 'GMV to Net sales deductions (sales tax/cancellations) (%)', customerInput: fmtPct(gmvToNetSalesDeductionPct), forterImprovement: '', forterOutcome: fmtPct(gmvToNetSalesDeductionPct), editableCustomerField: 'gmvToNetSalesDeductionPct', rawCustomerValue: gmvToNetSalesDeductionPct, valueType: 'percent' },
    { formula: 'i = f×(1-h)', label: 'Net sales ($)', customerInput: fmtCur(customerNetSales), forterImprovement: fmtCur(netSalesImprovement), forterOutcome: fmtCur(forterNetSales), isCalculation: true },
    ...(deduplicationEnabled ? [
      { formula: 'i\' = f\'×(1-h)', label: 'Net sales ($) (deduplicated)', customerInput: fmtCur(customerNetSales), forterImprovement: fmtCur(netSalesImprovementDeduplicated), forterOutcome: fmtCur(forterNetSalesDeduplicated), valueDriver: 'revenue' as const, isCalculation: true } as CalculatorRow,
    ] : []),
    { formula: 'j', label: marginLabel, customerInput: fmtPct(effectiveMarginPercent), forterImprovement: '', forterOutcome: fmtPct(effectiveMarginPercent), editableCustomerField: isMarketplace ? 'commissionRate' : 'amerGrossMarginPercent', rawCustomerValue: effectiveMarginPercent, valueType: 'percent' },
    // For marketplaces: add Revenue row (Net sales × Commission), then Gross Margin row, then Profitability (Revenue × Margin)
    // For retailers: skip Revenue, just show Profitability (Net sales × Gross Margin)
    ...(isMarketplace ? [
      { formula: 'k = i*j', label: 'Revenue ($)', customerInput: fmtCur(customerRevenue), forterImprovement: fmtCur(displayRevenueImprovement), forterOutcome: fmtCur(displayForterRevenue), isCalculation: true } as CalculatorRow,
      { formula: 'l', label: 'Gross margin (%)', customerInput: fmtPct(grossMarginPercent), forterImprovement: '', forterOutcome: fmtPct(grossMarginPercent), editableCustomerField: 'amerGrossMarginPercent', rawCustomerValue: grossMarginPercent, valueType: 'percent' as const } as CalculatorRow,
      // Show non-deduplicated profitability first when deduplication is enabled
      ...(deduplicationEnabled ? [
        { formula: 'm = k*l', label: 'Gross EBITDA contribution (before Forter costs) ($)', customerInput: fmtCur(customerProfitability), forterImprovement: fmtCur(profitabilityImprovement), forterOutcome: fmtCur(forterProfitability), isCalculation: true } as CalculatorRow,
        { formula: 'm\' = m - dedup', label: 'Deduplicated EBITDA contribution ($)', customerInput: fmtCur(customerProfitability), forterImprovement: fmtCur(profitabilityImprovementDeduplicated), forterOutcome: fmtCur(forterProfitabilityDeduplicated), valueDriver: 'profit' as const, isCalculation: true } as CalculatorRow,
      ] : [
        { formula: 'm = k*l', label: 'Gross EBITDA contribution (before Forter costs) ($)', customerInput: fmtCur(customerProfitability), forterImprovement: fmtCur(displayProfitabilityImprovement), forterOutcome: fmtCur(displayForterProfitability), valueDriver: 'profit' as const, isCalculation: true } as CalculatorRow,
      ]),
    ] : [
      // For retailers: show profitability directly (Net sales × Gross margin)
      ...(deduplicationEnabled ? [
        { formula: 'k = i*j', label: 'Gross EBITDA contribution (before Forter costs) ($)', customerInput: fmtCur(customerProfitability), forterImprovement: fmtCur(profitabilityImprovement), forterOutcome: fmtCur(forterProfitability), isCalculation: true } as CalculatorRow,
        { formula: 'k\' = k - dedup', label: 'Deduplicated EBITDA contribution ($)', customerInput: fmtCur(customerProfitability), forterImprovement: fmtCur(profitabilityImprovementDeduplicated), forterOutcome: fmtCur(forterProfitabilityDeduplicated), valueDriver: 'profit' as const, isCalculation: true } as CalculatorRow,
      ] : [
        { formula: 'k = i*j', label: 'Gross EBITDA contribution (before Forter costs) ($)', customerInput: fmtCur(customerProfitability), forterImprovement: fmtCur(displayProfitabilityImprovement), forterOutcome: fmtCur(displayForterProfitability), valueDriver: 'profit' as const, isCalculation: true } as CalculatorRow,
      ]),
    ]),
  ];

  // Calculator 2: Reduce fraud chargebacks (uses deduplicated value if enabled)
  const customerCBDecimal = fraudChargebackRate / 100;
  const forterCBDecimal = customerCBDecimal * (1 - forterChargebackReduction / 100);
  const cbRateImprovement = (forterCBDecimal - customerCBDecimal) * 100;

  const customerChargebacks = customerApprovedValue * customerCBDecimal;
  // When fraud chargeback coverage is enabled, Forter takes liability so customer sees $0
  const forterChargebacks = includesFraudCBCoverage ? 0 : displayForterApprovedValue * forterCBDecimal;
  const chargebackSavings = customerChargebacks - forterChargebacks;

  const calculator2Rows: CalculatorRow[] = [
    { formula: 'a', label: 'Value of approved transactions ($)', customerInput: fmtCur(customerApprovedValue), forterImprovement: '', forterOutcome: fmtCur(displayForterApprovedValue), isCalculation: true },
    { formula: 'b', label: 'Gross Fraud Chargeback Rate (%)', customerInput: fmtPct2(fraudChargebackRate), forterImprovement: formatPctImprovementRel(fraudChargebackRate, forterCBDecimal * 100, 2), forterOutcome: includesFraudCBCoverage ? '0.00%*' : fmtPct2(forterCBDecimal * 100), editableCustomerField: 'fraudCBRate', rawCustomerValue: fraudChargebackRate, editableForterField: 'chargebackReduction', rawForterValue: forterCBDecimal * 100, valueType: 'percent' },
    { formula: 'c = a*b', label: includesFraudCBCoverage ? 'Fraud chargebacks*' : 'Fraud chargebacks', customerInput: fmtCur2(-customerChargebacks), forterImprovement: fmtCur2(chargebackSavings), forterOutcome: includesFraudCBCoverage ? '$0.00*' : fmtCur2(-forterChargebacks), valueDriver: 'cost', isCalculation: true, footnote: includesFraudCBCoverage ? '*Forter assumes chargeback liability under Fraud Coverage' : undefined },
  ];

  // Build deduplication breakdown for info popover
  const deduplicationBreakdown: DeduplicationBreakdown = {
    fraudTxDropOff: -approvedTxImprovement, // Negative (fewer declines = negative drop-off)
    nonFraudDelta: -approvedTxImprovement,
    retryRate: dedup.retryRate,
    successRate: dedup.successRate,
    duplicateSuccessfulTx: -duplicateSuccessfulTx, // Negative
    aov: effectiveCompletedAOV,
    gmvReduction: -deduplicationGMVReduction, // Negative (reduction shown in brackets)
  };

  return {
    calculator1: { 
      rows: calculator1Rows, 
      revenueUplift: displayApprovedValueImprovement, 
      profitUplift: displayProfitabilityImprovement,
      deduplicatedRevenueUplift: approvedValueImprovementDeduplicated,
      deduplicatedProfitUplift: profitabilityImprovementDeduplicated,
      deduplicationApplied: deduplicationEnabled,
      deduplicationBreakdown,
      customerCompletedTransactionCount: customerApprovedTx,
    },
    calculator2: { rows: calculator2Rows, costReduction: chargebackSavings },
  };
}

// ============================================================
// CHALLENGES 2, 4, 5: Rules + 3DS + Exemptions
// ============================================================

export interface Challenge245Inputs {
  transactionAttempts: number;
  transactionAttemptsValue: number;
  grossMarginPercent: number;
  preAuthApprovalRate: number;
  postAuthApprovalRate: number;
  creditCardPct: number;
  creditCard3DSPct: number;
  threeDSFailureRate: number;
  issuingBankDeclineRate: number;
  /** Optional Forter override for 3DS failure rate (%); when set, used for Forter path. */
  forter3DSAbandonmentRate?: number;
  /** Optional Forter override for issuing bank decline rate (%); when set, used for Forter path. */
  forterIssuingBankDeclineRate?: number;
  fraudChargebackRate: number;
  // Marketplace fields
  isMarketplace?: boolean;
  commissionRate?: number;
  // Currency
  currencyCode?: string;
  // Completed AOV - used for value of approved transactions (can differ from calculated AOV)
  completedAOV?: number;
  /** Forter outcome override for Completed AOV ($); when set, used for Forter value of approved transactions. */
  forterCompletedAOV?: number;
  /** AOV uplift applied to recovered transactions only (default 1.15). */
  recoveredAovMultiplier?: number;
  // Forter KPIs
  forterPreAuthImprovement: number;
  forterPostAuthImprovement: number;
  forter3DSReduction: number;
  forterChargebackReduction: number;
  // Target values for display (always provided now)
  forterTargetCBRate: number;
  forterTargetPreAuthRate?: number;
  forterTargetPostAuthRate?: number;
  // Deduplication
  deduplication?: DeduplicationAssumptions;
  // Fraud chargeback coverage - when enabled, Forter assumes chargeback liability
  includesFraudCBCoverage?: boolean;
  /** GMV to Net sales deductions (%); default 20. Applied to value of approved before margin/EBITDA. */
  gmvToNetSalesDeductionPct?: number;
}

export interface Challenge245Results {
  calculator1: { 
    rows: CalculatorRow[]; 
    revenueUplift: number; 
    profitUplift: number;
    deduplicatedRevenueUplift?: number;
    deduplicatedProfitUplift?: number;
    deduplicationApplied?: boolean;
    deduplicationBreakdown?: DeduplicationBreakdown;
    /** Current-state completed transaction count (for refund volume formula: attempts × completion rate × refund rate) */
    customerCompletedTransactionCount: number;
  };
  calculator2: { rows: CalculatorRow[]; costReduction: number; };
}

export function calculateChallenge245(inputs: Challenge245Inputs): Challenge245Results {
  const { currencyCode = 'USD', deduplication = defaultDeduplicationAssumptions, includesFraudCBCoverage = false } = inputs;
  const fmt = (n: number) => n.toLocaleString('en-US');
  const fmtCur = createCurrencyFormatter(currencyCode);
  const fmtCur2 = createCurrencyFormatterWithDecimals(currencyCode, 2);
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;
  const fmtPct2 = (n: number) => `${n.toFixed(2)}%`; // Fraud chargeback rate: 2 decimals

  const {
    transactionAttempts, transactionAttemptsValue, grossMarginPercent,
    preAuthApprovalRate, postAuthApprovalRate, creditCardPct, creditCard3DSPct,
    threeDSFailureRate, issuingBankDeclineRate, forter3DSAbandonmentRate, forterIssuingBankDeclineRate,
    fraudChargebackRate,
    isMarketplace = false, commissionRate = 100, completedAOV, forterCompletedAOV, recoveredAovMultiplier,
    forterPreAuthImprovement, forterPostAuthImprovement, forter3DSReduction, forterChargebackReduction,
    forterTargetCBRate, forterTargetPreAuthRate, forterTargetPostAuthRate,
    gmvToNetSalesDeductionPct = 20,
  } = inputs;

  const aovMultiplier = recoveredAovMultiplier ?? 1.15;

  // AOV calculated from transaction data
  const calculatedAOV = transactionAttempts > 0 ? transactionAttemptsValue / transactionAttempts : 0;
  // Completed AOV used for value of approved transactions (q = Completed AOV × p)
  const effectiveCompletedAOV = completedAOV ?? calculatedAOV;
  const forterEffectiveAOV = forterCompletedAOV ?? effectiveCompletedAOV;
  
  // For marketplaces: profitability = GMV × Commission × Gross Margin (both applied)
  // For retailers: profitability = GMV × Gross Margin (only gross margin)
  const grossMarginDecimal = grossMarginPercent / 100;
  const commissionDecimal = commissionRate / 100;
  const profitabilityMultiplier = isMarketplace 
    ? commissionDecimal * grossMarginDecimal 
    : grossMarginDecimal;
  const marginLabel = isMarketplace ? 'Commission / Take rate (%)' : 'Gross margin (%)';

  // Deduplication parameters: apply defaults so deduplication always applies when switch is on (treat missing .enabled as true)
  const dedup = { ...defaultDeduplicationAssumptions, ...deduplication };
  const deduplicationEnabled = dedup.enabled !== false;
  const retryRate = dedup.retryRate / 100;
  const successRate = dedup.successRate / 100;

  // Customer state
  const custPreAuth = preAuthApprovalRate / 100;
  const custPostAuth = postAuthApprovalRate / 100;
  const custCCPct = creditCardPct / 100;
  const cust3DSPct = creditCard3DSPct / 100;
  const cust3DSFail = threeDSFailureRate / 100;
  const custBankDecline = issuingBankDeclineRate / 100;
  const custCBRate = fraudChargebackRate / 100;

  // Forter state: when target rate is provided, use it directly; otherwise current + improvement (clamp to 0-100% so outcome can be below customer when target is lower)
  const fortPreAuth = Math.max(0, Math.min(1, forterTargetPreAuthRate !== undefined
    ? forterTargetPreAuthRate / 100
    : (preAuthApprovalRate + forterPreAuthImprovement) / 100));
  const fortPostAuth = Math.max(0, Math.min(1, forterTargetPostAuthRate !== undefined
    ? forterTargetPostAuthRate / 100
    : (postAuthApprovalRate + forterPostAuthImprovement) / 100));
  const fort3DSPct = Math.max(0, creditCard3DSPct - forter3DSReduction) / 100;
  // Forter 3DS failure and bank decline: use overrides when set, else same as customer
  const fort3DSFail = (forter3DSAbandonmentRate !== undefined && forter3DSAbandonmentRate !== null ? forter3DSAbandonmentRate : threeDSFailureRate) / 100;
  const fortBankDecline = (forterIssuingBankDeclineRate !== undefined && forterIssuingBankDeclineRate !== null ? forterIssuingBankDeclineRate : issuingBankDeclineRate) / 100;
  // For CB rate: always use the target rate directly for accuracy
  const fortCBRate = forterTargetCBRate / 100;

  // Customer calculations
  const custApprovedPreAuth = transactionAttempts * custPreAuth;
  const custCCTx = custApprovedPreAuth * custCCPct;
  const cust3DSTx = custCCTx * cust3DSPct;
  const cust3DSFails = cust3DSTx * cust3DSFail;
  const custToBank = custApprovedPreAuth - cust3DSFails;
  const custBankDeclines = custToBank * custBankDecline;
  const custPostBankTx = custToBank - custBankDeclines;
  const custFinalApproved = custPostBankTx * custPostAuth;
  // Use Completed AOV for value of approved transactions (q = Completed AOV × p)
  const custFinalValue = custFinalApproved * effectiveCompletedAOV;
  // Completion rate (%) = Value of approved transactions ($) / Transaction Attempts ($) — r = q/b
  const custCompletionRate = transactionAttemptsValue > 0 ? (custFinalValue / transactionAttemptsValue) * 100 : 0;
  // Net sales = value of approved × (1 - GMV to Net sales deductions %)
  const netSalesMultiplier = 1 - gmvToNetSalesDeductionPct / 100;
  const custNetSales = custFinalValue * netSalesMultiplier;

  // For marketplaces: Revenue = Net sales × Commission, then Profitability = Revenue × Gross Margin
  const custRevenue = isMarketplace ? custNetSales * commissionDecimal : custNetSales;
  const custProfitability = custNetSales * profitabilityMultiplier;

  // Forter calculations (use Forter 3DS and bank decline rates so edits to Forter outcome drive downstream maths)
  const fortApprovedPreAuth = transactionAttempts * fortPreAuth;
  const fortCCTx = fortApprovedPreAuth * custCCPct;
  const fort3DSTx = fortCCTx * fort3DSPct;
  const fort3DSFails = fort3DSTx * fort3DSFail;
  const fortToBank = fortApprovedPreAuth - fort3DSFails;
  const fortBankDeclines = fortToBank * fortBankDecline;
  const fortPostBankTx = fortToBank - fortBankDeclines;
  const fortFinalApproved = fortPostBankTx * fortPostAuth;
  // Value of approved: baseline at AOV, recovered (incremental) at AOV × multiplier
  const totalRecovered_c245 = Math.max(0, fortFinalApproved - custFinalApproved);
  const fortFinalValue = custFinalValue + totalRecovered_c245 * effectiveCompletedAOV * aovMultiplier;
  const weightedForterAOV_c245 = fortFinalApproved > 0 ? fortFinalValue / fortFinalApproved : forterEffectiveAOV;
  // Completion rate (%) = Value of approved transactions ($) / Transaction Attempts ($) — r = q/b (forter: q'/b when dedup)
  const fortCompletionRate = transactionAttemptsValue > 0 ? (fortFinalValue / transactionAttemptsValue) * 100 : 0;
  const fortNetSales = fortFinalValue * netSalesMultiplier;
  // For marketplaces: Revenue = Net sales × Commission, then Profitability = Revenue × Gross Margin
  const fortRevenue = isMarketplace ? fortNetSales * commissionDecimal : fortNetSales;
  const fortProfitability = fortNetSales * profitabilityMultiplier;

  // Deduplication calculation for Challenge 245 (simplified)
  // a = Approved transactions (#) improvement = fortFinalApproved - custFinalApproved
  // b = Total delta (inverse) = −a
  // c = retry rate, d = success rate
  // e = b×c×d = Duplicate successful transactions
  // f = AOV; g = e×f = Deduplication GMV reduction (applied to value of approved transactions)
  const approvedTxImprovement = fortFinalApproved - custFinalApproved; // a
  const totalDelta = -approvedTxImprovement; // b = −a
  const duplicateSuccessfulTx = totalDelta * retryRate * successRate; // e = b×c×d
  const deduplicationGMVReduction = duplicateSuccessfulTx * effectiveCompletedAOV; // g = e×f

  // Deduplicated value = Value of approved transactions (Forter outcome) + Deduplication GMV reduction
  const fortFinalValueDeduplicated = deduplicationEnabled 
    ? fortFinalValue + deduplicationGMVReduction 
    : fortFinalValue;
  const fortNetSalesDeduplicated = fortFinalValueDeduplicated * netSalesMultiplier;
  // r = q'/b when deduplication enabled
  const fortCompletionRateDeduplicated = transactionAttemptsValue > 0 
    ? (fortFinalValueDeduplicated / transactionAttemptsValue) * 100 
    : 0;
  const fortRevenueDeduplicated = isMarketplace ? fortNetSalesDeduplicated * commissionDecimal : fortNetSalesDeduplicated;
  const fortProfitabilityDeduplicated = fortNetSalesDeduplicated * profitabilityMultiplier;

  const revenueUplift = fortFinalValue - custFinalValue;
  const profitUplift = fortProfitability - custProfitability;
  const revenueUpliftDeduplicated = fortFinalValueDeduplicated - custFinalValue;
  const profitUpliftDeduplicated = fortProfitabilityDeduplicated - custProfitability;

  // Display values depending on deduplication
  const displayFortFinalValue = deduplicationEnabled ? fortFinalValueDeduplicated : fortFinalValue;
  const displayRevenueUplift = deduplicationEnabled ? revenueUpliftDeduplicated : revenueUplift;
  const displayFortCompletionRate = deduplicationEnabled ? fortCompletionRateDeduplicated : fortCompletionRate;
  const displayFortRevenue = deduplicationEnabled ? fortRevenueDeduplicated : fortRevenue;
  const displayRevenueRowImprovement = displayFortRevenue - custRevenue;
  const displayFortProfitability = deduplicationEnabled ? fortProfitabilityDeduplicated : fortProfitability;
  const displayProfitUplift = deduplicationEnabled ? profitUpliftDeduplicated : profitUplift;

  // When deduplication is enabled, we show BOTH the raw value and the deduplicated value
  // When disabled, we show just the raw value (no deduplication row)

  // For margin row display - marketplaces show commission rate, retailers show gross margin
  const effectiveMarginPercent = isMarketplace ? commissionRate : grossMarginPercent;
  
  // Revenue row calculations (non-deduplicated)
  const revenueRowImprovement = fortRevenue - custRevenue;

  const calculator1Rows: CalculatorRow[] = [
    { formula: 'a', label: 'Transaction Attempts (#)', customerInput: fmt(transactionAttempts), forterImprovement: '', forterOutcome: fmt(transactionAttempts), editableCustomerField: 'amerGrossAttempts', rawCustomerValue: transactionAttempts, valueType: 'number' },
    { formula: 'b', label: 'Transaction Attempts ($)', customerInput: fmtCur(transactionAttemptsValue), forterImprovement: '', forterOutcome: fmtCur(transactionAttemptsValue), editableCustomerField: 'amerAnnualGMV', rawCustomerValue: transactionAttemptsValue, valueType: 'currency' },
    { formula: 'c = b/a', label: 'Average order value (calculated)', customerInput: fmtCur(calculatedAOV), forterImprovement: '', forterOutcome: fmtCur(calculatedAOV), isCalculation: true },
    { formula: 'd', label: 'Pre-Auth Fraud Approval Rate (%)', customerInput: fmtPct(preAuthApprovalRate), forterImprovement: formatPctImprovementRel(preAuthApprovalRate, fortPreAuth * 100), forterOutcome: fmtPct(fortPreAuth * 100), editableCustomerField: 'amerPreAuthApprovalRate', rawCustomerValue: preAuthApprovalRate, editableForterField: 'preAuthApprovalImprovement', rawForterValue: fortPreAuth * 100, valueType: 'percent' },
    { formula: 'e = a*d', label: 'Approved transactions (#)', customerInput: fmt(Math.round(custApprovedPreAuth)), forterImprovement: fmt(Math.round(fortApprovedPreAuth - custApprovedPreAuth)), forterOutcome: fmt(Math.round(fortApprovedPreAuth)), isCalculation: true },
    { formula: '', label: '3DS', customerInput: '', forterImprovement: '', forterOutcome: '' },
    { formula: 'f', label: '% of Transactions that are Credit Cards (%)', customerInput: fmtPct(creditCardPct), forterImprovement: '0.0% pts', forterOutcome: fmtPct(creditCardPct), editableCustomerField: 'amerCreditCardPct', rawCustomerValue: creditCardPct, valueType: 'percent' },
    { formula: 'g = e*f', label: 'Transactions that are credit cards - Volume (#)', customerInput: fmt(Math.round(custCCTx)), forterImprovement: '', forterOutcome: fmt(Math.round(fortCCTx)), isCalculation: true },
    { formula: 'h', label: 'Challenge 3DS Rate (%)', customerInput: fmtPct(creditCard3DSPct), forterImprovement: formatPctImprovementRel(creditCard3DSPct, Math.max(0, creditCard3DSPct - forter3DSReduction)), forterOutcome: fmtPct(Math.max(0, creditCard3DSPct - forter3DSReduction)), editableCustomerField: 'amer3DSChallengeRate', rawCustomerValue: creditCard3DSPct, editableForterField: 'threeDSReduction', rawForterValue: Math.max(0, creditCard3DSPct - forter3DSReduction), valueType: 'percent' },
    { formula: 'i = g*h', label: 'Credit card transactions using 3DS - Volume (#)', customerInput: fmt(Math.round(cust3DSTx)), forterImprovement: '', forterOutcome: fmt(Math.round(fort3DSTx)), isCalculation: true },
    { formula: 'j', label: '3DS Failure & Abandonment Rate (%)', customerInput: fmtPct(threeDSFailureRate), forterImprovement: `${(threeDSFailureRate - (forter3DSAbandonmentRate ?? threeDSFailureRate)).toFixed(1)}% pts`, forterOutcome: fmtPct(forter3DSAbandonmentRate ?? threeDSFailureRate), editableCustomerField: 'amer3DSAbandonmentRate', rawCustomerValue: threeDSFailureRate, editableForterField: 'forter3DSAbandonmentRate', rawForterValue: forter3DSAbandonmentRate ?? threeDSFailureRate, valueType: 'percent' },
    { formula: 'k = i*j', label: '3DS failure & abandonment rate - Volume (#)', customerInput: fmt(Math.round(cust3DSFails)), forterImprovement: fmt(Math.round(fort3DSFails - cust3DSFails)), forterOutcome: fmt(Math.round(fort3DSFails)), isCalculation: true },
    { formula: '', label: 'Issuing bank', customerInput: '', forterImprovement: '', forterOutcome: '' },
    { formula: 'l = e-k', label: 'Transactions sent to issuing bank', customerInput: fmt(Math.round(custToBank)), forterImprovement: fmt(Math.round(fortToBank - custToBank)), forterOutcome: fmt(Math.round(fortToBank)), isCalculation: true },
    { formula: 'm', label: 'Issuing Bank Decline Rate (%)', customerInput: fmtPct(issuingBankDeclineRate), forterImprovement: `${(issuingBankDeclineRate - (forterIssuingBankDeclineRate ?? issuingBankDeclineRate)).toFixed(1)}% pts`, forterOutcome: fmtPct(forterIssuingBankDeclineRate ?? issuingBankDeclineRate), editableCustomerField: 'amerIssuingBankDeclineRate', rawCustomerValue: issuingBankDeclineRate, editableForterField: 'forterIssuingBankDeclineRate', rawForterValue: forterIssuingBankDeclineRate ?? issuingBankDeclineRate, valueType: 'percent' },
    { formula: 'n = l*m', label: 'Issuing bank declines', customerInput: fmt(Math.round(custBankDeclines)), forterImprovement: fmt(Math.round(fortBankDeclines - custBankDeclines)), forterOutcome: fmt(Math.round(fortBankDeclines)), isCalculation: true },
    { formula: '', label: 'Post-auth fraud', customerInput: '', forterImprovement: '', forterOutcome: '' },
    { formula: 'o', label: 'Post-Auth Approval Rate (%)', customerInput: fmtPct(postAuthApprovalRate), forterImprovement: formatPctImprovementRel(postAuthApprovalRate, fortPostAuth * 100), forterOutcome: fmtPct(fortPostAuth * 100), editableCustomerField: 'amerPostAuthApprovalRate', rawCustomerValue: postAuthApprovalRate, editableForterField: 'postAuthApprovalImprovement', rawForterValue: fortPostAuth * 100, valueType: 'percent' },
    { formula: 'p = (l-n)*o', label: 'Approved transactions (#)', customerInput: fmt(Math.round(custFinalApproved)), forterImprovement: fmt(Math.round(fortFinalApproved - custFinalApproved)), forterOutcome: fmt(Math.round(fortFinalApproved)), isCalculation: true },
    { formula: 'c\'', label: 'Completed AOV (for value of approved transactions)', customerInput: fmtCur(effectiveCompletedAOV), forterImprovement: aovMultiplier !== 1 ? `+${fmtCur(weightedForterAOV_c245 - effectiveCompletedAOV)}` : '', forterOutcome: fmtCur(weightedForterAOV_c245), editableCustomerField: 'completedAOV', rawCustomerValue: effectiveCompletedAOV, readOnlyForterOutcome: true, valueType: 'currency' },
    ...(aovMultiplier !== 1 ? [{ formula: '', label: `  ↳ Recovered transactions at ${aovMultiplier}× AOV (Forter KPI assumption)`, customerInput: '', forterImprovement: '', forterOutcome: '' } as CalculatorRow] : []),
    // Always show the non-deduplicated value first
    { formula: 'q = c\'*p', label: 'Value of approved transactions ($)', customerInput: fmtCur(custFinalValue), forterImprovement: fmtCur(revenueUplift), forterOutcome: fmtCur(fortFinalValue), valueDriver: deduplicationEnabled ? undefined : 'revenue', isCalculation: true },
    // When deduplication is enabled, show the deduplicated row: q' = q + g (value of approved + GMV reduction)
    ...(deduplicationEnabled ? [
      { formula: 'q\' = q + g', label: 'Deduplicated value of approved transactions ($)', customerInput: fmtCur(custFinalValue), forterImprovement: fmtCur(revenueUpliftDeduplicated), forterOutcome: fmtCur(fortFinalValueDeduplicated), valueDriver: 'revenue' as const, isCalculation: true } as CalculatorRow,
    ] : []),
    // forterOutcome = r = q'/b when dedup enabled (displayFortCompletionRate from fortFinalValueDeduplicated)
    { formula: 'r = q/b', label: 'Completion rate (%)', customerInput: fmtPct(custCompletionRate), forterImprovement: formatPctImprovementRel(custCompletionRate, displayFortCompletionRate, 2), forterOutcome: fmtPct(displayFortCompletionRate), isCalculation: true },
    { formula: 's', label: 'GMV to Net sales deductions (sales tax/cancellations) (%)', customerInput: fmtPct(gmvToNetSalesDeductionPct), forterImprovement: '', forterOutcome: fmtPct(gmvToNetSalesDeductionPct), editableCustomerField: 'gmvToNetSalesDeductionPct', rawCustomerValue: gmvToNetSalesDeductionPct, valueType: 'percent' },
    { formula: 't = q×(1-s)', label: 'Net sales ($)', customerInput: fmtCur(custNetSales), forterImprovement: fmtCur(deduplicationEnabled ? fortNetSalesDeduplicated - custNetSales : fortNetSales - custNetSales), forterOutcome: fmtCur(deduplicationEnabled ? fortNetSalesDeduplicated : fortNetSales), isCalculation: true },
    ...(deduplicationEnabled ? [
      { formula: 't\' = q\'×(1-s)', label: 'Net sales ($) (deduplicated)', customerInput: fmtCur(custNetSales), forterImprovement: fmtCur(fortNetSalesDeduplicated - custNetSales), forterOutcome: fmtCur(fortNetSalesDeduplicated), valueDriver: 'revenue' as const, isCalculation: true } as CalculatorRow,
    ] : []),
    { formula: 'u', label: marginLabel, customerInput: fmtPct(effectiveMarginPercent), forterImprovement: '', forterOutcome: fmtPct(effectiveMarginPercent), editableCustomerField: isMarketplace ? 'commissionRate' : 'amerGrossMarginPercent', rawCustomerValue: effectiveMarginPercent, valueType: 'percent' },
    // For marketplaces: add Revenue row (Net sales × Commission), then Gross Margin row, then Profitability (Revenue × Margin)
    // For retailers: skip Revenue, just show Profitability (Net sales × Gross margin)
    ...(isMarketplace ? [
      { formula: 'v = t*u', label: 'Revenue ($)', customerInput: fmtCur(custRevenue), forterImprovement: fmtCur(displayRevenueRowImprovement), forterOutcome: fmtCur(displayFortRevenue), isCalculation: true } as CalculatorRow,
      { formula: 'w', label: 'Gross margin (%)', customerInput: fmtPct(grossMarginPercent), forterImprovement: '', forterOutcome: fmtPct(grossMarginPercent), editableCustomerField: 'amerGrossMarginPercent', rawCustomerValue: grossMarginPercent, valueType: 'percent' as const } as CalculatorRow,
      // Show both rows when deduplication is enabled
      ...(deduplicationEnabled ? [
        { formula: 'x = v*w', label: 'Gross EBITDA contribution (before Forter costs) ($)', customerInput: fmtCur(custProfitability), forterImprovement: fmtCur(profitUplift), forterOutcome: fmtCur(fortProfitability), isCalculation: true } as CalculatorRow,
        { formula: 'x\' = x - dedup', label: 'Deduplicated EBITDA contribution ($)', customerInput: fmtCur(custProfitability), forterImprovement: fmtCur(profitUpliftDeduplicated), forterOutcome: fmtCur(fortProfitabilityDeduplicated), valueDriver: 'profit' as const, isCalculation: true } as CalculatorRow,
      ] : [
        { formula: 'x = v*w', label: 'Gross EBITDA contribution (before Forter costs) ($)', customerInput: fmtCur(custProfitability), forterImprovement: fmtCur(displayProfitUplift), forterOutcome: fmtCur(displayFortProfitability), valueDriver: 'profit' as const, isCalculation: true } as CalculatorRow,
      ]),
    ] : [
      // For retailers: show profitability directly (Net sales × Gross margin)
      ...(deduplicationEnabled ? [
        { formula: 'v = t*u', label: 'Gross EBITDA contribution (before Forter costs) ($)', customerInput: fmtCur(custProfitability), forterImprovement: fmtCur(profitUplift), forterOutcome: fmtCur(fortProfitability), isCalculation: true } as CalculatorRow,
        { formula: 'v\' = v - dedup', label: 'Deduplicated EBITDA contribution ($)', customerInput: fmtCur(custProfitability), forterImprovement: fmtCur(profitUpliftDeduplicated), forterOutcome: fmtCur(fortProfitabilityDeduplicated), valueDriver: 'profit' as const, isCalculation: true } as CalculatorRow,
      ] : [
        { formula: 'v = t*u', label: 'Gross EBITDA contribution (before Forter costs) ($)', customerInput: fmtCur(custProfitability), forterImprovement: fmtCur(displayProfitUplift), forterOutcome: fmtCur(displayFortProfitability), valueDriver: 'profit' as const, isCalculation: true } as CalculatorRow,
      ]),
    ]),
  ];

  // Calculator 2: Reduce fraud chargebacks (uses deduplicated value if enabled)
  const custChargebacks = custFinalValue * custCBRate;
  // When fraud chargeback coverage is enabled, Forter takes liability so customer sees $0
  const fortChargebacks = includesFraudCBCoverage ? 0 : displayFortFinalValue * fortCBRate;
  const chargebackSavings = custChargebacks - fortChargebacks;

  const calculator2Rows: CalculatorRow[] = [
    { formula: 'a', label: 'Value of approved transactions ($)', customerInput: fmtCur(custFinalValue), forterImprovement: '', forterOutcome: fmtCur(displayFortFinalValue), isCalculation: true },
    { formula: 'b', label: 'Gross Fraud Chargeback Rate (%)', customerInput: fmtPct2(fraudChargebackRate), forterImprovement: formatPctImprovementRel(fraudChargebackRate, fortCBRate * 100, 2), forterOutcome: includesFraudCBCoverage ? '0.00%*' : fmtPct2(fortCBRate * 100), editableCustomerField: 'fraudCBRate', rawCustomerValue: fraudChargebackRate, editableForterField: 'chargebackReduction', rawForterValue: fortCBRate * 100, valueType: 'percent' },
    { 
      formula: 'c = a*b', 
      label: includesFraudCBCoverage ? 'Fraud chargebacks*' : 'Fraud chargebacks', 
      customerInput: fmtCur2(-custChargebacks), 
      forterImprovement: fmtCur2(chargebackSavings), 
      forterOutcome: includesFraudCBCoverage ? '$0.00*' : fmtCur2(-fortChargebacks), 
      valueDriver: 'cost', 
      isCalculation: true,
      footnote: includesFraudCBCoverage ? '*Forter assumes chargeback liability under Fraud Coverage' : undefined,
    },
  ];

  // Build deduplication breakdown for info popover (a→b→c,d→e→f→g)
  const deduplicationBreakdown: DeduplicationBreakdown = {
    approvedTxImprovement, // a
    fraudTxDropOff: 0, // unused in simplified model
    nonFraudDelta: totalDelta, // b = −a
    retryRate: dedup.retryRate, // c
    successRate: dedup.successRate, // d
    duplicateSuccessfulTx, // e = b×c×d
    aov: effectiveCompletedAOV, // f
    gmvReduction: deduplicationGMVReduction, // g = e×f
  };

  return {
    calculator1: { 
      rows: calculator1Rows, 
      revenueUplift: displayRevenueUplift, 
      profitUplift: displayProfitUplift,
      deduplicatedRevenueUplift: revenueUpliftDeduplicated,
      deduplicatedProfitUplift: profitUpliftDeduplicated,
      deduplicationApplied: deduplicationEnabled,
      deduplicationBreakdown,
      customerCompletedTransactionCount: custFinalApproved,
    },
    calculator2: { rows: calculator2Rows, costReduction: chargebackSavings },
  };
}

// ============================================================
// CHALLENGE 3: Manual review process
// ============================================================

export interface Challenge3Inputs {
  transactionAttempts: number;
  manualReviewPct: number;
  timePerReview: number; // minutes
  hourlyReviewerCost: number;
  // Currency
  currencyCode?: string;
  // Forter KPIs
  forterReviewReduction: number; // e.g., 100 for 100% reduction
  forterTimeReduction: number; // e.g., 100 for 100% reduction
}

export interface Challenge3Results {
  calculator1: { rows: CalculatorRow[]; costReduction: number; };
}

export function calculateChallenge3(inputs: Challenge3Inputs): Challenge3Results {
  const { currencyCode = 'USD' } = inputs;
  const fmt = (n: number) => n.toLocaleString('en-US');
  const fmtCur = createCurrencyFormatter(currencyCode);
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;

  const { transactionAttempts, manualReviewPct, timePerReview, hourlyReviewerCost, forterReviewReduction, forterTimeReduction } = inputs;

  const custReviewPct = manualReviewPct / 100;
  const fortReviewPct = Math.max(0, manualReviewPct - forterReviewReduction) / 100;
  const fortTimePerReview = Math.max(0, timePerReview - (timePerReview * forterTimeReduction / 100));
  
  // Calculate the actual time reduction in minutes for display
  const timeReductionMinutes = timePerReview - fortTimePerReview;

  const custReviewTx = transactionAttempts * custReviewPct;
  const fortReviewTx = transactionAttempts * fortReviewPct;
  const custHours = (custReviewTx * timePerReview) / 60;
  const fortHours = (fortReviewTx * fortTimePerReview) / 60;
  const custCost = custHours * hourlyReviewerCost;
  const fortCost = fortHours * hourlyReviewerCost;
  const costReduction = custCost - fortCost;

  const calculator1Rows: CalculatorRow[] = [
    { formula: 'a', label: 'eCommerce sales attempts / transaction attempts (#)', customerInput: fmt(transactionAttempts), forterImprovement: '', forterOutcome: fmt(transactionAttempts), editableCustomerField: 'amerGrossAttempts', rawCustomerValue: transactionAttempts, valueType: 'number' },
    { formula: 'b', label: '% of Transactions to Manual Review (%)', customerInput: fmtPct(manualReviewPct), forterImprovement: forterReviewReduction > 0 ? `(${fmtPct(forterReviewReduction)})` : '', forterOutcome: fmtPct(Math.max(0, manualReviewPct - forterReviewReduction)), editableCustomerField: 'manualReviewPct', rawCustomerValue: manualReviewPct, editableForterField: 'manualReviewReduction', rawForterValue: Math.max(0, manualReviewPct - forterReviewReduction), valueType: 'percent' },
    { formula: 'c = a*b', label: 'Transactions that go to manual review (#)', customerInput: fmt(Math.round(custReviewTx)), forterImprovement: fmt(Math.round(fortReviewTx - custReviewTx)), forterOutcome: fmt(Math.round(fortReviewTx)), isCalculation: true },
    { formula: 'd', label: 'Time to Review a TX (minutes)', customerInput: fmt(timePerReview), forterImprovement: timeReductionMinutes > 0 ? `-${timeReductionMinutes.toFixed(0)}` : '', forterOutcome: fmt(Math.round(fortTimePerReview)), editableCustomerField: 'timePerReview', rawCustomerValue: timePerReview, editableForterField: 'reviewTimeReduction', rawForterValue: fortTimePerReview, valueType: 'number' },
    { formula: 'e = (c*d)/60', label: 'Hours required for all reviews (#)', customerInput: fmt(Math.round(custHours)), forterImprovement: fmt(Math.round(fortHours - custHours)), forterOutcome: fmt(Math.round(fortHours)), isCalculation: true },
    { formula: 'f', label: 'Hourly Cost per Reviewer ($)', customerInput: fmtCur(hourlyReviewerCost), forterImprovement: '', forterOutcome: fmtCur(hourlyReviewerCost), editableCustomerField: 'hourlyReviewerCost', rawCustomerValue: hourlyReviewerCost, valueType: 'currency' },
    { formula: 'g = e*f', label: 'Cost for manual reviews (#)', customerInput: fmtCur(custCost), forterImprovement: fmtCur(-costReduction), forterOutcome: fmtCur(fortCost), valueDriver: 'cost', isCalculation: true },
  ];

  return { calculator1: { rows: calculator1Rows, costReduction } };
}

// ============================================================
// CHALLENGE 7: Chargeback disputes
// ============================================================

export interface Challenge7Inputs {
  transactionAttempts: number;
  transactionAttemptsValue: number;
  fraudChargebackRate: number;
  fraudDisputeRate: number;
  fraudWinRate: number;
  serviceChargebackRate: number;
  serviceDisputeRate: number;
  serviceWinRate: number;
  // OpEx inputs
  avgTimeToReviewCB: number; // minutes
  annualCBDisputes: number; // Number of annual CB disputes
  costPerHourAnalyst: number; // Cost per hour of analyst
  // Currency
  currencyCode?: string;
  // Forter KPIs
  forterFraudDisputeImprovement: number; // e.g., 45 for +45%
  forterFraudWinChange: number; // e.g., -10 for -10%
  forterServiceDisputeImprovement: number;
  forterServiceWinChange: number;
  forterTargetReviewTime: number; // Target avg time to review CB in minutes (absolute)
  // Direct value inputs for standalone Challenge 7 (when no payment challenges selected)
  estFraudChargebackValue?: number; // Direct $ value input
  estServiceChargebackValue?: number; // Direct $ value input
  hasPaymentChallenges?: boolean; // Whether payment challenges (1, 2, 4, 5) are selected
  // Fraud chargeback coverage - when enabled, Forter assumes chargeback liability
  includesFraudCBCoverage?: boolean;
}

export interface Challenge7Results {
  calculator1: { rows: CalculatorRow[]; costReduction: number; };
  calculator2: { rows: CalculatorRow[]; costReduction: number; };
  /** Forter total recoveries ($) - "Total recoveries ($)" forter outcome in the Increase chargeback recoveries calculator */
  fortTotalRecoveries: number;
}

export function calculateChallenge7(inputs: Challenge7Inputs): Challenge7Results {
  const { currencyCode = 'USD', includesFraudCBCoverage = false } = inputs;
  const fmt = (n: number) => n.toLocaleString('en-US');
  const fmtCur = createCurrencyFormatter(currencyCode);
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;

  const {
    transactionAttemptsValue, fraudChargebackRate, fraudDisputeRate, fraudWinRate,
    serviceChargebackRate, serviceDisputeRate, serviceWinRate,
    avgTimeToReviewCB, annualCBDisputes, costPerHourAnalyst,
    forterFraudDisputeImprovement, forterFraudWinChange, forterServiceDisputeImprovement, forterServiceWinChange,
    forterTargetReviewTime,
    estFraudChargebackValue, estServiceChargebackValue, hasPaymentChallenges = true
  } = inputs;

  // Always use direct $ values from inputs - these are now always provided
  // (auto-calculated or manually entered in ChallengeInputs.tsx)
  // Fall back to calculated value only if not provided
  const baseEstFraudChargebacks = estFraudChargebackValue !== undefined && estFraudChargebackValue > 0
    ? estFraudChargebackValue
    : transactionAttemptsValue * (fraudChargebackRate / 100);
  
  // With fraud coverage, Forter assumes liability so Est. value of fraud chargebacks = $0 for Forter outcome
  const estFraudChargebacks = includesFraudCBCoverage ? 0 : baseEstFraudChargebacks;
  const displayFraudChargebacks = baseEstFraudChargebacks; // Always show customer's original value
  
  // Service chargebacks - always use direct value if provided
  const estServiceChargebacks = estServiceChargebackValue !== undefined && estServiceChargebackValue > 0
    ? estServiceChargebackValue
    : transactionAttemptsValue * (serviceChargebackRate / 100);

  // Customer fraud chargebacks (always based on original values)
  const custFraudDispRate = fraudDisputeRate / 100;
  const custFraudWinRate = fraudWinRate / 100;
  const custFraudDisputed = displayFraudChargebacks * custFraudDispRate;
  const custFraudWon = custFraudDisputed * custFraudWinRate;

  // Forter fraud chargebacks - if coverage enabled, no chargebacks to dispute
  const fortFraudDispRate = Math.min(1, (fraudDisputeRate + forterFraudDisputeImprovement) / 100);
  const fortFraudWinRate = Math.max(0, (fraudWinRate + forterFraudWinChange) / 100);
  const fortFraudDisputed = includesFraudCBCoverage ? 0 : displayFraudChargebacks * fortFraudDispRate;
  const fortFraudWon = includesFraudCBCoverage ? 0 : fortFraudDisputed * fortFraudWinRate;

  // Customer service chargebacks
  const custServDispRate = serviceDisputeRate / 100;
  const custServWinRate = serviceWinRate / 100;
  const custServDisputed = estServiceChargebacks * custServDispRate;
  const custServWon = custServDisputed * custServWinRate;

  // Forter service chargebacks
  const fortServDispRate = Math.min(1, (serviceDisputeRate + forterServiceDisputeImprovement) / 100);
  const fortServWinRate = Math.max(0, (serviceWinRate + forterServiceWinChange) / 100);
  const fortServDisputed = estServiceChargebacks * fortServDispRate;
  const fortServWon = fortServDisputed * fortServWinRate;

  const custTotalRecoveries = custFraudWon + custServWon;
  const fortTotalRecoveries = fortFraudWon + fortServWon;
  
  // With coverage: the "recovery" benefit is purely service chargeback recoveries
  // The fraud chargeback value is already handled by the coverage (C245)
  const serviceRecoveriesImprovement = fortServWon - custServWon;
  const additionalRecoveries = includesFraudCBCoverage 
    ? serviceRecoveriesImprovement
    : fortTotalRecoveries - custTotalRecoveries;

  // ============== Calculator 1: Chargeback Recovery ==============
  // When fraud chargeback coverage is enabled, exclude fraud rows entirely - only show service chargebacks
  const calculator1Rows: CalculatorRow[] = includesFraudCBCoverage ? [
    // Service chargebacks only when fraud coverage is enabled
    { formula: '', label: 'Service chargebacks', customerInput: '', forterImprovement: '', forterOutcome: '' },
    { formula: 'a', label: 'Est. value of service chargebacks ($)', customerInput: fmtCur(estServiceChargebacks), forterImprovement: '', forterOutcome: fmtCur(estServiceChargebacks), editableCustomerField: 'estServiceChargebackValue', rawCustomerValue: estServiceChargebacks, valueType: 'currency' },
    { formula: 'b', label: 'Service chargeback dispute rate - Value (%)', customerInput: fmtPct(serviceDisputeRate), forterImprovement: formatPctImprovementRel(serviceDisputeRate, Math.min(100, serviceDisputeRate + forterServiceDisputeImprovement)), forterOutcome: fmtPct(Math.min(100, serviceDisputeRate + forterServiceDisputeImprovement)), editableCustomerField: 'serviceDisputeRate', rawCustomerValue: serviceDisputeRate, editableForterField: 'serviceDisputeRateImprovement', rawForterValue: Math.min(100, serviceDisputeRate + forterServiceDisputeImprovement), valueType: 'percent' },
    { formula: 'c = a*b', label: 'Service chargebacks disputed ($)', customerInput: fmtCur(custServDisputed), forterImprovement: fmtCur(fortServDisputed - custServDisputed), forterOutcome: fmtCur(fortServDisputed), isCalculation: true },
    { formula: 'd', label: 'Service chargeback win-rate - Value (%)', customerInput: fmtPct(serviceWinRate), forterImprovement: formatPctImprovementRel(serviceWinRate, Math.max(0, serviceWinRate + forterServiceWinChange)), forterOutcome: fmtPct(Math.max(0, serviceWinRate + forterServiceWinChange)), editableCustomerField: 'serviceWinRate', rawCustomerValue: serviceWinRate, editableForterField: 'serviceWinRateChange', rawForterValue: Math.max(0, serviceWinRate + forterServiceWinChange), valueType: 'percent' },
    { formula: 'e = c*d', label: 'Service chargebacks won ($)', customerInput: fmtCur(custServWon), forterImprovement: fmtCur(fortServWon - custServWon), forterOutcome: fmtCur(fortServWon), valueDriver: 'cost', isCalculation: true },
    { formula: 'f = e/a', label: 'Recovery rate', customerInput: fmtPct(estServiceChargebacks > 0 ? (custServWon / estServiceChargebacks) * 100 : 0), forterImprovement: '', forterOutcome: fmtPct(estServiceChargebacks > 0 ? (fortServWon / estServiceChargebacks) * 100 : 0), isCalculation: true },
    { formula: '', label: '', customerInput: '', forterImprovement: '', forterOutcome: '', footnote: '*Fraud chargebacks excluded as Forter Fraud Coverage is enabled (liability handled separately)' },
  ] : [
    // Full fraud + service chargebacks when coverage is NOT enabled
    { formula: '', label: 'Fraud chargebacks', customerInput: '', forterImprovement: '', forterOutcome: '' },
    { 
      formula: 'a', 
      label: 'Est. value of fraud chargebacks ($)', 
      customerInput: fmtCur(displayFraudChargebacks), 
      forterImprovement: '', 
      forterOutcome: fmtCur(displayFraudChargebacks), 
      editableCustomerField: 'estFraudChargebackValue', 
      rawCustomerValue: displayFraudChargebacks, 
      valueType: 'currency',
    },
    { formula: 'b', label: 'Fraud chargeback dispute rate - Value (%)', customerInput: fmtPct(fraudDisputeRate), forterImprovement: formatPctImprovementRel(fraudDisputeRate, Math.min(100, fraudDisputeRate + forterFraudDisputeImprovement)), forterOutcome: fmtPct(Math.min(100, fraudDisputeRate + forterFraudDisputeImprovement)), editableCustomerField: 'fraudDisputeRate', rawCustomerValue: fraudDisputeRate, editableForterField: 'fraudDisputeRateImprovement', rawForterValue: Math.min(100, fraudDisputeRate + forterFraudDisputeImprovement), valueType: 'percent' },
    { formula: 'c = a*b', label: 'Fraud chargebacks disputed ($)', customerInput: fmtCur(custFraudDisputed), forterImprovement: fmtCur(fortFraudDisputed - custFraudDisputed), forterOutcome: fmtCur(fortFraudDisputed), isCalculation: true },
    { formula: 'd', label: 'Fraud chargeback win rate (%)', customerInput: fmtPct(fraudWinRate), forterImprovement: formatPctImprovementRel(fraudWinRate, Math.max(0, fraudWinRate + forterFraudWinChange)), forterOutcome: fmtPct(Math.max(0, fraudWinRate + forterFraudWinChange)), editableCustomerField: 'fraudWinRate', rawCustomerValue: fraudWinRate, editableForterField: 'fraudWinRateChange', rawForterValue: Math.max(0, fraudWinRate + forterFraudWinChange), valueType: 'percent' },
    { formula: 'e = c*d', label: 'Fraud chargebacks won ($)', customerInput: fmtCur(custFraudWon), forterImprovement: fmtCur(fortFraudWon - custFraudWon), forterOutcome: fmtCur(fortFraudWon), isCalculation: true },
    { formula: 'f = e/a', label: 'Recovery rate', customerInput: fmtPct(displayFraudChargebacks > 0 ? (custFraudWon / displayFraudChargebacks) * 100 : 0), forterImprovement: '', forterOutcome: fmtPct(displayFraudChargebacks > 0 ? (fortFraudWon / displayFraudChargebacks) * 100 : 0), isCalculation: true },
    { formula: '', label: 'Service chargebacks', customerInput: '', forterImprovement: '', forterOutcome: '' },
    { formula: 'g', label: 'Est. value of service chargebacks ($)', customerInput: fmtCur(estServiceChargebacks), forterImprovement: '', forterOutcome: fmtCur(estServiceChargebacks), editableCustomerField: 'estServiceChargebackValue', rawCustomerValue: estServiceChargebacks, valueType: 'currency' },
    { formula: 'h', label: 'Service chargeback dispute rate - Value (%)', customerInput: fmtPct(serviceDisputeRate), forterImprovement: formatPctImprovementRel(serviceDisputeRate, Math.min(100, serviceDisputeRate + forterServiceDisputeImprovement)), forterOutcome: fmtPct(Math.min(100, serviceDisputeRate + forterServiceDisputeImprovement)), editableCustomerField: 'serviceDisputeRate', rawCustomerValue: serviceDisputeRate, editableForterField: 'serviceDisputeRateImprovement', rawForterValue: Math.min(100, serviceDisputeRate + forterServiceDisputeImprovement), valueType: 'percent' },
    { formula: 'i = g*h', label: 'Service chargebacks disputed ($)', customerInput: fmtCur(custServDisputed), forterImprovement: fmtCur(fortServDisputed - custServDisputed), forterOutcome: fmtCur(fortServDisputed), isCalculation: true },
    { formula: 'j', label: 'Service chargeback win-rate - Value (%)', customerInput: fmtPct(serviceWinRate), forterImprovement: formatPctImprovementRel(serviceWinRate, Math.max(0, serviceWinRate + forterServiceWinChange)), forterOutcome: fmtPct(Math.max(0, serviceWinRate + forterServiceWinChange)), editableCustomerField: 'serviceWinRate', rawCustomerValue: serviceWinRate, editableForterField: 'serviceWinRateChange', rawForterValue: Math.max(0, serviceWinRate + forterServiceWinChange), valueType: 'percent' },
    { formula: 'k = i*j', label: 'Service chargebacks won ($)', customerInput: fmtCur(custServWon), forterImprovement: fmtCur(fortServWon - custServWon), forterOutcome: fmtCur(fortServWon), isCalculation: true },
    { formula: 'l = k/g', label: 'Recovery rate', customerInput: fmtPct(estServiceChargebacks > 0 ? (custServWon / estServiceChargebacks) * 100 : 0), forterImprovement: '', forterOutcome: fmtPct(estServiceChargebacks > 0 ? (fortServWon / estServiceChargebacks) * 100 : 0), isCalculation: true },
    { formula: '', label: 'Total', customerInput: '', forterImprovement: '', forterOutcome: '' },
    { formula: 'm = e+k', label: 'Total recoveries ($)', customerInput: fmtCur(custTotalRecoveries), forterImprovement: fmtCur(additionalRecoveries), forterOutcome: fmtCur(fortTotalRecoveries), valueDriver: 'cost', isCalculation: true },
    { formula: 'n = m/(a+g)', label: 'Total recovery rate (%)', customerInput: fmtPct((displayFraudChargebacks + estServiceChargebacks) > 0 ? (custTotalRecoveries / (displayFraudChargebacks + estServiceChargebacks)) * 100 : 0), forterImprovement: '', forterOutcome: fmtPct((displayFraudChargebacks + estServiceChargebacks) > 0 ? (fortTotalRecoveries / (displayFraudChargebacks + estServiceChargebacks)) * 100 : 0), isCalculation: true },
  ];

  // ============== Calculator 2: Improve recovery efficiency (OpEx) ==============
  // Following the spreadsheet exactly:
  // a: Avg time to review CB (mins) - Customer input, Forter reduces by forterTimeReduction mins
  // b = 60/a: # of reviews per hour
  // c: Number of annual CB disputes - same for both
  // d = c/b: # of hours required for all chargebacks
  // e: Cost per hour of analyst
  // f = d*e: Total cost

  const custAvgTimeReview = avgTimeToReviewCB || 20; // default 20 mins
  const forterAvgTimeReview = Math.max(1, forterTargetReviewTime || 5); // Forter target time (absolute)
  const timeReduction = custAvgTimeReview - forterAvgTimeReview; // For display purposes

  // b = 60/a: reviews per hour
  const custReviewsPerHour = 60 / custAvgTimeReview;
  const forterReviewsPerHour = 60 / forterAvgTimeReview;
  const reviewsPerHourImprovement = forterReviewsPerHour - custReviewsPerHour;

  // c: Number of annual CB disputes
  const numAnnualDisputes = annualCBDisputes || 0;

  // d = c/b: hours required
  const custHoursRequired = custReviewsPerHour > 0 ? numAnnualDisputes / custReviewsPerHour : 0;
  const forterHoursRequired = forterReviewsPerHour > 0 ? numAnnualDisputes / forterReviewsPerHour : 0;
  const hoursReduction = custHoursRequired - forterHoursRequired;

  // e: Cost per hour
  const hourlyAnalystCost = costPerHourAnalyst || 19.23;

  // f = d*e: Total cost
  const custTotalCost = custHoursRequired * hourlyAnalystCost;
  const forterTotalCost = forterHoursRequired * hourlyAnalystCost;
  const opExSavings = custTotalCost - forterTotalCost;

  const calculator2Rows: CalculatorRow[] = [
    { formula: '', label: 'Improve recovery efficiency (OpEx)', customerInput: '', forterImprovement: '', forterOutcome: '' },
    { formula: 'a', label: 'Avg time to review CB (mins)', customerInput: fmt(custAvgTimeReview), forterImprovement: `-${timeReduction}`, forterOutcome: fmt(forterAvgTimeReview), editableCustomerField: 'avgTimeToReviewCB', rawCustomerValue: custAvgTimeReview, editableForterField: 'disputeTimeReduction', rawForterValue: forterAvgTimeReview, valueType: 'number' },
    { formula: 'b = 60/a', label: '# of reviews per hour', customerInput: `${custReviewsPerHour.toFixed(1)}x`, forterImprovement: `+${reviewsPerHourImprovement.toFixed(1)}x`, forterOutcome: `${forterReviewsPerHour.toFixed(1)}x`, isCalculation: true },
    { formula: 'c', label: 'Number of annual CB disputes', customerInput: fmt(numAnnualDisputes), forterImprovement: '', forterOutcome: fmt(numAnnualDisputes), editableCustomerField: 'annualCBDisputes', rawCustomerValue: numAnnualDisputes, valueType: 'number' },
    { formula: 'd = c/b', label: '# of hours required for all chargebacks', customerInput: fmt(Math.round(custHoursRequired)), forterImprovement: fmt(Math.round(-hoursReduction)), forterOutcome: fmt(Math.round(forterHoursRequired)), isCalculation: true },
    { formula: 'e', label: 'Cost per hour of analyst', customerInput: fmtCur(hourlyAnalystCost), forterImprovement: '', forterOutcome: fmtCur(hourlyAnalystCost), editableCustomerField: 'costPerHourAnalyst', rawCustomerValue: hourlyAnalystCost, valueType: 'currency' },
    { formula: 'f = d*e', label: 'Total cost', customerInput: fmtCur(-custTotalCost), forterImprovement: fmtCur(opExSavings), forterOutcome: fmtCur(-forterTotalCost), valueDriver: 'cost', isCalculation: true },
  ];

  return { 
    calculator1: { rows: calculator1Rows, costReduction: additionalRecoveries },
    calculator2: { rows: calculator2Rows, costReduction: opExSavings },
    fortTotalRecoveries,
  };
}

// ============================================================
// CHALLENGE 8: Policy Abuse Prevention
// ============================================================

export interface Challenge8Inputs {
  // Refund/abuse base data
  expectedRefundsVolume: number;
  avgRefundValue: number; // Changed from expectedRefundsValue to avgRefundValue
  isMarketplace: boolean;
  commissionRate: number;
  grossMarginPercent: number;
  // Operational inputs
  avgOneWayShipping: number;
  avgFulfilmentCost: number;
  txProcessingFeePct: number;
  avgCSTicketCost: number;
  // Refund replacement assumptions
  pctINRClaims: number;
  pctReplacedCredits: number;
  // Currency
  currencyCode?: string;
  // General model assumptions (on main KPI page)
  forterCatchRate: number;
  abuseAovMultiplier: number;
  // Egregious abuse (in modal)
  egregiousReturnsAbusePct: number;
  egregiousInventoryLossPct: number;
  egregiousINRAbusePct: number;
  // Non-egregious abuse (in modal)
  nonEgregiousReturnsAbusePct: number;
  nonEgregiousInventoryLossPct: number;
  // Forter improvements (in modal)
  forterEgregiousReturnsReduction: number; // e.g., 90 for 90% reduction
  forterEgregiousINRReduction: number;
  forterNonEgregiousReturnsReduction: number;
}

export interface Challenge8Results {
  calculator1: { rows: CalculatorRow[]; costReduction: number; }; // Returns abuse
  calculator2: { rows: CalculatorRow[]; costReduction: number; }; // INR abuse
  totalCostReduction: number;
}

export function calculateChallenge8(inputs: Challenge8Inputs): Challenge8Results {
  const { currencyCode = 'USD' } = inputs;
  const fmt = (n: number) => n.toLocaleString('en-US');
  // Format currency with brackets for negative values (no decimals for totals)
  const fmtCur = (n: number) => {
    const absValue = Math.abs(n);
    const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(absValue);
    return n < 0 ? `(${formatted})` : formatted;
  };
  // Format currency with 2 decimal places for unit costs (per spreadsheet)
  const fmtCur2 = (n: number) => {
    const absValue = Math.abs(n);
    const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(absValue);
    return n < 0 ? `(${formatted})` : formatted;
  };
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;

  const {
    expectedRefundsVolume, avgRefundValue, isMarketplace, commissionRate, grossMarginPercent,
    avgOneWayShipping, avgFulfilmentCost, txProcessingFeePct, avgCSTicketCost,
    pctINRClaims, abuseAovMultiplier, forterCatchRate,
    egregiousReturnsAbusePct, egregiousInventoryLossPct, egregiousINRAbusePct,
    nonEgregiousReturnsAbusePct, nonEgregiousInventoryLossPct,
    forterEgregiousReturnsReduction, forterEgregiousINRReduction, forterNonEgregiousReturnsReduction
  } = inputs;

  // Use avgRefundValue directly as the AOV; no phantom default - use 0 when unset
  const aov = avgRefundValue ?? 0;
  // Calculate returns-only and INR-only volumes based on pctINRClaims
  const pctINRDecimal = pctINRClaims / 100;
  const expectedReturnsOnlyVolume = expectedRefundsVolume * (1 - pctINRDecimal);
  const expectedReturnsOnlyValue = expectedReturnsOnlyVolume * aov;
  const expectedINROnlyVolume = expectedRefundsVolume * pctINRDecimal;
  const expectedINROnlyValue = expectedINROnlyVolume * aov;
  const abusiveAov = aov * abuseAovMultiplier;
  const grossMarginDecimal = grossMarginPercent / 100;
  const commissionDecimal = commissionRate / 100;
  // COGS: 0 for marketplaces (no inventory liability), otherwise based on gross margin
  const cogs = isMarketplace ? 0 : abusiveAov * grossMarginDecimal;
  // For marketplaces, indirect lost profit = commission amount × gross margin
  const marketplaceIndirectLoss = abusiveAov * commissionDecimal * grossMarginDecimal;
  const txFee = abusiveAov * (txProcessingFeePct / 100);
  const twoWayShipping = avgOneWayShipping * 2;
  
  // For marketplaces, the Forter outcome (cost reduction) should reflect only the commission-based value
  // since marketplaces only earn commission on sales, not the full GMV
  const forterCommissionMultiplier = isMarketplace ? commissionDecimal : 1;

  // === CALCULATOR 1: Returns Abuse ===
  // Egregious returns abuse - use expectedReturnsOnlyVolume (returns only, excluding INR)
  // Use forterCatchRate for egregious returns (sync with forterEgregiousReturnsReduction)
  // The catch rate IS the reduction percentage for egregious returns
  const egregiousCatchRate = forterCatchRate; // Use catch rate directly
  const custEgregiousPct = egregiousReturnsAbusePct / 100;
  const fortEgregiousPct = custEgregiousPct * (1 - egregiousCatchRate / 100);
  const custEgregiousCount = expectedReturnsOnlyVolume * custEgregiousPct;
  const fortEgregiousCount = expectedReturnsOnlyVolume * fortEgregiousPct;
  // GMV of egregious returns abusers = abusive AOV * count
  const custEgregiousGMV = abusiveAov * custEgregiousCount;
  const fortEgregiousGMV = abusiveAov * fortEgregiousCount;

  // Unit cost of egregious abuse per spreadsheet:
  // Formula: o = e+sum(i:n) where e = abusive AOV, i:n = COGS + shipping + fulfilment + TX fee + indirect loss
  // Per spreadsheet row o: unit loss is THE SAME for both customer and Forter outcome ($237)
  // For marketplaces: use commission-based indirect loss; for retailers: use inventory loss percentage
  const egregiousIndirectLoss = isMarketplace 
    ? marketplaceIndirectLoss 
    : cogs * (egregiousInventoryLossPct / 100);
  // Unit loss = sum of all costs (same for both customer and Forter per spreadsheet)
  const egregiousUnitLoss =
    cogs + twoWayShipping + avgFulfilmentCost + txFee + egregiousIndirectLoss;
  const custEgregiousTotalLoss = custEgregiousCount * egregiousUnitLoss;
  const fortEgregiousTotalLoss = fortEgregiousCount * egregiousUnitLoss;

  // Non-egregious returns abuse - use expectedReturnsOnlyVolume (returns only, excluding INR)
  // Use forterCatchRate for non-egregious returns (same as egregious - always match)
  const nonEgregiousCatchRate = forterCatchRate; // Use catch rate directly (same as egregious)
  const custNonEgregiousPct = nonEgregiousReturnsAbusePct / 100;
  const fortNonEgregiousPct = custNonEgregiousPct * (1 - nonEgregiousCatchRate / 100);
  const custNonEgregiousCount = expectedReturnsOnlyVolume * custNonEgregiousPct;
  const fortNonEgregiousCount = expectedReturnsOnlyVolume * fortNonEgregiousPct;

  // Non-egregious COGS is 50% of full COGS (per spreadsheet logic)
  const custNonEgregiousCogs = isMarketplace ? 0 : cogs * 0.5;
  // For marketplaces: use commission-based indirect loss; for retailers: use inventory loss percentage
  // Row y should use custNonEgregiousCogs (not full cogs) for non-egregious indirect loss
  const nonEgregiousIndirectLoss = isMarketplace 
    ? marketplaceIndirectLoss 
    : custNonEgregiousCogs * (nonEgregiousInventoryLossPct / 100);
  // Inventory recouped = 20% of non-egregious COGS (per spreadsheet: $4.50 = 20% of $22.50)
  const inventoryRecouped = custNonEgregiousCogs * 0.2; // This offsets some of the loss
  // Unit loss formula: z = e+sum(s:y) - SAME for both customer and Forter
  const nonEgregiousUnitLoss =
    custNonEgregiousCogs + twoWayShipping + avgFulfilmentCost + txFee + nonEgregiousIndirectLoss - inventoryRecouped;
  const custNonEgregiousTotalLoss = custNonEgregiousCount * nonEgregiousUnitLoss;
  const fortNonEgregiousTotalLoss = fortNonEgregiousCount * nonEgregiousUnitLoss;

  const custReturnsTotalLoss = custEgregiousTotalLoss + custNonEgregiousTotalLoss;
  const fortReturnsTotalLoss = fortEgregiousTotalLoss + fortNonEgregiousTotalLoss;
  // Cost reduction = Customer total loss - Forter total loss
  const returnsCostReduction = custReturnsTotalLoss - fortReturnsTotalLoss;

  // Row structure per spreadsheet - Updated to match new format with GMV rows and inventory recouped
  const calculator1Rows: CalculatorRow[] = [
    { formula: 'a', label: 'Expected returns only - Volume (#)', customerInput: fmt(Math.round(expectedReturnsOnlyVolume)), forterImprovement: '', forterOutcome: fmt(Math.round(expectedReturnsOnlyVolume)), editableCustomerField: 'expectedRefundsVolume', rawCustomerValue: expectedRefundsVolume, valueType: 'number' },
    { formula: 'b', label: 'Expected returns only - Value ($)', customerInput: fmtCur(expectedReturnsOnlyValue), forterImprovement: '', forterOutcome: fmtCur(expectedReturnsOnlyValue), isCalculation: true },
    { formula: 'c = b/a', label: 'Average Refunds Value ($)', customerInput: fmtCur(aov), forterImprovement: '', forterOutcome: fmtCur(aov), editableCustomerField: 'avgRefundValue', rawCustomerValue: avgRefundValue, valueType: 'currency' },
    { formula: 'd', label: 'Abuse AoV multiplier (x)', customerInput: `${abuseAovMultiplier}x`, forterImprovement: '', forterOutcome: `${abuseAovMultiplier}x`, editableCustomerField: 'abuseAovMultiplier', rawCustomerValue: abuseAovMultiplier, editableForterField: 'abuseAovMultiplier', rawForterValue: abuseAovMultiplier, valueType: 'number' },
    { formula: 'e = c*d', label: 'Estimated Abusive AoV ($)', customerInput: fmtCur(abusiveAov), forterImprovement: '', forterOutcome: fmtCur(abusiveAov), isCalculation: true },
    { formula: 'f', label: 'Egregious returns abuse population (%)', customerInput: fmtPct(egregiousReturnsAbusePct), forterImprovement: `(${egregiousCatchRate.toFixed(1)}%)`, forterOutcome: fmtPct(fortEgregiousPct * 100), editableCustomerField: 'egregiousReturnsAbusePct', rawCustomerValue: egregiousReturnsAbusePct, editableForterField: 'forterCatchRate', rawForterValue: egregiousCatchRate, valueType: 'percent', footnote: 'abuse-catch-rate-outcome', readOnlyForterOutcome: true },
    { formula: 'g = a*f', label: 'Estimated # of egregious returns abusers (#)', customerInput: fmt(Math.round(custEgregiousCount)), forterImprovement: fmt(Math.round(fortEgregiousCount - custEgregiousCount)), forterOutcome: fmt(Math.round(fortEgregiousCount)), isCalculation: true },
    { formula: 'h = e*g', label: 'GMV of egregious returns abusers ($)', customerInput: fmtCur(custEgregiousGMV), forterImprovement: fmtCur(fortEgregiousGMV - custEgregiousGMV), forterOutcome: fmtCur(fortEgregiousGMV), isCalculation: true },
    { formula: '', label: 'Unit cost of egregious abuse', customerInput: '', forterImprovement: '', forterOutcome: '' },
    { formula: 'i', label: 'Cost of goods sold ($)', customerInput: fmtCur2(-cogs), forterImprovement: '', forterOutcome: fmtCur2(-cogs) },
    { formula: 'j', label: 'Refunds ($)', customerInput: fmtCur2(-abusiveAov), forterImprovement: '', forterOutcome: fmtCur2(-abusiveAov) },
    { formula: 'k', label: 'Cost of 2-way shipping (merchant liability) ($)', customerInput: fmtCur2(-twoWayShipping), forterImprovement: '', forterOutcome: fmtCur2(-twoWayShipping), editableCustomerField: 'avgOneWayShipping', rawCustomerValue: avgOneWayShipping, valueType: 'currency' },
    { formula: 'l', label: 'Average unit fulfilment cost (warehouse) ($)', customerInput: fmtCur2(-avgFulfilmentCost), forterImprovement: '', forterOutcome: fmtCur2(-avgFulfilmentCost), editableCustomerField: 'avgFulfilmentCost', rawCustomerValue: avgFulfilmentCost, valueType: 'currency' },
    { formula: 'm', label: 'TX processing fees as a % of order value', customerInput: fmtCur2(-txFee), forterImprovement: '', forterOutcome: fmtCur2(-txFee) },
    { formula: 'n', label: isMarketplace ? 'Indirect: Lost commission profit ($)' : 'Indirect: Lost profit due to inventory loss ($)', customerInput: fmtCur2(-egregiousIndirectLoss), forterImprovement: '', forterOutcome: fmtCur2(-egregiousIndirectLoss) },
    { formula: 'o = e+sum(i:n)', label: 'Unit loss of egregious returns abusers ($)', customerInput: fmtCur2(-egregiousUnitLoss), forterImprovement: '-', forterOutcome: fmtCur2(-egregiousUnitLoss), isCalculation: true },
    { formula: 'p = g*o', label: 'Total loss due to egregious returns abusers ($)', customerInput: fmtCur(-custEgregiousTotalLoss), forterImprovement: fmtCur(custEgregiousTotalLoss - fortEgregiousTotalLoss), forterOutcome: fmtCur(-fortEgregiousTotalLoss), isCalculation: true },
    { formula: '', label: 'Unit cost of non-egregious abuse', customerInput: '', forterImprovement: '', forterOutcome: '' },
    { formula: 'q', label: 'Non-egregious returns abuse population (%)', customerInput: fmtPct(nonEgregiousReturnsAbusePct), forterImprovement: `(${nonEgregiousCatchRate.toFixed(1)}%)`, forterOutcome: fmtPct(fortNonEgregiousPct * 100), editableCustomerField: 'nonEgregiousReturnsAbusePct', rawCustomerValue: nonEgregiousReturnsAbusePct, editableForterField: 'forterCatchRate', rawForterValue: nonEgregiousCatchRate, valueType: 'percent', footnote: 'abuse-catch-rate-outcome', readOnlyForterOutcome: true },
    { formula: 'r = a*q', label: 'Estimated # of non-egregious returns abusers (#)', customerInput: fmt(Math.round(custNonEgregiousCount)), forterImprovement: fmt(Math.round(fortNonEgregiousCount - custNonEgregiousCount)), forterOutcome: fmt(Math.round(fortNonEgregiousCount)), isCalculation: true },
    { formula: 's', label: 'Cost of goods sold ($)', customerInput: fmtCur2(-custNonEgregiousCogs), forterImprovement: '', forterOutcome: fmtCur2(-custNonEgregiousCogs) },
    { formula: 't', label: 'Refunds ($)', customerInput: fmtCur2(-abusiveAov), forterImprovement: '', forterOutcome: fmtCur2(-abusiveAov) },
    { formula: 'u', label: 'Inventory recouped ($)', customerInput: fmtCur2(inventoryRecouped), forterImprovement: '', forterOutcome: fmtCur2(inventoryRecouped) },
    { formula: 'v', label: 'Cost of 2-way shipping (merchant liability) ($)', customerInput: fmtCur2(-twoWayShipping), forterImprovement: '', forterOutcome: fmtCur2(-twoWayShipping) },
    { formula: 'w', label: 'Average unit fulfilment cost (warehouse) ($)', customerInput: fmtCur2(-avgFulfilmentCost), forterImprovement: '', forterOutcome: fmtCur2(-avgFulfilmentCost) },
    { formula: 'x', label: 'TX processing fees as a % of order value', customerInput: fmtCur2(-txFee), forterImprovement: '', forterOutcome: fmtCur2(-txFee) },
    { formula: 'y', label: isMarketplace ? 'Indirect: Lost commission profit ($)' : 'Indirect: Lost profit due to inventory loss ($)', customerInput: fmtCur2(-nonEgregiousIndirectLoss), forterImprovement: '', forterOutcome: fmtCur2(-nonEgregiousIndirectLoss) },
    { formula: 'z = e+sum(s:y)', label: 'Unit loss of non-egregious returns abusers ($)', customerInput: fmtCur2(-nonEgregiousUnitLoss), forterImprovement: '-', forterOutcome: fmtCur2(-nonEgregiousUnitLoss), isCalculation: true },
    { formula: 'aa = r*z', label: 'Total loss due to non-egregious returns abusers ($)', customerInput: fmtCur(-custNonEgregiousTotalLoss), forterImprovement: fmtCur(custNonEgregiousTotalLoss - fortNonEgregiousTotalLoss), forterOutcome: fmtCur(-fortNonEgregiousTotalLoss), isCalculation: true },
    { formula: 'ab = p+aa', label: 'Total loss due to returns abusers ($)', customerInput: fmtCur(-custReturnsTotalLoss), forterImprovement: fmtCur(returnsCostReduction), forterOutcome: fmtCur(-fortReturnsTotalLoss), valueDriver: 'cost', isCalculation: true },
    // Show commission rate row for marketplaces
    ...(isMarketplace ? [{ formula: '', label: `Commission / Take rate (${commissionRate}%) applied`, customerInput: '', forterImprovement: '', forterOutcome: '' }] : []),
  ];

  // === CALCULATOR 2: INR Abuse ===
  // Use expectedINROnlyVolume directly as INR claims (already filtered by pctINRClaims)
  const inrClaimsCount = expectedINROnlyVolume;
  const custINRAbusePct = egregiousINRAbusePct / 100;
  const fortINRAbusePct = custINRAbusePct * (1 - forterEgregiousINRReduction / 100);
  const custINRAbusers = inrClaimsCount * custINRAbusePct;
  const fortINRAbusers = inrClaimsCount * fortINRAbusePct;
  // GMV of INR abusers = abusive AOV * count
  const custINRAbusersGMV = abusiveAov * custINRAbusers;
  const fortINRAbusersGMV = abusiveAov * fortINRAbusers;

  // INR unit loss (row o): o = e + sum(i:n)
  // In the UI, i:n are shown as negative unit costs (loss components), while e is positive.
  // So: o = e + (-(COGS + Refunds + shipping + fulfilment + fees + indirect))
  // Since Refunds == e, Refunds cancels with e, leaving only the incremental cost components.
  // For marketplaces: indirect loss is commission × gross margin; for retailers: use COGS (full inventory loss)
  const inrIndirectLoss = isMarketplace ? marketplaceIndirectLoss : cogs;
  // Unit loss magnitude (shown as negative in the table):
  // exclude Refunds/abusiveAov here because it is cancelled by the +e add-back.
  const inrUnitLoss = cogs + avgOneWayShipping + avgFulfilmentCost + txFee + inrIndirectLoss;
  const custINRTotalLoss = custINRAbusers * inrUnitLoss;
  const fortINRTotalLoss = fortINRAbusers * inrUnitLoss;
  // Cost reduction = Customer total loss - Forter total loss
  const inrCostReduction = custINRTotalLoss - fortINRTotalLoss;

  // Row structure per spreadsheet - Updated with "Expected INR only" labels
  const calculator2Rows: CalculatorRow[] = [
    { formula: 'a', label: 'Expected INR only - Volume (#)', customerInput: fmt(Math.round(expectedINROnlyVolume)), forterImprovement: '', forterOutcome: fmt(Math.round(expectedINROnlyVolume)) },
    { formula: 'b', label: 'Expected INR only - Value ($)', customerInput: fmtCur(expectedINROnlyValue), forterImprovement: '', forterOutcome: fmtCur(expectedINROnlyValue) },
    { formula: 'c = b/a', label: 'Average order value', customerInput: fmtCur(aov), forterImprovement: '', forterOutcome: fmtCur(aov), isCalculation: true },
    { formula: 'd', label: 'Abuse AoV multiplier (x)', customerInput: `${abuseAovMultiplier}x`, forterImprovement: '', forterOutcome: `${abuseAovMultiplier}x`, editableCustomerField: 'abuseAovMultiplier', rawCustomerValue: abuseAovMultiplier, valueType: 'number', readOnlyForterOutcome: true },
    { formula: 'e = c*d', label: 'Estimated Abusive AoV ($)', customerInput: fmtCur(abusiveAov), forterImprovement: '', forterOutcome: fmtCur(abusiveAov), isCalculation: true },
    { formula: 'f', label: 'INR abuse population (%)', customerInput: fmtPct(egregiousINRAbusePct), forterImprovement: formatPctImprovementRel(egregiousINRAbusePct, fortINRAbusePct * 100), forterOutcome: fmtPct(fortINRAbusePct * 100), editableCustomerField: 'egregiousINRAbusePct', rawCustomerValue: egregiousINRAbusePct, editableForterField: 'forterEgregiousINRReduction', rawForterValue: fortINRAbusePct * 100, valueType: 'percent', footnote: 'abuse-benchmark-outcome' },
    { formula: 'g = a*f', label: 'Estimated # of INR abusers (#)', customerInput: fmt(Math.round(custINRAbusers)), forterImprovement: fmt(Math.round(fortINRAbusers - custINRAbusers)), forterOutcome: fmt(Math.round(fortINRAbusers)), isCalculation: true },
    { formula: 'h = e*g', label: 'GMV of INR abusers ($)', customerInput: fmtCur(custINRAbusersGMV), forterImprovement: fmtCur(fortINRAbusersGMV - custINRAbusersGMV), forterOutcome: fmtCur(fortINRAbusersGMV), isCalculation: true },
    { formula: '', label: 'Unit cost of INR abuse', customerInput: '', forterImprovement: '', forterOutcome: '' },
    { formula: 'i', label: 'Cost of goods sold ($)', customerInput: fmtCur2(-cogs), forterImprovement: '', forterOutcome: fmtCur2(-cogs) },
    { formula: 'j', label: 'Refunds ($)', customerInput: fmtCur2(-abusiveAov), forterImprovement: '', forterOutcome: fmtCur2(-abusiveAov) },
    { formula: 'k', label: 'Cost of 1-way shipping (merchant liability) ($)', customerInput: fmtCur2(-avgOneWayShipping), forterImprovement: '', forterOutcome: fmtCur2(-avgOneWayShipping) },
    { formula: 'l', label: 'Average unit fulfilment cost (warehouse) ($)', customerInput: fmtCur2(-avgFulfilmentCost), forterImprovement: '', forterOutcome: fmtCur2(-avgFulfilmentCost) },
    { formula: 'm', label: 'TX processing fees as a % of order value', customerInput: fmtCur2(-txFee), forterImprovement: '', forterOutcome: fmtCur2(-txFee) },
    { formula: 'n', label: isMarketplace ? 'Indirect: Lost commission profit ($)' : 'Indirect: Lost profit due to inventory loss ($)', customerInput: fmtCur2(-inrIndirectLoss), forterImprovement: '', forterOutcome: fmtCur2(-inrIndirectLoss) },
    { formula: 'o = e+sum(i:n)', label: 'Unit loss of INR abusers ($)', customerInput: fmtCur2(-inrUnitLoss), forterImprovement: '-', forterOutcome: fmtCur2(-inrUnitLoss), isCalculation: true },
    { formula: 'p = g*o', label: 'Total loss due to INR abusers ($)', customerInput: fmtCur(-custINRTotalLoss), forterImprovement: fmtCur(inrCostReduction), forterOutcome: fmtCur(-fortINRTotalLoss), valueDriver: 'cost', isCalculation: true },
    // Show commission rate row for marketplaces
    ...(isMarketplace ? [{ formula: '', label: `Commission / Take rate (${commissionRate}%) applied`, customerInput: '', forterImprovement: '', forterOutcome: '' }] : []),
  ];

  return {
    calculator1: { rows: calculator1Rows, costReduction: returnsCostReduction },
    calculator2: { rows: calculator2Rows, costReduction: inrCostReduction },
    totalCostReduction: returnsCostReduction + inrCostReduction,
  };
}


// ============================================================
// CHALLENGE 10: Promotions Abuse Prevention
// ============================================================

export interface Challenge10Inputs {
  // Transaction data
  transactionAttemptsValue: number; // eCommerce sales attempts ($)
  // Customer inputs
  avgDiscountByAbusers: number; // Average discount achieved by abusers (%)
  /** Estimated current promotion abuse catch rate (%); used as "today" baseline in calculator */
  promotionAbuseCatchRateToday?: number;
  isMarketplace: boolean;
  commissionRate: number;
  grossMarginPercent: number;
  // Currency
  currencyCode?: string;
  // Forter KPIs
  forterCatchRate: number; // Promotion abuse catch rate (%)
  abuseAovMultiplier: number; // Abuse AoV multiplier (x)
  // From AbuseBenchmarks
  promotionAbuseAsGMVPct: number; // Promotion abuse as % of GMV (%)
}

export interface Challenge10Results {
  calculator1: {
    rows: CalculatorRow[];
    revenueUplift: number;
    profitUplift: number;
  };
}

export function calculateChallenge10(inputs: Challenge10Inputs): Challenge10Results {
  const { currencyCode = 'USD' } = inputs;
  const fmt = (n: number) => n.toLocaleString('en-US');
  const fmtCur = createCurrencyFormatter(currencyCode);
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;

  const {
    transactionAttemptsValue,
    avgDiscountByAbusers,
    promotionAbuseCatchRateToday,
    isMarketplace,
    commissionRate,
    grossMarginPercent,
    forterCatchRate,
    abuseAovMultiplier,
    promotionAbuseAsGMVPct,
  } = inputs;

  // Derived values
  const promotionAbusePctDecimal = promotionAbuseAsGMVPct / 100;
  const catchRateDecimal = forterCatchRate / 100;
  const discountPctDecimal = avgDiscountByAbusers / 100;
  const grossMarginDecimal = grossMarginPercent / 100;
  const commissionDecimal = commissionRate / 100;
  
  // Commission is always row j (defaults to 100% for retailers)
  // Gross margin is always row k
  const effectiveCommissionRate = isMarketplace ? commissionRate : 100;
  const effectiveCommissionDecimal = effectiveCommissionRate / 100;

  // Calculator flow per spreadsheet:
  // a: eCommerce sales attempts ($)
  const a = transactionAttemptsValue;
  
  // b: Promotion abuse as % of GMV (%)
  const b = promotionAbuseAsGMVPct;
  
  // c = -(a*b): Estimated promotion abuse attempts ($) - NEGATIVE per spreadsheet
  const c = -(a * promotionAbusePctDecimal);
  
  // d: Estimated Promotion Abuse Catch Rate Today (%) - customer current, Forter target
  const custCatchRate = promotionAbuseCatchRateToday ?? 0;
  const fortCatchRate = forterCatchRate;
  
  // e: Abuse AoV multiplier (x)
  const e = abuseAovMultiplier;
  
  // f = c*(1-d)*e: Promotion abuse GMV ($) - stays negative
  // Customer: no catch rate applied, so (1-0) = 1
  // Forter: catch rate applied, so (1-catchRate)
  const custPromotionAbuseGMV = c * (1 - custCatchRate / 100) * e;
  const fortPromotionAbuseGMV = c * (1 - fortCatchRate / 100) * e;
  
  // g: Average discount achieved by abusers (%)
  const g = avgDiscountByAbusers;
  
  // h = f/(1-g): Promotion abuse GMV (without discount) ($) - stays negative
  const custPromotionAbuseGMVWithoutDiscount = custPromotionAbuseGMV / (1 - discountPctDecimal);
  const fortPromotionAbuseGMVWithoutDiscount = fortPromotionAbuseGMV / (1 - discountPctDecimal);
  
  // i = h - f: Lost GMV due to promotion abuse ($) → stays negative
  const custLostGMV = custPromotionAbuseGMVWithoutDiscount - custPromotionAbuseGMV;
  const fortLostGMV = fortPromotionAbuseGMVWithoutDiscount - fortPromotionAbuseGMV;
  // Revenue uplift = reduction in loss (positive value for savings)
  const revenueUplift = Math.abs(custLostGMV) - Math.abs(fortLostGMV);
  
  // j: Commission / take rate (%) - 100% for retailers, actual rate for marketplaces
  // k: Gross margin (%)
  // l = i*j*k: Lost profitability due to promotion abuse ($) → stays negative
  const custLostProfitability = custLostGMV * effectiveCommissionDecimal * grossMarginDecimal;
  const fortLostProfitability = fortLostGMV * effectiveCommissionDecimal * grossMarginDecimal;
  // Profit uplift = reduction in loss (positive value for savings)
  const profitUplift = Math.abs(custLostProfitability) - Math.abs(fortLostProfitability);

  // Format improvement as the difference (positive reduction in negative values)
  const gmvImprovement = fortLostGMV - custLostGMV; // Will be positive (less loss)
  const profitImprovement = fortLostProfitability - custLostProfitability; // Will be positive (less loss)

  const calculator1Rows: CalculatorRow[] = [
    { formula: 'a', label: 'eCommerce sales attempts / transaction attempts ($)', customerInput: fmtCur(a), forterImprovement: '', forterOutcome: fmtCur(a), editableCustomerField: 'amerAnnualGMV', rawCustomerValue: a, valueType: 'currency' },
    { formula: 'b', label: 'Promotion abuse as % of GMV (%)', customerInput: fmtPct(b), forterImprovement: '', forterOutcome: fmtPct(b) },
    { formula: 'c = -(a*b)', label: 'Estimated promotion abuse attempts', customerInput: fmtCur(c), forterImprovement: '-', forterOutcome: fmtCur(c), isCalculation: true },
    { formula: 'd', label: 'Estimated Promotion Abuse Catch Rate Today (%)', customerInput: fmtPct(custCatchRate), forterImprovement: formatPctImprovementRel(custCatchRate, fortCatchRate), forterOutcome: fmtPct(fortCatchRate), editableCustomerField: 'promotionAbuseCatchRateToday', rawCustomerValue: custCatchRate, editableForterField: 'forterCatchRate', rawForterValue: fortCatchRate, valueType: 'percent' },
    { formula: 'e', label: 'Abuse AoV multiplier (x)', customerInput: `${e}x`, forterImprovement: '', forterOutcome: `${e}x`, editableCustomerField: 'abuseAovMultiplier', rawCustomerValue: e, valueType: 'number', readOnlyForterOutcome: true },
    { formula: 'f = c*(1-d)*e', label: 'Promotion abuse GMV ($)', customerInput: fmtCur(custPromotionAbuseGMV), forterImprovement: fmtCur(fortPromotionAbuseGMV - custPromotionAbuseGMV), forterOutcome: fmtCur(fortPromotionAbuseGMV), isCalculation: true },
    { formula: 'g', label: 'Average discount achieved by abusers (%)', customerInput: fmtPct(g), forterImprovement: '0% pts', forterOutcome: fmtPct(g), editableCustomerField: 'avgDiscountByAbusers', rawCustomerValue: g, valueType: 'percent' },
    { formula: 'h = f/(1-g)', label: 'Promotion abuse GMV (without discount) ($)', customerInput: fmtCur(custPromotionAbuseGMVWithoutDiscount), forterImprovement: fmtCur(fortPromotionAbuseGMVWithoutDiscount - custPromotionAbuseGMVWithoutDiscount), forterOutcome: fmtCur(fortPromotionAbuseGMVWithoutDiscount), isCalculation: true },
    { formula: 'i = h-f', label: 'Lost GMV due to promotion abuse ($)', customerInput: fmtCur(custLostGMV), forterImprovement: fmtCur(gmvImprovement), forterOutcome: fmtCur(fortLostGMV), valueDriver: 'revenue', isCalculation: true },
    ...(isMarketplace ? [{ formula: 'j', label: 'Commission / take rate (%)', customerInput: fmtPct(effectiveCommissionRate), forterImprovement: '', forterOutcome: fmtPct(effectiveCommissionRate), editableCustomerField: 'commissionRate' as const, rawCustomerValue: effectiveCommissionRate, valueType: 'percent' as const }] : []),
    { formula: isMarketplace ? 'k' : 'j', label: 'Gross margin (%)', customerInput: fmtPct(grossMarginPercent), forterImprovement: '', forterOutcome: fmtPct(grossMarginPercent), editableCustomerField: 'amerGrossMarginPercent', rawCustomerValue: grossMarginPercent, valueType: 'percent' },
    { formula: isMarketplace ? 'l = i*j*k' : 'k = i*j', label: 'Lost profitability due to promotion abuse ($)', customerInput: fmtCur(custLostProfitability), forterImprovement: fmtCur(profitImprovement), forterOutcome: fmtCur(fortLostProfitability), valueDriver: 'profit', isCalculation: true },
  ];

  return {
    calculator1: {
      rows: calculator1Rows,
      revenueUplift,
      profitUplift,
    },
  };
}


// ============================================================
// CHALLENGE 9: Instant Refunds
// ============================================================

export interface Challenge9Inputs {
  // Customer inputs
  currentEcommerceSales: number; // Pull from GMV calculators if applicable
  commissionRate: number;
  grossMarginPercent: number;
  refundRate: number; // % of completed transactions
  expectedRefundsVolume: number;
  pctRefundsToCS: number; // % of refund tickets/calls going to customer service
  costPerCSContact: number;
  // Currency
  currencyCode?: string;
  isMarketplace?: boolean;
  // Forter KPIs
  npsIncreaseFromInstantRefunds: number;
  lseNPSBenchmark: number; // % revenue increase per 7 NPS points
  forterCSReduction: number; // % reduction in CS contacts
}

export interface Challenge9Results {
  calculator1: { rows: CalculatorRow[]; gmvUplift: number; profitUplift: number; };
  calculator2: { rows: CalculatorRow[]; costReduction: number; };
}

export function calculateChallenge9(inputs: Challenge9Inputs): Challenge9Results {
  const { currencyCode = 'USD' } = inputs;
  const fmt = (n: number) => n.toLocaleString('en-US');
  const fmtCur = createCurrencyFormatter(currencyCode);
  const fmtPct = (n: number) => `${n.toFixed(2)}%`;

  const {
    currentEcommerceSales, commissionRate, grossMarginPercent,
    expectedRefundsVolume, pctRefundsToCS, costPerCSContact,
    npsIncreaseFromInstantRefunds, lseNPSBenchmark, forterCSReduction,
    isMarketplace = false
  } = inputs;

  const commissionDecimal = commissionRate / 100;
  const grossMarginDecimal = grossMarginPercent / 100;
  const effectiveMarginDecimal = isMarketplace ? commissionDecimal : grossMarginDecimal;
  const effectiveMarginPercent = isMarketplace ? commissionRate : grossMarginPercent;
  const marginLabel = isMarketplace ? 'Commission / take rate (%)' : 'Gross margin (%)';

  // Calculator 1: Instant refunds CX uplift
  // Per spreadsheet: 7 NPS points = 1% revenue increase (LSE benchmark)
  const custNpsIncrease = 0;
  const forterNpsIncrease = npsIncreaseFromInstantRefunds;
  const lseBenchmarkDecimal = lseNPSBenchmark / 100;
  
  // Expected sales uplift = NPS increase / 7 * LSE benchmark
  const custSalesUpliftPct = 0;
  const forterSalesUpliftPct = (forterNpsIncrease / 7) * lseBenchmarkDecimal * 100;
  
  const custExpectedSales = currentEcommerceSales;
  const forterExpectedSales = currentEcommerceSales * (1 + forterSalesUpliftPct / 100);
  const gmvUplift = forterExpectedSales - custExpectedSales;
  
  // Profitability calculation
  // For marketplaces: profit = sales × commission × gross margin
  // For retailers: profit = sales × gross margin (only gross margin, commission is 100% = 1.0)
  const profitabilityMultiplier = isMarketplace 
    ? effectiveMarginDecimal * grossMarginDecimal 
    : grossMarginDecimal; // For retailers, only gross margin (commission is effectively 100%)
  
  const custRevenue = isMarketplace ? custExpectedSales * effectiveMarginDecimal : custExpectedSales;
  const forterRevenue = isMarketplace ? forterExpectedSales * effectiveMarginDecimal : forterExpectedSales;
  
  const custProfitability = custExpectedSales * profitabilityMultiplier;
  const forterProfitability = forterExpectedSales * profitabilityMultiplier;
  const profitUplift = forterProfitability - custProfitability;

  // Build calculator rows - conditionally show commission/gross margin based on business model
  const calculator1Rows: CalculatorRow[] = [
    { formula: 'a', label: 'Current eCommerce sales ($)', customerInput: fmtCur(custExpectedSales), forterImprovement: '', forterOutcome: fmtCur(custExpectedSales), editableCustomerField: 'amerAnnualGMV', rawCustomerValue: currentEcommerceSales, valueType: 'currency' },
    { formula: 'b', label: 'NPS increase from instant refunds', customerInput: '0', forterImprovement: `+${forterNpsIncrease}`, forterOutcome: `${forterNpsIncrease}`, editableForterField: 'npsIncreaseFromInstantRefunds', rawForterValue: forterNpsIncrease, valueType: 'number' },
    { formula: 'c', label: 'LSE (NPS improvement benchmark - 1% per 7 NPS)', customerInput: '0.00%', forterImprovement: `${lseNPSBenchmark.toFixed(2)}% pts`, forterOutcome: `${lseNPSBenchmark.toFixed(2)}%` },
    { formula: 'd = b/7*c', label: 'Expected sales uplift with instant refund (%)', customerInput: fmtPct(custSalesUpliftPct), forterImprovement: '', forterOutcome: fmtPct(forterSalesUpliftPct), isCalculation: true },
    { formula: 'e = a*(1+d)', label: 'Expected eCommerce sales', customerInput: fmtCur(custExpectedSales), forterImprovement: fmtCur(gmvUplift), forterOutcome: fmtCur(forterExpectedSales), valueDriver: 'revenue', isCalculation: true },
  ];

  // For marketplaces: show commission (row f), revenue (row g), gross margin (row h), profitability (row i = g*h)
  // For retailers: show only gross margin (row f), profitability (row i = e*f)
  if (isMarketplace) {
    calculator1Rows.push(
      { formula: 'f', label: marginLabel, customerInput: fmtPct(effectiveMarginPercent), forterImprovement: '', forterOutcome: fmtPct(effectiveMarginPercent), editableCustomerField: 'commissionRate', rawCustomerValue: effectiveMarginPercent, valueType: 'percent' },
      { formula: 'g = e*f', label: 'Revenue ($)', customerInput: fmtCur(custRevenue), forterImprovement: fmtCur(forterRevenue - custRevenue), forterOutcome: fmtCur(forterRevenue), isCalculation: true },
      { formula: 'h', label: 'Gross margin (%)', customerInput: fmtPct(grossMarginPercent), forterImprovement: '', forterOutcome: fmtPct(grossMarginPercent), editableCustomerField: 'amerGrossMarginPercent', rawCustomerValue: grossMarginPercent, valueType: 'percent' },
      { formula: 'i = g*h', label: 'Profitability impact ($)', customerInput: fmtCur(custProfitability), forterImprovement: fmtCur(profitUplift), forterOutcome: fmtCur(forterProfitability), valueDriver: 'profit', isCalculation: true }
    );
  } else {
    // For retailers: only show gross margin once, formula i = e*f
    calculator1Rows.push(
      { formula: 'f', label: 'Gross margin (%)', customerInput: fmtPct(grossMarginPercent), forterImprovement: '', forterOutcome: fmtPct(grossMarginPercent), editableCustomerField: 'amerGrossMarginPercent', rawCustomerValue: grossMarginPercent, valueType: 'percent' },
      { formula: 'i = e*f', label: 'Profitability impact ($)', customerInput: fmtCur(custProfitability), forterImprovement: fmtCur(profitUplift), forterOutcome: fmtCur(forterProfitability), valueDriver: 'profit', isCalculation: true }
    );
  }

  // Calculator 2: Reduced CS ticket handling OpEx
  // Per spreadsheet: e = -c*d - costs displayed as NEGATIVE
  const custCSContacts = expectedRefundsVolume * (pctRefundsToCS / 100);
  const forterCSContacts = expectedRefundsVolume * (pctRefundsToCS / 100) * (1 - forterCSReduction / 100);
  const csContactsReduction = custCSContacts - forterCSContacts;
  
  // Costs displayed as negative per spreadsheet
  const custCSCost = -(custCSContacts * costPerCSContact);
  const forterCSCost = -(forterCSContacts * costPerCSContact);
  const csCostReduction = Math.abs(custCSCost) - Math.abs(forterCSCost);
  const costImprovement = forterCSCost - custCSCost; // Positive (less negative = improvement)

  const calculator2Rows: CalculatorRow[] = [
    { formula: 'a', label: 'Expected Refunds - Volume (#)', customerInput: fmt(Math.round(expectedRefundsVolume)), forterImprovement: '', forterOutcome: fmt(Math.round(expectedRefundsVolume)), editableCustomerField: 'expectedRefundsVolume', rawCustomerValue: expectedRefundsVolume, valueType: 'number' },
    { formula: 'b', label: '% of Refund Tickets to CS (%)', customerInput: fmtPct(pctRefundsToCS), forterImprovement: formatPctImprovementRel(pctRefundsToCS, pctRefundsToCS * (1 - forterCSReduction / 100)), forterOutcome: fmtPct(pctRefundsToCS * (1 - forterCSReduction / 100)), editableCustomerField: 'pctRefundsToCS', rawCustomerValue: pctRefundsToCS, valueType: 'percent' },
    { formula: 'c = a*b', label: 'Refund tickets / calls going to customer service', customerInput: fmt(Math.round(custCSContacts)), forterImprovement: fmt(Math.round(-csContactsReduction)), forterOutcome: fmt(Math.round(forterCSContacts)), isCalculation: true },
    { formula: 'd', label: 'Cost per CS Contact ($)', customerInput: fmtCur(costPerCSContact), forterImprovement: '', forterOutcome: fmtCur(costPerCSContact), editableCustomerField: 'costPerCSContact', rawCustomerValue: costPerCSContact, valueType: 'currency' },
    { formula: 'e = -c*d', label: 'Customer service cost ($)', customerInput: fmtCur(custCSCost), forterImprovement: fmtCur(costImprovement), forterOutcome: fmtCur(forterCSCost), valueDriver: 'cost', isCalculation: true },
  ];

  return {
    calculator1: { rows: calculator1Rows, gmvUplift, profitUplift },
    calculator2: { rows: calculator2Rows, costReduction: csCostReduction },
  };
}


// ============================================================
// CHALLENGE 12 & 13: ATO Protection
// ============================================================

export interface Challenge12_13Inputs {
  // Sign-in data
  monthlyLogins: number;
  customerLTV: number; // CLV - GMV ($)
  avgAppeasementValue: number;
  avgSalaryPerCSMember: number;
  avgHandlingTimePerATOClaim: number; // minutes
  pctChurnFromATO: number;
  commissionRate: number;
  grossMarginPercent: number;
  // Currency
  currencyCode?: string;
  isMarketplace?: boolean;
  // Forter KPIs
  pctFraudulentLogins: number;
  churnLikelihoodFromATO: number;
  atoCatchRate: number;
  /** GMV to Net sales deductions (%); default 20. Applied to GMV CLV churn before margin/EBITDA. */
  gmvToNetSalesDeductionPct?: number;
}

export interface Challenge12_13Results {
  calculator1: { rows: CalculatorRow[]; costReduction: number; }; // OpEx savings
  calculator2: { rows: CalculatorRow[]; profitUplift: number; }; // CLV loss mitigation
}

export function calculateChallenge12_13(inputs: Challenge12_13Inputs): Challenge12_13Results {
  const { currencyCode = 'USD' } = inputs;
  const fmt = (n: number) => n.toLocaleString('en-US');
  const fmtCur = createCurrencyFormatter(currencyCode);
  const fmtPct = (n: number) => `${n.toFixed(2)}%`;

  const {
    monthlyLogins, customerLTV, avgAppeasementValue, avgSalaryPerCSMember,
    avgHandlingTimePerATOClaim, commissionRate, grossMarginPercent,
    pctFraudulentLogins, churnLikelihoodFromATO, atoCatchRate,
    isMarketplace = false,
    gmvToNetSalesDeductionPct = 20,
  } = inputs;

  const commissionDecimal = commissionRate / 100;
  const grossMarginDecimal = grossMarginPercent / 100;
  const effectiveMarginDecimal = isMarketplace ? commissionDecimal : grossMarginDecimal;
  const effectiveMarginPercent = isMarketplace ? commissionRate : grossMarginPercent;
  const marginLabel = isMarketplace ? 'Commission / take rate (%)' : 'Gross margin (%)';

  // Annual logins (Monthly number of logins × 12)
  const annualLogins = monthlyLogins * 12;
  
  // #region agent log
  const _hourlySalaryInput = avgSalaryPerCSMember;
  // #endregion
  // Hourly salary = annual salary / 2080 hours; use 0 when avg salary not entered
  const hourlySalary = (avgSalaryPerCSMember == null || avgSalaryPerCSMember === 0 || Number.isNaN(Number(avgSalaryPerCSMember))) ? 0 : avgSalaryPerCSMember / 2080;
  // #region agent log
  if (typeof fetch !== 'undefined') { fetch('http://127.0.0.1:7242/ingest/48d8bace-9783-46c3-bd20-05ff6ac70f53',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'calculations.ts:ATO-hourlySalary',message:'ATO OpEx hourly salary',data:{avgSalaryPerCSMember:_hourlySalaryInput,hourlySalary},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{}); }
  // #endregion
  
  // Calculator 1: ATO protection OpEx savings
  const pctFraudDecimal = pctFraudulentLogins / 100;
  const catchRateDecimal = atoCatchRate / 100;
  
  const estimatedATOAttempts = annualLogins * pctFraudDecimal;
  const custSuccessfulATO = estimatedATOAttempts; // 0% catch rate
  const forterSuccessfulATO = estimatedATOAttempts * (1 - catchRateDecimal);
  
  // Cost to appease per claim
  const avgCSCostPerClaim = hourlySalary * (avgHandlingTimePerATOClaim / 60);
  const totalCostPerClaim = avgAppeasementValue + avgCSCostPerClaim;
  
  // Cost to appease - displayed as NEGATIVE per spreadsheet (j = -e*(f+i))
  const custCostToAppease = -(custSuccessfulATO * totalCostPerClaim);
  const forterCostToAppease = -(forterSuccessfulATO * totalCostPerClaim);
  const opExSavings = Math.abs(custCostToAppease) - Math.abs(forterCostToAppease);
  const costImprovement = forterCostToAppease - custCostToAppease; // Positive (less negative = improvement)

  const calculator1Rows: CalculatorRow[] = [
    { formula: 'a', label: 'Annual number of logins (#)', customerInput: fmt(Math.round(annualLogins)), forterImprovement: '', forterOutcome: fmt(Math.round(annualLogins)), editableCustomerField: 'monthlyLogins', rawCustomerValue: monthlyLogins, valueType: 'number' },
    { formula: 'b', label: 'Percent of fraudulent logins (%)', customerInput: fmtPct(pctFraudulentLogins), forterImprovement: '', forterOutcome: fmtPct(pctFraudulentLogins), editableForterField: 'pctFraudulentLogins', rawForterValue: pctFraudulentLogins, valueType: 'percent' },
    { formula: 'c = a*b', label: 'Estimated ATO attempts (#)', customerInput: fmt(Math.round(estimatedATOAttempts)), forterImprovement: '', forterOutcome: fmt(Math.round(estimatedATOAttempts)), isCalculation: true },
    { formula: 'd', label: 'ATO catch rate (%)', customerInput: '0%', forterImprovement: `+${atoCatchRate}% pts`, forterOutcome: fmtPct(atoCatchRate), editableForterField: 'atoCatchRate', rawForterValue: atoCatchRate, valueType: 'percent' },
    { formula: 'e = c*(1-d)', label: 'Successful ATO (#)', customerInput: fmt(Math.round(custSuccessfulATO)), forterImprovement: fmt(Math.round(forterSuccessfulATO - custSuccessfulATO)), forterOutcome: fmt(Math.round(forterSuccessfulATO)), isCalculation: true },
    { formula: '', label: 'Cost to appease', customerInput: '', forterImprovement: '', forterOutcome: '' },
    { formula: 'f', label: 'Average appeasement value (e.g. refunded points)', customerInput: fmtCur(avgAppeasementValue), forterImprovement: '', forterOutcome: fmtCur(avgAppeasementValue), editableCustomerField: 'avgAppeasementValue', rawCustomerValue: avgAppeasementValue, valueType: 'currency' },
    { formula: 'g', label: 'Hourly salary per customer service member ($)', customerInput: fmtCur(hourlySalary), forterImprovement: '', forterOutcome: fmtCur(hourlySalary), isCalculation: true },
    { formula: 'h', label: 'Average handling time per ATO claim (mins)', customerInput: fmt(avgHandlingTimePerATOClaim), forterImprovement: '', forterOutcome: fmt(avgHandlingTimePerATOClaim), editableCustomerField: 'avgHandlingTimePerATOClaim', rawCustomerValue: avgHandlingTimePerATOClaim, valueType: 'number' },
    { formula: 'i = g*(h/60)', label: 'Average customer service cost per claim ($)', customerInput: fmtCur(avgCSCostPerClaim), forterImprovement: '', forterOutcome: fmtCur(avgCSCostPerClaim), isCalculation: true },
    { formula: 'j = -e*(f+i)', label: 'Cost to appease ATO', customerInput: fmtCur(custCostToAppease), forterImprovement: fmtCur(costImprovement), forterOutcome: fmtCur(forterCostToAppease), valueDriver: 'cost', isCalculation: true },
  ];

  // Calculator 2: Mitigate CLV loss due to ATO brand risk
  // Per spreadsheet: h = e*f*g is NEGATIVE, k = -h*i*j is also NEGATIVE
  const churnLikelihoodDecimal = churnLikelihoodFromATO / 100;
  
  // Use positive custSuccessfulATO for the calculation (we negate custCostToAppease but need the base value)
  const custSuccessfulATOPositive = estimatedATOAttempts; // 0% catch rate
  const forterSuccessfulATOPositive = estimatedATOAttempts * (1 - catchRateDecimal);
  
  // GMV CLV churn - displayed as NEGATIVE per spreadsheet
  const custExpectedCLVChurn = -(custSuccessfulATOPositive * customerLTV * churnLikelihoodDecimal);
  const forterExpectedCLVChurn = -(forterSuccessfulATOPositive * customerLTV * churnLikelihoodDecimal);
  const clvChurnImprovement = forterExpectedCLVChurn - custExpectedCLVChurn; // Positive (less negative = improvement)
  const clvChurnReduction = Math.abs(custExpectedCLVChurn) - Math.abs(forterExpectedCLVChurn);
  
  // Net sales CLV churn = GMV CLV churn × (1 - GMV to Net sales deductions %)
  const netSalesMultiplier = 1 - gmvToNetSalesDeductionPct / 100;
  const custNetSalesCLVChurn = custExpectedCLVChurn * netSalesMultiplier;
  const forterNetSalesCLVChurn = forterExpectedCLVChurn * netSalesMultiplier;
  const netSalesCLVChurnImprovement = forterNetSalesCLVChurn - custNetSalesCLVChurn;
  // Profit CLV churn = Net sales CLV churn × margin(s)
  const profitabilityMultiplier = isMarketplace 
    ? effectiveMarginDecimal * grossMarginDecimal 
    : grossMarginDecimal;
  const custProfitCLVChurn = custNetSalesCLVChurn * profitabilityMultiplier;
  const forterProfitCLVChurn = forterNetSalesCLVChurn * profitabilityMultiplier;
  const profitImprovement = forterProfitCLVChurn - custProfitCLVChurn;
  const profitUplift = Math.abs(custProfitCLVChurn) - Math.abs(forterProfitCLVChurn);

  // Build calculator rows - GMV churn, deduction %, Net sales, then commission/gross margin, then profit
  const calculator2Rows: CalculatorRow[] = [
    { formula: 'a', label: 'Annual number of logins (#)', customerInput: fmt(Math.round(annualLogins)), forterImprovement: '', forterOutcome: fmt(Math.round(annualLogins)), editableCustomerField: 'monthlyLogins', rawCustomerValue: monthlyLogins, valueType: 'number' },
    { formula: 'b', label: 'Percent of fraudulent logins (%)', customerInput: fmtPct(pctFraudulentLogins), forterImprovement: '', forterOutcome: fmtPct(pctFraudulentLogins), editableForterField: 'pctFraudulentLogins', rawForterValue: pctFraudulentLogins, valueType: 'percent' },
    { formula: 'c = a*b', label: 'Estimated ATO attempts (#)', customerInput: fmt(Math.round(estimatedATOAttempts)), forterImprovement: '', forterOutcome: fmt(Math.round(estimatedATOAttempts)), isCalculation: true },
    { formula: 'd', label: 'ATO catch rate (%)', customerInput: '0%', forterImprovement: `+${atoCatchRate}% pts`, forterOutcome: fmtPct(atoCatchRate), editableForterField: 'atoCatchRate', rawForterValue: atoCatchRate, valueType: 'percent' },
    { formula: 'e = c*(1-d)', label: 'Successful ATO (#)', customerInput: fmt(Math.round(custSuccessfulATOPositive)), forterImprovement: fmt(Math.round(forterSuccessfulATOPositive - custSuccessfulATOPositive)), forterOutcome: fmt(Math.round(forterSuccessfulATOPositive)), isCalculation: true },
    { formula: 'f', label: 'Customer lifetime value (CLV) - GMV ($)', customerInput: fmtCur(customerLTV), forterImprovement: '', forterOutcome: fmtCur(customerLTV), editableCustomerField: 'customerLTV', rawCustomerValue: customerLTV, valueType: 'currency' },
    { formula: 'g', label: 'Churn likelihood from ATO (%)', customerInput: fmtPct(churnLikelihoodFromATO), forterImprovement: '', forterOutcome: fmtPct(churnLikelihoodFromATO), editableForterField: 'churnLikelihoodFromATO', rawForterValue: churnLikelihoodFromATO, valueType: 'percent' },
    { formula: 'h = -(e*f*g)', label: 'Expected GMV CLV churn from ATO ($)', customerInput: fmtCur(custExpectedCLVChurn), forterImprovement: fmtCur(clvChurnImprovement), forterOutcome: fmtCur(forterExpectedCLVChurn), isCalculation: true },
    { formula: 'i', label: 'GMV to Net sales deductions (sales tax/cancellations) (%)', customerInput: fmtPct(gmvToNetSalesDeductionPct), forterImprovement: '', forterOutcome: fmtPct(gmvToNetSalesDeductionPct), editableCustomerField: 'gmvToNetSalesDeductionPct', rawCustomerValue: gmvToNetSalesDeductionPct, valueType: 'percent' },
    { formula: 'j = h×(1-i)', label: 'Net sales ($)', customerInput: fmtCur(custNetSalesCLVChurn), forterImprovement: fmtCur(netSalesCLVChurnImprovement), forterOutcome: fmtCur(forterNetSalesCLVChurn), isCalculation: true },
  ];

  // For marketplaces: show commission (row k) and gross margin (row l), formula m = j*k*l
  // For retailers: show only gross margin (row k), formula m = j*k
  if (isMarketplace) {
    calculator2Rows.push(
      { formula: 'k', label: marginLabel, customerInput: fmtPct(effectiveMarginPercent), forterImprovement: '', forterOutcome: fmtPct(effectiveMarginPercent), editableCustomerField: 'commissionRate', rawCustomerValue: effectiveMarginPercent, valueType: 'percent' },
      { formula: 'l', label: 'Gross margin (%)', customerInput: fmtPct(grossMarginPercent), forterImprovement: '', forterOutcome: fmtPct(grossMarginPercent), editableCustomerField: 'amerGrossMarginPercent', rawCustomerValue: grossMarginPercent, valueType: 'percent' },
      { formula: 'm = j*k*l', label: 'Expected profit CLV churn from ATO ($)', customerInput: fmtCur(custProfitCLVChurn), forterImprovement: fmtCur(profitImprovement), forterOutcome: fmtCur(forterProfitCLVChurn), valueDriver: 'profit', isCalculation: true }
    );
  } else {
    calculator2Rows.push(
      { formula: 'k', label: 'Gross margin (%)', customerInput: fmtPct(grossMarginPercent), forterImprovement: '', forterOutcome: fmtPct(grossMarginPercent), editableCustomerField: 'amerGrossMarginPercent', rawCustomerValue: grossMarginPercent, valueType: 'percent' },
      { formula: 'm = j*k', label: 'Expected profit CLV churn from ATO ($)', customerInput: fmtCur(custProfitCLVChurn), forterImprovement: fmtCur(profitImprovement), forterOutcome: fmtCur(forterProfitCLVChurn), valueDriver: 'profit', isCalculation: true }
    );
  }

  return {
    calculator1: { rows: calculator1Rows, costReduction: opExSavings },
    calculator2: { rows: calculator2Rows, profitUplift },
  };
}


// ============================================================
// CHALLENGE 14 & 15: Sign-up Protection
// ============================================================

export interface Challenge14_15Inputs {
  // Sign-up data
  monthlySignups: number;
  avgNewMemberBonus: number; // Average new member bonus / discount ($)
  numDigitalCommunicationsPerYear: number;
  avgCostPerOutreach: number;
  avgKYCCostPerAccount: number;
  pctAccountsGoingThroughKYC: number;
  // Currency
  currencyCode?: string;
  // Forter KPIs
  pctFraudulentSignups: number;
  forterFraudulentSignupReduction: number; // % reduction in fraudulent signups
  forterKYCReduction: number; // % reduction in KYC checks
}

export interface Challenge14_15Results {
  calculator1: { rows: CalculatorRow[]; costReduction: number; }; // Marketing budget protection
  calculator2: { rows: CalculatorRow[]; costReduction: number; }; // Re-activation costs
  calculator3: { rows: CalculatorRow[]; costReduction: number; }; // KYC costs
}

export function calculateChallenge14_15(inputs: Challenge14_15Inputs): Challenge14_15Results {
  const { currencyCode = 'USD' } = inputs;
  const fmt = (n: number) => n.toLocaleString('en-US');
  const fmtCur = createCurrencyFormatter(currencyCode);
  const fmtPct = (n: number) => `${n.toFixed(2)}%`;

  const {
    monthlySignups, avgNewMemberBonus, numDigitalCommunicationsPerYear,
    avgCostPerOutreach, avgKYCCostPerAccount, pctAccountsGoingThroughKYC,
    pctFraudulentSignups, forterFraudulentSignupReduction, forterKYCReduction
  } = inputs;

  // Annual signups
  const annualSignups = monthlySignups * 12;
  
  // Calculator 1: Protect marketing budget against duplicate accounts
  const custFraudPct = pctFraudulentSignups / 100;
  const forterFraudPct = custFraudPct * (1 - forterFraudulentSignupReduction / 100);
  
  const custDuplicateAccounts = annualSignups * custFraudPct;
  const forterDuplicateAccounts = annualSignups * forterFraudPct;
  
  // Per spreadsheet: e = -c*(1-d) - costs displayed as NEGATIVE
  const custMarketingLoss = -(custDuplicateAccounts * avgNewMemberBonus);
  const forterMarketingLoss = -(forterDuplicateAccounts * avgNewMemberBonus);
  const marketingCostReduction = Math.abs(custMarketingLoss) - Math.abs(forterMarketingLoss);
  const marketingImprovement = forterMarketingLoss - custMarketingLoss; // Positive (less negative = improvement)

  const calculator1Rows: CalculatorRow[] = [
    { formula: 'a', label: 'Annual number of sign-ups (#)', customerInput: fmt(Math.round(annualSignups)), forterImprovement: '', forterOutcome: fmt(Math.round(annualSignups)), editableCustomerField: 'monthlySignups', rawCustomerValue: monthlySignups, valueType: 'number' },
    { formula: 'b', label: 'Percent of fraudulent sign-ups (e.g. duplicate) (%)', customerInput: fmtPct(pctFraudulentSignups), forterImprovement: formatPctImprovementRel(pctFraudulentSignups, forterFraudPct * 100), forterOutcome: fmtPct(forterFraudPct * 100), editableCustomerField: 'pctFraudulentSignups', rawCustomerValue: pctFraudulentSignups, editableForterField: 'forterFraudulentSignupReduction', rawForterValue: forterFraudPct * 100, valueType: 'percent', footnote: 'forter-outcome-from-reduction' },
    { formula: 'c = a*b', label: 'Estimated duplicate accounts annually (#)', customerInput: fmt(Math.round(custDuplicateAccounts)), forterImprovement: fmt(Math.round(forterDuplicateAccounts - custDuplicateAccounts)), forterOutcome: fmt(Math.round(forterDuplicateAccounts)), isCalculation: true },
    { formula: 'd', label: 'Average new member bonus / discount ($)', customerInput: fmtCur(avgNewMemberBonus), forterImprovement: '', forterOutcome: fmtCur(avgNewMemberBonus), editableCustomerField: 'avgNewMemberBonus', rawCustomerValue: avgNewMemberBonus, valueType: 'currency' },
    { formula: 'e = -c*d', label: 'Marketing loss of duplicate accounts ($)', customerInput: fmtCur(custMarketingLoss), forterImprovement: fmtCur(marketingImprovement), forterOutcome: fmtCur(forterMarketingLoss), valueDriver: 'cost', isCalculation: true },
  ];

  // Calculator 2: Reduce re-activation costs on fake accounts
  // Per spreadsheet: f = -c*d*e - costs displayed as NEGATIVE
  const custReactivationCost = -(custDuplicateAccounts * numDigitalCommunicationsPerYear * avgCostPerOutreach);
  const forterReactivationCost = -(forterDuplicateAccounts * numDigitalCommunicationsPerYear * avgCostPerOutreach);
  const reactivationCostReduction = Math.abs(custReactivationCost) - Math.abs(forterReactivationCost);
  const reactivationImprovement = forterReactivationCost - custReactivationCost; // Positive (less negative = improvement)

  const calculator2Rows: CalculatorRow[] = [
    { formula: 'a', label: 'Annual number of sign-ups (#)', customerInput: fmt(Math.round(annualSignups)), forterImprovement: '', forterOutcome: fmt(Math.round(annualSignups)), editableCustomerField: 'monthlySignups', rawCustomerValue: monthlySignups, valueType: 'number' },
    { formula: 'b', label: 'Percent of fraudulent sign-ups (e.g. duplicate) (%)', customerInput: fmtPct(pctFraudulentSignups), forterImprovement: formatPctImprovementRel(pctFraudulentSignups, forterFraudPct * 100), forterOutcome: fmtPct(forterFraudPct * 100), editableCustomerField: 'pctFraudulentSignups', rawCustomerValue: pctFraudulentSignups, editableForterField: 'forterFraudulentSignupReduction', rawForterValue: forterFraudPct * 100, valueType: 'percent', footnote: 'forter-outcome-from-reduction' },
    { formula: 'c = a*b', label: 'Estimated duplicate accounts annually (#)', customerInput: fmt(Math.round(custDuplicateAccounts)), forterImprovement: fmt(Math.round(forterDuplicateAccounts - custDuplicateAccounts)), forterOutcome: fmt(Math.round(forterDuplicateAccounts)), isCalculation: true },
    { formula: 'd', label: 'Number of digital communications per year to users (#)', customerInput: fmt(numDigitalCommunicationsPerYear), forterImprovement: '', forterOutcome: fmt(numDigitalCommunicationsPerYear), editableCustomerField: 'numDigitalCommunicationsPerYear', rawCustomerValue: numDigitalCommunicationsPerYear, valueType: 'number' },
    { formula: 'e', label: 'Average cost per outreach (email, SMS) ($)', customerInput: fmtCur(avgCostPerOutreach), forterImprovement: '', forterOutcome: fmtCur(avgCostPerOutreach), editableCustomerField: 'avgCostPerOutreach', rawCustomerValue: avgCostPerOutreach, valueType: 'currency' },
    { formula: 'f = -c*d*e', label: 'Estimated re-activation spend on fake accounts ($)', customerInput: fmtCur(custReactivationCost), forterImprovement: fmtCur(reactivationImprovement), forterOutcome: fmtCur(forterReactivationCost), valueDriver: 'cost', isCalculation: true },
  ];

  // Calculator 3: Optimize KYC costs
  // Per spreadsheet: f = -c*d - costs displayed as NEGATIVE
  const custKYCPct = pctAccountsGoingThroughKYC / 100;
  const forterKYCPct = custKYCPct * (1 - forterKYCReduction / 100);
  
  const custKYCChecks = annualSignups * custKYCPct;
  const forterKYCChecks = annualSignups * forterKYCPct;
  
  const custKYCCost = -(custKYCChecks * avgKYCCostPerAccount);
  const forterKYCCost = -(forterKYCChecks * avgKYCCostPerAccount);
  const kycCostReduction = Math.abs(custKYCCost) - Math.abs(forterKYCCost);
  const kycImprovement = forterKYCCost - custKYCCost; // Positive (less negative = improvement)

  const calculator3Rows: CalculatorRow[] = [
    { formula: 'a', label: 'Annual number of sign-ups (#)', customerInput: fmt(Math.round(annualSignups)), forterImprovement: '', forterOutcome: fmt(Math.round(annualSignups)), editableCustomerField: 'monthlySignups', rawCustomerValue: monthlySignups, valueType: 'number' },
    { formula: 'b', label: '% of new accounts going through KYC (%)', customerInput: fmtPct(pctAccountsGoingThroughKYC), forterImprovement: formatPctImprovementRel(pctAccountsGoingThroughKYC, forterKYCPct * 100), forterOutcome: fmtPct(forterKYCPct * 100), editableCustomerField: 'pctAccountsGoingThroughKYC', rawCustomerValue: pctAccountsGoingThroughKYC, editableForterField: 'forterKYCReduction', rawForterValue: forterKYCPct * 100, valueType: 'percent', footnote: 'forter-outcome-from-reduction' },
    { formula: 'c = a*b', label: 'Annual number of KYC checks (#)', customerInput: fmt(Math.round(custKYCChecks)), forterImprovement: fmt(Math.round(forterKYCChecks - custKYCChecks)), forterOutcome: fmt(Math.round(forterKYCChecks)), isCalculation: true },
    { formula: 'd', label: 'Average KYC cost per new account ($)', customerInput: fmtCur(avgKYCCostPerAccount), forterImprovement: '', forterOutcome: fmtCur(avgKYCCostPerAccount), editableCustomerField: 'avgKYCCostPerAccount', rawCustomerValue: avgKYCCostPerAccount, valueType: 'currency' },
    { formula: 'e = -c*d', label: 'KYC costs ($)', customerInput: fmtCur(custKYCCost), forterImprovement: fmtCur(kycImprovement), forterOutcome: fmtCur(forterKYCCost), valueDriver: 'cost', isCalculation: true },
  ];

  return {
    calculator1: { rows: calculator1Rows, costReduction: marketingCostReduction },
    calculator2: { rows: calculator2Rows, costReduction: reactivationCostReduction },
    calculator3: { rows: calculator3Rows, costReduction: kycCostReduction },
  };
}


// ============================================================
// COMPLETED TRANSACTION COUNT (for refund volume formula)
// ============================================================

/** Form fields needed to compute current-state completed transaction count (for Expected Refund volume = attempts × completion rate × refund rate) */
export interface FormDataForCompletionCount {
  amerGrossAttempts?: number;
  amerAnnualGMV?: number;
  amerPreAuthApprovalRate?: number;
  amerPostAuthApprovalRate?: number;
  amerCreditCardPct?: number;
  amer3DSChallengeRate?: number;
  amer3DSAbandonmentRate?: number;
  amerIssuingBankDeclineRate?: number;
  completedAOV?: number;
  amerGrossMarginPercent?: number;
  isMarketplace?: boolean;
  commissionRate?: number;
  fraudCBRate?: number;
  baseCurrency?: string;
}

/**
 * Returns current-state completed transaction count for refund volume formula.
 * Expected Refund volume = Transaction attempts (volume) × Completion rate × Refund rate.
 * When payment challenges (1 or 2/4/5) are selected, uses the same completion logic as the payments calculator (full funnel for 245, approval rate for 1).
 */
export function getCompletedTransactionCount(
  formData: FormDataForCompletionCount,
  isChallenge1Selected: boolean,
  isChallenge245Selected: boolean
): number {
  const transactionAttempts = formData.amerGrossAttempts ?? 0;
  if (transactionAttempts <= 0) return 0;
  if (!isChallenge1Selected && !isChallenge245Selected) return transactionAttempts;

  if (isChallenge245Selected) {
    const inputs: Challenge245Inputs = {
      transactionAttempts,
      transactionAttemptsValue: formData.amerAnnualGMV ?? 0,
      grossMarginPercent: formData.amerGrossMarginPercent ?? 0,
      preAuthApprovalRate: formData.amerPreAuthApprovalRate ?? 0,
      postAuthApprovalRate: formData.amerPostAuthApprovalRate ?? 0,
      creditCardPct: formData.amerCreditCardPct ?? 0,
      creditCard3DSPct: formData.amer3DSChallengeRate ?? 0,
      threeDSFailureRate: formData.amer3DSAbandonmentRate ?? 0,
      issuingBankDeclineRate: formData.amerIssuingBankDeclineRate ?? 0,
      fraudChargebackRate: formData.fraudCBRate ?? 0,
      isMarketplace: formData.isMarketplace ?? false,
      commissionRate: formData.commissionRate ?? 100,
      currencyCode: formData.baseCurrency || 'USD',
      completedAOV: formData.completedAOV,
      forterPreAuthImprovement: 0,
      forterPostAuthImprovement: 0,
      forter3DSReduction: 0,
      forterChargebackReduction: 0,
      forterTargetCBRate: formData.fraudCBRate ?? 0,
      forterTargetPostAuthRate: formData.amerPostAuthApprovalRate,
    };
    const result = calculateChallenge245(inputs);
    return result.calculator1.customerCompletedTransactionCount;
  }

  if (isChallenge1Selected) {
    const approvalRate = formData.amerPreAuthApprovalRate ?? 95;
    const inputs: Challenge1Inputs = {
      transactionAttempts,
      transactionAttemptsValue: formData.amerAnnualGMV ?? 0,
      grossMarginPercent: formData.amerGrossMarginPercent ?? 0,
      approvalRate,
      fraudChargebackRate: formData.fraudCBRate ?? 0,
      isMarketplace: formData.isMarketplace ?? false,
      commissionRate: formData.commissionRate ?? 100,
      currencyCode: formData.baseCurrency || 'USD',
      completedAOV: formData.completedAOV,
      forterApprovalRateImprovement: 0,
      forterChargebackReduction: 0,
    };
    const result = calculateChallenge1(inputs);
    return result.calculator1.customerCompletedTransactionCount;
  }

  return transactionAttempts;
}


// ============================================================
// CHALLENGE DEFINITIONS
// ============================================================

export type ChallengeId = '1' | '2' | '3' | '4' | '5' | '7' | '8' | '9' | '10' | '11' | '12' | '13' | '14' | '15';

export interface ChallengeDefinition {
  id: ChallengeId;
  number: number;
  category: string;
  name: string;
  enabled: boolean;
  solutionMapping: string[];
}

// Solution mapping for each challenge
export const SOLUTION_PRODUCTS = [
  { id: 'fraud-management', name: 'Fraud Management', icon: 'Shield' },
  { id: 'payments-optimization', name: 'Payments Optimization', icon: 'CreditCard' },
  { id: 'dispute-management', name: 'Dispute Management', icon: 'FileText' },
  { id: 'policy-abuse-prevention', name: 'Policy Abuse Prevention', icon: 'Ban' },
  { id: 'account-protection', name: 'Account Protection', icon: 'UserCheck' },
  { id: 'issuer-optimization', name: 'Issuer Optimization (US)', icon: 'Building' },
] as const;

export const CHALLENGES: ChallengeDefinition[] = [
  { id: '1', number: 1, category: 'Fraud systems / customer experience', name: 'False fraud declines blocking incremental revenue potential', enabled: true, solutionMapping: ['fraud-management'] },
  { id: '2', number: 2, category: 'Fraud systems / customer experience', name: 'Rigid rules based fraud system implemented', enabled: true, solutionMapping: ['fraud-management', 'payments-optimization'] },
  { id: '3', number: 3, category: 'Fraud systems / customer experience', name: 'Manual review process hinders scalability', enabled: true, solutionMapping: ['fraud-management'] },
  { id: '4', number: 4, category: 'Payments', name: 'Non-optimized payment funnel process (e.g. high 3DS declines)', enabled: true, solutionMapping: ['fraud-management', 'payments-optimization'] },
  { id: '5', number: 5, category: 'Payments', name: 'Difficulty applying exemptions to reduce friction and improve CX', enabled: true, solutionMapping: ['fraud-management', 'payments-optimization'] },
  { id: '7', number: 7, category: 'Chargebacks', name: 'Difficulty in managing and disputing fraud & service chargebacks', enabled: true, solutionMapping: ['dispute-management'] },
  { id: '8', number: 8, category: 'Abuse Prevention', name: 'Users abusing policies (returns & item not received claims)', enabled: true, solutionMapping: ['policy-abuse-prevention'] },
  { id: '9', number: 9, category: 'Abuse Prevention', name: 'Lack customer trust to offer value-add services such as instant refunds', enabled: true, solutionMapping: ['policy-abuse-prevention'] },
  { id: '10', number: 10, category: 'Abuse Prevention', name: 'Suffering from promotion abuse', enabled: true, solutionMapping: ['policy-abuse-prevention'] },
  { id: '11', number: 11, category: 'Abuse Prevention', name: 'Suffering from reseller/reshipper/limited items', enabled: true, solutionMapping: ['policy-abuse-prevention'] },
  { id: '12', number: 12, category: 'Account/Identity abuse', name: 'Large number of account takeover (ATO) / hackers', enabled: true, solutionMapping: ['account-protection'] },
  { id: '13', number: 13, category: 'Account/Identity abuse', name: 'ATO actors causing brand risk - putting downward pressure on CLTV', enabled: true, solutionMapping: ['account-protection'] },
  { id: '14', number: 14, category: 'Account/Identity abuse', name: 'High risk of sign-up promotions abuse', enabled: true, solutionMapping: ['account-protection'] },
  { id: '15', number: 15, category: 'Account/Identity abuse', name: 'Pressure on CAC due to large number of fraudulent sign-ups', enabled: true, solutionMapping: ['account-protection'] },
];

export const ALL_CHALLENGES: ChallengeDefinition[] = [
  { id: '1', number: 1, category: 'Fraud systems / customer experience', name: 'False fraud declines blocking incremental revenue potential', enabled: true, solutionMapping: ['fraud-management'] },
  { id: '2', number: 2, category: 'Fraud systems / customer experience', name: 'Rigid rules based fraud system implemented', enabled: true, solutionMapping: ['fraud-management', 'payments-optimization'] },
  { id: '3', number: 3, category: 'Fraud systems / customer experience', name: 'Manual review process hinders scalability', enabled: true, solutionMapping: ['fraud-management'] },
  { id: '4', number: 4, category: 'Payments', name: 'Non-optimized payment funnel process (e.g. high 3DS declines)', enabled: true, solutionMapping: ['fraud-management', 'payments-optimization'] },
  { id: '5', number: 5, category: 'Payments', name: 'Difficulty applying exemptions to reduce friction and improve CX', enabled: true, solutionMapping: ['fraud-management', 'payments-optimization'] },
  { id: '6' as ChallengeId, number: 6, category: 'Payments', name: 'Unoptimized processor flow (predictive routing)', enabled: false, solutionMapping: [] },
  { id: '7', number: 7, category: 'Chargebacks', name: 'Difficulty in managing and disputing fraud & service chargebacks', enabled: true, solutionMapping: ['dispute-management'] },
  { id: '8', number: 8, category: 'Abuse Prevention', name: 'Users abusing policies (returns & item not received claims)', enabled: true, solutionMapping: ['policy-abuse-prevention'] },
  { id: '9', number: 9, category: 'Abuse Prevention', name: 'Lack customer trust to offer value-add services such as instant refunds', enabled: true, solutionMapping: ['policy-abuse-prevention'] },
  { id: '10', number: 10, category: 'Abuse Prevention', name: 'Suffering from promotion abuse', enabled: true, solutionMapping: ['policy-abuse-prevention'] },
  { id: '11', number: 11, category: 'Abuse Prevention', name: 'Suffering from reseller/reshipper/limited items', enabled: true, solutionMapping: ['policy-abuse-prevention'] },
  { id: '12', number: 12, category: 'Account/Identity abuse', name: 'Large number of account takeover (ATO) / hackers', enabled: true, solutionMapping: ['account-protection'] },
  { id: '13', number: 13, category: 'Account/Identity abuse', name: 'ATO actors causing brand risk - putting downward pressure on CLTV', enabled: true, solutionMapping: ['account-protection'] },
  { id: '14', number: 14, category: 'Account/Identity abuse', name: 'High risk of sign-up promotions abuse', enabled: true, solutionMapping: ['account-protection'] },
  { id: '15', number: 15, category: 'Account/Identity abuse', name: 'Pressure on CAC due to large number of fraudulent sign-ups', enabled: true, solutionMapping: ['account-protection'] },
];
