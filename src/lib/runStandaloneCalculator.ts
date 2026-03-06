/**
 * Run a standard calculator with a given data snapshot (for duplicated calculators).
 * Used in standard pathway when user duplicates a calculator; each duplicate has its own inputs.
 */

import type { CalculatorData } from "@/pages/Index";
import type { ForterKPIs } from "@/components/calculator/ForterKPIConfig";
import {
  calculateChallenge1,
  calculateChallenge245,
  calculateChallenge3,
  calculateChallenge7,
  calculateChallenge8,
  calculateChallenge9,
  calculateChallenge10,
  calculateChallenge12_13,
  calculateChallenge14_15,
  type Challenge1Inputs,
  type Challenge245Inputs,
  type Challenge3Inputs,
  type Challenge7Inputs,
  type Challenge8Inputs,
  type Challenge9Inputs,
  type Challenge10Inputs,
  type Challenge12_13Inputs,
  type Challenge14_15Inputs,
  type CalculatorRow,
  defaultDeduplicationAssumptions,
} from "./calculations";
import { defaultAbuseBenchmarks } from "@/components/calculator/AbuseBenchmarksModal";
import { getGmvToNetSalesDeductionPct } from "@/lib/gmvToNetSalesDeductionByCountry";

export interface RunStandaloneOptions {
  deduplicationEnabled?: boolean;
  deduplicationRetryRate?: number;
  deduplicationSuccessRate?: number;
  fraudCBCoverageEnabled?: boolean;
}

export interface RunStandaloneResult {
  value: number;
  rows: CalculatorRow[];
}

const d = (data: CalculatorData, key: keyof CalculatorData, fallback: number): number => {
  const v = data[key];
  if (v === undefined || v === null) return fallback;
  const n = Number(v);
  return Number.isNaN(n) ? fallback : n;
};

/** Run a single standard calculator with given data; returns value and rows for that calculator. */
export function runStandaloneCalculator(
  sourceCalculatorId: string,
  data: CalculatorData,
  forterKPIs: ForterKPIs,
  options: RunStandaloneOptions = {}
): RunStandaloneResult | null {
  const {
    deduplicationEnabled = true,
    deduplicationRetryRate = 50,
    deduplicationSuccessRate = 75,
    fraudCBCoverageEnabled = false,
  } = options;

  const deduplication = {
    enabled: deduplicationEnabled,
    retryRate: deduplicationRetryRate,
    successRate: deduplicationSuccessRate,
  };

  try {
    // -------- Challenge 1: c1-revenue, c1-chargeback --------
    if (sourceCalculatorId === "c1-revenue" || sourceCalculatorId === "c1-chargeback") {
      const currentApprovalRate = d(data, "amerPreAuthApprovalRate", 95);
      const currentCBRate = d(data, "fraudCBRate", 0.5);
      let approvalImprovement = forterKPIs.approvalRateImprovement ?? 4;
      if (forterKPIs.approvalRateIsAbsolute) {
        const targetApproval = Math.min(100, Math.max(0, forterKPIs.approvalRateImprovement ?? 4));
        approvalImprovement = Math.max(0, targetApproval - currentApprovalRate);
      }
      approvalImprovement = Math.min(approvalImprovement, 100 - currentApprovalRate);
      let cbReduction = forterKPIs.chargebackReduction ?? 50;
      if (forterKPIs.chargebackReductionIsAbsolute) {
        const targetCBRate = Math.max(0, forterKPIs.chargebackReduction ?? 0);
        if (currentCBRate > 0) {
          cbReduction = Math.max(0, ((currentCBRate - targetCBRate) / currentCBRate) * 100);
        } else cbReduction = 0;
      }
      cbReduction = Math.min(100, Math.max(0, cbReduction));

      const inputs: Challenge1Inputs = {
        transactionAttempts: d(data, "amerGrossAttempts", 0),
        transactionAttemptsValue: d(data, "amerAnnualGMV", 0),
        grossMarginPercent: d(data, "amerGrossMarginPercent", 50),
        approvalRate: currentApprovalRate,
        fraudChargebackRate: currentCBRate,
        isMarketplace: data.isMarketplace ?? false,
        commissionRate: d(data, "commissionRate", 100),
        currencyCode: data.baseCurrency || "USD",
        completedAOV: data.completedAOV,
        forterCompletedAOV: forterKPIs.forterCompletedAOV,
        recoveredAovMultiplier: forterKPIs.recoveredAovMultiplier ?? 1.15,
        forterApprovalRateImprovement: approvalImprovement,
        forterChargebackReduction: cbReduction,
        deduplication: { ...defaultDeduplicationAssumptions, ...deduplication },
        includesFraudCBCoverage: fraudCBCoverageEnabled,
      };
      const result = calculateChallenge1(inputs);
      if (sourceCalculatorId === "c1-revenue") {
        const value = result.calculator1.deduplicatedRevenueUplift ?? result.calculator1.revenueUplift;
        return { value, rows: result.calculator1.rows };
      }
      return { value: result.calculator2.costReduction, rows: result.calculator2.rows };
    }

    // -------- Challenge 245: c245-revenue, c245-chargeback --------
    if (sourceCalculatorId === "c245-revenue" || sourceCalculatorId === "c245-chargeback") {
      const currentPreAuthRate = d(data, "amerPreAuthApprovalRate", 95);
      const currentPostAuthRate = d(data, "amerPostAuthApprovalRate", 98);
      const current3DSRate = d(data, "amer3DSChallengeRate", 50);
      const currentCBRate = d(data, "fraudCBRate", 0.5);
      let preAuthImprovement = forterKPIs.preAuthIncluded !== false ? (forterKPIs.preAuthApprovalImprovement ?? 4) : 0;
      if (forterKPIs.preAuthApprovalIsAbsolute && forterKPIs.preAuthIncluded !== false) {
        const target = Math.min(100, Math.max(0, forterKPIs.preAuthApprovalImprovement ?? 4));
        preAuthImprovement = target - currentPreAuthRate; // allow negative (Forter outcome below customer)
      }
      preAuthImprovement = Math.min(preAuthImprovement, 100 - currentPreAuthRate);
      let postAuthImprovement = forterKPIs.postAuthIncluded !== false ? (forterKPIs.postAuthApprovalImprovement ?? 2) : 0;
      if (forterKPIs.postAuthApprovalIsAbsolute && forterKPIs.postAuthIncluded !== false) {
        const target = Math.min(100, Math.max(0, forterKPIs.postAuthApprovalImprovement ?? 2));
        postAuthImprovement = target - currentPostAuthRate; // allow negative (Forter outcome below customer)
      }
      postAuthImprovement = Math.min(postAuthImprovement, 100 - currentPostAuthRate);
      let threeDSReduction = forterKPIs.threeDSReduction ?? 20;
      if (forterKPIs.threeDSReductionIsAbsolute) {
        const target = Math.min(100, Math.max(0, forterKPIs.threeDSReduction ?? 0));
        threeDSReduction = Math.max(0, current3DSRate - target);
      }
      threeDSReduction = Math.min(threeDSReduction, current3DSRate);
      let cbReduction = forterKPIs.chargebackReduction ?? 50;
      let targetCBRate: number;
      if (forterKPIs.chargebackReductionIsAbsolute) {
        targetCBRate = Math.max(0, forterKPIs.chargebackReduction ?? 0);
        if (currentCBRate > 0) {
          cbReduction = Math.max(0, ((currentCBRate - targetCBRate) / currentCBRate) * 100);
        } else cbReduction = 0;
      } else {
        cbReduction = forterKPIs.chargebackReduction ?? 50;
        targetCBRate = currentCBRate * (1 - cbReduction / 100);
      }
      cbReduction = Math.min(100, Math.max(0, cbReduction));
      const forterTargetPostAuthRate = forterKPIs.postAuthIncluded !== false ? Math.min(100, currentPostAuthRate + postAuthImprovement) : 100;

      const inputs: Challenge245Inputs = {
        transactionAttempts: d(data, "amerGrossAttempts", 0),
        transactionAttemptsValue: d(data, "amerAnnualGMV", 0),
        grossMarginPercent: d(data, "amerGrossMarginPercent", 50),
        preAuthApprovalRate: currentPreAuthRate,
        postAuthApprovalRate: currentPostAuthRate,
        creditCardPct: d(data, "amerCreditCardPct", 80),
        creditCard3DSPct: current3DSRate,
        threeDSFailureRate: d(data, "amer3DSAbandonmentRate", 15),
        issuingBankDeclineRate: d(data, "amerIssuingBankDeclineRate", 15),
        fraudChargebackRate: currentCBRate,
        isMarketplace: data.isMarketplace ?? false,
        commissionRate: d(data, "commissionRate", 100),
        currencyCode: data.baseCurrency || "USD",
        completedAOV: data.completedAOV,
        forterCompletedAOV: forterKPIs.forterCompletedAOV,
        recoveredAovMultiplier: forterKPIs.recoveredAovMultiplier ?? 1.15,
        forterPreAuthImprovement: preAuthImprovement,
        forterPostAuthImprovement: postAuthImprovement,
        forter3DSReduction: threeDSReduction,
        forterChargebackReduction: cbReduction,
        forterTargetCBRate: targetCBRate,
        forterTargetPostAuthRate,
        deduplication: { ...defaultDeduplicationAssumptions, ...deduplication },
        includesFraudCBCoverage: fraudCBCoverageEnabled,
      };
      const result = calculateChallenge245(inputs);
      if (sourceCalculatorId === "c245-revenue") {
        const value = result.calculator1.deduplicatedRevenueUplift ?? result.calculator1.revenueUplift;
        return { value, rows: result.calculator1.rows };
      }
      return { value: result.calculator2.costReduction, rows: result.calculator2.rows };
    }

    // -------- Challenge 3: c3-review --------
    if (sourceCalculatorId === "c3-review") {
      const currentReviewPct = d(data, "manualReviewPct", 5);
      const currentTimePerReview = d(data, "timePerReview", 10);
      let reviewReduction = forterKPIs.manualReviewReduction ?? 5;
      if (forterKPIs.manualReviewIsAbsolute) {
        reviewReduction = Math.max(0, currentReviewPct - (forterKPIs.manualReviewReduction ?? 0));
      }
      reviewReduction = Math.min(reviewReduction, currentReviewPct);
      let timeReductionPct = forterKPIs.reviewTimeReduction ?? 30;
      if (forterKPIs.reviewTimeIsAbsolute) {
        const targetTime = Math.max(0, forterKPIs.reviewTimeReduction ?? 0);
        const timeReductionMinutes = Math.max(0, currentTimePerReview - targetTime);
        timeReductionPct = currentTimePerReview > 0 ? (timeReductionMinutes / currentTimePerReview) * 100 : 0;
      }
      timeReductionPct = Math.min(100, Math.max(0, timeReductionPct));

      const inputs: Challenge3Inputs = {
        transactionAttempts: d(data, "amerGrossAttempts", 0),
        manualReviewPct: currentReviewPct,
        timePerReview: currentTimePerReview,
        hourlyReviewerCost: d(data, "hourlyReviewerCost", 0),
        currencyCode: data.baseCurrency || "USD",
        forterReviewReduction: reviewReduction,
        forterTimeReduction: timeReductionPct,
      };
      const result = calculateChallenge3(inputs);
      return { value: result.calculator1.costReduction, rows: result.calculator1.rows };
    }

    // -------- Challenge 7: c7-disputes, c7-opex --------
    if (sourceCalculatorId === "c7-disputes" || sourceCalculatorId === "c7-opex") {
      const currentFraudDisputeRate = d(data, "fraudDisputeRate", 50);
      const currentFraudWinRate = d(data, "fraudWinRate", 30);
      const currentServiceDisputeRate = d(data, "serviceDisputeRate", 50);
      const currentServiceWinRate = d(data, "serviceWinRate", 40);
      let fraudDisputeImprovement = forterKPIs.fraudDisputeRateImprovement ?? 45;
      if (forterKPIs.fraudDisputeIsAbsolute) {
        fraudDisputeImprovement = Math.min(100, forterKPIs.fraudDisputeRateImprovement ?? 45) - currentFraudDisputeRate;
      }
      let fraudWinChange = forterKPIs.fraudWinRateChange ?? -10;
      if (forterKPIs.fraudWinRateIsAbsolute) {
        fraudWinChange = Math.min(100, Math.max(0, forterKPIs.fraudWinRateChange ?? 0)) - currentFraudWinRate;
      }
      let serviceDisputeImprovement = forterKPIs.serviceDisputeRateImprovement ?? 65;
      if (forterKPIs.serviceDisputeIsAbsolute) {
        serviceDisputeImprovement = Math.min(100, forterKPIs.serviceDisputeRateImprovement ?? 65) - currentServiceDisputeRate;
      }
      let serviceWinChange = forterKPIs.serviceWinRateChange ?? -10;
      if (forterKPIs.serviceWinRateIsAbsolute) {
        serviceWinChange = Math.min(100, Math.max(0, forterKPIs.serviceWinRateChange ?? 0)) - currentServiceWinRate;
      }

      const transactionAttemptsValue = d(data, "amerAnnualGMV", 0);
      const fraudChargebackRate = d(data, "fraudCBRate", 0.5);
      const serviceChargebackRate = d(data, "serviceCBRate", 0.2);
      const estFraud = data.estFraudChargebackValue ?? (transactionAttemptsValue * (fraudChargebackRate / 100));
      const estService = data.estServiceChargebackValue ?? (transactionAttemptsValue * (serviceChargebackRate / 100));

      const inputs: Challenge7Inputs = {
        transactionAttempts: d(data, "amerGrossAttempts", 0),
        transactionAttemptsValue,
        fraudChargebackRate,
        fraudDisputeRate: currentFraudDisputeRate,
        fraudWinRate: currentFraudWinRate,
        serviceChargebackRate,
        serviceDisputeRate: currentServiceDisputeRate,
        serviceWinRate: currentServiceWinRate,
        avgTimeToReviewCB: d(data, "avgTimeToReviewCB", 20),
        annualCBDisputes: d(data, "annualCBDisputes", 0),
        costPerHourAnalyst: d(data, "costPerHourAnalyst", 0),
        currencyCode: data.baseCurrency || "USD",
        forterFraudDisputeImprovement: fraudDisputeImprovement,
        forterFraudWinChange: fraudWinChange,
        forterServiceDisputeImprovement: serviceDisputeImprovement,
        forterServiceWinChange: serviceWinChange,
        forterTargetReviewTime: forterKPIs.disputeTimeReduction ?? 5,
        estFraudChargebackValue: estFraud,
        estServiceChargebackValue: estService,
        hasPaymentChallenges: false,
        includesFraudCBCoverage: fraudCBCoverageEnabled,
      };
      const result = calculateChallenge7(inputs);
      if (sourceCalculatorId === "c7-disputes") {
        return { value: result.calculator1.costReduction, rows: result.calculator1.rows };
      }
      return { value: result.calculator2.costReduction, rows: result.calculator2.rows };
    }

    // -------- Challenge 8: c8-returns, c8-inr --------
    if (sourceCalculatorId === "c8-returns" || sourceCalculatorId === "c8-inr") {
      const benchmarks = forterKPIs.abuseBenchmarks || defaultAbuseBenchmarks;
      const inputs: Challenge8Inputs = {
        expectedRefundsVolume: d(data, "expectedRefundsVolume", 0),
        avgRefundValue: d(data, "avgRefundValue", 0),
        isMarketplace: data.isMarketplace ?? false,
        commissionRate: d(data, "commissionRate", 100),
        grossMarginPercent: d(data, "amerGrossMarginPercent", 0),
        avgOneWayShipping: d(data, "avgOneWayShipping", 0),
        avgFulfilmentCost: d(data, "avgFulfilmentCost", 0),
        txProcessingFeePct: d(data, "txProcessingFeePct", 0),
        avgCSTicketCost: d(data, "avgCSTicketCost", 0),
        pctINRClaims: d(data, "pctINRClaims", 0),
        pctReplacedCredits: d(data, "pctReplacedCredits", 0),
        currencyCode: data.baseCurrency || "USD",
        forterCatchRate: forterKPIs.forterCatchRate ?? 90,
        abuseAovMultiplier: forterKPIs.abuseAovMultiplier ?? 1.5,
        egregiousReturnsAbusePct: benchmarks.egregiousReturnsAbusePct,
        egregiousInventoryLossPct: benchmarks.egregiousInventoryLossPct,
        egregiousINRAbusePct: benchmarks.egregiousINRAbusePct,
        nonEgregiousReturnsAbusePct: benchmarks.nonEgregiousReturnsAbusePct,
        nonEgregiousInventoryLossPct: benchmarks.nonEgregiousInventoryLossPct,
        forterEgregiousReturnsReduction: benchmarks.forterEgregiousReturnsReduction,
        forterEgregiousINRReduction: benchmarks.forterEgregiousINRReduction,
        forterNonEgregiousReturnsReduction: benchmarks.forterNonEgregiousReturnsReduction,
      };
      const result = calculateChallenge8(inputs);
      if (sourceCalculatorId === "c8-returns") {
        return { value: result.calculator1.costReduction, rows: result.calculator1.rows };
      }
      return { value: result.calculator2.costReduction, rows: result.calculator2.rows };
    }

    // -------- Challenge 9: c9-cx-uplift, c9-cs-opex --------
    if (sourceCalculatorId === "c9-cx-uplift" || sourceCalculatorId === "c9-cs-opex") {
      const grossAttempts = d(data, "amerGrossAttempts", 0);
      const approvalRate = 100; // standalone: no payment challenges
      const approvedTransactions = grossAttempts * (approvalRate / 100);
      const currentEcommerceSales = (data.amerAnnualGMV ?? 0) * (approvalRate / 100);

      const inputs: Challenge9Inputs = {
        currentEcommerceSales,
        commissionRate: d(data, "commissionRate", 100),
        grossMarginPercent: d(data, "amerGrossMarginPercent", 0),
        refundRate: d(data, "refundRate", 0),
        expectedRefundsVolume: d(data, "expectedRefundsVolume", 0),
        pctRefundsToCS: d(data, "pctRefundsToCS", 0),
        costPerCSContact: d(data, "costPerCSContact", 0),
        currencyCode: data.baseCurrency || "USD",
        isMarketplace: data.isMarketplace ?? false,
        npsIncreaseFromInstantRefunds: forterKPIs.npsIncreaseFromInstantRefunds ?? 10,
        lseNPSBenchmark: forterKPIs.lseNPSBenchmark ?? 1,
        forterCSReduction: forterKPIs.forterCSReduction ?? 78,
      };
      const result = calculateChallenge9(inputs);
      if (sourceCalculatorId === "c9-cx-uplift") {
        const value = result.calculator1.gmvUplift;
        return { value, rows: result.calculator1.rows };
      }
      return { value: result.calculator2.costReduction, rows: result.calculator2.rows };
    }

    // -------- Challenge 10: c10-promotions --------
    if (sourceCalculatorId === "c10-promotions") {
      const benchmarks = forterKPIs.abuseBenchmarks || defaultAbuseBenchmarks;
      const inputs: Challenge10Inputs = {
        transactionAttemptsValue: d(data, "amerAnnualGMV", 0),
        avgDiscountByAbusers: d(data, "avgDiscountByAbusers", 0),
        promotionAbuseCatchRateToday: d(data, "promotionAbuseCatchRateToday", 0),
        isMarketplace: data.isMarketplace ?? false,
        commissionRate: d(data, "commissionRate", 100),
        grossMarginPercent: d(data, "amerGrossMarginPercent", 0),
        currencyCode: data.baseCurrency || "USD",
        forterCatchRate: forterKPIs.forterCatchRate ?? 90,
        abuseAovMultiplier: forterKPIs.abuseAovMultiplier ?? 1.5,
        promotionAbuseAsGMVPct: benchmarks.promotionAbuseAsGMVPct ?? 2,
        gmvToNetSalesDeductionPct: getGmvToNetSalesDeductionPct(data),
      };
      const result = calculateChallenge10(inputs);
      return { value: result.calculator1.revenueUplift, rows: result.calculator1.rows };
    }

    // -------- Challenge 12/13: c12-ato-opex, c13-clv --------
    if (sourceCalculatorId === "c12-ato-opex" || sourceCalculatorId === "c13-clv") {
      const inputs: Challenge12_13Inputs = {
        monthlyLogins: d(data, "monthlyLogins", 0),
        customerLTV: d(data, "customerLTV", 0),
        avgAppeasementValue: d(data, "avgAppeasementValue", 0),
        avgSalaryPerCSMember: d(data, "avgSalaryPerCSMember", 0),
        avgHandlingTimePerATOClaim: d(data, "avgHandlingTimePerATOClaim", 0),
        pctChurnFromATO: d(data, "pctChurnFromATO", 0),
        commissionRate: d(data, "commissionRate", 100),
        grossMarginPercent: d(data, "amerGrossMarginPercent", 0),
        currencyCode: data.baseCurrency || "USD",
        isMarketplace: data.isMarketplace ?? false,
        pctFraudulentLogins: forterKPIs.pctFraudulentLogins ?? 1,
        churnLikelihoodFromATO: forterKPIs.churnLikelihoodFromATO ?? 50,
        atoCatchRate: forterKPIs.atoCatchRate ?? 90,
        currentAtoCatchRate: d(data, "currentAtoCatchRate", 0),
        gmvToNetSalesDeductionPct: getGmvToNetSalesDeductionPct(data),
      };
      const result = calculateChallenge12_13(inputs);
      if (sourceCalculatorId === "c12-ato-opex") {
        return { value: result.calculator1.costReduction, rows: result.calculator1.rows };
      }
      return { value: result.calculator2.profitUplift, rows: result.calculator2.rows };
    }

    // -------- Challenge 14/15: c14-marketing, c14-kyc, c14-reactivation --------
    if (
      sourceCalculatorId === "c14-marketing" ||
      sourceCalculatorId === "c14-kyc" ||
      sourceCalculatorId === "c14-reactivation"
    ) {
      const inputs: Challenge14_15Inputs = {
        monthlySignups: d(data, "monthlySignups", 0),
        avgNewMemberBonus: d(data, "avgNewMemberBonus", 0),
        numDigitalCommunicationsPerYear: d(data, "numDigitalCommunicationsPerYear", 0),
        avgCostPerOutreach: d(data, "avgCostPerOutreach", 0),
        avgKYCCostPerAccount: d(data, "avgKYCCostPerAccount", 0),
        pctAccountsGoingThroughKYC: d(data, "pctAccountsGoingThroughKYC", 0),
        currencyCode: data.baseCurrency || "USD",
        pctFraudulentSignups: forterKPIs.pctFraudulentSignups ?? 10,
        forterFraudulentSignupReduction: forterKPIs.forterFraudulentSignupReduction ?? 95,
        forterKYCReduction: forterKPIs.forterKYCReduction ?? 80,
      };
      const result = calculateChallenge14_15(inputs);
      if (sourceCalculatorId === "c14-marketing") {
        return { value: result.calculator1.costReduction, rows: result.calculator1.rows };
      }
      if (sourceCalculatorId === "c14-reactivation") {
        return { value: result.calculator2.costReduction, rows: result.calculator2.rows };
      }
      if (sourceCalculatorId === "c14-kyc") {
        return { value: result.calculator3.costReduction, rows: result.calculator3.rows };
      }
    }

    return null;
  } catch (err) {
    console.error("[runStandaloneCalculator]", sourceCalculatorId, err);
    return null;
  }
}

/**
 * Get Forter "Total recoveries ($)" from the Increase chargeback recoveries (c7-disputes) calculator.
 * Used to sync Value of won chargebacks in the Enter Investment modal.
 */
export function getForterTotalRecoveriesC7(
  data: CalculatorData,
  forterKPIs: ForterKPIs,
  includesFraudCBCoverage: boolean = false
): number {
  const currentFraudDisputeRate = d(data, "fraudDisputeRate", 50);
  const currentFraudWinRate = d(data, "fraudWinRate", 30);
  const currentServiceDisputeRate = d(data, "serviceDisputeRate", 50);
  const currentServiceWinRate = d(data, "serviceWinRate", 40);
  let fraudDisputeImprovement = forterKPIs.fraudDisputeRateImprovement ?? 45;
  if (forterKPIs.fraudDisputeIsAbsolute) {
    fraudDisputeImprovement = Math.min(100, forterKPIs.fraudDisputeRateImprovement ?? 45) - currentFraudDisputeRate;
  }
  let fraudWinChange = forterKPIs.fraudWinRateChange ?? -10;
  if (forterKPIs.fraudWinRateIsAbsolute) {
    fraudWinChange = Math.min(100, Math.max(0, forterKPIs.fraudWinRateChange ?? 0)) - currentFraudWinRate;
  }
  let serviceDisputeImprovement = forterKPIs.serviceDisputeRateImprovement ?? 65;
  if (forterKPIs.serviceDisputeIsAbsolute) {
    serviceDisputeImprovement = Math.min(100, forterKPIs.serviceDisputeRateImprovement ?? 65) - currentServiceDisputeRate;
  }
  let serviceWinChange = forterKPIs.serviceWinRateChange ?? -10;
  if (forterKPIs.serviceWinRateIsAbsolute) {
    serviceWinChange = Math.min(100, Math.max(0, forterKPIs.serviceWinRateChange ?? 0)) - currentServiceWinRate;
  }
  const transactionAttemptsValue = d(data, "amerAnnualGMV", 0);
  const fraudChargebackRate = d(data, "fraudCBRate", 0.5);
  const serviceChargebackRate = d(data, "serviceCBRate", 0.2);
  const estFraud = data.estFraudChargebackValue ?? (transactionAttemptsValue * (fraudChargebackRate / 100));
  const estService = data.estServiceChargebackValue ?? (transactionAttemptsValue * (serviceChargebackRate / 100));
  const inputs: Challenge7Inputs = {
    transactionAttempts: d(data, "amerGrossAttempts", 0),
    transactionAttemptsValue,
    fraudChargebackRate,
    fraudDisputeRate: currentFraudDisputeRate,
    fraudWinRate: currentFraudWinRate,
    serviceChargebackRate,
    serviceDisputeRate: currentServiceDisputeRate,
    serviceWinRate: currentServiceWinRate,
    avgTimeToReviewCB: d(data, "avgTimeToReviewCB", 20),
    annualCBDisputes: d(data, "annualCBDisputes", 0),
    costPerHourAnalyst: d(data, "costPerHourAnalyst", 0),
    currencyCode: data.baseCurrency || "USD",
    forterFraudDisputeImprovement: fraudDisputeImprovement,
    forterFraudWinChange: fraudWinChange,
    forterServiceDisputeImprovement: serviceDisputeImprovement,
    forterServiceWinChange: serviceWinChange,
    forterTargetReviewTime: forterKPIs.disputeTimeReduction ?? 5,
    estFraudChargebackValue: estFraud,
    estServiceChargebackValue: estService,
    hasPaymentChallenges: false,
    includesFraudCBCoverage,
  };
  const result = calculateChallenge7(inputs);
  return result.fortTotalRecoveries;
}

/** Section for each source calculator ID (GMV Uplift / Cost Reduction / Risk Mitigation) */
export const STANDALONE_CALC_SECTION: Record<string, "gmv" | "cost" | "risk"> = {
  "c1-revenue": "gmv",
  "c245-revenue": "gmv",
  "c9-cx-uplift": "gmv",
  "c1-chargeback": "cost",
  "c245-chargeback": "cost",
  "c3-review": "cost",
  "c7-disputes": "cost",
  "c7-opex": "cost",
  "c9-cs-opex": "cost",
  "c12-ato-opex": "cost",
  "c8-returns": "risk",
  "c8-inr": "risk",
  "c10-promotions": "gmv",
  "c13-clv": "risk",
  "c14-marketing": "risk",
  "c14-kyc": "risk",
  "c14-reactivation": "risk",
};
