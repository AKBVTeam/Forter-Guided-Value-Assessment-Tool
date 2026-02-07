import { useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History } from "lucide-react";
import { CalculatorData, PersistedChangelogEntry } from "@/pages/Index";
import { InvestmentInputs } from "@/lib/roiCalculations";

const MAX_CHANGELOG_ENTRIES = 500;
/** Delay (ms) after last edit before a change is recorded (avoids logging every keystroke; short enough that changes feel responsive) */
const CHANGELOG_COMMIT_DEBOUNCE_MS = 800;

interface ChangelogPanelProps {
  currentData: CalculatorData;
  initialData: CalculatorData;
  currentInvestmentInputs?: InvestmentInputs;
  initialInvestmentInputs?: InvestmentInputs;
  /** Persisted changelog since analysis inception (merged across sessions) */
  persistedChangelog?: PersistedChangelogEntry[];
  /** Callback to persist new entries so they survive load/save */
  onChangelogUpdate?: (entries: PersistedChangelogEntry[]) => void;
}

// Exact labels matching ChallengeInputs.tsx and ManualInputForm.tsx
const fieldLabels: Record<string, string> = {
  // Profile
  customerName: "Customer Name",
  industry: "Industry",
  hqLocation: "HQ Location",
  isMarketplace: "Business Model",
  commissionRate: "Commission / Take Rate (%)",
  
  // Payments
  amerGrossAttempts: "Transaction Attempts (#)",
  amerAnnualGMV: "Transaction Attempts ($)",
  amerGrossMarginPercent: "Gross Margin (%)",
  amerPreAuthApprovalRate: "Fraud approval rate (%)",
  amerPostAuthApprovalRate: "Post-Auth Approval Rate (%)",
  amerPreAuthImplemented: "Pre-Auth Implemented",
  amerPostAuthImplemented: "Post-Auth Implemented",
  
  // 3DS Configuration
  amerCreditCardPct: "% of Transactions that are Credit Cards (%)",
  amer3DSChallengeRate: "Challenge 3DS Rate (%)",
  amer3DSAbandonmentRate: "3DS Failure & Abandonment Rate (%)",
  amerIssuingBankDeclineRate: "Issuing Bank Decline Rate (%)",
  amer3DSImplemented: "3DS Implemented",
  
  // Chargebacks
  fraudCBRate: "Gross Fraud Chargeback Rate (%)",
  fraudCBAOV: "Fraud Chargeback AOV ($)",
  
  // Manual Review
  manualReviewPct: "% of Transactions to Manual Review (%)",
  timePerReview: "Time to Review a TX (minutes)",
  hourlyReviewerCost: "Hourly Cost per Reviewer ($)",
  
  // Chargeback Disputes
  fraudDisputeRate: "Fraud Dispute Rate (%)",
  fraudWinRate: "Fraud Win Rate (%)",
  serviceCBRate: "Service Chargeback Rate (%)",
  serviceDisputeRate: "Service Dispute Rate (%)",
  serviceWinRate: "Service Win Rate (%)",
  avgTimeToDispute: "Avg. Time to Dispute (minutes)",
  
  // Policy Abuse Prevention
  promotionAbuseCatchRateToday: "Estimated Promotion Abuse Catch Rate Today (%)",
  refundRate: "Refund Rate on Completed Transactions (%)",
  expectedRefundsVolume: "Expected Refunds - Volume (#)",
  avgRefundValue: "Expected Refunds - AOV ($)",
  avgOneWayShipping: "Avg. One-Way Shipping Cost ($)",
  avgFulfilmentCost: "Avg. Fulfilment Cost ($)",
  txProcessingFeePct: "Avg. TX Processing Fee (%)",
  avgCSTicketCost: "Avg. CS Ticket Cost ($)",
  pctINRClaims: "% INR Claims (%)",
  pctReplacedCredits: "% Replaced with Credit (%)",
  // Instant Refunds
  pctRefundsToCS: "% of Refund Tickets to CS (%)",
  costPerCSContact: "Cost per CS Contact ($)",
  
  // Legacy/EMEA/APAC fields (kept for backwards compatibility)
  emeaAnnualGMV: "EMEA Annual GMV",
  emeaGrossAttempts: "EMEA Transaction Attempts (#)",
  emeaGrossMarginPercent: "EMEA Gross Margin (%)",
  emeaPreAuthApprovalRate: "EMEA Pre-Auth Approval Rate (%)",
  emeaPostAuthApprovalRate: "EMEA Post-Auth Approval Rate (%)",
  emeaIssuingBankDeclineRate: "EMEA Issuing Bank Decline Rate (%)",
  emeaCreditCardPct: "EMEA Credit Card (%)",
  emea3DSChallengeRate: "EMEA Challenge 3DS Rate (%)",
  emea3DSAbandonmentRate: "EMEA 3DS Abandonment Rate (%)",
  emeaManualReviewRate: "EMEA Manual Review Rate (%)",
  apacAnnualGMV: "APAC Annual GMV",
  apacGrossAttempts: "APAC Transaction Attempts (#)",
  apacGrossMarginPercent: "APAC Gross Margin (%)",
  apacPreAuthApprovalRate: "APAC Pre-Auth Approval Rate (%)",
  apacPostAuthApprovalRate: "APAC Post-Auth Approval Rate (%)",
  apacIssuingBankDeclineRate: "APAC Issuing Bank Decline Rate (%)",
  apacCreditCardPct: "APAC Credit Card (%)",
  apac3DSChallengeRate: "APAC Challenge 3DS Rate (%)",
  apac3DSAbandonmentRate: "APAC 3DS Abandonment Rate (%)",
  apacManualReviewRate: "APAC Manual Review Rate (%)",
  emeaFraudCBRate: "EMEA Fraud CB Rate (%)",
  apacFraudCBRate: "APAC Fraud CB Rate (%)",
  emeaFraudCBAOV: "EMEA Fraud CB AOV ($)",
  apacFraudCBAOV: "APAC Fraud CB AOV ($)",
  serviceCBAOV: "Service CB AOV ($)",
  // Metadata / bureaucratic (user-friendly labels only; some excluded from changelog)
  _pathwayMode: "Assessment type",
  _analysisName: "Analysis name",
  _authorName: "Report prepared by",
  baseCurrency: "Base currency",
  useCaseNotes: "Use case notes",
};

// Fields to exclude from changelog (internal IDs, UI state, or too technical)
const excludedCustomerKeys = new Set([
  "forterKPIs",
  "abuseBenchmarks",
  "selectedChallenges",
  "_changelogHistory",
  "_lastUpdatedAt",
  "_analysisId",
  "_valueSummaryViewed",
  "customBenefitNames",
  "standaloneCalculators",
]);

// Investment input labels
const investmentFieldLabels: Record<string, string> = {
  // Contract settings
  "integrationCost": "Integration Cost ($)",
  "contractTenure": "Contract Tenure (years)",
  "monthsToIntegrate": "Months to Integrate",
  "annualSalesGrowthPct": "Annual Sales Growth (%)",
  "manualOverride": "Manual Override Enabled",
  "manualInvestmentCost": "Manual Investment Cost ($)",
  "manualIntegrationCost": "Manual Integration Cost ($)",
  
  // Fraud Management
  "fraudManagement.enabled": "Fraud Management - Enabled",
  "fraudManagement.annualTransactions": "Fraud Management - Annual Transactions (#)",
  "fraudManagement.annualGMV": "Fraud Management - Annual GMV ($)",
  "fraudManagement.costPerDecision": "Fraud Management - Cost per Decision ($)",
  "fraudManagement.discount": "Fraud Management - Discount (%)",
  
  // Payment Optimization
  "paymentOptimization.enabled": "Payment Optimization - Enabled",
  "paymentOptimization.annualTransactions": "Payment Optimization - Annual Transactions (#)",
  "paymentOptimization.creditCardTrafficPct": "Payment Optimization - Credit Card Traffic (%)",
  "paymentOptimization.costPerDecision": "Payment Optimization - Cost per Decision ($)",
  "paymentOptimization.discount": "Payment Optimization - Discount (%)",
  
  // Dispute Management
  "disputeManagement.enabled": "Dispute Management - Enabled",
  "disputeManagement.valueOfWonChargebacks": "Dispute Management - Value of Won Chargebacks ($)",
  "disputeManagement.revenueSharePct": "Dispute Management - Revenue Share (%)",
  
  // Abuse Prevention
  "abusePrevention.enabled": "Abuse Prevention - Enabled",
  "abusePrevention.annualTransactions": "Abuse Prevention - Annual Transactions (#)",
  "abusePrevention.costPerDecision": "Abuse Prevention - Cost per Decision ($)",
  "abusePrevention.discount": "Abuse Prevention - Discount (%)",
  
  // Account Protection
  "accountProtection.enabled": "Account Protection - Enabled",
  "accountProtection.annualLogins": "Account Protection - Annual Logins (#)",
  "accountProtection.costPerAPICall": "Account Protection - Cost per Login API Call ($)",
  "accountProtection.annualSignups": "Account Protection - Annual Sign-ups (#)",
  "accountProtection.signupCostPerAPICall": "Account Protection - Cost per Sign-up API Call ($)",
};

/** User-friendly display for changelog values (including bureaucratic fields) */
const formatChangelogValue = (value: unknown, field?: string): string => {
  if (value === undefined || value === null || value === "") return "Not set";
  // Bureaucratic / metadata fields: show human-readable text
  if (field === "_pathwayMode") {
    const v = String(value).toLowerCase();
    if (v === "manual") return "Guided Value Assessment";
    if (v === "custom") return "Custom Value Assessment";
    return String(value);
  }
  if (field === "isMarketplace" && typeof value === "boolean") {
    return value ? "Marketplace" : "Retailer";
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (value === 0) return "0";
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return value.toLocaleString();
    return value.toString();
  }
  return String(value);
};

// Helper to flatten investment inputs for tracking
const flattenInvestmentInputs = (inputs: InvestmentInputs | undefined): Record<string, unknown> => {
  if (!inputs) return {};
  const flat: Record<string, unknown> = {};
  
  // Top-level fields
  flat.integrationCost = inputs.integrationCost;
  flat.contractTenure = inputs.contractTenure;
  flat.monthsToIntegrate = inputs.monthsToIntegrate;
  flat.annualSalesGrowthPct = inputs.annualSalesGrowthPct;
  flat.manualOverride = inputs.manualOverride;
  flat.manualInvestmentCost = inputs.manualInvestmentCost;
  flat.manualIntegrationCost = inputs.manualIntegrationCost;
  
  // Fraud Management
  flat["fraudManagement.enabled"] = inputs.fraudManagement?.enabled;
  flat["fraudManagement.annualTransactions"] = inputs.fraudManagement?.annualTransactions;
  flat["fraudManagement.annualGMV"] = inputs.fraudManagement?.annualGMV;
  flat["fraudManagement.costPerDecision"] = inputs.fraudManagement?.costPerDecision;
  flat["fraudManagement.discount"] = inputs.fraudManagement?.discount;
  
  // Payment Optimization
  flat["paymentOptimization.enabled"] = inputs.paymentOptimization?.enabled;
  flat["paymentOptimization.annualTransactions"] = inputs.paymentOptimization?.annualTransactions;
  flat["paymentOptimization.creditCardTrafficPct"] = inputs.paymentOptimization?.creditCardTrafficPct;
  flat["paymentOptimization.costPerDecision"] = inputs.paymentOptimization?.costPerDecision;
  flat["paymentOptimization.discount"] = inputs.paymentOptimization?.discount;
  
  // Dispute Management
  flat["disputeManagement.enabled"] = inputs.disputeManagement?.enabled;
  flat["disputeManagement.valueOfWonChargebacks"] = inputs.disputeManagement?.valueOfWonChargebacks;
  flat["disputeManagement.revenueSharePct"] = inputs.disputeManagement?.revenueSharePct;
  
  // Abuse Prevention
  flat["abusePrevention.enabled"] = inputs.abusePrevention?.enabled;
  flat["abusePrevention.annualTransactions"] = inputs.abusePrevention?.annualTransactions;
  flat["abusePrevention.costPerDecision"] = inputs.abusePrevention?.costPerDecision;
  flat["abusePrevention.discount"] = inputs.abusePrevention?.discount;
  
  // Account Protection
  flat["accountProtection.enabled"] = inputs.accountProtection?.enabled;
  flat["accountProtection.annualLogins"] = inputs.accountProtection?.annualLogins;
  flat["accountProtection.costPerAPICall"] = inputs.accountProtection?.costPerAPICall;
  flat["accountProtection.annualSignups"] = inputs.accountProtection?.annualSignups;
  flat["accountProtection.signupCostPerAPICall"] = inputs.accountProtection?.signupCostPerAPICall;
  
  return flat;
};

function computeCustomerDiff(
  currentData: CalculatorData,
  prevData: CalculatorData,
  isEqual: (a: unknown, b: unknown) => boolean
): PersistedChangelogEntry[] {
  const keys = new Set<string>([
    ...Object.keys(prevData),
    ...Object.keys(currentData),
  ]);
  const newEntries: PersistedChangelogEntry[] = [];
  keys.forEach((key) => {
    if (excludedCustomerKeys.has(key)) return;
    const currValue = currentData[key as keyof CalculatorData];
    const prevValue = prevData[key as keyof CalculatorData];
    if (!isEqual(currValue, prevValue)) {
      newEntries.push({
        field: key,
        label: fieldLabels[key] || key,
        oldValue: prevValue as string | number | boolean | undefined,
        newValue: currValue as string | number | boolean | undefined,
        timestamp: new Date().toISOString(),
        category: 'customer',
      });
    }
  });
  return newEntries;
}

function computeInvestmentDiff(
  currFlat: Record<string, unknown>,
  prevFlat: Record<string, unknown>,
  isEqual: (a: unknown, b: unknown) => boolean
): PersistedChangelogEntry[] {
  const keys = new Set<string>([...Object.keys(prevFlat), ...Object.keys(currFlat)]);
  const newEntries: PersistedChangelogEntry[] = [];
  keys.forEach((key) => {
    const currValue = currFlat[key];
    const prevValue = prevFlat[key];
    if (!isEqual(currValue, prevValue)) {
      newEntries.push({
        field: `inv_${key}`,
        label: investmentFieldLabels[key] || key,
        oldValue: prevValue as string | number | boolean | undefined,
        newValue: currValue as string | number | boolean | undefined,
        timestamp: new Date().toISOString(),
        category: 'investment',
      });
    }
  });
  return newEntries;
}

export const ChangelogPanel = ({ 
  currentData, 
  initialData,
  currentInvestmentInputs,
  initialInvestmentInputs,
  persistedChangelog = [],
  onChangelogUpdate,
}: ChangelogPanelProps) => {
  // Use a copy so we never share reference with parent; ensures diff detects all field changes (e.g. commission, gross margin)
  const prevDataRef = useRef<CalculatorData>({ ...initialData });
  const prevInvestmentRef = useRef<Record<string, unknown>>(flattenInvestmentInputs(initialInvestmentInputs));
  const analysisIdRef = useRef<string | undefined>(initialData._analysisId);
  const currentDataRef = useRef<CalculatorData>(currentData);
  const currentInvestmentFlatRef = useRef<Record<string, unknown>>(flattenInvestmentInputs(currentInvestmentInputs));
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceInvestmentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistedChangelogRef = useRef(persistedChangelog);
  const onChangelogUpdateRef = useRef(onChangelogUpdate);
  persistedChangelogRef.current = persistedChangelog;
  onChangelogUpdateRef.current = onChangelogUpdate;

  const isEqual = useCallback((a: unknown, b: unknown) => {
    const sa = a === undefined ? "__undefined__" : JSON.stringify(a);
    const sb = b === undefined ? "__undefined__" : JSON.stringify(b);
    return sa === sb;
  }, []);

  // Reset baseline when analysis changes (e.g. load different analysis); keep a full shallow copy so diff sees all field changes
  useEffect(() => {
    if (initialData._analysisId !== analysisIdRef.current) {
      analysisIdRef.current = initialData._analysisId;
      prevDataRef.current = { ...initialData };
      prevInvestmentRef.current = { ...flattenInvestmentInputs(initialInvestmentInputs) };
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (debounceInvestmentTimerRef.current) {
        clearTimeout(debounceInvestmentTimerRef.current);
        debounceInvestmentTimerRef.current = null;
      }
    }
  }, [initialData._analysisId, initialData, initialInvestmentInputs]);

  // Track customer data changes; only record after user has stopped editing (debounce)
  useEffect(() => {
    currentDataRef.current = currentData;
    const prevData = prevDataRef.current;
    const newEntries = computeCustomerDiff(currentData, prevData, isEqual);

    if (newEntries.length === 0 || !onChangelogUpdate) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      const latest = currentDataRef.current;
      const entries = computeCustomerDiff(latest, prevDataRef.current, isEqual);
      if (entries.length > 0 && onChangelogUpdateRef.current) {
        const merged = [...(persistedChangelogRef.current || []), ...entries];
        const capped = merged.slice(-MAX_CHANGELOG_ENTRIES);
        onChangelogUpdateRef.current(capped);
      }
      prevDataRef.current = { ...latest };
    }, CHANGELOG_COMMIT_DEBOUNCE_MS);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [currentData, isEqual, onChangelogUpdate]);

  // Track investment input changes; only record after user has stopped editing (debounce)
  useEffect(() => {
    if (!currentInvestmentInputs || !initialInvestmentInputs || !onChangelogUpdate) return;

    const currFlat = flattenInvestmentInputs(currentInvestmentInputs);
    currentInvestmentFlatRef.current = currFlat;
    const prevFlat = prevInvestmentRef.current;
    const newEntries = computeInvestmentDiff(currFlat, prevFlat, isEqual);

    if (newEntries.length === 0) return;

    if (debounceInvestmentTimerRef.current) clearTimeout(debounceInvestmentTimerRef.current);
    debounceInvestmentTimerRef.current = setTimeout(() => {
      debounceInvestmentTimerRef.current = null;
      const latest = currentInvestmentFlatRef.current;
      const entries = computeInvestmentDiff(latest, prevInvestmentRef.current, isEqual);
      if (entries.length > 0 && onChangelogUpdateRef.current) {
        const merged = [...(persistedChangelogRef.current || []), ...entries];
        const capped = merged.slice(-MAX_CHANGELOG_ENTRIES);
        onChangelogUpdateRef.current(capped);
      }
      prevInvestmentRef.current = { ...(latest || {}) };
    }, CHANGELOG_COMMIT_DEBOUNCE_MS);
    return () => {
      if (debounceInvestmentTimerRef.current) {
        clearTimeout(debounceInvestmentTimerRef.current);
        debounceInvestmentTimerRef.current = null;
      }
    };
  }, [currentInvestmentInputs, initialInvestmentInputs, isEqual, onChangelogUpdate]);

  // Display: full history since inception (persisted + any just-added), sorted by timestamp desc
  const displayChangelog = (persistedChangelog || []).slice().sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <History className="w-4 h-4" />
          Changes
          {displayChangelog.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
              {displayChangelog.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Modified Inputs</SheetTitle>
        </SheetHeader>

        <div className="mt-6">
          <ScrollArea className="h-[calc(100vh-150px)] rounded-md border p-3">
            {displayChangelog.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No changes made yet
              </p>
            ) : (
              <div className="space-y-2">
                {displayChangelog.map((entry, idx) => (
                  <div
                    key={`${entry.field}-${idx}`}
                    className={`text-sm p-2 rounded-md ${entry.category === 'investment' ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-muted/50'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{entry.label}</span>
                        {entry.category === 'investment' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200">
                            Investment
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {(() => {
                          const d = new Date(entry.timestamp);
                          const day = d.getDate().toString().padStart(2, "0");
                          const month = d.toLocaleString("en", { month: "short" });
                          const year = d.getFullYear().toString().slice(-2);
                          return `${day}-${month}-${year}, ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
                        })()}
                      </span>
                    </div>
                    <div className="text-muted-foreground text-xs mt-1">
                      <span className="line-through">{formatChangelogValue(entry.oldValue, entry.field)}</span>
                      <span className="mx-2">→</span>
                      <span className="text-foreground font-medium">
                        {formatChangelogValue(entry.newValue, entry.field)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
};
