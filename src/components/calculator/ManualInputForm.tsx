import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { CalculatorData, CustomCalculation } from "@/pages/Index";
import { ForterKPIConfig, defaultForterKPIs, ForterKPIs, type ForterKPIFocusSection } from "@/components/calculator/ForterKPIConfig";
import { defaultAbuseBenchmarks } from "@/components/calculator/AbuseBenchmarksModal";
import { ChallengeSelection } from "@/components/calculator/ChallengeSelection";
import { ChallengeInputs } from "@/components/calculator/ChallengeInputs";
import { ValueSummaryOptionA, ValueTotals } from "@/components/calculator/ValueSummaryOptionA";
import { ResultsDashboard } from "./ResultsDashboard";
import { UseCaseLanding, EntryPath } from "./UseCaseLanding";
import { StrategicObjectivesSelection } from "./StrategicObjectivesSelection";
import { UnifiedUseCaseSelection } from "./UnifiedUseCaseSelection";
import { ROITab } from "./ROITab";
import { SegmentEditorModal } from "./SegmentEditorModal";
import { InvestmentInputs, defaultInvestmentInputs, calculateInvestmentCosts } from "@/lib/roiCalculations";
import { StrategicObjectiveId, STRATEGIC_OBJECTIVES, USE_CASES } from "@/lib/useCaseMapping";
import { Segment, hasPaymentChallengesSelected, createEmptySegment, getSegmentSummary, getSegmentKPIStatus, countSegmentFilledFields } from "@/lib/segments";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { FlaskConical, ChevronLeft, ChevronRight, Download, Info, Trash2, Layers, Plus, Pencil, Upload, FileText, Lock, FastForward, Unlock, User, Users, ListChecks, ClipboardList, Gauge, PieChart, TrendingUp, List, LayoutGrid } from "lucide-react";
import { PrintTabButton } from "./PrintTabButton";
import { TabCompletionIndicator } from "./TabCompletionIndicator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { downloadCustomerInputsCSV, getRequiredInputFields } from "@/lib/csvExport";
import { markTemplateDownloaded, hasDownloadedTemplate } from "@/lib/csvImport";
import { CSVUploadButton } from "./CSVUploadButton";
import { InputProgressIndicator } from "./InputProgressIndicator";
import { useInputProgress } from "@/hooks/useInputProgress";
import { useTabCompletion } from "@/hooks/useTabCompletion";
import { verticalBenchmarks, countryBenchmarksSortedForHQ, getWeightedApprovalRate, topCurrencies, getCurrencyForCountry, getVendorCBReductionFactor, get3DSRateByCountryAndAOV, getCurrencySymbol } from "@/lib/benchmarkData";
import { NumericInput } from "@/components/calculator/NumericInput";
import { toast } from "sonner";
import { ValueAgentChat } from "./ValueAgentChat";
import { GenerateReportModal, type CalculatorSubsetForReport } from "./GenerateReportModal";
import { GuidedValueWelcome } from "./GuidedValueWelcome";
import { BUYER_PERSONA_PDFS } from "./WhatIsBusinessValueModal";
import { cn } from "@/lib/utils";

interface ManualInputFormProps {
  onComplete: (data: CalculatorData) => void;
  onFieldChange?: (field: keyof CalculatorData, value: any) => void;
  /** Bulk update (e.g. auto-fill) so parent and auto-save persist use cases + customer inputs */
  onBulkUpdate?: (data: Partial<CalculatorData>) => void;
  initialData?: CalculatorData;
  customerLogoUrl?: string;
  onLogoUpload?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  entryMode?: "manual" | "custom";
  /** External tab control - when provided, allows parent to set active tab */
  externalActiveTab?: string;
  /** Callback to notify parent of completion state for progress bar */
  onCompletionChange?: (completion: { profile: number; challenges: number; inputs: number; forter: number; summary: number; roi: number }) => void;
  /** Persist investment inputs to parent so re-opening an analysis restores investment cost */
  onInvestmentPersist?: (inputs: InvestmentInputs) => void;
  /** Open the GVA overview modal with the Buyer Personas tab active */
}

export const ManualInputForm = ({ onComplete, onFieldChange, onBulkUpdate, initialData, customerLogoUrl, onLogoUpload, entryMode = "manual", externalActiveTab, onCompletionChange, onInvestmentPersist }: ManualInputFormProps) => {
  const [formData, setFormData] = useState<CalculatorData>(() => {
    // For custom mode with no existing analysis, start with zeroed customer inputs
    const isNewCustomAssessment = entryMode === "custom" && !initialData?._analysisId;
    
    if (isNewCustomAssessment) {
      // In custom mode, start with zeroed numeric inputs but keep profile data
      return {
        // Profile fields can carry over
        customerName: initialData?.customerName,
        industry: initialData?.industry,
        hqLocation: initialData?.hqLocation,
        baseCurrency: initialData?.baseCurrency,
        isMarketplace: initialData?.isMarketplace,
        commissionRate: initialData?.commissionRate,
        selectedBuyerPersonas: initialData?.selectedBuyerPersonas,
        existingFraudVendor: initialData?.existingFraudVendor,
        // Forter KPIs use defaults
        forterKPIs: defaultForterKPIs,
        // All customer financial inputs default to 0/undefined (zeroed out)
        amerAnnualGMV: 0,
        amerGrossAttempts: 0,
        amerGrossMarginPercent: 0,
        amerPreAuthApprovalRate: 0,
        amerPostAuthApprovalRate: 0,
        amerPostAuthImplemented: false,
        amerIssuingBankDeclineRate: 0,
        amerCreditCardPct: 0,
        amer3DSChallengeRate: 0,
        amer3DSAbandonmentRate: 0,
        amerManualReviewRate: 0,
        emeaAnnualGMV: 0,
        emeaGrossAttempts: 0,
        emeaGrossMarginPercent: 0,
        emeaPreAuthApprovalRate: 0,
        emeaPostAuthApprovalRate: 0,
        emeaIssuingBankDeclineRate: 0,
        emeaCreditCardPct: 0,
        emea3DSChallengeRate: 0,
        emea3DSAbandonmentRate: 0,
        emeaManualReviewRate: 0,
        apacAnnualGMV: 0,
        apacGrossAttempts: 0,
        apacGrossMarginPercent: 0,
        apacPreAuthApprovalRate: 0,
        apacPostAuthApprovalRate: 0,
        apacIssuingBankDeclineRate: 0,
        apacCreditCardPct: 0,
        apac3DSChallengeRate: 0,
        apac3DSAbandonmentRate: 0,
        apacManualReviewRate: 0,
        fraudCBRate: 0,
        emeaFraudCBRate: 0,
        apacFraudCBRate: 0,
        // fraudCBAOV left undefined so it defaults to Completed AOV when available
        emeaFraudCBAOV: 0,
        apacFraudCBAOV: 0,
        serviceCBRate: 0,
        serviceCBAOV: 0,
        manualReviewPct: 0,
        timePerReview: 0,
        hourlyReviewerCost: 0,
        // ATO Protection & Sign-up Protection - 0 when not entered
        monthlyLogins: 0,
        customerLTV: 0,
        avgAppeasementValue: 0,
        avgHandlingTimePerATOClaim: 0,
        pctChurnFromATO: 0,
        avgSalaryPerCSMember: 0,
        monthlySignups: 0,
        avgNewMemberBonus: 0,
        numDigitalCommunicationsPerYear: 0,
        avgCostPerOutreach: 0,
        avgKYCCostPerAccount: 0,
        pctAccountsGoingThroughKYC: 0,
        // Challenge 7 - 0 when not entered
        estFraudChargebackValue: 0,
        estServiceChargebackValue: 0,
        fraudDisputeRate: 0,
        fraudWinRate: 0,
        serviceDisputeRate: 0,
        serviceWinRate: 0,
        avgTimeToReviewCB: 0,
        annualCBDisputes: 0,
        costPerHourAnalyst: 0,
        // Challenge 8 - abuse/refunds - 0 when not entered
        expectedRefundsVolume: 0,
        avgRefundValue: 0,
        refundRate: 0,
        avgOneWayShipping: 0,
        avgFulfilmentCost: 0,
        txProcessingFeePct: 0,
        avgCSTicketCost: 0,
        pctINRClaims: 0,
        pctReplacedCredits: 0,
        // Challenge 9 - 0 when not entered
        pctRefundsToCS: 0,
        costPerCSContact: 0,
        // Challenge 10/11 - 0 when not entered
        avgDiscountByAbusers: 0,
        promotionAbuseCatchRateToday: 0,
        // Metadata fields
        _analysisId: initialData?._analysisId,
        _analysisName: initialData?._analysisName,
        _authorName: initialData?._authorName,
      };
    }
    
    // Standard initialization for guided mode or loaded analyses (fraudCBAOV omitted so it defaults to Completed AOV)
    return {
      amerGrossMarginPercent: 50,
      emeaGrossMarginPercent: 50,
      apacGrossMarginPercent: 50,
      serviceCBAOV: 158,
      amerCreditCardPct: 100, // Default credit card % to 100%
      amerPostAuthImplemented: false, // Default Post-auth to excluded
      amerPostAuthApprovalRate: 100, // When excluded, rate is 100%
      forterKPIs: defaultForterKPIs,
      ...initialData,
    };
  });

  const [selectedChallenges, setSelectedChallenges] = useState<{ [key: string]: boolean }>(
    initialData?.selectedChallenges ?? {},
  );
  const [showResults, setShowResults] = useState(false);
  const [activeTab, setActiveTab] = useState(() => "profile");
  // Guided vs custom tab bar; must be declared before tabOrder/validTabs which depend on it
  const [showGuidedTabs, setShowGuidedTabs] = useState(() => {
    if (initialData?._pathwayMode) {
      return initialData._pathwayMode === 'manual';
    }
    return entryMode !== "custom";
  });
  
  // Sync with external tab control
  useEffect(() => {
    if (externalActiveTab && externalActiveTab !== activeTab) {
      setActiveTab(externalActiveTab);
    }
  }, [externalActiveTab]);
  const showInMillions = formData._showInMillions ?? false;
  const setShowInMillions = useCallback((value: boolean) => {
    setFormData((prev) => ({ ...prev, _showInMillions: value }));
    onFieldChange?.('_showInMillions', value);
  }, [onFieldChange]);
  const [forterKPIFocusTarget, setForterKPIFocusTarget] = useState<ForterKPIFocusSection | null>(null);
  const [forterKPIModalOpen, setForterKPIModalOpen] = useState(false);
  /** Shared list/grid layout for both Customer Inputs and Forter KPI tabs */
  const [inputsLayoutView, setInputsLayoutView] = useState<'list' | 'grid'>('grid');
  const [entryPath, setEntryPath] = useState<EntryPath | null>(() => entryMode === "custom" ? "custom" : null);
  const [showUseCaseLanding, setShowUseCaseLanding] = useState(() => entryMode !== "custom");
  // Initialize from initialData so strategic objectives persist when navigating back to Use Cases tab (or after remount)
  const [selectedObjectives, setSelectedObjectives] = useState<StrategicObjectiveId[]>(() => {
    const fromInitial = initialData?.selectedObjectives;
    if (fromInitial && Array.isArray(fromInitial) && fromInitial.length > 0) {
      return fromInitial as StrategicObjectiveId[];
    }
    return [];
  });
  const [strategicStep, setStrategicStep] = useState<'objectives' | 'usecases'>('objectives');
  const [valueTotals, setValueTotals] = useState<ValueTotals>({
    gmvUplift: 0,
    costReduction: 0,
    riskMitigation: 0,
    ebitdaContribution: 0,
    gmvUpliftBreakdown: [],
    costReductionBreakdown: [],
    riskMitigationBreakdown: [],
  });
  /** When set (e.g. from ROI tab benefit click), open the benefit modal without switching tab */
  const [benefitModalCalculatorId, setBenefitModalCalculatorId] = useState<string | null>(null);
  /** Persist which benefit modal tabs (Visual / Funnel / Success Story) have been viewed so checkmarks survive main-tab navigation */
  const [benefitTabsViewed, setBenefitTabsViewed] = useState<{ visual: Set<string>; funnel: Set<string>; successStories: Set<string> }>(() => ({
    visual: new Set(),
    funnel: new Set(),
    successStories: new Set(),
  }));
  const onPersistBenefitTabViewed = useCallback((tab: 'visual' | 'funnel' | 'success-stories', calculatorId: string) => {
    const key = tab === 'success-stories' ? 'successStories' : tab;
    setBenefitTabsViewed(prev => ({
      ...prev,
      [key]: new Set([...prev[key], calculatorId]),
    }));
  }, []);
  const [investmentInputs, setInvestmentInputs] = useState<InvestmentInputs>(() => initialData?.investmentInputs ?? defaultInvestmentInputs);
  const showInvestmentRowsToggle = formData._showInvestmentRowsOn ?? true;
  const setShowInvestmentRowsToggle = useCallback((value: boolean) => {
    setFormData((prev) => ({ ...prev, _showInvestmentRowsOn: value }));
    onFieldChange?.('_showInvestmentRowsOn', value);
  }, [onFieldChange]);
  const [templateDownloaded, setTemplateDownloaded] = useState(false);
  const [showCSVDownloadAnimation, setShowCSVDownloadAnimation] = useState(false);
  const [csvTemplateNeedsUpdate, setCsvTemplateNeedsUpdate] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  // Guided value welcome modal - show for new assessments in guided mode
  const [showGuidedWelcome, setShowGuidedWelcome] = useState(() => {
    // Show welcome only for new guided assessments (no existing data)
    if (entryMode === "custom") return false;
    const hasExistingData = initialData?.customerName || 
                            Object.values(initialData?.selectedChallenges ?? {}).some(Boolean);
    return !hasExistingData;
  });
  
  // Tab unlock animation state
  const [recentlyUnlockedTabs, setRecentlyUnlockedTabs] = useState<string[]>([]);
  const prevHasSelectedChallengesRef = useRef(false);

  // ROI tab stays locked until user has viewed Value Summary at least once (restored from loaded analysis)
  const [hasViewedValueSummary, setHasViewedValueSummary] = useState(() => !!initialData?._valueSummaryViewed);
  
  // Segmentation state
  const [segments, setSegments] = useState<Segment[]>(initialData?.segments ?? []);
  const [segmentationEnabled, setSegmentationEnabled] = useState(initialData?.segmentationEnabled ?? false);
  const [segmentEditorOpen, setSegmentEditorOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [segmentToDelete, setSegmentToDelete] = useState<Segment | null>(null);

  // Track the initialData's analysis ID to detect when a new analysis is loaded
  const loadedAnalysisIdRef = useRef<string | undefined>(initialData?._analysisId);
  // Track if this is a "Save As" operation (same data, just new ID) vs a real load
  const isSaveAsOperationRef = useRef(false);
  // Track HQ location and currency so we only prompt for currency change on user edit, not when opening a saved analysis
  const prevHqLocationRef = useRef<string | undefined>(initialData?.hqLocation);
  const prevBaseCurrencyRef = useRef<string | undefined>(initialData?.baseCurrency);
  const justLoadedAnalysisIdRef = useRef<string | null>(null);

  // Sync state when a different analysis is loaded from parent (e.g., Open Saved Analysis)
  // This effect should ONLY run when loading a truly different analysis, not on Save As
  useEffect(() => {
    const newAnalysisId = initialData?._analysisId;
    const prevAnalysisId = loadedAnalysisIdRef.current;
    // If there's no ID change, nothing to sync (same analysis; don't overwrite user edits)
    if (!newAnalysisId || newAnalysisId === prevAnalysisId) {
      return;
    }
    
    // Check if this is a Save As operation by comparing data content
    // If the selectedChallenges, customerName, and other core data match our current state,
    // it's a Save As (just new ID), not a load of different data
    const currentChallengesJson = JSON.stringify(selectedChallenges);
    const loadedChallengesJson = JSON.stringify(initialData?.selectedChallenges ?? {});
    const isSameData = currentChallengesJson === loadedChallengesJson && 
                       formData.customerName === initialData?.customerName;
    if (isSameData) {
      // This is a Save As - just update the ref, don't reset state
      loadedAnalysisIdRef.current = newAnalysisId;
      return;
    }
    
    // This is a real load of different analysis data
    loadedAnalysisIdRef.current = newAnalysisId;

    // Always start on Profile when opening a saved analysis
    setActiveTab("profile");
    
    // Reset all local state to match the loaded analysis - FULL state reset
    const newFormData = {
      amerGrossMarginPercent: 50,
      emeaGrossMarginPercent: 50,
      apacGrossMarginPercent: 50,
      serviceCBAOV: 158,
      amerCreditCardPct: 100,
      amerPostAuthImplemented: false,
      amerPostAuthApprovalRate: 100,
      forterKPIs: defaultForterKPIs,
      // Spread ALL fields from initialData including isMarketplace, commissionRate, baseCurrency, investmentInputs, etc.
      ...initialData,
    };
    // Ensure base currency is always restored so investment costs (stored in that currency) are not reconverted or reset.
    // If stored blob has no baseCurrency (e.g. legacy save or race), derive from hqLocation so it doesn't revert to USD.
    const explicitCurrency = (initialData?.baseCurrency != null && initialData.baseCurrency !== '')
      ? initialData.baseCurrency
      : null;
    const restoredCurrency = explicitCurrency
      ?? (initialData?.hqLocation?.trim() ? getCurrencyForCountry(initialData.hqLocation.trim()) : null)
      ?? newFormData.baseCurrency
      ?? 'USD';
    newFormData.baseCurrency = restoredCurrency;
    setFormData(newFormData);
    setSelectedChallenges(initialData?.selectedChallenges ?? {});
    // Sync restored base currency to parent so Index state stays correct and auto-save persists it
    onFieldChange?.('baseCurrency' as keyof CalculatorData, restoredCurrency);
    prevBaseCurrencyRef.current = restoredCurrency;
    setSegments(initialData?.segments ?? []);
    setSegmentationEnabled(initialData?.segmentationEnabled ?? false);

    // Restore ROI unlock state: if this analysis had Value Summary viewed, ROI tab stays unlocked
    setHasViewedValueSummary(!!initialData?._valueSummaryViewed);

    // Restore investment inputs so re-opening an analysis shows the same investment cost
    setInvestmentInputs(initialData?.investmentInputs ?? defaultInvestmentInputs);

    // Mark that we just loaded this analysis so the currency effect can skip prompting on the next render
    justLoadedAnalysisIdRef.current = newAnalysisId;
    
    // Restore strategic objectives from loaded analysis so use case suggestions persist
    const loadedObjectives = (initialData?.selectedObjectives && initialData.selectedObjectives.length > 0)
      ? (initialData.selectedObjectives as StrategicObjectiveId[])
      : [];
    setSelectedObjectives(loadedObjectives);

    // Restore entry path: strategic view if analysis had objectives, otherwise direct use case list
    setEntryPath(loadedObjectives.length > 0 ? 'strategic' : null);
    
    // Reset entry path based on loaded pathway mode
    if (initialData?._pathwayMode === 'custom') {
      console.log('[ManualInputForm] Detected custom pathway in initialData, setting showGuidedTabs to false');
      setShowGuidedTabs(false);
    } else if (entryMode !== "custom") {
      console.log('[ManualInputForm] Setting showGuidedTabs to true for guided mode');
      setShowGuidedTabs(true);
      // Don't show landing if we have use cases (challenges) or strategic objectives from the loaded analysis
      const hasChallenges = Object.keys(initialData?.selectedChallenges ?? {}).some(k => initialData?.selectedChallenges?.[k]);
      const hasObjectives = (initialData?.selectedObjectives?.length ?? 0) > 0;
      setShowUseCaseLanding(!hasChallenges && !hasObjectives);
    }
  }, [initialData?._analysisId, initialData?.selectedChallenges, initialData?.selectedObjectives, initialData?.customerName, initialData?.baseCurrency, initialData?._pathwayMode, entryMode]);

  // When parent has loaded data (e.g. Open analysis): keep use cases and baseCurrency in sync if we're viewing that analysis
  useEffect(() => {
    const analysisId = initialData?._analysisId;
    if (!analysisId || analysisId !== loadedAnalysisIdRef.current) return;
    const fromParent = initialData?.selectedChallenges;
    if (fromParent == null) return;
    const parentJson = JSON.stringify(fromParent);
    const currentJson = JSON.stringify(selectedChallenges);
    if (parentJson !== currentJson) {
      setSelectedChallenges(fromParent);
    }
    const objectivesFromParent = initialData?.selectedObjectives;
    if (objectivesFromParent && Array.isArray(objectivesFromParent) && objectivesFromParent.length > 0) {
      const objJson = JSON.stringify(objectivesFromParent);
      const currentObjJson = JSON.stringify(selectedObjectives);
      if (objJson !== currentObjJson) {
        setSelectedObjectives(objectivesFromParent as StrategicObjectiveId[]);
      }
    }
    // Keep base currency in sync so investment costs (stored in that currency) are not reset
    const parentCurrency = initialData?.baseCurrency;
    if (parentCurrency != null && parentCurrency !== '' && parentCurrency !== formData.baseCurrency) {
      setFormData((prev) => ({ ...prev, baseCurrency: parentCurrency }));
    }
  }, [initialData?._analysisId, initialData?.selectedChallenges, initialData?.selectedObjectives, initialData?.baseCurrency]);

  // When navigating back to Use Cases tab, restore strategic objectives from parent if local state is empty but parent has them (fixes out-of-sync)
  useEffect(() => {
    if (activeTab !== 'challenges') return;
    const fromParent = initialData?.selectedObjectives;
    if (fromParent && Array.isArray(fromParent) && fromParent.length > 0 && selectedObjectives.length === 0) {
      setSelectedObjectives(fromParent as StrategicObjectiveId[]);
    }
  }, [activeTab, initialData?.selectedObjectives, selectedObjectives.length]);

  const inputProgress = useInputProgress(formData, selectedChallenges);
  
  // ROI full completion requires investment entered; half completion when ROI viewed with data but no investment
  const hasInvestment = useMemo(() => {
    const costs = calculateInvestmentCosts(investmentInputs, formData);
    return costs.totalACV > 0 || costs.integrationCost > 0;
  }, [investmentInputs, formData]);

  // Persist investment inputs to parent so re-opening an analysis restores investment cost
  const handleInvestmentInputsChange = useCallback((inputs: InvestmentInputs) => {
    setInvestmentInputs(inputs);
    onInvestmentPersist?.(inputs);
  }, [onInvestmentPersist]);

  // Track tab completion for checkmark badges
  const { completion: tabCompletion, markTabViewed, canGenerateReports, showReportAnimation, dismissReportAnimation } = useTabCompletion({
    formData,
    selectedChallenges,
    valueTotals,
    hasInvestment,
    showInvestmentRowsOn: showInvestmentRowsToggle,
  });
  
  // Report completion changes to parent for global progress bar
  useEffect(() => {
    onCompletionChange?.(tabCompletion);
  }, [tabCompletion, onCompletionChange]);

  // Detect when a new CSV template is required due to use case changes
  useEffect(() => {
    if (templateDownloaded || hasDownloadedTemplate()) {
      const storedFieldCount = localStorage.getItem('csv_template_field_count');
      const storedChallengeHash = localStorage.getItem('csv_template_challenge_hash');
      const storedSegmentCount = localStorage.getItem('csv_template_segment_count');
      
      if (storedFieldCount && storedChallengeHash) {
        const currentFieldCount = getRequiredInputFields(selectedChallenges, getCurrencySymbol(formData.baseCurrency || 'USD'), formData.isMarketplace).length;
        const currentChallengeHash = Object.entries(selectedChallenges).filter(([,v]) => v).map(([k]) => k).sort().join(',');
        const currentSegmentCount = segmentationEnabled ? segments.filter(s => s.enabled).length : 0;
        
        // Check if fields, challenges, or segments have changed
        const fieldsChanged = currentFieldCount !== parseInt(storedFieldCount);
        const challengesChanged = currentChallengeHash !== storedChallengeHash;
        const segmentsChanged = currentSegmentCount !== parseInt(storedSegmentCount || '0');
        
        const needsUpdate = fieldsChanged || challengesChanged || segmentsChanged;
        setCsvTemplateNeedsUpdate(needsUpdate);
      } else {
        setCsvTemplateNeedsUpdate(false);
      }
    } else {
      setCsvTemplateNeedsUpdate(false);
    }
  }, [templateDownloaded, selectedChallenges, formData.baseCurrency, formData.isMarketplace, segmentationEnabled, segments]);
  
  // Trigger animation when navigating to inputs tab if template needs update
  useEffect(() => {
    if (activeTab === 'inputs' && csvTemplateNeedsUpdate) {
      setShowCSVDownloadAnimation(true);
      // Stop animation after 10 seconds
      const timer = setTimeout(() => {
        setShowCSVDownloadAnimation(false);
      }, 10000);
      return () => clearTimeout(timer);
    } else {
      setShowCSVDownloadAnimation(false);
    }
  }, [activeTab, csvTemplateNeedsUpdate]);
  
  // State for generate report modal
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [calculatorSubsetForReport, setCalculatorSubsetForReport] = useState<CalculatorSubsetForReport | null>(null);
  const [lastExecutiveSummaryUrl, setLastExecutiveSummaryUrl] = useState<string | null>(null);
  const [lastValueDeckUrl, setLastValueDeckUrl] = useState<string | null>(null);
  
  // Track when a report was last generated and what data was used
  const [lastReportDataHash, setLastReportDataHash] = useState<string | null>(null);
  
  // Create a hash of report-relevant data to detect changes
  const currentReportDataHash = useMemo(() => {
    const relevantData = {
      valueTotals,
      customerName: formData.customerName,
      industry: formData.industry,
      selectedChallenges,
      // Include key financial inputs that affect reports
      amerAnnualGMV: formData.amerAnnualGMV,
      emeaAnnualGMV: formData.emeaAnnualGMV,
      apacAnnualGMV: formData.apacAnnualGMV,
    };
    return JSON.stringify(relevantData);
  }, [valueTotals, formData.customerName, formData.industry, selectedChallenges, 
      formData.amerAnnualGMV, formData.emeaAnnualGMV, formData.apacAnnualGMV]);
  
  // Check if report data has changed since last generation
  const reportNeedsUpdate = lastReportDataHash !== null && lastReportDataHash !== currentReportDataHash;
  
  // Callback to mark report as generated (called from modal on successful generation)
  const handleReportGenerated = useCallback(() => {
    setLastReportDataHash(currentReportDataHash);
  }, [currentReportDataHash]);
  
  // Mini icons per tab (light and friendly)
  const tabIcons: Record<keyof typeof tabCompletion, React.ReactNode> = {
    profile: <User className="h-3.5 w-3.5 shrink-0" />,
    challenges: <ListChecks className="h-3.5 w-3.5 shrink-0" />,
    inputs: <ClipboardList className="h-3.5 w-3.5 shrink-0" />,
    forter: <Gauge className="h-3.5 w-3.5 shrink-0" />,
    summary: <PieChart className="h-3.5 w-3.5 shrink-0" />,
    roi: <TrendingUp className="h-3.5 w-3.5 shrink-0" />,
  };

  // Helper to render tab label with icon and progress indicator
  // Only show completion indicator for unlocked tabs (profile/challenges always unlocked, others require selected challenges)
  const renderTabLabel = (tabKey: keyof typeof tabCompletion, label: string, isLocked: boolean = false) => (
    <span className="flex items-center gap-1.5">
      {tabIcons[tabKey]}
      {label}
      {!isLocked && <TabCompletionIndicator progress={tabCompletion[tabKey]} size={14} />}
    </span>
  );
  
  // Clear all customer input fields (preserves profile and challenge selections)
  const handleClearInputs = useCallback(() => {
    // List of fields that are customer inputs (not profile or config fields)
    const inputFieldsToClear: (keyof CalculatorData)[] = [
      // Regional GMV/Attempts
      'amerAnnualGMV', 'amerGrossAttempts', 'amerPreAuthApprovalRate', 'amerPostAuthApprovalRate',
      'amerIssuingBankDeclineRate', 'amerCreditCardPct', 'amer3DSChallengeRate', 'amer3DSAbandonmentRate',
      'emeaAnnualGMV', 'emeaGrossAttempts', 'emeaPreAuthApprovalRate', 'emeaPostAuthApprovalRate',
      'emeaIssuingBankDeclineRate', 'emeaCreditCardPct', 'emea3DSChallengeRate', 'emea3DSAbandonmentRate',
      'apacAnnualGMV', 'apacGrossAttempts', 'apacPreAuthApprovalRate', 'apacPostAuthApprovalRate',
      'apacIssuingBankDeclineRate', 'apacCreditCardPct', 'apac3DSChallengeRate', 'apac3DSAbandonmentRate',
      // Chargebacks
      'fraudCBRate', 'fraudCBAOV', 'serviceCBRate', 'serviceCBAOV',
      // Manual Review
      'manualReviewPct', 'timePerReview', 'hourlyReviewerCost',
      // Chargeback Disputes
      'fraudDisputeRate', 'fraudWinRate', 'serviceDisputeRate', 'serviceWinRate',
      'avgTimeToReviewCB', 'annualCBDisputes', 'costPerHourAnalyst',
      'estFraudChargebackValue', 'estServiceChargebackValue',
      // Abuse Prevention
      'refundRate', 'expectedRefundsVolume', 'avgRefundValue', 'avgOneWayShipping',
      'avgFulfilmentCost', 'txProcessingFeePct', 'avgCSTicketCost', 'pctINRClaims', 'pctReplacedCredits',
      // Promotions Abuse
      'avgDiscountByAbusers', 'promotionAbuseCatchRateToday',
      // Instant Refunds
      'pctRefundsToCS', 'costPerCSContact',
      // ATO Protection
      'monthlyLogins', 'customerLTV', 'avgAppeasementValue', 'avgSalaryPerCSMember',
      'avgHandlingTimePerATOClaim', 'pctChurnFromATO',
      // Sign-up Protection
      'monthlySignups', 'avgNewMemberBonus', 'numDigitalCommunicationsPerYear',
      'avgCostPerOutreach', 'avgKYCCostPerAccount', 'pctAccountsGoingThroughKYC',
      // Other
      'completedAOV',
    ];
    
    setFormData(prev => {
      const cleared = { ...prev };
      for (const field of inputFieldsToClear) {
        if (field in cleared) {
          (cleared as any)[field] = undefined;
        }
      }
      return cleared;
    });
    
    setShowClearConfirm(false);
    toast.success("All input fields have been cleared");
  }, []);

  // Determine if we're in custom mode (skip tabs)
  // Check both the entryMode prop AND the persisted _pathwayMode from loaded analysis
  // Define this early so it can be used in hooks below
  const isCustomMode = entryMode === "custom" || initialData?._pathwayMode === 'custom';
  
  // Check if segments option should be visible (when fraud/payments challenges are selected)
  const showSegmentsOption = useMemo(() => hasPaymentChallengesSelected(selectedChallenges), [selectedChallenges]);
  
  // Check if at least one challenge is selected
  const hasSelectedChallenges = useMemo(() => Object.values(selectedChallenges).some(Boolean), [selectedChallenges]);
  
  // Smart tab unlock feedback - animate when tabs become unlocked (ROI stays locked until Value Summary is viewed)
  // Don't show in custom mode
  useEffect(() => {
    if (hasSelectedChallenges && !prevHasSelectedChallengesRef.current && !isCustomMode) {
      // Only inputs and summary unlock when use cases are selected; ROI unlocks after viewing Value Summary
      const unlockedTabs = ['inputs', 'summary'];
      setRecentlyUnlockedTabs(unlockedTabs);
      toast.success("Tabs unlocked!", {
        description: "You can now access Customer Inputs and Value Summary. Use \"Refine Solution Assumptions\" when needed. View Value Summary to unlock ROI.",
        duration: 4000,
        icon: <Unlock className="h-4 w-4" />,
      });
      setTimeout(() => setRecentlyUnlockedTabs([]), 2500);
    }
    prevHasSelectedChallengesRef.current = hasSelectedChallenges;
  }, [hasSelectedChallenges, isCustomMode]);

  // Mark Value Summary as viewed whenever user is on that tab (unlocks ROI) - works for tab click, Next/Previous, or any navigation
  // Persist _valueSummaryViewed so saved/loaded analyses restore ROI unlock state
  useEffect(() => {
    if (activeTab === 'summary') {
      setHasViewedValueSummary(true);
      setFormData(prev => ({ ...prev, _valueSummaryViewed: true } as CalculatorData));
      onFieldChange?.('_valueSummaryViewed' as keyof CalculatorData, true);
    }
  }, [activeTab, onFieldChange]);

  // When ROI first becomes unlocked (user viewed Value Summary), show same pulse animation as other unlocked tabs
  const prevHasViewedValueSummaryRef = useRef(false);
  useEffect(() => {
    if (hasSelectedChallenges && hasViewedValueSummary && !prevHasViewedValueSummaryRef.current && !isCustomMode) {
      setRecentlyUnlockedTabs(prev => (prev.includes('roi') ? prev : [...prev, 'roi']));
      toast.success("ROI tab unlocked!", {
        description: "You can now access the ROI section.",
        duration: 3000,
        icon: <Unlock className="h-4 w-4" />,
      });
      setTimeout(() => setRecentlyUnlockedTabs(prev => prev.filter(t => t !== 'roi')), 2500);
    }
    prevHasViewedValueSummaryRef.current = hasViewedValueSummary;
  }, [hasViewedValueSummary, hasSelectedChallenges, isCustomMode]);
  
  // Tab order: in guided mode Forter KPI is in a modal, not a tab
  const tabOrder = showGuidedTabs ? ["profile", "challenges", "inputs", "summary", "roi"] : ["profile", "summary", "roi"];
  const tabNames: Record<string, string> = {
    profile: "Profile",
    challenges: "Use Cases",
    inputs: "Customer Inputs",
    forter: "Solution KPI",
    summary: "Value Summary",
    roi: "ROI",
  };
  
  // Get next/previous tab names for navigation buttons
  const getNextTabName = () => {
    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex < tabOrder.length - 1) {
      const nextTab = tabOrder[currentIndex + 1];
      return tabNames[nextTab] || nextTab;
    }
    return "";
  };
  
  const getPreviousTabName = () => {
    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex > 0) {
      const prevTab = tabOrder[currentIndex - 1];
      return tabNames[prevTab] || prevTab;
    }
    return "";
  };
  
  // Mark tabs as viewed when navigated
  useEffect(() => {
    if (activeTab === 'summary' || activeTab === 'roi') {
      markTabViewed(activeTab);
    }
  }, [activeTab, markTabViewed]);
  
  const goToNextTab = () => {
    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex < tabOrder.length - 1) {
      setActiveTab(tabOrder[currentIndex + 1]);
    }
  };

  const goToPreviousTab = () => {
    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(tabOrder[currentIndex - 1]);
    }
  };

  const isFirstTab = activeTab === tabOrder[0];
  const isLastTab = activeTab === tabOrder[tabOrder.length - 1];

  // Update Forter KPI defaults when industry or HQ location changes
  useEffect(() => {
    const currentKpis = formData.forterKPIs || defaultForterKPIs;
    if (currentKpis.preAuthApprovalUserOverride === true || currentKpis.postAuthApprovalUserOverride === true || currentKpis.approvalRateUserOverride === true) return;
    const weightedRate = getWeightedApprovalRate(formData.industry, formData.hqLocation);
    if (weightedRate !== undefined) {
      // Only update if different from current value to avoid infinite loops
      if (currentKpis.preAuthApprovalImprovement !== weightedRate ||
          currentKpis.postAuthApprovalImprovement !== weightedRate ||
          currentKpis.approvalRateImprovement !== weightedRate) {
        setFormData(prev => ({
          ...prev,
          forterKPIs: {
            ...(prev.forterKPIs || defaultForterKPIs),
            preAuthApprovalImprovement: weightedRate,
            postAuthApprovalImprovement: weightedRate,
            approvalRateImprovement: weightedRate,
            // Ensure these are in absolute mode since weighted rate is a target rate
            preAuthApprovalIsAbsolute: true,
            postAuthApprovalIsAbsolute: true,
            approvalRateIsAbsolute: true,
          }
        }));
      }
    }
  }, [formData.industry, formData.hqLocation, formData.forterKPIs?.preAuthApprovalUserOverride, formData.forterKPIs?.postAuthApprovalUserOverride, formData.forterKPIs?.approvalRateUserOverride]);

  // Auto-update currency when HQ location changes - with user confirmation (refs declared above so they can be synced on load)
  const [pendingCurrencyChange, setPendingCurrencyChange] = useState<{
    newCurrency: string;
    newLocation: string;
  } | null>(null);
  
  useEffect(() => {
    // Skip prompting when we're displaying a freshly loaded analysis (user already chose currency when they saved)
    if (justLoadedAnalysisIdRef.current && formData._analysisId === justLoadedAnalysisIdRef.current) {
      prevHqLocationRef.current = formData.hqLocation;
      prevBaseCurrencyRef.current = formData.baseCurrency || 'USD';
      justLoadedAnalysisIdRef.current = null;
      return;
    }

    // Only prompt for currency change if HQ location actually changed (user edit), not when opening a saved analysis
    if (formData.hqLocation && formData.hqLocation !== prevHqLocationRef.current) {
      const suggestedCurrency = getCurrencyForCountry(formData.hqLocation);
      const currentCurrency = formData.baseCurrency || 'USD';
      
      // Only prompt if the suggested currency is different from current
      if (suggestedCurrency !== currentCurrency) {
        setPendingCurrencyChange({
          newCurrency: suggestedCurrency,
          newLocation: formData.hqLocation
        });
      }
      
      prevHqLocationRef.current = formData.hqLocation;
    }
  }, [formData.hqLocation, formData.baseCurrency, formData._analysisId]);
  
  const handleAcceptCurrencyChange = () => {
    if (pendingCurrencyChange) {
      const newCurrency = pendingCurrencyChange.newCurrency;
      setFormData(prev => ({
        ...prev,
        baseCurrency: newCurrency
      }));
      // Persist to parent so auto-save and reopen restore this currency (even when set via country, not manual dropdown)
      onFieldChange?.('baseCurrency' as keyof CalculatorData, newCurrency);
      prevBaseCurrencyRef.current = newCurrency;
      const symbol = getCurrencySymbol(newCurrency);
      toast.success(`Currency updated to ${newCurrency} (${symbol})`, {
        description: "Investment pricing will be updated to reflect the new currency.",
        duration: 4000,
      });
      setPendingCurrencyChange(null);
    }
  };
  
  const handleDeclineCurrencyChange = () => {
    setPendingCurrencyChange(null);
    toast.info("Currency kept as " + (formData.baseCurrency || 'USD'), {
      duration: 3000,
    });
  };
  
  // Track currency changes from manual selection (not from HQ location change)
  useEffect(() => {
    const currentCurrency = formData.baseCurrency || 'USD';
    if (prevBaseCurrencyRef.current && 
        prevBaseCurrencyRef.current !== currentCurrency && 
        !pendingCurrencyChange) {
      const symbol = getCurrencySymbol(currentCurrency);
      toast.info(`Currency changed to ${currentCurrency} (${symbol})`, {
        description: "Investment pricing will be updated to reflect the new currency.",
        duration: 4000,
      });
    }
    prevBaseCurrencyRef.current = currentCurrency;
  }, [formData.baseCurrency, pendingCurrencyChange]);

  // Update Target Fraud CB Rate based on fraudCBRate and existing vendor
  useEffect(() => {
    const currentKpis = formData.forterKPIs || defaultForterKPIs;
    if (currentKpis.chargebackReductionUserOverride === true) return;
    if (formData.fraudCBRate !== undefined && formData.fraudCBRate > 0) {
      // Get the vendor reduction factor (defaults to 1.0 if no vendor selected)
      const vendorFactor = getVendorCBReductionFactor(formData.existingFraudVendor || '');
      // Apply vendor factor to the current CB rate to get target
      const targetCBRate = parseFloat((formData.fraudCBRate * vendorFactor).toFixed(3));
      if (currentKpis.chargebackReduction !== targetCBRate) {
        setFormData(prev => ({
          ...prev,
          forterKPIs: {
            ...(prev.forterKPIs || defaultForterKPIs),
            chargebackReduction: targetCBRate,
          }
        }));
      }
    }
  }, [formData.fraudCBRate, formData.existingFraudVendor, formData.forterKPIs?.chargebackReductionUserOverride]);

  // Update Target 3DS Rate based on country and AOV
  useEffect(() => {
    const hqLocation = formData.hqLocation;
    const gmv = formData.amerAnnualGMV || 0;
    const attempts = formData.amerGrossAttempts || 0;
    const aov = attempts > 0 ? gmv / attempts : 0;
    const baseCurrency = formData.baseCurrency || 'USD';
    const currentKpis = formData.forterKPIs || defaultForterKPIs;
    // Do not overwrite 3DS rate when user has overridden it (e.g. from calculator modal or KPI config)
    if (currentKpis.threeDSRateUserOverride === true) return;

    if (hqLocation && aov > 0) {
      const { rate: recommended3DSRate } = get3DSRateByCountryAndAOV(hqLocation, aov, baseCurrency);
      // Only update if the customer has 3DS implemented and rate differs
      if (formData.amer3DSImplemented !== false && currentKpis.threeDSReduction !== recommended3DSRate) {
        setFormData(prev => ({
          ...prev,
          forterKPIs: {
            ...(prev.forterKPIs || defaultForterKPIs),
            threeDSReduction: recommended3DSRate,
            threeDSReductionIsAbsolute: true,
          }
        }));
      }
    }
  }, [formData.hqLocation, formData.amerAnnualGMV, formData.amerGrossAttempts, formData.amer3DSImplemented, formData.baseCurrency, formData.forterKPIs?.threeDSRateUserOverride]);

  // Which Forter KPI values currently match auto-applied benchmarks (for "Forter Benchmark" pill + tooltip)
  const forterBenchmarkSources = useMemo((): Partial<Record<keyof ForterKPIs, string>> => {
    const kpis = formData.forterKPIs || defaultForterKPIs;
    const sources: Partial<Record<keyof ForterKPIs, string>> = {};
    const weightedRate = getWeightedApprovalRate(formData.industry, formData.hqLocation);
    if (weightedRate !== undefined) {
      if (kpis.approvalRateImprovement === weightedRate) {
        sources.approvalRateImprovement = "Based on industry and HQ location (country).";
      }
      if (kpis.preAuthApprovalImprovement === weightedRate) {
        sources.preAuthApprovalImprovement = "Based on industry and HQ location (country).";
      }
      if (kpis.postAuthApprovalImprovement === weightedRate) {
        sources.postAuthApprovalImprovement = "Based on industry and HQ location (country).";
      }
    }
    if (formData.fraudCBRate !== undefined && formData.fraudCBRate > 0) {
      const targetCBRate = parseFloat((formData.fraudCBRate * getVendorCBReductionFactor(formData.existingFraudVendor || "")).toFixed(3));
      if (kpis.chargebackReduction === targetCBRate) {
        sources.chargebackReduction = "Based on existing fraud vendor selection.";
      }
    }
    const hqLocation = formData.hqLocation;
    const gmv = formData.amerAnnualGMV || 0;
    const attempts = formData.amerGrossAttempts || 0;
    const aov = attempts > 0 ? gmv / attempts : 0;
    const baseCurrency = formData.baseCurrency || "USD";
    if (hqLocation && aov > 0) {
      const { rate: recommended3DSRate } = get3DSRateByCountryAndAOV(hqLocation, aov, baseCurrency);
      if (kpis.threeDSReduction === recommended3DSRate) {
        sources.threeDSReduction = "Based on HQ location (country) and AOV.";
      }
    }
    return sources;
  }, [formData.industry, formData.hqLocation, formData.forterKPIs, formData.fraudCBRate, formData.existingFraudVendor, formData.amerAnnualGMV, formData.amerGrossAttempts, formData.baseCurrency]);

  // Current benchmark values for reset-to-benchmark (only fields that have a benchmark)
  const forterBenchmarkValues = useMemo((): Partial<Record<keyof ForterKPIs, number>> => {
    const values: Partial<Record<keyof ForterKPIs, number>> = {};
    const weightedRate = getWeightedApprovalRate(formData.industry, formData.hqLocation);
    if (weightedRate !== undefined) {
      values.approvalRateImprovement = weightedRate;
      values.preAuthApprovalImprovement = weightedRate;
      values.postAuthApprovalImprovement = weightedRate;
    }
    if (formData.fraudCBRate !== undefined && formData.fraudCBRate > 0) {
      values.chargebackReduction = parseFloat((formData.fraudCBRate * getVendorCBReductionFactor(formData.existingFraudVendor || "")).toFixed(3));
    }
    const hqLocation = formData.hqLocation;
    const gmv = formData.amerAnnualGMV || 0;
    const attempts = formData.amerGrossAttempts || 0;
    const aov = attempts > 0 ? gmv / attempts : 0;
    const baseCurrency = formData.baseCurrency || "USD";
    if (hqLocation && aov > 0) {
      const { rate: recommended3DSRate } = get3DSRateByCountryAndAOV(hqLocation, aov, baseCurrency);
      values.threeDSReduction = recommended3DSRate;
    }
    return values;
  }, [formData.industry, formData.hqLocation, formData.fraudCBRate, formData.existingFraudVendor, formData.amerAnnualGMV, formData.amerGrossAttempts, formData.baseCurrency]);

  // PSD2 3DS suggestion for Fraud Detection & 3DS pill (rate + reason when PSD2 country and AOV set)
  const suggested3DSFromPSD2 = useMemo((): { rate: number; reason: string } | null => {
    const hqLocation = formData.hqLocation;
    const gmv = formData.amerAnnualGMV || 0;
    const attempts = formData.amerGrossAttempts || 0;
    const aov = attempts > 0 ? gmv / attempts : 0;
    const baseCurrency = formData.baseCurrency || "USD";
    if (!hqLocation || aov <= 0) return null;
    const result = get3DSRateByCountryAndAOV(hqLocation, aov, baseCurrency);
    return { rate: result.rate, reason: result.reason };
  }, [formData.hqLocation, formData.amerAnnualGMV, formData.amerGrossAttempts, formData.baseCurrency]);

  // Ensure base currency is never 0 or invalid (avoids "0" showing below Base Currency when retailer is selected)
  const validBaseCurrency = (code: string | number | undefined): string => {
    const s = code == null ? "" : String(code);
    if (!s || s === "0") return "USD";
    return topCurrencies.some((c) => c.code === s) ? s : "USD";
  };

  // Stable updateField that notifies parent of individual field changes
  // Coerce numeric customer inputs (e.g. from calculator table) so they persist as numbers
  const updateField = useCallback((field: keyof CalculatorData, value: any) => {
    let toStore = value;
    if (field === 'forterKPIs' && value && typeof value === 'object' && value.abuseBenchmarks != null) {
      // Always persist a full abuseBenchmarks object so inventory-loss and other advanced abuse values never revert
      toStore = { ...value, abuseBenchmarks: { ...defaultAbuseBenchmarks, ...value.abuseBenchmarks } };
    }
    const isNumeric = typeof toStore === 'number' && !Number.isNaN(toStore);
    const parsed = typeof toStore === 'string' ? parseFloat(toStore) : toStore;
    const final = isNumeric ? toStore : (typeof parsed === 'number' && !Number.isNaN(parsed) ? parsed : toStore);
    setFormData((prev) => ({ ...prev, [field]: final }));
    if (onFieldChange) {
      onFieldChange(field, final);
    }
  }, [onFieldChange]);

  // Default Fraud Chargeback AOV to Completed AOV when not set (user can override by entering a value)
  useEffect(() => {
    const fraudCBAOV = formData.fraudCBAOV;
    if (fraudCBAOV !== undefined && fraudCBAOV !== null) return; // User has set a value; don't overwrite
    const attempts = formData.amerGrossAttempts || 0;
    const gmv = formData.amerAnnualGMV || 0;
    const effectiveCompletedAOV = formData.completedAOV ?? (attempts > 0 ? gmv / attempts : 0);
    if (effectiveCompletedAOV <= 0) return;
    setFormData((prev) => ({ ...prev, fraudCBAOV: Math.round(effectiveCompletedAOV) }));
    onFieldChange?.("fraudCBAOV", Math.round(effectiveCompletedAOV));
  }, [formData.fraudCBAOV, formData.completedAOV, formData.amerGrossAttempts, formData.amerAnnualGMV, onFieldChange]);

  // Allow editing directly inside calculator tables (Value Summary tab), including custom benefit names (Record<string, string>)
  const handleSummaryFormDataChange = useCallback(
    (field: keyof CalculatorData, value: number | Record<string, string>) => {
      updateField(field, value);
    },
    [updateField]
  );

  const handleSummaryForterKPIChange = useCallback(
    (field: keyof ForterKPIs, value: number) => {
      setFormData((prev) => {
        const base = prev.forterKPIs || defaultForterKPIs;
        // When editing from calculator table, treat as target (absolute) so reload persists correctly
        const absoluteFlags: Partial<ForterKPIs> = {};
        if (field === 'preAuthApprovalImprovement') {
          absoluteFlags.preAuthApprovalIsAbsolute = true;
          absoluteFlags.preAuthApprovalUserOverride = true;
        } else if (field === 'postAuthApprovalImprovement') {
          absoluteFlags.postAuthApprovalIsAbsolute = true;
          absoluteFlags.postAuthApprovalUserOverride = true;
        } else if (field === 'threeDSReduction') {
          absoluteFlags.threeDSReductionIsAbsolute = true;
          absoluteFlags.threeDSRateUserOverride = true;
        } else if (field === 'chargebackReduction') {
          absoluteFlags.chargebackReductionIsAbsolute = true;
          absoluteFlags.chargebackReductionUserOverride = true;
        } else if (field === 'manualReviewReduction') absoluteFlags.manualReviewIsAbsolute = true;
        const fieldValue = field === 'abuseBenchmarks' && value && typeof value === 'object'
          ? { ...defaultAbuseBenchmarks, ...value }
          : value;
        const updatedKPIs = {
          ...base,
          [field]: fieldValue,
          ...absoluteFlags,
        };

        // Persist to parent so auto-save and reopen restore calculator-edited values
        onFieldChange?.("forterKPIs", updatedKPIs);

        return {
          ...prev,
          forterKPIs: updatedKPIs,
        };
      });
    },
    [onFieldChange]
  );

  // One-time default: for analyses with annual economic impact > $10m, default "Show in millions" to on (Value Summary and ROI)
  useEffect(() => {
    const annualImpact = valueTotals?.ebitdaContribution ?? 0;
    if (annualImpact > 10_000_000 && !formData._showInMillionsDefaultApplied) {
      updateField('_showInMillions', true);
      updateField('_showInMillionsDefaultApplied', true);
    }
  }, [valueTotals?.ebitdaContribution, formData._showInMillionsDefaultApplied, updateField]);

  const formatNumberWithCommas = (value: number | undefined | null): string => {
    if (value === undefined || value === null || value === 0) return "";
    return value.toLocaleString("en-US");
  };

  const parseNumberFromString = (value: string): number => {
    if (!value) return 0;
    const cleaned = value.replace(/,/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const handleChallengeChange = useCallback((challengeId: string, checked: boolean) => {
    const newChallenges = { ...selectedChallenges, [challengeId]: checked };
    setSelectedChallenges(newChallenges);
    setFormData(prev => ({ ...prev, selectedChallenges: newChallenges }));
    if (onFieldChange) {
      onFieldChange("selectedChallenges", newChallenges);
    }
  }, [selectedChallenges, onFieldChange]);

  // Handle bulk challenge changes (from strategic objectives flow)
  const handleBulkChallengeChange = useCallback((challenges: { [key: string]: boolean }) => {
    setSelectedChallenges(challenges);
    setFormData(prev => ({ ...prev, selectedChallenges: challenges }));
    if (onFieldChange) {
      onFieldChange("selectedChallenges", challenges);
    }
  }, [onFieldChange]);

  // Handle entry path selection
  const handleEntryPathSelect = useCallback((path: EntryPath) => {
    setEntryPath(path);
    setShowUseCaseLanding(false);
    
    if (path === 'strategic') {
      setActiveTab('challenges');
    } else if (path === 'manual') {
      setActiveTab('challenges');
    } else if (path === 'custom') {
      setActiveTab('profile');
    }
  }, []);

  // Handle going back to use case landing
  const handleBackToLanding = useCallback(() => {
    setShowUseCaseLanding(true);
    setEntryPath(null);
  }, []);

  // Handle segments changes and sync to formData
  const handleSegmentsChange = useCallback((newSegments: Segment[]) => {
    setSegments(newSegments);
    setFormData(prev => ({ ...prev, segments: newSegments }));
    if (onFieldChange) {
      onFieldChange("segments", newSegments);
    }
  }, [onFieldChange]);

  const handleSegmentationEnabledChange = useCallback((enabled: boolean) => {
    setSegmentationEnabled(enabled);
    setFormData(prev => ({ ...prev, segmentationEnabled: enabled }));
    if (onFieldChange) {
      onFieldChange("segmentationEnabled", enabled);
    }
  }, [onFieldChange]);

  // Handle strategic objectives change and sync to formData
  const handleObjectivesChange = useCallback((objectives: StrategicObjectiveId[]) => {
    setSelectedObjectives(objectives);
    setFormData(prev => ({ ...prev, selectedObjectives: objectives }));
    if (onFieldChange) {
      onFieldChange("selectedObjectives", objectives);
    }
  }, [onFieldChange]);
  
  // Segment editor helpers
  const handleAddSegment = useCallback(() => {
    const newSegment = createEmptySegment();
    setEditingSegment(newSegment);
    setSegmentEditorOpen(true);
  }, []);
  
  const handleEditSegment = useCallback((segment: Segment) => {
    setEditingSegment(segment);
    setSegmentEditorOpen(true);
  }, []);
  
  const handleSaveSegment = useCallback((segment: Segment) => {
    const existingIndex = segments.findIndex(s => s.id === segment.id);
    if (existingIndex >= 0) {
      const updated = [...segments];
      updated[existingIndex] = segment;
      handleSegmentsChange(updated);
    } else {
      handleSegmentsChange([...segments, segment]);
    }
  }, [segments, handleSegmentsChange]);
  
  const handleDeleteSegment = useCallback((segment: Segment) => {
    setSegmentToDelete(segment);
  }, []);
  
  const confirmDeleteSegment = useCallback(() => {
    if (segmentToDelete) {
      handleSegmentsChange(segments.filter(s => s.id !== segmentToDelete.id));
      setSegmentToDelete(null);
    }
  }, [segmentToDelete, segments, handleSegmentsChange]);
  
  const handleToggleSegment = useCallback((segmentId: string, enabled: boolean) => {
    const updated = segments.map(s =>
      s.id === segmentId ? { ...s, enabled } : s
    );
    handleSegmentsChange(updated);
  }, [segments, handleSegmentsChange]);
  
  const currencySymbol = getCurrencySymbol(formData.baseCurrency || 'USD');
  
  const globalInputsForSegments = {
    amerGrossAttempts: formData.amerGrossAttempts,
    amerAnnualGMV: formData.amerAnnualGMV,
    amerPreAuthApprovalRate: formData.amerPreAuthApprovalRate,
    amerPostAuthApprovalRate: formData.amerPostAuthApprovalRate,
    amerCreditCardPct: formData.amerCreditCardPct,
    amer3DSChallengeRate: formData.amer3DSChallengeRate,
    amer3DSAbandonmentRate: formData.amer3DSAbandonmentRate,
    amerIssuingBankDeclineRate: formData.amerIssuingBankDeclineRate,
    fraudCBRate: formData.fraudCBRate,
    fraudCBAOV: formData.fraudCBAOV,
    completedAOV: formData.completedAOV,
  };
  
  const globalKPIsForSegments = formData.forterKPIs ? {
    approvalRateImprovement: formData.forterKPIs.approvalRateImprovement,
    chargebackReduction: formData.forterKPIs.chargebackReduction,
    threeDSReduction: formData.forterKPIs.threeDSReduction,
  } : undefined;

  const handleAutoFill = () => {
    // Enable all challenges per spreadsheet test scenario
    const testChallenges = {
      "1": true,   // False fraud declines
      "2": true,   // Rigid rules based fraud system
      "3": true,   // Manual review process
      "4": true,   // Non-optimized payment funnel (3DS)
      "5": true,   // Difficulty applying exemptions
      "7": true,   // Chargeback disputes
      "8": true,   // Policy abuse (returns/INR)
      "9": true,   // Instant refunds
      "10": true,  // Promotion abuse
      "11": true,  // Reseller/reshipper (linked to 10)
      "12": true,  // ATO protection - OpEx
      "13": true,  // ATO protection - CLV
      "14": true,  // Sign-up protection - marketing
      "15": true,  // Sign-up protection - KYC
    };
    setSelectedChallenges(testChallenges);
    
    // Select all strategic objectives and use cases
    setSelectedObjectives(STRATEGIC_OBJECTIVES.map(o => o.id));
    setEntryPath('strategic');
    setShowUseCaseLanding(false);
    
    // Test data from spreadsheet - matching exact values for QA
    const testData: CalculatorData = {
      // Customer Information (Page 2)
      customerName: "Test Customer",
      industry: "Apparel",
      hqLocation: "United States of America",
      
      // Selected challenges
      selectedChallenges: testChallenges,
      
      // Business model - Challenge 10/11 uses marketplace with 25% commission
      isMarketplace: true,
      commissionRate: 25,
      
      // AMER Regional Data (Page 4-5: 1,000,000 attempts, $150,000,000 GMV)
      amerAnnualGMV: 150000000,
      amerGrossAttempts: 1000000,
      amerGrossMarginPercent: 50,
      amerPreAuthApprovalRate: 97.5,
      amerPostAuthApprovalRate: 98,
      amerIssuingBankDeclineRate: 15,
      amerFraudCheckTiming: "pre-auth",
      amerCreditCardPct: 80,
      amer3DSChallengeRate: 50,
      amer3DSAbandonmentRate: 15,
      amerManualReviewRate: 5,
      
      // EMEA Regional Data (not populated in spreadsheet test, using minimal values)
      emeaAnnualGMV: 0,
      emeaGrossAttempts: 0,
      emeaGrossMarginPercent: 50,
      emeaPreAuthApprovalRate: 97.5,
      emeaPostAuthApprovalRate: 98,
      emeaIssuingBankDeclineRate: 15,
      emeaFraudCheckTiming: "pre-auth",
      emeaCreditCardPct: 80,
      emea3DSChallengeRate: 50,
      emea3DSAbandonmentRate: 15,
      emeaManualReviewRate: 5,
      
      // APAC Regional Data (not populated in spreadsheet test, using minimal values)
      apacAnnualGMV: 0,
      apacGrossAttempts: 0,
      apacGrossMarginPercent: 50,
      apacPreAuthApprovalRate: 97.5,
      apacPostAuthApprovalRate: 98,
      apacIssuingBankDeclineRate: 15,
      apacFraudCheckTiming: "pre-auth",
      apacCreditCardPct: 80,
      apac3DSChallengeRate: 50,
      apac3DSAbandonmentRate: 15,
      apacManualReviewRate: 5,
      
      // Fraud Chargebacks (Page 4: 0.5% rate, $150 AOV)
      fraudCBRate: 0.5,
      emeaFraudCBRate: 0.5,
      apacFraudCBRate: 0.5,
      fraudCBAOV: 150,
      emeaFraudCBAOV: 150,
      apacFraudCBAOV: 150,
      existingFraudVendor: "Other",
      
      // Service Chargebacks (Page 7: 0.5% rate)
      serviceCBRate: 0.5,
      serviceCBAOV: 150,
      
      // Challenge 3: Manual Review (Page 6: 5%, 10 mins, $15/hr)
      manualReviewPct: 5,
      timePerReview: 10,
      hourlyReviewerCost: 15,
      
      // Challenge 7: Chargeback Disputes (Page 7)
      fraudDisputeRate: 50,
      fraudWinRate: 50,
      serviceDisputeRate: 30,
      serviceWinRate: 50,
      avgTimeToReviewCB: 20,
      annualCBDisputes: 7634,
      costPerHourAnalyst: 19.23,
      
      // Challenge 8: Abuse Prevention (Page 8: 152,689 refunds, $150 AOV)
      refundRate: 20,
      expectedRefundsVolume: 152689,
      avgRefundValue: 150,
      avgOneWayShipping: 4,
      avgFulfilmentCost: 1.5,
      txProcessingFeePct: 1,
      avgCSTicketCost: 5,
      pctINRClaims: 10,
      pctReplacedCredits: 10,
      
      // Challenge 9: Instant Refunds (Page 9)
      pctRefundsToCS: 40,
      costPerCSContact: 5,
      
      // Challenge 10/11: Promotion Abuse (Page 10)
      // Uses amerAnnualGMV above + avgDiscountByAbusers
      avgDiscountByAbusers: 30,
      
      // Challenge 12/13: ATO Protection (Page 11)
      monthlyLogins: 15000,
      customerLTV: 450,
      avgAppeasementValue: 150,
      avgSalaryPerCSMember: 40000,
      avgHandlingTimePerATOClaim: 20,
      pctChurnFromATO: 50,
      
      // Challenge 14/15: Sign-up Protection (Page 12)
      monthlySignups: 5000,
      avgNewMemberBonus: 20,
      numDigitalCommunicationsPerYear: 12,
      avgCostPerOutreach: 0.5,
      avgKYCCostPerAccount: 2,
      pctAccountsGoingThroughKYC: 50,
      
      // Forter KPIs with spreadsheet values
      forterKPIs: {
        ...defaultForterKPIs,
        // Challenge 1/2/4/5: Approval rate improvement (absolute to 99%)
        preAuthApprovalImprovement: 99,
        preAuthApprovalIsAbsolute: true,
        postAuthApprovalImprovement: 100,
        postAuthApprovalIsAbsolute: true,
        approvalRateImprovement: 99,
        approvalRateIsAbsolute: true,
        // 3DS reduction: 50% -> 30% (absolute target)
        threeDSReduction: 30,
        threeDSReductionIsAbsolute: true,
        // Chargeback reduction: 0.5% -> 0.2% (absolute target rate)
        chargebackReduction: 0.2,
        chargebackReductionIsAbsolute: true,
        // Challenge 7: Dispute rates - 95% dispute rate, 40% win rates
        fraudDisputeRateImprovement: 95,
        fraudDisputeIsAbsolute: true,
        fraudWinRateChange: 40,
        fraudWinRateIsAbsolute: true,
        serviceDisputeRateImprovement: 95,
        serviceDisputeIsAbsolute: true,
        serviceWinRateChange: 40,
        serviceWinRateIsAbsolute: true,
        disputeTimeReduction: 5, // Target 5 minutes per CB review
        disputeTimeIsAbsolute: true,
        // Challenge 8: Abuse catch rate 90%
        forterCatchRate: 90,
        abuseAovMultiplier: 1.5,
        // Challenge 9: NPS increase 10
        npsIncreaseFromInstantRefunds: 10,
        lseNPSBenchmark: 1,
        forterCSReduction: 78, // 78% reduction = 40% -> 9%
        // Challenge 12/13: ATO - 1% fraudulent logins, 90% catch rate
        pctFraudulentLogins: 1,
        churnLikelihoodFromATO: 50,
        atoCatchRate: 90,
        // Challenge 14/15: Sign-up - 10% fraudulent, 95% reduction
        pctFraudulentSignups: 10,
        forterFraudulentSignupReduction: 95,
        forterKYCReduction: 80,
      },
    };
    
    // Enable segmentation with 3 test segments
    const testSegments: Segment[] = [
      {
        id: crypto.randomUUID(),
        name: "US Market",
        description: "United States transactions",
        enabled: true,
        country: "United States of America",
        industry: "Apparel",
        inputs: {
          grossAttempts: 500000,
          annualGMV: 75000000,
          preAuthApprovalRate: 97.5,
          preAuthIncluded: true,
          postAuthApprovalRate: 100,
          postAuthIncluded: false,
          creditCardPct: 85,
          threeDSChallengeRate: 40,
          threeDSAbandonmentRate: 12,
          issuingBankDeclineRate: 10,
          fraudCBRate: 0.45,
          fraudCBAOV: 165,
        },
        kpis: {
          approvalRateTarget: 99.25,
          chargebackRateTarget: 0.18,
          preAuthApprovalTarget: 99.25,
          preAuthIncluded: true,
          postAuthApprovalTarget: 100,
          postAuthIncluded: false,
          threeDSRateTarget: 20,
        },
      },
      {
        id: crypto.randomUUID(),
        name: "UK Market",
        description: "United Kingdom transactions (PSD2)",
        enabled: true,
        country: "United Kingdom",
        industry: "Apparel",
        inputs: {
          grossAttempts: 350000,
          annualGMV: 52500000,
          preAuthApprovalRate: 96.8,
          preAuthIncluded: true,
          postAuthApprovalRate: 100,
          postAuthIncluded: false,
          creditCardPct: 75,
          threeDSChallengeRate: 55,
          threeDSAbandonmentRate: 18,
          issuingBankDeclineRate: 12,
          fraudCBRate: 0.38,
          fraudCBAOV: 145,
        },
        kpis: {
          approvalRateTarget: 99.1,
          chargebackRateTarget: 0.15,
          preAuthApprovalTarget: 99.1,
          preAuthIncluded: true,
          postAuthApprovalTarget: 100,
          postAuthIncluded: false,
          threeDSRateTarget: 28,
        },
      },
      {
        id: crypto.randomUUID(),
        name: "APAC Market",
        description: "Australia & Singapore transactions",
        enabled: true,
        country: "Australia",
        industry: "Apparel",
        inputs: {
          grossAttempts: 150000,
          annualGMV: 22500000,
          preAuthApprovalRate: 98.2,
          preAuthIncluded: true,
          postAuthApprovalRate: 100,
          postAuthIncluded: false,
          creditCardPct: 90,
          threeDSChallengeRate: 35,
          threeDSAbandonmentRate: 10,
          issuingBankDeclineRate: 8,
          fraudCBRate: 0.32,
          fraudCBAOV: 155,
        },
        kpis: {
          approvalRateTarget: 99.4,
          chargebackRateTarget: 0.12,
          preAuthApprovalTarget: 99.4,
          preAuthIncluded: true,
          postAuthApprovalTarget: 100,
          postAuthIncluded: false,
          threeDSRateTarget: 18,
        },
      },
    ];
    
    // Set segments and enable segmentation
    setSegments(testSegments);
    setSegmentationEnabled(true);
    
    // Add segment data to testData
    testData.segments = testSegments;
    testData.segmentationEnabled = true;
    testData.selectedObjectives = STRATEGIC_OBJECTIVES.map(o => o.id);

    setFormData(testData);
    // Push full state to parent so auto-save persists use cases + customer inputs (avoids de-selection when opening another analysis and back)
    onBulkUpdate?.({
      ...testData,
      selectedChallenges: testChallenges,
      selectedObjectives: STRATEGIC_OBJECTIVES.map(o => o.id),
      segments: testSegments,
      segmentationEnabled: true,
    });
    toast.success("Auto-filled with test data including 3 segments");
  };

  const handleEditResults = () => {
    setShowResults(false);
  };

  if (showResults) {
    return (
      <ResultsDashboard
        data={formData}
        onEditManual={handleEditResults}
        onEditCustom={() => {}}
        onStartOver={() => setShowResults(false)}
        onDataChange={setFormData}
      />
    );
  }
  
  // Sync showGuidedTabs when entryMode prop changes (e.g., when loading a saved analysis)
  useEffect(() => {
    console.log('[ManualInputForm] entryMode changed to:', entryMode);
    // When entryMode changes from parent (via handleLoadAnalysis), sync the tab visibility
    const shouldShowGuidedTabs = entryMode !== "custom";
    console.log('[ManualInputForm] Setting showGuidedTabs to:', shouldShowGuidedTabs);
    setShowGuidedTabs(shouldShowGuidedTabs);
    
    // Also set the active tab appropriately so we never show a blank tab content
    if (entryMode === "custom") {
      setActiveTab("profile");
    }
  }, [entryMode]);

  // Ensure activeTab always matches a visible tab (prevents blank screen when Tabs value doesn't match any trigger)
  // In guided mode, Forter KPI is in a modal (Refine Solution Assumptions), not a tab
  const guidedTabs = ["profile", "challenges", "inputs", "summary", "roi"];
  const customTabs = ["profile", "summary", "roi"];
  const validTabs = showGuidedTabs ? guidedTabs : customTabs;
  useEffect(() => {
    if (activeTab && !validTabs.includes(activeTab)) {
      setActiveTab("profile");
    }
  }, [showGuidedTabs, activeTab]);
  // Never pass an invalid value to Tabs (e.g. "forter" when in guided mode) to avoid Radix/React errors
  const tabsValue = (activeTab && validTabs.includes(activeTab)) ? activeTab : "profile";

  // Confirmation dialogs for pathway switching
  const [showSwitchToGuidedConfirm, setShowSwitchToGuidedConfirm] = useState(false);
  const [showSwitchToCustomConfirm, setShowSwitchToCustomConfirm] = useState(false);
  const [showSkipToSummaryConfirm, setShowSkipToSummaryConfirm] = useState(false);
  
  // Handle switching to guided mode (after confirmation)
  const confirmSwitchToGuided = useCallback(() => {
    setShowGuidedTabs(true);
    setShowUseCaseLanding(true);
    setActiveTab("challenges");
    setShowSwitchToGuidedConfirm(false);
    // Persist pathway mode change
    setFormData(prev => ({ ...prev, _pathwayMode: 'manual' }));
  }, []);
  
  // Handle switching to custom mode (after confirmation)
  const confirmSwitchToCustom = useCallback(() => {
    setShowGuidedTabs(false);
    setActiveTab("profile");
    setShowSwitchToCustomConfirm(false);
    // Persist pathway mode change
    setFormData(prev => ({ ...prev, _pathwayMode: 'custom' }));
  }, []);
  
  // Handle "Skip to Value Summary" (switches to custom pathway)
  const confirmSkipToSummary = useCallback(() => {
    setShowGuidedTabs(false);
    setActiveTab("profile");
    setShowSkipToSummaryConfirm(false);
    toast.info("Switched to Custom Value Pathway");
    // Persist pathway mode change
    setFormData(prev => ({ ...prev, _pathwayMode: 'custom' }));
  }, []);
  
  return (
    <>
      {/* Guided Value Welcome Modal */}
      <GuidedValueWelcome 
        open={showGuidedWelcome} 
        onClose={() => setShowGuidedWelcome(false)} 
      />
      
      <div className="max-w-6xl mx-auto space-y-6">
      <Card className="p-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">
              {!showGuidedTabs ? "Custom Value Assessment" : "Guided Value Assessment (GVA)"}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              {!showGuidedTabs 
                ? "Add custom calculations with direct links to source spreadsheets" 
                : "Business Value Team self-service calculator for field teams"
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Print Button - Discreet */}
            <PrintTabButton 
              currentTabName={
                activeTab === 'profile' ? 'Profile' :
                activeTab === 'challenges' ? 'Use Cases' :
                activeTab === 'inputs' ? 'Customer Inputs' :
                activeTab === 'forter' ? 'Solution KPI' :
                activeTab === 'summary' ? 'Value Summary' :
                activeTab === 'roi' ? 'ROI' : 'Tab'
              }
              analysisName={(formData as any)._analysisName || formData.customerName || 'Value_Assessment'}
            />

            {/* Generate Reports Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Button
                    variant={canGenerateReports ? "default" : "outline"}
                    size="sm"
                    disabled={!canGenerateReports}
                    onClick={() => {
                      setReportModalOpen(true);
                      dismissReportAnimation();
                    }}
                    className={`gap-2 ${!reportModalOpen && (showReportAnimation || (reportNeedsUpdate && canGenerateReports)) ? 'animate-pulse ring-2 ring-primary ring-offset-2' : ''}`}
                  >
                    <FileText className="w-4 h-4" />
                    Generate Reports
                  </Button>
                  {/* Show update indicator when report data has changed */}
                  {reportNeedsUpdate && canGenerateReports && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping"></span>
                      <span className="relative inline-flex items-center justify-center rounded-full h-4 w-4 bg-amber-500 text-[10px] text-white font-bold">!</span>
                    </span>
                  )}
                  {/* Show initial animation for first-time report availability */}
                  {showReportAnimation && !reportNeedsUpdate && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              {!canGenerateReports ? (
                <TooltipContent side="bottom" className="max-w-xs text-center">
                  <p>Complete your value assessment to unlock report generation. Ensure the Value Summary has calculated values.</p>
                </TooltipContent>
              ) : reportNeedsUpdate ? (
                <TooltipContent side="bottom" className="max-w-xs text-center">
                  <p className="font-medium text-amber-600">Report update available</p>
                  <p className="text-xs text-muted-foreground">Your data has changed since the last report was generated.</p>
                </TooltipContent>
              ) : null}
            </Tooltip>
            
            {/* Show switch buttons based on current mode */}
            {!showGuidedTabs ? (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowSwitchToGuidedConfirm(true)}
                className="gap-2"
              >
                <ChevronRight className="w-4 h-4" />
                Switch to Guided Pathway
              </Button>
            ) : (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowSwitchToCustomConfirm(true)}
                className="gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Switch to Custom Pathway
              </Button>
            )}
          </div>
        </div>

        <Tabs value={tabsValue} onValueChange={(value) => {
          // Mark Value Summary as viewed when user navigates to it (unlocks ROI tab)
          if (value === 'summary') {
            setHasViewedValueSummary(true);
          }
          // In guided mode, prevent navigation to locked tabs if no challenges selected
          if (showGuidedTabs && !hasSelectedChallenges && ['inputs', 'summary'].includes(value)) {
            toast.error("Please select at least one use case first, or skip to Value Summary");
            return;
          }
          // Lock ROI until Value Summary has been viewed at least once
          if (value === 'roi' && !hasViewedValueSummary) {
            toast.error("View the Value Summary tab first to unlock the ROI section.");
            return;
          }
          setActiveTab(value);
        }} className="w-full">
          {/* Dynamic tab list based on mode - hide tabs when not in guided mode */}
          {!showGuidedTabs ? (
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile">{renderTabLabel('profile', 'Profile')}</TabsTrigger>
              <TabsTrigger value="summary">{renderTabLabel('summary', 'Value Summary')}</TabsTrigger>
              <TabsTrigger value="roi">{renderTabLabel('roi', 'ROI')}</TabsTrigger>
            </TabsList>
          ) : (
            <TabsList className="flex w-full">
              <TabsTrigger value="profile" className="flex-1">{renderTabLabel('profile', 'Profile')}</TabsTrigger>
              <TabsTrigger value="challenges" className="flex-1">{renderTabLabel('challenges', 'Use Cases')}</TabsTrigger>
              
              {/* Customer Inputs Tab - conditional tooltip only when locked (wrapper span receives hover; disabled button does not) */}
              {!hasSelectedChallenges ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex-1 flex cursor-not-allowed min-w-0">
                      <TabsTrigger 
                        value="inputs" 
                        disabled
                        className="w-full opacity-50 pointer-events-none"
                      >
                        <span className="flex items-center gap-1.5">
                          <Lock className="h-3 w-3" />
                          {renderTabLabel('inputs', 'Customer Inputs', true)}
                        </span>
                      </TabsTrigger>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="text-sm">
                      Use Cases are required to unlock Customer Inputs tab
                    </p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <TabsTrigger 
                  value="inputs" 
                  className={`flex-1 ${recentlyUnlockedTabs.includes('inputs') ? "animate-pulse ring-2 ring-green-500 ring-offset-1" : ""}`}
                >
                  {renderTabLabel('inputs', 'Customer Inputs')}
                </TabsTrigger>
              )}
              
              {/* Value Summary Tab - conditional tooltip only when locked (wrapper span receives hover; disabled button does not) */}
              {!hasSelectedChallenges ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex-1 flex cursor-not-allowed min-w-0">
                      <TabsTrigger 
                        value="summary" 
                        disabled
                        className="w-full opacity-50 pointer-events-none"
                      >
                        <span className="flex items-center gap-1.5">
                          <Lock className="h-3 w-3" />
                          {renderTabLabel('summary', 'Value Summary', true)}
                        </span>
                      </TabsTrigger>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="text-sm">
                      Use Cases are required to unlock Value Summary tab
                    </p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <TabsTrigger 
                  value="summary" 
                  className={`flex-1 ${recentlyUnlockedTabs.includes('summary') ? "animate-pulse ring-2 ring-green-500 ring-offset-1" : ""}`}
                >
                  {renderTabLabel('summary', 'Value Summary')}
                </TabsTrigger>
              )}
              
              {/* ROI Tab - locked until use cases selected AND Value Summary has been viewed (wrapper span receives hover; disabled button does not) */}
              {(!hasSelectedChallenges || !hasViewedValueSummary) ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex-1 flex cursor-not-allowed min-w-0">
                      <TabsTrigger 
                        value="roi" 
                        disabled
                        className="w-full opacity-50 pointer-events-none"
                      >
                        <span className="flex items-center gap-1.5">
                          <Lock className="h-3 w-3" />
                          {renderTabLabel('roi', 'ROI', true)}
                        </span>
                      </TabsTrigger>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="text-sm">
                      {!hasSelectedChallenges ? (
                        <>Use Cases are required to unlock ROI tab</>
                      ) : (
                        <>View and validate value summary to unlock ROI tab</>
                      )}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <TabsTrigger 
                  value="roi" 
                  className={`flex-1 ${recentlyUnlockedTabs.includes('roi') ? "animate-pulse ring-2 ring-green-500 ring-offset-1" : ""}`}
                >
                  {renderTabLabel('roi', 'ROI')}
                </TabsTrigger>
              )}
            </TabsList>
          )}

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4 mt-6" data-tab-title="Profile">
            <p className="text-sm text-muted-foreground mb-4">
              Enter customer and company details for this value assessment.
            </p>
            <div className="flex justify-end mb-4 gap-2">
              {onLogoUpload && (
                <Button 
                  variant="outline" 
                  className="gap-2 relative"
                >
                  <Upload className="w-4 h-4" />
                  {customerLogoUrl ? "Change Logo" : "Upload Logo"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onLogoUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </Button>
              )}
              {(() => {
                const ALLOWED_AUTO_FILL_AUTHORS = ['AK', 'Abdul', 'Abdul-Karim', 'Test', 'Bryan', 'Bryan Way', 'Abdul-Karim Ali', 'Adva', 'Adva Rudis'];
                // Use initialData (latest from parent) first so Save As / session updates show the button immediately
                const author = (initialData?._authorName ?? formData._authorName ?? (typeof localStorage !== 'undefined' ? localStorage.getItem('forter_author_name') : null) ?? '').trim();
                const showAutoFill = author && ALLOWED_AUTO_FILL_AUTHORS.some(a => a.toLowerCase() === author.toLowerCase());
                if (!showAutoFill) return null;
                return (
                  <Button 
                    variant="outline" 
                    onClick={handleAutoFill}
                    className="gap-2"
                  >
                    <FlaskConical className="w-4 h-4" />
                    Auto Fill - Testing
                  </Button>
                );
              })()}
            </div>
            
            {/* Show uploaded logo preview */}
            {customerLogoUrl && (
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg mb-4">
                <img src={customerLogoUrl} alt="Customer Logo" className="h-12 object-contain" />
                <span className="text-sm text-muted-foreground">Customer logo uploaded</span>
              </div>
            )}
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerName">Merchant Name</Label>
                <Input
                  id="customerName"
                  placeholder="Enter merchant name"
                  value={formData.customerName || ""}
                  onChange={(e) => updateField("customerName", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">Industry (Vertical)</Label>
                <Select
                  value={formData.industry ?? ""}
                  onValueChange={(value) => updateField("industry", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {verticalBenchmarks.map((vertical) => (
                      <SelectItem key={vertical.name} value={vertical.name} textValue={vertical.name}>
                        {vertical.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hqLocation">HQ Location (Country)</Label>
                <Select
                  value={formData.hqLocation ?? ""}
                  onValueChange={(value) => updateField("hqLocation", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countryBenchmarksSortedForHQ.map((country) => (
                      <SelectItem key={country.name} value={country.name} textValue={country.name}>
                        <span className="flex items-center gap-2">
                          <span>{country.flag}</span>
                          <span>{country.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="baseCurrency">Base Currency</Label>
                <Select
                  value={validBaseCurrency(formData.baseCurrency)}
                  onValueChange={(value) => updateField("baseCurrency", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {topCurrencies.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code} textValue={`${currency.code} ${currency.name}`}>
                        <span className="flex items-center gap-2">
                          <span className="font-medium">{currency.symbol}</span>
                          <span>{currency.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="isMarketplace">Business Model</Label>
                <Select
                  value={formData.isMarketplace ? "marketplace" : "retailer"}
                  onValueChange={(value) => updateField("isMarketplace", value === "marketplace")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select business model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retailer">Retailer (Direct Sales)</SelectItem>
                    <SelectItem value="marketplace">Marketplace</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {Boolean(formData.isMarketplace) && (
                <div className="space-y-2">
                  <Label htmlFor="commissionRate">Commission / Take Rate (%)</Label>
                  <NumericInput
                    value={formData.commissionRate}
                    onChange={(v) => updateField("commissionRate", v)}
                    placeholder="15"
                  />
                  <p className="text-xs text-muted-foreground">
                    The percentage of each transaction the customer retains as commission
                  </p>
                </div>
              )}
            {/* Buyer Personas (multi-select) */}
            <div className="space-y-3 pt-6 border-t mt-6 md:col-span-2">
              <p className="text-sm font-medium text-muted-foreground">Buyer Personas (multi-select)</p>
              <p className="text-xs text-muted-foreground">Select the buyer persona for this opportunity.</p>
              <div className="grid grid-cols-6 gap-3">
                {BUYER_PERSONA_PDFS.map(({ label, filename, icon: Icon, jobToBeDone }) => {
                  const selected = (formData.selectedBuyerPersonas ?? []).includes(filename);
                  const togglePersona = () => {
                    const current = formData.selectedBuyerPersonas ?? [];
                    const next = selected ? current.filter((f) => f !== filename) : [...current, filename];
                    updateField("selectedBuyerPersonas", next);
                  };
                  return (
                    <Tooltip key={filename}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={togglePersona}
                          className={cn(
                            "rounded-lg border p-4 min-h-[140px] transition-colors flex flex-col items-center justify-center gap-2 min-w-0 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2",
                            selected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
                          )}
                        >
                          <Icon className="h-8 w-8 text-primary shrink-0" aria-hidden />
                          <span className="font-medium text-sm text-center leading-tight">{label}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[220px]">
                        <p className="text-xs">{jobToBeDone}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
            {/* Navigation Buttons - Prominent */}
            <div className="flex justify-between pt-6 border-t mt-6 md:col-span-2">
              <div />
              <Button onClick={goToNextTab} size="lg" className="gap-2 px-6">
                Next: {getNextTabName()} <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            </div>
          </TabsContent>

          {/* Use Cases Tab */}
          <TabsContent value="challenges" className="space-y-4 mt-6" data-tab-title="Use Cases">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <p className="text-sm text-muted-foreground">
                Select strategic objectives and use cases that match your prospect&apos;s priorities.
              </p>
            </div>
            {showUseCaseLanding ? (
              <>
                <UseCaseLanding onSelectPath={handleEntryPathSelect} />
                {/* Skip to Value Summary option */}
                <div className="flex justify-center pt-4 border-t mt-6">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowSkipToSummaryConfirm(true)}
                    className="text-muted-foreground hover:text-foreground gap-2"
                  >
                    <FastForward className="w-4 h-4" />
                    Skip to Value Summary (Custom Pathway)
                  </Button>
                </div>
                {/* Navigation Buttons */}
                <div className="flex justify-between pt-6 border-t mt-6">
                  <Button variant="outline" onClick={goToPreviousTab} className="gap-2">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </Button>
                  <Button onClick={goToNextTab} className="gap-2">
                    Next: {getNextTabName()} <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </>
            ) : entryPath === 'strategic' ? (
              <>
                <UnifiedUseCaseSelection
                  selectedChallenges={selectedChallenges}
                  onBulkChallengeChange={handleBulkChallengeChange}
                  onChangePath={handleBackToLanding}
                  selectedObjectives={selectedObjectives}
                  onObjectivesChange={handleObjectivesChange}
                  selectedBuyerPersonas={formData.selectedBuyerPersonas}
                />
                {/* Skip to Value Summary option - show when no challenges selected */}
                {!hasSelectedChallenges && (
                  <div className="flex justify-center pt-4 border-t mt-4">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowSkipToSummaryConfirm(true)}
                      className="gap-2"
                    >
                      <FastForward className="w-4 h-4" />
                      Skip to Value Summary
                    </Button>
                  </div>
                )}
                {/* Add additional context/notes - above Back/Next */}
                <div className="mt-6 pt-6 border-t space-y-2">
                  <Label htmlFor="use-case-notes-strategic" className="text-sm text-muted-foreground">
                    Add additional context/notes
                  </Label>
                  <Textarea
                    id="use-case-notes-strategic"
                    value={formData.useCaseNotes ?? ""}
                    onChange={(e) => updateField("useCaseNotes", e.target.value)}
                    placeholder="e.g. CFO mentioned in annual report that they target to maintain double digit growth over the next 3 years, whilst the CTO mentioned they are aiming to reduce Operational spend (OpEx) related to fraud prevention by 25% through the use of better automation."
                    className="min-h-[120px] resize-y placeholder:opacity-50 placeholder:text-muted-foreground"
                  />
                </div>
                {/* Navigation Buttons */}
                <div className="flex justify-between pt-6 border-t mt-6">
                  <Button variant="outline" onClick={goToPreviousTab} className="gap-2">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </Button>
                  <Button onClick={goToNextTab} className="gap-2" disabled={!hasSelectedChallenges}>
                    Next: {getNextTabName()} <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-end mb-4">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleBackToLanding}
                    className="text-muted-foreground"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Change Path
                  </Button>
                </div>
                <ChallengeSelection
                  selectedChallenges={selectedChallenges}
                  onChallengeChange={handleChallengeChange}
                  selectedBuyerPersonas={formData.selectedBuyerPersonas}
                />
                {/* Add additional context/notes - above Back/Next */}
                <div className="mt-6 pt-6 border-t space-y-2">
                  <Label htmlFor="use-case-notes-direct" className="text-sm text-muted-foreground">
                    Add additional context/notes
                  </Label>
                  <Textarea
                    id="use-case-notes-direct"
                    value={formData.useCaseNotes ?? ""}
                    onChange={(e) => updateField("useCaseNotes", e.target.value)}
                    placeholder="e.g. CFO mentioned in annual report that they target to maintain double digit growth over the next 3 years, whilst the CTO mentioned they are aiming to reduce Operational spend (OpEx) related to fraud prevention by 25% through the use of better automation."
                    className="min-h-[120px] resize-y placeholder:opacity-50 placeholder:text-muted-foreground"
                  />
                </div>
                {/* Navigation Buttons */}
                <div className="flex justify-between pt-6 border-t mt-6">
                  <Button variant="outline" onClick={handleBackToLanding} className="gap-2">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </Button>
                  <div className="flex items-center gap-2">
                    {!hasSelectedChallenges && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowSkipToSummaryConfirm(true)}
                        className="gap-2"
                      >
                        <FastForward className="w-4 h-4" />
                        Skip to Value Summary
                      </Button>
                    )}
                    <Button onClick={goToNextTab} className="gap-2" disabled={!hasSelectedChallenges}>
                      Next <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="inputs" className="space-y-6 mt-6" data-tab-title="Customer Inputs">
            <div className="flex items-center justify-between gap-4 mb-4">
              <p className="text-sm text-muted-foreground">
                Enter transaction and operational data for the use cases you selected.
              </p>
              <div className="flex items-center gap-0.5 rounded-md border bg-muted/30 p-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setInputsLayoutView('list')}
                      className={`inline-flex items-center justify-center rounded p-1.5 transition-[transform,color,background-color,box-shadow] duration-200 ease-out hover:scale-110 active:scale-95 ${inputsLayoutView === 'list' ? 'scale-105 bg-background shadow-sm' : 'scale-100 text-muted-foreground hover:text-foreground'}`}
                      aria-label="List view"
                    >
                      <List className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">List</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setInputsLayoutView('grid')}
                      className={`inline-flex items-center justify-center rounded p-1.5 transition-[transform,color,background-color,box-shadow] duration-200 ease-out hover:scale-110 active:scale-95 ${inputsLayoutView === 'grid' ? 'scale-105 bg-background shadow-sm' : 'scale-100 text-muted-foreground hover:text-foreground'}`}
                      aria-label="Grid view"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Grid</TooltipContent>
                </Tooltip>
              </div>
            </div>
            {/* Progress indicator and CSV buttons */}
            {Object.values(selectedChallenges).some(Boolean) && (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <InputProgressIndicator
                  filled={inputProgress.filled}
                  total={inputProgress.total}
                  percentage={inputProgress.percentage}
                />
                <div className="flex flex-col items-end gap-1">
                  <p className="text-xs text-muted-foreground">
                    Optional: download a template to collect data offline, then upload to auto-fill.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowClearConfirm(true)}
                      className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      disabled={inputProgress.filled === 0}
                    >
                      <Trash2 className="w-4 h-4" />
                      Clear All
                    </Button>
                    <div className="w-px h-6 bg-border" />
                    <span className="text-xs text-muted-foreground bg-muted/70 dark:bg-muted/50 px-2 py-0.5 rounded-full font-medium">
                      Optional
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs">
                        <p className="text-sm">
                          <strong>Optional:</strong> Download a CSV template to collect data from your customer offline.
                          Once completed, upload it back to auto-populate the fields below.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="relative">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Block download if segmentation enabled but no segments created
                            if (segmentationEnabled && segments.length === 0) {
                              return; // Already shows visual warning
                            }
                            const hasFields = getRequiredInputFields(selectedChallenges, getCurrencySymbol(formData.baseCurrency || 'USD'), formData.isMarketplace).length > 0;
                            if (hasFields) {
                              downloadCustomerInputsCSV(selectedChallenges, formData.customerName, formData.baseCurrency || 'USD', segments, segmentationEnabled, formData);
                              markTemplateDownloaded();
                              setTemplateDownloaded(true);
                              // Store the field count and challenge hash at download time for validation
                              const fieldCount = getRequiredInputFields(selectedChallenges, getCurrencySymbol(formData.baseCurrency || 'USD'), formData.isMarketplace).length;
                              const challengeHash = Object.entries(selectedChallenges).filter(([,v]) => v).map(([k]) => k).sort().join(',');
                              localStorage.setItem('csv_template_field_count', fieldCount.toString());
                              localStorage.setItem('csv_template_challenge_hash', challengeHash);
                              localStorage.setItem('csv_template_segment_count', (segmentationEnabled ? segments.filter(s => s.enabled).length : 0).toString());
                              setCsvTemplateNeedsUpdate(false);
                              setShowCSVDownloadAnimation(false);
                              toast.success("Data request sheet downloaded successfully");
                            } else {
                              toast.error("No inputs available for selected challenges");
                            }
                          }}
                          className={`gap-2 ${segmentationEnabled && segments.length === 0 ? 'opacity-50' : ''} ${showCSVDownloadAnimation ? 'animate-pulse ring-2 ring-amber-500 ring-offset-2' : ''}`}
                          disabled={segmentationEnabled && segments.length === 0}
                        >
                          <Download className="w-4 h-4" />
                          Download Data Request Sheet (CSV)
                        </Button>
                        {/* Show update indicator when CSV template needs update */}
                        {csvTemplateNeedsUpdate && (
                          <span className="absolute -top-1 -right-1 flex h-4 w-4">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping"></span>
                            <span className="relative inline-flex items-center justify-center rounded-full h-4 w-4 bg-amber-500 text-[10px] text-white font-bold">!</span>
                          </span>
                        )}
                        {/* Show initial animation for first-time template availability */}
                        {showCSVDownloadAnimation && !csvTemplateNeedsUpdate && (
                          <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                          </span>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      {segmentationEnabled && segments.length === 0 ? (
                        <p className="text-sm text-amber-600">
                          <strong>⚠️ Segments required:</strong> Create all segments first before downloading data request sheet
                        </p>
                      ) : (
                        <p className="text-sm">Download a CSV template to collect customer data offline</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                  <CSVUploadButton
                    formData={formData}
                    selectedChallenges={selectedChallenges}
                    onFieldChange={updateField}
                    templateDownloaded={templateDownloaded}
                    segmentationEnabled={segmentationEnabled}
                    segmentCount={segments.filter(s => s.enabled).length}
                  />
                  </div>
                </div>
              </div>
            )}
            
            {/* Segments Toggle - visible when fraud/payments challenges selected */}
            {showSegmentsOption && (
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Switch
                      id="segmentation-toggle"
                      checked={segmentationEnabled}
                      onCheckedChange={handleSegmentationEnabledChange}
                    />
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary" />
                      <div>
                        <Label htmlFor="segmentation-toggle" className="cursor-pointer font-medium">
                          Enable segmented analysis
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Break down <strong>payments-related data</strong> by region, category, or business unit
                        </p>
                      </div>
                    </div>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs">
                      <p className="text-sm">
                        <strong>Applies to payment/fraud challenges only.</strong> When enabled, create segments (e.g., regions, categories) with their own inputs and Solution KPI targets. Global values become read-only aggregations.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                
                {segmentationEnabled && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    {segments.length > 0 ? (
                      <>
                        {segments.map((segment) => {
                          const { filled, total } = countSegmentFilledFields(segment);
                          const progress = Math.round((filled / total) * 100);
                          
                          return (
                            <div key={segment.id} className="flex items-start justify-between gap-4 p-3 bg-muted/30 rounded-lg">
                              <div className="flex items-start gap-3 flex-1">
                                <Checkbox
                                  id={`segment-${segment.id}`}
                                  checked={segment.enabled}
                                  onCheckedChange={(checked) => handleToggleSegment(segment.id, checked === true)}
                                  className="mt-0.5"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Label
                                      htmlFor={`segment-${segment.id}`}
                                      className="font-medium cursor-pointer text-sm"
                                    >
                                      {segment.name}
                                    </Label>
                                    {!segment.enabled && (
                                      <span className="text-xs text-muted-foreground">(disabled)</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {getSegmentSummary(segment, currencySymbol)}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Progress value={progress} className="h-1 flex-1 max-w-[100px]" />
                                    <span className="text-xs text-muted-foreground">{filled}/{total}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleEditSegment(segment)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteSegment(segment)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                        <Button variant="outline" size="sm" onClick={handleAddSegment} className="gap-2">
                          <Plus className="h-3 w-3" />
                          Add Segment
                        </Button>
                      </>
                    ) : (
                      <div className="text-center py-4 space-y-3">
                        <div className="flex items-center justify-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <Info className="h-4 w-4 text-amber-600" />
                          <p className="text-sm text-amber-700">
                            <strong>Create segments first</strong> to enable data request sheet download and segment-level analysis
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleAddSegment} className="gap-2">
                          <Plus className="h-3 w-3" />
                          Add First Segment
                        </Button>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground flex items-center gap-1 pt-2">
                      <Info className="h-3 w-3" />
                      All segments use the base currency: {formData.baseCurrency || 'USD'} ({currencySymbol})
                    </p>
                  </div>
                )}
              </Card>
            )}
            
            <ChallengeInputs
              formData={formData}
              selectedChallenges={selectedChallenges}
              onFieldChange={(field, value) => {
                if (field === 'amerIssuingBankDeclineRate' && segmentationEnabled && segments?.length && typeof value === 'number') {
                  const num = Math.max(0, Math.min(100, value));
                  const updated = segments.map((seg) => ({ ...seg, inputs: { ...seg.inputs, issuingBankDeclineRate: num } }));
                  handleSegmentsChange(updated);
                }
                updateField(field, value);
              }}
              segmentationEnabled={segmentationEnabled}
              segments={segments}
              viewMode={inputsLayoutView}
            />
            {showGuidedTabs && (
              <div className="pt-4 border-t mt-6">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setForterKPIModalOpen(true)}
                >
                  <Gauge className="h-4 w-4" />
                  Refine Solution Assumptions
                </Button>
              </div>
            )}
            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6 border-t mt-6">
              <Button variant="outline" onClick={goToPreviousTab} className="gap-2">
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
              <Button onClick={goToNextTab} className="gap-2">
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </TabsContent>

          {/* Value Summary Tab */}
          <TabsContent value="summary" className="space-y-4 mt-6" data-tab-title="Value Summary">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <p className="text-sm text-muted-foreground">
                Review the calculated value drivers and annual potential from your inputs.
              </p>
              {showGuidedTabs && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 shrink-0"
                  onClick={() => setForterKPIModalOpen(true)}
                >
                  <Gauge className="h-4 w-4" />
                  Refine Solution Assumptions
                </Button>
              )}
            </div>
            <ValueSummaryOptionA
              formData={formData}
              selectedChallenges={selectedChallenges}
              onFormDataChange={handleSummaryFormDataChange}
              onForterKPIChange={handleSummaryForterKPIChange}
              onNavigateToForterKPI={showGuidedTabs ? (target) => {
                setForterKPIFocusTarget(target);
                setForterKPIModalOpen(true);
              } : undefined}
              onCustomCalculationsChange={(calcs) => updateField("customCalculations", calcs)}
              onSegmentInputChange={(segmentId, field, value) => {
                // Bi-directional segment input editing
                const updated = (segments || []).map(seg =>
                  seg.id === segmentId
                    ? { ...seg, inputs: { ...seg.inputs, [field]: value } }
                    : seg
                );
                handleSegmentsChange(updated);
              }}
              onSegmentKPIChange={(segmentId, field, value) => {
                // Bi-directional segment KPI editing
                const updated = (segments || []).map(seg =>
                  seg.id === segmentId
                    ? { ...seg, kpis: { ...seg.kpis, [field]: value } }
                    : seg
                );
                handleSegmentsChange(updated);
              }}
              showInMillions={showInMillions}
              onShowInMillionsChange={setShowInMillions}
              onSelectUseCases={!showGuidedTabs ? undefined : () => setActiveTab('challenges')}
              onTotalsChange={setValueTotals}
              onChallengeChange={handleChallengeChange}
              isCustomMode={!showGuidedTabs}
              investmentInputs={investmentInputs}
              onInvestmentInputsChange={handleInvestmentInputsChange}
              openBenefitCalculatorId={benefitModalCalculatorId}
              onBenefitModalClose={() => setBenefitModalCalculatorId(null)}
              onGenerateCalculatorSlides={(subset) => {
                setCalculatorSubsetForReport(subset);
                setReportModalOpen(true);
              }}
              persistedBenefitTabsViewed={benefitTabsViewed}
              onPersistBenefitTabViewed={onPersistBenefitTabViewed}
            />
            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6 border-t mt-6">
              <Button variant="outline" onClick={goToPreviousTab} className="gap-2">
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
              <Button onClick={goToNextTab} className="gap-2">
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </TabsContent>

          {/* ROI Tab */}
          <TabsContent value="roi" className="space-y-4 mt-6" data-tab-title="ROI">
            <p className="text-sm text-muted-foreground mb-4">
              Forecast value over time, factoring in ramp, contract tenure, and growth to calculate ROI and payback period.
            </p>
            <ROITab
              formData={formData}
              selectedChallenges={selectedChallenges}
              valueTotals={valueTotals}
              showInMillions={showInMillions}
              onShowInMillionsChange={setShowInMillions}
              investmentInputs={investmentInputs}
              onInvestmentInputsChange={handleInvestmentInputsChange}
              showInvestmentRowsToggle={showInvestmentRowsToggle}
              onShowInvestmentRowsToggleChange={setShowInvestmentRowsToggle}
              gmvUpliftBreakdown={valueTotals.gmvUpliftBreakdown}
              costReductionBreakdown={valueTotals.costReductionBreakdown}
              riskMitigationBreakdown={valueTotals.riskMitigationBreakdown}
              isCustomMode={isCustomMode && !showGuidedTabs}
              onFormDataChange={(updates) => Object.entries(updates).forEach(([k, v]) => updateField(k as keyof CalculatorData, v))}
              onOpenCalculator={(calculatorId) => {
                // Open the full benefit modal (Benefit summary + Inputs + Calculator) without leaving ROI tab
                setBenefitModalCalculatorId(calculatorId);
              }}
            />
            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6 border-t mt-6">
              <Button variant="outline" onClick={goToPreviousTab} className="gap-2">
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
              <div />
            </div>
          </TabsContent>
        </Tabs>

        {/* When not on Value Summary, mount a hidden instance so: (1) value totals (e.g. EBITDA) are
            always computed and ROI shows correct numbers when user opens a saved analysis and goes
            straight to ROI; (2) when user opens a benefit from ROI, the benefit modal can open. */}
        {activeTab !== 'summary' && (
          <div className="sr-only absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden" aria-hidden="true">
            <ValueSummaryOptionA
              formData={formData}
              selectedChallenges={selectedChallenges}
              onFormDataChange={handleSummaryFormDataChange}
              onForterKPIChange={handleSummaryForterKPIChange}
              onNavigateToForterKPI={showGuidedTabs ? (target) => {
                setForterKPIFocusTarget(target);
                setForterKPIModalOpen(true);
              } : undefined}
              onCustomCalculationsChange={(calcs) => updateField("customCalculations", calcs)}
              onSegmentInputChange={(segmentId, field, value) => {
                const updated = (segments || []).map(seg =>
                  seg.id === segmentId ? { ...seg, inputs: { ...seg.inputs, [field]: value } } : seg
                );
                handleSegmentsChange(updated);
              }}
              onSegmentKPIChange={(segmentId, field, value) => {
                const updated = (segments || []).map(seg =>
                  seg.id === segmentId ? { ...seg, kpis: { ...seg.kpis, [field]: value } } : seg
                );
                handleSegmentsChange(updated);
              }}
              showInMillions={showInMillions}
              onShowInMillionsChange={setShowInMillions}
              onSelectUseCases={undefined}
              onTotalsChange={setValueTotals}
              onChallengeChange={handleChallengeChange}
              isCustomMode={!showGuidedTabs}
              investmentInputs={investmentInputs}
              onInvestmentInputsChange={handleInvestmentInputsChange}
              openBenefitCalculatorId={benefitModalCalculatorId}
              onBenefitModalClose={() => setBenefitModalCalculatorId(null)}
              onGenerateCalculatorSlides={(subset) => {
                setCalculatorSubsetForReport(subset);
                setReportModalOpen(true);
              }}
              persistedBenefitTabsViewed={benefitTabsViewed}
              onPersistBenefitTabViewed={onPersistBenefitTabViewed}
            />
          </div>
        )}
      </Card>
      
      {/* Refine Solution Assumptions modal (guided mode) */}
      <Dialog
        open={forterKPIModalOpen}
        onOpenChange={(open) => {
          setForterKPIModalOpen(open);
          if (!open) setForterKPIFocusTarget(null);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
          <DialogHeader>
            <DialogTitle>Refine Solution Assumptions</DialogTitle>
            <DialogDescription>
              Configure solution performance assumptions and targets used in the value model. Updates are optional; figures are benchmarked to solution and 3rd party data (Country, Industry, AoV, etc.).
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0 space-y-4 py-2">
            <div className="flex items-center justify-end gap-0.5 rounded-md border bg-muted/30 p-0.5 w-fit ml-auto">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setInputsLayoutView('list')}
                    className={`inline-flex items-center justify-center rounded p-1.5 transition-[transform,color,background-color,box-shadow] duration-200 ease-out hover:scale-110 active:scale-95 ${inputsLayoutView === 'list' ? 'scale-105 bg-background shadow-sm' : 'scale-100 text-muted-foreground hover:text-foreground'}`}
                    aria-label="List view"
                  >
                    <List className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">List</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setInputsLayoutView('grid')}
                    className={`inline-flex items-center justify-center rounded p-1.5 transition-[transform,color,background-color,box-shadow] duration-200 ease-out hover:scale-110 active:scale-95 ${inputsLayoutView === 'grid' ? 'scale-105 bg-background shadow-sm' : 'scale-100 text-muted-foreground hover:text-foreground'}`}
                    aria-label="Grid view"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Grid</TooltipContent>
              </Tooltip>
            </div>
            <ForterKPIConfig
              kpis={formData.forterKPIs || defaultForterKPIs}
              onUpdate={(kpis) => updateField("forterKPIs", kpis)}
              selectedChallenges={selectedChallenges}
              focusTarget={forterKPIFocusTarget}
              onFocusHandled={() => setForterKPIFocusTarget(null)}
              viewMode={inputsLayoutView}
              forterBenchmarkSources={forterBenchmarkSources}
              forterBenchmarkValues={forterBenchmarkValues}
              suggested3DSFromPSD2={suggested3DSFromPSD2}
              customerInputs={{
                amerPreAuthApprovalRate: formData.amerPreAuthApprovalRate,
                amerPostAuthApprovalRate: formData.amerPostAuthApprovalRate,
                amer3DSChallengeRate: formData.amer3DSChallengeRate,
                fraudCBRate: formData.fraudCBRate,
                manualReviewPct: formData.manualReviewPct,
                timePerReview: formData.timePerReview,
                fraudDisputeRate: formData.fraudDisputeRate,
                fraudWinRate: formData.fraudWinRate,
                serviceDisputeRate: formData.serviceDisputeRate,
                serviceWinRate: formData.serviceWinRate,
                avgTimeToReviewCB: formData.avgTimeToReviewCB,
                annualCBDisputes: formData.annualCBDisputes,
                costPerHourAnalyst: formData.costPerHourAnalyst,
                amerAnnualGMV: formData.amerAnnualGMV,
                amerGrossAttempts: formData.amerGrossAttempts,
                baseCurrency: formData.baseCurrency,
                existingFraudVendor: formData.existingFraudVendor,
              }}
              segmentationEnabled={segmentationEnabled}
              segments={segments}
              onSegmentUpdate={handleSaveSegment}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => setForterKPIModalOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Currency Change Confirmation Dialog */}
      <AlertDialog open={!!pendingCurrencyChange} onOpenChange={(open) => !open && handleDeclineCurrencyChange()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Base Currency?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Changing HQ location to <strong className="text-foreground">{pendingCurrencyChange?.newLocation}</strong> suggests using <strong className="text-foreground">{pendingCurrencyChange?.newCurrency}</strong> ({getCurrencySymbol(pendingCurrencyChange?.newCurrency || 'USD')}) as the base currency.
                </p>
                <p>
                  Would you like to update the currency? This will recalculate investment pricing to reflect the new currency.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeclineCurrencyChange}>
              Keep {formData.baseCurrency || 'USD'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleAcceptCurrencyChange}>
              Update to {pendingCurrencyChange?.newCurrency}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Clear Form Data Confirmation Dialog */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Input Fields?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all values from the Customer Inputs fields. Your profile information and selected use cases will be preserved.
              <br /><br />
              <strong className="text-destructive">This action cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleClearInputs}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear All Fields
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Segment Editor Modal */}
      <SegmentEditorModal
        open={segmentEditorOpen}
        onOpenChange={setSegmentEditorOpen}
        segment={editingSegment}
        onSave={handleSaveSegment}
        baseCurrency={formData.baseCurrency || 'USD'}
        selectedChallenges={selectedChallenges}
        globalInputs={globalInputsForSegments}
        globalKPIs={globalKPIsForSegments}
        globalCountry={formData.hqLocation}
        globalIndustry={formData.industry}
      />
      
      {/* Segment Delete Confirmation Dialog */}
      <AlertDialog open={!!segmentToDelete} onOpenChange={(open) => !open && setSegmentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Segment?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{segmentToDelete?.name}"? 
              This will remove all data associated with this segment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteSegment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Switch to Guided Pathway Confirmation Dialog */}
      <AlertDialog open={showSwitchToGuidedConfirm} onOpenChange={setShowSwitchToGuidedConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to Guided Value Pathway?</AlertDialogTitle>
            <AlertDialogDescription>
              Switching to the Guided pathway will show additional tabs for Use Cases, Customer Inputs, and Value Summary. 
              You can refine Solution Assumptions from Customer Inputs or Value Summary when needed.
              <br /><br />
              <strong className="text-foreground">All existing data will be preserved.</strong> All custom calculations and any previously entered values will remain intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSwitchToGuided}>
              Switch to Guided
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Switch to Custom Pathway Confirmation Dialog */}
      <AlertDialog open={showSwitchToCustomConfirm} onOpenChange={setShowSwitchToCustomConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to Custom Value Pathway?</AlertDialogTitle>
            <AlertDialogDescription>
              Switching to the Custom pathway will hide the Use Cases, Customer Inputs, and Solution KPIs tabs. 
              You'll work directly with the Value Summary to add custom calculations and standard benefit calculators.
              <br /><br />
              <strong className="text-foreground">Your existing data will be preserved.</strong> All selected use cases, customer inputs, and calculated values will remain intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSwitchToCustom}>
              Switch to Custom
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Skip to Value Summary Confirmation Dialog */}
      <AlertDialog open={showSkipToSummaryConfirm} onOpenChange={setShowSkipToSummaryConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FastForward className="h-5 w-5 text-amber-500" />
              Skip to Value Summary?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  This will switch you to the <strong className="text-foreground">Custom Value Pathway</strong>, which is designed for advanced users who are able to build custom or more complex/detailed calculations.
                </p>
                
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-amber-800 dark:text-amber-200">
                  <p className="font-semibold text-sm mb-1">⚠️ What to expect:</p>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    <li>No automated calculations from use case selection</li>
                    <li>You'll need to add custom calculations manually</li>
                    <li>Links to external calculators/spreadsheets are required</li>
                    <li>Standard benefit calculators can be added (requires inputs)</li>
                  </ul>
                </div>
                
                <p className="text-sm">
                  You can switch back to the Guided pathway anytime using the button in the header.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay in Guided Pathway</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSkipToSummary}>
              Continue to Custom Pathway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Generate Report Modal */}
      <GenerateReportModal
        open={reportModalOpen}
        onOpenChange={(open) => {
          setReportModalOpen(open);
          if (!open) setCalculatorSubsetForReport(null);
        }}
        formData={formData}
        valueTotals={valueTotals}
        selectedChallenges={selectedChallenges}
        investmentInputs={investmentInputs}
        selectedObjectives={selectedObjectives}
        customerLogoUrl={customerLogoUrl}
        onReportGenerated={handleReportGenerated}
        calculatorSubset={calculatorSubsetForReport}
        lastExecutiveSummaryUrl={formData._executiveSummaryUrl ?? lastExecutiveSummaryUrl}
        lastValueDeckUrl={formData._valueDeckUrl ?? lastValueDeckUrl}
        onExecutiveSummaryGenerated={(url) => {
          setLastExecutiveSummaryUrl(url);
          onBulkUpdate?.({ _executiveSummaryUrl: url });
        }}
        onValueDeckGenerated={(url) => {
          setLastValueDeckUrl(url);
          onBulkUpdate?.({ _valueDeckUrl: url });
        }}
      />
      
    </div>
    </>
  );
};
