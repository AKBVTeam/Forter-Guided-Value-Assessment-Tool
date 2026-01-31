import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalculatorData } from "@/pages/Index";
import { ValueTotals } from "@/components/calculator/ValueSummaryOptionA";
import { ROIResults } from "@/lib/roiCalculations";
import { getCurrencySymbol } from "@/lib/benchmarkData";
import { StrategicObjectiveId, STRATEGIC_OBJECTIVES, USE_CASES } from "@/lib/useCaseMapping";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ReportPreviewProps {
  type: 'executive' | 'deck';
  formData: CalculatorData;
  valueTotals: ValueTotals;
  selectedChallenges: Record<string, boolean>;
  roiResults: ROIResults;
  selectedObjectives: StrategicObjectiveId[];
  hasInvestment: boolean;
  companyLogo?: string | null;
}

// Forter brand colors
const FORTER_BLUE = '#0066FF';
const FORTER_NAVY = '#1A2B4A';
const FORTER_LIGHT_BG = '#EEF2F6';

// Helper to format currency
function formatCurrency(value: number, currencyCode: string = 'USD', inMillions: boolean = false): string {
  const symbol = getCurrencySymbol(currencyCode);
  const absValue = Math.abs(value);
  
  if (inMillions && absValue >= 1000000) {
    return `${symbol}${(value / 1000000).toFixed(1)}M`;
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(value);
}

// Get strategic objectives with their descriptions
function getStrategicObjectiveDetails(selectedObjectives: StrategicObjectiveId[]) {
  return selectedObjectives
    .map(id => STRATEGIC_OBJECTIVES.find(o => o.id === id))
    .filter((o): o is typeof STRATEGIC_OBJECTIVES[0] => !!o)
    .map(o => ({ name: o.name, description: o.description }));
}

// Get use cases for selected challenges
function getUseCasesForChallenges(challenges: Record<string, boolean>) {
  const activeChallengeIds = Object.entries(challenges)
    .filter(([_, enabled]) => enabled)
    .map(([id]) => id);
  
  const matchingUseCases = USE_CASES.filter(uc => 
    uc.challengeIds.some(cid => activeChallengeIds.includes(cid))
  );
  
  const seen = new Set<string>();
  return matchingUseCases
    .filter(uc => {
      if (seen.has(uc.id)) return false;
      seen.add(uc.id);
      return true;
    })
    .slice(0, 5)
    .map(uc => ({ name: uc.name, description: uc.description }));
}

// Get top value drivers
function getTopValueDrivers(valueTotals: ValueTotals) {
  const drivers: Array<{ label: string; value: number }> = [];
  
  const allBreakdown = [
    ...(valueTotals.gmvUpliftBreakdown || []),
    ...(valueTotals.costReductionBreakdown || []),
    ...(valueTotals.riskMitigationBreakdown || []),
  ];
  
  allBreakdown.forEach(b => {
    if (b.value > 0) {
      drivers.push({ label: b.label, value: b.value });
    }
  });
  
  return drivers.sort((a, b) => b.value - a.value).slice(0, 5);
}

export function ReportPreview({
  type,
  formData,
  valueTotals,
  selectedChallenges,
  roiResults,
  selectedObjectives,
  hasInvestment,
  companyLogo,
}: ReportPreviewProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const customerName = formData.customerName || 'Customer';
  const currency = formData.baseCurrency || 'USD';
  const useStrategicAlignment = selectedObjectives.length > 0;
  const strategicObjectives = getStrategicObjectiveDetails(selectedObjectives);
  const useCases = getUseCasesForChallenges(selectedChallenges);
  const topDrivers = getTopValueDrivers(valueTotals);

  // Executive Summary (single page)
  if (type === 'executive') {
    return (
      <Card className="p-4 bg-white border shadow-sm max-h-[450px] overflow-y-auto">
        <div className="space-y-4 text-xs">
          {/* Header */}
          <div className="text-center border-b pb-3" style={{ borderColor: FORTER_BLUE }}>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Executive Summary</p>
            <h3 className="text-sm font-bold mt-1" style={{ color: FORTER_NAVY }}>
              Unlocking {formatCurrency(valueTotals.ebitdaContribution, currency, true)} in Annual EBITDA
            </h3>
            <p className="text-[10px] text-muted-foreground mt-1">
              Through Fraud-Free Revenue Growth for {customerName}
            </p>
          </div>

          {/* Strategic Alignment or Problem Statement */}
          {useStrategicAlignment ? (
            <div>
              <p className="font-semibold text-[11px]" style={{ color: FORTER_BLUE }}>Strategic Alignment:</p>
              <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-0.5">
                {strategicObjectives.slice(0, 3).map((obj, idx) => (
                  <li key={idx} className="text-[10px]">{obj.name}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div>
              <p className="font-semibold text-[11px]" style={{ color: FORTER_BLUE }}>Problem Statement:</p>
              <p className="text-muted-foreground text-[10px]">
                Key fraud and payment challenges impacting revenue...
              </p>
            </div>
          )}

          {/* Target Outcomes Preview */}
          <div>
            <p className="font-semibold text-[11px]" style={{ color: FORTER_BLUE }}>Target Outcomes:</p>
            <div className="grid grid-cols-3 gap-2 mt-1">
              <div className="text-center p-1.5 rounded" style={{ backgroundColor: FORTER_LIGHT_BG }}>
                <p className="text-[10px] text-muted-foreground">GMV Uplift</p>
                <p className="text-[11px] font-semibold" style={{ color: FORTER_BLUE }}>
                  {formatCurrency(valueTotals.gmvUplift, currency, true)}
                </p>
              </div>
              <div className="text-center p-1.5 rounded" style={{ backgroundColor: FORTER_LIGHT_BG }}>
                <p className="text-[10px] text-muted-foreground">Cost Reduction</p>
                <p className="text-[11px] font-semibold" style={{ color: FORTER_BLUE }}>
                  {formatCurrency(valueTotals.costReduction, currency, true)}
                </p>
              </div>
              <div className="text-center p-1.5 rounded" style={{ backgroundColor: FORTER_LIGHT_BG }}>
                <p className="text-[10px] text-muted-foreground">Risk Mitigation</p>
                <p className="text-[11px] font-semibold" style={{ color: FORTER_BLUE }}>
                  {formatCurrency(valueTotals.riskMitigation, currency, true)}
                </p>
              </div>
            </div>
          </div>

          {/* Investment or Next Steps */}
          {hasInvestment ? (
            <div className="border-t pt-2">
              <p className="font-semibold text-[11px]" style={{ color: FORTER_BLUE }}>Investment Summary:</p>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">ROI</span>
                <span className="text-[10px] font-semibold" style={{ color: FORTER_BLUE }}>
                  {roiResults.roi.toFixed(1)}x
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-muted-foreground">Payback</span>
                <span className="text-[10px] font-semibold" style={{ color: FORTER_NAVY }}>
                  {roiResults.paybackPeriodMonths > 0 ? `${roiResults.paybackPeriodMonths} months` : 'Immediate'}
                </span>
              </div>
            </div>
          ) : (
            <div className="border-t pt-2">
              <p className="font-semibold text-[11px]" style={{ color: FORTER_BLUE }}>Next Steps:</p>
              <p className="text-[10px] text-muted-foreground italic">
                1. Finalize investment discussion to complete ROI analysis
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="border-t pt-2 flex justify-between items-center">
            <span className="text-[8px] text-muted-foreground">© Forter, Inc. All rights Reserved</span>
            <span className="text-[8px] font-semibold" style={{ color: FORTER_BLUE }}>Confidential</span>
          </div>
        </div>
      </Card>
    );
  }

  // PowerPoint Slides (no title slide, starts with Executive Summary)
  const slides = [
    // Slide 1: Executive Summary
    {
      name: 'Summary',
      content: (
        <div className="h-full p-3 rounded-lg" style={{ backgroundColor: FORTER_LIGHT_BG }}>
          <p className="text-[8px] uppercase tracking-wide font-medium" style={{ color: FORTER_BLUE, fontFamily: 'Proxima Nova, sans-serif' }}>Executive Summary</p>
          <p className="text-[11px] font-bold mt-1" style={{ color: FORTER_NAVY, fontFamily: 'Proxima Nova, sans-serif' }}>
            Unlocking {formatCurrency(valueTotals.ebitdaContribution, currency, true)} in Annual EBITDA
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="bg-white rounded p-2">
              <p className="text-[8px] text-muted-foreground" style={{ fontFamily: 'Proxima Nova, sans-serif' }}>
                {useStrategicAlignment ? 'Strategic Priorities' : 'Key Challenges'}
              </p>
              <ul className="text-[7px] mt-1 space-y-0.5" style={{ fontFamily: 'Proxima Nova, sans-serif' }}>
                {(useStrategicAlignment ? strategicObjectives : useCases).slice(0, 3).map((item, idx) => (
                  <li key={idx}>• {item.name}</li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded p-2 space-y-1">
              <div className="flex justify-between text-[8px]" style={{ fontFamily: 'Proxima Nova, sans-serif' }}>
                <span className="text-muted-foreground">Total EBITDA</span>
                <span className="font-bold" style={{ color: FORTER_BLUE }}>
                  {formatCurrency(valueTotals.ebitdaContribution, currency, true)}
                </span>
              </div>
              {hasInvestment && (
                <>
                  <div className="flex justify-between text-[8px]" style={{ fontFamily: 'Proxima Nova, sans-serif' }}>
                    <span className="text-muted-foreground">ROI</span>
                    <span className="font-bold" style={{ color: FORTER_BLUE }}>{roiResults.roi.toFixed(1)}x</span>
                  </div>
                  <div className="flex justify-between text-[8px]" style={{ fontFamily: 'Proxima Nova, sans-serif' }}>
                    <span className="text-muted-foreground">Payback</span>
                    <span className="font-semibold">{roiResults.paybackPeriodMonths > 0 ? `${roiResults.paybackPeriodMonths} mo` : 'Immediate'}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ),
    },
    // Slide 2: Value Summary
    {
      name: 'Value',
      content: (
        <div className="h-full p-3 rounded-lg" style={{ backgroundColor: FORTER_LIGHT_BG }}>
          <p className="text-[8px] uppercase tracking-wide font-medium" style={{ color: FORTER_BLUE, fontFamily: 'Proxima Nova, sans-serif' }}>Value Summary</p>
          <p className="text-[10px] font-bold mt-1" style={{ color: FORTER_NAVY, fontFamily: 'Proxima Nova, sans-serif' }}>Annual Value Breakdown</p>
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            <div className="bg-white rounded p-2 text-center">
              <p className="text-[7px] text-muted-foreground" style={{ fontFamily: 'Proxima Nova, sans-serif' }}>GMV Uplift</p>
              <p className="text-[10px] font-bold" style={{ color: FORTER_BLUE, fontFamily: 'Proxima Nova, sans-serif' }}>
                {formatCurrency(valueTotals.gmvUplift, currency, true)}
              </p>
            </div>
            <div className="bg-white rounded p-2 text-center">
              <p className="text-[7px] text-muted-foreground" style={{ fontFamily: 'Proxima Nova, sans-serif' }}>Cost Reduction</p>
              <p className="text-[10px] font-bold" style={{ color: FORTER_BLUE, fontFamily: 'Proxima Nova, sans-serif' }}>
                {formatCurrency(valueTotals.costReduction, currency, true)}
              </p>
            </div>
            <div className="bg-white rounded p-2 text-center">
              <p className="text-[7px] text-muted-foreground" style={{ fontFamily: 'Proxima Nova, sans-serif' }}>Risk Mitigation</p>
              <p className="text-[10px] font-bold" style={{ color: FORTER_BLUE, fontFamily: 'Proxima Nova, sans-serif' }}>
                {formatCurrency(valueTotals.riskMitigation, currency, true)}
              </p>
            </div>
          </div>
          <div className="mt-2 bg-white rounded p-2 text-center" style={{ borderLeft: `3px solid ${FORTER_BLUE}` }}>
            <span className="text-[8px] text-muted-foreground" style={{ fontFamily: 'Proxima Nova, sans-serif' }}>Total EBITDA Contribution: </span>
            <span className="text-[11px] font-bold" style={{ color: FORTER_BLUE, fontFamily: 'Proxima Nova, sans-serif' }}>
              {formatCurrency(valueTotals.ebitdaContribution, currency, true)}
            </span>
          </div>
        </div>
      ),
    },
    // Slide 3: Top Value Drivers
    {
      name: 'Drivers',
      content: (
        <div className="h-full p-3 rounded-lg" style={{ backgroundColor: FORTER_LIGHT_BG }}>
          <p className="text-[8px] uppercase tracking-wide font-medium" style={{ color: FORTER_BLUE, fontFamily: 'Proxima Nova, sans-serif' }}>Top Value Drivers</p>
          <p className="text-[10px] font-bold mt-1" style={{ color: FORTER_NAVY, fontFamily: 'Proxima Nova, sans-serif' }}>Primary Value Contributors</p>
          <div className="mt-2 space-y-1">
            {topDrivers.slice(0, 4).map((driver, idx) => (
              <div key={idx} className="flex justify-between items-center bg-white rounded px-2 py-1.5">
                <span className="text-[8px] truncate flex-1" style={{ fontFamily: 'Proxima Nova, sans-serif' }}>{driver.label}</span>
                <span className="text-[9px] font-bold ml-2" style={{ color: FORTER_BLUE, fontFamily: 'Proxima Nova, sans-serif' }}>
                  {formatCurrency(driver.value, currency, true)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    // Slide 4: Target Outcomes
    {
      name: 'KPIs',
      content: (
        <div className="h-full p-3 rounded-lg" style={{ backgroundColor: FORTER_LIGHT_BG }}>
          <p className="text-[8px] uppercase tracking-wide font-medium" style={{ color: FORTER_BLUE, fontFamily: 'Proxima Nova, sans-serif' }}>Target Outcomes</p>
          <p className="text-[10px] font-bold mt-1" style={{ color: FORTER_NAVY, fontFamily: 'Proxima Nova, sans-serif' }}>Key Performance Improvements</p>
          <div className="mt-2 space-y-1 bg-white rounded p-2">
            <div className="grid grid-cols-3 text-[7px] font-semibold pb-1 border-b" style={{ color: FORTER_NAVY, fontFamily: 'Proxima Nova, sans-serif' }}>
              <span>Metric</span>
              <span className="text-center">Current</span>
              <span className="text-center">Target</span>
            </div>
            {formData.amerPreAuthApprovalRate && (
              <div className="grid grid-cols-3 text-[7px] py-0.5" style={{ fontFamily: 'Proxima Nova, sans-serif' }}>
                <span>Approval Rate</span>
                <span className="text-center">{formData.amerPreAuthApprovalRate}%</span>
                <span className="text-center font-semibold" style={{ color: FORTER_BLUE }}>
                  {Math.min(formData.amerPreAuthApprovalRate + 2, 99.5)}%
                </span>
              </div>
            )}
            {formData.amer3DSChallengeRate && (
              <div className="grid grid-cols-3 text-[7px] py-0.5" style={{ fontFamily: 'Proxima Nova, sans-serif' }}>
                <span>Challenge 3DS Rate</span>
                <span className="text-center">{formData.amer3DSChallengeRate}%</span>
                <span className="text-center font-semibold" style={{ color: FORTER_BLUE }}>
                  {(formData.amer3DSChallengeRate * 0.5).toFixed(1)}%
                </span>
              </div>
            )}
            {formData.fraudCBRate && (
              <div className="grid grid-cols-3 text-[7px] py-0.5" style={{ fontFamily: 'Proxima Nova, sans-serif' }}>
                <span>Fraud CB Rate</span>
                <span className="text-center">{formData.fraudCBRate}%</span>
                <span className="text-center font-semibold" style={{ color: FORTER_BLUE }}>0.25%</span>
              </div>
            )}
          </div>
        </div>
      ),
    },
  ];

  // Add ROI slide if investment exists
  if (hasInvestment) {
    slides.push({
      name: 'ROI',
      content: (
        <div className="h-full p-3 rounded-lg" style={{ backgroundColor: FORTER_LIGHT_BG }}>
          <p className="text-[8px] uppercase tracking-wide" style={{ color: FORTER_BLUE }}>ROI Summary</p>
          <p className="text-[10px] font-bold mt-1" style={{ color: FORTER_NAVY }}>Return on Investment</p>
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            <div className="bg-white rounded p-2 text-center" style={{ borderTop: `2px solid ${FORTER_BLUE}` }}>
              <p className="text-[7px] text-muted-foreground">ROI</p>
              <p className="text-[12px] font-bold" style={{ color: FORTER_BLUE }}>{roiResults.roi.toFixed(1)}x</p>
            </div>
            <div className="bg-white rounded p-2 text-center" style={{ borderTop: `2px solid ${FORTER_BLUE}` }}>
              <p className="text-[7px] text-muted-foreground">Payback</p>
              <p className="text-[10px] font-bold" style={{ color: FORTER_BLUE }}>
                {roiResults.paybackPeriodMonths > 0 ? `${roiResults.paybackPeriodMonths} mo` : 'Now'}
              </p>
            </div>
            <div className="bg-white rounded p-2 text-center" style={{ borderTop: `2px solid ${FORTER_BLUE}` }}>
              <p className="text-[7px] text-muted-foreground">Tenure</p>
              <p className="text-[10px] font-bold" style={{ color: FORTER_NAVY }}>
                {roiResults.yearProjections.length || 3} yrs
              </p>
            </div>
          </div>
          <div className="mt-2 bg-white rounded p-1.5 text-[7px]">
            <div className="grid grid-cols-4 font-semibold pb-1 border-b" style={{ color: FORTER_NAVY }}>
              <span>Year</span>
              <span className="text-right">Gross</span>
              <span className="text-right">Cost</span>
              <span className="text-right">Net</span>
            </div>
            {roiResults.yearProjections.slice(0, 3).map((y, idx) => (
              <div key={idx} className="grid grid-cols-4 py-0.5">
                <span>Y{y.year}</span>
                <span className="text-right">{formatCurrency(y.runRateGrossEBITDA, currency, true)}</span>
                <span className="text-right">{formatCurrency(y.forterSaaSCost + y.integrationCost, currency, true)}</span>
                <span className="text-right font-semibold" style={{ color: FORTER_BLUE }}>
                  {formatCurrency(y.netEBITDAContribution, currency, true)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ),
    });
  }

  // Add Next Steps slide
  slides.push({
    name: 'Next',
    content: (
      <div className="h-full p-3 rounded-lg" style={{ backgroundColor: FORTER_LIGHT_BG }}>
        <p className="text-[8px] uppercase tracking-wide font-medium" style={{ color: FORTER_BLUE, fontFamily: 'Proxima Nova, sans-serif' }}>Next Steps</p>
        <p className="text-[10px] font-bold mt-1" style={{ color: FORTER_NAVY, fontFamily: 'Proxima Nova, sans-serif' }}>Recommended Actions</p>
        <div className="mt-3 space-y-2">
          {(hasInvestment ? [
            'Technical integration discussion',
            'Proof of concept timeline',
            'Business case review',
            'Contract planning',
          ] : [
            'Finalize investment discussion',
            'Technical integration discussion',
            'Proof of concept timeline',
            'Business case review',
          ]).map((step, idx) => (
            <div key={idx} className="flex items-start gap-2 bg-white rounded px-2 py-1.5">
              <span className="text-[9px] font-bold" style={{ color: FORTER_BLUE, fontFamily: 'Proxima Nova, sans-serif' }}>{idx + 1}</span>
              <span className="text-[8px]" style={{ fontFamily: 'Proxima Nova, sans-serif' }}>{step}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  });

  // Add Appendix slide
  const activeChallengeCount = Object.values(selectedChallenges).filter(Boolean).length;
  if (activeChallengeCount > 0) {
    slides.push({
      name: 'Appendix',
      content: (
        <div className="h-full p-3 rounded-lg flex flex-col justify-center items-center" style={{ backgroundColor: FORTER_NAVY }}>
          <p className="text-[14px] font-bold text-white" style={{ fontFamily: 'Proxima Nova, sans-serif' }}>Appendix</p>
          <p className="text-[10px] text-white/70 mt-2" style={{ fontFamily: 'Proxima Nova, sans-serif' }}>Calculator Methodology & Assumptions</p>
          <div className="mt-4 bg-white/10 rounded p-3 text-center">
            <p className="text-[8px] text-white/80" style={{ fontFamily: 'Proxima Nova, sans-serif' }}>
              {activeChallengeCount} calculator{activeChallengeCount !== 1 ? 's' : ''} with detailed breakdowns
            </p>
            <p className="text-[7px] text-white/60 mt-1" style={{ fontFamily: 'Proxima Nova, sans-serif' }}>
              Including formulas, inputs, and methodology
            </p>
          </div>
        </div>
      ),
    });
  }

  return (
    <Card className="border shadow-sm overflow-hidden">
      {/* Slide Display */}
      <div className="h-[280px] bg-muted/30 p-2">
        {slides[currentSlide]?.content}
      </div>
      
      {/* Navigation */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
          disabled={currentSlide === 0}
          className="h-7 px-2"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Prev
        </Button>
        
        <div className="flex gap-1">
          {slides.map((slide, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`px-2 py-0.5 rounded text-[8px] transition-all ${
                currentSlide === idx 
                  ? 'bg-primary text-primary-foreground font-medium' 
                  : 'bg-muted hover:bg-muted-foreground/20'
              }`}
            >
              {slide.name}
            </button>
          ))}
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
          disabled={currentSlide === slides.length - 1}
          className="h-7 px-2"
        >
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
      
      {/* Slide counter */}
      <div className="text-center py-1 text-[10px] text-muted-foreground bg-muted/30">
        Slide {currentSlide + 1} of {slides.length} • Forter branded
      </div>
    </Card>
  );
}