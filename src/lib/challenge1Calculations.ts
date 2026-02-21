// Re-export from calculations.ts for backward compatibility
export { 
  calculateChallenge1, 
  type Challenge1Inputs, 
  type Challenge1Results,
  type CalculatorRow 
} from './calculations';

// Generate breakdown from Challenge1Results for display
export function generateChallenge1Breakdown(results: import('./calculations').Challenge1Results) {
  const calculations: any[] = [];
  
  // Add Calculator 1 rows
  calculations.push({
    description: "Reduce False Declines",
    current: "",
    impact: "",
    future: "",
    isHeader: true
  });
  
  for (const row of results.calculator1.rows) {
    calculations.push({
      description: `${row.formula ? `[${row.formula}] ` : ''}${row.label}`,
      current: row.customerInput,
      impact: row.forterImprovement,
      future: row.forterOutcome,
      isHighlight: row.valueDriver !== undefined
    });
  }
  
  // Add Calculator 2 rows
  calculations.push({
    description: "Reduce Fraud Chargebacks",
    current: "",
    impact: "",
    future: "",
    isHeader: true
  });
  
  for (const row of results.calculator2.rows) {
    calculations.push({
      description: `${row.formula ? `[${row.formula}] ` : ''}${row.label}`,
      current: row.customerInput,
      impact: row.forterImprovement,
      future: row.forterOutcome,
      isHighlight: row.valueDriver !== undefined
    });
  }
  
  return calculations;
}

// Map CalculatorData to Challenge1Inputs
export function mapCalculatorDataToChallenge1Inputs(
  data: any, 
  forterKPIs: any
): import('./calculations').Challenge1Inputs {
  const totalGMV = (data.amerAnnualGMV || 0) + (data.emeaAnnualGMV || 0) + (data.apacAnnualGMV || 0);
  const transactionAttempts = data.transactionAttempts || Math.round(totalGMV / 100); // Estimate if not provided
  
  return {
    transactionAttempts,
    transactionAttemptsValue: totalGMV,
    grossMarginPercent: data.grossMargin || 30,
    approvalRate: data.amerPreAuthApprovalRate || 95,
    fraudChargebackRate: data.fraudCBRate || 0.8,
    completedAOV: data.completedAOV,
    forterCompletedAOV: forterKPIs.forterCompletedAOV,
    forterApprovalRateImprovement: forterKPIs.approvalRateImprovement || 4,
    forterChargebackReduction: forterKPIs.chargebackReduction || 50,
  };
}
