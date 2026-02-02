import { Card } from "@/components/ui/card";
import { SOLUTION_PRODUCTS, ALL_CHALLENGES } from "@/lib/calculations";
import { Shield, CreditCard, FileText, Ban, UserCheck, Building, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface SolutionMappingProps {
  selectedChallenges: { [key: string]: boolean };
  showCard?: boolean;
}

const iconMap: { [key: string]: React.ElementType } = {
  Shield,
  CreditCard,
  FileText,
  Ban,
  UserCheck,
  Building,
};

export const SolutionMapping = ({ selectedChallenges, showCard = true }: SolutionMappingProps) => {
  // Get all active solution IDs from selected challenges
  const activeSolutions = new Set<string>();
  
  Object.entries(selectedChallenges).forEach(([challengeId, isSelected]) => {
    if (isSelected) {
      const challenge = ALL_CHALLENGES.find(c => c.id === challengeId);
      if (challenge) {
        challenge.solutionMapping.forEach(solution => activeSolutions.add(solution));
      }
    }
  });

  const hasAnyActive = activeSolutions.size > 0;

  const content = (
    <div className="space-y-2">
      {SOLUTION_PRODUCTS.map((product) => {
        const IconComponent = iconMap[product.icon];
        const isActive = activeSolutions.has(product.id);
        
        return (
          <div
            key={product.id}
            className={cn(
              "flex items-center gap-3 p-2 rounded-lg transition-colors duration-200 select-none",
              isActive 
                ? "bg-green-100/90 dark:bg-green-900/40 border border-green-200 dark:border-green-700" 
                : "bg-muted/30 opacity-50"
            )}
          >
            <div className={cn(
              "p-1.5 rounded-md shrink-0",
              isActive ? "bg-green-600 dark:bg-green-600 text-white" : "bg-muted text-muted-foreground"
            )}>
              {IconComponent && <IconComponent className="w-4 h-4" />}
            </div>
            <span className={cn(
              "text-sm font-medium",
              isActive ? "text-green-800 dark:text-green-200" : "text-muted-foreground"
            )}>
              {product.name}
            </span>
            {isActive && (
              <span className="ml-auto text-xs bg-green-200/80 dark:bg-green-800/50 text-green-800 dark:text-green-200 px-2 py-0.5 rounded-full">
                Active
              </span>
            )}
          </div>
        );
      })}
    </div>
  );

  if (!showCard) {
    return content;
  }

  return (
    <Card className={cn(
      "p-4 border animate-bounce-in",
      hasAnyActive
        ? "bg-green-50/90 dark:bg-green-950/40 border-green-200 dark:border-green-800"
        : "bg-slate-50/80 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700"
    )}>
      <div className="flex items-center gap-2 mb-3">
        <h4 className={cn(
          "font-semibold text-sm uppercase tracking-wide",
          hasAnyActive ? "text-green-800 dark:text-green-300" : "text-slate-600 dark:text-slate-400"
        )}>
          Solution Mapping
        </h4>
        <span className={cn(
          "inline-flex items-center gap-1 text-xs",
          hasAnyActive ? "text-green-700 dark:text-green-400" : "text-slate-500 dark:text-slate-400"
        )}>
          <Eye className="w-3.5 h-3.5" aria-hidden />
          For reference
        </span>
      </div>
      {content}
    </Card>
  );
};