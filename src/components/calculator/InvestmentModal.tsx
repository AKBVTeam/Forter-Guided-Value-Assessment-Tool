import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { NumericInput } from "./NumericInput";
import { CalculatorData } from "@/pages/Index";
import {
  InvestmentInputs,
  CustomInvestmentItem,
  defaultInvestmentInputs,
  calculateInvestmentCosts,
  getEnabledSolutions,
  getPriceByAOV,
  fraudManagementPricing,
  abusePreventionPricing,
  chargebackRecoveryPricing,
} from "@/lib/roiCalculations";
import { getCurrencySymbol, getExchangeRateFromUSD, convertFromUSD, convertCurrencyViaUSD } from "@/lib/benchmarkData";
import { Calculator, Settings, DollarSign, ChevronDown, ChevronUp, Info, Plus, Trash2, ExternalLink, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface InvestmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: CalculatorData;
  selectedChallenges: Record<string, boolean>;
  investmentInputs: InvestmentInputs;
  onInvestmentChange: (inputs: InvestmentInputs) => void;
  isCustomMode?: boolean; // When true, show all solutions unchecked by default
}

export function InvestmentModal({
  open,
  onOpenChange,
  formData,
  selectedChallenges,
  investmentInputs,
  onInvestmentChange,
  isCustomMode = false,
}: InvestmentModalProps) {
  const [localInputs, setLocalInputs] = useState<InvestmentInputs>(investmentInputs);
  const [activeTab, setActiveTab] = useState<'guided' | 'manual'>('guided');
  /** First time the modal is opened (per session): turn all product toggles off so user opts in. */
  const investmentModalFirstOpenRef = useRef(false);
  
  // Collapsible sections - default all closed; persist when modal stays mounted (close/reopen)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    fraudManagement: false,
    paymentOptimization: false,
    disputeManagement: false,
    abusePrevention: false,
    accountProtection: false,
  });

  const currencySymbol = getCurrencySymbol(formData.baseCurrency || 'USD');
  const baseCurrency = formData.baseCurrency || 'USD';
  const enabledSolutions = getEnabledSolutions(selectedChallenges);
  
  // Currency conversion from USD (pricing is in USD)
  const isNotUSD = baseCurrency !== 'USD';
  const exchangeRateFromUSD = isNotUSD ? getExchangeRateFromUSD(baseCurrency) : 1;
  
  // Convert USD price to base currency for display
  const convertPrice = (usdPrice: number): number => {
    return isNotUSD ? convertFromUSD(usdPrice, baseCurrency) : usdPrice;
  };
  
  // Calculate AOV for default pricing
  const totalGMV = (formData.amerAnnualGMV || 0) + (formData.emeaAnnualGMV || 0) + (formData.apacAnnualGMV || 0);
  const totalAttempts = (formData.amerGrossAttempts || 0) + (formData.emeaGrossAttempts || 0) + (formData.apacGrossAttempts || 0);
  const aov = totalAttempts > 0 ? totalGMV / totalAttempts : 150;

  // Sync from parent only when modal opens (not during editing)
  const isEditingRef = useRef(false);
  
  useEffect(() => {
    if (!isEditingRef.current) {
      setLocalInputs(investmentInputs);
    }
  }, [investmentInputs]);

  // Auto-save: sync local changes to parent with debounce to prevent loops
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Flush pending changes immediately (for modal close)
  const flushChanges = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    // Always update parent with current local state on close
    onInvestmentChange(localInputs);
    isEditingRef.current = false;
  }, [localInputs, onInvestmentChange]);
  
  useEffect(() => {
    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Debounce the save to prevent rapid updates
    saveTimeoutRef.current = setTimeout(() => {
      if (JSON.stringify(localInputs) !== JSON.stringify(investmentInputs)) {
        onInvestmentChange(localInputs);
      }
      isEditingRef.current = false;
    }, 300);
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [localInputs, investmentInputs, onInvestmentChange]);
  
  // Handle modal open/close - flush changes immediately when closing
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Synchronously update parent before closing
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      onInvestmentChange(localInputs);
      isEditingRef.current = false;
    }
    onOpenChange(newOpen);
  };
  
  // Mark as editing when local inputs change
  const updateLocalInputs = (updater: (prev: InvestmentInputs) => InvestmentInputs) => {
    isEditingRef.current = true;
    setLocalInputs(updater);
  };

  // Auto-populate defaults when modal opens based on customer inputs
  // ALWAYS SYNC volume fields (as per user preference)
  // Also re-apply currency conversion when base currency changes
  useEffect(() => {
    if (!open) return;
    
    // Detect if currency has changed since costs were last set
    const storedPricingCurrency = localInputs.pricingCurrency || 'USD';
    const currencyChanged = storedPricingCurrency !== baseCurrency;
    
    // Helper to convert existing value from old currency to new currency
    const convertExisting = (currentValue: number): number => {
      if (!currencyChanged || !currentValue) return currentValue;
      return convertCurrencyViaUSD(currentValue, storedPricingCurrency, baseCurrency);
    };

    // Calculate weighted averages for segmented data
    const segments = formData.segments || [];
    const enabledSegments = segments.filter(s => s.enabled);
    const segmentationEnabled = formData.segmentationEnabled && enabledSegments.length > 0;

    // If segmentation enabled, compute aggregated totals from segments
    const aggregatedAttempts = segmentationEnabled
      ? enabledSegments.reduce((sum, seg) => sum + (seg.inputs.grossAttempts ?? 0), 0)
      : totalAttempts;
    const aggregatedGMV = segmentationEnabled
      ? enabledSegments.reduce((sum, seg) => sum + (seg.inputs.annualGMV ?? 0), 0)
      : totalGMV;
    const aggregatedCCPct = (() => {
      if (!segmentationEnabled) return formData.amerCreditCardPct ?? 80;
      let totalWeight = 0;
      let weightedSum = 0;
      for (const seg of enabledSegments) {
        const w = seg.inputs.grossAttempts ?? 0;
        if (w > 0) {
          weightedSum += (seg.inputs.creditCardPct ?? 0) * w;
          totalWeight += w;
        }
      }
      return totalWeight > 0 ? weightedSum / totalWeight : 80;
    })();
    
    setLocalInputs(prev => {
      const updated = { ...prev };
      const changedFields: string[] = [];
      
      // On first open only: turn all product toggles off so user opts in
      if (!investmentModalFirstOpenRef.current) {
        investmentModalFirstOpenRef.current = true;
        updated.fraudManagement.enabled = false;
        updated.paymentOptimization.enabled = false;
        updated.disputeManagement.enabled = false;
        updated.abusePrevention.enabled = false;
        updated.accountProtection.enabled = false;
      }
      // Otherwise: keep persisted enabled state from prev (don't overwrite from enabledSolutions)
      
      // Fraud Management - ALWAYS sync volume fields
      if (enabledSolutions.fraudManagement) {
        const prevAttempts = updated.fraudManagement.annualTransactions;
        const prevGMV = updated.fraudManagement.annualGMV;
        const prevCC = updated.fraudManagement.creditCardTrafficPct;
        
        updated.fraudManagement.annualTransactions = aggregatedAttempts || 1000000;
        updated.fraudManagement.annualGMV = aggregatedGMV || 150000000;
        updated.fraudManagement.creditCardTrafficPct = aggregatedCCPct;
        
        if (prevAttempts !== updated.fraudManagement.annualTransactions && prevAttempts) changedFields.push('Annual Transactions');
        if (prevGMV !== updated.fraudManagement.annualGMV && prevGMV) changedFields.push('Annual GMV');
        if (prevCC !== updated.fraudManagement.creditCardTrafficPct && prevCC) changedFields.push('Credit Card %');
        
        // Reset cost to default when currency changes
        if (currencyChanged || !updated.fraudManagement.costPerDecision) {
          updated.fraudManagement.costPerDecision = convertPrice(getPriceByAOV(fraudManagementPricing, aov));
        }
        // If 3DS challenges selected, use Forter 3DS rate
        if ((selectedChallenges['4'] || selectedChallenges['5']) && !updated.fraudManagement.threeDSRateWithForter) {
          updated.fraudManagement.threeDSRateWithForter = formData.forterKPIs?.threeDSReduction || 30;
        }
      }
      
      // Payment Optimization - ALWAYS sync volume fields
      if (enabledSolutions.paymentOptimization) {
        updated.paymentOptimization.annualTransactions = aggregatedAttempts || 1000000;
        updated.paymentOptimization.annualGMV = aggregatedGMV || 150000000;
        updated.paymentOptimization.creditCardTrafficPct = aggregatedCCPct;
        // Reset cost to default when currency changes
        if (currencyChanged || !updated.paymentOptimization.costPerDecision) {
          updated.paymentOptimization.costPerDecision = convertPrice(0.02);
        }
      }
      
      // Dispute Management
      if (enabledSolutions.disputeManagement) {
        if (!updated.disputeManagement.valueOfWonChargebacks) {
          const fraudCBRate = (formData.fraudCBRate || 0.5) / 100;
          const fraudWinRate = (formData.forterKPIs?.fraudWinRateChange || 40) / 100;
          const serviceCBRate = (formData.serviceCBRate || 0.5) / 100;
          const serviceWinRate = (formData.forterKPIs?.serviceWinRateChange || 40) / 100;
          const cbAOV = formData.fraudCBAOV || 150;
          
          const fraudCBs = aggregatedAttempts * fraudCBRate;
          const serviceCBs = aggregatedAttempts * serviceCBRate;
          const wonValue = (fraudCBs * fraudWinRate + serviceCBs * serviceWinRate) * cbAOV;
          
          updated.disputeManagement.valueOfWonChargebacks = Math.round(wonValue) || 0;
        }
        if (!updated.disputeManagement.revenueSharePct) {
          updated.disputeManagement.revenueSharePct = 20;
        }
      }
      
      // Abuse Prevention - ALWAYS sync volume fields
      if (enabledSolutions.abusePrevention) {
        updated.abusePrevention.annualTransactions = aggregatedAttempts || 1000000;
        updated.abusePrevention.annualGMV = aggregatedGMV || 150000000;
        // Reset cost to default when currency changes
        if (currencyChanged || !updated.abusePrevention.costPerDecision) {
          updated.abusePrevention.costPerDecision = convertPrice(getPriceByAOV(abusePreventionPricing, aov));
        }
      }
      
      // Account Protection - ALWAYS sync volume fields
      if (enabledSolutions.accountProtection) {
        const monthlyLogins = formData.monthlyLogins || 15000;
        updated.accountProtection.annualLogins = monthlyLogins * 12;
        // Reset cost to default when currency changes
        if (currencyChanged || !updated.accountProtection.costPerAPICall) {
          updated.accountProtection.costPerAPICall = convertPrice(0.02);
        }
        const monthlySignups = formData.monthlySignups || 5000;
        updated.accountProtection.annualSignups = monthlySignups * 12;
        // Reset cost to default when currency changes
        if (currencyChanged || !updated.accountProtection.signupCostPerAPICall) {
          updated.accountProtection.signupCostPerAPICall = convertPrice(0.50);
        }
      }
      
      // Also convert integration cost and manual investment cost if currency changed
      if (currencyChanged) {
        if (updated.integrationCost) {
          updated.integrationCost = convertExisting(updated.integrationCost);
        }
        if (updated.manualInvestmentCost) {
          updated.manualInvestmentCost = convertExisting(updated.manualInvestmentCost);
        }
      }
      
      // Update the pricing currency
      updated.pricingCurrency = baseCurrency;
      
      // Show toast if volume fields updated (and not first open)
      if (changedFields.length > 0 && prev.pricingCurrency === baseCurrency) {
        import('sonner').then(({ toast }) => {
          toast.info(`Investment inputs updated`, {
            description: `Synced with latest Customer Inputs: ${changedFields.join(', ')}`,
          });
        });
      }
      
      return updated;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, baseCurrency, formData.amerGrossAttempts, formData.amerAnnualGMV, formData.amerCreditCardPct, formData.segmentationEnabled, formData.segments]);

  const costs = calculateInvestmentCosts(localInputs, formData);

  // Required solution state: needs input (off or $0) vs filled (on and > $0)
  const fraudMgmtCost = (costs.breakdown['Fraud Management'] || 0) + (costs.breakdown['Fraud CB Coverage'] || 0);
  const paymentOptCost = costs.breakdown['Payment Optimization'] || 0;
  const disputeMgmtCost = costs.breakdown['Dispute Management'] || 0;
  const abusePrevCost = costs.breakdown['Abuse Prevention'] || 0;
  const accountProtCost = (costs.breakdown['Login Protection'] || 0) + (costs.breakdown['Sign-up Protection'] || 0);

  const reqFraudNeedsInput = enabledSolutions.fraudManagement && (!localInputs.fraudManagement.enabled || fraudMgmtCost === 0);
  const reqFraudFilled = enabledSolutions.fraudManagement && localInputs.fraudManagement.enabled && fraudMgmtCost > 0;
  const reqPaymentNeedsInput = enabledSolutions.paymentOptimization && (!localInputs.paymentOptimization.enabled || paymentOptCost === 0);
  const reqPaymentFilled = enabledSolutions.paymentOptimization && localInputs.paymentOptimization.enabled && paymentOptCost > 0;
  const reqDisputeNeedsInput = enabledSolutions.disputeManagement && (!localInputs.disputeManagement.enabled || disputeMgmtCost === 0);
  const reqDisputeFilled = enabledSolutions.disputeManagement && localInputs.disputeManagement.enabled && disputeMgmtCost > 0;
  const reqAbuseNeedsInput = enabledSolutions.abusePrevention && (!localInputs.abusePrevention.enabled || abusePrevCost === 0);
  const reqAbuseFilled = enabledSolutions.abusePrevention && localInputs.abusePrevention.enabled && abusePrevCost > 0;
  const reqAccountNeedsInput = enabledSolutions.accountProtection && (!localInputs.accountProtection.enabled || accountProtCost === 0);
  const reqAccountFilled = enabledSolutions.accountProtection && localInputs.accountProtection.enabled && accountProtCost > 0;

  // handleSave removed - auto-save via useEffect

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const updateFraudManagement = (field: string, value: any) => {
    updateLocalInputs(prev => ({
      ...prev,
      fraudManagement: { ...prev.fraudManagement, [field]: value },
    }));
  };

  const updatePaymentOptimization = (field: string, value: any) => {
    updateLocalInputs(prev => ({
      ...prev,
      paymentOptimization: { ...prev.paymentOptimization, [field]: value },
    }));
  };

  const updateDisputeManagement = (field: string, value: any) => {
    updateLocalInputs(prev => ({
      ...prev,
      disputeManagement: { ...prev.disputeManagement, [field]: value },
    }));
  };

  const updateAbusePrevention = (field: string, value: any) => {
    updateLocalInputs(prev => ({
      ...prev,
      abusePrevention: { ...prev.abusePrevention, [field]: value },
    }));
  };

  const updateAccountProtection = (field: string, value: any) => {
    updateLocalInputs(prev => ({
      ...prev,
      accountProtection: { ...prev.accountProtection, [field]: value },
    }));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: formData.baseCurrency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Contract Settings JSX - inlined to prevent re-mount on state changes
  const contractSettingsJSX = (
    <Card className="p-4 space-y-6 bg-muted/30">
      <h4 className="font-medium">Contract Settings</h4>
      
      {/* Integration Cost */}
      <div className="space-y-2">
        <Label>Integration cost ({currencySymbol})</Label>
        <NumericInput
          value={localInputs.integrationCost}
          onChange={(v) => updateLocalInputs(prev => ({ ...prev, integrationCost: v || 0 }))}
          placeholder="0"
          formatWithCommas
        />
        <p className="text-xs text-muted-foreground">One-time cost applied in Year 1 only</p>
      </div>
      
      {/* Annual ACV Growth */}
      <div className="space-y-2">
        <Label>Annual ACV Growth (%)</Label>
        <NumericInput
          value={localInputs.annualACVGrowthPct ?? 0}
          onChange={(v) => updateLocalInputs(prev => ({ ...prev, annualACVGrowthPct: v || 0 }))}
          placeholder="0"
        />
        <p className="text-xs text-muted-foreground">Annual growth rate applied to investment cost (e.g., 5 = 5% per year)</p>
      </div>
      
      {/* Year-by-Year Discounts - only show years matching contract tenure */}
      <div className="space-y-3">
        <Label>Year-by-Year Investment Discount (%)</Label>
        <p className="text-xs text-muted-foreground">Enter discount % off full price (e.g., 50 = 50% off, pay half)</p>
        <div className={`grid gap-4 ${localInputs.contractTenure === 1 ? 'grid-cols-1' : localInputs.contractTenure === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Year 1</Label>
            <NumericInput
              value={localInputs.year1DiscountPct ?? 0}
              onChange={(v) => updateLocalInputs(prev => ({ ...prev, year1DiscountPct: v ?? 0 }))}
              placeholder="0"
            />
          </div>
          {localInputs.contractTenure >= 2 && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Year 2</Label>
              <NumericInput
                value={localInputs.year2DiscountPct ?? 0}
                onChange={(v) => updateLocalInputs(prev => ({ ...prev, year2DiscountPct: v ?? 0 }))}
                placeholder="0"
              />
            </div>
          )}
          {localInputs.contractTenure >= 3 && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Year 3</Label>
              <NumericInput
                value={localInputs.year3DiscountPct ?? 0}
                onChange={(v) => updateLocalInputs(prev => ({ ...prev, year3DiscountPct: v ?? 0 }))}
                placeholder="0"
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Enter Investment
          </DialogTitle>
          {isNotUSD && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md mt-2">
              <Info className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                Pricing converted from USD at rate: 1 USD = {exchangeRateFromUSD.toFixed(4)} {baseCurrency}
              </span>
            </div>
          )}
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'guided' | 'manual')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="guided" className="gap-2">
              <Calculator className="w-4 h-4" />
              Guided Pricing
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2">
              <Settings className="w-4 h-4" />
              Manual Override
            </TabsTrigger>
          </TabsList>

          {/* Manual Override Tab */}
          <TabsContent value="manual" className="space-y-4 mt-4">
            {/* Contract Settings at top */}
            {contractSettingsJSX}
            
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <Label>Enable Manual Override</Label>
                <Switch
                  checked={localInputs.manualOverride}
                  onCheckedChange={(checked) => 
                    updateLocalInputs(prev => ({ ...prev, manualOverride: checked }))
                  }
                />
              </div>
              
              {localInputs.manualOverride && (
                <div className="pt-4 border-t space-y-4">
                  <div className="space-y-2">
                    <Label>Forter Investment Cost ({currencySymbol})</Label>
                    <NumericInput
                      value={localInputs.manualInvestmentCost}
                      onChange={(v) => updateLocalInputs(prev => ({ ...prev, manualInvestmentCost: v }))}
                      placeholder="Enter annual investment"
                      formatWithCommas
                    />
                  </div>
                  
                  {/* Optional source link */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>Calculator Source Link</Label>
                      <Badge variant="outline" className="text-xs">Optional</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type="url"
                        value={localInputs.manualSourceUrl || ''}
                        onChange={(e) => updateLocalInputs(prev => ({ ...prev, manualSourceUrl: e.target.value }))}
                        placeholder="https://docs.google.com/spreadsheets/..."
                        className="flex-1"
                      />
                      {localInputs.manualSourceUrl && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => window.open(localInputs.manualSourceUrl, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Open calculator</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Share a Google Sheets link or other calculator reference for transparency
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Guided Pricing Tab */}
          <TabsContent value="guided" className="space-y-4 mt-4">
            {/* Contract Settings at top */}
            {contractSettingsJSX}

            {/* Fraud Management */}
            {(enabledSolutions.fraudManagement || isCustomMode) && (
              <Card className={cn(
                "overflow-hidden transition-colors",
                reqFraudNeedsInput && "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30 ring-2 ring-amber-500/20 dark:ring-amber-500/30"
              )}>
                <button
                  onClick={() => toggleSection('fraudManagement')}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={localInputs.fraudManagement.enabled}
                      onCheckedChange={(checked) => updateFraudManagement('enabled', checked)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    {reqFraudNeedsInput && (
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0" aria-hidden />
                    )}
                    <span className="font-medium">Fraud Management</span>
                    {enabledSolutions.fraudManagement && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs font-normal shrink-0",
                          reqFraudFilled
                            ? "border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-950/50 dark:text-green-200"
                            : "text-primary border-primary/50 bg-primary/5"
                        )}
                      >
                        Required Solution
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {localInputs.fraudManagement.enabled && (
                      <Badge variant="secondary" className="font-semibold">
                        {formatCurrency(costs.breakdown['Fraud Management'] || 0)}
                      </Badge>
                    )}
                    {expandedSections.fraudManagement ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </button>
                
                {expandedSections.fraudManagement && (
                  <div className="px-4 pb-4 space-y-4 border-t pt-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Number of annual transactions (#)</Label>
                        <NumericInput
                          value={localInputs.fraudManagement.annualTransactions}
                          onChange={(v) => updateFraudManagement('annualTransactions', v)}
                          placeholder={totalAttempts.toString() || '1,000,000'}
                          formatWithCommas
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Average Order Value - AOV ({currencySymbol})</Label>
                        <NumericInput
                          value={localInputs.fraudManagement.aov || (totalAttempts > 0 ? Math.round(totalGMV / totalAttempts) : undefined)}
                          onChange={(v) => updateFraudManagement('aov', v)}
                          placeholder={aov.toFixed(0)}
                          formatWithCommas
                        />
                        <p className="text-xs text-muted-foreground">
                          Calculated: {currencySymbol}{aov.toFixed(0)} (GMV ÷ Transactions)
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Cost per fraud decision ({currencySymbol})</Label>
                        <NumericInput
                          value={localInputs.fraudManagement.costPerDecision}
                          onChange={(v) => updateFraudManagement('costPerDecision', v)}
                          placeholder={convertPrice(getPriceByAOV(fraudManagementPricing, aov)).toFixed(2)}
                          decimalPlaces={2}
                        />
                        <p className="text-xs text-muted-foreground">
                          Default: {currencySymbol}{convertPrice(getPriceByAOV(fraudManagementPricing, aov)).toFixed(2)}
                          {isNotUSD && <span className="text-muted-foreground/70"> (${getPriceByAOV(fraudManagementPricing, aov).toFixed(2)} USD)</span>}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Discount (%)</Label>
                        <NumericInput
                          value={localInputs.fraudManagement.discount}
                          onChange={(v) => updateFraudManagement('discount', v)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    
                    {/* Fraud Chargeback Coverage Section */}
                    <div className="border-t pt-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="fraudCBCoverage"
                          checked={localInputs.fraudManagement.includesFraudCBCoverage || false}
                          onCheckedChange={(checked) => updateFraudManagement('includesFraudCBCoverage', !!checked)}
                        />
                        <Label htmlFor="fraudCBCoverage" className="cursor-pointer">
                          Includes Fraud Chargeback Coverage
                        </Label>
                      </div>
                      
                      {localInputs.fraudManagement.includesFraudCBCoverage && (
                        <div className="ml-7 space-y-2">
                          <Label>Coverage Take Rate (basis points)</Label>
                          <NumericInput
                            value={localInputs.fraudManagement.fraudCBCoverageTakeRate}
                            onChange={(v) => updateFraudManagement('fraudCBCoverageTakeRate', v)}
                            placeholder="15"
                          />
                          <p className="text-xs text-muted-foreground">
                            Applied to GMV. Default: 15 bps (0.15%)
                          </p>
                          {localInputs.fraudManagement.fraudCBCoverageTakeRate && (
                            <p className="text-xs text-muted-foreground">
                              Coverage cost: {formatCurrency((totalGMV || 0) * (localInputs.fraudManagement.fraudCBCoverageTakeRate / 10000))}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Solution Total */}
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Fraud Management Total</span>
                      <span className="text-lg font-semibold text-primary">
                        {formatCurrency((costs.breakdown['Fraud Management'] || 0) + (costs.breakdown['Fraud CB Coverage'] || 0))}
                      </span>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Payment Optimization */}
            {(enabledSolutions.paymentOptimization || isCustomMode) && (
              <Card className={cn(
                "overflow-hidden transition-colors",
                reqPaymentNeedsInput && "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30 ring-2 ring-amber-500/20 dark:ring-amber-500/30"
              )}>
                <button
                  onClick={() => toggleSection('paymentOptimization')}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={localInputs.paymentOptimization.enabled}
                      onCheckedChange={(checked) => updatePaymentOptimization('enabled', checked)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    {reqPaymentNeedsInput && (
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0" aria-hidden />
                    )}
                    <span className="font-medium">Payment Optimization</span>
                    {enabledSolutions.paymentOptimization && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs font-normal shrink-0",
                          reqPaymentFilled
                            ? "border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-950/50 dark:text-green-200"
                            : "text-primary border-primary/50 bg-primary/5"
                        )}
                      >
                        Required Solution
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {localInputs.paymentOptimization.enabled && (
                      <Badge variant="secondary" className="font-semibold">
                        {formatCurrency(costs.breakdown['Payment Optimization'] || 0)}
                      </Badge>
                    )}
                    {expandedSections.paymentOptimization ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </button>
                
                {expandedSections.paymentOptimization && (
                  <div className="px-4 pb-4 space-y-4 border-t pt-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Number of annual transactions (#)</Label>
                        <NumericInput
                          value={localInputs.paymentOptimization.annualTransactions}
                          onChange={(v) => updatePaymentOptimization('annualTransactions', v)}
                          placeholder={totalAttempts.toString() || '1,000,000'}
                          formatWithCommas
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>% of credit card traffic</Label>
                        <NumericInput
                          value={localInputs.paymentOptimization.creditCardTrafficPct}
                          onChange={(v) => updatePaymentOptimization('creditCardTrafficPct', v)}
                          placeholder={formData.amerCreditCardPct?.toString() || "80"}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cost per payment optimization decision ({currencySymbol})</Label>
                        <NumericInput
                          value={localInputs.paymentOptimization.costPerDecision}
                          onChange={(v) => updatePaymentOptimization('costPerDecision', v)}
                          placeholder={convertPrice(0.02).toFixed(2)}
                          decimalPlaces={2}
                        />
                        <p className="text-xs text-muted-foreground">
                          Default: {currencySymbol}{convertPrice(0.02).toFixed(2)}
                          {isNotUSD && <span className="text-muted-foreground/70"> ($0.02 USD)</span>}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Discount (%)</Label>
                        <NumericInput
                          value={localInputs.paymentOptimization.discount}
                          onChange={(v) => updatePaymentOptimization('discount', v)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    {/* Solution Total */}
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Payment Optimization Total</span>
                      <span className="text-lg font-semibold text-primary">
                        {formatCurrency(costs.breakdown['Payment Optimization'] || 0)}
                      </span>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Dispute Management */}
            {(enabledSolutions.disputeManagement || isCustomMode) && (
              <Card className={cn(
                "overflow-hidden transition-colors",
                reqDisputeNeedsInput && "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30 ring-2 ring-amber-500/20 dark:ring-amber-500/30"
              )}>
                <button
                  onClick={() => toggleSection('disputeManagement')}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={localInputs.disputeManagement.enabled}
                      onCheckedChange={(checked) => updateDisputeManagement('enabled', checked)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    {reqDisputeNeedsInput && (
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0" aria-hidden />
                    )}
                    <span className="font-medium">Dispute Management</span>
                    {enabledSolutions.disputeManagement && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs font-normal shrink-0",
                          reqDisputeFilled
                            ? "border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-950/50 dark:text-green-200"
                            : "text-primary border-primary/50 bg-primary/5"
                        )}
                      >
                        Required Solution
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {localInputs.disputeManagement.enabled && (
                      <Badge variant="secondary" className="font-semibold">
                        {formatCurrency(costs.breakdown['Dispute Management'] || 0)}
                      </Badge>
                    )}
                    {expandedSections.disputeManagement ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </button>
                
                {expandedSections.disputeManagement && (
                  <div className="px-4 pb-4 space-y-4 border-t pt-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Value of won chargebacks ({currencySymbol})</Label>
                        <NumericInput
                          value={localInputs.disputeManagement.valueOfWonChargebacks}
                          onChange={(v) => updateDisputeManagement('valueOfWonChargebacks', v)}
                          placeholder="0"
                          formatWithCommas
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Revenue share (%)</Label>
                        <NumericInput
                          value={localInputs.disputeManagement.revenueSharePct}
                          onChange={(v) => updateDisputeManagement('revenueSharePct', v)}
                          placeholder="20"
                        />
                      </div>
                    </div>
                    {/* Solution Total */}
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Dispute Management Total</span>
                      <span className="text-lg font-semibold text-primary">
                        {formatCurrency(costs.breakdown['Dispute Management'] || 0)}
                      </span>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Policy Abuse Prevention */}
            {(enabledSolutions.abusePrevention || isCustomMode) && (
              <Card className={cn(
                "overflow-hidden transition-colors",
                reqAbuseNeedsInput && "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30 ring-2 ring-amber-500/20 dark:ring-amber-500/30"
              )}>
                <button
                  onClick={() => toggleSection('abusePrevention')}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={localInputs.abusePrevention.enabled}
                      onCheckedChange={(checked) => updateAbusePrevention('enabled', checked)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    {reqAbuseNeedsInput && (
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0" aria-hidden />
                    )}
                    <span className="font-medium">Policy Abuse Prevention</span>
                    {enabledSolutions.abusePrevention && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs font-normal shrink-0",
                          reqAbuseFilled
                            ? "border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-950/50 dark:text-green-200"
                            : "text-primary border-primary/50 bg-primary/5"
                        )}
                      >
                        Required Solution
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {localInputs.abusePrevention.enabled && (
                      <Badge variant="secondary" className="font-semibold">
                        {formatCurrency(costs.breakdown['Abuse Prevention'] || 0)}
                      </Badge>
                    )}
                    {expandedSections.abusePrevention ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </button>
                
                {expandedSections.abusePrevention && (
                  <div className="px-4 pb-4 space-y-4 border-t pt-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Number of annual transactions (#)</Label>
                        <NumericInput
                          value={localInputs.abusePrevention.annualTransactions}
                          onChange={(v) => updateAbusePrevention('annualTransactions', v)}
                          placeholder={totalAttempts.toString() || '1,000,000'}
                          formatWithCommas
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cost per abuse decision ({currencySymbol})</Label>
                        <NumericInput
                          value={localInputs.abusePrevention.costPerDecision}
                          onChange={(v) => updateAbusePrevention('costPerDecision', v)}
                          placeholder={convertPrice(getPriceByAOV(abusePreventionPricing, aov)).toFixed(2)}
                          decimalPlaces={2}
                        />
                        <p className="text-xs text-muted-foreground">
                          Default: {currencySymbol}{convertPrice(getPriceByAOV(abusePreventionPricing, aov)).toFixed(2)}
                          {isNotUSD && <span className="text-muted-foreground/70"> (${getPriceByAOV(abusePreventionPricing, aov).toFixed(2)} USD)</span>}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Discount (%)</Label>
                        <NumericInput
                          value={localInputs.abusePrevention.discount}
                          onChange={(v) => updateAbusePrevention('discount', v)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    {/* Solution Total */}
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Policy Abuse Prevention Total</span>
                      <span className="text-lg font-semibold text-primary">
                        {formatCurrency(costs.breakdown['Abuse Prevention'] || 0)}
                      </span>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Account Protection */}
            {(enabledSolutions.accountProtection || isCustomMode) && (
              <Card className={cn(
                "overflow-hidden transition-colors",
                reqAccountNeedsInput && "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30 ring-2 ring-amber-500/20 dark:ring-amber-500/30"
              )}>
                <button
                  onClick={() => toggleSection('accountProtection')}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={localInputs.accountProtection.enabled}
                      onCheckedChange={(checked) => updateAccountProtection('enabled', checked)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    {reqAccountNeedsInput && (
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0" aria-hidden />
                    )}
                    <span className="font-medium">Account Protection</span>
                    {enabledSolutions.accountProtection && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs font-normal shrink-0",
                          reqAccountFilled
                            ? "border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-950/50 dark:text-green-200"
                            : "text-primary border-primary/50 bg-primary/5"
                        )}
                      >
                        Required Solution
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {localInputs.accountProtection.enabled && (
                      <Badge variant="secondary" className="font-semibold">
                        {formatCurrency((costs.breakdown['Login Protection'] || 0) + (costs.breakdown['Sign-up Protection'] || 0))}
                      </Badge>
                    )}
                    {expandedSections.accountProtection ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </button>
                
                {expandedSections.accountProtection && (
                  <div className="px-4 pb-4 space-y-4 border-t pt-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Annual number of logins (#)</Label>
                        <NumericInput
                          value={localInputs.accountProtection.annualLogins}
                          onChange={(v) => updateAccountProtection('annualLogins', v)}
                          placeholder={((formData.monthlyLogins || 0) * 12).toString() || '180,000'}
                          formatWithCommas
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cost per API call - Login ({currencySymbol})</Label>
                        <NumericInput
                          value={localInputs.accountProtection.costPerAPICall}
                          onChange={(v) => updateAccountProtection('costPerAPICall', v)}
                          placeholder={convertPrice(0.02).toFixed(2)}
                          decimalPlaces={2}
                        />
                        <p className="text-xs text-muted-foreground">
                          Default: {currencySymbol}{convertPrice(0.02).toFixed(2)}
                          {isNotUSD && <span className="text-muted-foreground/70"> ($0.02 USD)</span>}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Annual number of sign-ups (#)</Label>
                        <NumericInput
                          value={localInputs.accountProtection.annualSignups}
                          onChange={(v) => updateAccountProtection('annualSignups', v)}
                          placeholder={((formData.monthlySignups || 0) * 12).toString() || '60,000'}
                          formatWithCommas
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cost per API call - Sign-up ({currencySymbol})</Label>
                        <NumericInput
                          value={localInputs.accountProtection.signupCostPerAPICall}
                          onChange={(v) => updateAccountProtection('signupCostPerAPICall', v)}
                          placeholder={convertPrice(0.50).toFixed(2)}
                          decimalPlaces={2}
                        />
                        <p className="text-xs text-muted-foreground">
                          Default: {currencySymbol}{convertPrice(0.50).toFixed(2)}
                          {isNotUSD && <span className="text-muted-foreground/70"> ($0.50 USD)</span>}
                        </p>
                      </div>
                    </div>
                    {/* Solution Total */}
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Account Protection Total</span>
                      <span className="text-lg font-semibold text-primary">
                        {formatCurrency((costs.breakdown['Login Protection'] || 0) + (costs.breakdown['Sign-up Protection'] || 0))}
                      </span>
                    </div>
                  </div>
                )}
              </Card>
            )}
            
            {/* Custom Investment Items */}
            <Card className="overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-medium">Custom Investment Items</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newItem: CustomInvestmentItem = {
                        id: crypto.randomUUID(),
                        name: '',
                        amount: 0,
                      };
                      updateLocalInputs(prev => ({
                        ...prev,
                        customItems: [...(prev.customItems || []), newItem],
                      }));
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Item
                  </Button>
                </div>
                
                {(!localInputs.customItems || localInputs.customItems.length === 0) ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No custom items added. Click "Add Item" to include additional investment costs.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {localInputs.customItems.map((item, index) => (
                      <div key={item.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
                        <div className="space-y-1">
                          <Label className="text-xs">Name</Label>
                          <Input
                            value={item.name}
                            onChange={(e) => {
                              const updatedItems = [...(localInputs.customItems || [])];
                              updatedItems[index] = { ...item, name: e.target.value };
                              updateLocalInputs(prev => ({ ...prev, customItems: updatedItems }));
                            }}
                            placeholder="Investment name"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Amount ({currencySymbol})</Label>
                          <NumericInput
                            value={item.amount}
                            onChange={(v) => {
                              const updatedItems = [...(localInputs.customItems || [])];
                              updatedItems[index] = { ...item, amount: v || 0 };
                              updateLocalInputs(prev => ({ ...prev, customItems: updatedItems }));
                            }}
                            placeholder="0"
                            formatWithCommas
                            className="w-32"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Link (optional)</Label>
                          <div className="flex gap-1">
                            <Input
                              value={item.sourceUrl || ''}
                              onChange={(e) => {
                                const updatedItems = [...(localInputs.customItems || [])];
                                updatedItems[index] = { ...item, sourceUrl: e.target.value };
                                updateLocalInputs(prev => ({ ...prev, customItems: updatedItems }));
                              }}
                              placeholder="https://..."
                              className="w-40"
                            />
                            {item.sourceUrl && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9"
                                onClick={() => window.open(item.sourceUrl, '_blank')}
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            const updatedItems = (localInputs.customItems || []).filter((_, i) => i !== index);
                            updateLocalInputs(prev => ({ ...prev, customItems: updatedItems }));
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    
                    {/* Custom Items Total */}
                    {localInputs.customItems.some(item => item.amount > 0) && (
                      <div className="mt-4 p-3 bg-muted/50 rounded-lg flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Custom Items Total</span>
                        <span className="text-lg font-semibold text-primary">
                          {formatCurrency(
                            Object.entries(costs.breakdown)
                              .filter(([key]) => key.startsWith('Custom:'))
                              .reduce((sum, [, val]) => sum + val, 0)
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Summary Footer */}
        <div className="border-t pt-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Annual Investment</p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(costs.totalACV)}
              </p>
            </div>
            {costs.integrationCost > 0 && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Integration Cost</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(costs.integrationCost)}
                </p>
              </div>
            )}
            <Button onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Changes are saved automatically</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}