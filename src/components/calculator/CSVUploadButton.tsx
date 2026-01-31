import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Check, AlertTriangle, History, X, FileText } from "lucide-react";
import { 
  importCSVToFormData, 
  getImportUpdates, 
  hasDownloadedTemplate 
} from "@/lib/csvImport";
import { CalculatorData } from "@/pages/Index";
import { getCurrencySymbol } from "@/lib/benchmarkData";
import { getRequiredInputFields } from "@/lib/csvExport";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface CSVUploadButtonProps {
  formData: CalculatorData;
  selectedChallenges: { [key: string]: boolean };
  onFieldChange: (field: keyof CalculatorData, value: any) => void;
  templateDownloaded: boolean;
  segmentationEnabled?: boolean;
  segmentCount?: number;
}

interface CSVUploadHistory {
  timestamp: string;
  fileName: string;
  fieldCount: number;
  content: string;
}

const CSV_HISTORY_KEY = 'csv_upload_history';
const MAX_HISTORY_ITEMS = 5;

const saveToHistory = (fileName: string, fieldCount: number, content: string) => {
  try {
    const historyJson = localStorage.getItem(CSV_HISTORY_KEY);
    const history: CSVUploadHistory[] = historyJson ? JSON.parse(historyJson) : [];
    
    const newEntry: CSVUploadHistory = {
      timestamp: new Date().toISOString(),
      fileName,
      fieldCount,
      content,
    };
    
    // Add to beginning and limit size
    const updatedHistory = [newEntry, ...history].slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(CSV_HISTORY_KEY, JSON.stringify(updatedHistory));
  } catch (e) {
    console.error('Failed to save CSV history:', e);
  }
};

const getUploadHistory = (): CSVUploadHistory[] => {
  try {
    const historyJson = localStorage.getItem(CSV_HISTORY_KEY);
    return historyJson ? JSON.parse(historyJson) : [];
  } catch {
    return [];
  }
};

export const CSVUploadButton = ({
  formData,
  selectedChallenges,
  onFieldChange,
  templateDownloaded,
  segmentationEnabled = false,
  segmentCount = 0,
}: CSVUploadButtonProps) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState<string>("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [uploadHistory, setUploadHistory] = useState<CSVUploadHistory[]>([]);
  const [pendingImport, setPendingImport] = useState<{
    updates: Partial<CalculatorData>;
    fieldCount: number;
    warnings: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Check if enabled and not blocked based on field count comparison
  useEffect(() => {
    const basicEnabled = templateDownloaded || hasDownloadedTemplate();
    setIsEnabled(basicEnabled);
    
    // Check if configuration has changed since download
    if (basicEnabled) {
      const storedFieldCount = localStorage.getItem('csv_template_field_count');
      const storedChallengeHash = localStorage.getItem('csv_template_challenge_hash');
      const storedSegmentCount = localStorage.getItem('csv_template_segment_count');
      
      if (storedFieldCount && storedChallengeHash) {
        const currentFieldCount = getRequiredInputFields(selectedChallenges, getCurrencySymbol(formData.baseCurrency || 'USD'), formData.isMarketplace).length;
        const currentChallengeHash = Object.entries(selectedChallenges).filter(([,v]) => v).map(([k]) => k).sort().join(',');
        const currentSegmentCount = segmentationEnabled ? segmentCount : 0;
        
        // Check if fields, challenges, or segments have changed
        const fieldsChanged = currentFieldCount !== parseInt(storedFieldCount);
        const challengesChanged = currentChallengeHash !== storedChallengeHash;
        const segmentsChanged = currentSegmentCount !== parseInt(storedSegmentCount || '0');
        
        if (fieldsChanged || challengesChanged || segmentsChanged) {
          setIsBlocked(true);
          setBlockReason("Use cases have been updated. A new data request sheet is required to map against the new business case.");
        } else {
          setIsBlocked(false);
          setBlockReason("");
        }
      }
    }
  }, [templateDownloaded, selectedChallenges, formData.baseCurrency, segmentationEnabled, segmentCount]);

  // Load history when dialog opens
  useEffect(() => {
    if (showHistoryDialog) {
      setUploadHistory(getUploadHistory());
    }
  }, [showHistoryDialog]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const currencySymbol = getCurrencySymbol(formData.baseCurrency || 'USD');
      
      const result = importCSVToFormData(
        content,
        formData,
        selectedChallenges,
        currencySymbol
      );

      if (result.errors.length > 0) {
        toast({
          title: "Import Error",
          description: result.errors.join('. '),
          variant: "destructive",
        });
        return;
      }

      if (result.updatedFields.length === 0) {
        toast({
          title: "No Data Found",
          description: "The CSV file doesn't contain any values to import. Please fill in the 'Your Value' column.",
          variant: "destructive",
        });
        return;
      }

      // Save to history before importing
      saveToHistory(file.name, result.updatedFields.length, content);

      // Show confirmation dialog
      setPendingImport({
        updates: getImportUpdates(result),
        fieldCount: result.updatedFields.length,
        warnings: result.warnings,
      });
      setShowConfirmDialog(true);

    } catch (error) {
      toast({
        title: "File Read Error",
        description: "Could not read the CSV file. Please ensure it's a valid CSV format.",
        variant: "destructive",
      });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = () => {
    if (!pendingImport) return;

    // Apply all updates
    Object.entries(pendingImport.updates).forEach(([field, value]) => {
      onFieldChange(field as keyof CalculatorData, value);
    });

    toast({
      title: "Import Successful",
      description: `Updated ${pendingImport.fieldCount} field${pendingImport.fieldCount !== 1 ? 's' : ''} from CSV.`,
    });

    if (pendingImport.warnings.length > 0) {
      setTimeout(() => {
        toast({
          title: "Import Warnings",
          description: `${pendingImport.warnings.length} field(s) could not be matched. Check console for details.`,
          variant: "default",
        });
        console.log('CSV Import Warnings:', pendingImport.warnings);
      }, 500);
    }

    setShowConfirmDialog(false);
    setPendingImport(null);
  };

  const downloadHistoryItem = (item: CSVUploadHistory) => {
    const blob = new Blob([item.content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const buttonDisabled = !isEnabled || isBlocked;
  const hasHistory = getUploadHistory().length > 0;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => !buttonDisabled && fileInputRef.current?.click()}
              disabled={buttonDisabled}
              className={buttonDisabled ? "opacity-50 cursor-not-allowed" : ""}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Completed Data Request Sheet (CSV)
            </Button>
          </TooltipTrigger>
          {buttonDisabled && (
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="text-sm">
                {isBlocked 
                  ? blockReason 
                  : "Download the data request sheet first to enable upload"}
              </p>
            </TooltipContent>
          )}
        </Tooltip>

        {/* History Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistoryDialog(true)}
              disabled={!hasHistory}
              className={!hasHistory ? "opacity-50" : ""}
            >
              <History className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-sm">
              {hasHistory ? "View previous uploads" : "No upload history"}
            </p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              Previous CSV Uploads
            </DialogTitle>
            <DialogDescription>
              View and download previously uploaded data request sheets.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[300px]">
            {uploadHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No upload history available.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {uploadHistory.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(item.timestamp)} • {item.fieldCount} fields
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadHistoryItem(item)}
                    >
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Data Import
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  This will update <strong className="text-foreground">{pendingImport?.fieldCount || 0} field(s)</strong> with 
                  values from the CSV file.
                </p>
                <p className="text-amber-600 dark:text-amber-400">
                  All matching fields will be replaced with the CSV values. 
                  This action cannot be undone.
                </p>
                {pendingImport?.warnings && pendingImport.warnings.length > 0 && (
                  <p className="text-muted-foreground text-sm">
                    Note: {pendingImport.warnings.length} field(s) in the CSV could not be matched 
                    and will be skipped.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingImport(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmImport}>
              <Check className="h-4 w-4 mr-2" />
              Proceed with Import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
