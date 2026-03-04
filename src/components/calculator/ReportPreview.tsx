import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalculatorData } from "@/pages/Index";
import { ValueTotals } from "@/components/calculator/ValueSummaryOptionA";
import { ROIResults } from "@/lib/roiCalculations";
import { getCurrencySymbol } from "@/lib/benchmarkData";
import { StrategicObjectiveId, STRATEGIC_OBJECTIVES, USE_CASES } from "@/lib/useCaseMapping";
import { generateHeadline, getSelectedChallengeProblems, getSolutionApproaches } from "@/lib/reportGeneration";
import { getCaseStudySlideNumbersInOrder } from "@/lib/caseStudyMapping";
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

// Forter brand colors (aligned with reportGeneration value deck)
const FORTER_BLUE = '#2563EB';
const FORTER_NAVY = '#0D1B3E';
const FORTER_LIGHT_BG = '#F5F7FA';
const FORTER_GREEN = '#16A34A';
const LIGHT_GREEN = '#86EFAC';
const FORTER_GRAY = '#6B7280';
const BORDER_GRAY = '#E5E7EB';

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

  // Guard against missing data to prevent blank screen / crashes
  const safeValueTotals = valueTotals ?? { gmvUplift: 0, costReduction: 0, riskMitigation: 0, ebitdaContribution: 0, gmvUpliftBreakdown: [], costReductionBreakdown: [], riskMitigationBreakdown: [] };
  const safeFormData = formData ?? {} as CalculatorData;
  const safeChallenges = selectedChallenges ?? {};
  const safeRoiResults = roiResults ?? { roi: 0, hasInvestment: false, paybackPeriodMonths: 0, yearProjections: [], totalProjection: null };
  const safeObjectives = selectedObjectives ?? [];

  const customerName = safeFormData.customerName || 'Customer';
  const currency = safeFormData.baseCurrency || 'USD';
  const useStrategicAlignment = safeObjectives.length > 0;
  const strategicObjectives = getStrategicObjectiveDetails(safeObjectives);
  const useCases = getUseCasesForChallenges(safeChallenges);
  const topDrivers = getTopValueDrivers(safeValueTotals);

  const headline = generateHeadline(safeFormData, safeValueTotals);
  const problems = getSelectedChallengeProblems(safeChallenges);
  const solutions = getSolutionApproaches(safeChallenges);

  // Value category cards (only where value > 0), matching value deck
  const valueCategories = [
    safeValueTotals.gmvUplift > 0 && { label: 'GMV Uplift', sub: 'Revenue recovered from false declines & funnel', val: formatCurrency(safeValueTotals.gmvUplift, currency) },
    safeValueTotals.costReduction > 0 && { label: 'Cost Reduction', sub: 'Operational & chargeback savings', val: formatCurrency(safeValueTotals.costReduction, currency) },
    safeValueTotals.riskMitigation > 0 && { label: 'Risk Mitigation', sub: 'Fraud & abuse losses prevented', val: formatCurrency(safeValueTotals.riskMitigation, currency) },
  ].filter(Boolean) as { label: string; sub: string; val: string }[];

  const miniCards = [
    hasInvestment && { label: 'Return on Investment', val: `${safeRoiResults.roi.toFixed(1)}×` },
    { label: 'Expected 3yr EBITDA (incl. ramp time)', val: formatCurrency(safeRoiResults.totalProjection?.netEBITDAContribution ?? 0, currency) },
  ].filter(Boolean) as { label: string; val: string }[];

  // Executive Summary (DOCX-style one-pager preview — consulting layout)
  if (type === 'executive') {
    const opportunityStatement = `Because of rising fraud sophistication and payment friction, ${customerName} should implement an automated fraud decisioning solution by [TIMELINE]. After, ${customerName} will avoid ${formatCurrency(safeValueTotals.riskMitigation, currency, true)} in fraud losses while unlocking ${formatCurrency(safeValueTotals.gmvUplift, currency, true)} in recovered GMV.`;
    return (
      <Card className="p-4 bg-white border shadow-sm max-h-[450px] overflow-y-auto">
        <div className="space-y-2 text-xs">
          <p className="text-[8px] font-bold tracking-wide" style={{ color: FORTER_BLUE }}>VALUE ASSESSMENT  ·  {customerName}</p>
          <h2 className="text-base font-bold pb-1 border-b-2" style={{ color: FORTER_NAVY, borderColor: FORTER_BLUE }}>{headline}</h2>
          <p className="text-[9px]" style={{ color: FORTER_GRAY }}><span className="font-semibold">Developed by: </span><span className="italic">[Champion Name], [Key Deal Players]</span></p>
          <div className="pt-2 space-y-1.5">
            <p className="text-[9px] font-bold uppercase tracking-wide pb-0.5 border-b" style={{ color: FORTER_NAVY, borderColor: FORTER_NAVY }}>Headline</p>
            <p className="text-[10px]" style={{ color: '#374151' }}>{opportunityStatement}</p>
            <p className="text-[9px] font-bold uppercase tracking-wide pt-1.5 pb-0.5 border-b" style={{ color: FORTER_NAVY, borderColor: FORTER_NAVY }}>The Problem Statement</p>
            <p className="text-[9px]" style={{ color: '#374151' }}>This initiative addresses the following high-priority challenges for {customerName}:</p>
            <ul className="space-y-0.5 pl-1">
              {problems.slice(0, 3).map((p, idx) => (
                <li key={idx} className="text-[9px] flex gap-1" style={{ color: '#374151' }}>
                  <span style={{ color: FORTER_BLUE, fontWeight: 700 }}>→</span> {p}
                </li>
              ))}
            </ul>
            <p className="text-[9px] font-bold uppercase tracking-wide pt-1.5 pb-0.5 border-b" style={{ color: FORTER_NAVY, borderColor: FORTER_NAVY }}>Recommended Approach</p>
            <ol className="space-y-0.5 pl-1 list-decimal list-inside text-[9px]" style={{ color: '#374151' }}>
              {solutions.slice(0, 2).map((s, idx) => (
                <li key={idx}><span style={{ color: FORTER_BLUE, fontWeight: 700 }}>{idx + 1}. </span>{s}</li>
              ))}
            </ol>
            <p className="text-[9px] italic" style={{ color: FORTER_GREEN }}>Forter was found to meet and exceed all requirements for this solution.</p>
            <p className="text-[9px] font-bold uppercase tracking-wide pt-1.5 pb-0.5 border-b" style={{ color: FORTER_NAVY, borderColor: FORTER_NAVY }}>Target Outcomes</p>
            <div className="rounded border overflow-hidden" style={{ borderColor: BORDER_GRAY }}>
              <div className="grid grid-cols-3 text-[8px] font-bold text-white px-2 py-1" style={{ backgroundColor: FORTER_NAVY }}>
                <span>Key Metric</span>
                <span className="text-center">Current</span>
                <span className="text-center">Target with Forter</span>
              </div>
              <div className="grid grid-cols-3 text-[8px] px-2 py-0.5 bg-white" style={{ color: '#374151' }}>
                <span>—</span>
                <span className="text-center">—</span>
                <span className="text-center font-semibold" style={{ color: FORTER_GREEN }}>—</span>
              </div>
            </div>
            <p className="text-[9px] font-bold uppercase tracking-wide pt-1.5 pb-0.5 border-b" style={{ color: FORTER_NAVY, borderColor: FORTER_NAVY }}>{hasInvestment ? 'Required Investment' : 'Projected Value'}</p>
            <p className="text-[9px]" style={{ color: '#374151' }}>Annual EBITDA Contribution: <span className="font-bold" style={{ color: FORTER_GREEN }}>{formatCurrency(safeValueTotals.ebitdaContribution, currency)}</span></p>
          </div>
          <div className="border-t pt-2 mt-2" style={{ borderColor: BORDER_GRAY }}>
            <span className="text-[8px]" style={{ color: FORTER_GRAY }}>© Forter, Inc. All rights Reserved  |  Confidential</span>
          </div>
        </div>
      </Card>
    );
  }

  // Active category cards for Value Summary (match value deck Slide 3)
  const activeCategories = [
    safeValueTotals.gmvUplift > 0 && {
      label: 'GMV Uplift',
      value: formatCurrency(safeValueTotals.gmvUplift, currency),
      items: (safeValueTotals.gmvUpliftBreakdown || []).filter(b => b.value > 0).slice(0, 3),
    },
    safeValueTotals.costReduction > 0 && {
      label: 'Cost Reduction',
      value: formatCurrency(safeValueTotals.costReduction, currency),
      items: (safeValueTotals.costReductionBreakdown || []).filter(b => b.value > 0).slice(0, 3),
    },
    safeValueTotals.riskMitigation > 0 && {
      label: 'Risk Mitigation',
      value: formatCurrency(safeValueTotals.riskMitigation, currency),
      items: (safeValueTotals.riskMitigationBreakdown || []).filter(b => b.value > 0).slice(0, 3),
    },
  ].filter(Boolean) as { label: string; value: string; items: { label: string; value: number }[] }[];

  // PowerPoint Slides — aligned with value deck (section label, Executive Summary layout, Value Summary, etc.)
  const slides = [
    // Slide 1: Executive Summary (value deck Slide 2)
    {
      name: 'Summary',
      content: (
        <div className="h-full p-2.5 rounded-lg flex flex-col" style={{ backgroundColor: FORTER_LIGHT_BG }}>
          <p className="text-[7px] font-bold tracking-wide shrink-0" style={{ color: FORTER_BLUE }}>{customerName} x Forter Business Value Assessment</p>
          <h3 className="text-xs font-bold mt-0.5 shrink-0" style={{ color: FORTER_NAVY }}>Executive Summary</h3>
          <p className="text-[9px] shrink-0" style={{ color: FORTER_GRAY }}>{headline}</p>
          <div className="grid grid-cols-2 gap-2 mt-1.5 flex-1 min-h-0">
            <div className="space-y-1">
              <p className="font-semibold text-[8px] uppercase tracking-wide" style={{ color: FORTER_BLUE }}>Key Challenges Identified</p>
              <ul className="space-y-0.5">
                {problems.slice(0, 3).map((p, idx) => (
                  <li key={idx} className="text-[9px] flex gap-1" style={{ color: '#374151' }}>
                    <span style={{ color: FORTER_BLUE, fontWeight: 700 }}>→</span> {p}
                  </li>
                ))}
              </ul>
              <p className="font-semibold text-[8px] uppercase tracking-wide pt-0.5" style={{ color: FORTER_BLUE }}>Recommended Approach</p>
              <ul className="space-y-0.5">
                {solutions.slice(0, 2).map((s, idx) => (
                  <li key={idx} className="text-[9px] flex gap-1" style={{ color: '#374151' }}>
                    <span style={{ color: FORTER_BLUE, fontWeight: 700 }}>→</span> {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-1 min-h-0 flex flex-col">
              <p className="font-semibold text-[8px] uppercase tracking-wide shrink-0" style={{ color: FORTER_BLUE }}>Value at Stake</p>
              <div className="space-y-1 flex-1 min-h-0 overflow-hidden">
                {valueCategories.map((card, i) => (
                  <div key={i} className="bg-white rounded p-1 border shrink-0" style={{ borderColor: BORDER_GRAY }}>
                    <p className="text-[8px] font-medium" style={{ color: FORTER_GRAY }}>{card.label}</p>
                    <p className="text-[6px]" style={{ color: '#9CA3AF' }}>{card.sub}</p>
                    <p className="text-[10px] font-bold text-right" style={{ color: FORTER_GREEN }}>{card.val}</p>
                  </div>
                ))}
                <div className="rounded p-1.5 shrink-0 text-white" style={{ backgroundColor: FORTER_NAVY }}>
                  <p className="text-[8px] font-bold">Annual EBITDA Contribution</p>
                  <p className="text-[6px]" style={{ color: LIGHT_GREEN }}>Total of above, applying commission & gross margin to GMV Uplift · Net of deduplication</p>
                  <p className="text-[10px] font-bold text-right" style={{ color: LIGHT_GREEN }}>{formatCurrency(safeValueTotals.ebitdaContribution, currency)}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {miniCards.map((mc, i) => (
                    <div key={i} className="flex-1 bg-white rounded p-1 border" style={{ borderColor: BORDER_GRAY }}>
                      <p className="text-[6px]" style={{ color: FORTER_GRAY }}>{mc.label}</p>
                      <p className="text-[8px] font-bold" style={{ color: FORTER_BLUE }}>{mc.val}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="border-t pt-1 mt-1 flex justify-between items-center shrink-0" style={{ borderColor: BORDER_GRAY }}>
            <span className="text-[7px]" style={{ color: FORTER_GRAY }}>2</span>
            <span className="text-[7px]" style={{ color: FORTER_GRAY }}>© Forter, Inc. All rights Reserved  |  Confidential</span>
          </div>
        </div>
      ),
    },
    // Slide 2: Value Summary (value deck Slide 3)
    {
      name: 'Value',
      content: (
        <div className="h-full p-2.5 rounded-lg flex flex-col" style={{ backgroundColor: FORTER_LIGHT_BG }}>
          <p className="text-[7px] font-bold tracking-wide shrink-0" style={{ color: FORTER_BLUE }}>{customerName} x Forter Business Value Assessment</p>
          <h3 className="text-xs font-bold mt-0.5 shrink-0" style={{ color: FORTER_NAVY }}>Value Summary</h3>
          <div className={`grid gap-1.5 mt-1.5 flex-1 min-h-0 ${activeCategories.length === 1 ? 'grid-cols-1' : activeCategories.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {activeCategories.map((cat, i) => (
              <div key={i} className="bg-white rounded p-1.5 border flex flex-col min-h-0" style={{ borderColor: BORDER_GRAY }}>
                <p className="text-[7px] font-bold uppercase tracking-wide" style={{ color: FORTER_BLUE }}>{cat.label}</p>
                <p className="text-[10px] font-bold" style={{ color: FORTER_GREEN }}>{cat.value}</p>
                <div className="border-t mt-0.5 pt-0.5 flex-1 min-h-0" style={{ borderColor: BORDER_GRAY }}>
                  {cat.items.slice(0, 3).map((item, j) => (
                    <div key={j} className="flex justify-between text-[7px]">
                      <span style={{ color: FORTER_GRAY }}>{item.label}</span>
                      <span className="font-semibold" style={{ color: FORTER_NAVY }}>{formatCurrency(item.value, currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded p-1.5 mt-1.5 flex items-center justify-between shrink-0 text-white" style={{ backgroundColor: FORTER_NAVY }}>
            <div>
              <p className="text-[9px] font-bold">Annual EBITDA Contribution</p>
              <p className="text-[6px]" style={{ color: '#9CA3AF' }}>Net of deduplication assumptions</p>
            </div>
            <p className="text-[11px] font-bold" style={{ color: LIGHT_GREEN }}>{formatCurrency(safeValueTotals.ebitdaContribution, currency)}</p>
          </div>
          <p className="text-[7px] font-bold mt-1 shrink-0" style={{ color: FORTER_NAVY }}>KEY PERFORMANCE IMPROVEMENTS</p>
          <div className="border-t pt-1 mt-0.5 flex justify-between shrink-0" style={{ borderColor: BORDER_GRAY }}>
            <span className="text-[7px]" style={{ color: FORTER_GRAY }}>3</span>
            <span className="text-[7px]" style={{ color: FORTER_GRAY }}>© Forter, Inc. All rights Reserved  |  Confidential</span>
          </div>
        </div>
      ),
    },
    // Slide 3: Value Drivers (value deck Slide 4)
    {
      name: 'Drivers',
      content: (
        <div className="h-full p-2.5 rounded-lg flex flex-col" style={{ backgroundColor: FORTER_LIGHT_BG }}>
          <p className="text-[7px] font-bold tracking-wide shrink-0" style={{ color: FORTER_BLUE }}>{customerName} x Forter Business Value Assessment</p>
          <h3 className="text-xs font-bold mt-0.5 shrink-0" style={{ color: FORTER_NAVY }}>Value Drivers</h3>
          <div className="mt-1.5 flex-1 min-h-0 overflow-auto space-y-0.5">
            {topDrivers.slice(0, 6).map((driver, idx) => (
              <div key={idx} className="flex justify-between items-center bg-white rounded px-2 py-1 border" style={{ borderColor: BORDER_GRAY, backgroundColor: idx % 2 === 1 ? '#F9FAFB' : undefined }}>
                <span className="text-[8px] truncate flex-1" style={{ color: FORTER_NAVY }}>{driver.label}</span>
                <span className="text-[9px] font-bold ml-2" style={{ color: FORTER_GREEN }}>{formatCurrency(driver.value, currency)}</span>
              </div>
            ))}
          </div>
          <div className="rounded px-2 py-1 mt-1 flex justify-between items-center shrink-0 text-white" style={{ backgroundColor: FORTER_NAVY }}>
            <span className="text-[8px] font-bold">Total</span>
            <span className="text-[9px] font-bold">{formatCurrency(safeValueTotals.ebitdaContribution, currency)}</span>
          </div>
          <div className="border-t pt-1 mt-1 flex justify-between shrink-0" style={{ borderColor: BORDER_GRAY }}>
            <span className="text-[7px]" style={{ color: FORTER_GRAY }}>4</span>
            <span className="text-[7px]" style={{ color: FORTER_GRAY }}>© Forter, Inc. All rights Reserved  |  Confidential</span>
          </div>
        </div>
      ),
    },
    // Slide 4: Target Outcomes (value deck Slide 5)
    {
      name: 'KPIs',
      content: (
        <div className="h-full p-2.5 rounded-lg flex flex-col" style={{ backgroundColor: FORTER_LIGHT_BG }}>
          <p className="text-[7px] font-bold tracking-wide shrink-0" style={{ color: FORTER_BLUE }}>{customerName} x Forter Business Value Assessment</p>
          <h3 className="text-xs font-bold mt-0.5 shrink-0" style={{ color: FORTER_NAVY }}>Target Outcomes</h3>
          <div className="mt-1.5 flex-1 min-h-0 overflow-auto bg-white rounded border p-1.5" style={{ borderColor: BORDER_GRAY }}>
            <div className="grid grid-cols-4 text-[7px] font-semibold pb-0.5 border-b" style={{ color: FORTER_NAVY }}>
              <span>Metric</span>
              <span className="text-center">Current</span>
              <span className="text-center">With Forter</span>
              <span className="text-center">Improvement</span>
            </div>
            {safeFormData.amerPreAuthApprovalRate != null && (
              <div className="grid grid-cols-4 text-[7px] py-0.5">
                <span>Approval Rate</span>
                <span className="text-center">{safeFormData.amerPreAuthApprovalRate}%</span>
                <span className="text-center font-semibold" style={{ color: FORTER_GREEN }}>{Math.min(safeFormData.amerPreAuthApprovalRate + 2, 99.5)}%</span>
                <span className="text-center font-semibold" style={{ color: FORTER_GREEN }}>+2%</span>
              </div>
            )}
            {safeFormData.amer3DSChallengeRate != null && (
              <div className="grid grid-cols-4 text-[7px] py-0.5">
                <span>Challenge 3DS Rate</span>
                <span className="text-center">{safeFormData.amer3DSChallengeRate}%</span>
                <span className="text-center font-semibold" style={{ color: FORTER_GREEN }}>{(safeFormData.amer3DSChallengeRate * 0.5).toFixed(1)}%</span>
                <span className="text-center font-semibold" style={{ color: FORTER_GREEN }}>-50%</span>
              </div>
            )}
            {safeFormData.fraudCBRate != null && (
              <div className="grid grid-cols-4 text-[7px] py-0.5">
                <span>Fraud CB Rate</span>
                <span className="text-center">{Number(safeFormData.fraudCBRate).toFixed(2)}%</span>
                <span className="text-center font-semibold" style={{ color: FORTER_GREEN }}>0.25%</span>
                <span className="text-center font-semibold" style={{ color: FORTER_GREEN }}>—</span>
              </div>
            )}
          </div>
          <div className="border-t pt-1 mt-1 flex justify-between shrink-0" style={{ borderColor: BORDER_GRAY }}>
            <span className="text-[7px]" style={{ color: FORTER_GRAY }}>5</span>
            <span className="text-[7px]" style={{ color: FORTER_GRAY }}>© Forter, Inc. All rights Reserved  |  Confidential</span>
          </div>
        </div>
      ),
    },
  ];

  // Add ROI slide if investment exists (value deck Slide 6)
  const roiPageNum = 6;
  if (hasInvestment) {
    slides.push({
      name: 'ROI',
      content: (
        <div className="h-full p-2.5 rounded-lg flex flex-col" style={{ backgroundColor: FORTER_LIGHT_BG }}>
          <p className="text-[7px] font-bold tracking-wide shrink-0" style={{ color: FORTER_BLUE }}>{customerName} x Forter Business Value Assessment</p>
          <h3 className="text-xs font-bold mt-0.5 shrink-0" style={{ color: FORTER_NAVY }}>ROI Summary</h3>
          <div className="grid grid-cols-3 gap-1.5 mt-1.5">
            <div className="bg-white rounded p-1.5 text-center border" style={{ borderColor: BORDER_GRAY }}>
              <p className="text-[7px]" style={{ color: FORTER_GRAY }}>ROI</p>
              <p className="text-[11px] font-bold" style={{ color: FORTER_BLUE }}>{safeRoiResults.roi.toFixed(1)}×</p>
            </div>
            <div className="bg-white rounded p-1.5 text-center border" style={{ borderColor: BORDER_GRAY }}>
              <p className="text-[7px]" style={{ color: FORTER_GRAY }}>Payback</p>
              <p className="text-[9px] font-bold" style={{ color: FORTER_BLUE }}>{safeRoiResults.paybackPeriodMonths > 0 ? `${safeRoiResults.paybackPeriodMonths} mo` : 'Now'}</p>
            </div>
            <div className="bg-white rounded p-1.5 text-center border" style={{ borderColor: BORDER_GRAY }}>
              <p className="text-[7px]" style={{ color: FORTER_GRAY }}>Tenure</p>
              <p className="text-[9px] font-bold" style={{ color: FORTER_NAVY }}>{safeRoiResults.yearProjections?.length || 3} yrs</p>
            </div>
          </div>
          <div className="mt-1.5 flex-1 min-h-0 overflow-auto bg-white rounded border p-1.5 text-[7px]" style={{ borderColor: BORDER_GRAY }}>
            <div className="grid grid-cols-4 font-semibold pb-0.5 border-b" style={{ color: FORTER_NAVY }}>
              <span>Year</span>
              <span className="text-right">Gross</span>
              <span className="text-right">Cost</span>
              <span className="text-right">Net</span>
            </div>
            {(safeRoiResults.yearProjections || []).slice(0, 3).map((y, idx) => (
              <div key={idx} className="grid grid-cols-4 py-0.5">
                <span>Y{y.year}</span>
                <span className="text-right">{formatCurrency(y.runRateGrossEBITDA, currency, true)}</span>
                <span className="text-right">{formatCurrency(y.forterSaaSCost + y.integrationCost, currency, true)}</span>
                <span className="text-right font-semibold" style={{ color: FORTER_GREEN }}>{formatCurrency(y.netEBITDAContribution, currency, true)}</span>
              </div>
            ))}
          </div>
          <div className="border-t pt-1 mt-1 flex justify-between shrink-0" style={{ borderColor: BORDER_GRAY }}>
            <span className="text-[7px]" style={{ color: FORTER_GRAY }}>{roiPageNum}</span>
            <span className="text-[7px]" style={{ color: FORTER_GRAY }}>© Forter, Inc. All rights Reserved  |  Confidential</span>
          </div>
        </div>
      ),
    });
  }

  // Next Steps (value deck Slide 7 or 6)
  const nextPageNum = hasInvestment ? 7 : 6;
  slides.push({
    name: 'Next',
    content: (
      <div className="h-full p-2.5 rounded-lg flex flex-col" style={{ backgroundColor: FORTER_LIGHT_BG }}>
        <p className="text-[7px] font-bold tracking-wide shrink-0" style={{ color: FORTER_BLUE }}>{customerName} x Forter Business Value Assessment</p>
        <h3 className="text-xs font-bold mt-0.5 shrink-0" style={{ color: FORTER_NAVY }}>Next Steps</h3>
        <div className="mt-1.5 space-y-1.5 flex-1 min-h-0 overflow-auto">
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
            <div key={idx} className="flex items-start gap-2 bg-white rounded px-2 py-1.5 border" style={{ borderColor: BORDER_GRAY }}>
              <span className="text-[9px] font-bold shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: FORTER_BLUE }}>{idx + 1}</span>
              <span className="text-[8px]" style={{ color: '#374151' }}>{step}</span>
            </div>
          ))}
        </div>
        <div className="border-t pt-1 mt-1 flex justify-between shrink-0" style={{ borderColor: BORDER_GRAY }}>
          <span className="text-[7px]" style={{ color: FORTER_GRAY }}>{nextPageNum}</span>
          <span className="text-[7px]" style={{ color: FORTER_GRAY }}>© Forter, Inc. All rights Reserved  |  Confidential</span>
        </div>
      </div>
    ),
  });

  // Case Studies (value deck — before Appendix)
  const caseStudySlideNumbers = getCaseStudySlideNumbersInOrder();
  const caseStudiesPageNum = nextPageNum + 1;
  if (caseStudySlideNumbers.length > 0) {
    slides.push({
      name: 'Case Studies',
      content: (
        <div className="h-full p-2.5 rounded-lg flex flex-col" style={{ backgroundColor: FORTER_NAVY }}>
          <div className="flex-1 flex flex-col justify-center items-center min-h-0">
            <p className="text-sm font-bold text-white">Case Studies</p>
            <p className="text-[9px] mt-1.5" style={{ color: '#A5C8FF' }}>Success stories from the GVA Case Study Deck</p>
            <div className="mt-3 bg-white/10 rounded p-2 text-center">
              <p className="text-[8px] text-white/90">
                {caseStudySlideNumbers.length} success story slide{caseStudySlideNumbers.length !== 1 ? 's' : ''}
              </p>
              <p className="text-[7px] text-white/70 mt-0.5">One slide per benefit with a case study</p>
            </div>
          </div>
          <div className="flex justify-between px-2 pt-1 text-[7px] shrink-0" style={{ color: 'rgba(255,255,255,0.8)' }}>
            <span>{caseStudiesPageNum}</span>
            <span>© Forter, Inc. All rights Reserved  |  Confidential</span>
          </div>
        </div>
      ),
    });
    // Preview: one slide showing thumbnails of case study images
    const previewCount = Math.min(6, caseStudySlideNumbers.length);
    const moreCount = caseStudySlideNumbers.length - previewCount;
    slides.push({
      name: 'Stories',
      content: (
        <div className="h-full p-2.5 rounded-lg flex flex-col" style={{ backgroundColor: FORTER_LIGHT_BG }}>
          <p className="text-[7px] font-bold tracking-wide shrink-0" style={{ color: FORTER_BLUE }}>{customerName} x Forter Business Value Assessment</p>
          <h3 className="text-xs font-bold mt-0.5 shrink-0" style={{ color: FORTER_NAVY }}>Case Studies — Success Stories</h3>
          <div className={`grid gap-1 mt-1.5 flex-1 min-h-0 ${previewCount <= 2 ? 'grid-cols-2' : previewCount <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {caseStudySlideNumbers.slice(0, previewCount).map((slideNum) => (
              <div key={slideNum} className="rounded border overflow-hidden bg-white flex flex-col min-h-0" style={{ borderColor: BORDER_GRAY }}>
                <div className="flex-1 min-h-0 relative">
                  <img
                    src={`/case-studies/slide${slideNum}.png`}
                    alt={`Case study ${slideNum}`}
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <p className="text-[6px] px-0.5 py-0.5 text-center truncate" style={{ color: FORTER_GRAY }}>Slide {slideNum}</p>
              </div>
            ))}
          </div>
          {moreCount > 0 && (
            <p className="text-[7px] text-center mt-1 shrink-0" style={{ color: FORTER_GRAY }}>+{moreCount} more in deck</p>
          )}
          <div className="border-t pt-1 mt-1 flex justify-between shrink-0" style={{ borderColor: BORDER_GRAY }}>
            <span className="text-[7px]" style={{ color: FORTER_GRAY }}>{caseStudiesPageNum + 1}</span>
            <span className="text-[7px]" style={{ color: FORTER_GRAY }}>© Forter, Inc. All rights Reserved  |  Confidential</span>
          </div>
        </div>
      ),
    });
  }

  // Appendix (value deck Slide 8+)
  const activeChallengeCount = Object.values(safeChallenges).filter(Boolean).length;
  const appendixPageNum = nextPageNum + 1 + (caseStudySlideNumbers.length > 0 ? 2 : 0);
  if (activeChallengeCount > 0) {
    slides.push({
      name: 'Appendix',
      content: (
        <div className="h-full p-2.5 rounded-lg flex flex-col" style={{ backgroundColor: FORTER_NAVY }}>
          <div className="flex-1 flex flex-col justify-center items-center min-h-0">
            <p className="text-sm font-bold text-white">Appendix</p>
            <p className="text-[9px] mt-1.5" style={{ color: '#A5C8FF' }}>Calculator Details & Methodology</p>
            <div className="mt-3 bg-white/10 rounded p-2 text-center">
              <p className="text-[8px] text-white/90">
                {activeChallengeCount} calculator{activeChallengeCount !== 1 ? 's' : ''} with detailed breakdowns
              </p>
              <p className="text-[7px] text-white/70 mt-0.5">Including formulas, inputs, and methodology</p>
            </div>
          </div>
          <div className="flex justify-between px-2 pt-1 text-[7px] shrink-0" style={{ color: 'rgba(255,255,255,0.8)' }}>
            <span>{appendixPageNum}</span>
            <span>© Forter, Inc. All rights Reserved  |  Confidential</span>
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