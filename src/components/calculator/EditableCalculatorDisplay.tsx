import { useState, useCallback, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CalculatorRow } from "@/lib/calculations";
import { Badge } from "@/components/ui/badge";
import { CalculatorData } from "@/pages/Index";
import { ForterKPIs } from "./ForterKPIConfig";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface EditableCalculatorDisplayProps {
  title: string;
  rows: CalculatorRow[];
  className?: string;
  onCustomerFieldChange?: (field: keyof CalculatorData, value: number) => void;
  onForterFieldChange?: (field: keyof ForterKPIs, value: number) => void;
  // Optional: provide formData to calculate reduction from outcome
  formData?: CalculatorData;
  forterKPIs?: ForterKPIs;
  // Optional: handler for abuseBenchmarks updates
  onAbuseBenchmarkChange?: (field: string, value: number) => void;
}

// Map field keys to human-readable labels for tooltips
const FIELD_LABELS: Record<string, string> = {
  // Customer inputs (monthly -> displayed as annual)
  monthlyLogins: "Monthly number of logins (displayed as annual)",
  monthlySignups: "Monthly number of sign-ups (displayed as annual)",
  // Other customer inputs
  amerGrossAttempts: "Transaction attempts",
  amerAnnualGMV: "Annual GMV",
  amerGrossMarginPercent: "Gross margin %",
  amerPreAuthApprovalRate: "Pre-auth fraud approval rate %",
  amerPostAuthApprovalRate: "Post-auth fraud approval rate %",
  completedAOV: "Completed AOV",
  fraudCBRate: "Fraud chargeback rate %",
  fraudCBAOV: "Fraud chargeback AOV",
  serviceCBRate: "Service chargeback rate %",
  avgRefundValue: "Average refund value",
  avgNewMemberBonus: "Average new member bonus",
  promoAbuseRate: "Promotion abuse rate %",
  avgPromoDiscount: "Average promo discount",
  resellerAbuseRate: "Reseller abuse rate %",
  refundRate: "Refund rate %",
  pctINRClaims: "% INR claims",
  avgCSTicketCost: "Average CS ticket cost",
  pctRefundsToCS: "% of Refund Tickets to CS",
  costPerCSContact: "Cost per CS Contact",
  expectedRefundsVolume: "Expected Refunds - Volume",
  // Challenge 7 standalone inputs
  estFraudChargebackValue: "Est. value of fraud chargebacks ($)",
  estServiceChargebackValue: "Est. value of service chargebacks ($)",
  fraudDisputeRate: "Fraud chargeback dispute rate %",
  fraudWinRate: "Fraud chargeback win rate %",
  serviceDisputeRate: "Service chargeback dispute rate %",
  serviceWinRate: "Service chargeback win rate %",
  avgTimeToReviewCB: "Avg time to review CB (mins)",
  annualCBDisputes: "Number of annual CB disputes",
  costPerHourAnalyst: "Cost per hour of analyst",
  // Challenge 14/15 Sign-up Protection
  numDigitalCommunicationsPerYear: "Digital communications per year (#)",
  avgCostPerOutreach: "Average cost per outreach ($)",
  avgKYCCostPerAccount: "Average KYC cost per account ($)",
  pctAccountsGoingThroughKYC: "% accounts going through KYC",
  // Forter KPIs
  fraudApprovalRate: "Forter fraud approval rate %",
  threeDSReduction: "3DS reduction %",
  atoCatchRate: "ATO catch rate %",
  signupAbuseBlockRate: "Sign-up abuse block rate %",
  promoCatchRate: "Promo abuse catch rate %",
  promotionAbuseCatchRateToday: "Estimated Promotion Abuse Catch Rate Today (%)",
  returnsAbuseBlockRate: "Returns abuse block rate %",
  inrAbuseBlockRate: "INR abuse block rate %",
  forter3DSAbandonmentRate: "3DS failure & abandonment rate %",
  forterIssuingBankDeclineRate: "Issuing bank decline rate %",
  gmvToNetSalesDeductionPct: "GMV to Net sales deductions (sales tax/cancellations) %",
  pctFraudulentLogins: "% fraudulent logins",
  pctFraudulentSignups: "% fraudulent sign-ups",
  // Challenge 7 Forter KPIs
  fraudDisputeRateImprovement: "Fraud dispute rate improvement %",
  fraudWinRateChange: "Fraud win rate change %",
  serviceDisputeRateImprovement: "Service dispute rate improvement %",
  serviceWinRateChange: "Service win rate change %",
  disputeTimeReduction: "Dispute time reduction (mins)",
};

const formatForterImprovement = (value: string | undefined) => {
  if (!value) return "";
  let str = String(value).trim();

  // Display as-is: % improvement (no suffix) or % pts for percentage-point improvements
  if (str === "0" || str === "0%" || str === "0.00%" || str === "0.0% pts" || str === "0% pts" || str === "$0" || str === "-$0") {
    return str.replace("-", "");
  }

  if (str.startsWith("+") || (str.startsWith("(") && str.endsWith(")"))) {
    return str;
  }

  if (str.startsWith("-")) {
    return `(${str.slice(1)})`;
  }

  return `+${str}`;
};

const getImprovementTone = (value: string | undefined): "positive" | "negative" | "neutral" => {
  if (!value) return "neutral";
  const str = value.trim();
  if (str.startsWith("-")) return "negative";
  if (str.startsWith("(")) return "negative";
  if (str.startsWith("+")) return "positive";
  if (str === "0" || str === "0%" || str === "0.00%" || str === "0.0% pts" || str === "0% pts" || str === "$0") return "neutral";
  if (str.startsWith("0")) return "neutral";
  return "positive";
};

// List of Forter KPI field names that might appear in customer column
const FORTER_KPI_FIELDS = new Set([
  'pctFraudulentSignups', 'forterFraudulentSignupReduction', 'forterKYCReduction',
  'approvalRateImprovement', 'chargebackReduction', 'preAuthApprovalImprovement',
  'postAuthApprovalImprovement', 'threeDSReduction', 'manualReviewReduction',
  'reviewTimeReduction', 'fraudDisputeRateImprovement', 'fraudWinRateChange',
  'serviceDisputeRateImprovement', 'serviceWinRateChange', 'disputeTimeReduction',
  'forterCatchRate', 'forterCSReduction', 'pctFraudulentLogins', 'atoCatchRate',
  'churnLikelihoodFromATO', 'npsIncreaseFromInstantRefunds'
]);

export const EditableCalculatorDisplay = ({ 
  title, 
  rows, 
  className,
  onCustomerFieldChange,
  onForterFieldChange,
  formData,
  forterKPIs,
}: EditableCalculatorDisplayProps) => {
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; type: 'customer' | 'forter' } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  // Optimistic display: show committed value until row data catches up (prevents "bounce back")
  const lastCommittedCustomerRef = useRef<{ rowIndex: number; field: string; value: number; valueType?: string } | null>(null);

  const handleStartEdit = useCallback((rowIndex: number, type: 'customer' | 'forter', currentValue: number | undefined) => {
    setEditingCell({ rowIndex, type });
    setEditValue(currentValue?.toString() ?? "");
  }, []);

  const handleEndEdit = useCallback((row: CalculatorRow) => {
    if (!editingCell) return;
    
    let numValue = parseFloat(editValue);
    if (!isNaN(numValue)) {
      // Clamp percentage fields to 0-100 so committed value is valid and persists
      if (row.valueType === 'percent') {
        numValue = Math.max(0, Math.min(100, numValue));
      }
      const valueAsNumber = Number(numValue);
      if (editingCell.type === 'customer' && row.editableCustomerField) {
        // Route to Forter handler only when the customer column field is a Forter KPI (e.g. approvalRateImprovement).
        // Rows with both editableCustomerField and editableForterField (e.g. 3DS / bank decline) use customer column for customer data, Forter column for Forter outcome.
        if (FORTER_KPI_FIELDS.has(row.editableCustomerField) && onForterFieldChange) {
          onForterFieldChange(row.editableCustomerField as keyof ForterKPIs, valueAsNumber);
        } else if (onCustomerFieldChange) {
          onCustomerFieldChange(row.editableCustomerField as keyof CalculatorData, valueAsNumber);
          // Optimistic display: show this value until row.rawCustomerValue catches up (avoids bounce back)
          lastCommittedCustomerRef.current = { rowIndex: editingCell.rowIndex, field: row.editableCustomerField, value: valueAsNumber, valueType: row.valueType };
        }
      } else if (editingCell.type === 'forter' && row.editableForterField && onForterFieldChange) {
        // Handle special case: Forter outcome is calculated from reduction percentage
        // When user edits the outcome, calculate the corresponding reduction
        // This applies to 'forter-outcome-from-reduction' and 'abuse-benchmark-outcome' footnotes
        if ((row.footnote === 'forter-outcome-from-reduction' || row.footnote === 'abuse-benchmark-outcome') && row.rawCustomerValue !== undefined && formData && forterKPIs) {
          const customerValue = row.rawCustomerValue;
          const forterOutcomePct = numValue; // User entered the Forter outcome percentage
          
          // Calculate reduction: outcome = customer * (1 - reduction/100)
          // So: reduction = (1 - outcome/customer) * 100
          if (customerValue > 0) {
            const reduction = (1 - forterOutcomePct / customerValue) * 100;
            // Clamp reduction to 0-100%
            const clampedReduction = Math.max(0, Math.min(100, reduction));
            onForterFieldChange(row.editableForterField as keyof ForterKPIs, clampedReduction);
          } else {
            onForterFieldChange(row.editableForterField as keyof ForterKPIs, numValue);
          }
        } else if (row.footnote === 'abuse-catch-rate-outcome' && row.rawCustomerValue !== undefined && formData && forterKPIs) {
          // For abuse-catch-rate-outcome: when editing Forter improvement (catch rate), 
          // the value entered IS the catch rate, so use it directly
          // Also sync with forterEgregiousReturnsReduction
          const catchRate = Math.max(0, Math.min(100, numValue));
          onForterFieldChange(row.editableForterField as keyof ForterKPIs, catchRate);
        } else {
          // Clamp currency (e.g. forterCompletedAOV) to non-negative
          const valueToCommit = row.valueType === 'currency' ? Math.max(0, numValue) : numValue;
          onForterFieldChange(row.editableForterField as keyof ForterKPIs, valueToCommit);
        }
      }
    }
    setEditingCell(null);
    setEditValue("");
  }, [editingCell, editValue, onCustomerFieldChange, onForterFieldChange, formData, forterKPIs]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, row: CalculatorRow) => {
    if (e.key === 'Enter') {
      handleEndEdit(row);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue("");
    }
  }, [handleEndEdit]);

  // Clear optimistic ref when row data catches up (so we don't show stale optimistic value)
  useEffect(() => {
    const ref = lastCommittedCustomerRef.current;
    if (!ref || ref.rowIndex < 0 || ref.rowIndex >= (rows?.length ?? 0)) return;
    const row = rows[ref.rowIndex];
    if (!row || row.editableCustomerField !== ref.field) return;
    const rowVal = row.rawCustomerValue as number | undefined;
    if (rowVal !== undefined && Math.abs(rowVal - ref.value) < 0.01) {
      lastCommittedCustomerRef.current = null;
    }
  }, [rows]);

  const formatOptimisticValue = (value: number, valueType?: string) => {
    if (valueType === 'percent') return `${value.toFixed(1)}%`;
    if (valueType === 'currency') return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return value.toLocaleString();
  };

  const getValueDriverBadge = (valueDriver?: "revenue" | "profit" | "cost") => {
    if (!valueDriver) return null;

    const labels = {
      revenue: "Revenue uplift",
      profit: "Profit uplift",
      cost: "Cost reduction",
    };

    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      revenue: "default",
      profit: "secondary",
      cost: "outline",
    };

    return (
      <Badge variant={variants[valueDriver]} className="ml-2 text-xs">
        {labels[valueDriver]}
      </Badge>
    );
  };

  const isEditable = (row: CalculatorRow, type: 'customer' | 'forter') => {
    if (type === 'customer') {
      return !!row.editableCustomerField && !!onCustomerFieldChange;
    }
    // Forter outcome is read-only if readOnlyForterOutcome is true
    if (row.readOnlyForterOutcome) {
      return false;
    }
    return !!row.editableForterField && !!onForterFieldChange;
  };

  // Check if any rows are editable to show column header indicators
  const hasEditableCustomerRows = rows?.some(r => r.editableCustomerField && onCustomerFieldChange) ?? false;
  const hasEditableForterRows = rows?.some(r => r.editableForterField && onForterFieldChange) ?? false;
  
  // Early return if no rows
  if (!rows || rows.length === 0) {
    return (
      <Card className={`overflow-hidden ${className ?? ""}`}>
        {title && (
          <div className="bg-primary/5 border-b px-4 py-3">
            <h4 className="font-semibold text-sm">{title}</h4>
          </div>
        )}
        <div className="p-4 text-center text-muted-foreground text-sm">
          No data available
        </div>
      </Card>
    );
  }

  return (
    <Card className={`overflow-hidden ${className ?? ""}`}> 
      {title && (
        <div className="bg-primary/5 border-b px-4 py-3">
          <h4 className="font-semibold text-sm">{title}</h4>
        </div>
      )}
      <div className="max-h-[600px] overflow-auto">
        <table className="w-full caption-bottom text-sm">
          <thead className="sticky top-0 z-10 bg-background border-b shadow-sm">
            <tr>
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground text-sm w-[100px]">Formula</th>
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground text-sm">Description</th>
              <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground text-sm w-[130px]">
                Customer inputs
              </th>
              <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground text-sm bg-blue-50 dark:bg-blue-950/30 w-[140px]">Forter improvement</th>
              <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground text-sm w-[120px]">
                Forter outcome
              </th>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {rows.map((row, index) => {
              const isSectionHeader = !row.formula && row.label && !row.customerInput;

              if (isSectionHeader) {
                return (
                  <tr key={index} className="bg-muted/30 border-b">
                    <td colSpan={5} className="p-4 align-middle font-semibold text-sm py-2">
                      {row.label}
                    </td>
                  </tr>
                );
              }

              const improvementText = formatForterImprovement(row.forterImprovement);
              const tone = getImprovementTone(row.forterImprovement);
              const toneClass =
                tone === "negative"
                  ? "text-destructive"
                  : tone === "positive"
                    ? "text-primary"
                    : "";

              const rowBgClass = row.valueDriver 
                ? "bg-primary/10" 
                : row.isCalculation 
                  ? "bg-muted/40" 
                  : "";

              const customerEditable = isEditable(row, 'customer');
              const forterEditable = isEditable(row, 'forter');
              const isEditingCustomer = editingCell?.rowIndex === index && editingCell.type === 'customer';
              const isEditingForter = editingCell?.rowIndex === index && editingCell.type === 'forter';

              return (
                <tr key={index} className={`border-b transition-colors hover:bg-muted/50 ${rowBgClass}`}>
                  <td className="p-4 align-middle font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {row.formula}
                  </td>
                  <td className="p-4 align-middle text-sm">
                    <div className="flex flex-col">
                      <span>
                        {row.label}
                        {getValueDriverBadge(row.valueDriver)}
                      </span>
                      {row.footnote && (
                        <span className="text-xs text-amber-600 mt-1 italic">{row.footnote}</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 align-middle text-right text-sm font-medium">
                    {isEditingCustomer ? (
                      <Input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleEndEdit(row)}
                        onKeyDown={(e) => handleKeyDown(e, row)}
                        className="h-7 w-24 text-right ml-auto"
                        autoFocus
                      />
                    ) : customerEditable ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(index, 'customer', row.rawCustomerValue)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/5 border border-primary/20 text-primary hover:bg-primary/10 transition-colors cursor-pointer text-right w-full justify-end min-w-0 font-medium"
                            >
                              {(() => {
                                const ref = lastCommittedCustomerRef.current;
                                const showOptimistic = ref && ref.rowIndex === index && ref.field === row.editableCustomerField && (row.rawCustomerValue === undefined || Math.abs((row.rawCustomerValue as number) - ref.value) >= 0.01);
                                return showOptimistic ? formatOptimisticValue(ref!.value, ref!.valueType) : row.customerInput;
                              })()}
                              <span className="text-xs opacity-60">✎</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-xs">
                              <span className="font-medium">Edit: </span>
                              {FIELD_LABELS[row.editableCustomerField as string] || row.editableCustomerField}
                              {row.editableCustomerField === 'amerPreAuthApprovalRate' ? (
                                <span className="block mt-1 text-muted-foreground">
                                  Can also be edited in the Inputs modal.
                                </span>
                              ) : row.editableCustomerField === 'monthlyLogins' || row.editableCustomerField === 'monthlySignups' ? (
                                <span className="block mt-1 text-muted-foreground">
                                  Raw value: {row.rawCustomerValue?.toLocaleString()}
                                </span>
                              ) : null}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      row.customerInput
                    )}
                  </td>
                  <td className={`p-4 align-middle text-right text-sm font-medium bg-blue-50 dark:bg-blue-950/30 ${toneClass}`.trim()}>
                    {improvementText}
                  </td>
                  <td className="p-4 align-middle text-right text-sm font-medium">
                    {isEditingForter ? (
                      <Input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleEndEdit(row)}
                        onKeyDown={(e) => handleKeyDown(e, row)}
                        className="h-7 w-24 text-right ml-auto"
                        autoFocus
                      />
                    ) : forterEditable && !row.readOnlyForterOutcome ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(index, 'forter', row.rawForterValue)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-50 border border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors cursor-pointer text-right w-full justify-end min-w-0 font-medium"
                            >
                              {row.forterOutcome}
                              <span className="text-xs opacity-60">✎</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-xs">
                              <span className="font-medium">Edit: </span>
                              {FIELD_LABELS[row.editableForterField as string] || row.editableForterField}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      row.forterOutcome
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
