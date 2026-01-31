import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Segment } from "@/lib/segments";

interface WeightedAverageTooltipKPIProps {
  segments: Segment[];
  fieldLabel: string;
  getKPIValue: (segment: Segment) => number | undefined;
  weightedValue: number | undefined;
  currencySymbol?: string;
}

export const WeightedAverageTooltipKPI = ({
  segments,
  fieldLabel,
  getKPIValue,
  weightedValue,
  currencySymbol = '$',
}: WeightedAverageTooltipKPIProps) => {
  const enabledSegments = segments.filter(s => s.enabled);
  
  if (enabledSegments.length === 0 || weightedValue === undefined) {
    return null;
  }
  
  const formatNumber = (num: number | undefined) => {
    if (num === undefined) return '-';
    return `${num.toFixed(2)}%`;
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
            Weighted Average: {fieldLabel}
          </p>
          
          <div className="space-y-1 text-xs">
            {enabledSegments.map((segment) => {
              const value = getKPIValue(segment);
              const weight = segment.inputs.grossAttempts ?? 0;
              const weightPct = totalWeight > 0 ? ((weight / totalWeight) * 100).toFixed(1) : '0';
              
              return (
                <div key={segment.id} className="flex justify-between gap-4 py-0.5 border-b border-border/50 last:border-0">
                  <span className="text-muted-foreground">{segment.name}</span>
                  <span className="font-medium">
                    {formatNumber(value)} × {weightPct}%
                  </span>
                </div>
              );
            })}
          </div>
          
          <div className="pt-2 border-t border-border flex justify-between">
            <span className="font-medium text-sm">Weighted Avg</span>
            <span className="font-semibold text-primary">
              {formatNumber(weightedValue)}
            </span>
          </div>
          
          <p className="text-xs text-muted-foreground pt-1">
            Weighted by Transaction Attempts
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
