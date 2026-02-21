import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { CalculatorData } from "@/pages/Index";
import { NumericInput } from "./NumericInput";
import { PercentageInput } from "./PercentageInput";
import { IncludeExcludeChip } from "./IncludeExcludeChip";
import { WeightedAverageTooltip } from "./WeightedAverageTooltip";
import { getValidationWarning } from "@/lib/inputValidation";
import { getCurrencySymbol, existingVendorBenchmarks, get3DSRateByCountryAndAOV, getExchangeRateToEUR } from "@/lib/benchmarkData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Segment, aggregateSegmentData, hasPaymentChallengesSelected } from "@/lib/segments";
import { useMemo, useEffect } from "react";
import { AlertCircle, Layers, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { calculateChallenge1, calculateChallenge245, getCompletedTransactionCount } from "@/lib/calculations";

interface ChallengeInputsProps {
  formData: CalculatorData;
  selectedChallenges: { [key: string]: boolean };
  onFieldChange: (field: keyof CalculatorData, value: any) => void;
  segmentationEnabled?: boolean;
  segments?: Segment[];
  /** List = single column; grid = current multi-column layout */
  viewMode?: 'list' | 'grid';
}

export const ChallengeInputs = ({
  formData,
  selectedChallenges,
  onFieldChange,
  segmentationEnabled = false,
  segments = [],
  viewMode = 'grid',
}: ChallengeInputsProps) => {
  const gridClass = viewMode === 'list' ? 'grid grid-cols-1 gap-4' : 'grid md:grid-cols-2 lg:grid-cols-3 gap-4';
  const fieldRowClass = viewMode === 'list' ? 'grid grid-cols-[1fr_minmax(18rem,22rem)] items-center gap-x-4 gap-y-1' : 'space-y-2';
  const fieldLabelWrapClass = viewMode === 'list' ? 'flex items-center gap-2 min-w-0' : 'flex items-center gap-2';
  const fieldLabelClass = viewMode === 'list' ? 'min-w-0' : '';
  const fieldInputClass = viewMode === 'list' ? 'justify-self-end min-w-[14rem] max-w-[16rem] text-right' : '';
  const fieldHelperClass = viewMode === 'list' ? 'col-span-2 text-xs text-muted-foreground' : 'text-xs text-muted-foreground';
  // Challenge IDs match ALL_CHALLENGES in calculations.ts
  const isChallenge1Selected = selectedChallenges['1'] === true;
  const isChallenge2Selected = selectedChallenges['2'] === true;
  const isChallenge3Selected = selectedChallenges['3'] === true;
  const isChallenge4Selected = selectedChallenges['4'] === true;
  const isChallenge5Selected = selectedChallenges['5'] === true;
  const isChallenge7Selected = selectedChallenges['7'] === true;
  const isChallenge8Selected = selectedChallenges['8'] === true;
  const isChallenge9Selected = selectedChallenges['9'] === true;
  const isChallenge10Selected = selectedChallenges['10'] === true;
  const isChallenge11Selected = selectedChallenges['11'] === true;
  const isChallenge12Selected = selectedChallenges['12'] === true;
  const isChallenge13Selected = selectedChallenges['13'] === true;
  const isChallenge14Selected = selectedChallenges['14'] === true;
  const isChallenge15Selected = selectedChallenges['15'] === true;

  // Challenges 2, 4, 5 share the same inputs
  const isChallenge245Selected = isChallenge2Selected || isChallenge4Selected || isChallenge5Selected;
  // Challenges 10, 11 share inputs (Promotion/Reseller abuse)
  const isChallenge10_11Selected = isChallenge10Selected || isChallenge11Selected;
  // Challenges 12, 13 share inputs (ATO Protection)
  const isChallenge12_13Selected = isChallenge12Selected || isChallenge13Selected;
  // Challenges 14, 15 share inputs (Sign-up Protection)
  const isChallenge14_15Selected = isChallenge14Selected || isChallenge15Selected;

  const showAnyInputs = isChallenge1Selected || isChallenge245Selected || isChallenge3Selected || 
    isChallenge7Selected || isChallenge8Selected || isChallenge9Selected || isChallenge10_11Selected || 
    isChallenge12_13Selected || isChallenge14_15Selected;

  // Determine which input sections to show based on challenges
  const showPaymentsInputs = isChallenge1Selected || isChallenge245Selected || isChallenge10_11Selected || isChallenge9Selected;
  const showChargebackInputs = isChallenge1Selected || isChallenge245Selected;
  const show3DSInputs = isChallenge245Selected;
  const showManualReviewInputs = isChallenge3Selected;
  const showDisputeInputs = isChallenge7Selected;
  const showAbuseInputs = isChallenge8Selected;
  const showPromotionAbuseInputs = isChallenge10_11Selected;
  const showInstantRefundsInputs = isChallenge9Selected;
  const showATOInputs = isChallenge12_13Selected;
  const showSignupInputs = isChallenge14_15Selected;

  // Get currency symbol for dynamic labels
  const currencySymbol = getCurrencySymbol(formData.baseCurrency || 'USD');
  
  // Check if segmentation applies to payment/fraud challenges
  const showPaymentChallenges = hasPaymentChallengesSelected(selectedChallenges);
  const isSegmentMode = segmentationEnabled && showPaymentChallenges && segments.length > 0;
  
  // Aggregate segment data for read-only display
  const aggregatedData = useMemo(() => {
    if (!isSegmentMode) return null;
    return aggregateSegmentData(segments);
  }, [isSegmentMode, segments]);

  // Get the actual fraud CB rate - use aggregated weighted average in segment mode
  const actualFraudCBRate = useMemo(() => {
    if (isSegmentMode && aggregatedData?.weightedFraudCBRate !== undefined) {
      return aggregatedData.weightedFraudCBRate;
    }
    return formData.fraudCBRate ?? 0.5;
  }, [isSegmentMode, aggregatedData?.weightedFraudCBRate, formData.fraudCBRate]);

  // Calculate the "Value of approved transactions ($)" from C1 or C245 calculator
  // This is the customer input value that should be multiplied by fraud CB rate
  const valueOfApprovedTransactions = useMemo(() => {
    // Use C1 if selected, otherwise C245 if selected
    if (isChallenge1Selected && !isChallenge245Selected) {
      // Challenge 1 calculation
      const transactionAttempts = isSegmentMode 
        ? (aggregatedData?.totalGrossAttempts || 0)
        : (formData.amerGrossAttempts || 0);
      const transactionAttemptsValue = isSegmentMode
        ? (aggregatedData?.totalAnnualGMV || 0)
        : (formData.amerAnnualGMV || 0);
      const approvalRate = isSegmentMode
        ? (aggregatedData?.weightedPreAuthApprovalRate || 95)
        : (formData.amerPreAuthApprovalRate || 95);
      const completedAOV = formData.completedAOV || (transactionAttempts > 0 ? transactionAttemptsValue / transactionAttempts : 0);
      
      const results = calculateChallenge1({
        transactionAttempts,
        transactionAttemptsValue,
        grossMarginPercent: formData.amerGrossMarginPercent || 30,
        approvalRate,
        fraudChargebackRate: actualFraudCBRate,
        completedAOV,
        forterCompletedAOV: formData.forterKPIs?.forterCompletedAOV,
        forterApprovalRateImprovement: 0,
        forterChargebackReduction: 0,
      });
      
      // Extract customer value of approved transactions from calculator rows
      const valueRow = results.calculator1.rows.find(r => r.label === 'Value of approved transactions ($)');
      if (valueRow?.rawCustomerValue !== undefined) {
        return valueRow.rawCustomerValue as number;
      }
      // Parse from customerInput if rawCustomerValue not available
      const parsed = parseFloat(valueRow?.customerInput?.replace(/[^0-9.-]/g, '') || '0');
      return isNaN(parsed) ? 0 : parsed;
    } else if (isChallenge245Selected) {
      // Challenge 2/4/5 calculation
      const transactionAttempts = isSegmentMode 
        ? (aggregatedData?.totalGrossAttempts || 0)
        : (formData.amerGrossAttempts || 0);
      const transactionAttemptsValue = isSegmentMode
        ? (aggregatedData?.totalAnnualGMV || 0)
        : (formData.amerAnnualGMV || 0);
      const preAuthApprovalRate = isSegmentMode
        ? (aggregatedData?.weightedPreAuthApprovalRate || 95)
        : (formData.amerPreAuthApprovalRate || 95);
      const postAuthApprovalRate = isSegmentMode
        ? (aggregatedData?.weightedPostAuthApprovalRate || 100)
        : (formData.amerPostAuthApprovalRate || 100);
      const completedAOV = formData.completedAOV || (transactionAttempts > 0 ? transactionAttemptsValue / transactionAttempts : 0);
      
      const results = calculateChallenge245({
        transactionAttempts,
        transactionAttemptsValue,
        grossMarginPercent: formData.amerGrossMarginPercent || 30,
        preAuthApprovalRate,
        postAuthApprovalRate,
        creditCardPct: formData.amerCreditCardPct || 100,
        creditCard3DSPct: formData.amer3DSChallengeRate || 0,
        threeDSFailureRate: formData.amer3DSAbandonmentRate || 0,
        issuingBankDeclineRate: formData.amerIssuingBankDeclineRate || 0,
        fraudChargebackRate: actualFraudCBRate,
        completedAOV,
        forterCompletedAOV: formData.forterKPIs?.forterCompletedAOV,
        forterPreAuthImprovement: 0,
        forterPostAuthImprovement: 0,
        forter3DSReduction: 0,
        forterChargebackReduction: 0,
        forterTargetCBRate: 0,
      });
      
      // Extract customer value of approved transactions from calculator rows
      const valueRow = results.calculator1.rows.find(r => r.label === 'Value of approved transactions ($)');
      if (valueRow?.rawCustomerValue !== undefined) {
        return valueRow.rawCustomerValue as number;
      }
      // Parse from customerInput if rawCustomerValue not available
      const parsed = parseFloat(valueRow?.customerInput?.replace(/[^0-9.-]/g, '') || '0');
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }, [isChallenge1Selected, isChallenge245Selected, isSegmentMode, formData, aggregatedData, actualFraudCBRate]);

  // Auto-calculate Est. Value of Fraud Chargebacks when dependencies change
  // Only if the value hasn't been manually set by the user
  // Formula: Value of approved transactions ($) × Fraud CB Rate
  useEffect(() => {
    if (!isChallenge7Selected) return;
    if (formData.estFraudChargebackValueManuallySet) return;
    
    // Use the calculated "Value of approved transactions" from C1 or C245
    const fraudCBRateDecimal = actualFraudCBRate / 100;
    const calculatedValue = valueOfApprovedTransactions * fraudCBRateDecimal;
    
    // Only update if there's a meaningful calculated value and it differs from current
    if (calculatedValue > 0 && calculatedValue !== formData.estFraudChargebackValue) {
      onFieldChange("estFraudChargebackValue", calculatedValue);
    }
  }, [isChallenge7Selected, valueOfApprovedTransactions, actualFraudCBRate, formData.estFraudChargebackValueManuallySet]);
  if (!showAnyInputs) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Please select challenges in the Challenges tab to see relevant data inputs.</p>
      </div>
    );
  }

  // For segment mode: determine if payments/fraud fields should be read-only
  const isPaymentFieldLocked = isSegmentMode && showPaymentChallenges;

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">Enter annual customer information</p>
      
      {/* Segment Mode Banner */}
      {isPaymentFieldLocked && (
        <Card className="p-4 border-primary/30 bg-primary/5">
          <div className="flex items-center gap-3">
            <Layers className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-sm">Segmented Analysis Mode</p>
              <p className={fieldHelperClass}>
                Payment and fraud inputs below are calculated via a weighted average from segment data. Edit individual segments above to change values.
              </p>
            </div>
          </div>
        </Card>
      )}
      
      {/* Payments Section - For Challenges 1, 2, 4, 5, 9, 10, 11 */}
      {showPaymentsInputs && (() => {
        // If ONLY Challenge 9 is selected (no payment funnel challenges), use "Current eCommerce Sales" labels
        const isChallenge9Standalone = isChallenge9Selected && !isChallenge1Selected && !isChallenge245Selected && !isChallenge10_11Selected;
        const volumeLabel = isChallenge9Standalone ? 'Completed Transactions (#)' : 'Transaction Attempts (#)';
        const valueLabel = isChallenge9Standalone ? `Current eCommerce Sales (${currencySymbol})` : `Transaction Attempts (${currencySymbol})`;
        
        // Use aggregated values if in segment mode
        const displayVolume = isPaymentFieldLocked 
          ? aggregatedData?.totalGrossAttempts 
          : formData.amerGrossAttempts;
        const displayGMV = isPaymentFieldLocked 
          ? aggregatedData?.totalAnnualGMV 
          : formData.amerAnnualGMV;
        const displayPreAuthRate = isPaymentFieldLocked 
          ? aggregatedData?.weightedPreAuthApprovalRate 
          : formData.amerPreAuthApprovalRate;
        const displayPostAuthRate = isPaymentFieldLocked 
          ? aggregatedData?.weightedPostAuthApprovalRate 
          : formData.amerPostAuthApprovalRate;
        
        return (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Payments</h3>
            <div className={gridClass}>
              <div className={fieldRowClass}>
                <div className={fieldLabelWrapClass}>
                  <Label className={fieldLabelClass}>{volumeLabel}</Label>
                  {isPaymentFieldLocked && (
                    <WeightedAverageTooltip
                      segments={segments}
                      fieldLabel={volumeLabel}
                      fieldKey="grossAttempts"
                      weightedValue={displayVolume}
                      isSumField={true}
                      currencySymbol={currencySymbol}
                    />
                  )}
                </div>
                <NumericInput className={fieldInputClass}
                  value={displayVolume}
                  onChange={(v) => onFieldChange("amerGrossAttempts", v)}
                  placeholder="1,000,000"
                  formatWithCommas
                  readOnly={isPaymentFieldLocked}
                />
              </div>
              <div className={fieldRowClass}>
                <div className={fieldLabelWrapClass}>
                  <Label className={fieldLabelClass}>{valueLabel}</Label>
                  {isPaymentFieldLocked && (
                    <WeightedAverageTooltip
                      segments={segments}
                      fieldLabel={valueLabel}
                      fieldKey="annualGMV"
                      weightedValue={displayGMV}
                      isSumField={true}
                      currencySymbol={currencySymbol}
                    />
                  )}
                </div>
                <NumericInput className={fieldInputClass}
                  value={displayGMV}
                  onChange={(v) => onFieldChange("amerAnnualGMV", v)}
                  placeholder={`${currencySymbol}150,000,000`}
                  formatWithCommas
                  readOnly={isPaymentFieldLocked}
                />
              </div>
            {formData.isMarketplace && (
              <div className={fieldRowClass}>
                <Label className={fieldLabelClass}>Commission / Take Rate (%)</Label>
                <PercentageInput className={fieldInputClass}
                  value={formData.commissionRate}
                  onChange={(v) => onFieldChange("commissionRate", v)}
                  warning={getValidationWarning("commissionRate", formData.commissionRate)}
                  max={100}
                  min={0}
                />
              </div>
            )}
            <div className={fieldRowClass}>
              <Label className={fieldLabelClass}>Gross Margin (%)</Label>
              <PercentageInput className={fieldInputClass}
                value={formData.amerGrossMarginPercent}
                onChange={(v) => onFieldChange("amerGrossMarginPercent", v)}
                warning={getValidationWarning("amerGrossMarginPercent", formData.amerGrossMarginPercent)}
                max={100}
                min={0}
              />
            </div>
            
            {/* Completed AOV - only show when payment funnel challenges are selected */}
            {(isChallenge1Selected || isChallenge245Selected) && (() => {
              // In segment mode, use weighted average; otherwise calculate from global inputs
              const gmv = displayGMV || 0;
              const attempts = displayVolume || 0;
              const calculatedAOV = attempts > 0 ? gmv / attempts : 0;
              
              // When segmentation enabled, prefer the weighted average from aggregated segments
              const displayAOV = isPaymentFieldLocked 
                ? (aggregatedData?.weightedCompletedAOV ?? calculatedAOV)
                : (formData.completedAOV ?? calculatedAOV);
              
              const isOverridden = !isPaymentFieldLocked && formData.completedAOV !== undefined && formData.completedAOV !== calculatedAOV;
              
              return (
                <div className={fieldRowClass}>
                  <div className={fieldLabelWrapClass}>
                    <Label className={fieldLabelClass}>Completed AOV ({currencySymbol})</Label>
                    {isPaymentFieldLocked && (
                      <WeightedAverageTooltip
                        segments={segments}
                        fieldLabel="Completed AOV"
                        fieldKey="completedAOV"
                        weightedValue={aggregatedData?.weightedCompletedAOV}
                        currencySymbol={currencySymbol}
                      />
                    )}
                    {isOverridden && !isPaymentFieldLocked && (
                      <button
                        onClick={() => onFieldChange("completedAOV", undefined)}
                        className="text-xs text-primary hover:underline"
                      >
                        Reset to default
                      </button>
                    )}
                  </div>
                  <NumericInput className={fieldInputClass}
                    value={displayAOV}
                    onChange={(v) => onFieldChange("completedAOV", v)}
                    placeholder={calculatedAOV > 0 ? `${currencySymbol}${calculatedAOV.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : `${currencySymbol}150`}
                    formatWithCommas
                    readOnly={isPaymentFieldLocked}
                  />
                  <p className={fieldHelperClass}>
                    {isPaymentFieldLocked ? 'Weighted average from segments' : `Used for "Value of approved transactions".`}
                    {!isPaymentFieldLocked && calculatedAOV > 0 && !isOverridden && ` Defaults to ${currencySymbol}${calculatedAOV.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
                  </p>
                </div>
              );
            })()}

            {/* Challenge 1: Simple approval rate */}
            {isChallenge1Selected && !isChallenge245Selected && (
              <div className={fieldRowClass}>
                <div className={fieldLabelWrapClass}>
                  <Label className={fieldLabelClass}>Fraud Approval Rate - Volume (%)</Label>
                  {isPaymentFieldLocked && (
                    <WeightedAverageTooltip
                      segments={segments}
                      fieldLabel="Fraud Approval Rate"
                      fieldKey="preAuthApprovalRate"
                      weightedValue={displayPreAuthRate}
                      currencySymbol={currencySymbol}
                    />
                  )}
                </div>
                <PercentageInput className={fieldInputClass}
                  value={displayPreAuthRate}
                  onChange={(v) => onFieldChange("amerPreAuthApprovalRate", v)}
                  warning={!isPaymentFieldLocked ? getValidationWarning("amerPreAuthApprovalRate", formData.amerPreAuthApprovalRate) : null}
                  max={100}
                  min={0}
                  readOnly={isPaymentFieldLocked}
                />
              </div>
            )}

            {/* Challenges 2, 4, 5: Pre/Post auth approval rates */}
            {isChallenge245Selected && (
              <>
                <div className={fieldRowClass}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Label className={`min-w-0 ${fieldLabelClass}`.trim()}>Pre-Auth Fraud Approval Rate (%)</Label>
                      {isPaymentFieldLocked && (
                        <WeightedAverageTooltip
                          segments={segments}
                          fieldLabel="Pre-Auth Fraud Approval Rate"
                          fieldKey="preAuthApprovalRate"
                          weightedValue={displayPreAuthRate}
                          currencySymbol={currencySymbol}
                        />
                      )}
                      {!isPaymentFieldLocked && (
                        <IncludeExcludeChip
                          included={formData.amerPreAuthImplemented !== false}
                          onIncludedChange={(included) => {
                            onFieldChange("amerPreAuthImplemented", included);
                            if (!included) {
                              onFieldChange("amerPreAuthApprovalRate", 100);
                            }
                          }}
                        />
                      )}
                    </div>
                  </div>
                  <PercentageInput className={fieldInputClass}
                    value={isPaymentFieldLocked ? displayPreAuthRate : (formData.amerPreAuthImplemented === false ? 100 : formData.amerPreAuthApprovalRate)}
                    onChange={(v) => onFieldChange("amerPreAuthApprovalRate", v)}
                    readOnly={isPaymentFieldLocked}
                    disabled={!isPaymentFieldLocked && formData.amerPreAuthImplemented === false}
                    warning={!isPaymentFieldLocked && formData.amerPreAuthImplemented !== false ? getValidationWarning("amerPreAuthApprovalRate", formData.amerPreAuthApprovalRate) : null}
                    max={100}
                    min={0}
                  />
                </div>
                <div className={fieldRowClass}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Label className={`min-w-0 ${fieldLabelClass}`.trim()}>Post-Auth Fraud Approval Rate (%)</Label>
                      {isPaymentFieldLocked && (
                        <WeightedAverageTooltip
                          segments={segments}
                          fieldLabel="Post-Auth Fraud Approval Rate"
                          fieldKey="postAuthApprovalRate"
                          weightedValue={displayPostAuthRate}
                          currencySymbol={currencySymbol}
                        />
                      )}
                      {!isPaymentFieldLocked && (
                        <IncludeExcludeChip
                          included={formData.amerPostAuthImplemented !== false}
                          onIncludedChange={(included) => {
                            onFieldChange("amerPostAuthImplemented", included);
                            if (!included) {
                              onFieldChange("amerPostAuthApprovalRate", 100);
                            }
                          }}
                        />
                      )}
                    </div>
                  </div>
                  <PercentageInput className={fieldInputClass}
                    value={isPaymentFieldLocked ? displayPostAuthRate : (formData.amerPostAuthImplemented === false ? 100 : formData.amerPostAuthApprovalRate)}
                    onChange={(v) => onFieldChange("amerPostAuthApprovalRate", v)}
                    readOnly={isPaymentFieldLocked}
                    disabled={!isPaymentFieldLocked && formData.amerPostAuthImplemented === false}
                    warning={!isPaymentFieldLocked && formData.amerPostAuthImplemented !== false ? getValidationWarning("amerPostAuthApprovalRate", formData.amerPostAuthApprovalRate) : null}
                    max={100}
                    min={0}
                  />
                </div>
              </>
            )}
          </div>
        </Card>
        );
      })()}

      {/* 3DS Section - For Challenges 2, 4, 5 */}
      {show3DSInputs && (() => {
        // Calculate recommended 3DS rate based on country and AOV
        const gmv = formData.amerAnnualGMV || 0;
        const attempts = formData.amerGrossAttempts || 0;
        const aov = attempts > 0 ? gmv / attempts : 0;
        const country = formData.hqLocation || '';
        const baseCurrency = formData.baseCurrency || 'USD';
        
        // Get 3DS recommendation with EUR conversion
        const threeDSRecommendation = country && aov > 0 
          ? get3DSRateByCountryAndAOV(country, aov, baseCurrency) 
          : null;
        
        // Format AOV in EUR (3DS bands are always in EUR)
        const aovInEUR = threeDSRecommendation?.aovInEUR ?? 0;
        const formattedAOVEUR = aovInEUR > 0 
          ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(aovInEUR)
          : null;
        
        // Show exchange rate if not already in EUR
        const isNotEUR = baseCurrency !== 'EUR';
        const exchangeRate = isNotEUR ? getExchangeRateToEUR(baseCurrency) : null;
        
        return (
          <Card className="p-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-lg font-semibold min-w-0">3DS Configuration</h3>
                {formattedAOVEUR && (
                  <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                    AOV: {formattedAOVEUR}
                    {isNotEUR && exchangeRate && (
                      <span className="ml-1 text-muted-foreground/70">
                        (1 {baseCurrency} = {exchangeRate.toFixed(4)} EUR)
                      </span>
                    )}
                  </span>
                )}
                {/* Hide suggested target when segmentation is enabled - multiple regions may have different 3DS requirements */}
                {threeDSRecommendation && !segmentationEnabled && (
                  <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                    Suggested target: {threeDSRecommendation.rate}% ({threeDSRecommendation.reason})
                  </span>
                )}
              </div>
              {!isPaymentFieldLocked && (
                <IncludeExcludeChip
                  included={formData.amer3DSImplemented !== false}
                  onIncludedChange={(included) => {
                    onFieldChange("amer3DSImplemented", included);
                    if (!included) {
                      onFieldChange("amer3DSChallengeRate", 0);
                      onFieldChange("amer3DSAbandonmentRate", 0);
                    }
                  }}
                />
              )}
            </div>
            <div className={gridClass}>
              <div className={fieldRowClass}>
                <div className={fieldLabelWrapClass}>
                  <Label className={fieldLabelClass}>% of Transactions that are Credit Cards (%)</Label>
                  {isPaymentFieldLocked && (
                    <WeightedAverageTooltip
                      segments={segments}
                      fieldLabel="Credit Card %"
                      fieldKey="creditCardPct"
                      weightedValue={aggregatedData?.weightedCreditCardPct}
                      currencySymbol={currencySymbol}
                    />
                  )}
                </div>
                <PercentageInput className={fieldInputClass}
                  value={isPaymentFieldLocked ? aggregatedData?.weightedCreditCardPct : formData.amerCreditCardPct}
                  onChange={(v) => onFieldChange("amerCreditCardPct", v)}
                  warning={!isPaymentFieldLocked ? getValidationWarning("amerCreditCardPct", formData.amerCreditCardPct) : null}
                  max={100}
                  min={0}
                  readOnly={isPaymentFieldLocked}
                />
              </div>
              <div className={fieldRowClass}>
                <div className={fieldLabelWrapClass}>
                  <Label className={`${formData.amer3DSImplemented === false && !isPaymentFieldLocked ? "text-muted-foreground" : ""} ${fieldLabelClass}`.trim()}>
                    Challenge 3DS Rate (%)
                  </Label>
                  {isPaymentFieldLocked && (
                    <WeightedAverageTooltip
                      segments={segments}
                      fieldLabel="Challenge 3DS Rate"
                      fieldKey="threeDSChallengeRate"
                      weightedValue={aggregatedData?.weighted3DSChallengeRate}
                      currencySymbol={currencySymbol}
                    />
                  )}
                </div>
                <PercentageInput className={fieldInputClass}
                  value={isPaymentFieldLocked ? aggregatedData?.weighted3DSChallengeRate : formData.amer3DSChallengeRate}
                  onChange={(v) => onFieldChange("amer3DSChallengeRate", v)}
                  readOnly={isPaymentFieldLocked}
                  disabled={!isPaymentFieldLocked && formData.amer3DSImplemented === false}
                  warning={!isPaymentFieldLocked && formData.amer3DSImplemented !== false ? getValidationWarning("amer3DSChallengeRate", formData.amer3DSChallengeRate) : null}
                  max={100}
                  min={0}
                />
              </div>
              <div className={fieldRowClass}>
                <div className={fieldLabelWrapClass}>
                  <Label className={`${formData.amer3DSImplemented === false && !isPaymentFieldLocked ? "text-muted-foreground" : ""} ${fieldLabelClass}`.trim()}>
                    3DS Failure & Abandonment Rate (%)
                  </Label>
                  {isPaymentFieldLocked && (
                    <WeightedAverageTooltip
                      segments={segments}
                      fieldLabel="3DS Abandonment Rate"
                      fieldKey="threeDSAbandonmentRate"
                      weightedValue={aggregatedData?.weighted3DSAbandonmentRate}
                      currencySymbol={currencySymbol}
                    />
                  )}
                </div>
                <PercentageInput className={fieldInputClass}
                  value={isPaymentFieldLocked ? aggregatedData?.weighted3DSAbandonmentRate : formData.amer3DSAbandonmentRate}
                  onChange={(v) => onFieldChange("amer3DSAbandonmentRate", typeof v === 'number' ? Math.max(0, Math.min(100, v)) : v)}
                  readOnly={isPaymentFieldLocked}
                  disabled={!isPaymentFieldLocked && formData.amer3DSImplemented === false}
                  warning={!isPaymentFieldLocked && formData.amer3DSImplemented !== false ? getValidationWarning("amer3DSAbandonmentRate", formData.amer3DSAbandonmentRate) : null}
                  max={100}
                  min={0}
                />
              </div>
              <div className={fieldRowClass}>
                <div className={fieldLabelWrapClass}>
                  <Label className={fieldLabelClass}>Issuing Bank Decline Rate (%)</Label>
                  {isPaymentFieldLocked && (
                    <WeightedAverageTooltip
                      segments={segments}
                      fieldLabel="Issuing Bank Decline Rate"
                      fieldKey="issuingBankDeclineRate"
                      weightedValue={aggregatedData?.weightedIssuingBankDeclineRate}
                      currencySymbol={currencySymbol}
                    />
                  )}
                </div>
                <PercentageInput className={fieldInputClass}
                  value={isPaymentFieldLocked ? aggregatedData?.weightedIssuingBankDeclineRate : formData.amerIssuingBankDeclineRate}
                  onChange={(v) => onFieldChange("amerIssuingBankDeclineRate", typeof v === 'number' ? Math.max(0, Math.min(100, v)) : v)}
                  warning={!isPaymentFieldLocked ? getValidationWarning("amerIssuingBankDeclineRate", formData.amerIssuingBankDeclineRate) : null}
                  max={100}
                  min={0}
                  readOnly={isPaymentFieldLocked}
                />
              </div>
            </div>
          </Card>
        );
      })()}

      {/* Chargebacks Section - For Challenges 1, 2, 4, 5, 7 */}
      {showChargebackInputs && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Chargebacks</h3>
          <div className={gridClass}>
            <div className={fieldRowClass}>
              <Label className={fieldLabelClass}>Existing Fraud Vendor</Label>
              <div className={fieldInputClass}>
                <Select
                  value={formData.existingFraudVendor || "No existing vendor"}
                  onValueChange={(v) => onFieldChange("existingFraudVendor", v)}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select vendor..." />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {existingVendorBenchmarks.map((vendor) => (
                      <SelectItem key={vendor.name} value={vendor.name} textValue={vendor.name}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className={fieldHelperClass}>
                Adjusts Target Fraud CB Rate based on vendor performance
              </p>
            </div>
            <div className={fieldRowClass}>
              <div className={fieldLabelWrapClass}>
                <Label className={fieldLabelClass}>Gross Fraud Chargeback Rate (%)</Label>
                {isPaymentFieldLocked && (
                  <WeightedAverageTooltip
                    segments={segments}
                    fieldLabel="Fraud CB Rate"
                    fieldKey="fraudCBRate"
                    weightedValue={aggregatedData?.weightedFraudCBRate}
                    currencySymbol={currencySymbol}
                  />
                )}
              </div>
              <PercentageInput className={fieldInputClass}
                value={isPaymentFieldLocked ? aggregatedData?.weightedFraudCBRate : formData.fraudCBRate}
                onChange={(v) => onFieldChange("fraudCBRate", v)}
                warning={!isPaymentFieldLocked ? getValidationWarning("fraudCBRate", formData.fraudCBRate) : null}
                max={10}
                min={0}
                step={0.01}
                readOnly={isPaymentFieldLocked}
              />
            </div>
            {(isChallenge1Selected || isChallenge245Selected) && (() => {
              // Default Fraud Chargeback AOV to Completed AOV
              const gmv = isPaymentFieldLocked ? (aggregatedData?.totalAnnualGMV || 0) : (formData.amerAnnualGMV || 0);
              const attempts = isPaymentFieldLocked ? (aggregatedData?.totalGrossAttempts || 0) : (formData.amerGrossAttempts || 0);
              const defaultCompletedAOV = attempts > 0 ? gmv / attempts : 0;
              const effectiveCompletedAOV = formData.completedAOV ?? defaultCompletedAOV;
              const defaultFraudCBAOV = effectiveCompletedAOV > 0 ? effectiveCompletedAOV : 150;
              
              // When segmentation enabled, show weighted average from segments
              const displayValue = isPaymentFieldLocked 
                ? (aggregatedData?.averageFraudCBAOV ?? defaultFraudCBAOV)
                : (formData.fraudCBAOV ?? defaultFraudCBAOV);
              const isOverridden = !isPaymentFieldLocked && formData.fraudCBAOV !== undefined && formData.fraudCBAOV !== defaultFraudCBAOV;
              
              return (
                <div className={fieldRowClass}>
                  <div className={fieldLabelWrapClass}>
                    <Label className={fieldLabelClass}>Fraud Chargeback AOV ({currencySymbol})</Label>
                    {isPaymentFieldLocked && (
                      <WeightedAverageTooltip
                        segments={segments}
                        fieldLabel="Fraud CB AOV"
                        fieldKey="fraudCBAOV"
                        weightedValue={aggregatedData?.averageFraudCBAOV}
                        isSumField={false}
                        currencySymbol={currencySymbol}
                      />
                    )}
                    {isOverridden && !isPaymentFieldLocked && (
                      <button
                        onClick={() => onFieldChange("fraudCBAOV", undefined)}
                        className="text-xs text-primary hover:underline"
                      >
                        Reset to default
                      </button>
                    )}
                  </div>
                  <NumericInput className={fieldInputClass}
                    value={displayValue}
                    onChange={(v) => onFieldChange("fraudCBAOV", v)}
                    placeholder={`${currencySymbol}${Math.round(defaultFraudCBAOV).toLocaleString()}`}
                    formatWithCommas
                    readOnly={isPaymentFieldLocked}
                  />
                  {isPaymentFieldLocked && (
                    <p className={fieldHelperClass}>
                      Collected per segment
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        </Card>
      )}

      {/* Manual Review Section - For Challenge 3 */}
      {showManualReviewInputs && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Manual Review</h3>
          <div className={gridClass}>
            <div className={fieldRowClass}>
              <Label className={fieldLabelClass}>Transaction Attempts (#)</Label>
              <NumericInput className={fieldInputClass}
                value={formData.amerGrossAttempts}
                onChange={(v) => onFieldChange("amerGrossAttempts", v)}
                placeholder="1,000,000"
                formatWithCommas
              />
            </div>
            <div className={fieldRowClass}>
              <Label className={fieldLabelClass}>% of Transactions to Manual Review (%)</Label>
              <PercentageInput className={fieldInputClass}
                value={formData.manualReviewPct}
                onChange={(v) => onFieldChange("manualReviewPct", v)}
                warning={getValidationWarning("manualReviewPct", formData.manualReviewPct)}
                max={100}
                min={0}
              />
            </div>
            <div className={fieldRowClass}>
              <Label className={fieldLabelClass}>Time to Review a TX (minutes)</Label>
              <NumericInput className={fieldInputClass}
                value={formData.timePerReview}
                onChange={(v) => onFieldChange("timePerReview", v)}
                placeholder="10"
              />
            </div>
            <div className={fieldRowClass}>
              <Label className={fieldLabelClass}>Hourly Cost per Reviewer ({currencySymbol})</Label>
              <NumericInput className={fieldInputClass}
                value={formData.hourlyReviewerCost}
                onChange={(v) => onFieldChange("hourlyReviewerCost", v)}
                placeholder="15"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Dispute Section - For Challenge 7 */}
      {showDisputeInputs && (() => {
        // Use the "Value of approved transactions ($)" from C1 or C245 calculator
        // and multiply by the fraud chargeback rate
        const fraudCBRateDecimal = actualFraudCBRate / 100;
        const calculatedFraudCBValue = valueOfApprovedTransactions * fraudCBRateDecimal;
        
        // Use calculated value if not manually set, otherwise use the form value
        const displayFraudCBValue = formData.estFraudChargebackValueManuallySet 
          ? formData.estFraudChargebackValue 
          : (formData.estFraudChargebackValue ?? calculatedFraudCBValue);
        
        // Auto-populate the fraud chargeback value on first load or when dependencies change
        // Only if the user hasn't manually set it
        const handleFraudCBValueChange = (v: number | undefined) => {
          onFieldChange("estFraudChargebackValue", v);
          onFieldChange("estFraudChargebackValueManuallySet", true);
        };
        
        return (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Chargeback Disputes</h3>
            <div className="space-y-6">
              {/* Fraud Chargebacks */}
              <div>
                <h4 className="text-md font-medium mb-3">Fraud Chargebacks</h4>
                <div className={gridClass}>
                  {/* Always use direct value input for fraud chargebacks */}
                  <div className={fieldRowClass}>
                    <div className={fieldLabelWrapClass}>
                      <Label className={fieldLabelClass}>Est. Value of Fraud Chargebacks ({currencySymbol})</Label>
                      {/* Show info icon with calculation breakdown when auto-calculated */}
                      {!formData.estFraudChargebackValueManuallySet && valueOfApprovedTransactions > 0 && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <div className="space-y-1 text-sm">
                                <p className="font-medium">Auto-calculated:</p>
                                <p>Value of approved transactions × Fraud CB Rate</p>
                                <p className="text-muted-foreground">
                                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: formData.baseCurrency || 'USD', maximumFractionDigits: 0 }).format(valueOfApprovedTransactions)} × {actualFraudCBRate.toFixed(2)}%
                                </p>
                                <p className="font-medium text-primary">
                                  = {new Intl.NumberFormat('en-US', { style: 'currency', currency: formData.baseCurrency || 'USD', maximumFractionDigits: 0 }).format(calculatedFraudCBValue)}
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {/* Show reset button when manually set */}
                      {formData.estFraudChargebackValueManuallySet && (
                        <button
                          onClick={() => {
                            onFieldChange("estFraudChargebackValueManuallySet", false);
                            onFieldChange("estFraudChargebackValue", calculatedFraudCBValue);
                          }}
                          className="text-xs text-primary hover:underline"
                        >
                          Reset to calculated
                        </button>
                      )}
                    </div>
                    <NumericInput className={fieldInputClass}
                      value={displayFraudCBValue}
                      onChange={handleFraudCBValueChange}
                      placeholder="750,000"
                      formatWithCommas
                    />
                  </div>
                  <div className={fieldRowClass}>
                    <Label className={fieldLabelClass}>Fraud Dispute Rate - Value (%)</Label>
                    <PercentageInput className={fieldInputClass}
                      value={formData.fraudDisputeRate}
                      onChange={(v) => onFieldChange("fraudDisputeRate", v)}
                      warning={getValidationWarning("fraudDisputeRate", formData.fraudDisputeRate)}
                      max={100}
                      min={0}
                    />
                  </div>
                  <div className={fieldRowClass}>
                    <Label className={fieldLabelClass}>Fraud Win Rate - Value (%)</Label>
                    <PercentageInput className={fieldInputClass}
                      value={formData.fraudWinRate}
                      onChange={(v) => onFieldChange("fraudWinRate", v)}
                      warning={getValidationWarning("fraudWinRate", formData.fraudWinRate)}
                      max={100}
                      min={0}
                    />
                  </div>
                </div>
              </div>

              {/* Service Chargebacks */}
              <div>
                <h4 className="text-md font-medium mb-3">Service Chargebacks</h4>
                <div className={gridClass}>
                  {/* Always use direct value input for service chargebacks */}
                  <div className={fieldRowClass}>
                    <Label className={fieldLabelClass}>Est. Value of Service Chargebacks ({currencySymbol})</Label>
                    <NumericInput className={fieldInputClass}
                      value={formData.estServiceChargebackValue}
                      onChange={(v) => onFieldChange("estServiceChargebackValue", v)}
                      placeholder="300,000"
                      formatWithCommas
                    />
                  </div>
                  <div className={fieldRowClass}>
                    <Label className={fieldLabelClass}>Service Dispute Rate - Value (%)</Label>
                    <PercentageInput className={fieldInputClass}
                      value={formData.serviceDisputeRate}
                      onChange={(v) => onFieldChange("serviceDisputeRate", v)}
                      warning={getValidationWarning("serviceDisputeRate", formData.serviceDisputeRate)}
                      max={100}
                      min={0}
                    />
                  </div>
                  <div className={fieldRowClass}>
                    <Label className={fieldLabelClass}>Service Win Rate - Value (%)</Label>
                    <PercentageInput className={fieldInputClass}
                      value={formData.serviceWinRate}
                      onChange={(v) => onFieldChange("serviceWinRate", v)}
                      warning={getValidationWarning("serviceWinRate", formData.serviceWinRate)}
                      max={100}
                      min={0}
                    />
                  </div>
                </div>
              </div>

              {/* Improve recovery efficiency (OpEx) */}
              <div>
                <h4 className="text-md font-medium mb-3">Improve Recovery Efficiency (OpEx)</h4>
                <div className={gridClass}>
                  <div className={fieldRowClass}>
                    <Label className={fieldLabelClass}>Avg. Time to Review CB (mins)</Label>
                    <NumericInput className={fieldInputClass}
                      value={formData.avgTimeToReviewCB}
                      onChange={(v) => onFieldChange("avgTimeToReviewCB", v)}
                      placeholder="20"
                    />
                  </div>
                  <div className={fieldRowClass}>
                    <Label className={fieldLabelClass}>Number of Annual CB Disputes</Label>
                    <NumericInput className={fieldInputClass}
                      value={formData.annualCBDisputes}
                      onChange={(v) => onFieldChange("annualCBDisputes", v)}
                      placeholder="7,439"
                      formatWithCommas
                    />
                  </div>
                  <div className={fieldRowClass}>
                    <Label className={fieldLabelClass}>Cost per Hour of Analyst ({currencySymbol})</Label>
                    <NumericInput className={fieldInputClass}
                      value={formData.costPerHourAnalyst}
                      onChange={(v) => onFieldChange("costPerHourAnalyst", v)}
                      placeholder="19.23"
                      decimalPlaces={2}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        );
      })()}

      {/* Abuse Prevention Section - For Challenge 8 */}
      {showAbuseInputs && (() => {
        // Completed transactions = Transaction attempts × Completion rate (same logic as payments calculator; full funnel for 245, approval for 1)
        const completedTransactions = getCompletedTransactionCount(formData, isChallenge1Selected, isChallenge245Selected);
        return (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Policy Abuse Prevention</h3>
          <div className="space-y-6">
            {/* General */}
            <div>
              <h4 className="text-md font-medium mb-3">Refund Data</h4>
              <div className={gridClass}>
                {/* Only show Refund Rate if other challenges provide the payments data */}
                {showPaymentsInputs && (
                  <div className={fieldRowClass}>
                    <Label className={fieldLabelClass}>Refund Rate on Completed Transactions (%)</Label>
                    <PercentageInput className={fieldInputClass}
                      value={formData.refundRate}
                      onChange={(v) => {
                        onFieldChange("refundRate", v);
                        // Bi-directional: Expected Refund volume = Transaction attempts × Completion rate × Refund rate
                        if (completedTransactions > 0) {
                          const expectedVolume = Math.round(completedTransactions * (v / 100));
                          onFieldChange("expectedRefundsVolume", expectedVolume);
                        }
                      }}
                      warning={getValidationWarning("refundRate", formData.refundRate)}
                      max={100}
                      min={0}
                    />
                  </div>
                )}
                <div className={fieldRowClass}>
                  <div className="flex items-center gap-1.5">
                    <Label className={fieldLabelClass}>Expected Refunds - Volume (#)</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex text-muted-foreground cursor-help" aria-label="Calculation breakdown">
                          <Info className="w-4 h-4" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="font-medium mb-1">Expected Refund volume</p>
                        <p className="text-sm">Transaction attempts (volume) × Current completion rate (%) × Refund rate (%). Editable here or via Refund rate; values stay in sync.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <NumericInput className={fieldInputClass}
                    value={formData.expectedRefundsVolume}
                    onChange={(v) => {
                      onFieldChange("expectedRefundsVolume", v);
                      // Bi-directional: refund rate = Expected Refund volume / (Transaction attempts × Completion rate)
                      if (completedTransactions > 0 && v > 0) {
                        const rate = (v / completedTransactions) * 100;
                        onFieldChange("refundRate", Math.round(rate * 100) / 100);
                      }
                    }}
                    placeholder="148,774"
                    formatWithCommas
                  />
                  <p className={fieldHelperClass}>Linked with refund rate</p>
                </div>
                <div className={fieldRowClass}>
                  <Label className={fieldLabelClass}>Average Refunds Value ({currencySymbol})</Label>
                  <NumericInput className={fieldInputClass}
                    value={formData.avgRefundValue}
                    onChange={(v) => onFieldChange("avgRefundValue", v)}
                    placeholder="150"
                    formatWithCommas
                  />
                </div>
                {formData.isMarketplace && (
                  <div className={fieldRowClass}>
                    <Label className={fieldLabelClass}>Commission (%)</Label>
                    <PercentageInput className={fieldInputClass}
                      value={formData.commissionRate}
                      onChange={(v) => onFieldChange("commissionRate", v)}
                      warning={getValidationWarning("commissionRate", formData.commissionRate)}
                      max={100}
                      min={0}
                    />
                  </div>
                )}
                <div className={fieldRowClass}>
                  <Label className={fieldLabelClass}>Gross Margin (%)</Label>
                  <PercentageInput className={fieldInputClass}
                    value={formData.amerGrossMarginPercent}
                    onChange={(v) => onFieldChange("amerGrossMarginPercent", v)}
                    warning={getValidationWarning("amerGrossMarginPercent", formData.amerGrossMarginPercent)}
                    max={100}
                    min={0}
                  />
                </div>
              </div>
            </div>

            {/* Operational Inputs */}
            <div>
              <h4 className="text-md font-medium mb-3">Operational Inputs</h4>
              <div className={gridClass}>
                <div className={fieldRowClass}>
                  <Label className={fieldLabelClass}>Avg. 1-Way Shipping Cost ({currencySymbol})</Label>
                  <NumericInput className={fieldInputClass}
                    value={formData.avgOneWayShipping}
                    onChange={(v) => onFieldChange("avgOneWayShipping", v)}
                    placeholder="4.00"
                  />
                </div>
                <div className={fieldRowClass}>
                  <Label className={fieldLabelClass}>Avg. Unit Fulfilment Cost ({currencySymbol})</Label>
                  <NumericInput className={fieldInputClass}
                    value={formData.avgFulfilmentCost}
                    onChange={(v) => onFieldChange("avgFulfilmentCost", v)}
                    placeholder="1.50"
                  />
                </div>
                <div className={fieldRowClass}>
                  <Label className={fieldLabelClass}>TX Processing Fees (%)</Label>
                  <PercentageInput className={fieldInputClass}
                    value={formData.txProcessingFeePct}
                    onChange={(v) => onFieldChange("txProcessingFeePct", v)}
                    warning={getValidationWarning("txProcessingFeePct", formData.txProcessingFeePct)}
                    max={100}
                    min={0}
                    step={0.1}
                  />
                </div>
                <div className={fieldRowClass}>
                  <Label className={fieldLabelClass}>Avg. CS Ticket Cost ({currencySymbol})</Label>
                  <NumericInput className={fieldInputClass}
                    value={formData.avgCSTicketCost}
                    onChange={(v) => onFieldChange("avgCSTicketCost", v)}
                    placeholder="5.00"
                  />
                </div>
              </div>
            </div>

            {/* Refund Replacement Assumptions */}
            <div>
              <h4 className="text-md font-medium mb-3">Refund Replacement Assumptions</h4>
              <div className={gridClass}>
                <div className={fieldRowClass}>
                  <Label className={fieldLabelClass}>% of Refund Requests that are INR</Label>
                  <PercentageInput className={fieldInputClass}
                    value={formData.pctINRClaims}
                    onChange={(v) => onFieldChange("pctINRClaims", v)}
                    warning={getValidationWarning("pctINRClaims", formData.pctINRClaims)}
                    max={100}
                    min={0}
                  />
                </div>
                <div className={fieldRowClass}>
                  <Label className={fieldLabelClass}>% Credit or Item Replaced</Label>
                  <PercentageInput className={fieldInputClass}
                    value={formData.pctReplacedCredits}
                    onChange={(v) => onFieldChange("pctReplacedCredits", v)}
                    warning={getValidationWarning("pctReplacedCredits", formData.pctReplacedCredits)}
                    max={100}
                    min={0}
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>
        );
      })()}

      {/* Promotions Abuse Section - For Challenge 10/11 */}
      {showPromotionAbuseInputs && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">
            {isChallenge11Selected && !isChallenge10Selected 
              ? 'Reseller/Reshipper Prevention' 
              : 'Promotions Abuse Prevention'}
          </h3>
          <div className="space-y-6">
            <div>
              <h4 className="text-md font-medium mb-3">Promotion Abuse Data</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Note: GMV, Commission/Take Rate, and Gross Margin are configured in the Payments section above.
              </p>
              <div className={gridClass}>
                <div className={fieldRowClass}>
                  <Label className={fieldLabelClass}>Average Discount Achieved by Abusers (%)</Label>
                  <PercentageInput className={fieldInputClass}
                    value={formData.avgDiscountByAbusers}
                    onChange={(v) => onFieldChange("avgDiscountByAbusers", v)}
                    warning={getValidationWarning("avgDiscountByAbusers", formData.avgDiscountByAbusers)}
                    max={100}
                    min={0}
                  />
                </div>
                <div className={fieldRowClass}>
                  <Label className={fieldLabelClass}>Estimated Promotion Abuse Catch Rate Today (%)</Label>
                  <PercentageInput className={fieldInputClass}
                    value={formData.promotionAbuseCatchRateToday}
                    onChange={(v) => onFieldChange("promotionAbuseCatchRateToday", v)}
                    warning={getValidationWarning("promotionAbuseCatchRateToday", formData.promotionAbuseCatchRateToday)}
                    max={100}
                    min={0}
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Instant Refunds Section - For Challenge 9 */}
      {showInstantRefundsInputs && (() => {
        // Completed transactions = Transaction attempts × Completion rate (same as payments calculator; full funnel for 245, approval for 1)
        const completedTransactions = getCompletedTransactionCount(formData, isChallenge1Selected, isChallenge245Selected);
        
        // Handler for refund rate changes - updates expected refunds volume (Expected Refund volume = completed × refund rate)
        const handleRefundRateChange = (newRate: number) => {
          onFieldChange("refundRate", newRate);
          if (completedTransactions > 0) {
            const newVolume = Math.round(completedTransactions * (newRate / 100));
            onFieldChange("expectedRefundsVolume", newVolume);
          }
        };
        
        // Handler for expected refunds volume changes - updates refund rate (refund rate = volume / completed)
        const handleRefundsVolumeChange = (newVolume: number) => {
          onFieldChange("expectedRefundsVolume", newVolume);
          if (completedTransactions > 0) {
            const newRate = (newVolume / completedTransactions) * 100;
            onFieldChange("refundRate", Math.round(newRate * 100) / 100); // Round to 2 decimal places
          }
        };
        
        return (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Instant Refunds</h3>
            <div className="space-y-6">
              <div>
                <h4 className="text-md font-medium mb-3">Customer Service Data</h4>
                {completedTransactions > 0 && (
                  <p className="text-xs text-muted-foreground mb-3">
                    Based on {completedTransactions.toLocaleString()} completed transactions (Transaction attempts × Completion rate)
                  </p>
                )}
                <div className={gridClass}>
                  <div className={fieldRowClass}>
                    <Label className={fieldLabelClass}>Refund Rate on Completed Transactions (%)</Label>
                    <PercentageInput className={fieldInputClass}
                      value={formData.refundRate}
                      onChange={handleRefundRateChange}
                      warning={getValidationWarning("refundRate", formData.refundRate)}
                      max={100}
                      min={0}
                    />
                  </div>
                  <div className={fieldRowClass}>
                    <div className="flex items-center gap-1.5">
                      <Label className={fieldLabelClass}>Expected Refunds - Volume (#)</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex text-muted-foreground cursor-help" aria-label="Calculation breakdown">
                            <Info className="w-4 h-4" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          <p className="font-medium mb-1">Expected Refund volume</p>
                          <p className="text-sm">Transaction attempts (volume) × Current completion rate (%) × Refund rate (%). Editable here or via Refund rate; values stay in sync.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <NumericInput className={fieldInputClass}
                      value={formData.expectedRefundsVolume}
                      onChange={handleRefundsVolumeChange}
                      placeholder="152,689"
                      formatWithCommas
                    />
                  </div>
                  <div className={fieldRowClass}>
                    <Label className={fieldLabelClass}>% of Refund Tickets to CS (%)</Label>
                    <PercentageInput className={fieldInputClass}
                      value={formData.pctRefundsToCS}
                      onChange={(v) => onFieldChange("pctRefundsToCS", v)}
                      warning={getValidationWarning("pctRefundsToCS", formData.pctRefundsToCS)}
                      max={100}
                      min={0}
                    />
                  </div>
                  <div className={fieldRowClass}>
                    <Label className={fieldLabelClass}>Cost per CS Contact ({currencySymbol})</Label>
                    <NumericInput className={fieldInputClass}
                      value={formData.costPerCSContact}
                      onChange={(v) => onFieldChange("costPerCSContact", v)}
                      placeholder="5"
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        );
      })()}

      {/* ATO Protection Section - For Challenges 12/13 */}
      {showATOInputs && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Account Takeover (ATO) Protection</h3>
          <div className="space-y-6">
            <div>
              <h4 className="text-md font-medium mb-3">Sign-in Data</h4>
              <div className={gridClass}>
                <div className={fieldRowClass}>
                  <Label className={fieldLabelClass}>Monthly Number of Logins (#)</Label>
                  <NumericInput className={fieldInputClass}
                    value={formData.monthlyLogins}
                    onChange={(v) => onFieldChange("monthlyLogins", v)}
                    placeholder="15,000"
                    formatWithCommas
                  />
                </div>
                <div className={fieldRowClass}>
                  <Label className={fieldLabelClass}>Customer Lifetime Value (CLV) - GMV ({currencySymbol})</Label>
                  <NumericInput className={fieldInputClass}
                    value={formData.customerLTV}
                    onChange={(v) => onFieldChange("customerLTV", v)}
                    placeholder="450"
                    formatWithCommas
                  />
                  <p className={fieldHelperClass}>Default: AOV × 3</p>
                </div>
                <div className={fieldRowClass}>
                  <Label className={fieldLabelClass}>Average Appeasement Value ({currencySymbol})</Label>
                  <NumericInput className={fieldInputClass}
                    value={formData.avgAppeasementValue}
                    onChange={(v) => onFieldChange("avgAppeasementValue", v)}
                    placeholder="150"
                    formatWithCommas
                  />
                  <p className={fieldHelperClass}>e.g. refunded points</p>
                </div>
                <div className={fieldRowClass}>
                  <Label className={fieldLabelClass}>Avg. Salary per CS Member ({currencySymbol}/year)</Label>
                  <NumericInput className={fieldInputClass}
                    value={formData.avgSalaryPerCSMember}
                    onChange={(v) => onFieldChange("avgSalaryPerCSMember", v)}
                    placeholder="40,000"
                    formatWithCommas
                  />
                </div>
                <div className={fieldRowClass}>
                  <Label className={fieldLabelClass}>Avg. Handling Time per ATO Claim (mins)</Label>
                  <NumericInput className={fieldInputClass}
                    value={formData.avgHandlingTimePerATOClaim}
                    onChange={(v) => onFieldChange("avgHandlingTimePerATOClaim", v)}
                    placeholder="20"
                  />
                </div>
                <div className={fieldRowClass}>
                  <Label className={fieldLabelClass}>% of Users that Churn from ATO (%)</Label>
                  <PercentageInput className={fieldInputClass}
                    value={formData.pctChurnFromATO}
                    onChange={(v) => onFieldChange("pctChurnFromATO", v)}
                    warning={getValidationWarning("pctChurnFromATO", formData.pctChurnFromATO)}
                    max={100}
                    min={0}
                  />
                </div>
                {formData.isMarketplace && (
                  <div className={fieldRowClass}>
                    <Label className={fieldLabelClass}>Commission / Take Rate (%)</Label>
                    <PercentageInput className={fieldInputClass}
                      value={formData.commissionRate}
                      onChange={(v) => onFieldChange("commissionRate", v)}
                      warning={getValidationWarning("commissionRate", formData.commissionRate)}
                      max={100}
                      min={0}
                    />
                  </div>
                )}
                <div className={fieldRowClass}>
                  <Label className={fieldLabelClass}>Gross Margin (%)</Label>
                  <PercentageInput className={fieldInputClass}
                    value={formData.amerGrossMarginPercent}
                    onChange={(v) => onFieldChange("amerGrossMarginPercent", v)}
                    warning={getValidationWarning("amerGrossMarginPercent", formData.amerGrossMarginPercent)}
                    max={100}
                    min={0}
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Sign-up Protection Section - For Challenges 14/15 */}
      {showSignupInputs && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Sign-up Protection</h3>
          <div className="space-y-6">
            <div>
              <h4 className="text-md font-medium mb-3">Sign-up Data</h4>
              <div className={gridClass}>
                <div className={fieldRowClass}>
                  <Label className={fieldLabelClass}>Monthly Number of Sign-ups (#)</Label>
                  <NumericInput className={fieldInputClass}
                    value={formData.monthlySignups}
                    onChange={(v) => onFieldChange("monthlySignups", v)}
                    placeholder="5,000"
                    formatWithCommas
                  />
                </div>
                <div className={fieldRowClass}>
                  <Label className={fieldLabelClass}>Average New Member Bonus/Discount ({currencySymbol})</Label>
                  <NumericInput className={fieldInputClass}
                    value={formData.avgNewMemberBonus}
                    onChange={(v) => onFieldChange("avgNewMemberBonus", v)}
                    placeholder="20"
                  />
                </div>
                <div className={fieldRowClass}>
                  <Label className={fieldLabelClass}>Digital Communications per Year (#)</Label>
                  <NumericInput className={fieldInputClass}
                    value={formData.numDigitalCommunicationsPerYear}
                    onChange={(v) => onFieldChange("numDigitalCommunicationsPerYear", v)}
                    placeholder="12"
                  />
                </div>
                <div className={fieldRowClass}>
                  <Label className={fieldLabelClass}>Avg. Cost per Outreach ({currencySymbol})</Label>
                  <NumericInput className={fieldInputClass}
                    value={formData.avgCostPerOutreach}
                    onChange={(v) => onFieldChange("avgCostPerOutreach", v)}
                    placeholder="0.50"
                    decimalPlaces={2}
                  />
                  <p className={fieldHelperClass}>email, SMS, etc.</p>
                </div>
                <div className={fieldRowClass}>
                  <Label className={fieldLabelClass}>Avg. KYC Cost per Account ({currencySymbol})</Label>
                  <NumericInput className={fieldInputClass}
                    value={formData.avgKYCCostPerAccount}
                    onChange={(v) => onFieldChange("avgKYCCostPerAccount", v)}
                    placeholder="2.00"
                    decimalPlaces={2}
                  />
                </div>
                <div className={fieldRowClass}>
                  <Label className={fieldLabelClass}>% of Accounts Going Through KYC (%)</Label>
                  <PercentageInput className={fieldInputClass}
                    value={formData.pctAccountsGoingThroughKYC}
                    onChange={(v) => onFieldChange("pctAccountsGoingThroughKYC", v)}
                    warning={getValidationWarning("pctAccountsGoingThroughKYC", formData.pctAccountsGoingThroughKYC)}
                    max={100}
                    min={0}
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
