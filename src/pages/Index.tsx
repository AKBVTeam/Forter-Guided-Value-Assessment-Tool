import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import forterLogo from "@/assets/forter-logo.png";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ManualInputForm } from "@/components/calculator/ManualInputForm";
import { ValueAgentChat } from "@/components/calculator/ValueAgentChat";


import { ResultsDashboard } from "@/components/calculator/ResultsDashboard";
import { ChangelogPanel } from "@/components/calculator/ChangelogPanel";
import { SaveAsDialog } from "@/components/calculator/SaveAsDialog";
import { OpenAnalysisButton } from "@/components/calculator/OpenAnalysisButton";
import { WelcomeDialog } from "@/components/calculator/WelcomeDialog";
import {
  WhatIsBusinessValueModal,
  getHasSeenWhatIsBusinessValue,
} from "@/components/calculator/WhatIsBusinessValueModal";

import { AutoSaveIndicator } from "@/components/calculator/AutoSaveIndicator";
import { AuthButton } from "@/components/calculator/AuthButton";
import { Badge } from "@/components/ui/badge";
import { FilePlus, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { useAutoSave } from "@/hooks/useAutoSave";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { ForterKPIs, defaultForterKPIs } from "@/components/calculator/ForterKPIConfig";
import { SavedAnalysis } from "@/components/calculator/WelcomeDialog";
import { Segment } from "@/lib/segments";
import type { InvestmentInputs } from "@/lib/roiCalculations";

export type CalculatorData = {
  // Customer Information
  customerName?: string;
  industry?: string;
  hqLocation?: string;
  baseCurrency?: string; // ISO 4217 currency code (e.g., "USD", "EUR")
  isMarketplace?: boolean;
  commissionRate?: number;
  /** GMV to Net sales deductions: percentage deduction (e.g. sales tax/VAT, returns/cancellations). Default 20. Used in calculators and ROI. */
  gmvToNetSalesDeductionPct?: number;
  /** Optional: selected buyer persona PDF filenames for "who is the buyer" */
  selectedBuyerPersonas?: string[];
  
  // Existing vendor selection (for dynamic KPI lookups)
  existingFraudVendor?: string;
  
  // Fraud Management - Challenges & Solutions
  fraudManagementEnabled?: boolean;
  fraudManagementChallenges?: string[];
  fraudManagementSolution?: "standalone" | "combined";
  
  // Selected challenges (keyed by challenge ID, e.g., "fraud-systems-0" for Challenge 1)
  selectedChallenges?: { [key: string]: boolean };
  
  // AMER Regional Data
  amerAnnualGMV?: number;
  amerGrossAttempts?: number;
  amerGrossMarginPercent?: number;
  amerPreAuthApprovalRate?: number;
  amerPreAuthImplemented?: boolean;
  amerPostAuthApprovalRate?: number;
  amerPostAuthImplemented?: boolean;
  amerIssuingBankDeclineRate?: number;
  amerFraudCheckTiming?: "pre-auth" | "post-auth";
  amerCreditCardPct?: number;
  amer3DSImplemented?: boolean;
  amer3DSChallengeRate?: number;
  amer3DSAbandonmentRate?: number;
  amerManualReviewRate?: number;
  
  // Completed AOV - for calculating value of approved transactions
  // Defaults to amerAnnualGMV / amerGrossAttempts but can be overridden
  completedAOV?: number;
  
  // EMEA Regional Data
  emeaAnnualGMV?: number;
  emeaGrossAttempts?: number;
  emeaGrossMarginPercent?: number;
  emeaPreAuthApprovalRate?: number;
  emeaPostAuthApprovalRate?: number;
  emeaIssuingBankDeclineRate?: number;
  emeaFraudCheckTiming?: "pre-auth" | "post-auth";
  emeaCreditCardPct?: number;
  emea3DSChallengeRate?: number;
  emea3DSAbandonmentRate?: number;
  emeaManualReviewRate?: number;
  
  // APAC Regional Data
  apacAnnualGMV?: number;
  apacGrossAttempts?: number;
  apacGrossMarginPercent?: number;
  apacPreAuthApprovalRate?: number;
  apacPostAuthApprovalRate?: number;
  apacIssuingBankDeclineRate?: number;
  apacFraudCheckTiming?: "pre-auth" | "post-auth";
  apacCreditCardPct?: number;
  apac3DSChallengeRate?: number;
  apac3DSAbandonmentRate?: number;
  apacManualReviewRate?: number;
  
  // Chargebacks - Challenges & Solutions
  chargebacksEnabled?: boolean;
  chargebackChallenges?: string[];
  chargebackSolution?: "standalone" | "combined";
  
  // Fraud Chargebacks (regional)
  fraudCBRate?: number;
  emeaFraudCBRate?: number;
  apacFraudCBRate?: number;
  fraudCBAOV?: number;
  emeaFraudCBAOV?: number;
  apacFraudCBAOV?: number;
  fraudCBProcessors?: string[];
  fraudCBProcessorOther?: string;
  
  // Service Chargebacks
  serviceCBRate?: number;
  serviceCBAOV?: number;
  serviceCBProcessors?: string[];
  serviceCBProcessorOther?: string;
  
  // Challenge 3: Manual Review specific
  manualReviewPct?: number;
  timePerReview?: number;
  hourlyReviewerCost?: number;
  
  // Challenge 7: Chargeback Disputes specific
  fraudDisputeRate?: number;
  fraudWinRate?: number;
  serviceDisputeRate?: number;
  serviceWinRate?: number;
  avgTimeToReviewCB?: number; // minutes - "Avg time to review CB"
  annualCBDisputes?: number; // "Number of annual CB disputes"
  costPerHourAnalyst?: number; // "Cost per hour of analyst"
  // Direct $ value inputs for Challenge 7 (always used now)
  estFraudChargebackValue?: number; // Est. value of fraud chargebacks ($)
  estFraudChargebackValueManuallySet?: boolean; // Track if user manually set this value
  estServiceChargebackValue?: number; // Est. value of service chargebacks ($)
  
  // Challenge 8: Abuse Prevention specific
  refundRate?: number;
  expectedRefundsVolume?: number;
  avgRefundValue?: number;
  avgOneWayShipping?: number;
  avgFulfilmentCost?: number;
  txProcessingFeePct?: number;
  avgCSTicketCost?: number;
  pctINRClaims?: number;
  pctReplacedCredits?: number;
  abuseBenchmarks?: {
    forterCatchRate: number;
    pctBlockedResold: number;
    pctAbusersAbandon: number;
    abuseAovMultiplier: number;
    egregiousReturnsAbusePct: number;
    egregiousInventoryLossPct: number;
    egregiousINRAbusePct: number;
    nonEgregiousReturnsAbusePct: number;
    nonEgregiousInventoryLossPct: number;
    forterEgregiousReturnsReduction: number;
    forterEgregiousINRReduction: number;
    forterNonEgregiousReturnsReduction: number;
    promotionAbuseAsGMVPct: number;
  };
  
  // Challenge 10: Promotions Abuse specific
  avgDiscountByAbusers?: number;
  promotionAbuseCatchRateToday?: number; // Estimated current catch rate (%)
  
  // Challenge 9: Instant Refunds specific
  pctRefundsToCS?: number;
  costPerCSContact?: number;
  
  // Challenge 12/13: ATO Protection specific
  monthlyLogins?: number;
  customerLTV?: number;
  avgAppeasementValue?: number;
  avgSalaryPerCSMember?: number;
  avgHandlingTimePerATOClaim?: number;
  pctChurnFromATO?: number;
  /** Current ATO catch rate (%) for customer inputs — used in Mitigate CLV loss (c13-clv). Default 0. */
  currentAtoCatchRate?: number;
  
  // Challenge 14/15: Sign-up Protection specific
  monthlySignups?: number;
  avgNewMemberBonus?: number;
  numDigitalCommunicationsPerYear?: number;
  avgCostPerOutreach?: number;
  avgKYCCostPerAccount?: number;
  pctAccountsGoingThroughKYC?: number;
  
  // Custom calculations
  customCalculations?: CustomCalculation[];
  
  // Forter KPIs
  forterKPIs?: ForterKPIs;
  
  // Segmentation - for fraud/payments challenges (1, 2, 4, 5)
  segmentationEnabled?: boolean;
  segments?: Segment[];
  
  // Strategic objectives (selected during discovery)
  selectedObjectives?: ('revenue_growth' | 'customer_experience' | 'automation' | 'cost_reduction' | 'risk_mitigation')[];
  /** Free-form notes for use case discovery and challenges (persisted with analysis) */
  useCaseNotes?: string;

  // Analysis metadata (used for auto-save and reload)
  _analysisId?: string;
  _analysisName?: string;
  _authorName?: string;
  _pathwayMode?: 'manual' | 'custom'; // Tracks which pathway was used for this analysis
  /** True if user has viewed Value Summary (unlocks ROI tab); persisted so ROI stays unlocked when switching back to this analysis */
  _valueSummaryViewed?: boolean;
  /** Show in millions toggle (Value Summary / ROI); persisted so re-opening analysis restores preference */
  _showInMillions?: boolean;
  /** True after we've applied the one-time default of "Show in millions" for analyses with annual impact > $10m */
  _showInMillionsDefaultApplied?: boolean;
  /** Apply deduplication in value model; persisted so re-opening analysis restores preference */
  _deduplicationEnabled?: boolean;
  /** Deduplication retry rate (%); persisted with analysis */
  _deduplicationRetryRate?: number;
  /** Deduplication success rate (%); persisted with analysis */
  _deduplicationSuccessRate?: number;
  /** Show investment rows in ROI tab; persisted so re-opening analysis restores preference */
  _showInvestmentRowsOn?: boolean;
  _lastUpdatedAt?: string; // ISO string of the most recent save/change to this analysis
  _startedAt?: string; // ISO string when this analysis was first started (for display)
  /** Changelog since inception: all modified inputs across sessions (persisted with analysis) */
  _changelogHistory?: PersistedChangelogEntry[];
  /** Custom display names for standard benefit/calculator names (custom pathway only) */
  customBenefitNames?: Record<string, string>;
  /** Duplicated calculators (custom pathway): each has its own inputs, not shared with main form. Key = unique id (e.g. c1-revenue-dup-123). */
  standaloneCalculators?: Record<string, StandaloneCalculator>;
  /** Investment inputs (Enter Investment modal) – persisted so re-opening an analysis restores investment cost */
  investmentInputs?: InvestmentInputs;
  /** Last generated Executive Summary (Google Doc) URL – persisted so re-opening an analysis shows "Open Doc" link */
  _executiveSummaryUrl?: string;
  /** Last generated Value Assessment Deck (Google Slides) URL – persisted so re-opening an analysis shows "Open Slides" link */
  _valueDeckUrl?: string;
};

/** A duplicated standard calculator with its own inputs (custom pathway duplication) */
export interface StandaloneCalculator {
  sourceCalculatorId: string;
  customName?: string;
  /** Customer inputs for this calculator only; unset fields default to 0 */
  inputs: Partial<CalculatorData>;
}

/** Persisted changelog entry (timestamp as ISO string for serialization) */
export interface PersistedChangelogEntry {
  field: string;
  label: string;
  oldValue: string | number | boolean | undefined;
  newValue: string | number | boolean | undefined;
  timestamp: string; // ISO
  category?: 'customer' | 'investment';
}

// Custom calculation type
export type CustomCalculation = {
  id: string;
  name: string;
  value: number;
  category: 'gmv_uplift' | 'cost_reduction' | 'risk_mitigation';
  sourceUrl?: string; // Optional Google Sheets or other calculator link
};

const Index = () => {
  const [mode, setMode] = useState<"select" | "manual" | "custom">("select");
  const [calculatorData, setCalculatorData] = useState<CalculatorData>({
    forterKPIs: defaultForterKPIs,
  });
  const [customerLogoUrl, setCustomerLogoUrl] = useState<string>("");
  const [showResults, setShowResults] = useState(false);
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(true);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [showWhatIsBusinessValueModal, setShowWhatIsBusinessValueModal] = useState(false);
  const [gvaModalInitialTab, setGvaModalInitialTab] = useState<string | undefined>(undefined);
  const initialDataRef = useRef<CalculatorData>({ forterKPIs: defaultForterKPIs });
  // Changelog baseline: only updated on load / start new / save as so edits are detected reliably
  const [changelogBaseline, setChangelogBaseline] = useState<CalculatorData>(() => ({ forterKPIs: defaultForterKPIs }));
  
  // Navigation state for chat-driven tab changes
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  
  // Tab completion state for global progress bar
  const [tabCompletion, setTabCompletion] = useState({
    profile: 0,
    challenges: 0,
    inputs: 0,
    forter: 0,
    summary: 0,
    roi: 0,
  });

  // Loading bar when starting new or loading an analysis (2 second duration)
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const loadingDurationMs = 2000;
  const loadingTickMs = 50;

  useEffect(() => {
    if (!isAnalysisLoading) {
      setLoadingProgress(0);
      return;
    }
    setLoadingProgress(0);
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / loadingDurationMs) * 100);
      setLoadingProgress(pct);
      if (pct >= 100) {
        clearInterval(timer);
        setIsAnalysisLoading(false);
      }
    }, loadingTickMs);
    return () => clearInterval(timer);
  }, [isAnalysisLoading]);
  
  // Handler for chat navigation
  const handleNavigate = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  // Auto-save hook
  const autoSaveState = useAutoSave({
    data: calculatorData,
    customerLogoUrl,
    debounceMs: 1500,
    enabled: !showWelcomeDialog && mode !== "select",
    onSaveComplete: (savedAt) => {
      setCalculatorData((prev) => ({ ...prev, _lastUpdatedAt: savedAt.toISOString() }));
    },
  });

  const dateFormat = { year: "numeric" as const, month: "long" as const, day: "numeric" as const };
  // Analysis started display: when this analysis was first started (same format as last updated)
  const startedDisplay = useMemo(() => {
    const raw = (calculatorData as any)._startedAt;
    if (!raw) return "—";
    try {
      const d = new Date(raw);
      return isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, dateFormat);
    } catch {
      return "—";
    }
  }, [calculatorData]);
  // Last updated display: use the most recent change date for the current analysis
  const lastUpdatedDisplay = useMemo(() => {
    const id = (calculatorData as any)._analysisId;
    const raw = (calculatorData as any)._lastUpdatedAt;
    if (!id) return "—";
    if (!raw) return "—";
    try {
      const d = new Date(raw);
      return isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, dateFormat);
    } catch {
      return "—";
    }
  }, [calculatorData]);

  // Track if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    const excluded = new Set(["forterKPIs", "abuseBenchmarks", "selectedChallenges"]);
    const initialData = initialDataRef.current;
    
    const keys = new Set<string>([
      ...Object.keys(initialData),
      ...Object.keys(calculatorData),
    ]);
    
    for (const key of keys) {
      if (excluded.has(key)) continue;
      const currValue = JSON.stringify(calculatorData[key as keyof CalculatorData]);
      const initValue = JSON.stringify(initialData[key as keyof CalculatorData]);
      if (currValue !== initValue) return true;
    }
    return false;
  }, [calculatorData]);

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCustomerLogoUrl(e.target?.result as string);
        toast.success("Logo uploaded successfully");
      };
      reader.readAsDataURL(file);
    }
  };

  // Sync changelog baseline when we have an active analysis but baseline was never set (e.g. chose pathway without load, or session restored)
  useEffect(() => {
    const dataId = calculatorData._analysisId;
    const baselineId = changelogBaseline._analysisId;
    if (dataId && dataId !== baselineId) {
      setChangelogBaseline({ ...calculatorData });
    }
  }, [calculatorData._analysisId, changelogBaseline._analysisId]);

  // Handle partial field updates to prevent full object replacement
  const handleFieldChange = useCallback((field: keyof CalculatorData, value: any) => {
    setCalculatorData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Handle bulk updates (e.g., from chatbot or loading saved data)
  const handleBulkUpdate = useCallback((data: Partial<CalculatorData>) => {
    setCalculatorData(prev => ({ ...prev, ...data }));
  }, []);

  // Stable callback so ChangelogPanel's debounce timer is not cleared on every render
  const handleChangelogUpdate = useCallback((entries: PersistedChangelogEntry[]) => {
    setCalculatorData(prev => ({ ...prev, _changelogHistory: entries }));
  }, []);

  const handleDataComplete = useCallback((data: CalculatorData) => {
    setCalculatorData(data);
    setShowResults(true);
  }, []);

  const handleEditManual = () => {
    setMode("manual");
    setShowResults(false);
  };

  const handleEditCustom = () => {
    setMode("custom");
    setShowResults(false);
  };

  const handleStartOver = () => {
    setMode("select");
    setCalculatorData({ forterKPIs: defaultForterKPIs });
    setShowResults(false);
    setCustomerLogoUrl("");
  };

  const handleLoadAnalysis = useCallback((data: CalculatorData, logoUrl: string) => {
    setIsAnalysisLoading(true);
    console.log('[Index] Loading analysis with _pathwayMode:', data._pathwayMode);
    setCalculatorData(data);
    setCustomerLogoUrl(logoUrl);
    const baseline = { ...data };
    initialDataRef.current = baseline;
    setChangelogBaseline(baseline);
    setShowWelcomeDialog(false);
    // Restore the pathway mode that was saved with the analysis
    setMode(data._pathwayMode || "manual");
    console.log('[Index] Set mode to:', data._pathwayMode || "manual");
  }, []);

  const handleStartNew = useCallback((analysisName: string, authorName: string) => {
    setIsAnalysisLoading(true);
    // Note: Benefit IDs and driver states are now scoped per analysis ID in ValueSummaryOptionA
    // No need to clear global keys - each analysis uses its own scoped localStorage keys
    console.log('[Index handleStartNew] calculatorData._pathwayMode before creating newData:', (calculatorData as any)._pathwayMode);
    // Generate a unique ID for this new analysis
    const analysisId = Date.now().toString();
    
    // Store the initial analysis name, author, and ID for auto-save; reset changelog for new analysis
    const now = new Date().toISOString();
    const newData = { 
      ...calculatorData,
      _analysisName: analysisName,
      _authorName: authorName,
      _analysisId: analysisId,
      _startedAt: now,
      _lastUpdatedAt: now,
      _changelogHistory: [], // New analysis: track activity since inception only for this analysis
    };
    console.log('[Index handleStartNew] newData._pathwayMode after spread:', (newData as any)._pathwayMode);
    setCalculatorData(newData);
    setChangelogBaseline({ ...newData });
    
    // Auto-save the new analysis immediately
    const newAnalysis: SavedAnalysis = {
      id: analysisId,
      name: analysisName,
      authorName: authorName,
      data: newData,
      customerLogoUrl: customerLogoUrl,
      savedAt: new Date(),
    };
    console.log('[Index handleStartNew] Saving to localStorage with _pathwayMode:', (newAnalysis.data as any)._pathwayMode);
    
    // Get existing analyses
    const existingRaw = localStorage.getItem("forter_saved_analyses");
    let existing: SavedAnalysis[] = [];
    if (existingRaw) {
      try {
        existing = JSON.parse(existingRaw);
      } catch (e) {
        console.error("Failed to parse saved analyses", e);
      }
    }
    
    // Add new and save
    const updated = [...existing, newAnalysis];
    localStorage.setItem("forter_saved_analyses", JSON.stringify(updated));
    
    setShowWelcomeDialog(false);
  }, [calculatorData, customerLogoUrl]);

  const handleNewAssessment = useCallback(() => {
    // Note: Benefit IDs and driver states are now scoped per analysis ID in ValueSummaryOptionA
    // No need to clear global keys - each analysis uses its own scoped localStorage keys
    const empty = { forterKPIs: defaultForterKPIs };
    setCalculatorData(empty);
    setCustomerLogoUrl("");
    initialDataRef.current = empty;
    setChangelogBaseline(empty);
    setShowResults(false);
    setMode("select");
    setShowWelcomeDialog(true);
  }, []);

  if (mode === "select") {
    return (
      <div className="min-h-screen h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex flex-col" style={{ minHeight: "100vh" }}>
        {isAnalysisLoading && (
          <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-muted overflow-hidden">
            <Progress value={loadingProgress} className="h-full rounded-none bg-transparent [&>div]:rounded-none" />
          </div>
        )}
        <WelcomeDialog
          open={showWelcomeDialog}
          onStartNew={handleStartNew}
          onLoadAnalysis={handleLoadAnalysis}
        />
        <WhatIsBusinessValueModal
          open={showWhatIsBusinessValueModal}
          onOpenChange={setShowWhatIsBusinessValueModal}
          markAsSeenOnClose
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Main content area - scrollable */}
          <div className={`flex-1 flex flex-col transition-all duration-300 overflow-y-auto`}>
            {/* Header */}
            <div className="container mx-auto px-6 pt-6">
              <div className="flex flex-col gap-2 mb-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-8">
                    <div className="flex flex-col">
                      <img src={forterLogo} alt="Forter" className="h-10 object-contain" />
                      <span className="text-[10px] text-muted-foreground mt-0.5">Guided Value Assessment Version 1.0 (2026)</span>
                      <span className="text-[10px] text-muted-foreground">Analysis Started: {startedDisplay}</span>
                      <span className="text-[10px] text-muted-foreground">Analysis Last Updated: {lastUpdatedDisplay}</span>
                    </div>
                    {customerLogoUrl && (
                      <img src={customerLogoUrl} alt="Customer" className="h-10 object-contain" />
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" className="gap-2" onClick={handleNewAssessment}>
                      <FilePlus className="w-4 h-4" />
                      New
                    </Button>
                    <OpenAnalysisButton onLoadAnalysis={handleLoadAnalysis} />
                    <SaveAsDialog
                      currentData={calculatorData}
                      customerLogoUrl={customerLogoUrl}
                      onSaveAs={(newId, newName, authorName) => {
                        // Update ONLY metadata fields - keep all existing data including selectedChallenges
                        // Use a ref update to prevent triggering the child's "load analysis" effect
                        setCalculatorData(prev => {
                          const updated = {
                            ...prev,
                            _analysisId: newId,
                            _analysisName: newName,
                            _authorName: authorName,
                            _startedAt: new Date().toISOString(),
                            _lastUpdatedAt: new Date().toISOString(),
                          } as CalculatorData;
                          const baseline = { ...updated };
                          initialDataRef.current = baseline;
                          setChangelogBaseline(baseline);
                          return updated;
                        });
                      }}
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setShowWhatIsBusinessValueModal(true)}
                          className="size-8 rounded-full flex items-center justify-center text-sm font-semibold bg-amber-100 hover:bg-amber-200/90 text-amber-700 hover:text-amber-800 border border-amber-200/80 cursor-pointer transition-colors shrink-0"
                          aria-label="Forter Guided Value Assessment Overview"
                        >
                          ?
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Forter Guided Value Assessment Overview</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-xs text-muted-foreground">
                    Join <span className="font-medium text-primary">#business-value</span> slack channel for support
                  </span>
                  {calculatorData._analysisName && (
                    <span className="text-xs font-medium text-foreground/70">
                      Analysis name: {calculatorData._analysisName}
                    </span>
                  )}
                  {calculatorData.customerName && (
                    <span className="text-xs text-muted-foreground">
                      Merchant: {calculatorData.customerName}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="max-w-4xl w-full space-y-8">
                <div className="text-center space-y-4">
                  <h1 className="text-5xl font-bold text-primary">
                    Guided Value Assessment (GVA)
                  </h1>
                  <p className="text-xl text-muted-foreground">
                    Turn discovery insights into a robust, benchmark-validated ROI model in minutes
                  </p>
                </div>

                {/* Mode Selection */}
                <div className="grid md:grid-cols-2 gap-6">
                  <Card
                    className="p-8 cursor-pointer hover:shadow-lg border-primary border-2 shadow-md transition-all duration-150 ease-out hover:scale-[1.01] active:scale-[0.98] relative overflow-hidden bg-primary/5"
                    onClick={() => {
                      console.log('[Index] Clicking Guided Pathway button');
                      setShowWelcomeDialog(false);
                      setMode("manual");
                      setCalculatorData(prev => {
                        const next = { ...prev, _pathwayMode: 'manual' as const };
                        if (!prev._analysisId) {
                          const id = Date.now().toString();
                          next._analysisId = id;
                          next._analysisName = next._analysisName || 'Untitled Analysis';
                          next._lastUpdatedAt = new Date().toISOString();
                          next._changelogHistory = [];
                        }
                        return next;
                      });
                      if (!getHasSeenWhatIsBusinessValue()) {
                        setShowWhatIsBusinessValueModal(true);
                      }
                    }}
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary/20 to-transparent rounded-bl-full" />
                    <div className="absolute top-3 right-3">
                      <span className="bg-primary text-primary-foreground text-xs font-medium px-2.5 py-1 rounded-full">
                        Recommended
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold mb-3 relative">Guided Value Pathway</h2>
                    <p className="text-muted-foreground mb-4">
                      Enter metrics directly through a structured form
                    </p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Identify use cases, enter metrics, see value</li>
                      <li>• Forter benchmarks and KPIs included</li>
                      <li>• One path from discovery to ROI</li>
                    </ul>
                  </Card>

                  <Card
                    className="p-8 cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-150 ease-out hover:scale-[1.01] active:scale-[0.98] relative"
                    onClick={() => {
                      console.log('[Index] Clicking Custom Pathway button');
                      setShowWelcomeDialog(false);
                      setMode("custom");
                      setCalculatorData(prev => {
                        const next = { ...prev, _pathwayMode: 'custom' as const };
                        if (!prev._analysisId) {
                          const id = Date.now().toString();
                          next._analysisId = id;
                          next._analysisName = next._analysisName || 'Untitled Analysis';
                          next._lastUpdatedAt = new Date().toISOString();
                          next._changelogHistory = [];
                        }
                        return next;
                      });
                      if (!getHasSeenWhatIsBusinessValue()) {
                        setShowWhatIsBusinessValueModal(true);
                      }
                    }}
                  >
                    <div className="absolute top-3 right-3">
                      <span className="bg-muted text-muted-foreground text-xs font-medium px-2.5 py-1 rounded-full">
                        Advanced
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold mb-3">Custom Value Pathway</h2>
                    <p className="text-muted-foreground mb-4">
                      Skip to Value Summary and add custom calculations directly
                    </p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Manual access to standard benefit library</li>
                      <li>• Link to external spreadsheets</li>
                      <li>• Access calculator benefit library</li>
                    </ul>
                    <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
                      <span className="font-medium">Note:</span> Calculation links are required
                    </p>
                  </Card>
                </div>
              </div>
            </div>
          </div>
          
          {/* Chat side panel - consistent 380px width */}
          {showChatPanel && (
            <div className="w-[380px] min-w-[380px] max-w-[380px] shrink-0 h-screen sticky top-0">
              <ValueAgentChat 
                calculatorData={calculatorData} 
                selectedChallenges={calculatorData.selectedChallenges || {}}
                hasSelectedChallenges={Object.values(calculatorData.selectedChallenges || {}).some(Boolean)}
                currentPage="landing"
                isSplitPane={true}
                onToggleSplitPane={() => setShowChatPanel(false)}
              />
            </div>
          )}
          
          {/* Floating chat (when panel is closed) */}
          {!showChatPanel && (
            <ValueAgentChat 
              calculatorData={calculatorData} 
              selectedChallenges={calculatorData.selectedChallenges || {}}
              hasSelectedChallenges={Object.values(calculatorData.selectedChallenges || {}).some(Boolean)}
              currentPage="landing"
              isSplitPane={false}
              onToggleSplitPane={() => setShowChatPanel(true)}
            />
          )}
        </div>
      </div>
    );
  }

  if (showResults) {
    return (
      <>
        {isAnalysisLoading && (
          <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-muted overflow-hidden">
            <Progress value={loadingProgress} className="h-full rounded-none bg-transparent [&>div]:rounded-none" />
          </div>
        )}
        <ResultsDashboard
        data={calculatorData}
        customerLogoUrl={customerLogoUrl}
        onEditManual={handleEditManual}
        onEditCustom={handleEditCustom}
        onStartOver={handleStartOver}
        onDataChange={setCalculatorData}
      />
      </>
    );
  }

  return (
    <>
      {isAnalysisLoading && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-muted overflow-hidden">
          <Progress value={loadingProgress} className="h-full rounded-none bg-transparent [&>div]:rounded-none" />
        </div>
      )}
      <div className="min-h-screen h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex overflow-hidden">
        {/* Main content area - scrollable */}
        <div className={`flex-1 overflow-y-auto transition-all duration-300 ${showChatPanel ? 'pr-0' : ''}`}>
          <div className="container mx-auto p-6">
            {/* Header */}
            <div className="flex flex-col gap-2 mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-8">
                  <div className="flex flex-col">
                    <img src={forterLogo} alt="Forter" className="h-10 object-contain" />
                    <span className="text-[10px] text-muted-foreground mt-0.5">Guided Value Assessment Version 1.0 (2026)</span>
                    <span className="text-[10px] text-muted-foreground">Analysis Started: {startedDisplay}</span>
                    <span className="text-[10px] text-muted-foreground">Analysis Last Updated: {lastUpdatedDisplay}</span>
                  </div>
                  {customerLogoUrl && (
                    <img src={customerLogoUrl} alt="Customer" className="h-10 object-contain" />
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <AutoSaveIndicator status={autoSaveState.status} saveLocation={autoSaveState.saveLocation} />
                  <Button variant="outline" size="sm" className="gap-2" onClick={handleNewAssessment}>
                    <FilePlus className="w-4 h-4" />
                    New
                  </Button>
                  <OpenAnalysisButton onLoadAnalysis={handleLoadAnalysis} />
                  <SaveAsDialog
                    currentData={calculatorData}
                    customerLogoUrl={customerLogoUrl}
                    onSaveAs={(newId, newName, authorName) => {
                      const now = new Date().toISOString();
                      setCalculatorData(prev => {
                        const updated = {
                          ...prev,
                          _analysisId: newId,
                          _analysisName: newName,
                          _authorName: authorName,
                          _startedAt: now,
                          _lastUpdatedAt: now,
                        } as CalculatorData;
                        const baseline = { ...updated };
                        initialDataRef.current = baseline;
                        setChangelogBaseline(baseline);
                        return updated;
                      });
                    }}
                  />
                  <ChangelogPanel
                    key={changelogBaseline._analysisId ?? "new"}
                    currentData={calculatorData}
                    initialData={changelogBaseline}
                    persistedChangelog={calculatorData._changelogHistory ?? []}
                    onChangelogUpdate={handleChangelogUpdate}
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setShowWhatIsBusinessValueModal(true)}
                        className="size-8 rounded-full flex items-center justify-center text-sm font-semibold bg-amber-100 hover:bg-amber-200/90 text-amber-700 hover:text-amber-800 border border-amber-200/80 cursor-pointer transition-colors shrink-0"
                        aria-label="Forter Guided Value Assessment Overview"
                      >
                        ?
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Forter Guided Value Assessment Overview</p>
                    </TooltipContent>
                  </Tooltip>
                  <div className="w-px h-6 bg-border mx-1" />
                  <AuthButton />
                </div>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-xs text-muted-foreground">
                  Join <span className="font-medium text-primary">#business-value</span> slack channel for support
                </span>
                {calculatorData._analysisName && (
                  <span className="text-xs font-medium text-foreground/70">
                    Analysis name: {calculatorData._analysisName}
                  </span>
                )}
                {calculatorData.customerName && (
                  <span className="text-xs text-muted-foreground">
                    Merchant: {calculatorData.customerName}
                  </span>
                )}
              </div>
            </div>

            {/* Content */}
            <ManualInputForm 
              onComplete={handleDataComplete} 
              onFieldChange={handleFieldChange}
              onBulkUpdate={handleBulkUpdate}
              initialData={calculatorData}
              customerLogoUrl={customerLogoUrl}
              onLogoUpload={handleLogoUpload}
              entryMode={mode}
              externalActiveTab={activeTab}
              onCompletionChange={setTabCompletion}
              onInvestmentPersist={(inputs) => setCalculatorData(prev => ({ ...prev, investmentInputs: inputs }))}
              onOpenBuyerPersonas={() => {
                setGvaModalInitialTab("personas");
                setShowWhatIsBusinessValueModal(true);
              }}
            />
          </div>
        </div>

        <WhatIsBusinessValueModal
          open={showWhatIsBusinessValueModal}
          onOpenChange={(open) => {
            setShowWhatIsBusinessValueModal(open);
            if (!open) setGvaModalInitialTab(undefined);
          }}
          markAsSeenOnClose
          initialTab={gvaModalInitialTab}
        />
        
        {/* Chat side panel - consistent 380px width */}
        {showChatPanel && (
          <div className="w-[380px] min-w-[380px] max-w-[380px] shrink-0 h-screen sticky top-0 print-hide">
            <ValueAgentChat 
              calculatorData={calculatorData} 
              selectedChallenges={calculatorData.selectedChallenges || {}}
              hasSelectedChallenges={Object.values(calculatorData.selectedChallenges || {}).some(Boolean)}
              isSplitPane={true}
              onToggleSplitPane={() => setShowChatPanel(false)}
              onNavigate={handleNavigate}
              onDataChange={(updates) => setCalculatorData(prev => ({ ...prev, ...updates }))}
              onChallengeChange={(challenges) => setCalculatorData(prev => ({ ...prev, selectedChallenges: challenges }))}
            />
          </div>
        )}
        
        {/* Floating chat (when panel is closed) */}
        {!showChatPanel && (
          <div className="print-hide">
            <ValueAgentChat 
              calculatorData={calculatorData} 
              selectedChallenges={calculatorData.selectedChallenges || {}}
              hasSelectedChallenges={Object.values(calculatorData.selectedChallenges || {}).some(Boolean)}
              isSplitPane={false}
              onToggleSplitPane={() => setShowChatPanel(true)}
              onNavigate={handleNavigate}
              onDataChange={(updates) => setCalculatorData(prev => ({ ...prev, ...updates }))}
              onChallengeChange={(challenges) => setCalculatorData(prev => ({ ...prev, selectedChallenges: challenges }))}
            />
          </div>
        )}
      </div>
    </>
  );
};

export default Index;
