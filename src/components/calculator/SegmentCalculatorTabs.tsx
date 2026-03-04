import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { EditableCalculatorDisplay } from "./EditableCalculatorDisplay";
import { CalculatorData } from "@/pages/Index";
import { ForterKPIs, defaultForterKPIs } from "./ForterKPIConfig";
import { Segment, SegmentInputs, SegmentKPIs } from "@/lib/segments";
import { getCurrencySymbol } from "@/lib/benchmarkData";
import {
  calculateChallenge1,
  calculateChallenge245,
  Challenge1Inputs,
  Challenge245Inputs,
  CalculatorRow,
  createCurrencyFormatter,
  DeduplicationBreakdown,
} from "@/lib/calculations";
import { getGmvToNetSalesDeductionPct } from "@/lib/gmvToNetSalesDeductionByCountry";
import { Card } from "@/components/ui/card";
import { Lock } from "lucide-react";

interface SegmentCalculatorTabsProps {
  challengeType: "c1" | "c245";
  calculatorType: "revenue" | "chargeback";
  formData: CalculatorData;
  globalForterKPIs: ForterKPIs;
  deduplicationEnabled: boolean;
  deduplicationRetryRate: number;
  deduplicationSuccessRate: number;
  includesFraudCBCoverage?: boolean;
  onSegmentInputChange?: (segmentId: string, field: keyof SegmentInputs, value: number) => void;
  onSegmentKPIChange?: (segmentId: string, field: keyof SegmentKPIs, value: number) => void;
  /** Global form fields (e.g. gmvToNetSalesDeductionPct) - updates main formData so calculator maths and ROI stay in sync */
  onFormDataChange?: (field: keyof CalculatorData, value: number) => void;
}

/**
 * Calculate per-segment results for Challenge 1 or 2/4/5
 * CRITICAL: Uses ONLY segment-specific inputs - no fallback to global defaults for rate/percentage fields
 */
function calculateSegmentResults(
  segment: Segment,
  formData: CalculatorData,
  globalForterKPIs: ForterKPIs,
  challengeType: "c1" | "c245",
  calculatorType: "revenue" | "chargeback",
  deduplicationEnabled: boolean,
  deduplicationRetryRate: number,
  deduplicationSuccessRate: number,
  includesFraudCBCoverage: boolean = false
): { rows: CalculatorRow[]; value: number; deduplicationBreakdown?: DeduplicationBreakdown } | null {
  const segmentInputs = segment.inputs;
  const segmentKPIs = segment.kpis;

  // Core segment values - must have transaction data
  const grossAttempts = segmentInputs.grossAttempts ?? 0;
  const annualGMV = segmentInputs.annualGMV ?? 0;
  
  // Global values (non-segmented fields)
  const grossMarginPercent = formData.amerGrossMarginPercent || 50;
  const currencyCode = formData.baseCurrency || 'USD';
  const isMarketplace = formData.isMarketplace || false;
  const commissionRate = formData.commissionRate || 100;

  if (grossAttempts <= 0 || annualGMV <= 0) {
    return null;
  }

  if (challengeType === "c1") {
    // CRITICAL: Use segment values ONLY - do not fall back to global defaults
    // If segment has 0%, use 0% (not global default)
    const currentApprovalRate = segmentInputs.preAuthApprovalRate ?? 0;
    const currentCBRate = segmentInputs.fraudCBRate ?? 0;

    // Use segment KPI targets - if not set, use 0 (not global defaults)
    let approvalImprovement = segmentKPIs.approvalRateTarget ?? 0;
    if (globalForterKPIs.approvalRateIsAbsolute && approvalImprovement > 0) {
      approvalImprovement = Math.max(0, approvalImprovement - currentApprovalRate);
    }
    approvalImprovement = Math.min(approvalImprovement, 100 - currentApprovalRate);

    let cbReduction = segmentKPIs.chargebackRateTarget ?? 0;
    if (globalForterKPIs.chargebackReductionIsAbsolute && cbReduction > 0) {
      if (currentCBRate > 0) {
        cbReduction = Math.max(0, ((currentCBRate - cbReduction) / currentCBRate) * 100);
      } else {
        cbReduction = 0;
      }
    }
    cbReduction = Math.min(100, Math.max(0, cbReduction));

    const inputs: Challenge1Inputs = {
      transactionAttempts: grossAttempts,
      transactionAttemptsValue: annualGMV,
      grossMarginPercent,
      approvalRate: currentApprovalRate,
      fraudChargebackRate: currentCBRate,
      isMarketplace,
      commissionRate,
      currencyCode,
      completedAOV: segmentInputs.completedAOV ?? (grossAttempts > 0 ? annualGMV / grossAttempts : 0),
      forterCompletedAOV: segmentKPIs.forterCompletedAOV ?? globalForterKPIs.forterCompletedAOV,
      recoveredAovMultiplier: globalForterKPIs.recoveredAovMultiplier ?? 1.15,
      forterApprovalRateImprovement: approvalImprovement,
      forterChargebackReduction: cbReduction,
      deduplication: { enabled: deduplicationEnabled, retryRate: deduplicationRetryRate, successRate: deduplicationSuccessRate },
      includesFraudCBCoverage,
      gmvToNetSalesDeductionPct: getGmvToNetSalesDeductionPct(formData),
    };

    const results = calculateChallenge1(inputs);
    return calculatorType === "revenue"
      ? { rows: results.calculator1.rows, value: results.calculator1.revenueUplift, deduplicationBreakdown: results.calculator1.deduplicationBreakdown }
      : { rows: results.calculator2.rows, value: results.calculator2.costReduction };
  } else {
    // Challenge 2/4/5
    // CRITICAL: Use segment values ONLY - do not fall back to global defaults
    const currentPreAuthRate = segmentInputs.preAuthApprovalRate ?? 0;
    const currentPostAuthRate = segmentInputs.postAuthApprovalRate ?? 0;
    const current3DSRate = segmentInputs.threeDSChallengeRate ?? 0;
    const currentCBRate = segmentInputs.fraudCBRate ?? 0;
    const creditCardPct = segmentInputs.creditCardPct ?? 0;
    const threeDSFailureRate = segmentInputs.threeDSAbandonmentRate ?? 0;
    const issuingBankDeclineRate = segmentInputs.issuingBankDeclineRate ?? 0;

    // Use segment KPI targets - if not set, use 0 (not global defaults)
    let preAuthImprovement = 0;
    const preAuthIncluded = segmentKPIs.preAuthIncluded ?? globalForterKPIs.preAuthIncluded !== false;
    if (preAuthIncluded) {
      preAuthImprovement = segmentKPIs.preAuthApprovalTarget ?? 0;
      if (globalForterKPIs.preAuthApprovalIsAbsolute && preAuthImprovement > 0) {
        preAuthImprovement = preAuthImprovement - currentPreAuthRate; // allow negative (Forter outcome below customer)
      }
      preAuthImprovement = Math.min(preAuthImprovement, 100 - currentPreAuthRate);
    }

    let postAuthImprovement = 0;
    let targetPostAuthRate: number | undefined = undefined;
    const postAuthIncluded = segmentKPIs.postAuthIncluded ?? globalForterKPIs.postAuthIncluded !== false;
    if (postAuthIncluded) {
      postAuthImprovement = segmentKPIs.postAuthApprovalTarget ?? 0;
      if (globalForterKPIs.postAuthApprovalIsAbsolute && postAuthImprovement > 0) {
        postAuthImprovement = postAuthImprovement - currentPostAuthRate; // allow negative (Forter outcome below customer)
      }
      postAuthImprovement = Math.min(postAuthImprovement, 100 - currentPostAuthRate);
    } else {
      targetPostAuthRate = 100;
      postAuthImprovement = 100 - currentPostAuthRate;
    }

    let threeDSReduction = segmentKPIs.threeDSRateTarget ?? 0;
    if (globalForterKPIs.threeDSReductionIsAbsolute && threeDSReduction > 0) {
      threeDSReduction = Math.max(0, current3DSRate - threeDSReduction);
    }
    threeDSReduction = Math.min(threeDSReduction, current3DSRate);

    let cbReduction = segmentKPIs.chargebackRateTarget ?? 0;
    let targetCBRate: number;
    if (globalForterKPIs.chargebackReductionIsAbsolute && cbReduction > 0) {
      targetCBRate = Math.max(0, cbReduction);
      if (currentCBRate > 0) {
        cbReduction = Math.max(0, ((currentCBRate - targetCBRate) / currentCBRate) * 100);
      } else {
        cbReduction = 0;
      }
    } else {
      targetCBRate = currentCBRate * (1 - cbReduction / 100);
    }
    cbReduction = Math.min(100, Math.max(0, cbReduction));

    const inputs: Challenge245Inputs = {
      transactionAttempts: grossAttempts,
      transactionAttemptsValue: annualGMV,
      grossMarginPercent,
      preAuthApprovalRate: currentPreAuthRate,
      postAuthApprovalRate: currentPostAuthRate,
      creditCardPct,
      creditCard3DSPct: current3DSRate,
      threeDSFailureRate,
      issuingBankDeclineRate,
      forter3DSAbandonmentRate: globalForterKPIs.forter3DSAbandonmentRate ?? threeDSFailureRate,
      forterIssuingBankDeclineRate: globalForterKPIs.forterIssuingBankDeclineRate ?? issuingBankDeclineRate,
      fraudChargebackRate: currentCBRate,
      isMarketplace,
      commissionRate,
      currencyCode,
      completedAOV: segmentInputs.completedAOV ?? (grossAttempts > 0 ? annualGMV / grossAttempts : 0),
      forterCompletedAOV: segmentKPIs.forterCompletedAOV ?? globalForterKPIs.forterCompletedAOV,
      recoveredAovMultiplier: globalForterKPIs.recoveredAovMultiplier ?? 1.15,
      forterPreAuthImprovement: preAuthImprovement,
      forterPostAuthImprovement: postAuthImprovement,
      forter3DSReduction: threeDSReduction,
      forterChargebackReduction: cbReduction,
      forterTargetCBRate: targetCBRate,
      forterTargetPostAuthRate: targetPostAuthRate,
      deduplication: { enabled: deduplicationEnabled, retryRate: deduplicationRetryRate, successRate: deduplicationSuccessRate },
      includesFraudCBCoverage,
      gmvToNetSalesDeductionPct: getGmvToNetSalesDeductionPct(formData),
    };

    const results = calculateChallenge245(inputs);
    return calculatorType === "revenue"
      ? { rows: results.calculator1.rows, value: results.calculator1.revenueUplift, deduplicationBreakdown: results.calculator1.deduplicationBreakdown }
      : { rows: results.calculator2.rows, value: results.calculator2.costReduction };
  }
}

/**
 * Build aggregate rows for the Global Total view (read-only)
 * Aggregates all segment results into a consolidated view
 */
function buildAggregateRows(
  segmentResults: Record<string, { rows: CalculatorRow[]; value: number } | null>,
  enabledSegments: Segment[],
  currencyCode: string
): CalculatorRow[] {
  // Get the first valid result to use as a template for row structure
  const firstResult = Object.values(segmentResults).find(r => r !== null);
  if (!firstResult) return [];

  const fmtCur = createCurrencyFormatter(currencyCode);
  const weightBySegmentId = new Map(
    enabledSegments.map((s) => [s.id, s.inputs.grossAttempts ?? 0])
  );

  const parseDisplayValue = (
    display: string | undefined,
    type: "percent" | "currency" | "number"
  ): number | undefined => {
    if (!display) return undefined;
    let s = display.trim();
    if (!s) return undefined;

    // Handle brackets for negative numbers e.g. ($1,234)
    let negative = false;
    if (s.startsWith("(") && s.endsWith(")")) {
      negative = true;
      s = s.slice(1, -1).trim();
    }

    // Strip units/symbols
    if (type === "percent") {
      s = s.replace(/%/g, "");
    } else {
      // currency or number
      s = s.replace(/[$€£]/g, "");
    }

    // Remove commas/spaces
    s = s.replace(/,/g, "").replace(/\s+/g, "");

    // Some cells may contain non-numeric placeholders
    const v = Number.parseFloat(s);
    if (Number.isNaN(v)) return undefined;
    return negative ? -v : v;
  };

  const formatValue = (
    value: number,
    type: "percent" | "currency" | "number"
  ) => {
    if (type === "percent") return `${value.toFixed(2)}%`;
    if (type === "currency") return fmtCur(value);
    return Math.round(value).toLocaleString();
  };

  // Create aggregated rows across segments (percent rows are weighted averages)
  return firstResult.rows.map((templateRow, rowIndex) => {
    // Skip section headers - just copy them
    if (!templateRow.formula && templateRow.label && !templateRow.customerInput) {
      return { ...templateRow };
    }

    const inferredType: "percent" | "currency" | "number" =
      templateRow.valueType === "percent"
        ? "percent"
        : templateRow.valueType === "currency"
          ? "currency"
          : templateRow.customerInput?.includes("%") || templateRow.forterOutcome?.includes("%")
            ? "percent"
            : templateRow.customerInput?.includes("$") ||
                templateRow.customerInput?.includes("€") ||
                templateRow.customerInput?.includes("£") ||
                templateRow.forterOutcome?.includes("$") ||
                templateRow.forterOutcome?.includes("€") ||
                templateRow.forterOutcome?.includes("£")
              ? "currency"
              : "number";

    let customerAgg: number | undefined = undefined;
    let forterAgg: number | undefined = undefined;

    if (inferredType === "percent") {
      // Weighted average by segment transaction volume (gross attempts)
      let customerWeighted = 0;
      let forterWeighted = 0;
      let customerWeightTotal = 0;
      let forterWeightTotal = 0;

      for (const segment of enabledSegments) {
        const segmentId = segment.id;
        const result = segmentResults[segmentId];
        if (!result || !result.rows[rowIndex]) continue;

        const w = weightBySegmentId.get(segmentId) ?? 0;
        if (w <= 0) continue;

        const row = result.rows[rowIndex];

        const custVal =
          row.rawCustomerValue ??
          parseDisplayValue(row.customerInput, "percent");
        if (custVal !== undefined) {
          customerWeighted += custVal * w;
          customerWeightTotal += w;
        }

        const fortVal =
          row.rawForterValue ??
          parseDisplayValue(row.forterOutcome, "percent");
        if (fortVal !== undefined) {
          forterWeighted += fortVal * w;
          forterWeightTotal += w;
        }
      }

      if (customerWeightTotal > 0) customerAgg = customerWeighted / customerWeightTotal;
      if (forterWeightTotal > 0) forterAgg = forterWeighted / forterWeightTotal;
    } else {
      // Sum currency + numeric rows across segments
      let customerSum = 0;
      let forterSum = 0;
      let hasCustomer = false;
      let hasForter = false;

      for (const segment of enabledSegments) {
        const segmentId = segment.id;
        const result = segmentResults[segmentId];
        if (!result || !result.rows[rowIndex]) continue;

        const row = result.rows[rowIndex];

        const custVal = row.rawCustomerValue ?? parseDisplayValue(row.customerInput, inferredType);
        if (custVal !== undefined) {
          customerSum += custVal;
          hasCustomer = true;
        }

        const fortVal = row.rawForterValue ?? parseDisplayValue(row.forterOutcome, inferredType);
        if (fortVal !== undefined) {
          forterSum += fortVal;
          hasForter = true;
        }
      }

      customerAgg = hasCustomer ? customerSum : undefined;
      forterAgg = hasForter ? forterSum : undefined;
    }

    // Calculate the forterImprovement as the delta between forter and customer
    let improvementDisplay = templateRow.forterImprovement;
    if (forterAgg !== undefined && customerAgg !== undefined) {
      const delta = forterAgg - customerAgg;
      if (inferredType === "percent") {
        // For percentages, show as relative % improvement (not %pts) to match main calculator
        const rel = typeof customerAgg === "number" && customerAgg !== 0
          ? ((forterAgg - customerAgg) / customerAgg) * 100
          : NaN;
        improvementDisplay = Number.isFinite(rel)
          ? `${rel >= 0 ? "+" : ""}${rel.toFixed(2)}%`
          : "—";
      } else if (inferredType === "currency") {
        improvementDisplay = delta >= 0 ? fmtCur(delta) : `(${fmtCur(Math.abs(delta))})`;
      } else {
        improvementDisplay = delta >= 0 ? `+${Math.round(delta).toLocaleString()}` : Math.round(delta).toLocaleString();
      }
    }

    return {
      ...templateRow,
      customerInput: customerAgg !== undefined ? formatValue(customerAgg, inferredType) : templateRow.customerInput,
      forterImprovement: improvementDisplay,
      forterOutcome: forterAgg !== undefined ? formatValue(forterAgg, inferredType) : templateRow.forterOutcome,
      rawCustomerValue: customerAgg,
      rawForterValue: forterAgg,
      // Remove editable fields for aggregate view
      editableCustomerField: undefined,
      editableForterField: undefined,
    };
  });
}

/**
 * Exported utility to compute segment aggregate values for a challenge type and calculator type.
 * This allows ValueSummaryOptionA to use the same totals as the Total tab.
 */
export function computeSegmentedAggregateValue(
  formData: CalculatorData,
  globalForterKPIs: ForterKPIs,
  challengeType: "c1" | "c245",
  calculatorType: "revenue" | "chargeback",
  deduplicationEnabled: boolean,
  deduplicationRetryRate: number,
  deduplicationSuccessRate: number,
  includesFraudCBCoverage: boolean = false
): number {
  const segments = formData.segments || [];
  const enabledSegments = segments.filter(s => s.enabled);
  
  if (enabledSegments.length === 0) return 0;
  
  let total = 0;
  for (const segment of enabledSegments) {
    const result = calculateSegmentResults(
      segment,
      formData,
      globalForterKPIs,
      challengeType,
      calculatorType,
      deduplicationEnabled,
      deduplicationRetryRate,
      deduplicationSuccessRate,
      includesFraudCBCoverage
    );
    if (result) {
      total += result.value;
    }
  }
  return total;
}

/**
 * Exported utility to compute aggregated calculator rows for the Total view.
 * Same logic as the Total tab in SegmentCalculatorTabs - use for Value Summary completion rate etc.
 */
export function computeSegmentedAggregateRows(
  formData: CalculatorData,
  globalForterKPIs: ForterKPIs,
  challengeType: "c1" | "c245",
  calculatorType: "revenue" | "chargeback",
  deduplicationEnabled: boolean,
  deduplicationRetryRate: number,
  deduplicationSuccessRate: number,
  includesFraudCBCoverage: boolean = false
): CalculatorRow[] {
  const segments = formData.segments || [];
  const enabledSegments = segments.filter(s => s.enabled);
  if (enabledSegments.length === 0) return [];

  const segmentResults: Record<string, { rows: CalculatorRow[]; value: number } | null> = {};
  for (const segment of enabledSegments) {
    const result = calculateSegmentResults(
      segment,
      formData,
      globalForterKPIs,
      challengeType,
      calculatorType,
      deduplicationEnabled,
      deduplicationRetryRate,
      deduplicationSuccessRate,
      includesFraudCBCoverage
    );
    segmentResults[segment.id] = result;
  }
  return buildAggregateRows(segmentResults, enabledSegments, formData.baseCurrency || "USD");
}

/**
 * Exported utility to compute aggregated deduplication breakdown across all segments.
 * Sums the deduplication metrics from each segment's calculation.
 */
export function computeSegmentedAggregateDeduplicationBreakdown(
  formData: CalculatorData,
  globalForterKPIs: ForterKPIs,
  challengeType: "c1" | "c245",
  deduplicationEnabled: boolean,
  deduplicationRetryRate: number,
  deduplicationSuccessRate: number
): DeduplicationBreakdown | null {
  const segments = formData.segments || [];
  const enabledSegments = segments.filter(s => s.enabled);
  
  if (enabledSegments.length === 0) return null;
  
  // Aggregate breakdown values across segments (summing transaction counts and values)
  let totalApprovedTxImprovement = 0;
  let totalFraudTxDropOff = 0;
  let totalThreeDSDropOff = 0;
  let totalBankDeclineDelta = 0;
  let totalNonFraudDelta = 0;
  let totalDuplicateSuccessfulTx = 0;
  let totalGmvReduction = 0;
  let totalWeight = 0;
  let weightedAov = 0;
  let hasFullBreakdown = false;
  let hasSimplifiedBreakdown = false;
  
  for (const segment of enabledSegments) {
    const result = calculateSegmentResults(
      segment,
      formData,
      globalForterKPIs,
      challengeType,
      "revenue", // Revenue calculator has deduplication breakdown
      deduplicationEnabled,
      deduplicationRetryRate,
      deduplicationSuccessRate
    );
    
    if (result?.deduplicationBreakdown) {
      const breakdown = result.deduplicationBreakdown;
      const weight = segment.inputs.grossAttempts ?? 0;
      
      if (breakdown.approvedTxImprovement !== undefined) {
        hasSimplifiedBreakdown = true;
        totalApprovedTxImprovement += breakdown.approvedTxImprovement;
      }
      totalFraudTxDropOff += breakdown.fraudTxDropOff;
      totalNonFraudDelta += breakdown.nonFraudDelta;
      totalDuplicateSuccessfulTx += breakdown.duplicateSuccessfulTx;
      totalGmvReduction += breakdown.gmvReduction;
      
      if (breakdown.threeDSDropOff !== undefined) {
        hasFullBreakdown = true;
        totalThreeDSDropOff += breakdown.threeDSDropOff;
        totalBankDeclineDelta += (breakdown.bankDeclineDelta ?? 0);
      }
      
      if (weight > 0) {
        weightedAov += breakdown.aov * weight;
        totalWeight += weight;
      }
    }
  }
  
  if (totalWeight === 0) return null;
  
  return {
    approvedTxImprovement: hasSimplifiedBreakdown ? totalApprovedTxImprovement : undefined,
    fraudTxDropOff: totalFraudTxDropOff,
    threeDSDropOff: hasFullBreakdown ? totalThreeDSDropOff : undefined,
    bankDeclineDelta: hasFullBreakdown ? totalBankDeclineDelta : undefined,
    nonFraudDelta: totalNonFraudDelta,
    retryRate: deduplicationRetryRate,
    successRate: deduplicationSuccessRate,
    duplicateSuccessfulTx: totalDuplicateSuccessfulTx,
    aov: weightedAov / totalWeight,
    gmvReduction: totalGmvReduction,
  };
}

export const SegmentCalculatorTabs = ({
  challengeType,
  calculatorType,
  formData,
  globalForterKPIs,
  deduplicationEnabled,
  deduplicationRetryRate,
  deduplicationSuccessRate,
  includesFraudCBCoverage = false,
  onSegmentInputChange,
  onSegmentKPIChange,
  onFormDataChange,
}: SegmentCalculatorTabsProps) => {
  const segments = formData.segments || [];
  const enabledSegments = segments.filter(s => s.enabled);
  const currencySymbol = getCurrencySymbol(formData.baseCurrency || 'USD');

  const [selectedSegmentId, setSelectedSegmentId] = useState<string>(
    enabledSegments[0]?.id || "global"
  );

  // Calculate results for each segment (deduplication applied per-segment)
  const segmentResults = useMemo(() => {
    const results: Record<string, { rows: CalculatorRow[]; value: number } | null> = {};
    
    for (const segment of enabledSegments) {
      results[segment.id] = calculateSegmentResults(
        segment,
        formData,
        globalForterKPIs,
        challengeType,
        calculatorType,
        deduplicationEnabled,
        deduplicationRetryRate,
        deduplicationSuccessRate,
        includesFraudCBCoverage
      );
    }
    
    return results;
  }, [enabledSegments, formData, globalForterKPIs, challengeType, calculatorType, deduplicationEnabled, deduplicationRetryRate, deduplicationSuccessRate, includesFraudCBCoverage]);

  // Calculate aggregate total (sum of per-segment deduplicated values)
  const aggregateValue = useMemo(() => {
    return Object.values(segmentResults).reduce((sum, result) => {
      return sum + (result?.value || 0);
    }, 0);
  }, [segmentResults]);

  // Build aggregate rows for Global view
  const aggregateRows = useMemo(() => {
    return buildAggregateRows(segmentResults, enabledSegments, formData.baseCurrency || 'USD');
  }, [segmentResults, enabledSegments, formData.baseCurrency]);

  const formatCurrency = (value: number) => {
    const inMillions = value / 1_000_000;
    if (inMillions >= 1) {
      return `${currencySymbol}${inMillions.toFixed(1)}M`;
    }
    return `${currencySymbol}${Math.round(value).toLocaleString()}`;
  };

  // Global form fields: edit updates main formData so calculator maths, ROI, and other inputs stay in sync
  const GLOBAL_FORM_FIELDS = new Set<keyof CalculatorData>(['gmvToNetSalesDeductionPct', 'amerGrossMarginPercent', 'commissionRate']);

  // Handle segment-specific field changes (bi-directional editing)
  const handleSegmentFieldChange = (segmentId: string) => (field: keyof CalculatorData, value: number) => {
    if (GLOBAL_FORM_FIELDS.has(field) && onFormDataChange) {
      onFormDataChange(field, value);
      return;
    }
    // Map CalculatorData fields to SegmentInputs fields
    const fieldMapping: Record<string, keyof SegmentInputs> = {
      amerGrossAttempts: 'grossAttempts',
      amerAnnualGMV: 'annualGMV',
      amerPreAuthApprovalRate: 'preAuthApprovalRate',
      amerPostAuthApprovalRate: 'postAuthApprovalRate',
      amerCreditCardPct: 'creditCardPct',
      amer3DSChallengeRate: 'threeDSChallengeRate',
      amer3DSAbandonmentRate: 'threeDSAbandonmentRate',
      amerIssuingBankDeclineRate: 'issuingBankDeclineRate',
      fraudCBRate: 'fraudCBRate',
      fraudCBAOV: 'fraudCBAOV',
      completedAOV: 'completedAOV',
    };

    const segmentField = fieldMapping[field as string];
    if (segmentField && onSegmentInputChange) {
      onSegmentInputChange(segmentId, segmentField, value);
    }
  };

  // Handle segment-specific KPI changes
  const handleSegmentKPIChange = (segmentId: string) => (field: keyof ForterKPIs, value: number) => {
    // Map ForterKPIs fields to SegmentKPIs fields
    const kpiMapping: Record<string, keyof SegmentKPIs> = {
      approvalRateImprovement: 'approvalRateTarget',
      chargebackReduction: 'chargebackRateTarget',
      preAuthApprovalImprovement: 'preAuthApprovalTarget',
      postAuthApprovalImprovement: 'postAuthApprovalTarget',
      threeDSReduction: 'threeDSRateTarget',
      forterCompletedAOV: 'forterCompletedAOV',
    };

    const segmentKPIField = kpiMapping[field as string];
    if (segmentKPIField && onSegmentKPIChange) {
      onSegmentKPIChange(segmentId, segmentKPIField, value);
    }
  };

  if (enabledSegments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No segments configured. Enable segment analysis to view per-segment breakdowns.</p>
      </div>
    );
  }

  // Build calculator title without "Challenge 2/4/5" text
  const getCalculatorTitle = (segmentName: string) => {
    const typeLabel = calculatorType === 'revenue' ? 'Revenue Calculator' : 'Chargeback Calculator';
    return `${segmentName} - ${typeLabel}`;
  };

  return (
    <Tabs value={selectedSegmentId} onValueChange={setSelectedSegmentId} className="w-full">
      <div className="flex items-center justify-between mb-4">
        <TabsList className="flex-wrap h-auto">
          {enabledSegments.map(segment => {
            const result = segmentResults[segment.id];
            return (
              <TabsTrigger key={segment.id} value={segment.id} className="flex items-center gap-2">
                {segment.name}
                {result && (
                  <Badge variant="secondary" className="text-xs font-mono">
                    {formatCurrency(result.value)}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
          {/* Global Total Tab */}
          <TabsTrigger value="global" className="flex items-center gap-2">
            <Lock className="w-3 h-3" />
            Total
            <Badge className="font-mono">{formatCurrency(aggregateValue)}</Badge>
          </TabsTrigger>
        </TabsList>
      </div>

      {/* Segment Calculator Tabs */}
      {enabledSegments.map(segment => {
        const result = segmentResults[segment.id];
        
        return (
          <TabsContent key={segment.id} value={segment.id} className="mt-0">
            {result ? (
              <EditableCalculatorDisplay
                title={getCalculatorTitle(segment.name)}
                rows={result.rows}
                onCustomerFieldChange={handleSegmentFieldChange(segment.id)}
                onForterFieldChange={handleSegmentKPIChange(segment.id)}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground border rounded-lg">
                <p>No data available for {segment.name}.</p>
                <p className="text-sm mt-2">Enter transaction attempts and GMV to see calculations.</p>
              </div>
            )}
          </TabsContent>
        );
      })}

      {/* Global Total Tab - Read Only */}
      <TabsContent value="global" className="mt-0">
        <Card className="overflow-hidden">
          <div className="bg-muted/50 border-b px-4 py-3 flex items-center gap-2">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <h4 className="font-semibold text-sm">
              Total - {calculatorType === 'revenue' ? 'Revenue Calculator' : 'Chargeback Calculator'}
            </h4>
            <Badge variant="outline" className="text-xs">Read Only</Badge>
          </div>
          <div className="p-4">
            <p className="text-sm text-muted-foreground mb-4">
              This view shows the aggregated results across all segments. Percentage rows display volume-weighted averages, currency/count rows display sums. Individual segments may have different KPI targets - see the Forter KPIs tab for weighted-average targets.
            </p>
            {aggregateRows.length > 0 ? (
              <EditableCalculatorDisplay
                title=""
                rows={aggregateRows}
                className="border-0 shadow-none"
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No segment data available to aggregate.</p>
              </div>
            )}
          </div>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
