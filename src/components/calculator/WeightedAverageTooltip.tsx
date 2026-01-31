import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Segment } from "@/lib/segments";

type FieldType = 'currency' | 'number' | 'percentage';

// Determine the field type based on the field key
const getFieldType = (fieldKey: keyof Segment['inputs']): FieldType => {
  // Currency fields (value-based, should show $ symbol)
  const currencyFields: (keyof Segment['inputs'])[] = [
    'annualGMV', 
    'fraudCBAOV', 
    'completedAOV',
  ];
  
  // Number fields (count/volume, should show with # format, no $ or %)
  const numberFields: (keyof Segment['inputs'])[] = [
    'grossAttempts',
  ];
  
  // Percentage fields (rates, should show with % symbol)
  const percentageFields: (keyof Segment['inputs'])[] = [
    'preAuthApprovalRate',
    'postAuthApprovalRate',
    'creditCardPct',
    'threeDSChallengeRate',
    'threeDSAbandonmentRate',
    'issuingBankDeclineRate',
    'fraudCBRate',
  ];
  
  if (currencyFields.includes(fieldKey)) return 'currency';
  if (numberFields.includes(fieldKey)) return 'number';
  if (percentageFields.includes(fieldKey)) return 'percentage';
  
  // Default to number for unknown fields
  return 'number';
};

interface WeightedAverageTooltipProps {
  segments: Segment[];
  fieldLabel: string;
  fieldKey: keyof Segment['inputs'];
  weightedValue: number | undefined;
  isSumField?: boolean;
  currencySymbol?: string;
}

export const WeightedAverageTooltip = ({
  segments,
  fieldLabel,
  fieldKey,
  weightedValue,
  isSumField = false,
  currencySymbol = '$',
}: WeightedAverageTooltipProps) => {
  const enabledSegments = segments.filter(s => s.enabled);
  
  if (enabledSegments.length === 0 || weightedValue === undefined) {
    return null;
  }
  
  // Determine field type based on fieldKey
  const fieldType = getFieldType(fieldKey);
  
  const formatValue = (num: number | undefined): string => {
    if (num === undefined) return '-';
    
    switch (fieldType) {
      case 'currency':
        return `${currencySymbol}${num.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
      case 'number':
        return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
      case 'percentage':
        return `${num.toFixed(2)}%`;
      default:
        return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }
  };
  
  // Calculate total weight (transaction volume)
  const totalWeight = enabledSegments.reduce((sum, s) => sum + (s.inputs.grossAttempts ?? 0), 0);
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-4 w-4 text-muted-foreground cursor-help hover:text-primary transition-colors" />
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-sm p-3">
        <div className="space-y-2">
          <p className="font-medium text-sm">
            {isSumField ? 'Sum' : 'Weighted Average'}: {fieldLabel}
          </p>
          
          <div className="space-y-1 text-xs">
            {enabledSegments.map((segment) => {
              let value = segment.inputs[fieldKey] as number | undefined;
              const weight = segment.inputs.grossAttempts ?? 0;
              const weightPct = totalWeight > 0 ? ((weight / totalWeight) * 100).toFixed(1) : '0';
              
              // For completedAOV, calculate from GMV/attempts if not explicitly set
              if (fieldKey === 'completedAOV' && (value === undefined || value <= 0) && weight > 0) {
                const gmv = segment.inputs.annualGMV ?? 0;
                value = gmv / weight;
              }
              
              return (
                <div key={segment.id} className="flex justify-between gap-4 py-0.5 border-b border-border/50 last:border-0">
                  <span className="text-muted-foreground">{segment.name}</span>
                  <span className="font-medium">
                    {isSumField 
                      ? formatValue(value)
                      : `${formatValue(value)} × ${weightPct}%`
                    }
                  </span>
                </div>
              );
            })}
          </div>
          
          <div className="pt-2 border-t border-border flex justify-between">
            <span className="font-medium text-sm">
              {isSumField ? 'Total' : 'Weighted Avg'}
            </span>
            <span className="font-semibold text-primary">
              {formatValue(weightedValue)}
            </span>
          </div>
          
          {!isSumField && (
            <p className="text-xs text-muted-foreground pt-1">
              Weighted by Transaction Attempts
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
