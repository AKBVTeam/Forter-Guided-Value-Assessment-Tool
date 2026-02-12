import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalculatorData } from "@/pages/Index";
import { InvestmentModal } from "./InvestmentModal";
import { ValueTotals } from "./ValueSummaryOptionA";
import {
  InvestmentInputs,
  defaultInvestmentInputs,
  calculateROI,
  calculateInvestmentCosts,
  ContractTenure,
} from "@/lib/roiCalculations";
import { getCurrencySymbol } from "@/lib/benchmarkData";
import { DollarSign, TrendingUp, Clock, Calculator, Plus, Info, RotateCcw, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { IncludeExcludeChip } from "./IncludeExcludeChip";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getChallengeBenefitContent } from "@/lib/challengeBenefitContent";
import { ForterKPIs } from "./ForterKPIConfig";

// Map benefit types to challenge IDs for popup modals
const BENEFIT_CHALLENGE_MAP: Record<string, string[]> = {
  'cost_reduction': ['3', '7', '9', '12'],  // Manual review, disputes, CS OpEx, ATO OpEx
  'risk_mitigation': ['1', '8', '10'],      // Fraud CB, Returns abuse, INR abuse, Promotion abuse
  'saas_cost': [],                           // No calculator for SaaS cost
};

// Fallback: map challengeId to a default calculatorId when breakdown has no calculatorId (e.g. legacy)
const CHALLENGE_ID_TO_CALCULATOR_ID: Record<string, string> = {
  '1': 'c1-revenue', '2': 'c245-revenue', '3': 'c3-manual-review', '7': 'c7-disputes',
  '8': 'c8-returns', '9': 'c9-cs', '10': 'c10-inr', '12': 'c12-ato', '13': 'c13-promo', '14': 'c14-signup',
};
function getCalculatorIdForBenefit(item: { challengeId?: string; calculatorId?: string }): string | undefined {
  return item.calculatorId ?? (item.challengeId ? CHALLENGE_ID_TO_CALCULATOR_ID[item.challengeId] ?? item.challengeId : undefined);
}

interface ROITabProps {
  formData: CalculatorData;
  selectedChallenges: Record<string, boolean>;
  valueTotals: ValueTotals;
  showInMillions: boolean;
  onShowInMillionsChange: (value: boolean) => void;
  investmentInputs: InvestmentInputs;
  onInvestmentInputsChange: (inputs: InvestmentInputs) => void;
  showInvestmentRowsToggle?: boolean;
  onShowInvestmentRowsToggleChange?: (value: boolean) => void;
  onFormDataChange?: (updates: Partial<CalculatorData>) => void;
  onForterKPIChange?: (updates: Partial<ForterKPIs>) => void;
  // Sub-calculation breakdowns for expandable sections
  gmvUpliftBreakdown?: Array<{ label: string; value: number; challengeId?: string; calculatorId?: string }>;
  costReductionBreakdown?: Array<{ label: string; value: number; challengeId?: string; calculatorId?: string }>;
  riskMitigationBreakdown?: Array<{ label: string; value: number; challengeId?: string; calculatorId?: string }>;
  isCustomMode?: boolean;
  // Callback to open calculator in Value Summary tab
  onOpenCalculator?: (calculatorId: string) => void;
}

export function ROITab({ 
  formData, 
  selectedChallenges, 
  valueTotals, 
  showInMillions, 
  onShowInMillionsChange,
  investmentInputs,
  onInvestmentInputsChange,
  showInvestmentRowsToggle = true,
  onShowInvestmentRowsToggleChange,
  onFormDataChange,
  onForterKPIChange,
  gmvUpliftBreakdown = [],
  costReductionBreakdown = [],
  riskMitigationBreakdown = [],
  isCustomMode = false,
  onOpenCalculator,
}: ROITabProps) {
  const [showInvestmentModal, setShowInvestmentModal] = useState(false);
  
  // Local state for number inputs to prevent bouncing during typing
  const [localMonths, setLocalMonths] = useState(investmentInputs.monthsToIntegrate.toString());
  const [localGrowth, setLocalGrowth] = useState(investmentInputs.annualSalesGrowthPct.toString());
  
  // Custom effective realization overrides (null means use calculated value)
  const [customEffectiveRealization, setCustomEffectiveRealization] = useState<Record<number, number | null>>({});
  const [editingRealization, setEditingRealization] = useState<number | null>(null);
  const [editRealizationValue, setEditRealizationValue] = useState("");
  
  // Collapsible section states (default collapsed)
  const [gmvUpliftExpanded, setGmvUpliftExpanded] = useState(false);
  const [costReductionExpanded, setCostReductionExpanded] = useState(false);
  const [riskMitigationExpanded, setRiskMitigationExpanded] = useState(false);
  const [saasExpanded, setSaasExpanded] = useState(false);
  
  // Benefit modal state
  const [selectedBenefit, setSelectedBenefit] = useState<{ challengeId: string; title: string } | null>(null);
  
  // Sync local state when parent changes (e.g., from modal)
  useEffect(() => {
    setLocalMonths(investmentInputs.monthsToIntegrate.toString());
    setLocalGrowth(investmentInputs.annualSalesGrowthPct.toString());
  }, [investmentInputs.monthsToIntegrate, investmentInputs.annualSalesGrowthPct]);

  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    const displayValue = showInMillions ? absValue / 1000000 : absValue;
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: formData.baseCurrency || 'USD',
      minimumFractionDigits: showInMillions ? 1 : 0,
      maximumFractionDigits: showInMillions ? 1 : 0,
    }).format(displayValue);
    const suffix = showInMillions ? 'M' : '';
    const result = `${formatted}${suffix}`;
    // Use brackets for negative values (costs)
    return value < 0 ? `(${result})` : result;
  };

  const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

  const roiResults = useMemo(() => {
    return calculateROI(formData, valueTotals, investmentInputs);
  }, [formData, valueTotals, investmentInputs]);

  const investmentCosts = useMemo(() => {
    return calculateInvestmentCosts(investmentInputs, formData);
  }, [investmentInputs, formData]);

  const handleContractTenureChange = (value: string) => {
    onInvestmentInputsChange({
      ...investmentInputs,
      contractTenure: parseInt(value) as ContractTenure,
    });
  };

  const handleMonthsToIntegrateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalMonths(e.target.value);
  };
  
  const handleMonthsToIntegrateBlur = () => {
    const value = parseInt(localMonths) || 0;
    const clampedValue = Math.max(0, Math.min(12, value));
    setLocalMonths(clampedValue.toString());
    onInvestmentInputsChange({
      ...investmentInputs,
      monthsToIntegrate: clampedValue,
    });
  };

  const handleAnnualGrowthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalGrowth(e.target.value);
  };
  
  const handleAnnualGrowthBlur = () => {
    const value = parseFloat(localGrowth) || 0;
    const clampedValue = Math.max(0, value);
    setLocalGrowth(clampedValue.toString());
    const acvCurrentlyLinked = investmentInputs.annualACVGrowthPct === investmentInputs.annualSalesGrowthPct;
    onInvestmentInputsChange({
      ...investmentInputs,
      annualSalesGrowthPct: clampedValue,
      annualACVGrowthPct: acvCurrentlyLinked ? clampedValue : investmentInputs.annualACVGrowthPct,
    });
  };

  const relevantYears = roiResults.yearProjections.slice(0, investmentInputs.contractTenure);

  // Get effective realization for a year (use custom if set, otherwise calculated)
  const getEffectiveRealization = (year: number): number => {
    const calculated = year === 1 ? (12 - investmentInputs.monthsToIntegrate) / 12 : 1;
    return customEffectiveRealization[year] ?? calculated;
  };
  
  // Check if any year has a custom override
  const hasCustomRealization = (year: number) => customEffectiveRealization[year] !== undefined && customEffectiveRealization[year] !== null;

  // Reset to calculated value
  const resetRealization = (year: number) => {
    setCustomEffectiveRealization(prev => {
      const updated = { ...prev };
      delete updated[year];
      return updated;
    });
  };

  // Handle editing
  const handleStartEditRealization = (year: number, currentValue: number) => {
    setEditingRealization(year);
    setEditRealizationValue((currentValue * 100).toFixed(0));
  };

  const handleEndEditRealization = (year: number) => {
    const value = parseFloat(editRealizationValue);
    if (!isNaN(value)) {
      const clampedValue = Math.max(0, Math.min(100, value)) / 100;
      setCustomEffectiveRealization(prev => ({ ...prev, [year]: clampedValue }));
    }
    setEditingRealization(null);
    setEditRealizationValue("");
  };

  // Recalculate year projections with custom effective realization
  const adjustedYearProjections = useMemo(() => {
    return relevantYears.map(y => {
      const effectiveRealization = getEffectiveRealization(y.year);
      const runRateGrossEBITDA = y.totalProfitabilityContribution * effectiveRealization;
      const netEBITDAContribution = runRateGrossEBITDA - y.forterSaaSCost - y.integrationCost;
      return {
        ...y,
        effectiveRealization,
        runRateGrossEBITDA,
        netEBITDAContribution,
      };
    });
  }, [relevantYears, customEffectiveRealization, investmentInputs.monthsToIntegrate]);

  // Recalculate totals
  const adjustedTotalProjection = useMemo(() => {
    return {
      ...roiResults.totalProjection,
      runRateGrossEBITDA: adjustedYearProjections.reduce((sum, y) => sum + y.runRateGrossEBITDA, 0),
      netEBITDAContribution: adjustedYearProjections.reduce((sum, y) => sum + y.netEBITDAContribution, 0),
    };
  }, [adjustedYearProjections, roiResults.totalProjection]);

  // Check if values exist to conditionally show rows
  const hasGMVUplift = roiResults.totalProjection.gmvUplift > 0;
  const hasCostReduction = roiResults.totalProjection.costReduction > 0;
  const hasRiskMitigation = roiResults.totalProjection.riskMitigation > 0;
  
  // Check if investment should be shown - either costs exist OR any investment solution is enabled
  const hasAnyInvestmentEnabled = 
    investmentInputs.fraudManagement.enabled ||
    investmentInputs.paymentOptimization.enabled ||
    investmentInputs.disputeManagement.enabled ||
    investmentInputs.abusePrevention.enabled ||
    investmentInputs.accountProtection.enabled ||
    investmentInputs.pricingMode === 'manual' ||
    investmentInputs.manualOverride ||
    investmentInputs.integrationCost > 0;
  const hasInvestmentData = roiResults.hasInvestment || hasAnyInvestmentEnabled;
  
  // Final visibility: has data AND toggle is on
  const showInvestmentRows = hasInvestmentData && showInvestmentRowsToggle;

  return (
    <div className="space-y-6">
      {/* Header with Enter Investment Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">ROI Analysis</h3>
          <p className="text-sm text-muted-foreground">
            {showInvestmentRows 
              ? "Net EBITDA contribution after investment"
              : "Gross EBITDA contribution (no investment entered)"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            onClick={() => setShowInvestmentModal(true)}
            size="sm"
            className={`gap-1.5 ${!hasInvestmentData ? "animate-pulse ring-2 ring-primary ring-offset-2" : ""}`}
          >
            <Plus className="w-3.5 h-3.5" />
            Enter Investment
          </Button>
          <div className="flex items-center gap-2">
            <Switch
              id="show-millions-roi"
              checked={showInMillions}
              onCheckedChange={onShowInMillionsChange}
            />
            <Label htmlFor="show-millions-roi" className="text-sm">Show in Millions</Label>
          </div>
        </div>
      </div>

      {/* ROI Settings Row */}
      <Card className="p-4">
        <div className="flex items-center gap-4 lg:gap-6">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">Contract Tenure:</Label>
            <Select
              value={investmentInputs.contractTenure.toString()}
              onValueChange={handleContractTenureChange}
            >
              <SelectTrigger className="w-[90px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Year</SelectItem>
                <SelectItem value="2">2 Years</SelectItem>
                <SelectItem value="3">3 Years</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">Months to Integrate:</Label>
            <Input
              type="number"
              min={0}
              max={12}
              value={localMonths}
              onChange={handleMonthsToIntegrateChange}
              onBlur={handleMonthsToIntegrateBlur}
              className="w-16"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">Annual Sales Growth (%):</Label>
            <Input
              type="number"
              min={0}
              step={0.5}
              value={localGrowth}
              onChange={handleAnnualGrowthChange}
              onBlur={handleAnnualGrowthBlur}
              className="w-16"
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3.5 h-3.5 cursor-help text-muted-foreground/70 hover:text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs">Growth rate applied to <strong>benefits only</strong> (GMV uplift, cost reduction, risk mitigation). SaaS cost remains flat across contract period.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {hasInvestmentData && (
            <div
              className={`flex items-center gap-2 ml-auto rounded-md p-1.5 transition-[box-shadow,outline] ${
                !showInvestmentRowsToggle ? "animate-pulse ring-2 ring-primary ring-offset-2" : ""
              }`}
            >
              <Switch
                id="show-investment-rows"
                checked={showInvestmentRowsToggle}
                onCheckedChange={onShowInvestmentRowsToggleChange ?? (() => {})}
              />
              <Label htmlFor="show-investment-rows" className="text-sm text-muted-foreground whitespace-nowrap">Show Investment</Label>
            </div>
          )}
        </div>
      </Card>

      {/* Key Metrics Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm">{investmentInputs.contractTenure} Year {showInvestmentRows ? 'Net' : 'Gross'} EBITDA</span>
          </div>
          <p className="text-2xl font-bold text-primary">
            {formatCurrency(showInvestmentRows 
              ? roiResults.totalProjection.netEBITDAContribution 
              : roiResults.totalProjection.runRateGrossEBITDA)}
          </p>
        </Card>

        <Card className={`p-4 ${!showInvestmentRows ? 'bg-muted/50 opacity-75' : ''}`}>
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">{investmentInputs.contractTenure} Year ROI</span>
            {showInvestmentRows && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3.5 h-3.5 cursor-help text-muted-foreground/70 hover:text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-md p-3">
                    <p className="font-medium mb-1">Return on Investment Calculation</p>
                    <p className="text-xs text-muted-foreground mb-2">For every $1 of investment, this is the return the merchant can expect to receive.</p>
                    <div className="text-xs space-y-1 font-mono bg-muted/50 p-2 rounded">
                      <p><strong>a.</strong> Total Benefit (Effective Gross EBITDA) = {formatCurrency(roiResults.totalProjection.runRateGrossEBITDA)}</p>
                      <p><strong>b.</strong> Total SaaS Cost ({investmentInputs.contractTenure} years) = {formatCurrency(roiResults.totalProjection.forterSaaSCost)}</p>
                      <p><strong>c.</strong> Integration Cost = {formatCurrency(roiResults.totalProjection.integrationCost)}</p>
                      <p><strong>d.</strong> Total Investment (b + c) = {formatCurrency(roiResults.totalProjection.forterSaaSCost + roiResults.totalProjection.integrationCost)}</p>
                      <div className="border-t pt-2 mt-2">
                        <p><strong>ROI = (a - d) ÷ d</strong></p>
                        <p>= ({formatCurrency(roiResults.totalProjection.runRateGrossEBITDA)} - {formatCurrency(roiResults.totalProjection.forterSaaSCost + roiResults.totalProjection.integrationCost)}) ÷ {formatCurrency(roiResults.totalProjection.forterSaaSCost + roiResults.totalProjection.integrationCost)}</p>
                        <p className="font-bold text-primary mt-1">= {roiResults.roi.toFixed(2)}x</p>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {showInvestmentRows ? (
            <p className="text-2xl font-bold text-primary">
              {roiResults.roi.toFixed(1)}x
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Enter investment costs to calculate
            </p>
          )}
        </Card>

        <Card className={`p-4 ${!showInvestmentRows ? 'bg-muted/50 opacity-75' : ''}`}>
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Payback Period</span>
            {showInvestmentRows && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3.5 h-3.5 cursor-help text-muted-foreground/70 hover:text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-md p-3">
                    <p className="font-medium mb-1">Payback Period Calculation</p>
                    <p className="text-xs text-muted-foreground mb-2">Number of months before merchant can expect to recoup their investment and be net positive.</p>
                    <div className="text-xs space-y-1 font-mono bg-muted/50 p-2 rounded">
                      <p><strong>a.</strong> Year 1 SaaS Cost = {formatCurrency(investmentCosts.totalACV)}</p>
                      <p><strong>b.</strong> Integration Cost = {formatCurrency(investmentCosts.integrationCost)}</p>
                      <p><strong>c.</strong> Year 1 Investment (a + b) = {formatCurrency(investmentCosts.totalACV + investmentCosts.integrationCost)}</p>
                      <p><strong>d.</strong> Year 1 Effective EBITDA = {formatCurrency(roiResults.yearProjections[0]?.runRateGrossEBITDA || 0)}</p>
                      <p><strong>e.</strong> Active Months in Year 1 = {12 - investmentInputs.monthsToIntegrate}</p>
                      <p><strong>f.</strong> Monthly Benefit (d ÷ e) = {formatCurrency((roiResults.yearProjections[0]?.runRateGrossEBITDA || 0) / Math.max(1, 12 - investmentInputs.monthsToIntegrate))}</p>
                      <div className="border-t pt-2 mt-2">
                        <p><strong>Payback = Integration months + (c ÷ f)</strong></p>
                        <p>= {investmentInputs.monthsToIntegrate} + {Math.ceil((investmentCosts.totalACV + investmentCosts.integrationCost) / Math.max(1, (roiResults.yearProjections[0]?.runRateGrossEBITDA || 0) / Math.max(1, 12 - investmentInputs.monthsToIntegrate)))} months</p>
                        <p className="font-bold text-primary mt-1">= {roiResults.paybackPeriodMonths} months</p>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {showInvestmentRows ? (
            <p className="text-2xl font-bold text-primary">
              {roiResults.paybackPeriodMonths === -1 
                ? 'N/A' 
                : roiResults.paybackPeriodMonths === 0 
                  ? 'Immediate' 
                  : `${roiResults.paybackPeriodMonths} months`}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Enter investment costs to calculate
            </p>
          )}
        </Card>
      </div>

      {/* Year Projection Table */}
      <Card className="p-4">
        <h4 className="font-medium mb-4 flex items-center gap-2">
          <Calculator className="w-4 h-4" />
          {investmentInputs.contractTenure} Year Projection
          {investmentInputs.annualSalesGrowthPct > 0 && (
            <span className="text-xs font-normal text-muted-foreground ml-2">
              (Benefits apply {investmentInputs.annualSalesGrowthPct}% annual growth; SaaS cost is flat)
            </span>
          )}
        </h4>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Metric</TableHead>
              {relevantYears.map(y => (
                <TableHead key={y.year} className="text-right">Year {y.year}</TableHead>
              ))}
              <TableHead className="text-right font-semibold">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* GMV Uplift Context Section - shown for context only, not included in EBITDA sum */}
            {hasGMVUplift && (
              <>
                <TableRow className="bg-muted/20">
                  <TableCell className="text-muted-foreground italic">
                    <span className="flex items-center gap-2">
                      GMV uplift
                      <span className="text-xs font-normal">(for reference)</span>
                    </span>
                  </TableCell>
                  {relevantYears.map(y => (
                    <TableCell key={y.year} className="text-right text-muted-foreground italic">
                      {formatCurrency(y.gmvUplift)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right text-muted-foreground italic">
                    {formatCurrency(roiResults.totalProjection.gmvUplift)}
                  </TableCell>
                </TableRow>

                <TableRow className="bg-muted/20">
                  <TableCell className="text-muted-foreground pl-6 text-xs">× Commission rate</TableCell>
                  {relevantYears.map(y => (
                    <TableCell key={y.year} className="text-right text-muted-foreground text-xs">
                      {formData.isMarketplace ? `${formData.commissionRate || 25}%` : '100%'}
                    </TableCell>
                  ))}
                  <TableCell className="text-right text-muted-foreground text-xs">-</TableCell>
                </TableRow>

                <TableRow className="bg-muted/20">
                  <TableCell className="text-muted-foreground pl-6 text-xs">× Gross margin</TableCell>
                  {relevantYears.map(y => (
                    <TableCell key={y.year} className="text-right text-muted-foreground text-xs">
                      {formData.amerGrossMarginPercent || 50}%
                    </TableCell>
                  ))}
                  <TableCell className="text-right text-muted-foreground text-xs">-</TableCell>
                </TableRow>
              </>
            )}

            {/* EBITDA Components Section - these 3 rows sum to Total */}
            {/* Visual indicator: left border to show these are the addends */}
            {hasGMVUplift && (
              <>
                <TableRow 
                  className="border-l-4 border-l-primary/50 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => setGmvUpliftExpanded(!gmvUpliftExpanded)}
                >
                  <TableCell className="font-medium text-primary">
                    <span className="flex items-center gap-1">
                      {gmvUpliftExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <span className="text-xs text-muted-foreground mr-1">+</span>
                      Profitability contribution from GMV
                    </span>
                  </TableCell>
                  {relevantYears.map(y => (
                    <TableCell key={y.year} className="text-right font-medium text-primary">
                      {formatCurrency(y.profitabilityFromGMV)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-semibold text-primary">
                    {formatCurrency(roiResults.totalProjection.profitabilityFromGMV)}
                  </TableCell>
                </TableRow>
                {gmvUpliftExpanded && gmvUpliftBreakdown.map((item, idx) => {
                  // Apply margin to GMV breakdown items
                  const marginMultiplier = (formData.isMarketplace ? (formData.commissionRate || 25) : (formData.amerGrossMarginPercent || 50)) / 100;
                  const itemProfitability = item.value * marginMultiplier;
                  return (
                    <TableRow key={`gmv-${idx}`} className="bg-muted/10">
                      <TableCell className="pl-10 text-sm text-muted-foreground">
                        <span className="flex items-center gap-2">
                          {item.label}
                          {(item.calculatorId || item.challengeId) && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                const calcId = getCalculatorIdForBenefit(item);
                                if (onOpenCalculator && calcId) {
                                  onOpenCalculator(calcId);
                                } else {
                                  setSelectedBenefit({ 
                                    challengeId: item.challengeId!, 
                                    title: item.label 
                                  });
                                }
                              }}
                              className="text-primary hover:text-primary/80 transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                      </TableCell>
                      {relevantYears.map((y, yIdx) => (
                        <TableCell key={yIdx} className="text-right text-sm text-muted-foreground">
                          {formatCurrency(itemProfitability * Math.pow(1 + investmentInputs.annualSalesGrowthPct / 100, y.year - 1) * (y.year === 1 ? getEffectiveRealization(1) : 1))}
                        </TableCell>
                      ))}
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatCurrency(relevantYears.reduce((sum, y) => sum + itemProfitability * Math.pow(1 + investmentInputs.annualSalesGrowthPct / 100, y.year - 1), 0))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </>
            )}

            {/* Cost Reduction - only show if > 0, with collapsible sub-calculations */}
            {hasCostReduction && (
              <>
                <TableRow 
                  className="border-l-4 border-l-primary/50 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => setCostReductionExpanded(!costReductionExpanded)}
                >
                  <TableCell className="font-medium text-primary">
                    <span className="flex items-center gap-1">
                      {costReductionExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <span className="text-xs text-muted-foreground mr-1">+</span>
                      Cost reduction
                    </span>
                  </TableCell>
                  {relevantYears.map(y => (
                    <TableCell key={y.year} className="text-right font-medium text-primary">
                      {formatCurrency(y.costReduction)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-semibold text-primary">
                    {formatCurrency(roiResults.totalProjection.costReduction)}
                  </TableCell>
                </TableRow>
                {costReductionExpanded && costReductionBreakdown.map((item, idx) => (
                  <TableRow key={`cr-${idx}`} className="bg-muted/10">
                    <TableCell className="pl-10 text-sm text-muted-foreground">
                        <span className="flex items-center gap-2">
                        {item.label}
                        {(item.calculatorId || item.challengeId) && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const calcId = getCalculatorIdForBenefit(item);
                              if (onOpenCalculator && calcId) {
                                onOpenCalculator(calcId);
                              } else {
                                setSelectedBenefit({ 
                                  challengeId: item.challengeId!, 
                                  title: item.label 
                                });
                              }
                            }}
                            className="text-primary hover:text-primary/80 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    </TableCell>
                    {relevantYears.map((y, yIdx) => (
                      <TableCell key={yIdx} className="text-right text-sm text-muted-foreground">
                        {formatCurrency(item.value * Math.pow(1 + investmentInputs.annualSalesGrowthPct / 100, y.year - 1) * (y.year === 1 ? getEffectiveRealization(1) : 1))}
                      </TableCell>
                    ))}
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatCurrency(relevantYears.reduce((sum, y) => sum + item.value * Math.pow(1 + investmentInputs.annualSalesGrowthPct / 100, y.year - 1), 0))}
                    </TableCell>
                  </TableRow>
                ))}
              </>
            )}

            {/* Risk Mitigation - only show if > 0, with collapsible sub-calculations */}
            {hasRiskMitigation && (
              <>
                <TableRow 
                  className="border-l-4 border-l-primary/50 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => setRiskMitigationExpanded(!riskMitigationExpanded)}
                >
                  <TableCell className="font-medium text-primary">
                    <span className="flex items-center gap-1">
                      {riskMitigationExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <span className="text-xs text-muted-foreground mr-1">+</span>
                      Risk mitigation
                    </span>
                  </TableCell>
                  {relevantYears.map(y => (
                    <TableCell key={y.year} className="text-right font-medium text-primary">
                      {formatCurrency(y.riskMitigation)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-semibold text-primary">
                    {formatCurrency(roiResults.totalProjection.riskMitigation)}
                  </TableCell>
                </TableRow>
                {riskMitigationExpanded && riskMitigationBreakdown.map((item, idx) => (
                  <TableRow key={`rm-${idx}`} className="bg-muted/10">
                    <TableCell className="pl-10 text-sm text-muted-foreground">
                        <span className="flex items-center gap-2">
                        {item.label}
                        {(item.calculatorId || item.challengeId) && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const calcId = getCalculatorIdForBenefit(item);
                              if (onOpenCalculator && calcId) {
                                onOpenCalculator(calcId);
                              } else {
                                setSelectedBenefit({ 
                                  challengeId: item.challengeId!, 
                                  title: item.label 
                                });
                              }
                            }}
                            className="text-primary hover:text-primary/80 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    </TableCell>
                    {relevantYears.map((y, yIdx) => (
                      <TableCell key={yIdx} className="text-right text-sm text-muted-foreground">
                        {formatCurrency(item.value * Math.pow(1 + investmentInputs.annualSalesGrowthPct / 100, y.year - 1) * (y.year === 1 ? getEffectiveRealization(1) : 1))}
                      </TableCell>
                    ))}
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatCurrency(relevantYears.reduce((sum, y) => sum + item.value * Math.pow(1 + investmentInputs.annualSalesGrowthPct / 100, y.year - 1), 0))}
                    </TableCell>
                  </TableRow>
                ))}
              </>
            )}

            <TableRow className="border-t-2 border-l-4 border-l-primary bg-slate-200">
              <TableCell className="font-semibold text-slate-800">
                <span className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground mr-1">=</span>
                  Total run-rate gross EBITDA contribution
                </span>
              </TableCell>
              {relevantYears.map(y => (
                <TableCell key={y.year} className="text-right font-semibold text-slate-800">
                  {formatCurrency(y.totalProfitabilityContribution)}
                </TableCell>
              ))}
              <TableCell className="text-right font-bold text-slate-800">
                {formatCurrency(roiResults.totalProjection.totalProfitabilityContribution)}
              </TableCell>
            </TableRow>

            <TableRow className="bg-muted/30">
              <TableCell className="text-muted-foreground italic">Effective realisation (deployment)</TableCell>
              {adjustedYearProjections.map(y => (
                <TableCell key={y.year} className="text-right text-muted-foreground p-2">
                  <div className="flex items-center justify-end gap-1">
                    {editingRealization === y.year ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={editRealizationValue}
                          onChange={(e) => setEditRealizationValue(e.target.value)}
                          onBlur={() => handleEndEditRealization(y.year)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleEndEditRealization(y.year);
                            if (e.key === 'Escape') {
                              setEditingRealization(null);
                              setEditRealizationValue("");
                            }
                          }}
                          className="h-7 w-16 text-right text-sm"
                          autoFocus
                          min={0}
                          max={100}
                        />
                        <span className="text-xs">%</span>
                      </div>
                    ) : (
                      <span 
                        className={`cursor-pointer px-2 py-0.5 rounded hover:bg-primary/10 transition-colors ${hasCustomRealization(y.year) ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : ''}`}
                        onClick={() => handleStartEditRealization(y.year, y.effectiveRealization)}
                        title="Click to edit"
                      >
                        {formatPercent(y.effectiveRealization)}
                        <span className="text-xs opacity-60 ml-1">✎</span>
                      </span>
                    )}
                    {hasCustomRealization(y.year) && editingRealization !== y.year && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => resetRealization(y.year)}
                              className="p-1 hover:bg-muted rounded transition-colors"
                            >
                              <RotateCcw className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="text-xs">Reset to calculated value ({formatPercent((12 - investmentInputs.monthsToIntegrate) / 12)})</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </TableCell>
              ))}
              <TableCell className="text-right text-muted-foreground">-</TableCell>
            </TableRow>

            <TableRow className="bg-slate-500">
              <TableCell className="font-semibold text-white">Effective gross EBITDA contribution</TableCell>
              {adjustedYearProjections.map(y => (
                <TableCell key={y.year} className="text-right font-semibold text-white">
                  {formatCurrency(y.runRateGrossEBITDA)}
                </TableCell>
              ))}
              <TableCell className="text-right font-bold text-white">
                {formatCurrency(adjustedTotalProjection.runRateGrossEBITDA)}
              </TableCell>
            </TableRow>

            {showInvestmentRows && (
              <>
                {/* Forter SaaS cost - collapsible with breakdown */}
                <TableRow 
                  className="cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => setSaasExpanded(!saasExpanded)}
                >
                  <TableCell className="text-slate-700">
                    <span className="flex items-center gap-1">
                      {saasExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      Forter SaaS cost
                    </span>
                  </TableCell>
                  {adjustedYearProjections.map(y => (
                    <TableCell key={y.year} className="text-right text-slate-700">
                      {y.forterSaaSCost > 0 ? formatCurrency(-y.forterSaaSCost) : '-'}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-semibold text-slate-700">
                    {formatCurrency(-roiResults.totalProjection.forterSaaSCost)}
                  </TableCell>
                </TableRow>
                {saasExpanded && Object.entries(investmentCosts.breakdown).map(([name, value], idx) => (
                  <TableRow key={`saas-${idx}`} className="bg-muted/10">
                    <TableCell className="pl-10 text-sm text-muted-foreground">{name}</TableCell>
                    {adjustedYearProjections.map((y, yIdx) => (
                      <TableCell key={yIdx} className="text-right text-sm text-muted-foreground">
                        {value > 0 ? formatCurrency(-value) : '-'}
                      </TableCell>
                    ))}
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {value > 0 ? formatCurrency(-value * investmentInputs.contractTenure) : '-'}
                    </TableCell>
                  </TableRow>
                ))}

                <TableRow>
                  <TableCell className="text-slate-700">Integration cost</TableCell>
                  {adjustedYearProjections.map(y => (
                    <TableCell key={y.year} className="text-right text-slate-700">
                      {y.integrationCost > 0 ? formatCurrency(-y.integrationCost) : '-'}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-semibold text-slate-700">
                    {investmentCosts.integrationCost > 0 ? formatCurrency(-roiResults.totalProjection.integrationCost) : '-'}
                  </TableCell>
                </TableRow>

                <TableRow className="border-t-2 bg-slate-900">
                  <TableCell className="font-bold text-white">Net EBITDA contribution</TableCell>
                  {adjustedYearProjections.map(y => (
                    <TableCell key={y.year} className="text-right font-bold text-white">
                      {formatCurrency(y.netEBITDAContribution)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-bold text-white text-lg">
                    {formatCurrency(adjustedTotalProjection.netEBITDAContribution)}
                  </TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Investment Modal */}
      <InvestmentModal
        open={showInvestmentModal}
        onOpenChange={setShowInvestmentModal}
        formData={formData}
        selectedChallenges={selectedChallenges}
        investmentInputs={investmentInputs}
        onInvestmentChange={onInvestmentInputsChange}
        isCustomMode={isCustomMode}
      />
      
      {/* Benefit Detail Modal */}
      <Dialog open={!!selectedBenefit} onOpenChange={() => setSelectedBenefit(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedBenefit?.title || 'Benefit Details'}</DialogTitle>
          </DialogHeader>
          {selectedBenefit && (() => {
            const content = getChallengeBenefitContent(selectedBenefit.challengeId);
            if (!content) return <p className="text-muted-foreground">No details available for this benefit.</p>;
            return (
              <Tabs defaultValue="benefit" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="benefit">Benefit Summary</TabsTrigger>
                  <TabsTrigger value="challenge">Challenge Overview</TabsTrigger>
                </TabsList>
                <TabsContent value="benefit" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-primary">{content.benefitTitle}</h4>
                    <p className="text-sm text-muted-foreground">{content.benefitDescription}</p>
                  </div>
                  {content.benefitPoints && content.benefitPoints.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold">Key Benefits</h4>
                      <ul className="list-disc list-inside space-y-2 text-sm">
                        {content.benefitPoints.map((point, idx) => (
                          <li key={idx}>
                            <span className="font-medium">{point.title}</span>
                            <span className="text-muted-foreground"> - {point.description}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="challenge" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-destructive">{content.challengeTitle}</h4>
                    <p className="text-sm text-muted-foreground">{content.challengeDescription}</p>
                  </div>
                </TabsContent>
              </Tabs>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}