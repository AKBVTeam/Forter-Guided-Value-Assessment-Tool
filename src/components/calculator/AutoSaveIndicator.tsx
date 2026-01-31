import { Check, Loader2, AlertCircle, Cloud, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";

interface AutoSaveIndicatorProps {
  status: "idle" | "saving" | "saved" | "error";
  saveLocation?: "local" | "cloud" | null;
  className?: string;
}

export const AutoSaveIndicator = ({ status, saveLocation, className }: AutoSaveIndicatorProps) => {
  if (status === "idle") {
    return null;
  }

  const LocationIcon = saveLocation === "cloud" ? Cloud : HardDrive;

  return (
    <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      {status === "saving" && (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Saving...</span>
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="w-3 h-3 text-green-600" />
          <LocationIcon className="w-3 h-3 text-green-600" />
          <span className="text-green-600">
            Saved {saveLocation === "cloud" ? "to cloud" : "locally"}
          </span>
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle className="w-3 h-3 text-destructive" />
          <span className="text-destructive">Save failed</span>
        </>
      )}
    </div>
  );
};
