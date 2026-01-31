import * as React from "react";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface InputProgressIndicatorProps {
  filled: number;
  total: number;
  percentage: number;
}

export function InputProgressIndicator({ filled, total, percentage }: InputProgressIndicatorProps) {
  if (total === 0) {
    return null;
  }
  
  const isComplete = filled === total;
  
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-muted/50 rounded-lg border">
      <div className="flex-1 min-w-[120px] max-w-[200px]">
        <Progress 
          value={percentage} 
          className={cn(
            "h-2",
            isComplete && "[&>div]:bg-green-500"
          )}
        />
      </div>
      <div className="flex items-center gap-1.5 text-sm font-medium whitespace-nowrap">
        {isComplete ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-green-600">Complete</span>
          </>
        ) : (
          <span className="text-muted-foreground">
            {filled} / {total} fields
          </span>
        )}
      </div>
    </div>
  );
}
