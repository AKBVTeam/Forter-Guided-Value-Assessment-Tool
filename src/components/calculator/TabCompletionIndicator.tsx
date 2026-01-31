import { Check } from "lucide-react";

interface TabCompletionIndicatorProps {
  /** Progress value from 0 to 1 */
  progress: number;
  /** Size of the indicator in pixels */
  size?: number;
}

/**
 * Circular progress indicator with checkmark for tab completion.
 * - 0% progress: hidden
 * - 1-99% progress: partial donut ring
 * - 100% progress: full ring with checkmark
 */
export function TabCompletionIndicator({ progress, size = 16 }: TabCompletionIndicatorProps) {
  // Don't render if no progress
  if (progress <= 0) return null;

  const isComplete = progress >= 1;
  const strokeWidth = 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(progress, 1));
  const center = size / 2;

  if (isComplete) {
    // Full completion: solid checkmark
    return (
      <div 
        className="flex items-center justify-center rounded-full bg-green-500"
        style={{ width: size, height: size }}
      >
        <Check className="text-white" style={{ width: size * 0.625, height: size * 0.625 }} strokeWidth={3} />
      </div>
    );
  }

  // Partial completion: donut progress ring with checkmark inside
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted-foreground/30"
        />
        {/* Progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="text-green-500"
        />
      </svg>
      {/* Checkmark in center */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Check 
          className="text-green-500" 
          style={{ width: size * 0.5, height: size * 0.5 }} 
          strokeWidth={3} 
        />
      </div>
    </div>
  );
}
