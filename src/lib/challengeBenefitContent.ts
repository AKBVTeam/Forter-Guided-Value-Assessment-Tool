/**
 * Challenge and Benefit content for calculator modal explainability
 * Each calculator has an associated challenge (problem) and benefit (solution)
 * Content sourced from spreadsheet columns H and I on each challenge sheet
 */

export interface ChallengeBenefitContent {
  calculatorId: string;
  challengeTitle: string;
  challengeDescription: string;
  benefitTitle: string;
  benefitDescription: string;
  benefitPoints?: { title: string; description: string }[];
}

export const CHALLENGE_BENEFIT_CONTENT: ChallengeBenefitContent[] = [
  // Challenge 1: Reduce false declines (Pre-auth only) - GMV uplift
  {
    calculatorId: 'c1-revenue',
    challengeTitle: 'False Fraud Declines',
    challengeDescription: 'Many fraud systems are overly sensitive, incorrectly flagging and blocking legitimate customers as high-risk. This creates a significant "silent killer" of revenue where the merchant loses out on valid sales and potentially damages the long-term relationship with a customer who was unfairly rejected.',
    benefitTitle: 'Reduce False Fraud Declines',
    benefitDescription: 'Automated decisioning allows merchants to say "yes" to more good customers, instantly capturing incremental revenue that was previously being left on the table.',
    benefitPoints: [
      { title: 'Revenue Growth', description: 'Directly increases top-line sales by converting more traffic into successful orders.' },
      { title: 'Customer Loyalty', description: 'Ensures a seamless experience for legitimate buyers, reducing churn caused by accidental blocks.' },
    ],
  },
  // Challenge 1: Reduce fraud chargebacks - Cost reduction
  {
    calculatorId: 'c1-chargeback',
    challengeTitle: 'Fraud Chargeback Losses',
    challengeDescription: 'Managing the financial impact of successful fraud is a constant struggle, as every chargeback results in the loss of both the goods and the transaction value. Merchants often find themselves caught between accepting high fraud rates or implementing strict rules that stifle growth and conversion.',
    benefitTitle: 'Reduce Fraud Chargebacks',
    benefitDescription: 'The solution provides highly accurate, real-time fraud decisions that stop bad actors before the transaction is even processed.',
    benefitPoints: [
      { title: 'Profit Preservation', description: 'Drastically lowers the gross fraud chargeback rate, keeping more money in the business.' },
      { title: 'Risk Mitigation', description: 'Provides a secure environment that allows the business to scale into new markets without fear of increased fraud exposure.' },
    ],
  },
  // Challenge 2/4/5: Pre-auth + 3DS optimization - GMV uplift
  {
    calculatorId: 'c245-revenue',
    challengeTitle: 'Payment Friction & Abandonment',
    challengeDescription: 'Regulations like PSD2 introduce friction through mandatory Strong Customer Authentication (SCA), which often leads to high cart abandonment and 3DS failures. Many merchants lack the sophisticated data needed to intelligently request exemptions, causing unnecessary hurdles for low-risk transactions.',
    benefitTitle: 'Payment Friction Optimization',
    benefitDescription: 'The solution optimizes the payment flow by intelligently applying SCA exemptions where risk is low, ensuring a frictionless checkout for the majority of users.',
    benefitPoints: [
      { title: 'Reduced Friction', description: 'Lowers abandonment rates by bypassing 3DS for trusted customers.' },
      { title: 'Improved Conversion', description: 'Increases overall transaction success rates by balancing regulatory compliance with a smooth user experience.' },
    ],
  },
  // Challenge 2/4/5: Reduce fraud chargebacks - Cost reduction
  {
    calculatorId: 'c245-chargeback',
    challengeTitle: 'Fraud Chargeback Losses',
    challengeDescription: 'Managing the financial impact of successful fraud is a constant struggle, as every chargeback results in the loss of both the goods and the transaction value. Merchants often find themselves caught between accepting high fraud rates or implementing strict rules that stifle growth and conversion.',
    benefitTitle: 'Reduce Fraud Chargebacks',
    benefitDescription: 'The solution provides highly accurate, real-time fraud decisions that stop bad actors before the transaction is even processed.',
    benefitPoints: [
      { title: 'Profit Preservation', description: 'Drastically lowers the gross fraud chargeback rate, keeping more money in the business.' },
      { title: 'Risk Mitigation', description: 'Provides a secure environment that allows the business to scale into new markets without fear of increased fraud exposure.' },
    ],
  },
  // Challenge 3: Manual review - Cost reduction
  {
    calculatorId: 'c3-review',
    challengeTitle: 'Manual Review Bottleneck',
    challengeDescription: 'Relying on human teams to manually review "gray area" transactions is slow, expensive, and impossible to scale during peak shopping seasons like Black Friday. This bottleneck delays order fulfillment and forces merchants to choose between high labor costs or slow customer service.',
    benefitTitle: 'Automate Payment Fraud Operations',
    benefitDescription: 'By automating 100% of decisions, the solution removes the need for manual intervention, providing instant "approve" or "decline" results.',
    benefitPoints: [
      { title: 'Operational Savings', description: 'Eliminates the heavy overhead costs associated with staffing and training a manual review team.' },
      { title: 'Faster Fulfillment', description: 'Shortens the time from "order placed" to "order shipped," significantly improving customer satisfaction.' },
    ],
  },
  // Challenge 7: Chargeback disputes - Revenue recovery
  {
    calculatorId: 'c7-disputes',
    challengeTitle: 'Low Chargeback Recovery Rates',
    challengeDescription: 'Disputing chargebacks—especially "friendly fraud" or service disputes—is a time-consuming administrative burden that often results in low win rates. Merchants frequently lose these disputes simply because they lack the organized, compelling evidence required by banks to prove the transaction was valid.',
    benefitTitle: 'Intelligent Chargeback Recovery',
    benefitDescription: 'The solution automates the representment process, using vast identity data to build winning cases against illegitimate chargebacks.',
    benefitPoints: [
      { title: 'Increased Recovery', description: 'Boosts the total amount of revenue recovered from "liar buyers" and service-related claims.' },
      { title: 'Efficiency Gains', description: 'Reduces the hours your team spends on manual data collection and submission for each dispute.' },
    ],
  },
  // Challenge 7: Chargeback disputes - OpEx
  {
    calculatorId: 'c7-opex',
    challengeTitle: 'Low Chargeback Recovery Rates',
    challengeDescription: 'Disputing chargebacks—especially "friendly fraud" or service disputes—is a time-consuming administrative burden that often results in low win rates. Merchants frequently lose these disputes simply because they lack the organized, compelling evidence required by banks to prove the transaction was valid.',
    benefitTitle: 'Improve Recovery Efficiency (OpEx)',
    benefitDescription: 'The solution automates the representment process, using vast identity data to build winning cases against illegitimate chargebacks.',
    benefitPoints: [
      { title: 'Increased Recovery', description: 'Boosts the total amount of revenue recovered from "liar buyers" and service-related claims.' },
      { title: 'Efficiency Gains', description: 'Reduces the hours your team spends on manual data collection and submission for each dispute.' },
    ],
  },
  // Challenge 8: Returns abuse
  {
    calculatorId: 'c8-returns',
    challengeTitle: 'Returns Abuse & Wardrobing',
    challengeDescription: 'Serial returners and "wardrobing" (buying items to wear once and return) can devastate margins by spoiling stock and creating immense reverse logistics costs. Merchants often struggle to identify these patterns at the point of sale, leading to a "death by a thousand cuts" as inventory is tied up or rendered unsellable.',
    benefitTitle: 'Block/Dissuade Returns Abusers',
    benefitDescription: 'The solution identifies known return abusers before they checkout, allowing merchants to dynamically adjust return policies or block the transaction entirely.',
    benefitPoints: [
      { title: 'Inventory Protection', description: 'Recoups the value of goods that would otherwise be lost to non-restockable returns or seasonal spoilage.' },
      { title: 'Logistics Savings', description: 'Protects profit margins by reducing the shipping and processing fees associated with high-volume abusive returns.' },
    ],
  },
  // Challenge 8: INR abuse
  {
    calculatorId: 'c8-inr',
    challengeTitle: 'INR (Item Not Received) Fraud',
    challengeDescription: '"Item Not Received" (INR) abuse is a growing trend where customers claim they never received a package to secure a fraudulent refund or replacement. Without clear identity data, merchants are often forced to take the loss, paying for both the original item and the replacement or refund.',
    benefitTitle: 'Block/Dissuade INR Abusers',
    benefitDescription: 'The identity network tracks personas across the ecosystem to flag individuals with a history of filing false INR claims.',
    benefitPoints: [
      { title: 'Liability Reduction', description: 'Directly reduces the merchant\'s financial liability for fraudulent claims and "friendly fraud" theft.' },
      { title: 'Policy Integrity', description: 'Allows maintaining a generous "goodwill" policy for genuine customers while shielding the business from professional scammers.' },
    ],
  },
  // Challenge 9: Instant refunds - CX uplift
  {
    calculatorId: 'c9-cx-uplift',
    challengeTitle: 'Delayed Refund Experience',
    challengeDescription: 'Delayed refund cycles are a top customer complaint, but merchants often hold funds for weeks to verify returns and avoid fraud. This lack of trust creates a friction-filled post-purchase experience that prevents customers from feeling confident enough to make a repeat purchase immediately.',
    benefitTitle: 'Instant Refunds CX Uplift',
    benefitDescription: 'By identifying trusted identities in real-time, the solution allows merchants to safely offer instant refunds to their best customers, turning a standard return into a loyalty-building moment.',
    benefitPoints: [
      { title: 'Higher CLV', description: 'Drives a significant increase in repurchase rates from customers who appreciate the immediate liquidity.' },
      { title: 'Competitive Edge', description: 'Differentiates your brand by offering a superior service level that encourages customers to shop with you over competitors.' },
    ],
  },
  // Challenge 9: Instant refunds - CS OpEx
  {
    calculatorId: 'c9-cs-opex',
    challengeTitle: 'Refund Inquiry Overhead',
    challengeDescription: '"Where is my refund?" is one of the most common and expensive inquiries for customer service teams to handle. Manually processing refund requests and managing the resulting back-and-forth communication consumes hundreds of hours of agent time every month.',
    benefitTitle: 'Reduced CS Ticket Handling OpEx',
    benefitDescription: 'Automating the refund decisioning process reduces the volume of status-related inquiries and manual approvals required from your staff.',
    benefitPoints: [
      { title: 'OpEx Reduction', description: 'Lowers the cost per ticket and the total number of support agents needed to manage post-purchase disputes.' },
      { title: 'Operational Efficiency', description: 'Reallocates customer service resources away from administrative tasks and toward high-value customer interactions.' },
    ],
  },
  // Challenge 10/11: Promotion abuse
  {
    calculatorId: 'c10-promotions',
    challengeTitle: 'Promotion & Reseller Abuse',
    challengeDescription: 'Marketing budgets are often drained by individuals creating multiple accounts to exploit one-time promo codes or by professional resellers who "bot" limited-edition stock. This prevents genuine customers from accessing deals and shifts inventory away from your target audience.',
    benefitTitle: 'Promotion Incentives Optimization',
    benefitDescription: 'The identity network links seemingly disparate accounts to the same individual, effectively blocking multi-accounting and reseller activity.',
    benefitPoints: [
      { title: 'Budget Optimization', description: 'Ensures marketing spend and discounts are used to acquire new customers rather than subsidizing abusers.' },
      { title: 'Inventory Integrity', description: 'Keeps high-demand products available for real fans, protecting the brand\'s long-term reputation.' },
    ],
  },
  // Challenge 12: ATO OpEx savings
  {
    calculatorId: 'c12-ato-opex',
    challengeTitle: 'ATO Remediation Costs',
    challengeDescription: 'When accounts are compromised, the operational fallout is massive, requiring manual investigation by fraud teams and high-touch customer support. The costs of resetting accounts, investigating logs, and issuing "appeasement" credits or gift cards to victims can quickly balloon into a major expense.',
    benefitTitle: 'ATO Protection OpEx Savings',
    benefitDescription: 'The solution blocks Account Takeover (ATO) attempts at the front door, preventing the need for expensive post-incident remediation and manual labor.',
    benefitPoints: [
      { title: 'Resource Efficiency', description: 'Eliminates the hundreds of man-hours spent investigating and fixing compromised accounts.' },
      { title: 'Cost Avoidance', description: 'Drastically reduces the "goodwill" payouts and operational overhead associated with account security failures.' },
    ],
  },
  // Challenge 13: ATO CLV loss
  {
    calculatorId: 'c13-clv',
    challengeTitle: 'Customer Trust & Churn Risk',
    challengeDescription: 'A single account breach can permanently destroy a customer\'s trust in a brand, leading to immediate churn. Beyond the direct theft of loyalty points or stored value, the perceived lack of security makes customers hesitant to store payment info or engage with the platform in the future.',
    benefitTitle: 'Mitigate CLV Loss Due to ATO',
    benefitDescription: 'By securing the account journey without adding friction for legitimate owners, the solution preserves the trust that is foundational to long-term customer relationships.',
    benefitPoints: [
      { title: 'Churn Prevention', description: 'Protects high-value customers from leaving the brand due to a negative security experience.' },
      { title: 'LTV Preservation', description: 'Ensures that high-value assets (like loyalty points and credits) remain in the hands of genuine users, encouraging future spending.' },
    ],
  },
  // Challenge 14: Marketing budget protection
  {
    calculatorId: 'c14-marketing',
    challengeTitle: 'Fake Account Acquisition Costs',
    challengeDescription: 'Fake or duplicate sign-ups distort marketing metrics and drain acquisition budgets by allowing abusers to repeatedly claim "new customer" bonuses. When marketing spend is directed toward fraudulent personas rather than unique new users, it artificially inflates Customer Acquisition Costs (CAC) and lowers overall ROI.',
    benefitTitle: 'Protect Marketing Budget',
    benefitDescription: 'The solution accurately identifies unique identities at the point of sign-up, ensuring that acquisition incentives only go to truly new customers.',
    benefitPoints: [
      { title: 'CAC Efficiency', description: 'Increases the efficiency of marketing spend by eliminating the subsidization of fake or duplicate accounts.' },
      { title: 'Accurate Data', description: 'Provides a cleaner view of true customer growth, allowing marketing teams to optimize their strategies based on real users.' },
    ],
  },
  // Challenge 14/15: Re-activation costs
  {
    calculatorId: 'c14-reactivation',
    challengeTitle: 'Wasted Re-activation Spend',
    challengeDescription: 'Fake or duplicate sign-ups distort marketing metrics and drain acquisition budgets by allowing abusers to repeatedly claim "new customer" bonuses. When marketing spend is directed toward fraudulent personas rather than unique new users, it artificially inflates Customer Acquisition Costs (CAC) and lowers overall ROI.',
    benefitTitle: 'Reduce Re-activation Costs',
    benefitDescription: 'The solution accurately identifies unique identities at the point of sign-up, ensuring that acquisition incentives only go to truly new customers.',
    benefitPoints: [
      { title: 'Marketing Efficiency', description: 'Eliminates wasted outreach to fake accounts that will never convert.' },
      { title: 'Budget Optimization', description: 'Reallocates re-engagement spend to genuine dormant customers who may return.' },
    ],
  },
  // Challenge 15: KYC cost optimization
  {
    calculatorId: 'c14-kyc',
    challengeTitle: 'Wasted KYC Verification Spend',
    challengeDescription: 'In industries requiring identity verification, every new sign-up triggers expensive third-party KYC (Know Your Customer) or IDV (Identity Verification) checks. When fraudsters or bots flood the sign-up funnel, merchants end up paying thousands of dollars to verify identities that aren\'t even real.',
    benefitTitle: 'Optimize KYC Costs',
    benefitDescription: 'The solution filters out fraudulent and bot-driven sign-ups before they reach the verification stage, ensuring merchants only pay for legitimate prospects.',
    benefitPoints: [
      { title: 'Verification Savings', description: 'Significantly reduces the total volume of identity checks, lowering the direct costs paid to KYC providers.' },
      { title: 'Streamlined Onboarding', description: 'Prevents high-risk identities from entering the system, allowing the team to focus on processing real, low-risk users faster.' },
    ],
  },
];

/**
 * Get challenge/benefit content for a specific calculator
 */
export function getChallengeBenefitContent(calculatorId: string): ChallengeBenefitContent | undefined {
  return CHALLENGE_BENEFIT_CONTENT.find(c => c.calculatorId === calculatorId);
}
