import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge"; // Keep for 3DS suggested badge
import { PercentageInput } from "@/components/calculator/PercentageInput";
import { IncludeExcludeChip } from "@/components/calculator/IncludeExcludeChip";
import { Segment, SegmentKPIs } from "@/lib/segments";
import { ForterKPIs } from "./ForterKPIConfig";
import { Copy, Info, RotateCcw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { get3DSRateByCountryAndAOV, getVendorCBReductionFactor, getCurrencySymbol } from "@/lib/benchmarkData";

interface ForterKPISegmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segment: Segment | null;
  onSave: (segment: Segment) => void;
  selectedChallenges: { [key: string]: boolean };
  globalKPIs: ForterKPIs;
  // For copy functionality
  segments?: Segment[];
  onCopyFromFirst?: () => void;
  // For lookup logic
  existingFraudVendor?: string;
  baseCurrency?: string;
}

export function ForterKPISegmentModal({
  open,
  onOpenChange,
  segment,
  onSave,
  selectedChallenges,
  globalKPIs,
  segments = [],
  onCopyFromFirst,
  existingFraudVendor,
  baseCurrency = 'USD',
}: ForterKPISegmentModalProps) {
  const [editedSegment, setEditedSegment] = React.useState<Segment | null>(null);
  
  // Determine which challenges are selected
  const isChallenge1Selected = selectedChallenges['1'] === true;
  const isChallenge2Selected = selectedChallenges['2'] === true;
  const isChallenge4Selected = selectedChallenges['4'] === true;
  const isChallenge5Selected = selectedChallenges['5'] === true;
  const isChallenge245Selected = isChallenge2Selected || isChallenge4Selected || isChallenge5Selected;
  
  // Check if this is the first segment (for showing copy button)
  const isFirstSegment = segment && segments.length > 0 && segments[0]?.id === segment.id;
  const hasMultipleSegments = segments.filter(s => s.enabled).length > 1;
  const showCopyButton = isFirstSegment && hasMultipleSegments && onCopyFromFirst;
  
  // Initialize edited segment when modal opens - auto-populate defaults
  React.useEffect(() => {
    if (open && segment) {
      const updatedSegment = { ...segment };
      
      // Auto-populate approval rate targets to 99% if not set or 0
      if (!updatedSegment.kpis.approvalRateTarget || updatedSegment.kpis.approvalRateTarget === 0) {
        updatedSegment.kpis.approvalRateTarget = globalKPIs.approvalRateImprovement || 99;
      }
      if (!updatedSegment.kpis.preAuthApprovalTarget || updatedSegment.kpis.preAuthApprovalTarget === 0) {
        updatedSegment.kpis.preAuthApprovalTarget = globalKPIs.preAuthApprovalImprovement || 99;
      }
      if (!updatedSegment.kpis.postAuthApprovalTarget || updatedSegment.kpis.postAuthApprovalTarget === 0) {
        updatedSegment.kpis.postAuthApprovalTarget = globalKPIs.postAuthApprovalImprovement || 99;
      }
      
      // Auto-populate CB rate from vendor lookup
      if (existingFraudVendor && segment.inputs.fraudCBRate && segment.inputs.fraudCBRate > 0) {
        const vendorFactor = getVendorCBReductionFactor(existingFraudVendor);
        const suggestedRate = parseFloat((segment.inputs.fraudCBRate * vendorFactor).toFixed(3));
        if (!updatedSegment.kpis.chargebackRateTarget || updatedSegment.kpis.chargebackRateTarget === 0) {
          updatedSegment.kpis.chargebackRateTarget = suggestedRate;
        }
      }
      
      setEditedSegment(updatedSegment);
    }
  }, [open, segment, globalKPIs, existingFraudVendor]);
  
  // Get segment's customer input values for comparison (use safe fallback when segment not yet loaded)
  const segmentInputs = editedSegment?.inputs ?? { annualGMV: 0, grossAttempts: 0, fraudCBRate: 0 };
  const currencySymbol = getCurrencySymbol(baseCurrency);
  
  // Calculate segment AOV for 3DS lookup
  const segmentAOV = React.useMemo(() => {
    const gmv = segmentInputs.annualGMV ?? 0;
    const attempts = segmentInputs.grossAttempts ?? 0;
    return attempts > 0 ? gmv / attempts : 0;
  }, [segmentInputs.annualGMV, segmentInputs.grossAttempts]);
  
  // 3DS lookup based on segment country and AOV
  const threeDSLookup = React.useMemo(() => {
    if (!editedSegment?.country || segmentAOV <= 0) return null;
    return get3DSRateByCountryAndAOV(editedSegment.country, segmentAOV, baseCurrency);
  }, [editedSegment?.country, segmentAOV, baseCurrency]);
  
  // Early return AFTER all hooks
  if (!editedSegment) return null;
  
  const updateKPI = <K extends keyof SegmentKPIs>(
    field: K,
    value: SegmentKPIs[K]
  ) => {
    setEditedSegment(prev => prev ? {
      ...prev,
      kpis: { ...prev.kpis, [field]: value }
    } : null);
  };
  
  const handleSave = () => {
    if (editedSegment) {
      onSave(editedSegment);
      onOpenChange(false);
    }
  };
  
  const SEGMENT_KPI_EPS = 0.0001;
  const segmentValuesEqual = (a: number | undefined, b: number | undefined) =>
    a === b || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < SEGMENT_KPI_EPS);

  const SegmentResetButton = ({
    currentValue,
    benchmarkValue,
    onReset,
  }: { currentValue: number | undefined; benchmarkValue: number | undefined; onReset: () => void }) => {
    if (benchmarkValue === undefined || segmentValuesEqual(currentValue, benchmarkValue)) return null;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary"
            onClick={onReset}
            aria-label="Reset to benchmark"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">Reset to benchmark</p>
        </TooltipContent>
      </Tooltip>
    );
  };

  // Helper to calculate percent change
  const calculatePercentChange = (current: number | undefined, target: number | undefined): string | null => {
    if (current === undefined || target === undefined || current === 0) return null;
    const percentChange = ((target - current) / current) * 100;
    const sign = percentChange >= 0 ? '+' : '';
    return `${sign}${percentChange.toFixed(1)}%`;
  };
  
  // Helper to render current value comparison: Current: x% > y% (% difference)
  const renderCurrentComparison = (
    currentValue: number | undefined, 
    targetValue: number | undefined, 
    unit: string = '%'
  ) => {
    if (currentValue === undefined) return null;
    const percentChange = calculatePercentChange(currentValue, targetValue);
    const isImprovement = targetValue !== undefined && targetValue >= currentValue;
    
    return (
      <p className="text-xs text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
        Current: <span className="font-medium text-foreground">{currentValue.toFixed(2)}{unit}</span>
        {targetValue !== undefined && percentChange && (
          <span className="ml-1.5">
            &gt; <span className="font-medium text-primary">{targetValue.toFixed(2)}{unit}</span>
            <span className={`ml-1 font-medium ${isImprovement ? 'text-green-600' : 'text-red-600'}`}>
              ({percentChange})
            </span>
          </span>
        )}
      </p>
    );
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Forter KPIs: {segment?.name}
          </DialogTitle>
          <DialogDescription>
            Set Forter performance targets for this segment
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-4">
            {/* Challenge 1 only: Simple approval rate target */}
            {isChallenge1Selected && !isChallenge245Selected && (() => {
              const approvalBenchmark = globalKPIs.approvalRateImprovement ?? 99;
              const cbBenchmark = existingFraudVendor && (segmentInputs.fraudCBRate ?? 0) > 0
                ? parseFloat(((segmentInputs.fraudCBRate ?? 0) * getVendorCBReductionFactor(existingFraudVendor)).toFixed(3))
                : 0.25;
              return (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>Target Fraud Approval Rate (%)</Label>
                      <SegmentResetButton
                        currentValue={editedSegment.kpis.approvalRateTarget}
                        benchmarkValue={approvalBenchmark}
                        onReset={() => updateKPI('approvalRateTarget', approvalBenchmark)}
                      />
                    </div>
                    <PercentageInput
                      key="seg-approval"
                      value={editedSegment.kpis.approvalRateTarget}
                      onChange={(v) => updateKPI('approvalRateTarget', v)}
                      placeholder="99"
                    />
                    <div className="min-h-5">
                      {renderCurrentComparison(
                        segmentInputs.preAuthApprovalRate,
                        editedSegment.kpis.approvalRateTarget
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>Target Fraud CB Rate (%)</Label>
                      <SegmentResetButton
                        currentValue={editedSegment.kpis.chargebackRateTarget}
                        benchmarkValue={cbBenchmark}
                        onReset={() => updateKPI('chargebackRateTarget', cbBenchmark)}
                      />
                    </div>
                    <PercentageInput
                      key="seg-cb"
                      value={editedSegment.kpis.chargebackRateTarget}
                      onChange={(v) => updateKPI('chargebackRateTarget', v)}
                      placeholder="0.25"
                      max={10}
                      step={0.01}
                    />
                    <div className="min-h-5">
                      {renderCurrentComparison(
                        segmentInputs.fraudCBRate,
                        editedSegment.kpis.chargebackRateTarget
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
            
            {/* Challenge 2/4/5: Pre-Auth, Post-Auth, 3DS, CB targets */}
            {isChallenge245Selected && (
              <div className="space-y-4">
                {/* Pre-Auth with Include/Exclude */}
                {(() => {
                  const preAuthBenchmark = globalKPIs.preAuthApprovalImprovement ?? 99;
                  return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Label className={editedSegment.kpis.preAuthIncluded === false ? "text-muted-foreground" : ""}>
                        Target Pre-Auth Fraud Approval Rate (%)
                      </Label>
                      {editedSegment.kpis.preAuthIncluded !== false && (
                        <SegmentResetButton
                          currentValue={editedSegment.kpis.preAuthApprovalTarget}
                          benchmarkValue={preAuthBenchmark}
                          onReset={() => updateKPI('preAuthApprovalTarget', preAuthBenchmark)}
                        />
                      )}
                    </div>
                    <IncludeExcludeChip
                      included={editedSegment.kpis.preAuthIncluded !== false}
                      onIncludedChange={(included) => {
                        updateKPI('preAuthIncluded', included);
                        if (!included) {
                          updateKPI('preAuthApprovalTarget', 100);
                        }
                      }}
                    />
                  </div>
                  <PercentageInput
                    key="seg-preAuth"
                    value={editedSegment.kpis.preAuthIncluded === false ? 100 : editedSegment.kpis.preAuthApprovalTarget}
                    onChange={(v) => updateKPI('preAuthApprovalTarget', v)}
                    placeholder={globalKPIs.preAuthApprovalImprovement?.toString() || "99"}
                    disabled={editedSegment.kpis.preAuthIncluded === false}
                  />
                  <div className="min-h-5">
                    {editedSegment.kpis.preAuthIncluded !== false && renderCurrentComparison(
                      segmentInputs.preAuthApprovalRate,
                      editedSegment.kpis.preAuthApprovalTarget
                    )}
                  </div>
                </div>
                  );
                })()}
                {/* Post-Auth with Include/Exclude */}
                {(() => {
                  const postAuthBenchmark = globalKPIs.postAuthApprovalImprovement ?? 100;
                  return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Label className={editedSegment.kpis.postAuthIncluded === false ? "text-muted-foreground" : ""}>
                        Target Post-Auth Fraud Approval Rate (%)
                      </Label>
                      {editedSegment.kpis.postAuthIncluded !== false && (
                        <SegmentResetButton
                          currentValue={editedSegment.kpis.postAuthApprovalTarget}
                          benchmarkValue={postAuthBenchmark}
                          onReset={() => updateKPI('postAuthApprovalTarget', postAuthBenchmark)}
                        />
                      )}
                    </div>
                    <IncludeExcludeChip
                      included={editedSegment.kpis.postAuthIncluded !== false}
                      onIncludedChange={(included) => {
                        updateKPI('postAuthIncluded', included);
                        if (!included) {
                          updateKPI('postAuthApprovalTarget', 100);
                        }
                      }}
                    />
                  </div>
                  <PercentageInput
                    key="seg-postAuth"
                    value={editedSegment.kpis.postAuthIncluded === false ? 100 : editedSegment.kpis.postAuthApprovalTarget}
                    onChange={(v) => updateKPI('postAuthApprovalTarget', v)}
                    placeholder={globalKPIs.postAuthApprovalImprovement?.toString() || "99"}
                    disabled={editedSegment.kpis.postAuthIncluded === false}
                  />
                  <div className="min-h-5">
                    {editedSegment.kpis.postAuthIncluded !== false && renderCurrentComparison(
                      segmentInputs.postAuthApprovalRate,
                      editedSegment.kpis.postAuthApprovalTarget
                    )}
                  </div>
                </div>
                  );
                })()}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>Target 3DS Rate (%)</Label>
                      {threeDSLookup && threeDSLookup.rate > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge 
                              variant="secondary" 
                              className="text-xs cursor-pointer hover:bg-primary/20"
                              onClick={() => updateKPI('threeDSRateTarget', threeDSLookup.rate)}
                            >
                              Suggested: {threeDSLookup.rate}%
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-sm">
                              <span className="font-medium">{threeDSLookup.reason}</span>
                              <br />
                              <span className="text-muted-foreground">
                                AOV: {currencySymbol}{segmentAOV.toLocaleString('en-US', { maximumFractionDigits: 0 })} 
                                (€{threeDSLookup.aovInEUR.toLocaleString('en-US', { maximumFractionDigits: 0 })})
                              </span>
                              <br />
                              <span className="text-xs text-primary">Click to apply</span>
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <SegmentResetButton
                        currentValue={editedSegment.kpis.threeDSRateTarget}
                        benchmarkValue={threeDSLookup?.rate}
                        onReset={() => threeDSLookup && updateKPI('threeDSRateTarget', threeDSLookup.rate)}
                      />
                    </div>
                    <PercentageInput
                      key="seg-3ds"
                      value={editedSegment.kpis.threeDSRateTarget}
                      onChange={(v) => updateKPI('threeDSRateTarget', v)}
                      placeholder={globalKPIs.threeDSReduction?.toString() || "10"}
                    />
                    <div className="min-h-5">
                      {renderCurrentComparison(
                        segmentInputs.threeDSChallengeRate,
                        editedSegment.kpis.threeDSRateTarget
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>Target Fraud CB Rate (%)</Label>
                      <SegmentResetButton
                        currentValue={editedSegment.kpis.chargebackRateTarget}
                        benchmarkValue={existingFraudVendor && (segmentInputs.fraudCBRate ?? 0) > 0
                          ? parseFloat(((segmentInputs.fraudCBRate ?? 0) * getVendorCBReductionFactor(existingFraudVendor)).toFixed(3))
                          : 0.25}
                        onReset={() => updateKPI('chargebackRateTarget', existingFraudVendor && (segmentInputs.fraudCBRate ?? 0) > 0
                          ? parseFloat(((segmentInputs.fraudCBRate ?? 0) * getVendorCBReductionFactor(existingFraudVendor)).toFixed(3))
                          : 0.25)}
                      />
                    </div>
                    <PercentageInput
                      key="seg-cb2"
                      value={editedSegment.kpis.chargebackRateTarget}
                      onChange={(v) => updateKPI('chargebackRateTarget', v)}
                      placeholder="0.25"
                      max={10}
                      step={0.01}
                    />
                    <div className="min-h-5">
                      {renderCurrentComparison(
                        segmentInputs.fraudCBRate,
                        editedSegment.kpis.chargebackRateTarget
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter className="flex justify-between">
          <div>
            {showCopyButton && (
              <Button 
                variant="outline" 
                onClick={() => {
                  if (editedSegment) {
                    // Save current segment first
                    onSave(editedSegment);
                    // Then copy to other segments (after a brief delay to ensure save completes)
                    setTimeout(() => {
                      onCopyFromFirst?.();
                    }, 50);
                  }
                  // Don't close the modal - let the save handler close it
                }}
                className="gap-2"
              >
                <Copy className="h-4 w-4" />
                Save & Copy to Other Segments
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
