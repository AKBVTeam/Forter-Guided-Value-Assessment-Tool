import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { CalculatorData } from "@/pages/Index";
import { SavedAnalysis } from "./WelcomeDialog";

interface SaveAnalysisButtonProps {
  currentData: CalculatorData;
  customerLogoUrl: string;
  onSaved?: (savedAt: Date) => void;
}

export const SaveAnalysisButton = ({ currentData, customerLogoUrl, onSaved }: SaveAnalysisButtonProps) => {
  const handleSave = () => {
    // Check if this analysis already has an ID (was auto-saved at start)
    const existingId = (currentData as any)._analysisId;
    const existingName = (currentData as any)._analysisName;
    const existingAuthor = (currentData as any)._authorName;
    
    // Get existing analyses
    const existingRaw = localStorage.getItem("forter_saved_analyses");
    let existing: SavedAnalysis[] = [];
    if (existingRaw) {
      try {
        existing = JSON.parse(existingRaw);
      } catch (e) {
        console.error("Failed to parse saved analyses", e);
      }
    }
    
    const now = new Date();
    const dataWithUpdatedAt = { ...currentData, _lastUpdatedAt: now.toISOString() } as CalculatorData;

    if (existingId) {
      // Update existing analysis instead of creating new
      const updatedAnalyses = existing.map(analysis => {
        if (analysis.id === existingId) {
          return {
            ...analysis,
            data: dataWithUpdatedAt,
            customerLogoUrl,
            savedAt: now,
          };
        }
        return analysis;
      });
      localStorage.setItem("forter_saved_analyses", JSON.stringify(updatedAnalyses));
      onSaved?.(now);
      toast.success(`Analysis "${existingName}" updated successfully`);
    } else {
      // Fallback: create new analysis with name from data or default
      const name = existingName || currentData.customerName || `Analysis ${new Date().toLocaleDateString()}`;
      const newAnalysis: SavedAnalysis = {
        id: Date.now().toString(),
        name,
        authorName: existingAuthor,
        data: dataWithUpdatedAt,
        customerLogoUrl,
        savedAt: now,
      };
      const updated = [...existing, newAnalysis];
      localStorage.setItem("forter_saved_analyses", JSON.stringify(updated));
      onSaved?.(now);
      toast.success(`Analysis "${name}" saved successfully`);
    }
  };

  return (
    <Button variant="outline" size="sm" className="gap-2" onClick={handleSave}>
      <Save className="w-4 h-4" />
      Save
    </Button>
  );
};
