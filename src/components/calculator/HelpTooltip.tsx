import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface InputHelpInfo {
  label: string;
  description: string;
  benchmark?: string;
  example?: string;
}

interface HelpTooltipProps {
  info: InputHelpInfo;
  side?: "top" | "right" | "bottom" | "left";
}

export const HelpTooltip = ({ info, side = "right" }: HelpTooltipProps) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs p-3">
        <div className="space-y-2">
          <p className="font-medium text-sm">{info.label}</p>
          <p className="text-sm text-muted-foreground">{info.description}</p>
          {info.benchmark && (
            <p className="text-sm">
              <span className="font-medium text-primary">Typical range:</span>{" "}
              <span className="text-foreground">{info.benchmark}</span>
            </p>
          )}
          {info.example && (
            <p className="text-xs text-muted-foreground italic">
              Example: {info.example}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

// Pre-defined help content for common input fields
export const inputHelpContent: Record<string, InputHelpInfo> = {
  // Payments
  transactionAttempts: {
    label: "Transaction Attempts",
    description: "Total number of payment transactions attempted annually, including both approved and declined transactions.",
    benchmark: "Varies by business size",
    example: "1,000,000 attempts/year for mid-size retailer",
  },
  transactionValue: {
    label: "Transaction Value (GMV)",
    description: "Total gross merchandise value of all transaction attempts, before any declines or chargebacks.",
    benchmark: "Varies by business size",
    example: "$150M GMV for mid-size retailer",
  },
  grossMargin: {
    label: "Gross Margin",
    description: "Profit margin after cost of goods sold (COGS). Used to calculate the actual profit impact of lost sales.",
    benchmark: "15-60% depending on industry",
    example: "30% for electronics, 50% for apparel",
  },
  completedAOV: {
    label: "Completed AOV",
    description: "Average Order Value for successfully completed transactions. Used in downstream calculations.",
    benchmark: "$100-$250 typical",
    example: "Auto-calculated from GMV ÷ Attempts",
  },
  
  // Approval Rates
  preAuthApprovalRate: {
    label: "Fraud Approval Rate",
    description: "Percentage of transactions approved by fraud screening before authorization. This is the 'Fraud Gate' approval rate.",
    benchmark: "94-99% depending on industry and risk tolerance",
    example: "97% means 3% of transactions are blocked by fraud rules",
  },
  postAuthApprovalRate: {
    label: "Post-Auth Approval Rate",
    description: "Percentage of authorized transactions that pass post-authorization fraud review. Only applicable if a post-auth fraud gate is used.",
    benchmark: "95-100%",
    example: "100% if no post-auth review is implemented",
  },
  issuingBankDeclineRate: {
    label: "Issuing Bank Decline Rate",
    description: "Percentage of transactions declined by the card issuing bank due to insufficient funds, expired cards, or suspected fraud.",
    benchmark: "1-5% typical",
    example: "Higher rates often indicate authorization optimization opportunities",
  },
  
  // 3DS
  creditCardPct: {
    label: "Credit Card %",
    description: "Percentage of transactions using credit cards (vs. debit, gift cards, APMs). Used for 3DS calculations.",
    benchmark: "40-80% depending on region",
    example: "Higher in US, lower in Europe where debit is common",
  },
  threeDSChallengeRate: {
    label: "Challenge 3DS Rate",
    description: "Percentage of credit card transactions that trigger a 3D Secure challenge (OTP, biometric, etc). This refers to challenged transactions, not frictionless 3DS. PSD2 regions have higher rates.",
    benchmark: "3-25% (varies by region)",
    example: "EU: 15-25%, US: 3-10%",
  },
  threeDSAbandonmentRate: {
    label: "3DS Abandonment Rate",
    description: "Percentage of customers who abandon checkout when faced with a 3DS challenge.",
    benchmark: "10-30%",
    example: "Higher for mobile, lower for desktop with saved credentials",
  },
  
  // Chargebacks
  fraudCBRate: {
    label: "Fraud Chargeback Rate",
    description: "Fraud chargebacks as a percentage of approved transaction value. Key metric for card scheme compliance.",
    benchmark: "0.1-0.5% typical, <1% acceptable",
    example: "Card schemes penalize >1% rates",
  },
  fraudCBAOV: {
    label: "Fraud Chargeback AOV",
    description: "Average order value of transactions that result in fraud chargebacks. Often higher than overall AOV.",
    benchmark: "Typically 1.2-2x the overall AOV",
    example: "Fraudsters target higher-value items",
  },
  serviceCBRate: {
    label: "Service Chargeback Rate",
    description: "Non-fraud chargebacks (item not received, wrong item, quality issues) as a percentage of approved value.",
    benchmark: "0.05-0.3%",
    example: "Indicates fulfillment or customer service issues",
  },
  
  // Manual Review
  manualReviewPct: {
    label: "Manual Review Rate",
    description: "Percentage of transactions sent to manual review by the fraud team before approval.",
    benchmark: "2-15%",
    example: "Higher rates = higher operational costs, but may catch more fraud",
  },
  timePerReview: {
    label: "Time Per Review",
    description: "Average time in minutes spent by an analyst reviewing a single transaction.",
    benchmark: "2-10 minutes",
    example: "Depends on complexity and tools available",
  },
  hourlyReviewerCost: {
    label: "Reviewer Hourly Cost",
    description: "Fully loaded cost per hour for a fraud review analyst (salary + benefits + overhead).",
    benchmark: "$25-$75/hour",
    example: "Varies by region and seniority",
  },
  
  // Disputes
  fraudDisputeRate: {
    label: "Fraud Dispute Rate",
    description: "Percentage of fraud chargebacks that the customer chooses to dispute with evidence.",
    benchmark: "20-60%",
    example: "Higher if there is good order data and fraud tools",
  },
  fraudWinRate: {
    label: "Fraud Dispute Win Rate",
    description: "Percentage of disputed fraud chargebacks that are won and funds recovered.",
    benchmark: "20-50%",
    example: "Depends on evidence quality and dispute process",
  },
  
  // Abuse
  refundRate: {
    label: "Refund Rate",
    description: "Percentage of orders that result in a refund request.",
    benchmark: "5-15%",
    example: "Apparel: 15-30%, Electronics: 5-10%",
  },
  promotionAbuseRate: {
    label: "Promotion Abuse Catch Rate",
    description: "Percentage of promotion abuse attempts currently detected and prevented.",
    benchmark: "10-40%",
    example: "Higher with dedicated abuse detection tools",
  },
  
  // ATO
  monthlyLogins: {
    label: "Monthly Logins",
    description: "Total number of login attempts per month across all users.",
    benchmark: "Varies widely by user base",
    example: "Active users × avg logins per user",
  },
  customerLTV: {
    label: "Customer Lifetime Value",
    description: "Average total revenue generated by a customer over their entire relationship.",
    benchmark: "$200-$2,000+",
    example: "Higher for subscription or repeat-purchase businesses",
  },
  
  // Sign-up
  monthlySignups: {
    label: "Monthly Sign-ups",
    description: "Number of new account registrations per month.",
    benchmark: "Varies by marketing spend and growth stage",
    example: "Include organic + paid acquisition",
  },
  avgNewMemberBonus: {
    label: "New Member Bonus",
    description: "Average value of sign-up incentives (welcome discounts, credits, referral bonuses).",
    benchmark: "$5-$50",
    example: "Higher bonuses attract more fake accounts",
  },
};

// Get help info for a field, with fallback
export const getInputHelpInfo = (fieldKey: string): InputHelpInfo | null => {
  return inputHelpContent[fieldKey] || null;
};
