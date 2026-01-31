import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { CalculatorData } from "@/pages/Index";
import { SavedAnalysis } from "./WelcomeDialog";

interface ExitSavePromptProps {
  currentData: CalculatorData;
  customerLogoUrl: string;
  hasUnsavedChanges: boolean;
}

export const ExitSavePrompt = ({ currentData, customerLogoUrl, hasUnsavedChanges }: ExitSavePromptProps) => {
  const [showDialog, setShowDialog] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [authorName, setAuthorName] = useState("");

  const handleSave = useCallback(() => {
    const name = saveName.trim() || currentData.customerName || `Analysis ${new Date().toLocaleDateString()}`;
    
    const newAnalysis: SavedAnalysis = {
      id: Date.now().toString(),
      name,
      authorName: authorName.trim() || undefined,
      data: currentData,
      customerLogoUrl,
      savedAt: new Date(),
    };

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

    // Add new and save
    const updated = [...existing, newAnalysis];
    localStorage.setItem("forter_saved_analyses", JSON.stringify(updated));
    
    toast.success(`Analysis "${name}" saved successfully`);
    setShowDialog(false);
    setSaveName("");
    setAuthorName("");
  }, [saveName, authorName, currentData, customerLogoUrl]);

  const handleLeaveWithoutSaving = () => {
    setShowDialog(false);
  };

  // Listen for beforeunload event
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        // Show custom dialog instead of browser default
        setShowDialog(true);
        // Return value is required for some browsers
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Listen for visibility change (tab switching, minimizing)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && hasUnsavedChanges) {
        // Auto-save as draft when tab becomes hidden
        const existingRaw = localStorage.getItem("forter_saved_analyses");
        let existing: SavedAnalysis[] = [];
        if (existingRaw) {
          try {
            existing = JSON.parse(existingRaw);
          } catch (e) {
            console.error("Failed to parse saved analyses", e);
          }
        }
        
        // Check if there's already an auto-save draft
        const draftIndex = existing.findIndex(a => a.name.startsWith('[Auto-saved]'));
        const draftAnalysis: SavedAnalysis = {
          id: draftIndex >= 0 ? existing[draftIndex].id : Date.now().toString(),
          name: `[Auto-saved] ${currentData.customerName || 'Draft'}`,
          data: currentData,
          customerLogoUrl,
          savedAt: new Date(),
        };
        
        if (draftIndex >= 0) {
          existing[draftIndex] = draftAnalysis;
        } else {
          existing.push(draftAnalysis);
        }
        
        localStorage.setItem("forter_saved_analyses", JSON.stringify(existing));
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [hasUnsavedChanges, currentData, customerLogoUrl]);

  return (
    <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Save analysis before leaving?</AlertDialogTitle>
          <AlertDialogDescription>
            There are unsaved changes. Save the analysis before leaving?
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="exit-analysis-name">Analysis Name</Label>
            <Input
              id="exit-analysis-name"
              placeholder={currentData.customerName || "Enter a name for this analysis"}
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exit-author-name">Author Name</Label>
            <Input
              id="exit-author-name"
              placeholder="Enter your name"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={handleLeaveWithoutSaving}>
            Leave Without Saving
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Save className="w-4 h-4" />
            Save & Continue
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
