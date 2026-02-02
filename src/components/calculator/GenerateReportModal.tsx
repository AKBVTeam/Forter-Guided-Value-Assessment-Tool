import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { FileText, Presentation, Download, CheckCircle2, Loader2, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { CalculatorData } from "@/pages/Index";
import { ValueTotals } from "@/components/calculator/ValueSummaryOptionA";
import { InvestmentInputs, calculateROI } from "@/lib/roiCalculations";
import { generateExecutiveSummaryDocx, generateValueDeckPptx, ReportOptions } from "@/lib/reportGeneration";
import { StrategicObjectiveId } from "@/lib/useCaseMapping";
import { ReportPreview } from "./ReportPreview";

// Format date as MMDDYY for filenames
function formatDateMMDDYY(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  return `${mm}${dd}${yy}`;
}

interface GenerateReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: CalculatorData;
  valueTotals: ValueTotals;
  selectedChallenges: Record<string, boolean>;
  investmentInputs: InvestmentInputs;
  selectedObjectives: StrategicObjectiveId[];
  customerLogoUrl?: string;
  onReportGenerated?: () => void;
}

type ReportType = 'executive' | 'deck' | null;
type GenerationState = 'idle' | 'generating' | 'success' | 'error';

export function GenerateReportModal({
  open,
  onOpenChange,
  formData,
  valueTotals,
  selectedChallenges,
  investmentInputs,
  selectedObjectives,
  customerLogoUrl,
  onReportGenerated,
}: GenerateReportModalProps) {
  const [selectedType, setSelectedType] = useState<ReportType>(null);
  const [generationState, setGenerationState] = useState<GenerationState>('idle');
  const [generatedFilename, setGeneratedFilename] = useState<string>('');
  const [showPreview, setShowPreview] = useState(true);
  const [showWarningDialog, setShowWarningDialog] = useState(false);

  const roiResults = calculateROI(formData, valueTotals, investmentInputs);
  
  // Determine if investment has been entered
  const hasInvestment = roiResults.hasInvestment;

  const handleGenerateClick = () => {
    if (!selectedType) return;
    setShowWarningDialog(true);
  };

  const handleConfirmGenerate = async () => {
    setShowWarningDialog(false);
    if (!selectedType) return;

    setGenerationState('generating');

    try {
      const analysisName = (formData as any)._analysisName || formData.customerName || 'Customer';
      const sanitized = analysisName.replace(/[^a-zA-Z0-9]/g, '_');
      
      const reportOptions: ReportOptions = {
        selectedObjectives,
        hasInvestment,
        companyLogoBase64: customerLogoUrl || undefined,
      };
      
      if (selectedType === 'executive') {
        await generateExecutiveSummaryDocx(formData, valueTotals, selectedChallenges, roiResults, reportOptions);
        const dateStr = formatDateMMDDYY();
        setGeneratedFilename(`${sanitized}_Executive_Summary (${dateStr}).docx`);
      } else {
        await generateValueDeckPptx(formData, valueTotals, selectedChallenges, roiResults, reportOptions);
        const dateStr = formatDateMMDDYY();
        setGeneratedFilename(`Forter_x_${sanitized}_Value_Assessment (${dateStr}).pptx`);
      }

      setGenerationState('success');
      toast.success('Report generated successfully!');
      
      // Notify parent that report was generated (to update the "needs update" indicator)
      onReportGenerated?.();
    } catch (error) {
      console.error('Report generation error:', error);
      setGenerationState('error');
      toast.error('Failed to generate report. Please try again.');
    }
  };

  const handleClose = () => {
    setSelectedType(null);
    setGenerationState('idle');
    setGeneratedFilename('');
    onOpenChange(false);
  };

  const handleReset = () => {
    setSelectedType(null);
    setGenerationState('idle');
    setGeneratedFilename('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Generate Value Reports
          </DialogTitle>
          <DialogDescription>
            Download editable reports based on the value assessment data
          </DialogDescription>
        </DialogHeader>

        {generationState === 'idle' && (
          <div className="space-y-4 py-4">
            {/* Report Type Selection */}
            <div className="grid grid-cols-2 gap-4">
              {/* Executive Summary Card */}
              <Card
                className={`p-4 cursor-pointer transition-all duration-150 ease-out hover:scale-[1.01] active:scale-[0.98] hover:shadow-md ${
                  selectedType === 'executive'
                    ? 'ring-2 ring-primary bg-primary/5'
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => setSelectedType('executive')}
              >
                <div className="flex flex-col items-center text-center gap-3">
                  <div className={`p-3 rounded-full ${
                    selectedType === 'executive' ? 'bg-primary/20' : 'bg-muted'
                  }`}>
                    <FileText className={`w-8 h-8 ${
                      selectedType === 'executive' ? 'text-primary' : 'text-muted-foreground'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-semibold">Executive 1-Page Summary</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Word document with top value drivers, target outcomes, and ROI
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                    .docx
                  </span>
                </div>
              </Card>

              {/* Value Assessment Deck Card */}
              <Card
                className={`p-4 cursor-pointer transition-all duration-150 ease-out hover:scale-[1.01] active:scale-[0.98] hover:shadow-md ${
                  selectedType === 'deck'
                    ? 'ring-2 ring-primary bg-primary/5'
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => setSelectedType('deck')}
              >
                <div className="flex flex-col items-center text-center gap-3">
                  <div className={`p-3 rounded-full ${
                    selectedType === 'deck' ? 'bg-primary/20' : 'bg-muted'
                  }`}>
                    <Presentation className={`w-8 h-8 ${
                      selectedType === 'deck' ? 'text-primary' : 'text-muted-foreground'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-semibold">Value Assessment Deck</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      PowerPoint with value summary, use cases, and ROI projections
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                    .pptx
                  </span>
                </div>
              </Card>
            </div>

            {/* Logo indicator for PowerPoint */}
            {selectedType === 'deck' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                {customerLogoUrl ? (
                  <>
                    <img src={customerLogoUrl} alt="Logo" className="h-6 w-auto object-contain" />
                    <span>Company logo will appear on title slide</span>
                  </>
                ) : (
                  <span className="text-xs italic">
                    Tip: Upload a company logo in the Profile tab to include it on the title slide
                  </span>
                )}
              </div>
            )}

            {/* Preview Toggle & Preview Panel */}
            {selectedType && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Report Preview</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPreview(!showPreview)}
                    className="gap-1 h-7 text-xs"
                  >
                    {showPreview ? (
                      <>
                        <EyeOff className="w-3 h-3" />
                        Hide Preview
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" />
                        Show Preview
                      </>
                    )}
                  </Button>
                </div>
                
                {showPreview && (
                  <ReportPreview
                    type={selectedType}
                    formData={formData}
                    valueTotals={valueTotals}
                    selectedChallenges={selectedChallenges}
                    roiResults={roiResults}
                    selectedObjectives={selectedObjectives}
                    hasInvestment={hasInvestment}
                    companyLogo={customerLogoUrl}
                  />
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleGenerateClick}
                disabled={!selectedType}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Generate & Download
              </Button>
            </div>
          </div>
        )}

        {/* Warning Dialog */}
        <AlertDialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Important Notice
              </AlertDialogTitle>
              <AlertDialogDescription className="text-base">
                These documents are directional and used to generate an initial view from which you are required to contextualize, sanity check and amend for your purposes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmGenerate}>
                I Understand, Download
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {generationState === 'generating' && (
          <div className="py-12 flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <div className="text-center">
              <p className="font-medium">Generating report...</p>
              <p className="text-sm text-muted-foreground mt-1">
                This may take a few seconds
              </p>
            </div>
          </div>
        )}

        {generationState === 'success' && (
          <div className="py-8 flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-green-100">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
            <div className="text-center">
              <p className="font-medium text-lg">Report Generated!</p>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-mono bg-muted px-2 py-1 rounded">{generatedFilename}</span>
              </p>
              <p className="text-sm text-muted-foreground mt-3">
                The file has been downloaded. Check the downloads folder.
              </p>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={handleReset}>
                Generate Another
              </Button>
              <Button onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        )}

        {generationState === 'error' && (
          <div className="py-8 flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-red-100">
              <FileText className="w-12 h-12 text-red-600" />
            </div>
            <div className="text-center">
              <p className="font-medium text-lg">Generation Failed</p>
              <p className="text-sm text-muted-foreground mt-1">
                There was an error generating your report. Please try again.
              </p>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleConfirmGenerate}>
                Retry
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}