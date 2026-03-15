import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { CalculatorData } from "@/pages/Index";
import { ValueSummaryOptionA } from "./ValueSummaryOptionA";
import { ForterKPIs } from "./ForterKPIConfig";
import { SegmentInputs, SegmentKPIs } from "@/lib/segments";
import { ValueAgentChat } from "./ValueAgentChat";

interface ResultsDashboardProps {
  data: CalculatorData;
  customerLogoUrl?: string;
  onEditManual: () => void;
  onEditCustom: () => void;
  onStartOver: () => void;
  onDataChange?: (data: CalculatorData) => void;
}

export const ResultsDashboard = ({ 
  data, 
  customerLogoUrl, 
  onEditManual, 
  onEditCustom, 
  onStartOver,
  onDataChange,
}: ResultsDashboardProps) => {
  // Local state for live updates
  const [localData, setLocalData] = useState<CalculatorData>(data);
  
  // Get selected challenges from data, defaulting to empty object
  const selectedChallenges = localData.selectedChallenges || {};

  // Handle customer input field changes
  const handleFormDataChange = useCallback((field: keyof CalculatorData, value: number) => {
    setLocalData(prev => {
      const updated = { ...prev, [field]: value };
      onDataChange?.(updated);
      return updated;
    });
  }, [onDataChange]);

  // Handle Forter KPI changes
  const handleForterKPIChange = useCallback((field: keyof ForterKPIs, value: number) => {
    setLocalData(prev => {
      const updatedKPIs = { ...prev.forterKPIs, [field]: value };
      const updated = { ...prev, forterKPIs: updatedKPIs };
      onDataChange?.(updated);
      return updated;
    });
  }, [onDataChange]);

  // Handle segment input changes (bi-directional editing from calculator)
  const handleSegmentInputChange = useCallback((segmentId: string, field: keyof SegmentInputs, value: number) => {
    setLocalData(prev => {
      const segments = prev.segments || [];
      const updatedSegments = segments.map(seg => 
        seg.id === segmentId 
          ? { ...seg, inputs: { ...seg.inputs, [field]: value } }
          : seg
      );
      const updated = { ...prev, segments: updatedSegments };
      onDataChange?.(updated);
      return updated;
    });
  }, [onDataChange]);

  // Handle segment KPI changes (bi-directional editing from calculator)
  const handleSegmentKPIChange = useCallback((segmentId: string, field: keyof SegmentKPIs, value: number) => {
    setLocalData(prev => {
      const segments = prev.segments || [];
      const updatedSegments = segments.map(seg => 
        seg.id === segmentId 
          ? { ...seg, kpis: { ...seg.kpis, [field]: value } }
          : seg
      );
      const updated = { ...prev, segments: updatedSegments };
      onDataChange?.(updated);
      return updated;
    });
  }, [onDataChange]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <span className="text-lg font-semibold text-foreground">AI Fraud Prevention Assessment</span>
            {customerLogoUrl && (
              <img src={customerLogoUrl} alt="Customer" className="h-12 object-contain" />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground hidden lg:inline mr-2">
              Join <span className="font-medium text-primary">#business-value</span> for support
            </span>
            <Button variant="default" onClick={onEditManual}>
              Edit Inputs
            </Button>
            <Button variant="outline" onClick={onEditCustom}>
              Custom Calculations
            </Button>
            <Button variant="outline" onClick={onStartOver}>
              Start Over
            </Button>
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">
            {localData.customerName ? `${localData.customerName} - ` : ""}Value Assessment Results
          </h1>
          <p className="text-xl text-muted-foreground">
            Potential uplift with Forter's fraud management solution
          </p>
        </div>

        {/* Value Summary with Option A design */}
        <ValueSummaryOptionA 
          formData={localData} 
          selectedChallenges={selectedChallenges}
          onFormDataChange={handleFormDataChange}
          onForterKPIChange={handleForterKPIChange}
          onSegmentInputChange={handleSegmentInputChange}
          onSegmentKPIChange={handleSegmentKPIChange}
        />
        
        {/* Floating Value Agent Chat */}
        <ValueAgentChat 
          calculatorData={localData} 
          selectedChallenges={selectedChallenges}
          hasSelectedChallenges={Object.values(selectedChallenges).some(Boolean)}
        />
      </div>
    </div>
  );
};
