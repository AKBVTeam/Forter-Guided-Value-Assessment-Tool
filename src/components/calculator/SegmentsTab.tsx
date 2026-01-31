import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { SegmentEditorModal } from "./SegmentEditorModal";
import {
  Segment,
  createEmptySegment,
  getSegmentSummary,
  getSegmentKPIStatus,
  countSegmentFilledFields,
} from "@/lib/segments";
import { CalculatorData } from "@/pages/Index";
import { ForterKPIs } from "@/components/calculator/ForterKPIConfig";
import { getCurrencySymbol } from "@/lib/benchmarkData";
import { Plus, Pencil, Trash2, Layers, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";

interface SegmentsTabProps {
  formData: CalculatorData;
  segments: Segment[];
  segmentationEnabled: boolean;
  onSegmentsChange: (segments: Segment[]) => void;
  onSegmentationEnabledChange: (enabled: boolean) => void;
  onPreviousTab: () => void;
  onNextTab: () => void;
}

export function SegmentsTab({
  formData,
  segments,
  segmentationEnabled,
  onSegmentsChange,
  onSegmentationEnabledChange,
  onPreviousTab,
  onNextTab,
}: SegmentsTabProps) {
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingSegment, setEditingSegment] = React.useState<Segment | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [segmentToDelete, setSegmentToDelete] = React.useState<Segment | null>(null);
  
  const currencySymbol = getCurrencySymbol(formData.baseCurrency || 'USD');
  
  const handleAddSegment = () => {
    const newSegment = createEmptySegment();
    setEditingSegment(newSegment);
    setEditorOpen(true);
  };
  
  const handleEditSegment = (segment: Segment) => {
    setEditingSegment(segment);
    setEditorOpen(true);
  };
  
  const handleSaveSegment = (segment: Segment) => {
    const existingIndex = segments.findIndex(s => s.id === segment.id);
    if (existingIndex >= 0) {
      // Update existing
      const updated = [...segments];
      updated[existingIndex] = segment;
      onSegmentsChange(updated);
    } else {
      // Add new
      onSegmentsChange([...segments, segment]);
    }
  };
  
  const handleDeleteSegment = (segment: Segment) => {
    setSegmentToDelete(segment);
    setDeleteConfirmOpen(true);
  };
  
  const confirmDelete = () => {
    if (segmentToDelete) {
      onSegmentsChange(segments.filter(s => s.id !== segmentToDelete.id));
      setSegmentToDelete(null);
      setDeleteConfirmOpen(false);
    }
  };
  
  const handleToggleSegment = (segmentId: string, enabled: boolean) => {
    const updated = segments.map(s =>
      s.id === segmentId ? { ...s, enabled } : s
    );
    onSegmentsChange(updated);
  };
  
  const globalInputs = {
    amerGrossAttempts: formData.amerGrossAttempts,
    amerAnnualGMV: formData.amerAnnualGMV,
    amerPreAuthApprovalRate: formData.amerPreAuthApprovalRate,
    amerPostAuthApprovalRate: formData.amerPostAuthApprovalRate,
    amerCreditCardPct: formData.amerCreditCardPct,
    amer3DSChallengeRate: formData.amer3DSChallengeRate,
    amer3DSAbandonmentRate: formData.amer3DSAbandonmentRate,
    amerIssuingBankDeclineRate: formData.amerIssuingBankDeclineRate,
    fraudCBRate: formData.fraudCBRate,
    fraudCBAOV: formData.fraudCBAOV,
    completedAOV: formData.completedAOV,
  };
  
  const globalKPIs = formData.forterKPIs ? {
    approvalRateImprovement: formData.forterKPIs.approvalRateImprovement,
    chargebackReduction: formData.forterKPIs.chargebackReduction,
    threeDSReduction: formData.forterKPIs.threeDSReduction,
  } : undefined;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Data Segments</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Break down fraud and payment data by region, category, or business unit for more granular analysis
        </p>
      </div>
      
      {/* Enable Toggle */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Switch
              id="segmentation-enabled"
              checked={segmentationEnabled}
              onCheckedChange={onSegmentationEnabledChange}
            />
            <div>
              <Label htmlFor="segmentation-enabled" className="cursor-pointer font-medium">
                Enable segmented analysis
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {segmentationEnabled
                  ? 'Using segment-specific data for fraud/payments calculations'
                  : 'Using consolidated global inputs from Customer Inputs tab'
                }
              </p>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <p className="text-sm">
                When enabled, each segment will have its own inputs and KPI targets.
                Results will show an aggregated total with per-segment breakdown.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      </Card>
      
      {segmentationEnabled && (
        <>
          {/* Segments List */}
          {segments.length > 0 ? (
            <div className="space-y-3">
              {segments.map((segment) => {
                const { filled, total } = countSegmentFilledFields(segment);
                const progress = Math.round((filled / total) * 100);
                
                return (
                  <Card key={segment.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <Checkbox
                          id={`segment-${segment.id}`}
                          checked={segment.enabled}
                          onCheckedChange={(checked) => handleToggleSegment(segment.id, checked === true)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Label
                              htmlFor={`segment-${segment.id}`}
                              className="font-medium cursor-pointer"
                            >
                              {segment.name}
                            </Label>
                            {!segment.enabled && (
                              <span className="text-xs text-muted-foreground">(disabled)</span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {getSegmentSummary(segment, currencySymbol)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            KPIs: {getSegmentKPIStatus(segment)}
                          </p>
                          
                          {/* Progress bar */}
                          <div className="flex items-center gap-2 mt-2">
                            <Progress value={progress} className="h-1.5 flex-1" />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {filled}/{total} fields
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditSegment(segment)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteSegment(segment)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-8 text-center border-dashed">
              <Layers className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-medium mb-1">No segments defined</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add segments to break down your analysis by region, category, or business unit
              </p>
              <Button onClick={handleAddSegment} className="gap-2">
                <Plus className="h-4 w-4" />
                Add First Segment
              </Button>
            </Card>
          )}
          
          {/* Add Segment Button (when there are existing segments) */}
          {segments.length > 0 && (
            <Button variant="outline" onClick={handleAddSegment} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Segment
            </Button>
          )}
          
          {/* Currency Note */}
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Info className="h-3 w-3" />
            All segments use the base currency: {formData.baseCurrency || 'USD'} ({currencySymbol})
          </p>
        </>
      )}
      
      {/* Navigation Buttons */}
      <div className="flex justify-between pt-6 border-t mt-6">
        <Button variant="outline" onClick={onPreviousTab} className="gap-2">
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>
        <Button onClick={onNextTab} className="gap-2">
          Next <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Segment Editor Modal */}
      <SegmentEditorModal
        open={editorOpen}
        onOpenChange={setEditorOpen}
        segment={editingSegment}
        onSave={handleSaveSegment}
        baseCurrency={formData.baseCurrency || 'USD'}
        selectedChallenges={formData.selectedChallenges || {}}
        globalInputs={globalInputs}
        globalKPIs={globalKPIs}
      />
      
      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Segment?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{segmentToDelete?.name}"? 
              This will remove all data associated with this segment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
