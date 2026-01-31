/**
 * Strategic Objectives -> Use Cases -> Challenges Mapping
 * Based on the spreadsheet mapping structure (Column C = Strategic Objectives, Column D = Use Cases)
 */

export type StrategicObjectiveId = 
  | 'revenue_growth'
  | 'customer_experience'
  | 'automation'
  | 'cost_reduction'
  | 'risk_mitigation';

export interface StrategicObjective {
  id: StrategicObjectiveId;
  name: string;
  description: string;
  icon: string;
}

export interface UseCase {
  id: string;
  name: string;
  description: string;
  challengeIds: string[]; // Maps to challenge IDs (e.g., '1', '2', '3')
  strategicObjectives: StrategicObjectiveId[];
}

// Strategic Objectives
export const STRATEGIC_OBJECTIVES: StrategicObjective[] = [
  {
    id: 'revenue_growth',
    name: 'Revenue Growth',
    description: 'Increase top-line revenue through improved approval rates and reduced friction',
    icon: 'TrendingUp',
  },
  {
    id: 'customer_experience',
    name: 'Customer Experience',
    description: 'Enhance customer satisfaction and reduce abandonment',
    icon: 'Users',
  },
  {
    id: 'automation',
    name: 'Automation',
    description: 'Reduce manual processes and improve operational efficiency',
    icon: 'Zap',
  },
  {
    id: 'cost_reduction',
    name: 'Cost Reduction',
    description: 'Lower operational costs and reduce losses',
    icon: 'PiggyBank',
  },
  {
    id: 'risk_mitigation',
    name: 'Risk Mitigation',
    description: 'Protect against fraud, abuse, and account takeover',
    icon: 'Shield',
  },
];

// Use Cases with their challenge mappings and strategic objectives
// Based on spreadsheet Column C (Strategic Objectives) and Column D (Use Cases)
export const USE_CASES: UseCase[] = [
  // Challenge 1: Reduce false fraud declines
  // Strategic Objectives: Revenue Growth; Customer Experience; Automation
  {
    id: 'reduce_false_declines',
    name: 'Reduce false fraud declines',
    description: 'Approve more legitimate transactions by reducing false positives',
    challengeIds: ['1'],
    strategicObjectives: ['revenue_growth', 'customer_experience', 'automation'],
  },
  // Challenge 2: Dynamic checkout experience
  // Strategic Objectives: Revenue Growth; Customer Experience; Automation
  {
    id: 'dynamic_checkout',
    name: 'Dynamic checkout experience',
    description: 'Optimize checkout flow based on customer risk profile',
    challengeIds: ['2'],
    strategicObjectives: ['revenue_growth', 'customer_experience', 'automation'],
  },
  // Challenge 3: Automate payment fraud operations
  // Strategic Objectives: Customer Experience; Automation; Cost Reduction
  {
    id: 'automate_fraud_operations',
    name: 'Automate payment fraud operations',
    description: 'Replace manual review processes with automated decisioning',
    challengeIds: ['3'],
    strategicObjectives: ['customer_experience', 'automation', 'cost_reduction'],
  },
  // Challenges 4 & 5: Smarter 3DS authentication
  // Strategic Objectives: Revenue Growth; Customer Experience; Automation
  {
    id: 'smarter_3ds',
    name: 'Smarter 3DS authentication',
    description: 'Reduce authentication friction while maintaining security',
    challengeIds: ['4', '5'],
    strategicObjectives: ['revenue_growth', 'customer_experience', 'automation'],
  },
  // Challenge 6: Intelligent payment routing (NOT IN GVA YET)
  // Strategic Objectives: Revenue Growth; Customer Experience; Automation
  {
    id: 'intelligent_routing',
    name: 'Intelligent payment routing',
    description: 'Optimize processor flow with predictive routing',
    challengeIds: ['6'],
    strategicObjectives: ['revenue_growth', 'customer_experience', 'automation'],
  },
  // Challenge 7: Intelligent chargeback recovery
  // Strategic Objectives: Revenue Growth; Automation; Cost Reduction
  {
    id: 'chargeback_recovery',
    name: 'Intelligent chargeback recovery',
    description: 'Recover more revenue and reduce dispute handling costs',
    challengeIds: ['7'],
    strategicObjectives: ['revenue_growth', 'automation', 'cost_reduction'],
  },
  // Challenge 8: Policy integrity protection
  // Strategic Objectives: Automation; Cost Reduction; Risk Mitigation
  {
    id: 'policy_integrity',
    name: 'Policy integrity protection',
    description: 'Detect and prevent returns abuse and INR fraud',
    challengeIds: ['8'],
    strategicObjectives: ['automation', 'cost_reduction', 'risk_mitigation'],
  },
  // Challenge 9: Trust based instant refunds
  // Strategic Objectives: Automation; Revenue Growth; Customer Experience; Risk Mitigation
  {
    id: 'instant_refunds',
    name: 'Trust based instant refunds',
    description: 'Offer instant refunds to trusted customers while blocking abusers',
    challengeIds: ['9'],
    strategicObjectives: ['automation', 'revenue_growth', 'customer_experience', 'risk_mitigation'],
  },
  // Challenge 10 & 11: Promotion incentives optimization (combined - Promotion Abuse + Reseller/Reshipper)
  // Strategic Objectives: Revenue Growth; Customer Experience; Automation
  {
    id: 'promotion_optimization',
    name: 'Promotion incentives optimization',
    description: 'Protect promotional ROI and prevent unauthorized reselling',
    challengeIds: ['10', '11'],
    strategicObjectives: ['revenue_growth', 'customer_experience', 'automation'],
  },
  // Challenge 12 & 13: Loyalty account protection (combined - ATO OpEx + CLV)
  // Strategic Objectives: Revenue Growth; Customer Experience; Automation; Cost Reduction; Risk Mitigation
  {
    id: 'loyalty_protection',
    name: 'Loyalty account protection',
    description: 'Protect accounts from takeover and reduce remediation costs',
    challengeIds: ['12', '13'],
    strategicObjectives: ['revenue_growth', 'customer_experience', 'automation', 'cost_reduction', 'risk_mitigation'],
  },
  // Challenge 14 & 15: New customer verification (combined - Sign-up abuse + KYC optimization)
  // Strategic Objectives: Automation; Cost Reduction; Risk Mitigation
  {
    id: 'new_customer_verification',
    name: 'New customer verification',
    description: 'Block fake accounts and optimize KYC costs',
    challengeIds: ['14', '15'],
    strategicObjectives: ['automation', 'cost_reduction', 'risk_mitigation'],
  },
];

/**
 * Get use cases filtered by selected strategic objectives
 */
export function getUseCasesForObjectives(selectedObjectives: StrategicObjectiveId[]): UseCase[] {
  if (selectedObjectives.length === 0) {
    return USE_CASES;
  }
  return USE_CASES.filter(useCase =>
    useCase.strategicObjectives.some(obj => selectedObjectives.includes(obj))
  );
}

/**
 * Get challenge IDs from selected use cases
 */
export function getChallengeIdsFromUseCases(selectedUseCaseIds: string[]): string[] {
  const challengeIds = new Set<string>();
  USE_CASES.forEach(useCase => {
    if (selectedUseCaseIds.includes(useCase.id)) {
      useCase.challengeIds.forEach(id => challengeIds.add(id));
    }
  });
  return Array.from(challengeIds);
}

/**
 * Convert challenge IDs to the selectedChallenges format
 */
export function challengeIdsToSelection(challengeIds: string[]): { [key: string]: boolean } {
  const selection: { [key: string]: boolean } = {};
  challengeIds.forEach(id => {
    selection[id] = true;
  });
  return selection;
}

/**
 * Get use case IDs from selected challenges (reverse mapping)
 */
export function getUseCaseIdsFromChallenges(selectedChallenges: { [key: string]: boolean }): string[] {
  const selectedChallengeIds = Object.entries(selectedChallenges)
    .filter(([_, selected]) => selected)
    .map(([id]) => id);
  
  const useCaseIds = new Set<string>();
  USE_CASES.forEach(useCase => {
    // A use case is selected if any of its challenges are selected
    if (useCase.challengeIds.some(id => selectedChallengeIds.includes(id))) {
      useCaseIds.add(useCase.id);
    }
  });
  return Array.from(useCaseIds);
}
