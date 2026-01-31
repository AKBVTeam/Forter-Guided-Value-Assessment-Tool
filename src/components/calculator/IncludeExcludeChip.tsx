import * as React from "react";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

type IncludeExcludeChipProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange" | "onClick"
> & {
  included: boolean;
  onIncludedChange: (included: boolean) => void;
  widthClassName?: string;
};

export function IncludeExcludeChip({
  included,
  onIncludedChange,
  widthClassName,
  className,
  ...props
}: IncludeExcludeChipProps) {
  const toggle = React.useCallback(() => {
    onIncludedChange(!included);
  }, [included, onIncludedChange]);

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={included}
      aria-label={included ? "Included" : "Excluded"}
      onClick={toggle}
      className={cn(
        "relative h-5 shrink-0 select-none inline-flex items-center justify-center rounded-full px-2.5 pr-6 text-xs font-medium leading-none whitespace-nowrap transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        widthClassName ?? "w-[96px]",
        included
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground",
        className,
      )}
      {...props}
    >
      <span className="w-full text-center">{included ? "Included" : "Excluded"}</span>
      <Check
        aria-hidden="true"
        className={cn(
          "absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 transition-opacity",
          included ? "opacity-100" : "opacity-0",
        )}
      />
    </button>
  );
}
