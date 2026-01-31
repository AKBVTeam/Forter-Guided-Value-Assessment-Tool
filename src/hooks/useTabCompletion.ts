import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { CalculatorData } from "@/pages/Index";
import { ValueTotals } from "@/components/calculator/ValueSummaryOptionA";

export interface TabCompletionState {
  profile: number; // 0-1 progress
  challenges: number;
  inputs: number;
  forter: number;
  summary: number;
  roi: number;
}

interface UseTabCompletionProps {
  formData: CalculatorData;
  selectedChallenges: { [key: string]: boolean };
  valueTotals?: ValueTotals;
}

/**
 * Track tab completion progress (0-1) based on:
 * - Profile: Fraction of required profile fields filled (customerName, industry, hqLocation)
 * - Use Cases: 1 if at least one challenge selected, else 0
 * - Customer Inputs: Fraction of core input fields filled
 * - Forter KPIs: Fraction of key KPI fields set
 * - Value Summary & ROI: 1 once viewed (if inputs exist), else 0
 */
export function useTabCompletion({ formData, selectedChallenges, valueTotals }: UseTabCompletionProps) {
  // Track viewed tabs (Summary/ROI complete on view)
  const [viewedTabs, setViewedTabs] = useState<Set<string>>(new Set());
  
  // Track whether report button was just unlocked (for animation)
  const [showReportAnimation, setShowReportAnimation] = useState(false);
  const wasReportUnlockedRef = useRef(false);

  const markTabViewed = useCallback((tab: string) => {
    setViewedTabs(prev => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  }, []);

  const completion = useMemo((): TabCompletionState => {
    // Profile: Count filled required fields (3 total)
    const profileFields = [
      formData.customerName?.trim(),
      formData.industry,
      formData.hqLocation,
    ];
    const profileFilled = profileFields.filter(Boolean).length;
    const profileProgress = profileFilled / 3;

    // Use Cases: Binary - at least one selected
    const challengesProgress = Object.values(selectedChallenges).some(Boolean) ? 1 : 0;

    // Customer Inputs: Count filled core input fields
    const inputFields: (keyof CalculatorData)[] = [
      'amerAnnualGMV', 'amerGrossAttempts', 'amerPreAuthApprovalRate',
      'emeaAnnualGMV', 'emeaGrossAttempts', 
      'apacAnnualGMV', 'apacGrossAttempts',
      'fraudCBRate', 'serviceCBRate', 
      'manualReviewPct', 'refundRate', 
      'monthlyLogins', 'monthlySignups',
    ];
    const inputsFilled = inputFields.filter(field => {
      const value = formData[field];
      return value !== undefined && value !== null && value !== '' && value !== 0;
    }).length;
    // Use min of 5 required fields for meaningful progress
    const inputsProgress = Math.min(inputsFilled / 5, 1);

    // Forter KPIs: Check key KPI fields (3 main ones)
    const kpiFields = [
      formData.forterKPIs?.approvalRateImprovement,
      formData.forterKPIs?.chargebackReduction,
      formData.forterKPIs?.threeDSReduction,
    ];
    const kpiFilled = kpiFields.filter(v => v !== undefined && v !== null).length;
    const forterProgress = kpiFilled / 3;

    // Summary & ROI: Complete once viewed AND data exists
    const hasData = inputsFilled > 0;
    const summaryProgress = (viewedTabs.has('summary') && hasData) ? 1 : 0;
    const roiProgress = (viewedTabs.has('roi') && hasData) ? 1 : 0;

    return {
      profile: profileProgress,
      challenges: challengesProgress,
      inputs: inputsProgress,
      forter: forterProgress,
      summary: summaryProgress,
      roi: roiProgress,
    };
  }, [formData, selectedChallenges, viewedTabs]);

  // Determine if reports can be generated based on Value Summary having values
  const canGenerateReports = useMemo(() => {
    // Report is unlocked when Value Summary has any calculated value
    const totalValue = (valueTotals?.ebitdaContribution || 0) + 
                       (valueTotals?.gmvUplift || 0) + 
                       (valueTotals?.costReduction || 0) + 
                       (valueTotals?.riskMitigation || 0);
    return totalValue > 0;
  }, [valueTotals]);
  
  // Trigger animation when report becomes unlocked
  useEffect(() => {
    if (canGenerateReports && !wasReportUnlockedRef.current) {
      wasReportUnlockedRef.current = true;
      setShowReportAnimation(true);
      
      // Stop animation after 10 seconds
      const timer = setTimeout(() => {
        setShowReportAnimation(false);
      }, 10000);
      
      return () => clearTimeout(timer);
    } else if (!canGenerateReports) {
      wasReportUnlockedRef.current = false;
      setShowReportAnimation(false);
    }
  }, [canGenerateReports]);

  return { completion, markTabViewed, canGenerateReports, showReportAnimation };
}
