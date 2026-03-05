import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface CalculationBreakdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  columns?: string[]; // For multi-column layout e.g., ["Current", "Impact", "Forter"]
  calculations: {
    label: string;
    value?: string | number; // Single column value (backward compatible)
    currentValue?: string | number; // Multi-column values
    impactValue?: string | number;
    forterValue?: string | number;
    formula?: string;
    isResult?: boolean;
    isHeader?: boolean;
    isSubheader?: boolean;
    isBad?: boolean; // For negative metrics like declines
  }[];
}

export const CalculationBreakdown = ({
  open,
  onOpenChange,
  title,
  columns,
  calculations,
}: CalculationBreakdownProps) => {
  const isMultiColumn = columns && columns.length > 0;

  const formatValue = (value: string | number | undefined, label?: string) => {
    if (value === undefined || value === null) return "";
    if (typeof value === "number") {
      // Check label to determine formatting
      const isDollarValue = label?.includes("($)");
      const isPercentValue = label?.includes("(%)");
      const isCountValue = label?.includes("(#)");
      
      if (isPercentValue) {
        // Round to 2 decimal places max, remove trailing zeros
        const rounded = Math.round(value * 100) / 100;
        return `${rounded}%`;
      }
      
      if (isCountValue) {
        // Format as plain number with commas, no decimals
        return new Intl.NumberFormat("en-US", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(Math.round(value));
      }
      
      if (isDollarValue || value > 1000) {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(Math.round(value));
      }
      
      // Round to 2 significant figures for small numbers
      const rounded = Math.round(value * 100) / 100;
      return rounded.toString();
    }
    return value;
  };

  const formatImpact = (impact: string | number | undefined, label?: string) => {
    if (impact === undefined || impact === null) return "";
    const str = String(impact);
    
    // Check for zero values - return without + sign
    if (str === "$0" || str === "0" || str === "0%" || str === "0.00%" || str === "+0" || str === "+$0" || str === "+0%") {
      return str.replace("+", ""); // Remove + if present
    }
    
    // If it already has a sign or percentage, return as is
    if (str.startsWith("+") || str.startsWith("-") || str.includes("%pp") || str.includes("%")) {
      return str;
    }
    
    // Format numeric impacts based on label type
    if (typeof impact === "number") {
      const isDollarValue = label?.includes("($)");
      const isCountValue = label?.includes("(#)");
      
      if (isCountValue) {
        // Format as plain number with commas, no decimals
        const rounded = Math.round(Math.abs(impact));
        const formatted = new Intl.NumberFormat("en-US", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(rounded);
        return impact > 0 ? `+${formatted}` : impact < 0 ? `-${formatted}` : formatted;
      }
      
      if (isDollarValue) {
        const rounded = Math.round(Math.abs(impact));
        const formatted = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(rounded);
        return impact > 0 ? `+${formatted}` : impact < 0 ? `-${formatted}` : formatted;
      }
      
      const rounded = Math.round(impact * 100) / 100;
      return rounded > 0 ? `+${rounded}` : rounded.toString();
    }
    
    // Add + for positive string numbers that don't have it
    if (typeof impact === "string" && !str.startsWith("-")) return `+${str}`;
    
    return str;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[min(100%,min(72rem,calc(100vw-2rem)))] p-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Detailed breakdown of how this metric is calculated
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[78vh] pr-0">
          {isMultiColumn ? (
            <div className="overflow-x-auto">
              <div className="min-w-[1500px] space-y-2">
                {/* Column Headers */}
              <div className="grid grid-cols-[90px_minmax(560px,6fr)_minmax(170px,1fr)_minmax(170px,1fr)_minmax(170px,1fr)] gap-6 items-center py-4 border-b-2 border-primary/20 font-bold text-base bg-background px-4 rounded-t sticky top-0 z-10">
                <div>Formula</div>
                <div>Description</div>
                <div className="text-right">{columns[0]}</div>
                <div className="text-right">{columns[1]}</div>
                <div className="text-right">{columns[2]}</div>
              </div>
              {calculations.map((calc, index) => {
                if (calc.isHeader) {
                  return (
                    <div key={index} className="text-center font-bold text-primary text-lg pt-4 pb-2 border-b">
                      {calc.label}
                    </div>
                  );
                }
                
                if (calc.isSubheader) {
                  return (
                    <div key={index} className="font-semibold text-sm text-muted-foreground pt-3 pb-1 uppercase tracking-wide bg-muted/30 px-2 py-1 rounded">
                      {calc.label}
                    </div>
                  );
                }
                
                return (
                  <div key={index}>
                    <div className={`grid grid-cols-[90px_minmax(560px,6fr)_minmax(170px,1fr)_minmax(170px,1fr)_minmax(170px,1fr)] gap-6 items-center py-3 px-4 ${calc.isResult ? "font-bold text-base border-t-2 border-primary pt-4 bg-primary/5 rounded" : ""}`}>
                      <div className={`font-mono text-sm ${calc.isResult ? "text-primary font-bold" : "text-muted-foreground"}`}>
                        {calc.formula || ""}
                      </div>
                      <div className={`${calc.isResult ? "text-primary font-bold" : ""}`}>
                        {calc.label}
                      </div>
                      <div className="text-right text-foreground">
                        {formatValue(calc.currentValue, calc.label)}
                      </div>
                      <div className={`text-right font-medium ${
                        (() => {
                          const impactStr = String(calc.impactValue);
                          // Neutral values (N/A, 0, empty)
                          if (!impactStr || impactStr === "N/A" || impactStr === "0" || impactStr === "$0" || impactStr === "0.00%" || impactStr === "+0" || impactStr === "+$0") {
                            return "text-foreground";
                          }
                          // For "bad" metrics (declines, abandonment), negative is favorable (green)
                          if (calc.isBad) {
                            return impactStr.includes("-") 
                              ? "text-green-600 dark:text-green-400" 
                              : "text-destructive";
                          }
                          // For normal metrics, positive is favorable (green)
                          return impactStr.includes("-") 
                            ? "text-destructive" 
                            : "text-green-600 dark:text-green-400";
                        })()
                      }`}>
                        {formatImpact(calc.impactValue, calc.label)}
                      </div>
                      <div className="text-right text-foreground">
                        {formatValue(calc.forterValue, calc.label)}
                      </div>
                    </div>
                    {!calc.isResult && !calc.isHeader && !calc.isSubheader && index < calculations.length - 1 && !calculations[index + 1]?.isHeader && !calculations[index + 1]?.isSubheader && (
                      <Separator className="my-1" />
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {calculations.map((calc, index) => {
                if (calc.isHeader) {
                  return (
                    <div key={index} className="text-center font-bold text-primary text-lg pt-4 pb-2">
                      {calc.label}
                    </div>
                  );
                }
                
                if (calc.isSubheader) {
                  return (
                    <div key={index} className="font-semibold text-sm text-muted-foreground pt-3 pb-1 uppercase tracking-wide">
                      {calc.label}
                    </div>
                  );
                }
                
                return (
                  <div key={index}>
                    <div
                      className={`flex justify-between items-start gap-4 ${
                        calc.isResult ? "font-bold text-lg pt-2" : ""
                      }`}
                    >
                      <div className="flex-1">
                        <div className={calc.isResult ? "text-primary" : ""}>
                          {calc.label}
                        </div>
                        {calc.formula && (
                          <div className="text-xs text-muted-foreground font-mono mt-1 bg-muted p-2 rounded">
                            {calc.formula}
                          </div>
                        )}
                      </div>
                      <div className={`text-right whitespace-nowrap ${calc.isResult ? "text-primary" : ""}`}>
                        {formatValue(calc.value, calc.label)}
                      </div>
                    </div>
                    {!calc.isResult && !calc.isHeader && !calc.isSubheader && index < calculations.length - 1 && !calculations[index + 1]?.isHeader && !calculations[index + 1]?.isSubheader && (
                      <Separator className="my-2" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
