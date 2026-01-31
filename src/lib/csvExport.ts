/**
 * CSV Export utility for customer inputs based on selected challenges
 */

import { getCurrencySymbol } from "./benchmarkData";
import { Segment } from "./segments";

interface InputField {
  field: string;
  label: string;
  section: string;
  type: 'number' | 'percentage' | 'currency' | 'text';
  placeholder?: string;
  segmentField?: keyof Segment['inputs']; // Maps to segment input field
}

/**
 * Get the list of required input fields based on selected challenges
 */
export function getRequiredInputFields(
  selectedChallenges: { [key: string]: boolean },
  currencySymbol: string = '$',
  isMarketplace?: boolean
): InputField[] {
  const fields: InputField[] = [];
  
  // Determine which challenges are selected
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

  // Grouped challenges
  const isChallenge245Selected = isChallenge2Selected || isChallenge4Selected || isChallenge5Selected;
  const isChallenge10_11Selected = isChallenge10Selected || isChallenge11Selected;
  const isChallenge12_13Selected = isChallenge12Selected || isChallenge13Selected;
  const isChallenge14_15Selected = isChallenge14Selected || isChallenge15Selected;

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

  // Payments Section
  if (showPaymentsInputs) {
    const isChallenge9Standalone = isChallenge9Selected && !isChallenge1Selected && !isChallenge245Selected && !isChallenge10_11Selected;
    
    fields.push({
      field: 'amerGrossAttempts',
      label: isChallenge9Standalone ? 'Completed Transactions (#)' : 'Transaction Attempts (#)',
      section: 'Payments',
      type: 'number',
      placeholder: '1,000,000',
      segmentField: 'grossAttempts',
    });
    
    fields.push({
      field: 'amerAnnualGMV',
      label: isChallenge9Standalone ? `Current eCommerce Sales (${currencySymbol})` : `Transaction Attempts (${currencySymbol})`,
      section: 'Payments',
      type: 'currency',
      placeholder: '150,000,000',
      segmentField: 'annualGMV',
    });
    
    fields.push({
      field: 'amerGrossMarginPercent',
      label: 'Gross Margin (%)',
      section: 'Payments',
      type: 'percentage',
      placeholder: '50',
    });
    
    // Commission / Take Rate - only for marketplaces
    if (isMarketplace === true) {
      fields.push({
        field: 'commissionRate',
        label: 'Commission / Take Rate (%)',
        section: 'Payments',
        type: 'percentage',
        placeholder: '15',
      });
    }
    
    if (isChallenge1Selected && !isChallenge245Selected) {
      fields.push({
        field: 'amerPreAuthApprovalRate',
        label: 'Fraud Approval Rate - Volume (%)',
        section: 'Payments',
        type: 'percentage',
        placeholder: '95',
        segmentField: 'preAuthApprovalRate',
      });
    }
    
    if (isChallenge245Selected) {
      fields.push({
        field: 'amerPreAuthApprovalRate',
        label: 'Pre-Auth Fraud Approval Rate (%)',
        section: 'Payments',
        type: 'percentage',
        placeholder: '95',
        segmentField: 'preAuthApprovalRate',
      });
      fields.push({
        field: 'amerPostAuthApprovalRate',
        label: 'Post-Auth Fraud Approval Rate (%)',
        section: 'Payments',
        type: 'percentage',
        placeholder: '98',
        segmentField: 'postAuthApprovalRate',
      });
    }
  }

  // 3DS Section
  if (show3DSInputs) {
    fields.push({
      field: 'amerCreditCardPct',
      label: '% of Transactions that are Credit Cards (%)',
      section: '3DS Configuration',
      type: 'percentage',
      placeholder: '80',
      segmentField: 'creditCardPct',
    });
    fields.push({
      field: 'amer3DSChallengeRate',
      label: 'Challenge 3DS Rate (%)',
      section: '3DS Configuration',
      type: 'percentage',
      placeholder: '50',
      segmentField: 'threeDSChallengeRate',
    });
    fields.push({
      field: 'amer3DSAbandonmentRate',
      label: '3DS Failure & Abandonment Rate (%)',
      section: '3DS Configuration',
      type: 'percentage',
      placeholder: '15',
      segmentField: 'threeDSAbandonmentRate',
    });
    fields.push({
      field: 'amerIssuingBankDeclineRate',
      label: 'Issuing Bank Decline Rate (%)',
      section: '3DS Configuration',
      type: 'percentage',
      placeholder: '15',
      segmentField: 'issuingBankDeclineRate',
    });
  }

  // Chargebacks Section
  if (showChargebackInputs) {
    fields.push({
      field: 'fraudCBRate',
      label: 'Gross Fraud Chargeback Rate (%)',
      section: 'Chargebacks',
      type: 'percentage',
      placeholder: '0.5',
      segmentField: 'fraudCBRate',
    });
    fields.push({
      field: 'fraudCBAOV',
      label: `Fraud Chargeback AOV (${currencySymbol})`,
      section: 'Chargebacks',
      type: 'currency',
      placeholder: '150',
      segmentField: 'fraudCBAOV',
    });
  }

  // Manual Review Section
  if (showManualReviewInputs) {
    // Note: Transaction Attempts is already handled by Payments section
    // Manual review uses the same transaction count, so we don't need to ask for it separately
    fields.push({
      field: 'manualReviewPct',
      label: '% of Transactions to Manual Review (%)',
      section: 'Manual Review',
      type: 'percentage',
      placeholder: '5',
    });
    fields.push({
      field: 'timePerReview',
      label: 'Time to Review a TX (minutes)',
      section: 'Manual Review',
      type: 'number',
      placeholder: '10',
    });
    fields.push({
      field: 'hourlyReviewerCost',
      label: `Hourly Cost per Reviewer (${currencySymbol})`,
      section: 'Manual Review',
      type: 'currency',
      placeholder: '15',
    });
  }

  // Dispute Section
  if (showDisputeInputs) {
    // Always use direct value inputs for fraud and service chargebacks
    fields.push({
      field: 'estFraudChargebackValue',
      label: `Est. Value of Fraud Chargebacks (${currencySymbol})`,
      section: 'Chargeback Disputes - Fraud',
      type: 'currency',
      placeholder: '750,000',
    });
    fields.push({
      field: 'fraudDisputeRate',
      label: 'Fraud Dispute Rate - Value (%)',
      section: 'Chargeback Disputes - Fraud',
      type: 'percentage',
      placeholder: '50',
    });
    fields.push({
      field: 'fraudWinRate',
      label: 'Fraud Win Rate - Value (%)',
      section: 'Chargeback Disputes - Fraud',
      type: 'percentage',
      placeholder: '30',
    });
    
    fields.push({
      field: 'estServiceChargebackValue',
      label: `Est. Value of Service Chargebacks (${currencySymbol})`,
      section: 'Chargeback Disputes - Service',
      type: 'currency',
      placeholder: '300,000',
    });
    fields.push({
      field: 'serviceDisputeRate',
      label: 'Service Dispute Rate - Value (%)',
      section: 'Chargeback Disputes - Service',
      type: 'percentage',
      placeholder: '50',
    });
    fields.push({
      field: 'serviceWinRate',
      label: 'Service Win Rate - Value (%)',
      section: 'Chargeback Disputes - Service',
      type: 'percentage',
      placeholder: '40',
    });
    
    fields.push({
      field: 'avgTimeToReviewCB',
      label: 'Avg. Time to Review CB (mins)',
      section: 'Chargeback Disputes - OpEx',
      type: 'number',
      placeholder: '20',
    });
    fields.push({
      field: 'annualCBDisputes',
      label: 'Number of Annual CB Disputes',
      section: 'Chargeback Disputes - OpEx',
      type: 'number',
      placeholder: '7,439',
    });
    fields.push({
      field: 'costPerHourAnalyst',
      label: `Cost per Hour of Analyst (${currencySymbol})`,
      section: 'Chargeback Disputes - OpEx',
      type: 'currency',
      placeholder: '19.23',
    });
  }

  // Abuse Prevention Section
  if (showAbuseInputs) {
    fields.push({
      field: 'expectedRefundsVolume',
      label: 'Expected Refunds - Volume (#)',
      section: 'Policy Abuse Prevention',
      type: 'number',
      placeholder: '148,774',
    });
    fields.push({
      field: 'avgRefundValue',
      label: `Average Refunds Value (${currencySymbol})`,
      section: 'Policy Abuse Prevention',
      type: 'currency',
      placeholder: '150',
    });
    fields.push({
      field: 'avgOneWayShipping',
      label: `Avg. 1-Way Shipping Cost (${currencySymbol})`,
      section: 'Policy Abuse Prevention - Operational',
      type: 'currency',
      placeholder: '4.00',
    });
    fields.push({
      field: 'avgFulfilmentCost',
      label: `Avg. Unit Fulfilment Cost (${currencySymbol})`,
      section: 'Policy Abuse Prevention - Operational',
      type: 'currency',
      placeholder: '1.50',
    });
    fields.push({
      field: 'txProcessingFeePct',
      label: 'TX Processing Fees (%)',
      section: 'Policy Abuse Prevention - Operational',
      type: 'percentage',
      placeholder: '2.5',
    });
    fields.push({
      field: 'avgCSTicketCost',
      label: `Avg. CS Ticket Cost (${currencySymbol})`,
      section: 'Policy Abuse Prevention - Operational',
      type: 'currency',
      placeholder: '5.00',
    });
    fields.push({
      field: 'pctINRClaims',
      label: '% of Refund Requests that are INR',
      section: 'Policy Abuse Prevention - Refund Replacement',
      type: 'percentage',
      placeholder: '5',
    });
    fields.push({
      field: 'pctReplacedCredits',
      label: '% Credit or Item Replaced',
      section: 'Policy Abuse Prevention - Refund Replacement',
      type: 'percentage',
      placeholder: '50',
    });
  }

  // Promotion Abuse Section
  if (showPromotionAbuseInputs) {
    fields.push({
      field: 'avgDiscountByAbusers',
      label: 'Average Discount Achieved by Abusers (%)',
      section: 'Promotions Abuse Prevention',
      type: 'percentage',
      placeholder: '30',
    });
    fields.push({
      field: 'promotionAbuseCatchRateToday',
      label: 'Estimated Promotion Abuse Catch Rate Today (%)',
      section: 'Promotions Abuse Prevention',
      type: 'percentage',
      placeholder: '0',
    });
  }

  // Instant Refunds Section
  if (showInstantRefundsInputs) {
    fields.push({
      field: 'refundRate',
      label: 'Refund Rate on Completed Transactions (%)',
      section: 'Instant Refunds',
      type: 'percentage',
      placeholder: '15',
    });
    fields.push({
      field: 'expectedRefundsVolume',
      label: 'Expected Refunds - Volume (#)',
      section: 'Instant Refunds',
      type: 'number',
      placeholder: '152,689',
    });
    fields.push({
      field: 'pctRefundsToCS',
      label: '% of Refund Tickets to CS (%)',
      section: 'Instant Refunds',
      type: 'percentage',
      placeholder: '40',
    });
    fields.push({
      field: 'costPerCSContact',
      label: `Cost per CS Contact (${currencySymbol})`,
      section: 'Instant Refunds',
      type: 'currency',
      placeholder: '5',
    });
  }

  // ATO Protection Section
  if (showATOInputs) {
    fields.push({
      field: 'monthlyLogins',
      label: 'Monthly Number of Logins (#)',
      section: 'ATO Protection',
      type: 'number',
      placeholder: '15,000',
    });
    fields.push({
      field: 'customerLTV',
      label: `Customer Lifetime Value (CLV) - GMV (${currencySymbol})`,
      section: 'ATO Protection',
      type: 'currency',
      placeholder: '450',
    });
    fields.push({
      field: 'avgAppeasementValue',
      label: `Average Appeasement Value (${currencySymbol})`,
      section: 'ATO Protection',
      type: 'currency',
      placeholder: '150',
    });
    fields.push({
      field: 'avgSalaryPerCSMember',
      label: `Avg. Salary per CS Member (${currencySymbol}/year)`,
      section: 'ATO Protection',
      type: 'currency',
      placeholder: '40,000',
    });
    fields.push({
      field: 'avgHandlingTimePerATOClaim',
      label: 'Avg. Handling Time per ATO Claim (mins)',
      section: 'ATO Protection',
      type: 'number',
      placeholder: '20',
    });
    fields.push({
      field: 'pctChurnFromATO',
      label: '% of Users that Churn from ATO (%)',
      section: 'ATO Protection',
      type: 'percentage',
      placeholder: '50',
    });
    
    // Commission / Take Rate - only for marketplaces
    if (isMarketplace === true) {
      fields.push({
        field: 'commissionRate',
        label: 'Commission / Take Rate (%)',
        section: 'ATO Protection',
        type: 'percentage',
        placeholder: '15',
      });
    }
    
    // Gross Margin - always required for ATO Protection
    fields.push({
      field: 'amerGrossMarginPercent',
      label: 'Gross Margin (%)',
      section: 'ATO Protection',
      type: 'percentage',
      placeholder: '50',
    });
  }

  // Sign-up Protection Section
  if (showSignupInputs) {
    fields.push({
      field: 'monthlySignups',
      label: 'Monthly Number of Sign-ups (#)',
      section: 'Sign-up Protection',
      type: 'number',
      placeholder: '5,000',
    });
    fields.push({
      field: 'avgNewMemberBonus',
      label: `Average New Member Bonus/Discount (${currencySymbol})`,
      section: 'Sign-up Protection',
      type: 'currency',
      placeholder: '20',
    });
    fields.push({
      field: 'numDigitalCommunicationsPerYear',
      label: 'Digital Communications per Year (#)',
      section: 'Sign-up Protection',
      type: 'number',
      placeholder: '12',
    });
    fields.push({
      field: 'avgCostPerOutreach',
      label: `Avg. Cost per Outreach (${currencySymbol})`,
      section: 'Sign-up Protection',
      type: 'currency',
      placeholder: '0.50',
    });
    fields.push({
      field: 'avgKYCCostPerAccount',
      label: `Avg. KYC Cost per Account (${currencySymbol})`,
      section: 'Sign-up Protection',
      type: 'currency',
      placeholder: '2.00',
    });
    fields.push({
      field: 'pctAccountsGoingThroughKYC',
      label: '% of Accounts Going Through KYC (%)',
      section: 'Sign-up Protection',
      type: 'percentage',
      placeholder: '50',
    });
  }

  // Remove duplicates by field name (keep first occurrence)
  const uniqueFields: InputField[] = [];
  const seenFields = new Set<string>();
  for (const field of fields) {
    if (!seenFields.has(field.field)) {
      seenFields.add(field.field);
      uniqueFields.push(field);
    }
  }

  return uniqueFields;
}

/**
 * Get a value from formData or segment by field name
 */
function getFieldValue(
  field: InputField,
  formData: Record<string, any>,
  segment?: Segment
): string {
  // If we're getting value for a segment
  if (segment && field.segmentField) {
    const value = segment.inputs[field.segmentField];
    // 0 is a valid value, only return empty for undefined/null
    if (value !== undefined && value !== null) {
      return formatValue(value, field.type);
    }
    return '';
  }
  
  // Get global value from formData
  const value = formData[field.field];
  // 0 is a valid value, only return empty for undefined/null
  if (value !== undefined && value !== null) {
    return formatValue(value, field.type);
  }
  return '';
}

/**
 * Format a value based on its type for CSV output
 */
function formatValue(value: any, type: string): string {
  if (value === undefined || value === null) return '';
  
  const numValue = Number(value);
  if (isNaN(numValue)) return String(value);
  
  if (type === 'percentage') {
    return numValue.toString();
  } else if (type === 'currency' || type === 'number') {
    return numValue.toLocaleString('en-US');
  }
  return numValue.toString();
}

/**
 * Generate CSV content for customer inputs template
 * When segmentation is enabled, generates per-segment rows instead of global
 * Pre-populates "Your Value" with existing data from formData/segments
 */
export function generateCustomerInputsCSV(
  selectedChallenges: { [key: string]: boolean },
  customerName: string = '',
  currencyCode: string = 'USD',
  segments?: Segment[],
  segmentationEnabled: boolean = false,
  formData?: Record<string, any>
): string {
  const currencySymbol = getCurrencySymbol(currencyCode);
  const isMarketplace = formData?.isMarketplace === true;
  const fields = getRequiredInputFields(selectedChallenges, currencySymbol, isMarketplace);
  
  if (fields.length === 0) {
    return '';
  }

  // Determine if we're in segmented mode for payment/fraud challenges
  const hasPaymentChallenges = 
    selectedChallenges['1'] || 
    selectedChallenges['2'] || 
    selectedChallenges['4'] || 
    selectedChallenges['5'];
  const isSegmentMode = segmentationEnabled && hasPaymentChallenges && segments && segments.length > 0;
  const enabledSegments = isSegmentMode ? segments.filter(s => s.enabled) : [];

  // Build CSV
  const lines: string[] = [];
  const analysisName = (formData as any)?._analysisName as string | undefined;
  
  // Header info
  lines.push('# Customer Data Collection Template');
  if (analysisName) {
    lines.push(`# Analysis: ${analysisName}`);
  }
  lines.push(`# Generated for: ${customerName || 'Customer'}`);
  lines.push(`# Currency: ${currencyCode}`);
  lines.push(`# Generated on: ${new Date().toLocaleDateString()}`);
  if (isSegmentMode) {
    lines.push(`# Segmentation: Enabled (${enabledSegments.length} segments)`);
  }
  lines.push('');
  
  // CSV Headers - added Segment column
  lines.push('Segment,Section,Description,Type,Example Value,Your Value,Additional Notes');
  
  // Separate fields into global and segment-specific
  const globalFields = fields.filter(f => !f.segmentField);
  const segmentFields = fields.filter(f => f.segmentField);
  
  // FIRST: Add segment-specific fields grouped by segment (segments at top)
  if (isSegmentMode && segmentFields.length > 0) {
    for (const segment of enabledSegments) {
      const segmentName = segment.name.replace(/\"/g, '\"\"');
      
      // Add segment header comment
      lines.push('');
      lines.push(`# SEGMENT: ${segmentName}`);
      
      // Add all segment-specific fields for this segment
      for (const field of segmentFields) {
        const escapedLabel = field.label.replace(/\"/g, '\"\"');
        const escapedSection = field.section.replace(/\"/g, '\"\"');
        const escapedPlaceholder = (field.placeholder || '').replace(/\"/g, '\"\"');
        const typeWithCurrency = field.type === 'currency' ? `Currency_${currencyCode}` : field.type;
        const existingValue = getFieldValue(field, formData || {}, segment);
        const escapedValue = existingValue.replace(/\"/g, '\"\"');
        
        lines.push(`\"${segmentName}\",\"${escapedSection}\",\"${escapedLabel}\",\"${typeWithCurrency}\",\"${escapedPlaceholder}\",\"${escapedValue}\",\"\"`);
      }
    }
  } else if (!isSegmentMode) {
    // Non-segmented mode: add segment fields as Global
    for (const field of segmentFields) {
      const escapedLabel = field.label.replace(/\"/g, '\"\"');
      const escapedSection = field.section.replace(/\"/g, '\"\"');
      const escapedPlaceholder = (field.placeholder || '').replace(/\"/g, '\"\"');
      const typeWithCurrency = field.type === 'currency' ? `Currency_${currencyCode}` : field.type;
      const existingValue = getFieldValue(field, formData || {});
      const escapedValue = existingValue.replace(/\"/g, '\"\"');
      
      lines.push(`\"Global\",\"${escapedSection}\",\"${escapedLabel}\",\"${typeWithCurrency}\",\"${escapedPlaceholder}\",\"${escapedValue}\",\"\"`);
    }
  }
  
  // SECOND: Add global (non-segment) fields at the bottom
  if (globalFields.length > 0) {
    if (isSegmentMode && segmentFields.length > 0) {
      // Add header for global section when segments are present
      lines.push('');
      lines.push(`# GLOBAL INPUTS`);
    }
    
    for (const field of globalFields) {
      const escapedLabel = field.label.replace(/\"/g, '\"\"');
      const escapedSection = field.section.replace(/\"/g, '\"\"');
      const escapedPlaceholder = (field.placeholder || '').replace(/\"/g, '\"\"');
      const typeWithCurrency = field.type === 'currency' ? `Currency_${currencyCode}` : field.type;
      const existingValue = getFieldValue(field, formData || {});
      const escapedValue = existingValue.replace(/\"/g, '\"\"');
      
      lines.push(`\"Global\",\"${escapedSection}\",\"${escapedLabel}\",\"${typeWithCurrency}\",\"${escapedPlaceholder}\",\"${escapedValue}\",\"\"`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Download the CSV file
 */
export function downloadCustomerInputsCSV(
  selectedChallenges: { [key: string]: boolean },
  customerName: string = '',
  currencyCode: string = 'USD',
  segments?: Segment[],
  segmentationEnabled: boolean = false,
  formData?: Record<string, any>
): void {
  const csvContent = generateCustomerInputsCSV(selectedChallenges, customerName, currencyCode, segments, segmentationEnabled, formData);
  
  if (!csvContent) {
    return;
  }
  
  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  // Format date as MMDDYY
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const dateStr = `${mm}${dd}${yy}`;
  
  const nameForFile = (formData as any)?._analysisName || customerName || 'Customer';
  const sanitizedName = nameForFile
    ? String(nameForFile).replace(/[^a-z0-9]/gi, '_')
    : 'Customer';
  const fileName = `${sanitizedName}_Input_Template (${dateStr}).csv`;
  
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
