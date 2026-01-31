import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { CalculatorData } from "@/pages/Index";
import { SavedAnalysis } from "./WelcomeDialog";

interface SaveAsDialogProps {
  currentData: CalculatorData;
  customerLogoUrl: string;
  onSaveAs: (newAnalysisId: string, newName: string) => void;
}

export const SaveAsDialog = ({ currentData, customerLogoUrl, onSaveAs }: SaveAsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      // Pre-fill with current name + " (Copy)"
      const currentName = (currentData as any)._analysisName || currentData.customerName || "Analysis";
      setNewName(`${currentName} (Copy)`);
      setError("");
    }
  };

  const handleSaveAs = () => {
    if (!newName.trim()) {
      setError("Please enter a name for the new analysis");
      return;
    }

    // Check for duplicate names
    const existingRaw = localStorage.getItem("forter_saved_analyses");
    let existing: SavedAnalysis[] = [];
    if (existingRaw) {
      try {
        existing = JSON.parse(existingRaw);
      } catch (e) {
        console.error("Failed to parse saved analyses", e);
      }
    }

    const nameExists = existing.some(a => a.name.toLowerCase() === newName.trim().toLowerCase());
    if (nameExists) {
      setError("An analysis with this name already exists");
      return;
    }

    // Create new analysis with new ID
    const newId = Date.now().toString();
    const authorName = (currentData as any)._authorName || "";

    // Create new data with new ID, name, and last updated
    const newData = {
      ...currentData,
      _analysisId: newId,
      _analysisName: newName.trim(),
      _lastUpdatedAt: new Date().toISOString(),
    };

    const newAnalysis: SavedAnalysis = {
      id: newId,
      name: newName.trim(),
      authorName,
      data: newData,
      customerLogoUrl,
      savedAt: new Date(),
    };

    // Save to localStorage
    const updated = [...existing, newAnalysis];
    localStorage.setItem("forter_saved_analyses", JSON.stringify(updated));

    // Notify parent to update current session to the new analysis
    onSaveAs(newId, newName.trim());

    toast.success(`Analysis duplicated as "${newName.trim()}"`);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Copy className="w-4 h-4" />
          Save As
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save As New Analysis</DialogTitle>
          <DialogDescription>
            Create a copy of this analysis with a new name.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-name">New Analysis Name</Label>
            <Input
              id="new-name"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setError("");
              }}
              placeholder="Enter a name for the copy"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveAs}>
            Create Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
