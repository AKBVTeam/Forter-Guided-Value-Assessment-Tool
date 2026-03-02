import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { CalculatorData } from "@/pages/Index";
import { ValueTotals } from "@/components/calculator/ValueSummaryOptionA";
import { getRequiredInputFields } from "@/lib/csvExport";
import { getCurrencySymbol } from "@/lib/benchmarkData";

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
  /** When true, ROI tab gets full completion (1); when false but ROI viewed with data, ROI gets half (0.5). */
  hasInvestment?: boolean;
  /** When false (and hasInvestment), ROI stays at half completion until user turns "Show investment" on. */
  showInvestmentRowsOn?: boolean;
}

/**
 * Track tab completion progress (0-1) based on:
 * - Profile: Fraction of required profile fields filled (customerName, industry, hqLocation)
 * - Use Cases: 1 if at least one challenge selected, else 0
 * - Customer Inputs: Fraction of core input fields filled
 * - Forter KPIs: Fraction of key KPI fields set
 * - Value Summary & ROI: 1 once viewed (if inputs exist), else 0
 */
export function useTabCompletion({ formData, selectedChallenges, valueTotals, hasInvestment = false, showInvestmentRowsOn = true }: UseTabCompletionProps) {
  // Track viewed tabs (Summary/ROI complete on view). Persist from saved analysis when _valueSummaryViewed is true.
  const [viewedTabs, setViewedTabs] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (formData._valueSummaryViewed) {
      initial.add('summary');
      initial.add('roi');
    }
    return initial;
  });

  // When opening an existing analysis with _valueSummaryViewed, keep viewedTabs in sync so tab completion persists
  useEffect(() => {
    if (formData._valueSummaryViewed) {
      setViewedTabs(prev => {
        if (prev.has('summary') && prev.has('roi')) return prev;
        const next = new Set(prev);
        next.add('summary');
        next.add('roi');
        return next;
      });
    }
  }, [formData._valueSummaryViewed]);

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

    // Customer Inputs: Use same required fields as the tab (challenge-aware) so progress shows as soon as user enters any input
    const currencySymbol = getCurrencySymbol(formData.baseCurrency || 'USD');
    const requiredInputFields = getRequiredInputFields(selectedChallenges, currencySymbol, formData.isMarketplace);
    const inputsFilled = requiredInputFields.filter(f => {
      const value = formData[f.field as keyof CalculatorData];
      return value !== undefined && value !== null && value !== '' && (typeof value !== 'number' || value !== 0);
    }).length;
    const inputsTotal = requiredInputFields.length;
    const inputsProgress = inputsTotal > 0 ? Math.min(inputsFilled / inputsTotal, 1) : 0;

    // Forter KPIs: Check key KPI fields (3 main ones)
    const kpiFields = [
      formData.forterKPIs?.approvalRateImprovement,
      formData.forterKPIs?.chargebackReduction,
      formData.forterKPIs?.threeDSReduction,
    ];
    const kpiFilled = kpiFields.filter(v => v !== undefined && v !== null).length;
    const forterProgress = kpiFilled / 3;

    // Summary & ROI: Summary progress = fraction of enabled benefit drivers with quantitative value when viewed
    // Use _valueSummaryViewed from saved analysis so tab completion tick persists when opening an existing analysis
    const hasData = inputsFilled > 0;
    const summaryViewed = viewedTabs.has('summary') || !!formData._valueSummaryViewed;
    const roiViewed = viewedTabs.has('roi') || !!formData._valueSummaryViewed;
    const summaryFraction = valueTotals?.benefitDriversQuantitativeFraction ?? 0;
    // When Value Summary was previously viewed: use actual fraction when available; otherwise if restored from
    // saved analysis (_valueSummaryViewed) treat as fully complete (1) so re-open does not reset to partial (0.5)
    const summaryProgress = summaryViewed
      ? (hasData && summaryFraction > 0 ? summaryFraction : (formData._valueSummaryViewed ? 1 : 0.5))
      : 0;
    const roiViewedWithData = roiViewed && hasData;
    const roiFullyComplete = hasInvestment && showInvestmentRowsOn;
    const roiProgress = roiViewedWithData ? (roiFullyComplete ? 1 : 0.5) : 0;

    return {
      profile: profileProgress,
      challenges: challengesProgress,
      inputs: inputsProgress,
      forter: forterProgress,
      summary: summaryProgress,
      roi: roiProgress,
    };
  }, [formData, selectedChallenges, viewedTabs, valueTotals, hasInvestment, showInvestmentRowsOn]);

  // Determine if reports can be generated based on Value Summary having values
  const canGenerateReports = useMemo(() => {
    // Report is unlocked when Value Summary has any calculated value
    const totalValue = (valueTotals?.ebitdaContribution || 0) + 
                       (valueTotals?.gmvUplift || 0) + 
                       (valueTotals?.costReduction || 0) + 
                       (valueTotals?.riskMitigation || 0);
    return totalValue > 0;
  }, [valueTotals]);
  
  // When opening an analysis that already had Value Summary viewed, remember report was unlocked (no re-highlight animation)
  useEffect(() => {
    if (formData._valueSummaryViewed) {
      wasReportUnlockedRef.current = true;
    }
  }, [formData._valueSummaryViewed]);

  // Trigger animation when report becomes unlocked (skip if restored from saved analysis)
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

  const dismissReportAnimation = useCallback(() => {
    setShowReportAnimation(false);
  }, []);

  return { completion, markTabViewed, canGenerateReports, showReportAnimation, dismissReportAnimation };
}
