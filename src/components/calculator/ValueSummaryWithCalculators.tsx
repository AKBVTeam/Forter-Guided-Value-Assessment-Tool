import { useMemo, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  BadgeDollarSign,
  Ban,
  Building,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  RefreshCcw,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Zap,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EditableCalculatorDisplay } from "./EditableCalculatorDisplay";
import { CalculatorData } from "@/pages/Index";
import { ForterKPIs, defaultForterKPIs } from "./ForterKPIConfig";
import {
  calculateChallenge1,
  calculateChallenge245,
  getCompletedTransactionCount,
  calculateChallenge3,
  calculateChallenge7,
  calculateChallenge8,
  calculateChallenge9,
  calculateChallenge10,
  calculateChallenge12_13,
  calculateChallenge14_15,
  Challenge1Inputs,
  Challenge245Inputs,
  Challenge3Inputs,
  Challenge7Inputs,
  Challenge8Inputs,
  Challenge9Inputs,
  Challenge10Inputs,
  Challenge12_13Inputs,
  Challenge14_15Inputs,
  CalculatorRow,
  ALL_CHALLENGES,
  SOLUTION_PRODUCTS,
} from "@/lib/calculations";
import { getGmvToNetSalesDeductionPct } from "@/lib/gmvToNetSalesDeductionByCountry";
import { defaultAbuseBenchmarks } from "./AbuseBenchmarksModal";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  LabelList,
} from "recharts";

interface ValueDriver {
  id: string;
  label: string;
  value: number;
  enabled: boolean;
  calculatorTitle?: string;
  calculatorRows?: CalculatorRow[];
}

interface ValueSummaryWithCalculatorsProps {
  formData: CalculatorData;
  selectedChallenges: { [key: string]: boolean };
  onFormDataChange?: (updates: Partial<CalculatorData>) => void;
  onForterKPIChange?: (updates: Partial<ForterKPIs>) => void;
}

export const ValueSummaryWithCalculators = ({
  formData,
  selectedChallenges,
  onFormDataChange,
  onForterKPIChange,
}: ValueSummaryWithCalculatorsProps) => {
  const forterKPIs = formData.forterKPIs || defaultForterKPIs;
  const [businessGrowthOpen, setBusinessGrowthOpen] = useState(true);
  const [riskAvoidanceOpen, setRiskAvoidanceOpen] = useState(true);
  const [riskMitigationOpen, setRiskMitigationOpen] = useState(true);
  const [selectedCalculator, setSelectedCalculator] = useState<{
    title: string;
    rows: CalculatorRow[];
  } | null>(null);
  
  // Get analysis ID to scope localStorage keys per analysis
  const analysisId = (formData as any)._analysisId || 'default';
  
  // Persist driverStates to localStorage to survive tab navigation
  // Scope to analysis ID so each analysis has its own driver states
  const DRIVER_STATES_KEY = `forter_value_assessment_driver_states_${analysisId}`;
  const [driverStates, setDriverStates] = useState<{ [key: string]: boolean }>(() => {
    try {
      const saved = localStorage.getItem(DRIVER_STATES_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  
  // Reload driverStates when analysis ID changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRIVER_STATES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setDriverStates(parsed);
      } else {
        setDriverStates({});
      }
    } catch {
      setDriverStates({});
    }
  }, [analysisId]);
  
  // Save driverStates to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(DRIVER_STATES_KEY, JSON.stringify(driverStates));
    } catch (error) {
      console.error('Failed to save driver states to localStorage:', error);
    }
  }, [driverStates, DRIVER_STATES_KEY]);
  
  const [showInMillions, setShowInMillions] = useState(false);

  const driverIconMap: Record<string, LucideIcon> = {
    "c1-revenue": TrendingUp,
    "c245-revenue": CreditCard,
    "c1-chargeback": ShieldCheck,
    "c245-chargeback": ShieldAlert,
    "c3-review": ClipboardList,
    "c7-disputes": RefreshCcw,
    "c8-returns": Scale,
    "c8-inr": ShieldAlert,
    "c9-cx-uplift": TrendingUp,
    "c9-cs-opex": Zap,
    "c10-promotion": BadgeDollarSign,
    "c12-ato-opex": UserCheck,
    "c13-clv": UserCheck,
    "c14-marketing": BadgeDollarSign,
    "c14-reactivation": Zap,
    "c14-kyc": ClipboardList,
  };

  const solutionIconMap: Record<string, LucideIcon> = {
    Shield,
    CreditCard,
    FileText,
    Ban,
    UserCheck,
    Building,
  };

  const getDriverIcon = (driverId: string) => driverIconMap[driverId] ?? ArrowUpRight;

  // Get active solutions from selected challenges (for showing all relevant solutions)
  const selectedSolutions = useMemo(() => {
    const solutions = new Set<string>();
    Object.entries(selectedChallenges).forEach(([challengeId, isSelected]) => {
      if (isSelected) {
        const challenge = ALL_CHALLENGES.find(c => c.id === challengeId);
        if (challenge) {
          challenge.solutionMapping.forEach(solution => solutions.add(solution));
        }
      }
    });
    return solutions;
  }, [selectedChallenges]);

  // Map drivers to their associated solutions
  const driverToSolutions: Record<string, string[]> = {
    "c1-revenue": ["fraud-management"],
    "c1-chargeback": ["fraud-management"],
    "c245-revenue": ["fraud-management", "payments-optimization"],
    "c245-chargeback": ["fraud-management", "payments-optimization"],
    "c3-review": ["fraud-management"],
    "c7-disputes": ["dispute-management"],
    "c8-returns": ["policy-abuse-prevention"],
    "c8-inr": ["policy-abuse-prevention"],
    "c9-cx-uplift": ["policy-abuse-prevention"],
    "c9-cs-opex": ["policy-abuse-prevention"],
    "c10-promotion": ["policy-abuse-prevention"],
    "c12-ato-opex": ["account-protection"],
    "c13-clv": ["account-protection"],
    "c14-marketing": ["account-protection"],
    "c14-reactivation": ["account-protection"],
    "c14-kyc": ["account-protection"],
  };

  // Get enabled solutions based on which drivers are turned on
  const enabledSolutions = useMemo(() => {
    const solutions = new Set<string>();
    Object.entries(driverStates).forEach(([driverId, isEnabled]) => {
      // If driver state is undefined, it's enabled by default
      if (isEnabled !== false && driverToSolutions[driverId]) {
        driverToSolutions[driverId].forEach(solution => solutions.add(solution));
      }
    });
    // Also add solutions from drivers that haven't been toggled yet (default enabled)
    Object.keys(driverToSolutions).forEach(driverId => {
      if (driverStates[driverId] === undefined) {
        // Check if this driver would exist based on selected challenges
        const isC1Driver = driverId.startsWith("c1-");
        const isC245Driver = driverId.startsWith("c245-");
        const isC3Driver = driverId === "c3-review";
        const isC7Driver = driverId === "c7-disputes";
        const isC8Driver = driverId.startsWith("c8-");
        const isC9Driver = driverId.startsWith("c9-");
        const isC10Driver = driverId.startsWith("c10-");
        const isC12Driver = driverId === "c12-ato-opex";
        const isC13Driver = driverId === "c13-clv";
        const isC14Driver = driverId.startsWith("c14-");
        
        const driverExists = 
          (isC1Driver && selectedChallenges["1"]) ||
          (isC245Driver && (selectedChallenges["2"] || selectedChallenges["4"] || selectedChallenges["5"])) ||
          (isC3Driver && selectedChallenges["3"]) ||
          (isC7Driver && selectedChallenges["7"]) ||
          (isC8Driver && selectedChallenges["8"]) ||
          (isC9Driver && selectedChallenges["9"]) ||
          (isC10Driver && (selectedChallenges["10"] || selectedChallenges["11"])) ||
          (isC12Driver && (selectedChallenges["12"] || selectedChallenges["13"])) ||
          (isC13Driver && (selectedChallenges["12"] || selectedChallenges["13"])) ||
          (isC14Driver && (selectedChallenges["14"] || selectedChallenges["15"]));
        
        if (driverExists) {
          driverToSolutions[driverId].forEach(solution => solutions.add(solution));
        }
      }
    });
    return solutions;
  }, [driverStates, selectedChallenges]);

  // Challenge IDs match ALL_CHALLENGES in calculations.ts
  const isChallenge1Selected = selectedChallenges["1"] === true;
  const isChallenge2Selected = selectedChallenges["2"] === true;
  const isChallenge3Selected = selectedChallenges["3"] === true;
  const isChallenge4Selected = selectedChallenges["4"] === true;
  const isChallenge5Selected = selectedChallenges["5"] === true;
  const isChallenge7Selected = selectedChallenges["7"] === true;
  const isChallenge8Selected = selectedChallenges["8"] === true;
  const isChallenge9Selected = selectedChallenges["9"] === true;
  const isChallenge10Selected = selectedChallenges["10"] === true;
  const isChallenge11Selected = selectedChallenges["11"] === true;
  const isChallenge12Selected = selectedChallenges["12"] === true;
  const isChallenge13Selected = selectedChallenges["13"] === true;
  const isChallenge14Selected = selectedChallenges["14"] === true;
  const isChallenge15Selected = selectedChallenges["15"] === true;

  const isChallenge245Selected =
    isChallenge2Selected || isChallenge4Selected || isChallenge5Selected;
  const isChallenge10_11Selected = isChallenge10Selected || isChallenge11Selected;
  const isChallenge12_13Selected = isChallenge12Selected || isChallenge13Selected;
  const isChallenge14_15Selected = isChallenge14Selected || isChallenge15Selected;

  // Only show Challenge 1 calculator when it's selected WITHOUT Challenge 2/4/5
  const challenge1Results = useMemo(() => {
    if (!isChallenge1Selected || isChallenge245Selected) return null;

    const currentApprovalRate = formData.amerPreAuthApprovalRate ?? 0;
    const currentCBRate = formData.fraudCBRate ?? 0;
    
    // When absolute mode is selected, calculate delta from target - current
    // Cap values to prevent impossible results (approval rate 0-100%)
    let approvalImprovement = forterKPIs.approvalRateImprovement ?? 4;
    if (forterKPIs.approvalRateIsAbsolute) {
      const targetApproval = Math.min(100, Math.max(0, forterKPIs.approvalRateImprovement ?? 4));
      approvalImprovement = Math.max(0, targetApproval - currentApprovalRate);
    }
    // Clamp improvement so result doesn't exceed 100%
    approvalImprovement = Math.min(approvalImprovement, 100 - currentApprovalRate);
    
    // For chargeback, absolute mode means target CB rate
    // Reduction = (current - target) / current * 100 (percentage reduction, clamp to >= 0)
    let cbReduction = forterKPIs.chargebackReduction ?? 50;
    if (forterKPIs.chargebackReductionIsAbsolute) {
      const targetCBRate = Math.max(0, forterKPIs.chargebackReduction ?? 0);
      // Calculate percentage reduction from current to target
      if (currentCBRate > 0) {
        cbReduction = Math.max(0, ((currentCBRate - targetCBRate) / currentCBRate) * 100);
      } else {
        cbReduction = 0;
      }
    }
    // Clamp reduction to max 100%
    cbReduction = Math.min(100, Math.max(0, cbReduction));

    const inputs: Challenge1Inputs = {
      transactionAttempts: formData.amerGrossAttempts ?? 0,
      transactionAttemptsValue: formData.amerAnnualGMV ?? 0,
      grossMarginPercent: formData.amerGrossMarginPercent ?? 0,
      approvalRate: currentApprovalRate,
      fraudChargebackRate: currentCBRate,
      isMarketplace: formData.isMarketplace ?? false,
      commissionRate: formData.commissionRate ?? 100,
      forterApprovalRateImprovement: approvalImprovement,
      forterChargebackReduction: cbReduction,
    };

    return calculateChallenge1(inputs);
  }, [isChallenge1Selected, isChallenge245Selected, formData, forterKPIs]);

  const challenge245Results = useMemo(() => {
    if (!isChallenge245Selected) return null;

    const currentPreAuthRate = formData.amerPreAuthApprovalRate ?? 0;
    const currentPostAuthRate = formData.amerPostAuthApprovalRate ?? 0;
    const current3DSRate = formData.amer3DSChallengeRate ?? 0;
    const currentCBRate = formData.fraudCBRate ?? 0;
    
    // Pre-auth improvement: if excluded, no improvement; if absolute, calculate delta
    let preAuthImprovement = 0;
    if (forterKPIs.preAuthIncluded !== false) {
      preAuthImprovement = forterKPIs.preAuthApprovalImprovement ?? 4;
      if (forterKPIs.preAuthApprovalIsAbsolute) {
        const targetPreAuth = Math.min(100, Math.max(0, forterKPIs.preAuthApprovalImprovement ?? 4));
        preAuthImprovement = Math.max(0, targetPreAuth - currentPreAuthRate);
      }
      // Clamp improvement so result doesn't exceed 100%
      preAuthImprovement = Math.min(preAuthImprovement, 100 - currentPreAuthRate);
    }
    
    // Post-auth improvement: if excluded, set to 100% (no fraud declines = 100% approval); if absolute, calculate delta
    let postAuthImprovement = 0;
    let targetPostAuthRate: number | undefined = undefined;
    if (forterKPIs.postAuthIncluded !== false) {
      postAuthImprovement = forterKPIs.postAuthApprovalImprovement ?? 2;
      if (forterKPIs.postAuthApprovalIsAbsolute) {
        const targetPostAuth = Math.min(100, Math.max(0, forterKPIs.postAuthApprovalImprovement ?? 2));
        postAuthImprovement = Math.max(0, targetPostAuth - currentPostAuthRate);
      }
      // Clamp improvement so result doesn't exceed 100%
      postAuthImprovement = Math.min(postAuthImprovement, 100 - currentPostAuthRate);
    } else {
      // When post-auth is excluded, Forter outcome should be 100% (no fraud declines at this stage)
      targetPostAuthRate = 100;
      postAuthImprovement = 100 - currentPostAuthRate;
    }
    
    // 3DS reduction: if absolute, target 3DS rate, calculate reduction (clamp to >= 0)
    let threeDSReduction = forterKPIs.threeDSReduction ?? 20;
    if (forterKPIs.threeDSReductionIsAbsolute) {
      const target3DSRate = Math.min(100, Math.max(0, forterKPIs.threeDSReduction ?? 0));
      threeDSReduction = Math.max(0, current3DSRate - target3DSRate);
    }
    // Clamp reduction so 3DS rate doesn't go below 0
    threeDSReduction = Math.min(threeDSReduction, current3DSRate);
    
    // Chargeback reduction: calculate target rate and percentage reduction
    // In relative mode: chargebackReduction is % reduction (e.g., 50 = reduce by 50%)
    // In absolute mode: chargebackReduction is target CB rate (e.g., 0.25 = target 0.25%)
    let cbReduction = forterKPIs.chargebackReduction ?? 50;
    let targetCBRate: number;
    if (forterKPIs.chargebackReductionIsAbsolute) {
      // Absolute mode: value is the target CB rate
      targetCBRate = Math.max(0, forterKPIs.chargebackReduction ?? 0);
      if (currentCBRate > 0) {
        cbReduction = Math.max(0, ((currentCBRate - targetCBRate) / currentCBRate) * 100);
      } else {
        cbReduction = 0;
      }
    } else {
      // Relative mode: value is percentage reduction, calculate target from it
      cbReduction = forterKPIs.chargebackReduction ?? 50;
      targetCBRate = currentCBRate * (1 - cbReduction / 100);
    }
    // Clamp reduction to max 100%
    cbReduction = Math.min(100, Math.max(0, cbReduction));

    const inputs: Challenge245Inputs = {
      transactionAttempts: formData.amerGrossAttempts ?? 0,
      transactionAttemptsValue: formData.amerAnnualGMV ?? 0,
      grossMarginPercent: formData.amerGrossMarginPercent ?? 0,
      preAuthApprovalRate: currentPreAuthRate,
      postAuthApprovalRate: currentPostAuthRate,
      creditCardPct: formData.amerCreditCardPct ?? 0,
      creditCard3DSPct: current3DSRate,
      threeDSFailureRate: formData.amer3DSAbandonmentRate ?? 0,
      issuingBankDeclineRate: formData.amerIssuingBankDeclineRate ?? 0,
      forter3DSAbandonmentRate: forterKPIs.forter3DSAbandonmentRate ?? formData.amer3DSAbandonmentRate ?? 0,
      forterIssuingBankDeclineRate: forterKPIs.forterIssuingBankDeclineRate ?? formData.amerIssuingBankDeclineRate ?? 0,
      fraudChargebackRate: currentCBRate,
      isMarketplace: formData.isMarketplace ?? false,
      commissionRate: formData.commissionRate ?? 100,
      forterPreAuthImprovement: preAuthImprovement,
      forterPostAuthImprovement: postAuthImprovement,
      forter3DSReduction: threeDSReduction,
      forterChargebackReduction: cbReduction,
      forterTargetCBRate: targetCBRate,
      forterTargetPostAuthRate: targetPostAuthRate,
    };

    return calculateChallenge245(inputs);
  }, [isChallenge245Selected, formData, forterKPIs]);

  const challenge3Results = useMemo(() => {
    if (!isChallenge3Selected) return null;

    const currentReviewPct = formData.manualReviewPct ?? 0;
    const currentTimePerReview = formData.timePerReview ?? 0;
    
    // Manual review reduction: 
    // - In relative mode: value is percentage points to reduce (e.g., 5 reduces from 5% to 0%)
    // - In absolute mode: value is target review rate %, so reduction = current - target
    let reviewReduction = forterKPIs.manualReviewReduction ?? 5; // default to 5 percentage points reduction
    if (forterKPIs.manualReviewIsAbsolute) {
      const targetReviewPct = Math.max(0, forterKPIs.manualReviewReduction ?? 0);
      // Reduction is absolute points: current - target
      reviewReduction = Math.max(0, currentReviewPct - targetReviewPct);
    }
    // Clamp so we don't go below 0%
    reviewReduction = Math.min(reviewReduction, currentReviewPct);
    
    // Time reduction: 
    // - In relative mode: value is percentage reduction (e.g., 30 = 30% reduction)
    // - In absolute mode: value is target time in minutes, so we calculate the absolute reduction
    let timeReductionMinutes = 0;
    let timeReductionPct = forterKPIs.reviewTimeReduction ?? 30; // default to 30% reduction
    if (forterKPIs.reviewTimeIsAbsolute) {
      const targetTime = Math.max(0, forterKPIs.reviewTimeReduction ?? 0);
      // Calculate absolute minutes reduction
      timeReductionMinutes = Math.max(0, currentTimePerReview - targetTime);
      // Convert to percentage for the calculation function
      if (currentTimePerReview > 0) {
        timeReductionPct = (timeReductionMinutes / currentTimePerReview) * 100;
      } else {
        timeReductionPct = 0;
      }
    }
    // Clamp percentage
    timeReductionPct = Math.min(100, Math.max(0, timeReductionPct));

    const inputs: Challenge3Inputs = {
      transactionAttempts: formData.amerGrossAttempts ?? 0,
      manualReviewPct: currentReviewPct,
      timePerReview: currentTimePerReview,
      hourlyReviewerCost: formData.hourlyReviewerCost ?? 0,
      forterReviewReduction: reviewReduction,
      forterTimeReduction: timeReductionPct,
    };

    return calculateChallenge3(inputs);
  }, [isChallenge3Selected, formData, forterKPIs]);

  const challenge7Results = useMemo(() => {
    if (!isChallenge7Selected) return null;

    const currentFraudDisputeRate = formData.fraudDisputeRate ?? 0;
    const currentFraudWinRate = formData.fraudWinRate ?? 0;
    const currentServiceDisputeRate = formData.serviceDisputeRate ?? 0;
    const currentServiceWinRate = formData.serviceWinRate ?? 0;
    const currentTimeToReview = formData.avgTimeToReviewCB ?? 0;
    
    // Fraud dispute improvement: if absolute, target is dispute rate %, calculate delta
    let fraudDisputeImprovement = forterKPIs.fraudDisputeRateImprovement ?? 45;
    if (forterKPIs.fraudDisputeIsAbsolute) {
      const targetFraudDispute = Math.min(100, forterKPIs.fraudDisputeRateImprovement ?? 45);
      fraudDisputeImprovement = targetFraudDispute - currentFraudDisputeRate;
    }
    
    // Fraud win rate change: if absolute, target is win rate %, calculate delta
    let fraudWinChange = forterKPIs.fraudWinRateChange ?? -10;
    if (forterKPIs.fraudWinRateIsAbsolute) {
      const targetFraudWin = Math.min(100, Math.max(0, forterKPIs.fraudWinRateChange ?? 0));
      fraudWinChange = targetFraudWin - currentFraudWinRate;
    }
    
    // Service dispute improvement: if absolute, target is dispute rate %, calculate delta
    let serviceDisputeImprovement = forterKPIs.serviceDisputeRateImprovement ?? 65;
    if (forterKPIs.serviceDisputeIsAbsolute) {
      const targetServiceDispute = Math.min(100, forterKPIs.serviceDisputeRateImprovement ?? 65);
      serviceDisputeImprovement = targetServiceDispute - currentServiceDisputeRate;
    }
    
    // Service win rate change: if absolute, target is win rate %, calculate delta
    let serviceWinChange = forterKPIs.serviceWinRateChange ?? -10;
    if (forterKPIs.serviceWinRateIsAbsolute) {
      const targetServiceWin = Math.min(100, Math.max(0, forterKPIs.serviceWinRateChange ?? 0));
      serviceWinChange = targetServiceWin - currentServiceWinRate;
    }
    
    // Target review time (absolute value in minutes)
    const targetReviewTime = forterKPIs.disputeTimeReduction ?? 5;

    const inputs: Challenge7Inputs = {
      transactionAttempts: formData.amerGrossAttempts ?? 0,
      transactionAttemptsValue: formData.amerAnnualGMV ?? 0,
      fraudChargebackRate: formData.fraudCBRate ?? 0,
      fraudDisputeRate: currentFraudDisputeRate,
      fraudWinRate: currentFraudWinRate,
      serviceChargebackRate: formData.serviceCBRate ?? 0,
      serviceDisputeRate: currentServiceDisputeRate,
      serviceWinRate: currentServiceWinRate,
      avgTimeToReviewCB: currentTimeToReview,
      annualCBDisputes: formData.annualCBDisputes ?? 0,
      costPerHourAnalyst: formData.costPerHourAnalyst ?? 0,
      forterFraudDisputeImprovement: fraudDisputeImprovement,
      forterFraudWinChange: fraudWinChange,
      forterServiceDisputeImprovement: serviceDisputeImprovement,
      forterServiceWinChange: serviceWinChange,
      forterTargetReviewTime: targetReviewTime,
    };

    return calculateChallenge7(inputs);
  }, [isChallenge7Selected, formData, forterKPIs]);

  const challenge8Results = useMemo(() => {
    if (!isChallenge8Selected) return null;

    const benchmarks = forterKPIs.abuseBenchmarks || defaultAbuseBenchmarks;
    
    const inputs: Challenge8Inputs = {
      expectedRefundsVolume: formData.expectedRefundsVolume ?? 0,
      avgRefundValue: formData.avgRefundValue ?? 0,
      isMarketplace: formData.isMarketplace ?? false,
      commissionRate: formData.commissionRate ?? 100,
      grossMarginPercent: formData.amerGrossMarginPercent ?? 0,
      avgOneWayShipping: formData.avgOneWayShipping ?? 0,
      avgFulfilmentCost: formData.avgFulfilmentCost ?? 0,
      txProcessingFeePct: formData.txProcessingFeePct ?? 0,
      avgCSTicketCost: formData.avgCSTicketCost ?? 0,
      pctINRClaims: formData.pctINRClaims ?? 0,
      pctReplacedCredits: formData.pctReplacedCredits ?? 0,
      forterCatchRate: forterKPIs.forterCatchRate || 90,
      abuseAovMultiplier: forterKPIs.abuseAovMultiplier || 1.5,
      egregiousReturnsAbusePct: benchmarks.egregiousReturnsAbusePct || 2,
      egregiousInventoryLossPct: benchmarks.egregiousInventoryLossPct || 100,
      egregiousINRAbusePct: benchmarks.egregiousINRAbusePct || 15,
      nonEgregiousReturnsAbusePct: benchmarks.nonEgregiousReturnsAbusePct || 8,
      nonEgregiousInventoryLossPct: benchmarks.nonEgregiousInventoryLossPct || 50,
      forterEgregiousReturnsReduction: benchmarks.forterEgregiousReturnsReduction || 90,
      forterEgregiousINRReduction: benchmarks.forterEgregiousINRReduction || 90,
      forterNonEgregiousReturnsReduction: benchmarks.forterNonEgregiousReturnsReduction || 90,
    };

    return calculateChallenge8(inputs);
  }, [isChallenge8Selected, formData, forterKPIs]);

  // Challenge 9: Instant Refunds
  const challenge9Results = useMemo(() => {
    if (!isChallenge9Selected) return null;

    const completedCount = getCompletedTransactionCount(formData, isChallenge1Selected, isChallenge245Selected);
    const effectiveAOV = formData.completedAOV ?? ((formData.amerGrossAttempts ?? 0) > 0 ? (formData.amerAnnualGMV ?? 0) / (formData.amerGrossAttempts ?? 1) : 0);
    const currentEcommerceSales = completedCount * effectiveAOV;

    const inputs: Challenge9Inputs = {
      currentEcommerceSales,
      commissionRate: formData.commissionRate ?? 100,
      grossMarginPercent: formData.amerGrossMarginPercent ?? 0,
      refundRate: formData.refundRate ?? 0,
      expectedRefundsVolume: formData.expectedRefundsVolume ?? 0,
      pctRefundsToCS: formData.pctRefundsToCS ?? 0,
      costPerCSContact: formData.costPerCSContact ?? 0,
      currencyCode: formData.baseCurrency || 'USD',
      isMarketplace: formData.isMarketplace || false,
      npsIncreaseFromInstantRefunds: forterKPIs.npsIncreaseFromInstantRefunds ?? 10,
      lseNPSBenchmark: forterKPIs.lseNPSBenchmark ?? 1,
      forterCSReduction: forterKPIs.forterCSReduction ?? 78,
    };

    return calculateChallenge9(inputs);
  }, [isChallenge9Selected, isChallenge1Selected, isChallenge245Selected, formData, forterKPIs]);

  // Challenge 10/11: Promotion Abuse
  const challenge10Results = useMemo(() => {
    if (!isChallenge10_11Selected) return null;

    const benchmarks = forterKPIs.abuseBenchmarks || defaultAbuseBenchmarks;

    const inputs: Challenge10Inputs = {
      transactionAttemptsValue: formData.amerAnnualGMV ?? 0,
      avgDiscountByAbusers: formData.avgDiscountByAbusers ?? 0,
      isMarketplace: formData.isMarketplace ?? false,
      commissionRate: formData.commissionRate ?? 100,
      grossMarginPercent: formData.amerGrossMarginPercent ?? 0,
      currencyCode: formData.baseCurrency || 'USD',
      forterCatchRate: forterKPIs.forterCatchRate || 90,
      abuseAovMultiplier: forterKPIs.abuseAovMultiplier || 1.5,
      promotionAbuseAsGMVPct: benchmarks.promotionAbuseAsGMVPct || 2,
    };

    return calculateChallenge10(inputs);
  }, [isChallenge10_11Selected, formData, forterKPIs]);

  // Challenge 12/13: ATO Protection
  const challenge12_13Results = useMemo(() => {
    if (!isChallenge12_13Selected) return null;

    const inputs: Challenge12_13Inputs = {
      monthlyLogins: (formData.monthlyLogins != null && formData.monthlyLogins !== '') ? Number(formData.monthlyLogins) : 0,
      customerLTV: formData.customerLTV ?? 0,
      avgAppeasementValue: formData.avgAppeasementValue ?? 0,
      avgSalaryPerCSMember: (formData.avgSalaryPerCSMember != null && formData.avgSalaryPerCSMember !== '') ? Number(formData.avgSalaryPerCSMember) : 0,
      avgHandlingTimePerATOClaim: formData.avgHandlingTimePerATOClaim ?? 0,
      pctChurnFromATO: formData.pctChurnFromATO ?? 0,
      commissionRate: formData.commissionRate ?? 100,
      grossMarginPercent: formData.amerGrossMarginPercent ?? 0,
      currencyCode: formData.baseCurrency || 'USD',
      isMarketplace: formData.isMarketplace || false,
      pctFraudulentLogins: forterKPIs.pctFraudulentLogins || 1,
      churnLikelihoodFromATO: forterKPIs.churnLikelihoodFromATO || 50,
      atoCatchRate: forterKPIs.atoCatchRate || 90,
      gmvToNetSalesDeductionPct: getGmvToNetSalesDeductionPct(formData),
    };

    return calculateChallenge12_13(inputs);
  }, [isChallenge12_13Selected, formData, forterKPIs]);

  // Challenge 14/15: Sign-up Protection
  const challenge14_15Results = useMemo(() => {
    if (!isChallenge14_15Selected) return null;

    const inputs: Challenge14_15Inputs = {
      monthlySignups: (formData.monthlySignups != null && formData.monthlySignups !== '') ? Number(formData.monthlySignups) : 0,
      avgNewMemberBonus: formData.avgNewMemberBonus ?? 0,
      numDigitalCommunicationsPerYear: formData.numDigitalCommunicationsPerYear ?? 0,
      avgCostPerOutreach: formData.avgCostPerOutreach ?? 0,
      avgKYCCostPerAccount: formData.avgKYCCostPerAccount ?? 0,
      pctAccountsGoingThroughKYC: formData.pctAccountsGoingThroughKYC ?? 0,
      currencyCode: formData.baseCurrency || 'USD',
      pctFraudulentSignups: forterKPIs.pctFraudulentSignups || 10,
      forterFraudulentSignupReduction: forterKPIs.forterFraudulentSignupReduction || 95,
      forterKYCReduction: forterKPIs.forterKYCReduction || 80,
    };

    return calculateChallenge14_15(inputs);
  }, [isChallenge14_15Selected, formData, forterKPIs]);

  // Build value drivers from results
  const businessGrowthDrivers: ValueDriver[] = useMemo(() => {
    const drivers: ValueDriver[] = [];

    if (challenge1Results) {
      drivers.push({
        id: "c1-revenue",
        label: "Reduce false declines",
        value: challenge1Results.calculator1.revenueUplift,
        enabled: driverStates["c1-revenue"] !== false,
        calculatorTitle: "Reduce false declines and approve more transactions",
        calculatorRows: challenge1Results.calculator1.rows,
      });
    }

    if (challenge245Results) {
      drivers.push({
        id: "c245-revenue",
        label: "Optimize payment funnel",
        value: challenge245Results.calculator1.revenueUplift,
        enabled: driverStates["c245-revenue"] !== false,
        calculatorTitle: "Reduce false declines and optimize payments",
        calculatorRows: challenge245Results.calculator1.rows,
      });
    }

    // Challenge 9: Instant refunds CX uplift (GMV uplift)
    if (challenge9Results) {
      drivers.push({
        id: "c9-cx-uplift",
        label: "Instant refunds CX uplift",
        value: challenge9Results.calculator1.gmvUplift,
        enabled: driverStates["c9-cx-uplift"] !== false,
        calculatorTitle: "Instant refunds CX uplift",
        calculatorRows: challenge9Results.calculator1.rows,
      });
    }

    // Challenge 10/11: Promotion abuse protection (revenue uplift)
    if (challenge10Results) {
      drivers.push({
        id: "c10-promotion",
        label: "Protect profitability from promotion abuse",
        value: challenge10Results.calculator1.revenueUplift,
        enabled: driverStates["c10-promotion"] !== false,
        calculatorTitle: "Protect profitability from promotion abuse",
        calculatorRows: challenge10Results.calculator1.rows,
      });
    }

    return drivers;
  }, [challenge1Results, challenge245Results, challenge9Results, challenge10Results, driverStates]);

  // Cost Reduction drivers
  const riskAvoidanceDrivers: ValueDriver[] = useMemo(() => {
    const drivers: ValueDriver[] = [];

    if (challenge1Results) {
      drivers.push({
        id: "c1-chargeback",
        label: "Reduce fraud chargebacks",
        value: challenge1Results.calculator2.costReduction,
        enabled: driverStates["c1-chargeback"] !== false,
        calculatorTitle: "Reduce fraud chargebacks",
        calculatorRows: challenge1Results.calculator2.rows,
      });
    }

    if (challenge245Results) {
      drivers.push({
        id: "c245-chargeback",
        label: "Reduce fraud chargebacks",
        value: challenge245Results.calculator2.costReduction,
        enabled: driverStates["c245-chargeback"] !== false,
        calculatorTitle: "Reduce fraud chargebacks",
        calculatorRows: challenge245Results.calculator2.rows,
      });
    }

    if (challenge3Results) {
      drivers.push({
        id: "c3-review",
        label: "Reduce manual review costs",
        value: challenge3Results.calculator1.costReduction,
        enabled: driverStates["c3-review"] !== false,
        calculatorTitle: "Reduce manual review workflow",
        calculatorRows: challenge3Results.calculator1.rows,
      });
    }

    if (challenge7Results) {
      drivers.push({
        id: "c7-disputes",
        label: "Increase chargeback recoveries",
        value: challenge7Results.calculator1.costReduction,
        enabled: driverStates["c7-disputes"] !== false,
        calculatorTitle: "Increase chargeback recoveries",
        calculatorRows: challenge7Results.calculator1.rows,
      });
    }

    // Challenge 9: Reduced CS ticket handling OpEx
    if (challenge9Results) {
      drivers.push({
        id: "c9-cs-opex",
        label: "Reduced CS ticket handling",
        value: challenge9Results.calculator2.costReduction,
        enabled: driverStates["c9-cs-opex"] !== false,
        calculatorTitle: "Reduced CS ticket handling OpEx",
        calculatorRows: challenge9Results.calculator2.rows,
      });
    }

    // Challenge 12/13: ATO OpEx savings
    if (challenge12_13Results) {
      drivers.push({
        id: "c12-ato-opex",
        label: "ATO protection OpEx savings",
        value: challenge12_13Results.calculator1.costReduction,
        enabled: driverStates["c12-ato-opex"] !== false,
        calculatorTitle: "ATO protection OpEx savings",
        calculatorRows: challenge12_13Results.calculator1.rows,
      });
    }

    // Challenge 14/15: Sign-up protection cost savings
    if (challenge14_15Results) {
      drivers.push({
        id: "c14-marketing",
        label: "Protect marketing budget",
        value: challenge14_15Results.calculator1.costReduction,
        enabled: driverStates["c14-marketing"] !== false,
        calculatorTitle: "Protect marketing budget against duplicate accounts",
        calculatorRows: challenge14_15Results.calculator1.rows,
      });
      drivers.push({
        id: "c14-reactivation",
        label: "Reduce re-activation costs",
        value: challenge14_15Results.calculator2.costReduction,
        enabled: driverStates["c14-reactivation"] !== false,
        calculatorTitle: "Reduce re-activation costs on fake accounts",
        calculatorRows: challenge14_15Results.calculator2.rows,
      });
      drivers.push({
        id: "c14-kyc",
        label: "Optimize KYC costs",
        value: challenge14_15Results.calculator3.costReduction,
        enabled: driverStates["c14-kyc"] !== false,
        calculatorTitle: "Optimize KYC costs",
        calculatorRows: challenge14_15Results.calculator3.rows,
      });
    }

    return drivers;
  }, [challenge1Results, challenge245Results, challenge3Results, challenge7Results, challenge9Results, challenge12_13Results, challenge14_15Results, driverStates]);

  // Risk Mitigation drivers (abuse prevention & CLV protection)
  const riskMitigationDrivers: ValueDriver[] = useMemo(() => {
    const drivers: ValueDriver[] = [];

    if (challenge8Results) {
      drivers.push({
        id: "c8-returns",
        label: "Block returns abusers",
        value: challenge8Results.calculator1.costReduction,
        enabled: driverStates["c8-returns"] !== false,
        calculatorTitle: "Block/Dissuade returns abusers",
        calculatorRows: challenge8Results.calculator1.rows,
      });
      drivers.push({
        id: "c8-inr",
        label: "Block INR abusers",
        value: challenge8Results.calculator2.costReduction,
        enabled: driverStates["c8-inr"] !== false,
        calculatorTitle: "Block INR (Item Not Received) abusers",
        calculatorRows: challenge8Results.calculator2.rows,
      });
    }

    // Challenge 12/13: CLV loss mitigation (goes to risk mitigation as it's about preventing churn)
    if (challenge12_13Results) {
      drivers.push({
        id: "c13-clv",
        label: "Mitigate CLV loss from ATO churn",
        value: challenge12_13Results.calculator2.profitUplift,
        enabled: driverStates["c13-clv"] !== false,
        calculatorTitle: "Mitigate customer lifetime value loss from ATO churn",
        calculatorRows: challenge12_13Results.calculator2.rows,
      });
    }

    return drivers;
  }, [challenge8Results, challenge12_13Results, driverStates]);

  const grossMarginPercent = formData.amerGrossMarginPercent || 50;

  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    let formatted: string;
    
    if (showInMillions) {
      const millions = absValue / 1_000_000;
      formatted = `$${millions.toFixed(1)}M`;
    } else {
      formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(absValue);
    }
    
    if (value < 0) {
      return `(${formatted})`;
    } else if (value > 0) {
      return `+${formatted}`;
    }
    return formatted;
  };

  const businessGrowthTotal = businessGrowthDrivers.reduce(
    (sum, d) => sum + (d.enabled ? d.value : 0),
    0
  );
  const riskAvoidanceTotal = riskAvoidanceDrivers.reduce(
    (sum, d) => sum + (d.enabled ? d.value : 0),
    0
  );
  const riskMitigationTotal = riskMitigationDrivers.reduce(
    (sum, d) => sum + (d.enabled ? d.value : 0),
    0
  );
  const totalValue = businessGrowthTotal + riskAvoidanceTotal + riskMitigationTotal;

  // EBITDA Contribution = (GMV Uplift × margin) + Cost Reduction + Risk Mitigation
  // Retailer: GMV × gross margin; Marketplace: GMV × commission × gross margin (both applied)
  const isMarketplace = formData.isMarketplace || false;
  const commissionRate = formData.commissionRate || 100;
  const gmvProfitability = isMarketplace
    ? businessGrowthTotal * (commissionRate / 100) * (grossMarginPercent / 100)
    : businessGrowthTotal * (grossMarginPercent / 100);
  const ebitdaContribution = gmvProfitability + riskAvoidanceTotal + riskMitigationTotal;

  // Waterfall chart data - limit to top 5 bars + "Other" bucket to prevent overlap
  const MAX_CHART_BARS = 5;
  
  const waterfallData = useMemo(() => {
    const rawData: { name: string; value: number; base: number; isTotal: boolean; originalLabel: string }[] = [];
    
    const toMultiLine = (label: string) => label.split(" ").join("\n");

    // Collect all individual drivers first
    if (businessGrowthTotal > 0) {
      const primaryGrowthLabel =
        businessGrowthDrivers[0]?.calculatorTitle ??
        businessGrowthDrivers[0]?.label ??
        "Increase eCommerce sales";

      rawData.push({
        name: toMultiLine(primaryGrowthLabel),
        originalLabel: primaryGrowthLabel,
        value: gmvProfitability,
        base: 0,
        isTotal: false,
      });
    }

    riskAvoidanceDrivers.forEach((driver) => {
      if (driver.enabled && driver.value > 0) {
        const label = driver.calculatorTitle ?? driver.label;
        rawData.push({
          name: toMultiLine(label),
          originalLabel: label,
          value: driver.value,
          base: 0,
          isTotal: false,
        });
      }
    });

    riskMitigationDrivers.forEach((driver) => {
      if (driver.enabled && driver.value > 0) {
        const label = driver.calculatorTitle ?? driver.label;
        rawData.push({
          name: toMultiLine(label),
          originalLabel: label,
          value: driver.value,
          base: 0,
          isTotal: false,
        });
      }
    });

    // Sort by value descending to get top contributors
    const sortedData = [...rawData].sort((a, b) => b.value - a.value);
    
    // If we have more than MAX_CHART_BARS, bucket the rest into "Other"
    let chartData: { name: string; value: number; base: number; isTotal: boolean }[] = [];
    
    if (sortedData.length > MAX_CHART_BARS) {
      const topBars = sortedData.slice(0, MAX_CHART_BARS);
      const otherBars = sortedData.slice(MAX_CHART_BARS);
      const otherTotal = otherBars.reduce((sum, item) => sum + item.value, 0);
      
      // Build waterfall with running totals
      let runningTotal = 0;
      topBars.forEach((item) => {
        chartData.push({
          name: item.name,
          value: item.value,
          base: runningTotal,
          isTotal: false,
        });
        runningTotal += item.value;
      });
      
      // Add "Other" bucket
      if (otherTotal > 0) {
        chartData.push({
          name: `Other\n(${otherBars.length})`,
          value: otherTotal,
          base: runningTotal,
          isTotal: false,
        });
        runningTotal += otherTotal;
      }
    } else {
      // Build waterfall with running totals
      let runningTotal = 0;
      sortedData.forEach((item) => {
        chartData.push({
          name: item.name,
          value: item.value,
          base: runningTotal,
          isTotal: false,
        });
        runningTotal += item.value;
      });
    }

    // Add EBITDA total bar
    if (chartData.length > 0) {
      chartData.push({
        name: "EBITDA\nContribution",
        value: ebitdaContribution,
        base: 0,
        isTotal: true,
      });
    }

    return chartData;
  }, [businessGrowthDrivers, businessGrowthTotal, gmvProfitability, riskAvoidanceDrivers, riskMitigationDrivers, ebitdaContribution]);

  const hasAnyResults =
    challenge1Results || challenge245Results || challenge3Results || challenge7Results || challenge8Results ||
    challenge9Results || challenge10Results || challenge12_13Results || challenge14_15Results;

  const handleDriverToggle = (driverId: string, enabled: boolean) => {
    setDriverStates((prev) => ({ ...prev, [driverId]: enabled }));
  };

  const handleDriverClick = (driver: ValueDriver) => {
    if (driver.enabled && driver.calculatorRows) {
      setSelectedCalculator({
        title: driver.calculatorTitle || driver.label,
        rows: driver.calculatorRows,
      });
    }
  };

  if (!hasAnyResults) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="mb-2">
          Please enter data in the Customer Inputs tab to see the value assessment.
        </p>
        <p className="text-sm">
          As you fill in the inputs, the calculations will update automatically here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid md:grid-cols-2 gap-6">
        {/* Left side - Value Drivers */}
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-xl font-semibold">
              Explore personalized benefits
            </h3>
            <p className="text-sm text-muted-foreground">
              Click on a value driver to deep dive into calculations
            </p>
          </div>

          {/* GMV Uplift Section */}
          {businessGrowthDrivers.length > 0 && (
            <Collapsible open={businessGrowthOpen} onOpenChange={setBusinessGrowthOpen}>
              <Card className="overflow-hidden transition-transform duration-150 ease-out hover:scale-[1.01] active:scale-[0.98]">
                <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    {businessGrowthOpen ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                    <span className="font-semibold">GMV Uplift</span>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t">
                    {businessGrowthDrivers.map((driver) => {
                      const Icon = getDriverIcon(driver.id);

                      return (
                        <div
                          key={driver.id}
                          className={`p-4 border-b last:border-b-0 flex items-center justify-between transition-transform duration-150 ease-out hover:scale-[1.01] active:scale-[0.98] ${
                            !driver.enabled && "opacity-50"
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Switch
                              checked={driver.enabled}
                              onCheckedChange={(checked) =>
                                handleDriverToggle(driver.id, checked)
                              }
                            />
                            <Icon className="w-4 h-4 text-primary shrink-0" aria-hidden />
                            <span
                              className="text-sm cursor-pointer hover:underline hover:text-primary flex-1 min-w-0"
                              onClick={() => handleDriverClick(driver)}
                            >
                              {driver.label}
                            </span>
                          </div>
                          <span className="font-semibold whitespace-nowrap">
                            {formatCurrency(driver.value)}
                          </span>
                        </div>
                      );
                    })}
                    <div className="p-4 bg-muted/30 font-semibold flex items-center justify-between">
                      <span>GMV uplift annual potential</span>
                      <span className="text-foreground font-semibold">
                        {formatCurrency(businessGrowthTotal)}
                      </span>
                    </div>
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Cost Reduction Section */}
          {riskAvoidanceDrivers.length > 0 && (
            <Collapsible open={riskAvoidanceOpen} onOpenChange={setRiskAvoidanceOpen}>
              <Card className="overflow-hidden transition-transform duration-150 ease-out hover:scale-[1.01] active:scale-[0.98]">
                <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    {riskAvoidanceOpen ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                    <span className="font-semibold">Cost Reduction</span>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t">
                    {riskAvoidanceDrivers.map((driver) => {
                      const Icon = getDriverIcon(driver.id);

                      return (
                        <div
                          key={driver.id}
                          className={`p-4 border-b last:border-b-0 flex items-center justify-between transition-transform duration-150 ease-out hover:scale-[1.01] active:scale-[0.98] ${
                            !driver.enabled && "opacity-50"
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Switch
                              checked={driver.enabled}
                              onCheckedChange={(checked) =>
                                handleDriverToggle(driver.id, checked)
                              }
                            />
                            <Icon className="w-4 h-4 text-primary shrink-0" aria-hidden />
                            <span
                              className="text-sm cursor-pointer hover:underline hover:text-primary flex-1 min-w-0"
                              onClick={() => handleDriverClick(driver)}
                            >
                              {driver.label}
                            </span>
                          </div>
                          <span className="font-semibold whitespace-nowrap">
                            {formatCurrency(driver.value)}
                          </span>
                        </div>
                      );
                    })}
                    <div className="p-4 bg-muted/30 font-semibold flex items-center justify-between">
                      <span>Cost reduction annual potential</span>
                      <span className="text-foreground font-semibold">
                        {formatCurrency(riskAvoidanceTotal)}
                      </span>
                    </div>
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Risk Mitigation Section */}
          {riskMitigationDrivers.length > 0 && (
            <Collapsible open={riskMitigationOpen} onOpenChange={setRiskMitigationOpen}>
              <Card className="overflow-hidden transition-transform duration-150 ease-out hover:scale-[1.01] active:scale-[0.98]">
                <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    {riskMitigationOpen ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                    <span className="font-semibold">Risk Mitigation</span>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t">
                    {riskMitigationDrivers.map((driver) => {
                      const Icon = getDriverIcon(driver.id);

                      return (
                        <div
                          key={driver.id}
                          className={`p-4 border-b last:border-b-0 flex items-center justify-between transition-transform duration-150 ease-out hover:scale-[1.01] active:scale-[0.98] ${
                            !driver.enabled && "opacity-50"
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Switch
                              checked={driver.enabled}
                              onCheckedChange={(checked) =>
                                handleDriverToggle(driver.id, checked)
                              }
                            />
                            <Icon className="w-4 h-4 text-primary shrink-0" aria-hidden />
                            <span
                              className="text-sm cursor-pointer hover:underline hover:text-primary flex-1 min-w-0"
                              onClick={() => handleDriverClick(driver)}
                            >
                              {driver.label}
                            </span>
                          </div>
                          <span className="font-semibold whitespace-nowrap">
                            {formatCurrency(driver.value)}
                          </span>
                        </div>
                      );
                    })}
                    <div className="p-4 bg-muted/30 font-semibold flex items-center justify-between">
                      <span>Risk mitigation annual potential</span>
                      <span className="text-foreground font-semibold">
                        {formatCurrency(riskMitigationTotal)}
                      </span>
                    </div>
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}
        </div>

        {/* Right side - Summary */}
        <div className="space-y-4">
          {/* Millions toggle */}
          <div className="flex items-center justify-end gap-2">
            <span className="text-sm text-muted-foreground">Show in millions</span>
            <Switch checked={showInMillions} onCheckedChange={setShowInMillions} />
          </div>

          <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
            <div className="flex gap-4">
              {/* Left side - Totals */}
              <div className="flex-1">
                {businessGrowthTotal > 0 && (
                  <>
                    <div className="flex items-start gap-3 mb-4">
                      <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-base font-semibold text-foreground mb-1">
                          Total Annual Benefit
                        </p>
                        <p className="text-sm text-muted-foreground">GMV Uplift + Cost Reduction</p>
                      </div>
                    </div>
                    <p className="text-5xl font-bold text-green-600 dark:text-green-400 mb-6">
                      {formatCurrency(totalValue)}
                    </p>
                  </>
                )}

                <div className={businessGrowthTotal > 0 ? "pt-4 border-t border-green-200 dark:border-green-700" : ""}>
                  <div className="flex items-start gap-3 mb-2">
                    {businessGrowthTotal === 0 && (
                      <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-base font-semibold text-foreground mb-1">
                        Annual run-rate Contribution to EBITDA
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {businessGrowthTotal > 0
                          ? isMarketplace 
                            ? `(GMV Uplift × ${commissionRate}% commission) + Cost Reduction`
                            : `(GMV Uplift × ${grossMarginPercent}% margin) + Cost Reduction`
                          : "Cost Reduction"}
                      </p>
                    </div>
                  </div>
                  <p className={`font-bold text-green-600 dark:text-green-400 ${businessGrowthTotal > 0 ? "text-3xl" : "text-5xl"}`}>
                    {formatCurrency(ebitdaContribution)}
                  </p>
                </div>
              </div>

              {/* Right side - Solution Icons */}
              {selectedSolutions.size > 0 && (
                <div className="flex flex-col items-end gap-1 pl-3 border-l border-green-200 dark:border-green-700 min-w-fit">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Required Solutions</p>
                  {SOLUTION_PRODUCTS.filter(product => selectedSolutions.has(product.id)).map(product => {
                    const IconComponent = solutionIconMap[product.icon];
                    const isEnabled = enabledSolutions.has(product.id);
                    return (
                      <div
                        key={product.id}
                        className={`flex items-center gap-1.5 transition-opacity ${!isEnabled ? 'opacity-40' : ''}`}
                        title={product.name}
                      >
                        {IconComponent && <IconComponent className={`w-3.5 h-3.5 ${isEnabled ? 'text-green-700 dark:text-green-300' : 'text-muted-foreground'}`} />}
                        <span className={`text-[11px] font-medium whitespace-nowrap ${isEnabled ? 'text-green-800 dark:text-green-200' : 'text-muted-foreground'}`}>
                          {product.name.split(' ')[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>

          {/* Performance Highlights - only show when driver is enabled AND metric is an improvement */}
          {(() => {
            const approvalImprovement = challenge245Results ? forterKPIs.preAuthApprovalImprovement : forterKPIs.approvalRateImprovement;
            const showApprovalRate = ((challenge1Results && driverStates["c1-revenue"] !== false) || (challenge245Results && driverStates["c245-revenue"] !== false)) && (approvalImprovement ?? 0) > 0;
            const threeDSDecreasePct = (formData.amer3DSChallengeRate || 30) > 0
              ? Math.round(((formData.amer3DSChallengeRate || 30) - (forterKPIs.threeDSReduction ?? 0)) / (formData.amer3DSChallengeRate || 30) * 100)
              : 0;
            const show3DS = challenge245Results && driverStates["c245-revenue"] !== false && threeDSDecreasePct > 0;
            const currentCBRate = formData.fraudCBRate || 0.5;
            const bpsReduction = forterKPIs.chargebackReductionIsAbsolute
              ? Math.round((currentCBRate - (forterKPIs.chargebackReduction ?? 0)) * 100)
              : Math.round(currentCBRate * (forterKPIs.chargebackReduction ?? 50) / 100 * 100);
            const showChargeback = ((challenge1Results && driverStates["c1-chargeback"] !== false) || (challenge245Results && driverStates["c245-chargeback"] !== false)) && bpsReduction > 0;
            const manualReviewCurrent = formData.amerManualReviewRate ?? formData.manualReviewPct ?? 5;
            const manualReviewDecreasePct = manualReviewCurrent > 0
              ? Math.round(((manualReviewCurrent - (forterKPIs.manualReviewReduction ?? 0)) / manualReviewCurrent) * 100)
              : 0;
            const showManualReview = challenge3Results && driverStates["c3-review"] !== false && manualReviewDecreasePct > 0;
            const showDisputeBase = challenge7Results && driverStates["c7-disputes"] !== false;
            const showAbuse = challenge8Results && (driverStates["c8-returns"] !== false || driverStates["c8-inr"] !== false) && (forterKPIs.forterCatchRate ?? 0) > 0;
            
            const hasAnyHighlight = showApprovalRate || show3DS || showChargeback || showManualReview || showDisputeBase || showAbuse;
            
            if (!hasAnyHighlight) return null;
            
            return (
              <Card className="p-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Performance Highlights
                </h4>
                <div className="space-y-2">
                  {/* Approval Rate - only when improvement > 0 */}
                  {showApprovalRate && (
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-sm text-muted-foreground">Approval Rate with Forter</span>
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                        {challenge245Results 
                          ? forterKPIs.preAuthApprovalImprovement 
                          : forterKPIs.approvalRateImprovement}%
                      </Badge>
                    </div>
                  )}
                  {/* Increased Payments Conversions - completion rate uplift as % (not %pts) */}
                  {showApprovalRate && (() => {
                    let custCompletionRate: number;
                    let fortCompletionRate: number;
                    
                    if (challenge245Results) {
                      // For Challenge 245, calculate from pre-auth, 3DS, bank decline, and post-auth
                      const transactionAttempts = formData.amerGrossAttempts || 0;
                      const preAuthRate = (formData.amerPreAuthApprovalRate || 95) / 100;
                      const postAuthRate = (formData.amerPostAuthApprovalRate || 98) / 100;
                      const ccPct = (formData.amerCreditCardPct || 80) / 100;
                      const threeDSPct = (formData.amer3DSChallengeRate ?? 50) / 100;
                      const threeDSFail = (formData.amer3DSAbandonmentRate ?? 15) / 100;
                      const bankDecline = (formData.amerIssuingBankDeclineRate || 15) / 100;
                      
                      // Customer completion calculation
                      const custPreAuth = transactionAttempts * preAuthRate;
                      const custCCTx = custPreAuth * ccPct;
                      const cust3DSTx = custCCTx * threeDSPct;
                      const cust3DSFails = cust3DSTx * threeDSFail;
                      const custToBank = custPreAuth - cust3DSFails;
                      const custBankDeclines = custToBank * bankDecline;
                      const custPostBankTx = custToBank - custBankDeclines;
                      const custFinalApproved = custPostBankTx * postAuthRate;
                      custCompletionRate = transactionAttempts > 0 ? (custFinalApproved / transactionAttempts) * 100 : 0;
                      
                      // Forter completion calculation
                      const fortPreAuthRate = Math.min(100, (formData.amerPreAuthApprovalRate || 95) + (forterKPIs.preAuthApprovalImprovement ?? 4)) / 100;
                      const fortPostAuthRate = forterKPIs.postAuthIncluded === false 
                        ? 1 
                        : Math.min(100, (formData.amerPostAuthApprovalRate || 98) + (forterKPIs.postAuthApprovalImprovement ?? 2)) / 100;
                      const fort3DSPct = Math.max(0, (formData.amer3DSChallengeRate ?? 50) - (forterKPIs.threeDSReduction ?? 20)) / 100;
                      
                      const fortPreAuth = transactionAttempts * fortPreAuthRate;
                      const fortCCTx = fortPreAuth * ccPct;
                      const fort3DSTx = fortCCTx * fort3DSPct;
                      const fort3DSFails = fort3DSTx * threeDSFail;
                      const fortToBank = fortPreAuth - fort3DSFails;
                      const fortBankDeclines = fortToBank * bankDecline;
                      const fortPostBankTx = fortToBank - fortBankDeclines;
                      const fortFinalApproved = fortPostBankTx * fortPostAuthRate;
                      fortCompletionRate = transactionAttempts > 0 ? (fortFinalApproved / transactionAttempts) * 100 : 0;
                    } else {
                      // For Challenge 1, completion rate = approval rate
                      custCompletionRate = formData.amerPreAuthApprovalRate || 95;
                      fortCompletionRate = Math.min(100, custCompletionRate + (forterKPIs.approvalRateImprovement ?? 4));
                    }
                    
                    // Calculate percentage uplift (relative change, not percentage points)
                    const percentageUplift = custCompletionRate > 0 
                      ? Math.round(((fortCompletionRate - custCompletionRate) / custCompletionRate) * 100)
                      : 0;
                    
                    if (percentageUplift <= 0) return null;
                    
                    return (
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">Increased Payments Conversions</span>
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                          +{percentageUplift}%
                        </Badge>
                      </div>
                    );
                  })()}
                  {/* 3DS Reduction - only when percentageDecrease > 0 (improvement) */}
                  {show3DS && (
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-sm text-muted-foreground">3DS Reduction</span>
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                        {threeDSDecreasePct}%
                      </Badge>
                    </div>
                  )}
                  {/* Fraud Chargeback Reduction - only when bpsReduction > 0 (improvement) */}
                  {showChargeback && (
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-sm text-muted-foreground">Fraud Chargeback Reduction</span>
                      <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400">
                        {bpsReduction}bps
                      </Badge>
                    </div>
                  )}
                  {/* Manual Review - only when percentageDecrease > 0 (improvement) */}
                  {showManualReview && (
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-sm text-muted-foreground">Manual Review Eliminated</span>
                      <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400">
                        {manualReviewDecreasePct}%
                      </Badge>
                    </div>
                  )}
                  {/* Recovery Rate - only when recoveryRateIncrease > 0 (improvement) */}
                  {showDisputeBase && challenge7Results && (() => {
                    const transactionValue = formData.amerAnnualGMV || 0;
                    const fraudCBRate = formData.fraudCBRate || 0.5;
                    const serviceCBRate = formData.serviceCBRate || 0.5;
                    const fraudDisputeRate = formData.fraudDisputeRate || 50;
                    const fraudWinRate = formData.fraudWinRate || 70;
                    const serviceDisputeRate = formData.serviceDisputeRate || 30;
                    const serviceWinRate = formData.serviceWinRate || 50;
                    const estFraudCB = transactionValue * (fraudCBRate / 100);
                    const estServiceCB = transactionValue * (serviceCBRate / 100);
                    const totalCB = estFraudCB + estServiceCB;
                    if (totalCB === 0) return null;
                    const custFraudRecoveryRate = (fraudDisputeRate / 100) * (fraudWinRate / 100);
                    const custServiceRecoveryRate = (serviceDisputeRate / 100) * (serviceWinRate / 100);
                    const fortFraudDisputeRate = Math.min(100, fraudDisputeRate + forterKPIs.fraudDisputeRateImprovement);
                    const fortFraudWinRate = Math.max(0, fraudWinRate + forterKPIs.fraudWinRateChange);
                    const fortServiceDisputeRate = Math.min(100, serviceDisputeRate + forterKPIs.serviceDisputeRateImprovement);
                    const fortServiceWinRate = Math.max(0, serviceWinRate + forterKPIs.serviceWinRateChange);
                    const fortFraudRecoveryRate = (fortFraudDisputeRate / 100) * (fortFraudWinRate / 100);
                    const fortServiceRecoveryRate = (fortServiceDisputeRate / 100) * (fortServiceWinRate / 100);
                    const fraudWeight = estFraudCB / totalCB;
                    const serviceWeight = estServiceCB / totalCB;
                    const custWeightedRecovery = (custFraudRecoveryRate * fraudWeight) + (custServiceRecoveryRate * serviceWeight);
                    const fortWeightedRecovery = (fortFraudRecoveryRate * fraudWeight) + (fortServiceRecoveryRate * serviceWeight);
                    const recoveryRateIncrease = (fortWeightedRecovery - custWeightedRecovery) * 100;
                    if (recoveryRateIncrease <= 0) return null;
                    return (
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">Recovery Rate Increase</span>
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                          +{recoveryRateIncrease.toFixed(1)}%pts
                        </Badge>
                      </div>
                    );
                  })()}
                  {/* Abuse Blocked - show when abuse driver is enabled */}
                  {showAbuse && (
                    <div className="flex justify-between items-center py-2 last:border-b-0">
                      <span className="text-sm text-muted-foreground">Abuse Blocked</span>
                      <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400">
                        -{forterKPIs.forterCatchRate}%
                      </Badge>
                    </div>
                  )}
                </div>
              </Card>
            );
          })()}

          {/* Waterfall Chart */}
          {waterfallData.length > 0 && (
            <Card className="p-4">
              <p className="text-sm font-semibold mb-3">Forter Annual EBITDA Attribution</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={waterfallData}
                    margin={{ top: 30, right: 30, left: 30, bottom: 80 }}
                    barCategoryGap="30%"
                  >
                    <XAxis
                      dataKey="name"
                      tick={(props) => {
                        const { x, y, payload } = props;
                        const lines = payload.value.split('\n');
                        return (
                          <g transform={`translate(${x},${y})`}>
                            {lines.map((line: string, i: number) => (
                              <text
                                key={i}
                                x={0}
                                y={i * 12}
                                dy={8}
                                textAnchor="middle"
                                fill="hsl(var(--foreground))"
                                fontSize={10}
                              >
                                {line}
                              </text>
                            ))}
                          </g>
                        );
                      }}
                      interval={0}
                      height={70}
                      tickLine={false}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(v) => showInMillions ? `$${(v / 1_000_000).toFixed(1)}M` : `$${Math.round(v / 1000)}K`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" />
                    {/* Invisible base bar to create floating effect */}
                    <Bar dataKey="base" stackId="stack" fill="transparent" />
                    {/* Visible value bar on top of base */}
                    <Bar dataKey="value" stackId="stack" radius={[4, 4, 0, 0]}>
                      {waterfallData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.isTotal ? "#22c55e" : "#1a1a1a"} 
                        />
                      ))}
                      <LabelList
                        dataKey="value"
                        position="top"
                        content={(props) => {
                          const { x, y, width, value, index } = props as any;
                          const entry = waterfallData[index];
                          const color = entry?.isTotal ? "#22c55e" : "#1a1a1a";
                          const formattedValue = showInMillions 
                            ? `$${(Number(value) / 1_000_000).toFixed(1)}M`
                            : `$${Math.round(Number(value)).toLocaleString()}`;
                          return (
                            <text
                              x={Number(x) + Number(width) / 2}
                              y={Number(y) - 8}
                              textAnchor="middle"
                              fill={color}
                              fontSize={12}
                              fontWeight={600}
                            >
                              {formattedValue}
                            </text>
                          );
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Calculator Pop-up Dialog */}
      <Dialog open={!!selectedCalculator} onOpenChange={() => setSelectedCalculator(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCalculator?.title}</DialogTitle>
          </DialogHeader>
          {selectedCalculator && (
            <EditableCalculatorDisplay 
              title="" 
              rows={selectedCalculator.rows}
              onCustomerFieldChange={onFormDataChange ? (field, value) => {
                onFormDataChange({ [field]: value } as Partial<CalculatorData>);
              } : undefined}
              onForterFieldChange={onForterKPIChange ? (field, value) => {
                onForterKPIChange({ [field]: value } as Partial<ForterKPIs>);
              } : undefined}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};