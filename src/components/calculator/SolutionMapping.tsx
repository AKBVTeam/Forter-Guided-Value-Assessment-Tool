import { Card } from "@/components/ui/card";
import { SOLUTION_PRODUCTS, ALL_CHALLENGES } from "@/lib/calculations";
import { Shield, CreditCard, FileText, Ban, UserCheck, Building } from "lucide-react";
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

  const content = (
    <div className="space-y-2">
      {SOLUTION_PRODUCTS.map((product) => {
        const IconComponent = iconMap[product.icon];
        const isActive = activeSolutions.has(product.id);
        
        return (
          <div
            key={product.id}
            className={cn(
              "flex items-center gap-3 p-2 rounded-lg transition-all duration-200",
              isActive 
                ? "bg-primary/10 border border-primary/30" 
                : "bg-muted/30 opacity-50"
            )}
          >
            <div className={cn(
              "p-1.5 rounded-md",
              isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              {IconComponent && <IconComponent className="w-4 h-4" />}
            </div>
            <span className={cn(
              "text-sm font-medium",
              isActive ? "text-primary" : "text-muted-foreground"
            )}>
              {product.name}
            </span>
            {isActive && (
              <span className="ml-auto text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
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
    <Card className="p-4">
      <h4 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wide">
        Solution Mapping
      </h4>
      {content}
    </Card>
  );
};