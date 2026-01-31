import * as React from "react";
import { CalculatorData } from "@/pages/Index";
import { getRequiredInputFields } from "@/lib/csvExport";
import { getCurrencySymbol } from "@/lib/benchmarkData";

interface InputProgress {
  filled: number;
  total: number;
  percentage: number;
}

/**
 * Calculate how many required input fields have been filled
 */
export function useInputProgress(
  formData: CalculatorData,
  selectedChallenges: { [key: string]: boolean }
): InputProgress {
  return React.useMemo(() => {
    const currencySymbol = getCurrencySymbol(formData.baseCurrency || 'USD');
    const requiredFields = getRequiredInputFields(selectedChallenges, currencySymbol);
    
    if (requiredFields.length === 0) {
      return { filled: 0, total: 0, percentage: 0 };
    }
    
    let filledCount = 0;
    
    for (const field of requiredFields) {
      const value = formData[field.field as keyof CalculatorData];
      
      // Check if the field has a meaningful value
      if (value !== undefined && value !== null && value !== '' && value !== 0) {
        filledCount++;
      }
    }
    
    const percentage = Math.round((filledCount / requiredFields.length) * 100);
    
    return {
      filled: filledCount,
      total: requiredFields.length,
      percentage,
    };
  }, [formData, selectedChallenges]);
}
