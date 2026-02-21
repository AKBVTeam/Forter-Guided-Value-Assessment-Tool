/**
 * Segment Types and Utilities
 * 
 * Enables users to create custom data segments (e.g., by region, category, or business unit)
 * for fraud and payment challenges (1, 2, 4, 5). Each segment has its own input data
 * AND Forter KPI targets, with results aggregating into the main Value Summary.
 */

/**
 * Segment-specific input data for fraud/payments challenges
 * These fields mirror the global payment/fraud inputs but are scoped to a segment
 */
export interface SegmentInputs {
  // Core transaction data
  grossAttempts?: number;
  annualGMV?: number;
  
  // Approval rates
  preAuthApprovalRate?: number;
  preAuthIncluded?: boolean;
  postAuthApprovalRate?: number;
  postAuthIncluded?: boolean;
  
  // 3DS data
  creditCardPct?: number;
  threeDSChallengeRate?: number;
  threeDSAbandonmentRate?: number;
  
  // Bank & fraud data
  issuingBankDeclineRate?: number;
  fraudCBRate?: number;
  fraudCBAOV?: number;
  
  // Override for AOV calculation
  completedAOV?: number;
  // Tracks if user manually set completedAOV (otherwise auto-calculate)
  completedAOVManuallySet?: boolean;
}

/**
 * Segment-specific Forter KPI targets
 * Each segment has its own targets (no global inheritance)
 */
export interface SegmentKPIs {
  // Challenge 1 only (simple approval rate)
  approvalRateTarget?: number;
  chargebackRateTarget?: number;
  /** Forter outcome override for Completed AOV ($); when set, used for Forter value of approved transactions in this segment. */
  forterCompletedAOV?: number;
  
  // Challenge 2/4/5 specific
  preAuthApprovalTarget?: number;
  preAuthIncluded?: boolean;
  postAuthApprovalTarget?: number;
  postAuthIncluded?: boolean;
  threeDSRateTarget?: number;
  issuingBankDeclineReductionTarget?: number;
}

/**
 * Complete segment definition
 */
export interface Segment {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  inputs: SegmentInputs;
  kpis: SegmentKPIs;
  // Segment-specific profile for KPI lookups
  country?: string;
  industry?: string;
}

/**
 * Create an empty segment with default values
 */
export const createEmptySegment = (
  name: string = '', 
  defaultKPIs?: Partial<SegmentKPIs>,
  defaultCountry?: string,
  defaultIndustry?: string
): Segment => ({
  id: crypto.randomUUID(),
  name,
  description: '',
  enabled: true,
  inputs: {
    postAuthIncluded: false, // Default Post-auth to excluded
    postAuthApprovalRate: 100, // When excluded, rate is 100%
  },
  kpis: defaultKPIs ? { 
    ...defaultKPIs,
    postAuthIncluded: false, // Default Post-auth to excluded
    postAuthApprovalTarget: 100, // When excluded, rate is 100%
  } : {
    postAuthIncluded: false,
    postAuthApprovalTarget: 100,
  },
  country: defaultCountry,
  industry: defaultIndustry,
});

/**
 * Copy global inputs to a segment
 */
export const copyGlobalInputsToSegment = (
  segment: Segment,
  globalInputs: {
    amerGrossAttempts?: number;
    amerAnnualGMV?: number;
    amerPreAuthApprovalRate?: number;
    amerPostAuthApprovalRate?: number;
    amerCreditCardPct?: number;
    amer3DSChallengeRate?: number;
    amer3DSAbandonmentRate?: number;
    amerIssuingBankDeclineRate?: number;
    fraudCBRate?: number;
    fraudCBAOV?: number;
    completedAOV?: number;
  }
): Segment => ({
  ...segment,
  inputs: {
    grossAttempts: globalInputs.amerGrossAttempts,
    annualGMV: globalInputs.amerAnnualGMV,
    preAuthApprovalRate: globalInputs.amerPreAuthApprovalRate,
    postAuthApprovalRate: globalInputs.amerPostAuthApprovalRate,
    creditCardPct: globalInputs.amerCreditCardPct,
    threeDSChallengeRate: globalInputs.amer3DSChallengeRate,
    threeDSAbandonmentRate: globalInputs.amer3DSAbandonmentRate,
    issuingBankDeclineRate: globalInputs.amerIssuingBankDeclineRate,
    fraudCBRate: globalInputs.fraudCBRate,
    fraudCBAOV: globalInputs.fraudCBAOV,
    completedAOV: globalInputs.completedAOV,
  },
});

/**
 * Check if fraud/payments challenges are selected (1, 2, 4, 5)
 */
export const hasPaymentChallengesSelected = (
  selectedChallenges: { [key: string]: boolean }
): boolean => {
  return (
    selectedChallenges['1'] ||
    selectedChallenges['2'] ||
    selectedChallenges['4'] ||
    selectedChallenges['5'] ||
    false
  );
};

/**
 * Get a summary string for a segment (for display in list view)
 */
export const getSegmentSummary = (
  segment: Segment,
  currencySymbol: string = '$'
): string => {
  const parts: string[] = [];
  
  if (segment.inputs.annualGMV !== undefined) {
    const gmvInMillions = segment.inputs.annualGMV / 1_000_000;
    parts.push(`GMV: ${currencySymbol}${gmvInMillions.toFixed(1)}M`);
  }
  
  if (segment.inputs.grossAttempts !== undefined) {
    const attemptsInK = segment.inputs.grossAttempts / 1_000;
    parts.push(`Attempts: ${attemptsInK.toFixed(0)}K`);
  }
  
  if (segment.inputs.preAuthApprovalRate !== undefined) {
    parts.push(`Approval: ${segment.inputs.preAuthApprovalRate.toFixed(1)}%`);
  }
  
  return parts.length > 0 ? parts.join(' | ') : 'No data entered';
};

/**
 * Get KPI status string for a segment
 */
export const getSegmentKPIStatus = (segment: Segment): string => {
  const parts: string[] = [];
  
  // Use preAuthApprovalTarget as the primary fraud approval metric (not both approval and pre-auth)
  if (segment.kpis.preAuthApprovalTarget !== undefined) {
    parts.push(`${segment.kpis.preAuthApprovalTarget.toFixed(1)}% pre-auth fraud approval`);
  } else if (segment.kpis.approvalRateTarget !== undefined) {
    // Fallback to approvalRateTarget if preAuth not set (for Challenge 1 only)
    parts.push(`${segment.kpis.approvalRateTarget.toFixed(1)}% fraud approval`);
  }
  
  // Add 3DS rate if configured
  if (segment.kpis.threeDSRateTarget !== undefined) {
    parts.push(`${segment.kpis.threeDSRateTarget.toFixed(1)}% 3DS`);
  }
  
  if (segment.kpis.chargebackRateTarget !== undefined) {
    parts.push(`${segment.kpis.chargebackRateTarget.toFixed(2)}% fraud CB`);
  }
  
  return parts.length > 0 ? parts.join(', ') : 'Not configured';
};

/**
 * Validate a segment has minimum required data for calculations
 */
export const isSegmentValid = (segment: Segment): boolean => {
  return (
    segment.name.trim().length > 0 &&
    segment.inputs.grossAttempts !== undefined &&
    segment.inputs.grossAttempts > 0 &&
    segment.inputs.annualGMV !== undefined &&
    segment.inputs.annualGMV > 0
  );
};

/**
 * Count how many input fields are filled in a segment
 */
export const countSegmentFilledFields = (segment: Segment): { filled: number; total: number } => {
  const fields: (keyof SegmentInputs)[] = [
    'grossAttempts',
    'annualGMV',
    'preAuthApprovalRate',
    'postAuthApprovalRate',
    'creditCardPct',
    'threeDSChallengeRate',
    'threeDSAbandonmentRate',
    'issuingBankDeclineRate',
    'fraudCBRate',
    'fraudCBAOV',
  ];
  
  let filled = 0;
  for (const field of fields) {
    const value = segment.inputs[field];
    if (value !== undefined && value !== null && value !== 0) {
      filled++;
    }
  }
  
  return { filled, total: fields.length };
};

/**
 * Aggregated segment data for read-only display
 * Sums volume/value fields and calculates weighted averages for rate fields
 */
export interface AggregatedSegmentData {
  totalGrossAttempts: number;
  totalAnnualGMV: number;
  weightedPreAuthApprovalRate: number | undefined;
  weightedPostAuthApprovalRate: number | undefined;
  weightedCreditCardPct: number | undefined;
  weighted3DSChallengeRate: number | undefined;
  weighted3DSAbandonmentRate: number | undefined;
  weightedIssuingBankDeclineRate: number | undefined;
  weightedFraudCBRate: number | undefined;
  averageFraudCBAOV: number | undefined;
  weightedCompletedAOV: number | undefined;
}

// Numeric fields only for weighted calculations
type NumericSegmentInputKey = 
  | 'grossAttempts' 
  | 'annualGMV' 
  | 'preAuthApprovalRate' 
  | 'postAuthApprovalRate'
  | 'creditCardPct'
  | 'threeDSChallengeRate'
  | 'threeDSAbandonmentRate'
  | 'issuingBankDeclineRate'
  | 'fraudCBRate'
  | 'fraudCBAOV'
  | 'completedAOV';

/**
 * Calculate weighted average for a rate field across enabled segments
 * Weight is based on gross transaction attempts
 */
const calculateWeightedRate = (
  segments: Segment[],
  field: NumericSegmentInputKey
): number | undefined => {
  const enabledSegments = segments.filter(s => s.enabled);
  
  let totalWeight = 0;
  let weightedSum = 0;
  
  for (const segment of enabledSegments) {
    const rate = segment.inputs[field];
    const weight = segment.inputs.grossAttempts ?? 0;
    
    if (rate !== undefined && typeof rate === 'number' && weight > 0) {
      weightedSum += rate * weight;
      totalWeight += weight;
    }
  }
  
  return totalWeight > 0 ? weightedSum / totalWeight : undefined;
};

/**
 * Calculate simple average for non-rate fields (like AOV)
 */
const calculateSimpleAverage = (
  segments: Segment[],
  field: NumericSegmentInputKey
): number | undefined => {
  const enabledSegments = segments.filter(s => s.enabled);
  const values = enabledSegments
    .map(s => s.inputs[field])
    .filter((v): v is number => typeof v === 'number' && v > 0);
  
  if (values.length === 0) return undefined;
  return values.reduce((a, b) => a + b, 0) / values.length;
};

/**
 * Calculate weighted average for Completed AOV
 * Uses segment's completedAOV if set, otherwise calculates from GMV/attempts
 * Weighted by grossAttempts
 */
const calculateWeightedCompletedAOV = (segments: Segment[]): number | undefined => {
  const enabledSegments = segments.filter(s => s.enabled);
  
  let totalWeight = 0;
  let weightedSum = 0;
  
  for (const segment of enabledSegments) {
    const weight = segment.inputs.grossAttempts ?? 0;
    if (weight <= 0) continue;
    
    // Use explicit completedAOV if set, otherwise calculate from GMV/attempts
    let aov = segment.inputs.completedAOV;
    if (aov === undefined || aov <= 0) {
      const gmv = segment.inputs.annualGMV ?? 0;
      aov = gmv / weight; // weight is grossAttempts here
    }
    
    if (aov > 0) {
      weightedSum += aov * weight;
      totalWeight += weight;
    }
  }
  
  return totalWeight > 0 ? weightedSum / totalWeight : undefined;
};

/**
 * Aggregate all segment data into summary values
 * - Volume/value fields are summed
 * - Rate fields use weighted averages based on transaction volume
 */
export const aggregateSegmentData = (segments: Segment[]): AggregatedSegmentData => {
  const enabledSegments = segments.filter(s => s.enabled);
  
  // Sum volume and value fields
  const totalGrossAttempts = enabledSegments.reduce(
    (sum, s) => sum + (s.inputs.grossAttempts ?? 0),
    0
  );
  
  const totalAnnualGMV = enabledSegments.reduce(
    (sum, s) => sum + (s.inputs.annualGMV ?? 0),
    0
  );
  
  // Calculate weighted averages for rate fields
  // For AOV fields, we use weighted average by grossAttempts (value-weighted makes more sense)
  return {
    totalGrossAttempts,
    totalAnnualGMV,
    weightedPreAuthApprovalRate: calculateWeightedRate(segments, 'preAuthApprovalRate'),
    weightedPostAuthApprovalRate: calculateWeightedRate(segments, 'postAuthApprovalRate'),
    weightedCreditCardPct: calculateWeightedRate(segments, 'creditCardPct'),
    weighted3DSChallengeRate: calculateWeightedRate(segments, 'threeDSChallengeRate'),
    weighted3DSAbandonmentRate: calculateWeightedRate(segments, 'threeDSAbandonmentRate'),
    weightedIssuingBankDeclineRate: calculateWeightedRate(segments, 'issuingBankDeclineRate'),
    weightedFraudCBRate: calculateWeightedRate(segments, 'fraudCBRate'),
    averageFraudCBAOV: calculateWeightedRate(segments, 'fraudCBAOV'),
    // Completed AOV: if segment has explicit value use it, else calculate from GMV/attempts
    weightedCompletedAOV: calculateWeightedCompletedAOV(segments),
  };
};

/**
 * Aggregated Forter KPI data for read-only display when segmentation is enabled
 * Uses weighted averages based on transaction volume
 */
export interface AggregatedForterKPIs {
  weightedPreAuthApprovalTarget: number | undefined;
  weightedPostAuthApprovalTarget: number | undefined;
  weightedApprovalRateTarget: number | undefined;
  weightedChargebackRateTarget: number | undefined;
  weightedThreeDSRateTarget: number | undefined;
}

/**
 * Calculate weighted average for a KPI field across enabled segments
 * Returns undefined if no segments have configured data (not the global fallback)
 * Weight is based on gross transaction attempts
 */
export const aggregateSegmentKPIs = (
  segments: Segment[],
  globalKPIs: {
    approvalRateImprovement?: number;
    preAuthApprovalImprovement?: number;
    postAuthApprovalImprovement?: number;
    chargebackReduction?: number;
    threeDSReduction?: number;
  }
): AggregatedForterKPIs => {
  const enabledSegments = segments.filter(s => s.enabled);
  
  // Check if any segment has transaction volume data for weighting
  const hasAnyWeight = enabledSegments.some(s => (s.inputs.grossAttempts ?? 0) > 0);
  
  const calculateWeightedKPI = (
    getSegmentValue: (s: Segment) => number | undefined,
    globalValue: number | undefined
  ): number | undefined => {
    // If no segments have weight data, return undefined (not global fallback)
    // This ensures KPIs show as 0 until segment data is entered
    if (!hasAnyWeight) {
      return undefined;
    }
    
    let totalWeight = 0;
    let weightedSum = 0;
    let hasAnySegmentValue = false;
    
    for (const segment of enabledSegments) {
      const weight = segment.inputs.grossAttempts ?? 0;
      if (weight <= 0) continue;
      
      // Get segment-specific value
      const segmentValue = getSegmentValue(segment);
      
      // Only include in calculation if segment has a specific value set
      if (segmentValue !== undefined) {
        hasAnySegmentValue = true;
        weightedSum += segmentValue * weight;
        totalWeight += weight;
      }
    }
    
    // If no segment has a value for this KPI, return undefined
    if (!hasAnySegmentValue) {
      return undefined;
    }
    
    return totalWeight > 0 ? weightedSum / totalWeight : undefined;
  };
  
  return {
    weightedPreAuthApprovalTarget: calculateWeightedKPI(
      s => s.kpis.preAuthApprovalTarget,
      globalKPIs.preAuthApprovalImprovement
    ),
    weightedPostAuthApprovalTarget: calculateWeightedKPI(
      s => s.kpis.postAuthApprovalTarget,
      globalKPIs.postAuthApprovalImprovement
    ),
    weightedApprovalRateTarget: calculateWeightedKPI(
      s => s.kpis.approvalRateTarget,
      globalKPIs.approvalRateImprovement
    ),
    weightedChargebackRateTarget: calculateWeightedKPI(
      s => s.kpis.chargebackRateTarget,
      globalKPIs.chargebackReduction
    ),
    weightedThreeDSRateTarget: calculateWeightedKPI(
      s => s.kpis.threeDSRateTarget,
      globalKPIs.threeDSReduction
    ),
  };
};
