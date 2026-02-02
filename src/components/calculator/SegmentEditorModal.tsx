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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NumericInput } from "@/components/calculator/NumericInput";
import { PercentageInput } from "@/components/calculator/PercentageInput";
import { IncludeExcludeChip } from "@/components/calculator/IncludeExcludeChip";
import { Segment, copyGlobalInputsToSegment } from "@/lib/segments";
import { ChevronDown, Copy } from "lucide-react";
import { getCurrencySymbol, countryBenchmarksSortedForHQ, verticalBenchmarks, getWeightedApprovalRate } from "@/lib/benchmarkData";
import { toast } from "sonner";

interface SegmentEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segment: Segment | null;
  onSave: (segment: Segment) => void;
  baseCurrency: string;
  selectedChallenges: { [key: string]: boolean };
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
  };
  globalKPIs?: {
    approvalRateImprovement?: number;
    preAuthApprovalImprovement?: number;
    postAuthApprovalImprovement?: number;
    chargebackReduction?: number;
    threeDSReduction?: number;
  };
  // Global profile defaults
  globalCountry?: string;
  globalIndustry?: string;
}

export function SegmentEditorModal({
  open,
  onOpenChange,
  segment,
  onSave,
  baseCurrency,
  selectedChallenges,
  globalInputs,
  globalKPIs,
  globalCountry,
  globalIndustry,
}: SegmentEditorModalProps) {
  const [editedSegment, setEditedSegment] = React.useState<Segment | null>(null);
  const [inputsOpen, setInputsOpen] = React.useState(true);
  
  const currencySymbol = getCurrencySymbol(baseCurrency);
  const isNew = segment?.name === '';
  
  // Determine which challenges are selected
  const isChallenge1Selected = selectedChallenges['1'] === true;
  const isChallenge2Selected = selectedChallenges['2'] === true;
  const isChallenge4Selected = selectedChallenges['4'] === true;
  const isChallenge5Selected = selectedChallenges['5'] === true;
  const isChallenge245Selected = isChallenge2Selected || isChallenge4Selected || isChallenge5Selected;
  
  // Show pre/post auth fields only if challenge 2/4/5 is selected
  const showPrePostAuth = isChallenge245Selected;
  // Show 3DS and issuing bank fields only if challenge 2/4/5 is selected
  const show3DSFields = isChallenge245Selected;
  
  // Initialize edited segment when modal opens - default country/industry from global profile
  React.useEffect(() => {
    if (open && segment) {
      const updatedSegment = { ...segment };
      // Default country/industry to global profile if not set (for new segments)
      if (!updatedSegment.country && globalCountry) {
        updatedSegment.country = globalCountry;
      }
      if (!updatedSegment.industry && globalIndustry) {
        updatedSegment.industry = globalIndustry;
      }
      setEditedSegment(updatedSegment);
      setInputsOpen(true);
    }
  }, [open, segment, globalCountry, globalIndustry]);
  
  // Compute suggested KPI based on segment's country/industry
  const suggestedApprovalRate = React.useMemo(() => {
    if (!editedSegment) return undefined;
    return getWeightedApprovalRate(editedSegment.industry, editedSegment.country);
  }, [editedSegment?.country, editedSegment?.industry]);
  
  if (!editedSegment) return null;
  
  // Handle country/industry change and update default KPIs
  const handleCountryChange = (country: string) => {
    const newApprovalRate = getWeightedApprovalRate(editedSegment.industry, country);
    setEditedSegment(prev => {
      if (!prev) return null;
      const updated = { ...prev, country };
      // Auto-update KPI targets based on new country/industry lookup
      if (newApprovalRate !== undefined) {
        // Only update if KPIs haven't been manually set yet
        if (prev.kpis.approvalRateTarget === undefined || prev.kpis.approvalRateTarget === 0) {
          updated.kpis = { ...prev.kpis, approvalRateTarget: newApprovalRate };
        }
        if (prev.kpis.preAuthApprovalTarget === undefined || prev.kpis.preAuthApprovalTarget === 0) {
          updated.kpis = { ...updated.kpis, preAuthApprovalTarget: newApprovalRate };
        }
        if (prev.kpis.postAuthApprovalTarget === undefined || prev.kpis.postAuthApprovalTarget === 0) {
          updated.kpis = { ...updated.kpis, postAuthApprovalTarget: newApprovalRate };
        }
      }
      return updated;
    });
  };
  
  const handleIndustryChange = (industry: string) => {
    const newApprovalRate = getWeightedApprovalRate(industry, editedSegment.country);
    setEditedSegment(prev => {
      if (!prev) return null;
      const updated = { ...prev, industry };
      // Auto-update KPI targets based on new country/industry lookup
      if (newApprovalRate !== undefined) {
        if (prev.kpis.approvalRateTarget === undefined || prev.kpis.approvalRateTarget === 0) {
          updated.kpis = { ...prev.kpis, approvalRateTarget: newApprovalRate };
        }
        if (prev.kpis.preAuthApprovalTarget === undefined || prev.kpis.preAuthApprovalTarget === 0) {
          updated.kpis = { ...updated.kpis, preAuthApprovalTarget: newApprovalRate };
        }
        if (prev.kpis.postAuthApprovalTarget === undefined || prev.kpis.postAuthApprovalTarget === 0) {
          updated.kpis = { ...updated.kpis, postAuthApprovalTarget: newApprovalRate };
        }
      }
      return updated;
    });
  };
  
  if (!editedSegment) return null;
  
  const updateInput = <K extends keyof Segment['inputs']>(
    field: K,
    value: Segment['inputs'][K]
  ) => {
    setEditedSegment(prev => {
      if (!prev) return null;
      
      const updatedInputs = { ...prev.inputs, [field]: value };
      
      // Auto-calculate completedAOV when grossAttempts or annualGMV changes
      if ((field === 'grossAttempts' || field === 'annualGMV') && !prev.inputs.completedAOVManuallySet) {
        const gmv = field === 'annualGMV' ? (value as number) : (prev.inputs.annualGMV ?? 0);
        const attempts = field === 'grossAttempts' ? (value as number) : (prev.inputs.grossAttempts ?? 0);
        if (attempts > 0 && gmv > 0) {
          updatedInputs.completedAOV = gmv / attempts;
        }
      }
      
      // Mark completedAOV as manually set if user changes it directly
      if (field === 'completedAOV') {
        updatedInputs.completedAOVManuallySet = true;
      }
      
      return {
        ...prev,
        inputs: updatedInputs
      };
    });
  };
  
  const handleCopyFromGlobal = () => {
    if (editedSegment) {
      const copied = copyGlobalInputsToSegment(editedSegment, globalInputs);
      setEditedSegment(copied);
      toast.success("Copied values from global inputs");
    }
  };
  
  const handleSave = () => {
    if (!editedSegment.name.trim()) {
      toast.error("Segment name is required");
      return;
    }
    onSave(editedSegment);
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isNew ? 'Add Segment' : `Edit Segment: ${segment?.name}`}
          </DialogTitle>
          <DialogDescription>
            Configure segment-specific customer data
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Name and Description */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="segment-name">Segment Name *</Label>
              <Input
                id="segment-name"
                value={editedSegment.name}
                onChange={(e) => setEditedSegment(prev => prev ? { ...prev, name: e.target.value } : null)}
                placeholder="e.g., EMEA, Electronics, Fashion US"
              />
            </div>
            
            {/* Country and Industry for KPI lookups */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Country / Region</Label>
                <Select
                  value={editedSegment.country || ''}
                  onValueChange={handleCountryChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {countryBenchmarksSortedForHQ.map((country) => (
                      <SelectItem key={country.name} value={country.name}>
                        {country.flag} {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {suggestedApprovalRate !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    Suggested approval target: <span className="font-medium text-primary">{suggestedApprovalRate.toFixed(1)}%</span>
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label>Industry / Vertical</Label>
                <Select
                  value={editedSegment.industry || ''}
                  onValueChange={handleIndustryChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {verticalBenchmarks.map((vertical) => (
                      <SelectItem key={vertical.name} value={vertical.name}>
                        {vertical.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="segment-desc">Description (optional)</Label>
              <Textarea
                id="segment-desc"
                value={editedSegment.description || ''}
                onChange={(e) => setEditedSegment(prev => prev ? { ...prev, description: e.target.value } : null)}
                placeholder="Notes about this segment..."
                rows={2}
              />
            </div>
          </div>
          
          {/* Customer Data Section */}
          <Collapsible open={inputsOpen} onOpenChange={setInputsOpen}>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-primary">
                <ChevronDown className={`h-4 w-4 transition-transform ${inputsOpen ? '' : '-rotate-90'}`} />
                Customer Data
              </CollapsibleTrigger>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyFromGlobal}
                className="gap-2 text-xs"
              >
                <Copy className="h-3 w-3" />
                Copy from Global
              </Button>
            </div>
            
            <CollapsibleContent className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Transaction Attempts (#)</Label>
                  <NumericInput
                    value={editedSegment.inputs.grossAttempts}
                    onChange={(v) => updateInput('grossAttempts', v)}
                    placeholder="500,000"
                    formatWithCommas
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Annual GMV ({currencySymbol})</Label>
                  <NumericInput
                    value={editedSegment.inputs.annualGMV}
                    onChange={(v) => updateInput('annualGMV', v)}
                    placeholder="50,000,000"
                    formatWithCommas
                  />
                </div>
                
                {/* Challenge 1 only: Simple Approval Rate */}
                {isChallenge1Selected && !isChallenge245Selected && (
                  <div className="space-y-2">
                    <Label>Fraud Approval Rate - Volume (%)</Label>
                    <PercentageInput
                      value={editedSegment.inputs.preAuthApprovalRate}
                      onChange={(v) => updateInput('preAuthApprovalRate', v)}
                      placeholder="95"
                    />
                  </div>
                )}
                
                {/* Challenge 2/4/5: Pre-Auth with Include/Exclude */}
                {showPrePostAuth && (
                  <>
                    <div className="space-y-2 col-span-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label className={editedSegment.inputs.preAuthIncluded === false ? "text-muted-foreground" : ""}>
                          Pre-Auth Fraud Approval Rate (%)
                        </Label>
                        <IncludeExcludeChip
                          included={editedSegment.inputs.preAuthIncluded !== false}
                          onIncludedChange={(included) => {
                            updateInput('preAuthIncluded', included);
                            if (!included) {
                              updateInput('preAuthApprovalRate', 100);
                            }
                          }}
                        />
                      </div>
                      <PercentageInput
                        value={editedSegment.inputs.preAuthIncluded === false ? 100 : editedSegment.inputs.preAuthApprovalRate}
                        onChange={(v) => updateInput('preAuthApprovalRate', v)}
                        placeholder="95"
                        disabled={editedSegment.inputs.preAuthIncluded === false}
                      />
                    </div>
                    
                    <div className="space-y-2 col-span-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label className={editedSegment.inputs.postAuthIncluded === false ? "text-muted-foreground" : ""}>
                          Post-Auth Fraud Approval Rate (%)
                        </Label>
                        <IncludeExcludeChip
                          included={editedSegment.inputs.postAuthIncluded !== false}
                          onIncludedChange={(included) => {
                            updateInput('postAuthIncluded', included);
                            if (!included) {
                              updateInput('postAuthApprovalRate', 100);
                            }
                          }}
                        />
                      </div>
                      <PercentageInput
                        value={editedSegment.inputs.postAuthIncluded === false ? 100 : editedSegment.inputs.postAuthApprovalRate}
                        onChange={(v) => updateInput('postAuthApprovalRate', v)}
                        placeholder="98"
                        disabled={editedSegment.inputs.postAuthIncluded === false}
                      />
                    </div>
                  </>
                )}
                
                {/* 3DS fields - only for challenges 2/4/5 */}
                {show3DSFields && (
                  <>
                    <div className="space-y-2">
                      <Label>Credit Card % of Transactions</Label>
                      <PercentageInput
                        value={editedSegment.inputs.creditCardPct}
                        onChange={(v) => updateInput('creditCardPct', v)}
                        placeholder="80"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Challenge 3DS Rate (%)</Label>
                      <PercentageInput
                        value={editedSegment.inputs.threeDSChallengeRate}
                        onChange={(v) => updateInput('threeDSChallengeRate', v)}
                        placeholder="30"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>3DS Abandonment Rate (%)</Label>
                      <PercentageInput
                        value={editedSegment.inputs.threeDSAbandonmentRate}
                        onChange={(v) => updateInput('threeDSAbandonmentRate', v)}
                        placeholder="15"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Issuing Bank Decline Rate (%)</Label>
                      <PercentageInput
                        value={editedSegment.inputs.issuingBankDeclineRate}
                        onChange={(v) => updateInput('issuingBankDeclineRate', v)}
                        placeholder="10"
                      />
                    </div>
                  </>
                )}
                
                {/* Chargeback fields - for challenges 1/2/4/5 */}
                <div className="space-y-2">
                  <Label>Fraud CB Rate (%)</Label>
                  <PercentageInput
                    value={editedSegment.inputs.fraudCBRate}
                    onChange={(v) => updateInput('fraudCBRate', v)}
                    placeholder="0.5"
                    max={10}
                    step={0.01}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Fraud CB AOV ({currencySymbol})</Label>
                  <NumericInput
                    value={editedSegment.inputs.fraudCBAOV}
                    onChange={(v) => updateInput('fraudCBAOV', v)}
                    placeholder="150"
                  />
                </div>
                
                {/* Completed AOV - defaults to GMV / Attempts but can be overridden */}
                <div className="space-y-2 col-span-2">
                  <div className="flex items-center justify-between">
                    <Label>Completed AOV ({currencySymbol})</Label>
                    {editedSegment.inputs.annualGMV && editedSegment.inputs.grossAttempts && (
                      <span className="text-xs text-muted-foreground">
                        Attempted AOV: {currencySymbol}{Math.round(editedSegment.inputs.annualGMV / editedSegment.inputs.grossAttempts).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <NumericInput
                    value={editedSegment.inputs.completedAOV}
                    onChange={(v) => updateInput('completedAOV', v)}
                    placeholder={
                      editedSegment.inputs.annualGMV && editedSegment.inputs.grossAttempts
                        ? Math.round(editedSegment.inputs.annualGMV / editedSegment.inputs.grossAttempts).toLocaleString()
                        : "100"
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Defaults to GMV ÷ Transaction Attempts if not specified. Used for calculating value of approved transactions.
                  </p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {isNew ? 'Add Segment' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
