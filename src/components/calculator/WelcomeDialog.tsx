import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, FolderOpen, Trash2, ArrowRight, Copy } from "lucide-react";
import { CalculatorData } from "@/pages/Index";

export interface SavedAnalysis {
  id: string;
  name: string;
  authorName?: string;
  data: CalculatorData;
  customerLogoUrl: string;
  savedAt: Date;
}

interface WelcomeDialogProps {
  open: boolean;
  onStartNew: (analysisName: string, authorName: string) => void;
  onLoadAnalysis: (data: CalculatorData, logoUrl: string) => void;
}

export const WelcomeDialog = ({ open, onStartNew, onLoadAnalysis }: WelcomeDialogProps) => {
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newAnalysisName, setNewAnalysisName] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [errors, setErrors] = useState<{ analysisName?: string; authorName?: string }>({});
  const [duplicateTarget, setDuplicateTarget] = useState<SavedAnalysis | null>(null);
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicateAuthorName, setDuplicateAuthorName] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("forter_saved_analyses");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const mapped = parsed.map((s: SavedAnalysis) => ({
          ...s,
          savedAt: new Date(s.savedAt),
        }));
        // Sort by savedAt descending (newest first)
        mapped.sort((a: SavedAnalysis, b: SavedAnalysis) => b.savedAt.getTime() - a.savedAt.getTime());
        setSavedAnalyses(mapped);
      } catch (e) {
        console.error("Failed to parse saved analyses", e);
      }
    }
    // Load saved author name if available
    const savedAuthor = localStorage.getItem("forter_author_name");
    if (savedAuthor) {
      setAuthorName(savedAuthor);
    }
  }, [open]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setShowNewForm(false);
      setNewAnalysisName("");
      setErrors({});
    }
  }, [open]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedAnalyses.filter((s) => s.id !== id);
    setSavedAnalyses(updated);
    localStorage.setItem("forter_saved_analyses", JSON.stringify(updated));
  };

  const handleLoad = (analysis: SavedAnalysis) => {
    const savedAtIso = analysis.savedAt instanceof Date
      ? analysis.savedAt.toISOString()
      : new Date(analysis.savedAt).toISOString();
    onLoadAnalysis(
      { ...analysis.data, _lastUpdatedAt: savedAtIso } as CalculatorData,
      analysis.customerLogoUrl
    );
  };

  const handleDuplicateClick = (analysis: SavedAnalysis, e: React.MouseEvent) => {
    e.stopPropagation();
    const baseName = analysis.name || (analysis.data as CalculatorData & { _analysisName?: string })._analysisName || "Untitled";
    const author = analysis.authorName || (analysis.data as CalculatorData & { _authorName?: string })._authorName || "";
    setDuplicateTarget(analysis);
    setDuplicateName(`${baseName.trim()} (copy)`);
    setDuplicateAuthorName(author || (typeof localStorage !== "undefined" ? localStorage.getItem("forter_author_name") || "" : ""));
  };

  const handleDuplicateConfirm = () => {
    if (!duplicateTarget) return;
    const name = duplicateName.trim();
    const author = duplicateAuthorName.trim();
    if (!name || name.length < 3) return;
    if (!author || author.length < 2 || author.length > 50) return;
    const newId = Date.now().toString();
    const duplicatedData: CalculatorData = {
      ...duplicateTarget.data,
      _analysisId: newId,
      _analysisName: name,
      _authorName: author,
      _lastUpdatedAt: new Date().toISOString(),
      _changelogHistory: [],
    } as CalculatorData;
    onLoadAnalysis(duplicatedData, duplicateTarget.customerLogoUrl);
    setDuplicateTarget(null);
    setDuplicateName("");
    setDuplicateAuthorName("");
  };

  const handleDuplicateCancel = () => {
    setDuplicateTarget(null);
    setDuplicateName("");
    setDuplicateAuthorName("");
  };

  const validateForm = () => {
    const newErrors: { analysisName?: string; authorName?: string } = {};
    
    if (!newAnalysisName.trim()) {
      newErrors.analysisName = "Analysis name is required";
    } else if (newAnalysisName.trim().length < 3) {
      newErrors.analysisName = "Analysis name must be at least 3 characters";
    } else if (newAnalysisName.trim().length > 100) {
      newErrors.analysisName = "Analysis name must be less than 100 characters";
    }
    
    if (!authorName.trim()) {
      newErrors.authorName = "Your name is required for tracking";
    } else if (authorName.trim().length < 2) {
      newErrors.authorName = "Name must be at least 2 characters";
    } else if (authorName.trim().length > 50) {
      newErrors.authorName = "Name must be less than 50 characters";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleStartNew = () => {
    if (validateForm()) {
      // Save author name for future use
      localStorage.setItem("forter_author_name", authorName.trim());
      onStartNew(newAnalysisName.trim(), authorName.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && showNewForm) {
      handleStartNew();
    }
  };

  return (
    <>
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-lg"
        hideCloseButton
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">Welcome to Value Assessment</DialogTitle>
          <DialogDescription>
            Start a new value assessment or continue with a previously saved analysis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {!showNewForm ? (
            <>
              {/* Start New Button */}
              <Button
                onClick={() => setShowNewForm(true)}
                className="w-full h-14 text-lg gap-3"
                size="lg"
              >
                <Plus className="w-5 h-5" />
                Start New Value Assessment
              </Button>

              {/* Saved Analyses */}
              {savedAnalyses.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FolderOpen className="w-4 h-4" />
                    <span>Or continue with a saved analysis</span>
                  </div>
                  
                  <ScrollArea className="h-[200px] rounded-md border">
                    <div className="p-2 space-y-2">
                      {savedAnalyses.map((analysis) => (
                        <div
                          key={analysis.id}
                          className="flex items-center justify-between p-3 rounded-md bg-muted/50 hover:bg-muted cursor-pointer transition-all duration-150 ease-out hover:scale-[1.01] active:scale-[0.98]"
                          onClick={() => handleLoad(analysis)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{analysis.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(analysis.savedAt).toLocaleString()}
                              {analysis.authorName && ` • by ${analysis.authorName}`}
                            </div>
                            {analysis.data.customerName && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                Merchant: {analysis.data.customerName}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => handleDuplicateClick(analysis, e)}
                              title="Duplicate analysis"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={(e) => handleDelete(analysis.id, e)}
                              title="Delete analysis"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </>
          ) : (
            /* New Assessment Form */
            <div className="space-y-4" onKeyDown={handleKeyDown}>
              <div className="space-y-2">
                <Label htmlFor="analysis-name">
                  Analysis Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="analysis-name"
                  value={newAnalysisName}
                  onChange={(e) => {
                    setNewAnalysisName(e.target.value);
                    if (errors.analysisName) setErrors(prev => ({ ...prev, analysisName: undefined }));
                  }}
                  placeholder="e.g., Acme Corp Value Assessment Q1 2025"
                  className={errors.analysisName ? "border-destructive" : ""}
                  autoFocus
                />
                {errors.analysisName && (
                  <p className="text-xs text-destructive">{errors.analysisName}</p>
                )}
              </div>

              <div className="space-y-2">
              <Label htmlFor="author-name">
                  Author Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="author-name"
                  value={authorName}
                  onChange={(e) => {
                    setAuthorName(e.target.value);
                    if (errors.authorName) setErrors(prev => ({ ...prev, authorName: undefined }));
                  }}
                  placeholder="e.g., John Smith"
                  className={errors.authorName ? "border-destructive" : ""}
                />
                {errors.authorName && (
                  <p className="text-xs text-destructive">{errors.authorName}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Used for tracking and identifying saved assessments
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowNewForm(false);
                    setErrors({});
                  }}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleStartNew}
                  className="flex-1 gap-2"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Name your duplicate dialog */}
    <Dialog open={!!duplicateTarget} onOpenChange={(open) => !open && handleDuplicateCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Name your duplicate</DialogTitle>
          <DialogDescription>
            Edit the name for the duplicated analysis. You can change it later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="duplicate-name">Analysis name</Label>
            <Input
              id="duplicate-name"
              value={duplicateName}
              onChange={(e) => setDuplicateName(e.target.value)}
              placeholder="e.g., Acme Corp Value Assessment (copy)"
              onKeyDown={(e) => e.key === "Enter" && handleDuplicateConfirm()}
            />
            {duplicateName.trim().length > 0 && duplicateName.trim().length < 3 && (
              <p className="text-xs text-destructive">Name must be at least 3 characters</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="duplicate-author">Author name</Label>
            <Input
              id="duplicate-author"
              value={duplicateAuthorName}
              onChange={(e) => setDuplicateAuthorName(e.target.value)}
              placeholder="e.g., John Smith"
            />
            {duplicateAuthorName.trim().length > 0 && (duplicateAuthorName.trim().length < 2 || duplicateAuthorName.trim().length > 50) && (
              <p className="text-xs text-destructive">
                {duplicateAuthorName.trim().length < 2 ? "Author name must be at least 2 characters" : "Author name must be less than 50 characters"}
              </p>
            )}
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={handleDuplicateCancel}>
              Cancel
            </Button>
            <Button
              onClick={handleDuplicateConfirm}
              disabled={
                !duplicateName.trim() ||
                duplicateName.trim().length < 3 ||
                !duplicateAuthorName.trim() ||
                duplicateAuthorName.trim().length < 2 ||
                duplicateAuthorName.trim().length > 50
              }
              className="gap-2"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </>
  );
};