// Input validation configuration for calculator fields
// Returns warning message if value is outside valid range, null otherwise

export interface ValidationRule {
  min: number;
  max: number;
  warningMessage: string;
}

// Standard percentage fields (0-100%)
const standardPercentRule: ValidationRule = {
  min: 0,
  max: 100,
  warningMessage: "Value should be between 0-100%",
};

// Chargeback rate fields (0-10%)
const chargebackRateRule: ValidationRule = {
  min: 0,
  max: 10,
  warningMessage: "Chargeback rates typically range 0-10% — please review",
};

// Validation rules by field name
export const validationRules: Record<string, ValidationRule> = {
  // Approval rates
  amerPreAuthApprovalRate: standardPercentRule,
  amerPostAuthApprovalRate: standardPercentRule,
  emeaPreAuthApprovalRate: standardPercentRule,
  emeaPostAuthApprovalRate: standardPercentRule,
  apacPreAuthApprovalRate: standardPercentRule,
  apacPostAuthApprovalRate: standardPercentRule,
  approvalRateImprovement: standardPercentRule,
  preAuthApprovalImprovement: standardPercentRule,
  postAuthApprovalImprovement: standardPercentRule,

  // Credit card / 3DS
  amerCreditCardPct: standardPercentRule,
  emeaCreditCardPct: standardPercentRule,
  apacCreditCardPct: standardPercentRule,
  amer3DSChallengeRate: standardPercentRule,
  emea3DSChallengeRate: standardPercentRule,
  apac3DSChallengeRate: standardPercentRule,
  amer3DSAbandonmentRate: standardPercentRule,
  emea3DSAbandonmentRate: standardPercentRule,
  apac3DSAbandonmentRate: standardPercentRule,
  threeDSReduction: standardPercentRule,

  // Issuing bank declines
  amerIssuingBankDeclineRate: standardPercentRule,
  emeaIssuingBankDeclineRate: standardPercentRule,
  apacIssuingBankDeclineRate: standardPercentRule,

  // Commission / margin
  commissionRate: standardPercentRule,
  amerGrossMarginPercent: standardPercentRule,
  emeaGrossMarginPercent: standardPercentRule,
  apacGrossMarginPercent: standardPercentRule,

  // Manual review
  manualReviewPct: standardPercentRule,
  amerManualReviewRate: standardPercentRule,
  emeaManualReviewRate: standardPercentRule,
  apacManualReviewRate: standardPercentRule,
  manualReviewReduction: standardPercentRule,

  // Chargeback rates (0-10%)
  fraudCBRate: chargebackRateRule,
  emeaFraudCBRate: chargebackRateRule,
  apacFraudCBRate: chargebackRateRule,
  serviceCBRate: chargebackRateRule,
  chargebackReduction: chargebackRateRule,

  // Dispute rates & win rates
  fraudDisputeRate: standardPercentRule,
  fraudWinRate: standardPercentRule,
  serviceDisputeRate: standardPercentRule,
  serviceWinRate: standardPercentRule,
  fraudDisputeRateImprovement: standardPercentRule,
  fraudWinRateChange: standardPercentRule,
  serviceDisputeRateImprovement: standardPercentRule,
  serviceWinRateChange: standardPercentRule,

  // Abuse prevention percentages
  refundRate: standardPercentRule,
  pctINRClaims: standardPercentRule,
  pctReplacedCredits: standardPercentRule,
  txProcessingFeePct: standardPercentRule,

  // Forter KPI percentages
  forterCatchRate: standardPercentRule,
  disputeTimeReduction: standardPercentRule,
};

/**
 * Validates a value against the rule for a given field
 * @returns Warning message if invalid, null if valid or no rule exists
 */
export function getValidationWarning(
  fieldName: string,
  value: number | undefined | null,
): string | null {
  if (value === undefined || value === null) return null;

  const rule = validationRules[fieldName];
  if (!rule) return null;

  if (value < rule.min || value > rule.max) {
    return rule.warningMessage;
  }

  return null;
}
