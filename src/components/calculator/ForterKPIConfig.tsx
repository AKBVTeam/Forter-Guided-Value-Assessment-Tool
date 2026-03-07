import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { NumericInput } from "./NumericInput";
import { PercentageInput } from "./PercentageInput";
import { IncludeExcludeChip } from "./IncludeExcludeChip";
import { AbuseBenchmarksModal, AbuseBenchmarks, defaultAbuseBenchmarks } from "./AbuseBenchmarksModal";
import { ForterKPISegmentModal } from "./ForterKPISegmentModal";
import { WeightedAverageTooltipKPI } from "./WeightedAverageTooltipKPI";
import { getValidationWarning } from "@/lib/inputValidation";
import { Segment, hasPaymentChallengesSelected, aggregateSegmentKPIs, getSegmentKPIStatus } from "@/lib/segments";
import { Layers, Pencil, Info, RotateCcw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";

export interface ForterKPIs {
  approvalRateImprovement: number;
  approvalRateIsAbsolute: boolean;
  /** When true, do not auto-overwrite approval/pre/post from industry/HQ benchmark. */
  approvalRateUserOverride?: boolean;
  chargebackReduction: number;
  chargebackReductionIsAbsolute: boolean;
  /** When true, do not auto-overwrite chargebackReduction from vendor/CB benchmark. */
  chargebackReductionUserOverride?: boolean;
  preAuthApprovalImprovement: number;
  preAuthApprovalIsAbsolute: boolean;
  /** When true, do not auto-overwrite preAuth from industry/HQ benchmark. */
  preAuthApprovalUserOverride?: boolean;
  preAuthIncluded: boolean;
  postAuthApprovalImprovement: number;
  postAuthApprovalIsAbsolute: boolean;
  /** When true, do not auto-overwrite postAuth from industry/HQ benchmark. */
  postAuthApprovalUserOverride?: boolean;
  postAuthIncluded: boolean;
  threeDSReduction: number;
  threeDSReductionIsAbsolute: boolean;
  /** When true, do not auto-overwrite threeDSReduction from country/AOV benchmark (user or calculator override). */
  threeDSRateUserOverride?: boolean;
  /** Forter outcome override for 3DS Failure & Abandonment Rate (%) in payment funnel; when set, used as Forter rate (0-100). */
  forter3DSAbandonmentRate?: number;
  /** Forter outcome override for Issuing Bank Decline Rate (%) in payment funnel; when set, used as Forter rate (0-100). */
  forterIssuingBankDeclineRate?: number;
  /** Forter outcome override for Completed AOV ($) in calculators; when set, used for Forter value of approved transactions. */
  forterCompletedAOV?: number;
  /** AOV uplift applied to recovered transactions only (default 1.15 = 15% higher AOV on recovered). */
  recoveredAovMultiplier?: number;
  manualReviewReduction: number;
  manualReviewIsAbsolute: boolean;
  reviewTimeReduction: number;
  reviewTimeIsAbsolute: boolean;
  fraudDisputeRateImprovement: number;
  fraudDisputeIsAbsolute: boolean;
  fraudWinRateChange: number;
  fraudWinRateIsAbsolute: boolean;
  serviceDisputeRateImprovement: number;
  serviceDisputeIsAbsolute: boolean;
  serviceWinRateChange: number;
  serviceWinRateIsAbsolute: boolean;
  disputeTimeReduction: number;
  disputeTimeIsAbsolute: boolean;
  fraudApprovalRate?: number;
  // Challenge 8: General model assumptions (on main KPI page)
  forterCatchRate: number;
  abuseAovMultiplier: number;
  // Challenge 8: Abuse benchmarks (in modal)
  abuseBenchmarks?: AbuseBenchmarks;
  // Challenge 9: Instant Refunds
  npsIncreaseFromInstantRefunds: number;
  lseNPSBenchmark: number;
  forterCSReduction: number;
  // Challenge 12/13: ATO Protection
  pctFraudulentLogins: number;
  churnLikelihoodFromATO: number;
  atoCatchRate: number;
  // Challenge 14/15: Sign-up Protection
  pctFraudulentSignups: number;
  forterFraudulentSignupReduction: number;
  forterKYCReduction: number;
  // Legacy properties for backward compatibility with ResultsDashboard
  bankDeclineImprovement?: number;
  threeDSChallengeIsAbsolute?: boolean;
  threeDSChallengeReduction?: number;
  threeDSAbandonmentIsAbsolute?: boolean;
  threeDSAbandonmentImprovement?: number;
}

export const defaultForterKPIs: ForterKPIs = {
  // Challenge 1: False Fraud Declines (absolute mode - target values)
  approvalRateImprovement: 99,
  approvalRateIsAbsolute: true,
  chargebackReduction: 0.25, // Target 0.25% CB rate
  chargebackReductionIsAbsolute: true, // Using target rate mode since UI shows "Target CB Rate"
  // Challenges 2, 4, 5: Rules, 3DS & Exemptions (absolute mode - target values)
  preAuthApprovalImprovement: 99,
  preAuthApprovalIsAbsolute: true,
  preAuthIncluded: true,
  postAuthApprovalImprovement: 100, // Default to 100% (excluded)
  postAuthApprovalIsAbsolute: true,
  postAuthIncluded: false, // Default to excluded
  threeDSReduction: 10,
  threeDSReductionIsAbsolute: true,
  recoveredAovMultiplier: 1.15,
  // Challenge 3: Manual Review (absolute by default - target values)
  manualReviewReduction: 0, // Target 0% manual review rate
  manualReviewIsAbsolute: true,
  reviewTimeReduction: 7, // Target 7 minutes per review
  reviewTimeIsAbsolute: true,
  // Challenge 7: Chargeback Disputes (absolute by default)
  fraudDisputeRateImprovement: 90,
  fraudDisputeIsAbsolute: true,
  fraudWinRateChange: 30,
  fraudWinRateIsAbsolute: true,
  serviceDisputeRateImprovement: 90,
  serviceDisputeIsAbsolute: true,
  serviceWinRateChange: 40,
  serviceWinRateIsAbsolute: true,
  disputeTimeReduction: 5, // Target avg time to review CB in minutes (absolute value)
  disputeTimeIsAbsolute: true,
  // Challenge 8: Policy Abuse Prevention
  forterCatchRate: 90,
  abuseAovMultiplier: 1.5,
  abuseBenchmarks: defaultAbuseBenchmarks,
  // Challenge 9: Instant Refunds
  npsIncreaseFromInstantRefunds: 10,
  lseNPSBenchmark: 1, // 1% per 7 NPS points
  forterCSReduction: 78, // 78% reduction in CS contacts
  // Challenge 12/13: ATO Protection
  pctFraudulentLogins: 1,
  churnLikelihoodFromATO: 50,
  atoCatchRate: 90,
  // Challenge 14/15: Sign-up Protection
  pctFraudulentSignups: 10,
  forterFraudulentSignupReduction: 95,
  forterKYCReduction: 80,
  // Legacy defaults
  bankDeclineImprovement: 20,
  threeDSChallengeIsAbsolute: false,
  threeDSChallengeReduction: 40,
  threeDSAbandonmentIsAbsolute: false,
  threeDSAbandonmentImprovement: 20,
};

interface CustomerInputs {
  amerPreAuthApprovalRate?: number;
  amerPostAuthApprovalRate?: number;
  amer3DSChallengeRate?: number;
  fraudCBRate?: number;
  manualReviewPct?: number;
  timePerReview?: number;
  fraudDisputeRate?: number;
  fraudWinRate?: number;
  serviceDisputeRate?: number;
  serviceWinRate?: number;
  avgTimeToReviewCB?: number;
  annualCBDisputes?: number;
  costPerHourAnalyst?: number;
  // For AOV calculation display
  amerAnnualGMV?: number;
  amerGrossAttempts?: number;
  baseCurrency?: string;
  // For vendor-based CB rate lookup in segments
  existingFraudVendor?: string;
}

/** Section IDs used when navigating from Value Summary performance highlights */
export type ForterKPIFocusSection =
  | "c1"
  | "c245"
  | "manual-review"
  | "disputes"
  | "abuse"
  | "instant-refunds"
  | "ato"
  | "signup";

interface ForterKPIConfigProps {
  kpis: ForterKPIs;
  onUpdate: (kpis: ForterKPIs) => void;
  selectedChallenges?: { [key: string]: boolean };
  customerInputs?: CustomerInputs;
  // Segmentation support
  segmentationEnabled?: boolean;
  segments?: Segment[];
  onSegmentUpdate?: (segment: Segment) => void;
  /** When set, scroll to this section and open modals if needed (e.g. from Value Summary highlight click) */
  focusTarget?: ForterKPIFocusSection | null;
  onFocusHandled?: () => void;
  /** List = single column; grid = current 2-column layout */
  viewMode?: 'list' | 'grid';
  /** When a KPI value matches an auto-applied benchmark, show "(Forter Benchmark)" pill with this tooltip text keyed by field id */
  forterBenchmarkSources?: Partial<Record<keyof ForterKPIs, string>>;
  /** Current benchmark values for reset-to-benchmark (keyed by field id). When present and value differs, show reset button. */
  forterBenchmarkValues?: Partial<Record<keyof ForterKPIs, number>>;
  /** PSD2-relevant 3DS suggestion: rate and reason (e.g. "PSD2 - AOV €100-€250"). Shown as pill in Fraud Detection & 3DS when rate > 0. */
  suggested3DSFromPSD2?: { rate: number; reason: string } | null;
}

interface KPIInputRowProps {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  included?: boolean;
  onIncludedChange?: (included: boolean) => void;
  showIncludeToggle?: boolean;
  currentValue?: number;
  currentValueLabel?: string;
  currentValueUnit?: string;
  /** Field name for validation lookup */
  fieldName?: string;
  /** Number of decimal places to display */
  decimalPlaces?: number;
  /** From parent: list vs grid layout */
  fieldRowClass?: string;
  /** From parent: label wrapper class for list view */
  fieldLabelWrapClass?: string;
  /** From parent: wrapper class for Current line in list view (e.g. col-span-2) */
  fieldHelperWrapClass?: string;
  /** From parent: input class for list view (right-align, width) */
  fieldInputClass?: string;
  /** When true, render a 0-100 slider instead of numeric input */
  useSlider?: boolean;
  /** Slider range (default 0-100 when useSlider) */
  sliderMin?: number;
  sliderMax?: number;
}

const KPIInputRow = ({ 
  label, 
  value, 
  onValueChange, 
  included = true,
  onIncludedChange,
  showIncludeToggle = false,
  currentValue,
  currentValueLabel,
  currentValueUnit = "%",
  fieldName,
  decimalPlaces,
  fieldRowClass = 'space-y-2',
  fieldLabelWrapClass = 'flex items-center justify-between gap-2',
  fieldHelperWrapClass = '',
  fieldInputClass = '',
  useSlider = false,
  sliderMin = 0,
  sliderMax = 100,
}: KPIInputRowProps) => {
  // Calculate actual % reduction: (target - current) / current * 100
  const calculatePercentChange = (): string | null => {
    if (currentValue === undefined || currentValue === 0) return null;
    const percentChange = ((value - currentValue) / currentValue) * 100;
    const sign = percentChange >= 0 ? '+' : '';
    return `${sign}${percentChange.toFixed(1)}%`;
  };

  const percentChange = calculatePercentChange();
  const warning = fieldName && included ? getValidationWarning(fieldName, value) : null;
  return (
    <div className={fieldRowClass}>
      <div className={fieldLabelWrapClass}>
        <div className="flex items-center gap-2 min-w-0">
          <Label className={`text-sm ${!included ? "text-muted-foreground" : ""}`}>
            {label}
          </Label>
          {showIncludeToggle && onIncludedChange && (
            <IncludeExcludeChip
              included={included}
              onIncludedChange={onIncludedChange}
            />
          )}
        </div>
      </div>
      {useSlider ? (
        <PercentageInput
          value={included ? value : 0}
          onChange={(v) => included && onValueChange(v)}
          min={sliderMin}
          max={sliderMax}
          decimalPlaces={decimalPlaces ?? 2}
          step={1}
          disabled={!included}
          warning={warning}
          placeholder="0"
        />
      ) : (
        <NumericInput className={fieldInputClass}
          value={included ? value : 0}
          onChange={onValueChange}
          placeholder="0"
          disabled={!included}
          warning={warning}
          decimalPlaces={decimalPlaces}
        />
      )}
      {/* Fixed height container to prevent layout bouncing */}
      <div className={`min-h-5 flex items-center ${fieldHelperWrapClass}`.trim()}>
        {currentValue !== undefined && currentValueLabel && (
          <p className="text-xs text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
            Current: <span className="font-medium text-foreground">{currentValue}{currentValueUnit}</span>
            {included && percentChange && (
              <span className="ml-1.5">
                &gt; <span className="font-medium text-primary">{value}{currentValueUnit}</span>
                <span className={`ml-1 font-medium ${value >= currentValue ? 'text-green-600' : 'text-red-600'}`}>
                  ({percentChange})
                </span>
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
};

export const ForterKPIConfig = ({ 
  kpis, 
  onUpdate, 
  selectedChallenges = {}, 
  customerInputs = {},
  segmentationEnabled = false,
  segments = [],
  onSegmentUpdate,
  focusTarget = null,
  onFocusHandled,
  viewMode = 'grid',
  forterBenchmarkSources = {},
  forterBenchmarkValues = {},
  suggested3DSFromPSD2 = null,
}: ForterKPIConfigProps) => {
  const ForterBenchmarkPill = ({ fieldId }: { fieldId: keyof ForterKPIs }) => {
    const tooltip = forterBenchmarkSources[fieldId];
    if (!tooltip) return null;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 cursor-help">
            Forter Benchmark
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    );
  };
  // Epsilon for comparing KPI values (avoids float noise; reset button works reliably)
  const KPI_EPS = 0.0001;
  const valuesEqual = (a: number | undefined, b: number | undefined) =>
    a === b || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < KPI_EPS);

  const ResetToBenchmarkButton = ({ fieldId }: { fieldId: keyof ForterKPIs }) => {
    const benchmarkValue = forterBenchmarkValues[fieldId];
    if (benchmarkValue === undefined || isSegmentMode) return null;
    const currentValue = kpis[fieldId as keyof typeof kpis];
    if (valuesEqual(typeof currentValue === 'number' ? currentValue : undefined, benchmarkValue)) return null;
    // Use exact benchmark value so stored value matches calculated benchmark (no rounding drift)
    const valueToSet = typeof benchmarkValue === 'number' ? benchmarkValue : Math.round(benchmarkValue * 10000) / 10000;
    const displayBenchmark = typeof benchmarkValue === 'number' ? benchmarkValue.toFixed(2) : String(benchmarkValue);
    const unit = ['chargebackReduction', 'approvalRateImprovement', 'preAuthApprovalImprovement', 'postAuthApprovalImprovement', 'threeDSReduction'].includes(fieldId) ? '%' : '';
    const handleReset = (e: React.MouseEvent | React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      updateKPI(fieldId, valueToSet);
    };
    const tooltipText = `Reset to Forter benchmark (${displayBenchmark}${unit})`;
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary"
        title={tooltipText}
        aria-label={tooltipText}
        onClick={handleReset}
        onPointerDown={handleReset}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    );
  };
  const gridClass = viewMode === 'list' ? 'grid grid-cols-1 gap-4' : 'grid md:grid-cols-2 gap-4';
  const fieldRowClass = viewMode === 'list' ? 'grid grid-cols-[1fr_minmax(18rem,22rem)] items-center gap-x-4 gap-y-1' : 'space-y-2';
  const fieldLabelWrapClass = viewMode === 'list' ? 'flex items-center gap-2 min-w-0' : 'flex items-center gap-2';
  const fieldLabelWrapWithChipClass = viewMode === 'list' ? 'flex items-center justify-between gap-2 min-w-0' : 'flex items-center justify-between gap-2';
  const fieldLabelClass = viewMode === 'list' ? 'min-w-0 text-sm' : 'text-sm';
  const fieldInputClass = viewMode === 'list' ? 'justify-self-end min-w-[14rem] max-w-[16rem] text-right' : '';
  const fieldHelperClass = viewMode === 'list' ? 'col-span-2 text-xs text-muted-foreground' : 'text-xs text-muted-foreground';
  const fieldHelperWrapClass = viewMode === 'list' ? 'col-span-2' : '';
  const [segmentModalOpen, setSegmentModalOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [abuseBenchmarksModalOpen, setAbuseBenchmarksModalOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const kpisRef = useRef(kpis);
  kpisRef.current = kpis;

  const updateKPI = useCallback((field: keyof ForterKPIs, value: number | boolean) => {
    const updates: Partial<ForterKPIs> = { [field]: value };
    if (field === 'chargebackReduction') {
      updates.chargebackReductionIsAbsolute = true;
      const bench = forterBenchmarkValues?.chargebackReduction;
      updates.chargebackReductionUserOverride = (typeof bench === 'number' && typeof value === 'number' && valuesEqual(value, bench)) ? false : true;
    } else if (field === 'approvalRateImprovement') {
      updates.approvalRateIsAbsolute = true;
      const bench = forterBenchmarkValues?.approvalRateImprovement;
      updates.approvalRateUserOverride = (typeof bench === 'number' && typeof value === 'number' && valuesEqual(value, bench)) ? false : true;
    } else if (field === 'preAuthApprovalImprovement') {
      updates.preAuthApprovalIsAbsolute = true;
      const bench = forterBenchmarkValues?.preAuthApprovalImprovement;
      updates.preAuthApprovalUserOverride = (typeof bench === 'number' && typeof value === 'number' && valuesEqual(value, bench)) ? false : true;
    } else if (field === 'postAuthApprovalImprovement') {
      updates.postAuthApprovalIsAbsolute = true;
      const bench = forterBenchmarkValues?.postAuthApprovalImprovement;
      updates.postAuthApprovalUserOverride = (typeof bench === 'number' && typeof value === 'number' && valuesEqual(value, bench)) ? false : true;
    } else if (field === 'threeDSReduction') {
      updates.threeDSReductionIsAbsolute = true;
      const bench = forterBenchmarkValues?.threeDSReduction;
      updates.threeDSRateUserOverride = (typeof bench === 'number' && typeof value === 'number' && valuesEqual(value, bench)) ? false : true;
    }
    onUpdate({ ...kpisRef.current, ...updates });
  }, [onUpdate, forterBenchmarkValues]);

  const challenge1 = selectedChallenges['1'] === true;
  const challenge2 = selectedChallenges['2'] === true;
  const challenge3 = selectedChallenges['3'] === true;
  const challenge4 = selectedChallenges['4'] === true;
  const challenge5 = selectedChallenges['5'] === true;
  const challenge7 = selectedChallenges['7'] === true;
  const challenge8 = selectedChallenges['8'] === true;
  const challenge9 = selectedChallenges['9'] === true;
  const challenge10 = selectedChallenges['10'] === true;
  const challenge11 = selectedChallenges['11'] === true;
  const challenge12 = selectedChallenges['12'] === true;
  const challenge13 = selectedChallenges['13'] === true;
  const challenge14 = selectedChallenges['14'] === true;
  const challenge15 = selectedChallenges['15'] === true;
  
  const show245KPIs = challenge2 || challenge4 || challenge5;
  const show10_11KPIs = challenge10 || challenge11;
  const show12_13KPIs = challenge12 || challenge13;
  const show14_15KPIs = challenge14 || challenge15;
  // Challenge 8 and 10/11 share abuse-related KPIs
  const showAbuseKPIs = challenge8 || show10_11KPIs;
  const showAnyKPIs = challenge1 || show245KPIs || challenge3 || challenge7 || showAbuseKPIs || challenge9 || show12_13KPIs || show14_15KPIs;
  
  // Check if payment/fraud challenges have segmentation
  const showPaymentChallenges = hasPaymentChallengesSelected(selectedChallenges);
  const isSegmentMode = segmentationEnabled && showPaymentChallenges && segments.length > 0;
  
  // Calculate aggregated KPIs from segments
  const aggregatedKPIs = useMemo(() => {
    if (!isSegmentMode) return null;
    return aggregateSegmentKPIs(segments, {
      approvalRateImprovement: kpis.approvalRateImprovement,
      preAuthApprovalImprovement: kpis.preAuthApprovalImprovement,
      postAuthApprovalImprovement: kpis.postAuthApprovalImprovement,
      chargebackReduction: kpis.chargebackReduction,
      threeDSReduction: kpis.threeDSReduction,
    });
  }, [isSegmentMode, segments, kpis]);
  
  const handleEditSegmentKPIs = useCallback((segment: Segment) => {
    setEditingSegment(segment);
    setSegmentModalOpen(true);
  }, []);
  
  const handleSaveSegmentKPIs = useCallback((segment: Segment) => {
    if (onSegmentUpdate) {
      onSegmentUpdate(segment);
    }
    setSegmentModalOpen(false);
    setEditingSegment(null);
  }, [onSegmentUpdate]);
  
  // Copy KPIs from first segment to all other segments
  const handleCopyFromFirst = useCallback(() => {
    if (!onSegmentUpdate || segments.length < 2) return;
    
    const firstSegment = segments[0];
    if (!firstSegment) return;
    
    segments.slice(1).forEach(segment => {
      if (segment.enabled) {
        onSegmentUpdate({
          ...segment,
          kpis: { ...firstSegment.kpis }
        });
      }
    });
  }, [segments, onSegmentUpdate]);

  // When focusTarget is set (e.g. from Value Summary performance highlight click), scroll to section and open modals
  useEffect(() => {
    if (!focusTarget) return;
    const container = scrollContainerRef.current;
    if (!container) {
      onFocusHandled?.();
      return;
    }
    const el = container.querySelector(`[data-forter-kpi-section="${focusTarget}"]`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      if (focusTarget === "abuse") {
        setAbuseBenchmarksModalOpen(true);
      }
    }
    onFocusHandled?.();
  }, [focusTarget, onFocusHandled]);

  if (!showAnyKPIs) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Please select challenges in the Challenges tab to see relevant Forter KPIs.</p>
      </div>
    );
  }

  return (
    <div ref={scrollContainerRef} className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Forter Performance Assumptions</h3>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUpdate(defaultForterKPIs)}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Defaults
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p className="text-sm">Reset all KPI targets to default values</p>
          </TooltipContent>
        </Tooltip>
      </div>
      
      {/* Segment KPI Editor - shown when segmentation is enabled for payment/fraud challenges */}
      {isSegmentMode && (
        <Card className="p-4 border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Layers className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">Segmented KPI Targets</p>
                <p className={fieldHelperClass}>
                  Configure Forter performance targets per segment. Payment/fraud KPIs below show weighted averages.
                </p>
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <p className="text-sm">
                  Each segment requires its own KPI targets.
                  Edit the first segment and use "Copy to Other Segments" to replicate settings.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          <div className={fieldRowClass}>
            {segments.filter(s => s.enabled).map((segment) => {
              const kpiStatus = getSegmentKPIStatus(segment);
              
              return (
                <div 
                  key={segment.id} 
                  className="flex items-center justify-between gap-4 p-3 bg-background rounded-lg border transition-transform duration-150 ease-out hover:scale-[1.01] active:scale-[0.98]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{segment.name}</p>
                    <p className={fieldHelperClass}>{kpiStatus}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleEditSegmentKPIs(segment)}
                  >
                    <Pencil className="h-3 w-3" />
                    Edit KPIs
                  </Button>
                </div>
              );
            })}
          </div>
          {/* Global Recovered AOV Multiplier - applies to all segments; visible in segment analysis for Reduce false declines / payment funnel */}
          {(challenge1 || show245KPIs) && (
            <div className="mt-4 pt-4 border-t border-border/60 space-y-2">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <Label className="text-sm font-medium">Recovered Order AOV Multiplier</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-help text-muted-foreground hover:text-foreground">
                      <Info className="h-4 w-4 shrink-0" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-sm">
                    <p className="text-xs">
                      Multiplier applied to the AOV of recovered transactions (e.g. those saved by reducing false declines). Set to 1.0× to be fully conservative. Default 1.15× reflects that higher-value transactions can face disproportionate friction. Applies to all segments.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[120px] max-w-[200px]">
                  <Slider
                    value={[kpis.recoveredAovMultiplier ?? 1.15]}
                    onValueChange={(v) => updateKPI("recoveredAovMultiplier", v[0])}
                    min={1}
                    max={2}
                    step={0.05}
                    className="w-full"
                  />
                </div>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={((kpis.recoveredAovMultiplier ?? 1.15)).toFixed(2)}
                  onChange={(e) => {
                    const parsed = parseFloat(e.target.value.replace(/[^0-9.]/g, ""));
                    if (!Number.isFinite(parsed)) return;
                    const clamped = Math.max(1, Math.min(2, parsed));
                    updateKPI("recoveredAovMultiplier", Number(clamped.toFixed(2)));
                  }}
                  className="w-20 text-right shrink-0"
                />
                <span className="text-sm text-muted-foreground shrink-0">×</span>
              </div>
              <p className={fieldHelperClass}>
                Baseline AOV × {(kpis.recoveredAovMultiplier ?? 1.15).toFixed(2)}× on recovered transactions
                {(kpis.recoveredAovMultiplier ?? 1.15) !== 1 && (
                  <span className="ml-1 font-medium text-primary">
                    ({((kpis.recoveredAovMultiplier ?? 1.15) - 1) * 100 > 0 ? '+' : ''}{(((kpis.recoveredAovMultiplier ?? 1.15) - 1) * 100).toFixed(0)}%)
                  </span>
                )}
              </p>
            </div>
          )}
        </Card>
      )}
      
      {/* Segment KPI Modal */}
      <ForterKPISegmentModal
        open={segmentModalOpen}
        onOpenChange={setSegmentModalOpen}
        segment={editingSegment}
        onSave={handleSaveSegmentKPIs}
        selectedChallenges={selectedChallenges}
        globalKPIs={kpis}
        segments={segments}
        onCopyFromFirst={handleCopyFromFirst}
        existingFraudVendor={customerInputs?.existingFraudVendor}
        baseCurrency={customerInputs?.baseCurrency}
      />
      
      {(challenge1 && !show245KPIs) && (
        <Card className="p-4 space-y-4" data-forter-kpi-section="c1">
          <h4 className="font-medium text-primary">False Fraud Declines</h4>
          <div className={gridClass}>
            <div className={fieldRowClass}>
              <div className={fieldLabelWrapClass}>
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <Label className={fieldLabelClass}>Target Fraud Approval Rate (%)</Label>
                  {!isSegmentMode && <ForterBenchmarkPill fieldId="approvalRateImprovement" />}
                </div>
                {isSegmentMode && (
                  <WeightedAverageTooltipKPI
                    segments={segments}
                    fieldLabel="Target Fraud Approval Rate"
                    getKPIValue={(s) => s.kpis.approvalRateTarget}
                    weightedValue={aggregatedKPIs?.weightedApprovalRateTarget}
                  />
                )}
              </div>
              <div className="flex items-center gap-2">
                <PercentageInput
                  key={isSegmentMode ? 'agg-approval' : 'approval-improvement'}
                  className={fieldInputClass}
                  value={isSegmentMode ? (aggregatedKPIs?.weightedApprovalRateTarget ?? 0) : kpis.approvalRateImprovement}
                  onChange={(v) => updateKPI("approvalRateImprovement", v)}
                  readOnly={isSegmentMode}
                  warning={!isSegmentMode ? getValidationWarning("approvalRateImprovement", kpis.approvalRateImprovement) : null}
                  decimalPlaces={2}
                />
                {!isSegmentMode && <ResetToBenchmarkButton fieldId="approvalRateImprovement" />}
              </div>
              {!isSegmentMode && customerInputs.amerPreAuthApprovalRate !== undefined && (() => {
                const currentRate = customerInputs.amerPreAuthApprovalRate;
                const targetRate = kpis.approvalRateImprovement;
                const pctImprovement = currentRate > 0 && targetRate !== currentRate
                  ? (((targetRate - currentRate) / currentRate) * 100).toFixed(1)
                  : null;
                return (
                  <p className={fieldHelperClass}>
                    Current: <span className="font-medium text-foreground">{currentRate}%</span>
                    {targetRate !== undefined && targetRate !== currentRate && (
                      <span className="ml-1">
                        &gt; <span className="font-medium text-primary">{targetRate}%</span>
                        {pctImprovement != null && (
                          <span className={`ml-1 font-medium ${Number(pctImprovement) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ({Number(pctImprovement) > 0 ? '+' : ''}{pctImprovement}%)
                          </span>
                        )}
                      </span>
                    )}
                  </p>
                );
              })()}
            </div>
            <div className={fieldRowClass}>
              <div className={fieldLabelWrapClass}>
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <Label className={fieldLabelClass}>Target Fraud CB Rate (%)</Label>
                  {!isSegmentMode && <ForterBenchmarkPill fieldId="chargebackReduction" />}
                </div>
                {isSegmentMode && (
                  <WeightedAverageTooltipKPI
                    segments={segments}
                    fieldLabel="Target Fraud CB Rate"
                    getKPIValue={(s) => s.kpis.chargebackRateTarget}
                    weightedValue={aggregatedKPIs?.weightedChargebackRateTarget}
                  />
                )}
              </div>
              <div className="flex items-center gap-2">
                <PercentageInput
                  key={isSegmentMode ? 'agg-cb' : 'cb-reduction'}
                  className={fieldInputClass}
                  value={isSegmentMode ? (aggregatedKPIs?.weightedChargebackRateTarget ?? 0) : kpis.chargebackReduction}
                  onChange={(v) => updateKPI("chargebackReduction", v)}
                  readOnly={isSegmentMode}
                  warning={!isSegmentMode ? getValidationWarning("chargebackReduction", kpis.chargebackReduction) : null}
                  decimalPlaces={2}
                  max={10}
                  step={0.01}
                />
                {!isSegmentMode && <ResetToBenchmarkButton fieldId="chargebackReduction" />}
              </div>
              {customerInputs.fraudCBRate !== undefined && (() => {
                const currentCBRate = customerInputs.fraudCBRate;
                const targetCBRate = isSegmentMode ? (aggregatedKPIs?.weightedChargebackRateTarget ?? 0) : kpis.chargebackReduction;
                const improvement = currentCBRate - targetCBRate;
                const pctReduction = currentCBRate > 0 ? ((improvement / currentCBRate) * 100).toFixed(1) : null;
                return (
                  <p className={fieldHelperClass}>
                    Current: <span className="font-medium text-foreground">{currentCBRate}%</span>
                    {targetCBRate !== undefined && targetCBRate !== currentCBRate && pctReduction != null && (
                      <span className="ml-1">
                        → <span className="font-medium text-primary">{targetCBRate.toFixed(2)}%</span>
                        <span className={`ml-1 font-medium ${improvement > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ({improvement > 0 ? '-' : '+'}{Math.abs(Number(pctReduction))}%)
                        </span>
                      </span>
                    )}
                  </p>
                );
              })()}
            </div>
            {/* Recovered Order AOV Multiplier - used for deduplication value in both c1 and c245 */}
            <div className={fieldRowClass}>
              <div className={fieldLabelWrapClass}>
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <Label className={fieldLabelClass}>Recovered Order AOV Multiplier</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex cursor-help text-muted-foreground hover:text-foreground">
                        <Info className="h-4 w-4 shrink-0" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-sm">
                      <p className="text-xs">
                        Multiplier applied to the AOV of recovered transactions (e.g. those saved by reducing false declines). Set to 1.0× to be fully conservative. Default 1.15× reflects that higher-value transactions can face disproportionate friction.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full mt-2">
                <div className="flex-1 min-w-0">
                  <Slider
                    value={[kpis.recoveredAovMultiplier ?? 1.15]}
                    onValueChange={(v) => updateKPI("recoveredAovMultiplier", v[0])}
                    min={1}
                    max={2}
                    step={0.05}
                    className="w-full"
                  />
                </div>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={((kpis.recoveredAovMultiplier ?? 1.15)).toFixed(2)}
                  onChange={(e) => {
                    const parsed = parseFloat(e.target.value.replace(/[^0-9.]/g, ""));
                    if (!Number.isFinite(parsed)) return;
                    const clamped = Math.max(1, Math.min(2, parsed));
                    updateKPI("recoveredAovMultiplier", Number(clamped.toFixed(2)));
                  }}
                  className="w-20 text-right shrink-0"
                />
                <span className="text-sm text-muted-foreground shrink-0">×</span>
              </div>
              <p className={fieldHelperClass + " mt-1"}>
                Baseline AOV × {(kpis.recoveredAovMultiplier ?? 1.15).toFixed(2)}× on recovered transactions
                {(kpis.recoveredAovMultiplier ?? 1.15) !== 1 && (
                  <span className="ml-1 font-medium text-primary">
                    ({((kpis.recoveredAovMultiplier ?? 1.15) - 1) * 100 > 0 ? '+' : ''}{(((kpis.recoveredAovMultiplier ?? 1.15) - 1) * 100).toFixed(0)}%)
                  </span>
                )}
              </p>
            </div>
          </div>
        </Card>
      )}
      
      {show245KPIs && (() => {
        // Calculate AOV for display
        const gmv = customerInputs.amerAnnualGMV || 0;
        const attempts = customerInputs.amerGrossAttempts || 0;
        const aov = attempts > 0 ? gmv / attempts : 0;
        const currency = customerInputs.baseCurrency || 'USD';
        const formattedAOV = aov > 0 
          ? new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(aov)
          : null;
        
        return (
        <Card className="p-4 space-y-4" data-forter-kpi-section="c245">
          <div className="flex items-center gap-3 flex-wrap">
            <h4 className="font-medium text-primary">Fraud Detection & 3DS</h4>
            {formattedAOV && (
              <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                AOV: {formattedAOV}
              </span>
            )}
            {suggested3DSFromPSD2 && suggested3DSFromPSD2.rate > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 cursor-help">
                    Suggested PSD2 3DS rate: {suggested3DSFromPSD2.rate}%
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs">{suggested3DSFromPSD2.reason}</p>
                </TooltipContent>
              </Tooltip>
            )}
            {isSegmentMode && (
              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                Forter KPIs (weighted avg): {aggregatedKPIs?.weightedPreAuthApprovalTarget?.toFixed(1)}% pre-auth fraud approval, {aggregatedKPIs?.weightedThreeDSRateTarget?.toFixed(1)}% 3DS, {aggregatedKPIs?.weightedChargebackRateTarget?.toFixed(2)}% fraud CB
              </span>
            )}
          </div>
          <div className={gridClass}>
            {/* Fraud approval rate */}
            <div className={fieldRowClass}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Label className={`text-sm ${!isSegmentMode && kpis.preAuthIncluded === false ? "text-muted-foreground" : ""}`}>
                    Target Pre-Auth Fraud Approval Rate (%)
                  </Label>
                  {!isSegmentMode && <ForterBenchmarkPill fieldId="preAuthApprovalImprovement" />}
                  {isSegmentMode && (
                    <WeightedAverageTooltipKPI
                      segments={segments}
                      fieldLabel="Target Pre-Auth Fraud Approval Rate"
                      getKPIValue={(s) => s.kpis.preAuthApprovalTarget}
                      weightedValue={aggregatedKPIs?.weightedPreAuthApprovalTarget}
                    />
                  )}
                </div>
                {!isSegmentMode && (
                  <IncludeExcludeChip
                    included={kpis.preAuthIncluded !== false}
                    onIncludedChange={(v) => updateKPI("preAuthIncluded", v)}
                  />
                )}
              </div>
              <div className="flex items-center gap-2">
                <PercentageInput
                  key={isSegmentMode ? 'agg-preAuth' : 'preAuth-improvement'}
                  className={fieldInputClass}
                  value={isSegmentMode 
                    ? (aggregatedKPIs?.weightedPreAuthApprovalTarget ?? 0)
                    : (kpis.preAuthIncluded === false ? 100 : kpis.preAuthApprovalImprovement)}
                  onChange={(v) => updateKPI("preAuthApprovalImprovement", v)}
                  readOnly={isSegmentMode}
                  disabled={!isSegmentMode && kpis.preAuthIncluded === false}
                  warning={!isSegmentMode && kpis.preAuthIncluded !== false ? getValidationWarning("preAuthApprovalImprovement", kpis.preAuthApprovalImprovement) : null}
                  decimalPlaces={2}
                />
                {!isSegmentMode && kpis.preAuthIncluded !== false && <ResetToBenchmarkButton fieldId="preAuthApprovalImprovement" />}
              </div>
              {(kpis.preAuthIncluded !== false || isSegmentMode) && customerInputs.amerPreAuthApprovalRate !== undefined && (() => {
                const currentRate = customerInputs.amerPreAuthApprovalRate;
                const targetRate = isSegmentMode 
                  ? (aggregatedKPIs?.weightedPreAuthApprovalTarget ?? 0) 
                  : kpis.preAuthApprovalImprovement;
                const improvement = targetRate - currentRate;
                const improvementPct = currentRate > 0 ? ((improvement / currentRate) * 100).toFixed(1) : '0';
                return (
                  <p className={fieldHelperClass}>
                    Current: <span className="font-medium text-foreground">{currentRate}%</span>
                    {targetRate !== undefined && targetRate !== currentRate && (
                      <span className="ml-1">
                        &gt; <span className="font-medium text-primary">{targetRate}%</span>
                        <span className={`ml-1 font-medium ${improvement > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ({improvement > 0 ? '+' : ''}{improvementPct}%)
                        </span>
                      </span>
                    )}
                  </p>
                );
              })()}
            </div>
            
            {/* Post-Auth Approval Rate */}
            <div className={fieldRowClass}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Label className={`text-sm ${!isSegmentMode && kpis.postAuthIncluded === false ? "text-muted-foreground" : ""}`}>
                    Target Post-Auth Fraud Approval Rate (%)
                  </Label>
                  {!isSegmentMode && <ForterBenchmarkPill fieldId="postAuthApprovalImprovement" />}
                  {isSegmentMode && (
                    <WeightedAverageTooltipKPI
                      segments={segments}
                      fieldLabel="Target Post-Auth Approval Rate"
                      getKPIValue={(s) => s.kpis.postAuthApprovalTarget}
                      weightedValue={aggregatedKPIs?.weightedPostAuthApprovalTarget}
                    />
                  )}
                </div>
                {!isSegmentMode && (
                  <IncludeExcludeChip
                    included={kpis.postAuthIncluded !== false}
                    onIncludedChange={(v) => updateKPI("postAuthIncluded", v)}
                  />
                )}
              </div>
              <div className="flex items-center gap-2">
                <PercentageInput
                  key={isSegmentMode ? 'agg-postAuth' : 'postAuth-improvement'}
                  className={fieldInputClass}
                  value={isSegmentMode 
                    ? (aggregatedKPIs?.weightedPostAuthApprovalTarget ?? 0)
                    : (kpis.postAuthIncluded === false ? 100 : kpis.postAuthApprovalImprovement)}
                  onChange={(v) => updateKPI("postAuthApprovalImprovement", v)}
                  readOnly={isSegmentMode}
                  disabled={!isSegmentMode && kpis.postAuthIncluded === false}
                  warning={!isSegmentMode && kpis.postAuthIncluded !== false ? getValidationWarning("postAuthApprovalImprovement", kpis.postAuthApprovalImprovement) : null}
                  decimalPlaces={2}
                />
                {!isSegmentMode && kpis.postAuthIncluded !== false && <ResetToBenchmarkButton fieldId="postAuthApprovalImprovement" />}
              </div>
              {(kpis.postAuthIncluded !== false || isSegmentMode) && customerInputs.amerPostAuthApprovalRate !== undefined && (() => {
                const currentRate = customerInputs.amerPostAuthApprovalRate;
                const targetRate = isSegmentMode 
                  ? (aggregatedKPIs?.weightedPostAuthApprovalTarget ?? 0) 
                  : kpis.postAuthApprovalImprovement;
                const improvement = targetRate - currentRate;
                const improvementPct = currentRate > 0 ? ((improvement / currentRate) * 100).toFixed(1) : '0';
                return (
                  <p className={fieldHelperClass}>
                    Current: <span className="font-medium text-foreground">{currentRate}%</span>
                    {targetRate !== undefined && targetRate !== currentRate && (
                      <span className="ml-1">
                        &gt; <span className="font-medium text-primary">{targetRate}%</span>
                        <span className={`ml-1 font-medium ${improvement > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ({improvement > 0 ? '+' : ''}{improvementPct}%)
                        </span>
                      </span>
                    )}
                  </p>
                );
              })()}
            </div>
            
            {/* 3DS Rate */}
            <div className={fieldRowClass}>
              <div className={fieldLabelWrapClass}>
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <Label className={fieldLabelClass}>Target Challenge 3DS Rate (%)</Label>
                  {!isSegmentMode && <ForterBenchmarkPill fieldId="threeDSReduction" />}
                </div>
                {isSegmentMode && (
                  <WeightedAverageTooltipKPI
                    segments={segments}
                    fieldLabel="Target Challenge 3DS Rate"
                    getKPIValue={(s) => s.kpis.threeDSRateTarget}
                    weightedValue={aggregatedKPIs?.weightedThreeDSRateTarget}
                  />
                )}
              </div>
              <div className="flex items-center gap-2">
                <PercentageInput
                  key={isSegmentMode ? 'agg-3ds' : '3ds-reduction'}
                  className={fieldInputClass}
                  value={isSegmentMode ? (aggregatedKPIs?.weightedThreeDSRateTarget ?? 0) : kpis.threeDSReduction}
                  onChange={(v) => updateKPI("threeDSReduction", v)}
                  readOnly={isSegmentMode}
                  warning={!isSegmentMode ? getValidationWarning("threeDSReduction", kpis.threeDSReduction) : null}
                  decimalPlaces={2}
                />
                {!isSegmentMode && <ResetToBenchmarkButton fieldId="threeDSReduction" />}
              </div>
              {customerInputs.amer3DSChallengeRate !== undefined && (() => {
                const currentRate = customerInputs.amer3DSChallengeRate;
                const targetRate = isSegmentMode 
                  ? (aggregatedKPIs?.weightedThreeDSRateTarget ?? 0) 
                  : kpis.threeDSReduction;
                const improvement = currentRate - targetRate; // For 3DS, reduction is positive
                const improvementPct = currentRate > 0 ? ((improvement / currentRate) * 100).toFixed(1) : '0';
                return (
                  <p className={fieldHelperClass}>
                    Current: <span className="font-medium text-foreground">{currentRate}%</span>
                    {targetRate !== undefined && targetRate !== currentRate && (
                      <span className="ml-1">
                        &gt; <span className="font-medium text-primary">{targetRate}%</span>
                        <span className={`ml-1 font-medium ${improvement > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ({improvement > 0 ? '-' : '+'}{Math.abs(Number(improvementPct))}%)
                        </span>
                      </span>
                    )}
                  </p>
                );
              })()}
            </div>
            
            {/* CB Rate */}
            <div className={fieldRowClass}>
              <div className={fieldLabelWrapClass}>
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <Label className={fieldLabelClass}>Target Fraud CB Rate (%)</Label>
                  {!isSegmentMode && <ForterBenchmarkPill fieldId="chargebackReduction" />}
                </div>
                {isSegmentMode && (
                  <WeightedAverageTooltipKPI
                    segments={segments}
                    fieldLabel="Target Fraud CB Rate"
                    getKPIValue={(s) => s.kpis.chargebackRateTarget}
                    weightedValue={aggregatedKPIs?.weightedChargebackRateTarget}
                  />
                )}
              </div>
              <div className="flex items-center gap-2">
                <PercentageInput
                  key={isSegmentMode ? 'agg-cb' : 'cb-reduction'}
                  className={fieldInputClass}
                  value={isSegmentMode ? (aggregatedKPIs?.weightedChargebackRateTarget ?? 0) : kpis.chargebackReduction}
                  onChange={(v) => updateKPI("chargebackReduction", v)}
                  readOnly={isSegmentMode}
                  warning={!isSegmentMode ? getValidationWarning("chargebackReduction", kpis.chargebackReduction) : null}
                  decimalPlaces={2}
                  max={10}
                  step={0.01}
                />
                {!isSegmentMode && <ResetToBenchmarkButton fieldId="chargebackReduction" />}
              </div>
              {customerInputs.fraudCBRate !== undefined && (() => {
                const currentCBRate = customerInputs.fraudCBRate;
                const targetCBRate = isSegmentMode ? (aggregatedKPIs?.weightedChargebackRateTarget ?? 0) : kpis.chargebackReduction;
                const improvement = currentCBRate - targetCBRate;
                const improvementPct = currentCBRate > 0 ? ((improvement / currentCBRate) * 100).toFixed(1) : '0';
                return (
                  <p className={fieldHelperClass}>
                    Current: <span className="font-medium text-foreground">{currentCBRate}%</span>
                    {targetCBRate !== undefined && targetCBRate !== currentCBRate && (
                      <span className="ml-1">
                        &gt; <span className="font-medium text-primary">{targetCBRate.toFixed(2)}%</span>
                        <span className={`ml-1 font-medium ${improvement > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ({improvement > 0 ? '-' : '+'}{Math.abs(Number(improvementPct))}%)
                        </span>
                      </span>
                    )}
                  </p>
                );
              })()}
            </div>
            
            {/* Recovered Order AOV Multiplier - full-width row */}
            <div className={fieldRowClass + " col-span-full"}>
              <div className={fieldLabelWrapClass}>
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <Label className={fieldLabelClass}>Recovered Order AOV Multiplier</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex cursor-help text-muted-foreground hover:text-foreground">
                        <Info className="h-4 w-4 shrink-0" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-sm">
                      <p className="text-xs">
                        Multiplier applied to the AOV of recovered transactions (those saved by reducing 3DS challenges and issuing bank declines). Set to 1.0× to be fully conservative. Default 1.15× reflects that higher-value transactions face disproportionate authentication friction.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full mt-2">
                <div className="flex-1 min-w-0">
                  <Slider
                    value={[kpis.recoveredAovMultiplier ?? 1.15]}
                    onValueChange={(v) => updateKPI("recoveredAovMultiplier", v[0])}
                    min={1}
                    max={2}
                    step={0.05}
                    className="w-full"
                  />
                </div>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={((kpis.recoveredAovMultiplier ?? 1.15)).toFixed(2)}
                  onChange={(e) => {
                    const parsed = parseFloat(e.target.value.replace(/[^0-9.]/g, ""));
                    if (!Number.isFinite(parsed)) return;
                    const clamped = Math.max(1, Math.min(2, parsed));
                    updateKPI("recoveredAovMultiplier", Number(clamped.toFixed(2)));
                  }}
                  className="w-20 text-right shrink-0"
                />
                <span className="text-sm text-muted-foreground shrink-0">×</span>
              </div>
              <p className={fieldHelperClass + " mt-1"}>
                Baseline AOV × {(kpis.recoveredAovMultiplier ?? 1.15).toFixed(2)}× on recovered transactions
                {(kpis.recoveredAovMultiplier ?? 1.15) !== 1 && (
                  <span className="ml-1 font-medium text-primary">
                    ({((kpis.recoveredAovMultiplier ?? 1.15) - 1) * 100 > 0 ? '+' : ''}{(((kpis.recoveredAovMultiplier ?? 1.15) - 1) * 100).toFixed(0)}%)
                  </span>
                )}
              </p>
            </div>
          </div>
        </Card>
        );
      })()}
      
      {challenge3 && (
        <Card className="p-4 space-y-4" data-forter-kpi-section="manual-review">
          <h4 className="font-medium text-primary">Manual Review Reduction</h4>
          <div className={gridClass}>
            <KPIInputRow
              fieldRowClass={fieldRowClass}
              fieldLabelWrapClass={fieldLabelWrapWithChipClass}
              fieldHelperWrapClass={fieldHelperWrapClass}
              fieldInputClass={fieldInputClass}
              label="Target Review Rate (%)"
              value={kpis.manualReviewReduction}
              onValueChange={(v) => updateKPI("manualReviewReduction", v)}
              currentValue={customerInputs.manualReviewPct}
              currentValueLabel="Manual Review Rate"
              fieldName="manualReviewReduction"
              decimalPlaces={2}
            />
            <KPIInputRow
              fieldRowClass={fieldRowClass}
              fieldLabelWrapClass={fieldLabelWrapWithChipClass}
              fieldHelperWrapClass={fieldHelperWrapClass}
              fieldInputClass={fieldInputClass}
              label="Target Time (min)"
              value={kpis.reviewTimeReduction}
              onValueChange={(v) => updateKPI("reviewTimeReduction", v)}
              currentValue={customerInputs.timePerReview}
              currentValueLabel="Time per Review"
              currentValueUnit=" min"
            />
          </div>
        </Card>
      )}
      
      {challenge7 && (
        <Card className="p-4 space-y-4" data-forter-kpi-section="disputes">
          <h4 className="font-medium text-primary">Chargeback Disputes</h4>
          <div className={gridClass}>
            <KPIInputRow
              fieldRowClass={fieldRowClass}
              fieldLabelWrapClass={fieldLabelWrapWithChipClass}
              fieldHelperWrapClass={fieldHelperWrapClass}
              fieldInputClass={fieldInputClass}
              label="Target Fraud Dispute Rate (%)"
              value={kpis.fraudDisputeRateImprovement}
              onValueChange={(v) => updateKPI("fraudDisputeRateImprovement", v)}
              currentValue={customerInputs.fraudDisputeRate}
              currentValueLabel="Fraud Dispute Rate"
              fieldName="fraudDisputeRateImprovement"
              decimalPlaces={2}
              useSlider
              sliderMin={0}
              sliderMax={100}
            />
            <KPIInputRow
              fieldRowClass={fieldRowClass}
              fieldLabelWrapClass={fieldLabelWrapWithChipClass}
              fieldHelperWrapClass={fieldHelperWrapClass}
              fieldInputClass={fieldInputClass}
              label="Target Fraud Win Rate (%)"
              value={kpis.fraudWinRateChange}
              onValueChange={(v) => updateKPI("fraudWinRateChange", v)}
              currentValue={customerInputs.fraudWinRate}
              currentValueLabel="Fraud Win Rate"
              fieldName="fraudWinRateChange"
              decimalPlaces={2}
              useSlider
              sliderMin={0}
              sliderMax={100}
            />
            <KPIInputRow
              fieldRowClass={fieldRowClass}
              fieldLabelWrapClass={fieldLabelWrapWithChipClass}
              fieldHelperWrapClass={fieldHelperWrapClass}
              fieldInputClass={fieldInputClass}
              label="Target Service Dispute Rate (%)"
              value={kpis.serviceDisputeRateImprovement}
              onValueChange={(v) => updateKPI("serviceDisputeRateImprovement", v)}
              currentValue={customerInputs.serviceDisputeRate}
              currentValueLabel="Service Dispute Rate"
              fieldName="serviceDisputeRateImprovement"
              decimalPlaces={2}
              useSlider
              sliderMin={0}
              sliderMax={100}
            />
            <KPIInputRow
              fieldRowClass={fieldRowClass}
              fieldLabelWrapClass={fieldLabelWrapWithChipClass}
              fieldHelperWrapClass={fieldHelperWrapClass}
              fieldInputClass={fieldInputClass}
              label="Target Service Win Rate (%)"
              value={kpis.serviceWinRateChange}
              onValueChange={(v) => updateKPI("serviceWinRateChange", v)}
              currentValue={customerInputs.serviceWinRate}
              currentValueLabel="Service Win Rate"
              fieldName="serviceWinRateChange"
              decimalPlaces={2}
              useSlider
              sliderMin={0}
              sliderMax={100}
            />
            <div className={fieldRowClass}>
              <Label className={fieldLabelClass}>Target Time to Review CB (mins)</Label>
              <NumericInput className={fieldInputClass} 
                value={kpis.disputeTimeReduction} 
                onChange={(v) => updateKPI("disputeTimeReduction", v)} 
                placeholder="5"
              />
              <div className="min-h-5 flex items-center">
                {(() => {
                  const currentTime = customerInputs?.avgTimeToReviewCB ?? 20;
                  const targetTime = kpis.disputeTimeReduction ?? 5;
                  const percentChange = currentTime > 0 ? ((targetTime - currentTime) / currentTime) * 100 : 0;
                  const sign = percentChange >= 0 ? '+' : '';
                  const isReduction = targetTime < currentTime;
                  return (
                    <p className="text-xs text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                      Current: <span className="font-medium text-foreground">{currentTime} mins</span>
                      <span className="ml-1.5">
                        → <span className="font-medium text-primary">{targetTime} mins</span>
                        <span className={`ml-1 font-medium ${isReduction ? 'text-green-600' : 'text-red-600'}`}>
                          ({sign}{percentChange.toFixed(1)}%)
                        </span>
                      </span>
                    </p>
                  );
                })()}
              </div>
            </div>
          </div>
        </Card>
      )}

      {showAbuseKPIs && (
        <Card className="p-4 space-y-4" data-forter-kpi-section="abuse">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-primary">
              {challenge8 && show10_11KPIs 
                ? 'Policy & Promotion Abuse Prevention' 
                : challenge8 
                  ? 'Policy Abuse Prevention' 
                  : 'Promotion Abuse Prevention'}
            </h4>
            <AbuseBenchmarksModal
              benchmarks={kpis.abuseBenchmarks ? { ...defaultAbuseBenchmarks, ...kpis.abuseBenchmarks } : defaultAbuseBenchmarks}
              onUpdate={(benchmarks) => onUpdate({ ...kpis, abuseBenchmarks: { ...defaultAbuseBenchmarks, ...benchmarks } })}
              open={abuseBenchmarksModalOpen}
              onOpenChange={setAbuseBenchmarksModalOpen}
            />
          </div>
          <div className={gridClass}>
            <div className={fieldRowClass}>
              <Label className={fieldLabelClass}>Forter Catch Rate (%)</Label>
              <NumericInput className={fieldInputClass} 
                value={kpis.forterCatchRate} 
                onChange={(v) => updateKPI("forterCatchRate", v)} 
                placeholder="90"
                decimalPlaces={2}
                warning={getValidationWarning("forterCatchRate", kpis.forterCatchRate)}
              />
            </div>
            <div className={fieldRowClass}>
              <Label className={fieldLabelClass}>Abuse AoV Multiplier (x)</Label>
              <NumericInput className={fieldInputClass} 
                value={kpis.abuseAovMultiplier} 
                onChange={(v) => updateKPI("abuseAovMultiplier", v)} 
                placeholder="1.5" 
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Advanced abuse assumptions (including promotion abuse % of GMV) are configured via the button above.
          </p>
        </Card>
      )}

      {challenge9 && (
        <Card className="p-4 space-y-4" data-forter-kpi-section="instant-refunds">
          <h4 className="font-medium text-primary">Instant Refunds</h4>
          <div className={gridClass}>
            <div className={fieldRowClass}>
              <Label className={fieldLabelClass}>NPS Increase from Instant Refunds</Label>
              <NumericInput className={fieldInputClass} 
                value={kpis.npsIncreaseFromInstantRefunds} 
                onChange={(v) => updateKPI("npsIncreaseFromInstantRefunds", v)} 
                placeholder="10"
              />
              <p className={fieldHelperClass}>Expected NPS point increase</p>
            </div>
            <div className={fieldRowClass}>
              <Label className={fieldLabelClass}>LSE NPS Benchmark (%)</Label>
              <NumericInput className={fieldInputClass} 
                value={kpis.lseNPSBenchmark} 
                onChange={(v) => updateKPI("lseNPSBenchmark", v)} 
                placeholder="1"
                decimalPlaces={2}
              />
              <p className={fieldHelperClass}>Revenue increase per 7 NPS points</p>
            </div>
            <div className={fieldRowClass}>
              <Label className={fieldLabelClass}>Forter CS Contact Reduction (%)</Label>
              <NumericInput className={fieldInputClass} 
                value={kpis.forterCSReduction} 
                onChange={(v) => updateKPI("forterCSReduction", v)} 
                placeholder="78"
                decimalPlaces={2}
                warning={getValidationWarning("forterCSReduction", kpis.forterCSReduction)}
              />
              <p className={fieldHelperClass}>Reduction in CS tickets from instant refunds</p>
            </div>
          </div>
        </Card>
      )}

      {show12_13KPIs && (
        <Card className="p-4 space-y-4" data-forter-kpi-section="ato">
          <h4 className="font-medium text-primary">Account Takeover (ATO) Protection</h4>
          <div className={gridClass}>
            <div className={fieldRowClass}>
              <Label className={fieldLabelClass}>% of Fraudulent Logins (%)</Label>
              <NumericInput className={fieldInputClass} 
                value={kpis.pctFraudulentLogins} 
                onChange={(v) => updateKPI("pctFraudulentLogins", v)} 
                placeholder="1"
                decimalPlaces={2}
              />
            </div>
            <div className={fieldRowClass}>
              <Label className={fieldLabelClass}>Churn Likelihood from ATO (%)</Label>
              <NumericInput className={fieldInputClass} 
                value={kpis.churnLikelihoodFromATO} 
                onChange={(v) => updateKPI("churnLikelihoodFromATO", v)} 
                placeholder="50"
                decimalPlaces={2}
                warning={getValidationWarning("churnLikelihoodFromATO", kpis.churnLikelihoodFromATO)}
              />
            </div>
            <div className={fieldRowClass}>
              <Label className={fieldLabelClass}>ATO Catch Rate (%)</Label>
              <NumericInput className={fieldInputClass} 
                value={kpis.atoCatchRate} 
                onChange={(v) => updateKPI("atoCatchRate", v)} 
                placeholder="90"
                decimalPlaces={2}
                warning={getValidationWarning("atoCatchRate", kpis.atoCatchRate)}
              />
            </div>
          </div>
        </Card>
      )}

      {show14_15KPIs && (
        <Card className="p-4 space-y-4" data-forter-kpi-section="signup">
          <h4 className="font-medium text-primary">Sign-up Protection</h4>
          <div className={gridClass}>
            <div className={fieldRowClass}>
              <Label className={fieldLabelClass}>% of Fraudulent Sign-ups (%)</Label>
              <NumericInput className={fieldInputClass} 
                value={kpis.pctFraudulentSignups} 
                onChange={(v) => updateKPI("pctFraudulentSignups", v)} 
                placeholder="10"
                decimalPlaces={2}
              />
            </div>
            <div className={fieldRowClass}>
              <Label className={fieldLabelClass}>Forter Fraudulent Sign-up Reduction (%)</Label>
              <NumericInput className={fieldInputClass} 
                value={kpis.forterFraudulentSignupReduction} 
                onChange={(v) => updateKPI("forterFraudulentSignupReduction", v)} 
                placeholder="95"
                decimalPlaces={2}
                warning={getValidationWarning("forterFraudulentSignupReduction", kpis.forterFraudulentSignupReduction)}
              />
            </div>
            <div className={fieldRowClass}>
              <Label className={fieldLabelClass}>Forter KYC Reduction (%)</Label>
              <NumericInput className={fieldInputClass} 
                value={kpis.forterKYCReduction} 
                onChange={(v) => updateKPI("forterKYCReduction", v)} 
                placeholder="80"
                decimalPlaces={2}
                warning={getValidationWarning("forterKYCReduction", kpis.forterKYCReduction)}
              />
              <p className={fieldHelperClass}>Reduction in KYC checks needed</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
