import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface NumericInputProps {
  value: number | undefined | null;
  onChange: (value: number) => void;
  placeholder?: string;
  formatWithCommas?: boolean;
  className?: string;
  disabled?: boolean;
  showZero?: boolean;
  /** Optional warning message to display below the input */
  warning?: string | null;
  /** Number of decimal places to display (default: no fixed decimals) */
  decimalPlaces?: number;
  /** Read-only mode with different styling (black text, no border) */
  readOnly?: boolean;
}

const formatNumber = (
  num: number | undefined | null,
  formatWithCommas: boolean,
  showZero: boolean,
  decimalPlaces?: number,
): string => {
  if (num === undefined || num === null) return "";
  if (num === 0) return showZero ? (decimalPlaces !== undefined ? (0).toFixed(decimalPlaces) : "0") : "";
  
  if (decimalPlaces !== undefined) {
    const fixed = num.toFixed(decimalPlaces);
    return formatWithCommas ? Number(fixed).toLocaleString("en-US", { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces }) : fixed;
  }
  return formatWithCommas ? num.toLocaleString("en-US") : String(num);
};

const tryParseNumber = (
  raw: string,
  opts?: { allowTrailingDot?: boolean },
): number | null => {
  const cleaned = raw.replace(/,/g, "").replace(/\$/g, "").trim();
  if (cleaned === "" || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
  if (!opts?.allowTrailingDot && cleaned.endsWith(".")) return null;

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
};

export const NumericInput = ({
  value,
  onChange,
  placeholder,
  formatWithCommas = false,
  className,
  disabled = false,
  showZero = false,
  warning,
  decimalPlaces,
  readOnly = false,
}: NumericInputProps) => {
  const [displayValue, setDisplayValue] = useState<string>(() =>
    formatNumber(value, formatWithCommas, showZero, decimalPlaces)
  );
  const [isFocused, setIsFocused] = useState(false);

  // Keep display in sync with external value when NOT editing.
  useEffect(() => {
    if (isFocused) return;
    const next = formatNumber(value, formatWithCommas, showZero, decimalPlaces);
    setDisplayValue((prev) => (prev === next ? prev : next));
  }, [value, formatWithCommas, showZero, isFocused, decimalPlaces]);

  const handleFocus = () => {
    setIsFocused(true);
    // Show unformatted raw value while typing
    const raw = value === undefined || value === null ? "" : String(value);
    setDisplayValue(showZero ? raw : value && value !== 0 ? String(value) : "");
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = tryParseNumber(displayValue, { allowTrailingDot: true });
    const nextValue = parsed ?? 0;
    const currentValue = value ?? 0;

    if (nextValue !== currentValue) {
      onChange(nextValue);
    }

    setDisplayValue(formatNumber(nextValue, formatWithCommas, showZero, decimalPlaces));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDisplayValue(raw);

    // Only push up a value when it parses cleanly (prevents bouncing on partial edits)
    const parsed = tryParseNumber(raw, { allowTrailingDot: false });
    if (parsed !== null) onChange(parsed);
  };

  // Determine if we're in readonly mode (for segmentation aggregations)
  const isReadOnly = readOnly || disabled;
  
  return (
    <div className="w-full">
      <Input
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={cn(
          className,
          "placeholder:text-muted-foreground/40",
          readOnly && "border-transparent bg-transparent text-foreground cursor-default shadow-none focus-visible:ring-0",
          disabled && !readOnly && "bg-muted text-muted-foreground cursor-not-allowed",
          warning && "border-amber-500 focus-visible:ring-amber-500",
        )}
        disabled={isReadOnly}
        readOnly={readOnly}
      />
      {warning && (
        <div className="flex items-center gap-1 mt-1 text-amber-600 text-xs">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span>{warning}</span>
        </div>
      )}
    </div>
  );
};
