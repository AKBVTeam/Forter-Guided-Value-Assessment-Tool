import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calculator, ClipboardList, Plus } from "lucide-react";

interface ValueSummaryEmptyStateProps {
  onAddCustomCalculation: () => void;
  onSelectUseCases: () => void;
}

export const ValueSummaryEmptyState = ({
  onAddCustomCalculation,
  onSelectUseCases,
}: ValueSummaryEmptyStateProps) => {
  return (
    <Card className="p-12">
      <div className="text-center space-y-6 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
          <Calculator className="w-8 h-8 text-muted-foreground" />
        </div>
        
        <div>
          <h3 className="text-xl font-semibold mb-2">No Value Drivers Selected</h3>
          <p className="text-muted-foreground">
            Add custom calculations or go back to select use cases to build your value model
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={onAddCustomCalculation} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Custom Calculation
          </Button>
          <Button variant="outline" onClick={onSelectUseCases} className="gap-2">
            <ClipboardList className="w-4 h-4" />
            Select Use Cases
          </Button>
        </div>
      </div>
    </Card>
  );
};
