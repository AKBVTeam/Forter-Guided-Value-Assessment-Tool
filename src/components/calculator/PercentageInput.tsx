import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PercentageInputProps {
  value: number | undefined | null;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Optional warning message to display below the input */
  warning?: string | null;
  /** Number of decimal places to display (default: 2) */
  decimalPlaces?: number;
  /** Minimum value (default: 0) */
  min?: number;
  /** Maximum value (default: 100) */
  max?: number;
  /** Step for slider (default: 0.1) */
  step?: number;
  /** Hide the slider (default: false) */
  hideSlider?: boolean;
  /** Read-only mode with different styling (black text, no border, greyed slider) */
  readOnly?: boolean;
}

const formatPercentage = (
  num: number | undefined | null,
  decimalPlaces: number = 2,
): string => {
  if (num === undefined || num === null) return "";
  return num.toFixed(decimalPlaces);
};

const tryParseNumber = (
  raw: string,
  opts?: { allowTrailingDot?: boolean },
): number | null => {
  const cleaned = raw.replace(/,/g, "").replace(/%/g, "").trim();
  if (cleaned === "" || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
  if (!opts?.allowTrailingDot && cleaned.endsWith(".")) return null;

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
};

export const PercentageInput = ({
  value,
  onChange,
  placeholder = "0",
  className,
  disabled = false,
  warning,
  decimalPlaces = 2,
  min = 0,
  max = 100,
  step = 0.1,
  hideSlider = false,
  readOnly = false,
}: PercentageInputProps) => {
  // Treat undefined/null as 0 for display purposes (0 is valid)
  const effectiveValue = value ?? 0;
  
  const [displayValue, setDisplayValue] = useState<string>(() =>
    formatPercentage(effectiveValue, decimalPlaces)
  );
  const [isFocused, setIsFocused] = useState(false);

  // Keep display in sync with external value when NOT editing.
  useEffect(() => {
    if (isFocused) return;
    const next = formatPercentage(effectiveValue, decimalPlaces);
    setDisplayValue((prev) => (prev === next ? prev : next));
  }, [effectiveValue, isFocused, decimalPlaces]);

  const handleFocus = () => {
    setIsFocused(true);
    // Show raw value while typing
    setDisplayValue(String(effectiveValue));
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = tryParseNumber(displayValue, { allowTrailingDot: true });
    // Clamp to min/max range
    let nextValue = parsed ?? 0;
    nextValue = Math.max(min, Math.min(max, nextValue));
    
    if (nextValue !== effectiveValue) {
      onChange(nextValue);
    }

    setDisplayValue(formatPercentage(nextValue, decimalPlaces));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDisplayValue(raw);

    // Only push up a value when it parses cleanly (prevents bouncing on partial edits)
    const parsed = tryParseNumber(raw, { allowTrailingDot: false });
    if (parsed !== null) {
      // Clamp to range
      const clamped = Math.max(min, Math.min(max, parsed));
      onChange(clamped);
    }
  };

  const handleSliderChange = (values: number[]) => {
    const newValue = values[0];
    onChange(newValue);
    if (!isFocused) {
      setDisplayValue(formatPercentage(newValue, decimalPlaces));
    }
  };

  // Determine if we're in readonly mode (for segmentation aggregations)
  const isReadOnly = readOnly || disabled;

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center gap-3">
        <Input
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={cn(
            "w-24 text-right",
            className,
            "placeholder:text-muted-foreground/40",
            readOnly && "border-transparent bg-transparent text-foreground cursor-default shadow-none focus-visible:ring-0",
            disabled && !readOnly && "bg-muted text-muted-foreground cursor-not-allowed",
            warning && "border-amber-500 focus-visible:ring-amber-500",
          )}
          disabled={isReadOnly}
          readOnly={readOnly}
        />
        <span className="text-sm text-muted-foreground">%</span>
        {!hideSlider && (
          <div className="flex-1">
            <Slider
              value={[effectiveValue]}
              onValueChange={handleSliderChange}
              min={min}
              max={max}
              step={step}
              disabled={isReadOnly}
              className={cn("w-full", readOnly && "opacity-40")}
            />
          </div>
        )}
      </div>
      {warning && (
        <div className="flex items-center gap-1 text-amber-600 text-xs">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span>{warning}</span>
        </div>
      )}
    </div>
  );
};

