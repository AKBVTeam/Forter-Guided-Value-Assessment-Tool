import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, AlertCircle, Settings2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { NumericInput } from "./NumericInput";
import { PercentageInput } from "./PercentageInput";
import { cn } from "@/lib/utils";
import { CalculatorData } from "@/pages/Index";
import { ForterKPIs, defaultForterKPIs } from "./ForterKPIConfig";
import { AbuseBenchmarks, defaultAbuseBenchmarks } from "./AbuseBenchmarksModal";

// Define required inputs per calculator type
export interface RequiredInput {
  id: keyof CalculatorData;
  label: string;
  description: string;
  type: 'currency' | 'percentage' | 'number';
  /** If true, field is optional (e.g. Completed AOV); not counted as missing when empty */
  optional?: boolean;
  /** Slider min for percentage type (default 0) */
  min?: number;
  /** Slider max for percentage type (default 100) */
  max?: number;
}

// Define Forter KPI inputs per calculator type
export interface ForterKPIInput {
  id: keyof ForterKPIs;
  label: string;
  description: string;
  type: 'percentage' | 'number';
  defaultValue: number;
  /** Slider min for percentage type (default 0) */
  min?: number;
  /** Slider max for percentage type (default 100) */
  max?: number;
}

// Abuse benchmark fields (stored in forterKPIs.abuseBenchmarks) - for returns/INR abuse calculators
export interface AbuseBenchmarkInput {
  field: keyof AbuseBenchmarks;
  label: string;
  description: string;
  type: 'currency' | 'percentage' | 'number';
  defaultValue?: number;
  /** Slider min for percentage type (default 0) */
  min?: number;
  /** Slider max for percentage type (default 100) */
  max?: number;
}

export interface CalculatorInputsConfig {
  calculatorId: string;
  calculatorName: string;
  requiredInputs: RequiredInput[];
  forterKPIs?: ForterKPIInput[];
  /** Abuse benchmark assumptions (returns/INR abuse) - read/write via forterKPIs.abuseBenchmarks */
  abuseBenchmarkInputs?: AbuseBenchmarkInput[];
}

// Map calculator IDs to their required inputs - complete set of customer inputs and Forter KPIs per calculator.
// Green = complete (value present), Yellow = required but missing.
export const CALCULATOR_REQUIRED_INPUTS: Record<string, CalculatorInputsConfig> = {
  'c1-revenue': {
    calculatorId: 'c1-revenue',
    calculatorName: 'Reduce false declines',
    requiredInputs: [
      { id: 'amerAnnualGMV', label: 'Transaction Attempts ($)', description: 'Total annual gross merchandise value of transactions', type: 'currency' },
      { id: 'amerGrossAttempts', label: 'Transaction Attempts (#)', description: 'Total number of annual transaction attempts', type: 'number' },
      { id: 'amerPreAuthApprovalRate', label: 'Fraud approval rate (%)', description: 'Current approval rate after fraud screening (95-99% typical)', type: 'percentage' },
      { id: 'completedAOV', label: 'Completed AOV ($)', description: 'Optional: AOV used for value of approved transactions (defaults to Transaction Attempts $ ÷ #)', type: 'currency', optional: true },
      { id: 'amerGrossMarginPercent', label: 'Gross Margin (%)', description: 'Gross profit margin applied to approved transaction value', type: 'percentage' },
    ],
    forterKPIs: [
      { id: 'approvalRateImprovement', label: 'Target Fraud approval rate (%)', description: 'Expected approval rate with Forter', type: 'percentage', defaultValue: 99 },
      { id: 'chargebackReduction', label: 'Target Fraud CB Rate (%)', description: 'Expected fraud chargeback rate with Forter (for chargeback calc)', type: 'percentage', defaultValue: 0.25, min: 0, max: 10 },
    ],
  },
  'chargeback': {
    calculatorId: 'chargeback',
    calculatorName: 'Reduce fraud chargebacks',
    requiredInputs: [
      { id: 'amerAnnualGMV', label: 'Transaction Attempts ($)', description: 'Total annual gross merchandise value', type: 'currency' },
      { id: 'amerGrossAttempts', label: 'Transaction Attempts (#)', description: 'Total number of annual transaction attempts', type: 'number' },
      { id: 'fraudCBRate', label: 'Gross Fraud Chargeback Rate (%)', description: 'Current fraud chargeback rate as % of GMV', type: 'percentage', min: 0, max: 10 },
      { id: 'fraudCBAOV', label: 'Fraud Chargeback AOV ($)', description: 'Average order value for fraud chargebacks', type: 'currency' },
    ],
    forterKPIs: [
      { id: 'chargebackReduction', label: 'Target Fraud CB Rate (%)', description: 'Expected fraud CB rate with Forter', type: 'percentage', defaultValue: 0.25, min: 0, max: 10 },
    ],
  },
  'c1-chargeback': {
    calculatorId: 'c1-chargeback',
    calculatorName: 'Reduce fraud chargebacks',
    requiredInputs: [
      { id: 'amerAnnualGMV', label: 'Transaction Attempts ($)', description: 'Total annual gross merchandise value', type: 'currency' },
      { id: 'amerGrossAttempts', label: 'Transaction Attempts (#)', description: 'Total number of annual transaction attempts', type: 'number' },
      { id: 'fraudCBRate', label: 'Gross Fraud Chargeback Rate (%)', description: 'Current fraud chargeback rate as % of GMV', type: 'percentage', min: 0, max: 10 },
      { id: 'fraudCBAOV', label: 'Fraud Chargeback AOV ($)', description: 'Average order value for fraud chargebacks', type: 'currency' },
    ],
    forterKPIs: [
      { id: 'chargebackReduction', label: 'Target Fraud CB Rate (%)', description: 'Expected fraud CB rate with Forter', type: 'percentage', defaultValue: 0.25, min: 0, max: 10 },
    ],
  },
  'c245-revenue': {
    calculatorId: 'c245-revenue',
    calculatorName: 'Optimize payment funnel',
    requiredInputs: [
      { id: 'amerAnnualGMV', label: 'Transaction Attempts ($)', description: 'Total annual gross merchandise value', type: 'currency' },
      { id: 'amerGrossAttempts', label: 'Transaction Attempts (#)', description: 'Total number of annual transaction attempts', type: 'number' },
      { id: 'amerPreAuthApprovalRate', label: 'Pre-Auth Fraud Approval Rate (%)', description: 'Current approval rate after fraud screening', type: 'percentage' },
      { id: 'amerPostAuthApprovalRate', label: 'Post-Auth Fraud Approval Rate (%)', description: 'Current post-auth approval rate (transactions that reach post-auth)', type: 'percentage' },
      { id: 'amerCreditCardPct', label: '% of Transactions that are Credit Cards (%)', description: 'Share of transactions paid by credit card', type: 'percentage' },
      { id: 'amer3DSChallengeRate', label: 'Challenge 3DS Rate (%)', description: 'Percentage of credit card transactions receiving 3DS challenge', type: 'percentage' },
      { id: 'amer3DSAbandonmentRate', label: '3DS Failure & Abandonment Rate (%)', description: 'Rate at which 3DS challenges fail or are abandoned', type: 'percentage' },
      { id: 'amerIssuingBankDeclineRate', label: 'Issuing Bank Decline Rate (%)', description: 'Decline rate from issuing bank (after 3DS)', type: 'percentage' },
      { id: 'completedAOV', label: 'Completed AOV ($)', description: 'Optional: AOV for value of approved transactions (defaults to Transaction Attempts $ ÷ #)', type: 'currency', optional: true },
      { id: 'amerGrossMarginPercent', label: 'Gross Margin (%)', description: 'Gross profit margin applied to approved value', type: 'percentage' },
    ],
    forterKPIs: [
      { id: 'preAuthApprovalImprovement', label: 'Target Pre-Auth Fraud Approval Rate (%)', description: 'Expected approval rate with Forter', type: 'percentage', defaultValue: 99 },
      { id: 'postAuthApprovalImprovement', label: 'Target Post-Auth Fraud Approval Rate (%)', description: 'Expected post-auth approval rate with Forter', type: 'percentage', defaultValue: 100 },
      { id: 'threeDSReduction', label: 'Target 3DS Rate (%)', description: 'Expected 3DS challenge rate with Forter', type: 'percentage', defaultValue: 10 },
      { id: 'chargebackReduction', label: 'Target Fraud CB Rate (%)', description: 'Expected fraud CB rate with Forter', type: 'percentage', defaultValue: 0.25, min: 0, max: 10 },
    ],
  },
  'c245-chargeback': {
    calculatorId: 'c245-chargeback',
    calculatorName: 'Reduce fraud chargebacks',
    requiredInputs: [
      { id: 'amerAnnualGMV', label: 'Transaction Attempts ($)', description: 'Total annual gross merchandise value', type: 'currency' },
      { id: 'amerGrossAttempts', label: 'Transaction Attempts (#)', description: 'Total number of annual transaction attempts', type: 'number' },
      { id: 'amerPreAuthApprovalRate', label: 'Pre-Auth Fraud Approval Rate (%)', description: 'Current approval rate after fraud screening', type: 'percentage' },
      { id: 'amerPostAuthApprovalRate', label: 'Post-Auth Fraud Approval Rate (%)', description: 'Current post-auth approval rate', type: 'percentage' },
      { id: 'fraudCBRate', label: 'Gross Fraud Chargeback Rate (%)', description: 'Current fraud chargeback rate as % of GMV', type: 'percentage', min: 0, max: 10 },
      { id: 'fraudCBAOV', label: 'Fraud Chargeback AOV ($)', description: 'Average order value for fraud chargebacks', type: 'currency' },
    ],
    forterKPIs: [
      { id: 'preAuthApprovalImprovement', label: 'Target Pre-Auth Fraud Approval Rate (%)', description: 'Expected approval rate with Forter', type: 'percentage', defaultValue: 99 },
      { id: 'postAuthApprovalImprovement', label: 'Target Post-Auth Fraud Approval Rate (%)', description: 'Expected post-auth approval rate with Forter', type: 'percentage', defaultValue: 100 },
      { id: 'chargebackReduction', label: 'Target Fraud CB Rate (%)', description: 'Expected fraud CB rate with Forter', type: 'percentage', defaultValue: 0.25, min: 0, max: 10 },
    ],
  },
  'c3-review': {
    calculatorId: 'c3-review',
    calculatorName: 'Reduce manual review costs',
    requiredInputs: [
      { id: 'amerGrossAttempts', label: 'Transaction Attempts (#)', description: 'Total number of annual transaction attempts', type: 'number' },
      { id: 'manualReviewPct', label: '% of Transactions to Manual Review (%)', description: 'Percentage of transactions reviewed manually', type: 'percentage' },
      { id: 'timePerReview', label: 'Time to Review a TX (minutes)', description: 'Average time to review a transaction', type: 'number' },
      { id: 'hourlyReviewerCost', label: 'Hourly Cost per Reviewer ($)', description: 'Fully loaded cost per hour for reviewers', type: 'currency' },
    ],
    forterKPIs: [
      { id: 'manualReviewReduction', label: 'Target Manual Review Rate (%)', description: 'Expected manual review rate with Forter', type: 'percentage', defaultValue: 0 },
      { id: 'reviewTimeReduction', label: 'Target Review Time (mins)', description: 'Expected time per review with Forter', type: 'number', defaultValue: 7 },
    ],
  },
  'c7-disputes': {
    calculatorId: 'c7-disputes',
    calculatorName: 'Increase chargeback recoveries',
    requiredInputs: [
      { id: 'estFraudChargebackValue', label: 'Est. Value of Fraud Chargebacks ($)', description: 'Estimated annual value of fraud chargebacks', type: 'currency' },
      { id: 'estServiceChargebackValue', label: 'Est. Value of Service Chargebacks ($)', description: 'Estimated annual value of service chargebacks', type: 'currency' },
      { id: 'fraudDisputeRate', label: 'Fraud Dispute Rate - Value (%)', description: 'Percentage of fraud chargebacks you dispute', type: 'percentage' },
      { id: 'fraudWinRate', label: 'Fraud Win Rate - Value (%)', description: 'Win rate on fraud chargeback disputes', type: 'percentage' },
      { id: 'serviceDisputeRate', label: 'Service Dispute Rate - Value (%)', description: 'Percentage of service chargebacks you dispute', type: 'percentage' },
      { id: 'serviceWinRate', label: 'Service Win Rate - Value (%)', description: 'Win rate on service chargeback disputes', type: 'percentage' },
      { id: 'avgTimeToReviewCB', label: 'Avg. Time to Review CB (mins)', description: 'Average time to review and prepare a dispute', type: 'number' },
      { id: 'annualCBDisputes', label: 'Number of Annual CB Disputes', description: 'Total number of chargeback disputes filed annually', type: 'number' },
      { id: 'costPerHourAnalyst', label: 'Cost per Hour of Analyst ($)', description: 'Fully loaded cost per hour for dispute analysts', type: 'currency' },
    ],
    forterKPIs: [
      { id: 'fraudDisputeRateImprovement', label: 'Target Fraud Dispute Rate (%)', description: 'Expected fraud dispute rate with Forter', type: 'percentage', defaultValue: 90 },
      { id: 'fraudWinRateChange', label: 'Target Fraud Win Rate (%)', description: 'Expected fraud dispute win rate with Forter', type: 'percentage', defaultValue: 30 },
      { id: 'serviceDisputeRateImprovement', label: 'Target Service Dispute Rate (%)', description: 'Expected service dispute rate with Forter', type: 'percentage', defaultValue: 90 },
      { id: 'serviceWinRateChange', label: 'Target Service Win Rate (%)', description: 'Expected service dispute win rate with Forter', type: 'percentage', defaultValue: 40 },
      { id: 'disputeTimeReduction', label: 'Target Dispute Review Time (mins)', description: 'Expected time to review a dispute with Forter', type: 'number', defaultValue: 5 },
    ],
  },
  'c7-opex': {
    calculatorId: 'c7-opex',
    calculatorName: 'Improve recovery efficiency (OpEx)',
    requiredInputs: [
      { id: 'annualCBDisputes', label: 'Number of Annual CB Disputes', description: 'Total number of chargeback disputes filed annually', type: 'number' },
      { id: 'avgTimeToReviewCB', label: 'Avg. Time to Review CB (mins)', description: 'Average time to review and prepare a dispute', type: 'number' },
      { id: 'costPerHourAnalyst', label: 'Cost per Hour of Analyst ($)', description: 'Fully loaded cost per hour for dispute analysts', type: 'currency' },
    ],
    forterKPIs: [
      { id: 'disputeTimeReduction', label: 'Target Dispute Review Time (mins)', description: 'Expected time to review a dispute with Forter', type: 'number', defaultValue: 5 },
    ],
  },
  'c8-returns': {
    calculatorId: 'c8-returns',
    calculatorName: 'Block returns abusers',
    requiredInputs: [
      { id: 'expectedRefundsVolume', label: 'Expected Refunds - Volume (#)', description: 'Total number of expected returns annually', type: 'number' },
      { id: 'avgRefundValue', label: 'Average Refunds Value ($)', description: 'Average value per return/refund', type: 'currency' },
      { id: 'refundRate', label: 'Refund Rate on Completed Transactions (%)', description: 'Percentage of orders that are returned', type: 'percentage' },
      { id: 'pctINRClaims', label: '% of Refund Requests that are INR (%)', description: 'Share of refunds that are Item Not Received claims', type: 'percentage' },
      { id: 'pctReplacedCredits', label: '% Credit or Item Replaced (%)', description: 'Share of refunds replaced with credit or item', type: 'percentage' },
      { id: 'avgOneWayShipping', label: 'Avg. 1-Way Shipping Cost ($)', description: 'Average one-way shipping cost (2-way = 2× for returns)', type: 'currency' },
      { id: 'avgFulfilmentCost', label: 'Avg. Unit Fulfilment Cost ($)', description: 'Average unit fulfilment cost (warehouse)', type: 'currency' },
      { id: 'txProcessingFeePct', label: 'TX Processing Fees (%)', description: 'Transaction processing fees as % of order value', type: 'percentage' },
      { id: 'avgCSTicketCost', label: 'Avg. CS Ticket Cost ($)', description: 'Average cost per customer service ticket', type: 'currency' },
      { id: 'amerGrossMarginPercent', label: 'Gross Margin (%)', description: 'Gross profit margin (for unit cost of abuse)', type: 'percentage' },
    ],
    forterKPIs: [
      { id: 'forterCatchRate', label: 'Abuse Catch Rate (%)', description: 'Expected catch rate for returns abuse with Forter', type: 'percentage', defaultValue: 90 },
      { id: 'abuseAovMultiplier', label: 'Abuse AoV Multiplier (x)', description: 'Multiplier for abuse order value vs average', type: 'number', defaultValue: 1.5 },
    ],
    abuseBenchmarkInputs: [
      { field: 'egregiousReturnsAbusePct', label: 'Egregious returns abuse population (%)', description: '% of returns that are egregious abuse', type: 'percentage', defaultValue: 2 },
      { field: 'nonEgregiousReturnsAbusePct', label: 'Non-egregious returns abuse population (%)', description: '% of returns that are non-egregious abuse', type: 'percentage', defaultValue: 8 },
      { field: 'egregiousInventoryLossPct', label: 'Egregious inventory loss (%)', description: 'Inventory loss % for egregious abuse', type: 'percentage', defaultValue: 100 },
      { field: 'nonEgregiousInventoryLossPct', label: 'Non-egregious inventory loss (%)', description: 'Inventory loss % for non-egregious abuse', type: 'percentage', defaultValue: 50 },
      { field: 'forterEgregiousReturnsReduction', label: 'Forter egregious returns reduction (%)', description: 'Expected reduction in egregious returns abuse', type: 'percentage', defaultValue: 90 },
      { field: 'forterNonEgregiousReturnsReduction', label: 'Forter non-egregious returns reduction (%)', description: 'Expected reduction in non-egregious returns abuse', type: 'percentage', defaultValue: 90 },
    ],
  },
  'c8-inr': {
    calculatorId: 'c8-inr',
    calculatorName: 'Block INR abusers',
    requiredInputs: [
      { id: 'expectedRefundsVolume', label: 'Expected Refunds - Volume (#)', description: 'Total number of expected returns annually', type: 'number' },
      { id: 'avgRefundValue', label: 'Average Refunds Value ($)', description: 'Average value per return/refund', type: 'currency' },
      { id: 'pctINRClaims', label: '% of Refund Requests that are INR (%)', description: 'Share of refunds that are Item Not Received claims', type: 'percentage' },
      { id: 'pctReplacedCredits', label: '% Credit or Item Replaced (%)', description: 'Share of refunds replaced with credit or item', type: 'percentage' },
      { id: 'avgOneWayShipping', label: 'Avg. 1-Way Shipping Cost ($)', description: 'Average one-way shipping cost', type: 'currency' },
      { id: 'avgFulfilmentCost', label: 'Avg. Unit Fulfilment Cost ($)', description: 'Average unit fulfilment cost (warehouse)', type: 'currency' },
      { id: 'txProcessingFeePct', label: 'TX Processing Fees (%)', description: 'Transaction processing fees as % of order value', type: 'percentage' },
      { id: 'avgCSTicketCost', label: 'Avg. CS Ticket Cost ($)', description: 'Average cost per customer service ticket', type: 'currency' },
      { id: 'amerGrossMarginPercent', label: 'Gross Margin (%)', description: 'Gross profit margin (for unit cost of abuse)', type: 'percentage' },
    ],
    forterKPIs: [
      { id: 'forterCatchRate', label: 'Abuse Catch Rate (%)', description: 'Expected catch rate for abuse with Forter', type: 'percentage', defaultValue: 90 },
      { id: 'abuseAovMultiplier', label: 'Abuse AoV Multiplier (x)', description: 'Multiplier for abuse order value vs average', type: 'number', defaultValue: 1.5 },
    ],
    abuseBenchmarkInputs: [
      { field: 'egregiousINRAbusePct', label: 'INR abuse population (%)', description: '% of INR claims that are abuse', type: 'percentage', defaultValue: 15 },
      { field: 'forterEgregiousINRReduction', label: 'Forter INR abuse reduction (%)', description: 'Expected reduction in INR abuse with Forter', type: 'percentage', defaultValue: 90 },
    ],
  },
  'c9-cx-uplift': {
    calculatorId: 'c9-cx-uplift',
    calculatorName: 'Instant refunds CX uplift',
    requiredInputs: [
      { id: 'expectedRefundsVolume', label: 'Expected Refunds - Volume (#)', description: 'Total number of expected returns annually', type: 'number' },
      { id: 'avgRefundValue', label: 'Average Refunds Value ($)', description: 'Average value per return/refund', type: 'currency' },
      { id: 'refundRate', label: 'Refund Rate on Completed Transactions (%)', description: 'Percentage of completed transactions that are refunded', type: 'percentage' },
      { id: 'amerGrossMarginPercent', label: 'Gross Margin (%)', description: 'Your gross profit margin percentage', type: 'percentage' },
    ],
    forterKPIs: [
      { id: 'npsIncreaseFromInstantRefunds', label: 'Expected NPS Increase (pts)', description: 'Expected NPS increase from instant refunds', type: 'number', defaultValue: 10 },
      { id: 'lseNPSBenchmark', label: 'LSE NPS Benchmark (% per pt)', description: 'Lifetime spend elasticity per NPS point', type: 'number', defaultValue: 1 },
    ],
  },
  'c9-cs-opex': {
    calculatorId: 'c9-cs-opex',
    calculatorName: 'Reduced CS ticket handling',
    requiredInputs: [
      { id: 'expectedRefundsVolume', label: 'Expected Refunds - Volume (#)', description: 'Total number of expected returns annually', type: 'number' },
      { id: 'costPerCSContact', label: 'Cost per CS Contact ($)', description: 'Cost per customer service contact', type: 'currency' },
      { id: 'pctRefundsToCS', label: '% of Refund Tickets to CS (%)', description: 'Percentage of refunds that generate CS tickets', type: 'percentage' },
    ],
    forterKPIs: [
      { id: 'forterCSReduction', label: 'Expected % Reduction in CS Contacts', description: 'Expected reduction in CS contacts from instant refunds', type: 'percentage', defaultValue: 78 },
    ],
  },
  'c10-promotions': {
    calculatorId: 'c10-promotions',
    calculatorName: 'Protect from promotion abuse',
    requiredInputs: [
      { id: 'amerAnnualGMV', label: 'Transaction Attempts ($)', description: 'Total annual gross merchandise value (eCommerce sales attempts)', type: 'currency' },
      { id: 'amerGrossAttempts', label: 'Transaction Attempts (#)', description: 'Total number of annual transaction attempts', type: 'number' },
      { id: 'avgDiscountByAbusers', label: 'Average Discount Achieved by Abusers (%)', description: 'Average discount percentage claimed by abusers', type: 'percentage' },
      { id: 'promotionAbuseCatchRateToday', label: 'Estimated Promotion Abuse Catch Rate Today (%)', description: 'Estimated current promotion abuse catch rate', type: 'percentage' },
      { id: 'amerGrossMarginPercent', label: 'Gross Margin (%)', description: 'Gross profit margin for profitability calculation', type: 'percentage' },
    ],
    forterKPIs: [
      { id: 'forterCatchRate', label: 'Promotion Abuse Catch Rate (%)', description: 'Expected catch rate for promotion abuse with Forter', type: 'percentage', defaultValue: 90 },
      { id: 'abuseAovMultiplier', label: 'Abuse AoV Multiplier (x)', description: 'Multiplier for abuse order value vs average', type: 'number', defaultValue: 1.5 },
    ],
    abuseBenchmarkInputs: [
      { field: 'promotionAbuseAsGMVPct', label: 'Promotion abuse as % of GMV (%)', description: 'Estimated promotion abuse as percentage of GMV', type: 'percentage', defaultValue: 2 },
    ],
  },
  'c12-ato-opex': {
    calculatorId: 'c12-ato-opex',
    calculatorName: 'ATO protection OpEx savings',
    requiredInputs: [
      { id: 'monthlyLogins', label: 'Monthly Number of Logins (#)', description: 'Total number of login attempts per month', type: 'number' },
      { id: 'avgHandlingTimePerATOClaim', label: 'Avg. Handling Time per ATO Claim (mins)', description: 'Average time to handle an ATO claim', type: 'number' },
      { id: 'avgSalaryPerCSMember', label: 'Avg. Salary per CS Member ($/year)', description: 'Average annual salary per CS team member', type: 'currency' },
    ],
    forterKPIs: [
      { id: 'pctFraudulentLogins', label: '% of Fraudulent Logins', description: 'Percentage of logins that are fraudulent', type: 'percentage', defaultValue: 1 },
      { id: 'atoCatchRate', label: 'ATO Catch Rate (%)', description: 'Expected ATO catch rate with Forter', type: 'percentage', defaultValue: 90 },
    ],
  },
  'c13-clv': {
    calculatorId: 'c13-clv',
    calculatorName: 'Mitigate CLV loss from ATO',
    requiredInputs: [
      { id: 'monthlyLogins', label: 'Monthly Number of Logins (#)', description: 'Total number of login attempts per month', type: 'number' },
      { id: 'customerLTV', label: 'Customer Lifetime Value (CLV) - GMV ($)', description: 'Average lifetime value of a customer', type: 'currency' },
      { id: 'pctChurnFromATO', label: '% of Users that Churn from ATO (%)', description: 'Percentage of ATO victims who churn', type: 'percentage' },
    ],
    forterKPIs: [
      { id: 'pctFraudulentLogins', label: '% of Fraudulent Logins', description: 'Percentage of logins that are fraudulent', type: 'percentage', defaultValue: 1 },
      { id: 'churnLikelihoodFromATO', label: 'Churn Likelihood from ATO (%)', description: 'Likelihood that ATO victim will churn', type: 'percentage', defaultValue: 50 },
      { id: 'atoCatchRate', label: 'ATO Catch Rate (%)', description: 'Expected ATO catch rate with Forter', type: 'percentage', defaultValue: 90 },
    ],
  },
  'c14-marketing': {
    calculatorId: 'c14-marketing',
    calculatorName: 'Protect marketing budget',
    requiredInputs: [
      { id: 'monthlySignups', label: 'Monthly Number of Sign-ups (#)', description: 'Number of new account signups per month', type: 'number' },
      { id: 'avgNewMemberBonus', label: 'Average New Member Bonus/Discount ($)', description: 'Average value of new member promotional bonus', type: 'currency' },
    ],
    forterKPIs: [
      { id: 'pctFraudulentSignups', label: '% of Fraudulent Signups', description: 'Percentage of signups that are fraudulent', type: 'percentage', defaultValue: 10 },
      { id: 'forterFraudulentSignupReduction', label: 'Fraud Signup Reduction (%)', description: 'Expected reduction in fraudulent signups with Forter', type: 'percentage', defaultValue: 95 },
    ],
  },
  'c14-kyc': {
    calculatorId: 'c14-kyc',
    calculatorName: 'KYC verification savings',
    requiredInputs: [
      { id: 'monthlySignups', label: 'Monthly Number of Sign-ups (#)', description: 'Number of new account signups per month', type: 'number' },
      { id: 'avgKYCCostPerAccount', label: 'Avg. KYC Cost per Account ($)', description: 'Cost of KYC verification per account', type: 'currency' },
      { id: 'pctAccountsGoingThroughKYC', label: '% of Accounts Going Through KYC (%)', description: 'Percentage of accounts currently requiring KYC', type: 'percentage' },
    ],
    forterKPIs: [
      { id: 'forterKYCReduction', label: 'Target KYC Reduction (%)', description: 'Expected reduction in KYC requirements with Forter', type: 'percentage', defaultValue: 80 },
    ],
  },
  'c14-reactivation': {
    calculatorId: 'c14-reactivation',
    calculatorName: 'Reduce re-activation costs',
    requiredInputs: [
      { id: 'monthlySignups', label: 'Monthly Number of Sign-ups (#)', description: 'Number of new account signups per month', type: 'number' },
      { id: 'numDigitalCommunicationsPerYear', label: 'Digital Communications per Year (#)', description: 'Number of digital communications (email, SMS) sent per year to users', type: 'number' },
      { id: 'avgCostPerOutreach', label: 'Avg. Cost per Outreach ($)', description: 'Average cost per outreach (email, SMS)', type: 'currency' },
    ],
    forterKPIs: [
      { id: 'pctFraudulentSignups', label: 'Percent of Fraudulent Sign-ups (e.g. duplicate) (%)', description: 'Estimated benchmark: % of signups that are fraudulent (Forter assumption)', type: 'percentage', defaultValue: 10 },
      { id: 'forterFraudulentSignupReduction', label: 'Fraud Signup Reduction (%)', description: 'Expected reduction in fraudulent signups with Forter', type: 'percentage', defaultValue: 95 },
    ],
  },
};

interface CalculatorInputsTabProps {
  calculatorId: string;
  formData: CalculatorData;
  onFormDataChange: (field: keyof CalculatorData, value: number) => void;
  onForterKPIChange?: (field: keyof ForterKPIs, value: number | AbuseBenchmarks) => void;
  currency?: string;
}

export const CalculatorInputsTab = ({
  calculatorId,
  formData,
  onFormDataChange,
  onForterKPIChange,
  currency = 'USD',
}: CalculatorInputsTabProps) => {
  const config = CALCULATOR_REQUIRED_INPUTS[calculatorId];
  const forterKPIs = formData.forterKPIs || defaultForterKPIs;
  
  // Calculate completion status for customer inputs (optional fields don't count as required for progress)
  const inputStatus = useMemo(() => {
    if (!config) return { completed: 0, total: 0, missingInputs: [], completedInputs: [], requiredInputs: [] };
    
    const missingInputs: RequiredInput[] = [];
    const completedInputs: RequiredInput[] = [];
    const requiredInputs = config.requiredInputs.filter(i => !i.optional);
    
    config.requiredInputs.forEach(input => {
      const value = formData[input.id];
      const hasValue = value !== undefined && value !== null && value !== '' && (typeof value !== 'number' || !Number.isNaN(value));
      if (hasValue) {
        completedInputs.push(input);
      } else if (!input.optional) {
        missingInputs.push(input);
      }
    });
    
    const requiredCompleted = requiredInputs.filter(r => {
      const value = formData[r.id];
      return value !== undefined && value !== null && value !== '' && (typeof value !== 'number' || !Number.isNaN(value));
    }).length;
    
    return {
      completed: requiredCompleted,
      total: requiredInputs.length,
      missingInputs,
      completedInputs,
      requiredInputs,
    };
  }, [config, formData]);
  
  const progressPercentage = inputStatus.total > 0 
    ? (inputStatus.completed / inputStatus.total) * 100 
    : 0;
  
  const isComplete = inputStatus.completed === inputStatus.total && inputStatus.total > 0;
  
  if (!config) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No input configuration available for this calculator.</p>
      </div>
    );
  }
  
  // Get currency symbol
  const currencySymbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  
  // Render input field based on type: green = complete, yellow = required & missing, neutral = optional & empty
  const renderInputField = (input: RequiredInput, isHighlighted: boolean, isOptionalEmpty?: boolean) => {
    const value = formData[input.id] as number | undefined;
    const displayLabel = input.label.replace('$', currencySymbol);
    const isComplete = !isHighlighted && !isOptionalEmpty;

    const borderBgClass = isHighlighted
      ? 'border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/30'
      : isOptionalEmpty
        ? 'border-border bg-muted/30 dark:bg-muted/20'
        : 'border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20';

    return (
      <div key={input.id} className={`p-4 rounded-lg border transition-colors ${borderBgClass}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {isHighlighted ? (
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              ) : isComplete ? (
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              ) : (
                <span className="w-4 h-4 flex-shrink-0" />
              )}
              <Label className="font-medium">{displayLabel}</Label>
              {isHighlighted && (
                <Badge variant="outline" className="text-xs border-amber-300 text-amber-600">
                  Required
                </Badge>
              )}
              {isOptionalEmpty && input.optional && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  Optional
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground ml-6">{input.description}</p>
          </div>
          <div className={cn("flex-shrink-0", input.type === 'percentage' ? "min-w-[260px] w-[260px]" : "w-40")}>
            {input.type === 'percentage' ? (
              <PercentageInput
                value={value ?? 0}
                onChange={(v) => onFormDataChange(input.id, v)}
                min={input.min ?? 0}
                max={input.max ?? 100}
                className={cn('text-right', isHighlighted ? 'border-amber-300 focus:border-amber-500' : '')}
              />
            ) : (
              <NumericInput
                value={value ?? 0}
                onChange={(v) => onFormDataChange(input.id, v)}
                placeholder={input.type === 'currency' ? currencySymbol + '0' : '0'}
                formatWithCommas={true}
                className={cn('text-right', isHighlighted ? 'border-amber-300 focus:border-amber-500' : '')}
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render Forter KPI input field: green = complete (value set), yellow = required & missing
  const renderKPIField = (kpiInput: ForterKPIInput) => {
    const value = forterKPIs[kpiInput.id] as number | undefined;
    const hasValue = value !== undefined && value !== null && (typeof value !== 'number' || !Number.isNaN(value));
    const isComplete = hasValue;

    const borderBgClass = isComplete
      ? 'border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20'
      : 'border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/30';

    return (
      <div key={kpiInput.id} className={`p-4 rounded-lg border transition-colors ${borderBgClass}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {isComplete ? (
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              )}
              <Label className="font-medium">{kpiInput.label}</Label>
              {!isComplete && (
                <Badge variant="outline" className="text-xs border-amber-300 text-amber-600">
                  Required
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground ml-6">{kpiInput.description}</p>
          </div>
          <div className={cn("flex-shrink-0", kpiInput.type === 'percentage' ? "min-w-[260px] w-[260px]" : "w-40")}>
            {kpiInput.type === 'percentage' ? (
              <PercentageInput
                value={value ?? kpiInput.defaultValue}
                onChange={(v) => onForterKPIChange?.(kpiInput.id, v)}
                min={kpiInput.min ?? 0}
                max={kpiInput.max ?? 100}
                className={cn('text-right', !isComplete ? 'border-amber-300 focus:border-amber-500' : '')}
              />
            ) : (
              <NumericInput
                value={value ?? kpiInput.defaultValue}
                onChange={(v) => onForterKPIChange?.(kpiInput.id, v)}
                placeholder="0"
                formatWithCommas={true}
                className={cn('text-right', !isComplete ? 'border-amber-300 focus:border-amber-500' : '')}
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render abuse benchmark field (stored in forterKPIs.abuseBenchmarks)
  const renderAbuseBenchmarkField = (bmInput: AbuseBenchmarkInput) => {
    const benchmarks = forterKPIs.abuseBenchmarks || defaultAbuseBenchmarks;
    const value = benchmarks[bmInput.field] as number | undefined;
    const hasValue = value !== undefined && value !== null && (typeof value !== 'number' || !Number.isNaN(value));
    const isComplete = hasValue;
    const borderBgClass = isComplete
      ? 'border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20'
      : 'border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/30';
    const displayLabel = bmInput.label.replace('$', currencySymbol);

    const handleChange = (v: number) => {
      const updated: AbuseBenchmarks = { ...benchmarks, [bmInput.field]: v };
      onForterKPIChange?.('abuseBenchmarks' as keyof ForterKPIs, updated);
    };

    return (
      <div key={bmInput.field} className={`p-4 rounded-lg border transition-colors ${borderBgClass}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {isComplete ? (
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              )}
              <Label className="font-medium">{displayLabel}</Label>
              {!isComplete && (
                <Badge variant="outline" className="text-xs border-amber-300 text-amber-600">
                  Required
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground ml-6">{bmInput.description}</p>
          </div>
          <div className={cn("flex-shrink-0", bmInput.type === 'percentage' ? "min-w-[260px] w-[260px]" : "w-40")}>
            {bmInput.type === 'percentage' ? (
              <PercentageInput
                value={value ?? bmInput.defaultValue ?? 0}
                onChange={handleChange}
                min={bmInput.min ?? 0}
                max={bmInput.max ?? 100}
                className={cn('text-right', !isComplete ? 'border-amber-300 focus:border-amber-500' : '')}
              />
            ) : (
              <NumericInput
                value={value ?? bmInput.defaultValue ?? 0}
                onChange={handleChange}
                placeholder={bmInput.type === 'currency' ? currencySymbol + '0' : '0'}
                formatWithCommas={true}
                className={cn('text-right', !isComplete ? 'border-amber-300 focus:border-amber-500' : '')}
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {inputStatus.completed} of {inputStatus.total} inputs complete
            </span>
            {isComplete && (
              <Badge className="bg-green-100 text-green-700 border-green-200">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Ready
              </Badge>
            )}
          </div>
        </div>
        <Progress value={progressPercentage} className="h-2" />
        {!isComplete && (
          <p className="text-xs text-muted-foreground mt-2">
            Complete the highlighted fields below to unlock the calculator
          </p>
        )}
      </Card>
      
      {/* Customer Input Fields Section */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Customer Inputs</h4>
        {/* Render all inputs in original order: green = complete, yellow = required & missing, neutral = optional & empty */}
        {config.requiredInputs.map(input => {
          const isMissing = inputStatus.missingInputs.some(mi => mi.id === input.id);
          const isOptionalEmpty = input.optional && (formData[input.id] === undefined || formData[input.id] === null || formData[input.id] === '');
          const isHighlighted = !input.optional && isMissing;
          return renderInputField(input, isHighlighted, isOptionalEmpty);
        })}
      </div>

      {/* Abuse Benchmark Inputs Section - for returns/INR abuse calculators */}
      {config.abuseBenchmarkInputs && config.abuseBenchmarkInputs.length > 0 && (
        <>
          <Separator className="my-4" />
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Abuse Benchmarks
            </h4>
            <p className="text-xs text-muted-foreground">
              Egregious / non-egregious abuse population and Forter reduction assumptions used in the calculator.
            </p>
            {config.abuseBenchmarkInputs.map(bm => renderAbuseBenchmarkField(bm))}
          </div>
        </>
      )}
      
      {/* Forter KPI Fields Section - only show if there are KPIs for this calculator */}
      {config.forterKPIs && config.forterKPIs.length > 0 && (
        <>
          <Separator className="my-4" />
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              Forter Performance Assumptions
            </h4>
            <p className="text-xs text-muted-foreground">
              These targets determine the expected improvement with Forter. Adjust to match your assumptions.
            </p>
            {config.forterKPIs.map(kpi => renderKPIField(kpi))}
          </div>
        </>
      )}
    </div>
  );
};

// Helper function to check if a calculator has missing inputs (only required, non-optional inputs)
export const hasCalculatorMissingInputs = (
  calculatorId: string,
  formData: CalculatorData
): boolean => {
  const config = CALCULATOR_REQUIRED_INPUTS[calculatorId];
  if (!config) return false;

  const requiredInputs = config.requiredInputs.filter(i => !i.optional);
  return requiredInputs.some(input => {
    const value = formData[input.id];
    return value === undefined || value === null || value === '' || (typeof value === 'number' && Number.isNaN(value));
  });
};

// Helper function to get completion percentage (only required, non-optional inputs)
export const getCalculatorCompletionPercentage = (
  calculatorId: string,
  formData: CalculatorData
): number => {
  const config = CALCULATOR_REQUIRED_INPUTS[calculatorId];
  if (!config) return 100;

  const requiredInputs = config.requiredInputs.filter(i => !i.optional);
  if (requiredInputs.length === 0) return 100;

  const completed = requiredInputs.filter(input => {
    const value = formData[input.id];
    return value !== undefined && value !== null && value !== '' && (typeof value !== 'number' || !Number.isNaN(value));
  }).length;

  return (completed / requiredInputs.length) * 100;
};