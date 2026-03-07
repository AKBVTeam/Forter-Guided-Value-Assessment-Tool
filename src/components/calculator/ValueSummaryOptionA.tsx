import { useMemo, useState, useEffect, useRef, useCallback, Fragment } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  Ban,
  Building,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Expand,
  FileText,
  Info,
  Presentation,
  Pencil,
  Plus,
  RefreshCcw,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  ClipboardList,
  UserCheck,
  X,
  Zap,
  Loader2,
  Lock,
  Mail,
  ChevronLeft,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EditableCalculatorDisplay } from "./EditableCalculatorDisplay";
import { CalculatorData, CustomCalculation, type StandaloneCalculator } from "@/pages/Index";
import { ForterKPIs, defaultForterKPIs, type ForterKPIFocusSection } from "./ForterKPIConfig";
import { getChallengeBenefitContent } from "@/lib/challengeBenefitContent";
import { hasCaseStudy, getCaseStudyImagePath } from "@/lib/caseStudyMapping";
import {
  calculateChallenge1,
  calculateChallenge245,
  getCompletedTransactionCount,
  calculateChallenge3,
  calculateChallenge7,
  calculateChallenge8,
  calculateChallenge9,
  calculateChallenge10,
  calculateChallenge12_13,
  calculateChallenge14_15,
  Challenge1Inputs,
  Challenge245Inputs,
  Challenge3Inputs,
  Challenge7Inputs,
  Challenge8Inputs,
  Challenge9Inputs,
  Challenge10Inputs,
  Challenge12_13Inputs,
  Challenge14_15Inputs,
  CalculatorRow,
  ALL_CHALLENGES,
  SOLUTION_PRODUCTS,
  DeduplicationAssumptions,
  defaultDeduplicationAssumptions,
  DeduplicationBreakdown,
  createCurrencyFormatter,
  type PaymentFunnelStage,
} from "@/lib/calculations";
import { defaultAbuseBenchmarks } from "./AbuseBenchmarksModal";
import { getCurrencySymbol } from "@/lib/benchmarkData";
import { getGmvToNetSalesDeductionPct } from "@/lib/gmvToNetSalesDeductionByCountry";
import { cn } from "@/lib/utils";
import { SegmentCalculatorTabs, computeSegmentedAggregateValue, computeSegmentedAggregateRows, computeSegmentedAggregateDeduplicationBreakdown, computeSegmentedAggregateFunnel } from "./SegmentCalculatorTabs";
import { BenefitSelector, BENEFIT_OPTIONS } from "./BenefitSelector";
import { CalculatorInputsTab, hasCalculatorMissingInputs, getCalculatorCompletionPercentage, CALCULATOR_REQUIRED_INPUTS } from "./CalculatorInputsTab";
import { runStandaloneCalculator, STANDALONE_CALC_SECTION } from "@/lib/runStandaloneCalculator";
import { MarginPromptDialog } from "./MarginPromptDialog";
import { generateCalculatorSlide, type FunnelSlideData, CALCULATOR_ID_TO_LABEL } from "@/lib/reportGeneration";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  LabelList,
  Legend,
  DefaultLegendContent,
  Tooltip as RechartsTooltip,
} from "recharts";

interface PerformanceHighlight {
  label: string;
  current: number;
  target: number;
  unit: string;
  percentChange?: number;
  /** Decimal places for display (e.g. 2 for fraud chargeback rate to match calculator) */
  decimals?: number;
}

interface ValueDriver {
  id: string;
  label: string;
  value: number;
  enabled: boolean;
  calculatorTitle?: string;
  calculatorRows?: CalculatorRow[];
  performanceHighlight?: PerformanceHighlight;
  sourceUrl?: string;
  isTBD?: boolean; // True when challenge is selected but inputs are insufficient
}

/** Format ticket count with no decimal places */
function fmtTickets(n: number) {
  return Math.round(n).toLocaleString('en-US');
}

/** Generate evenly spaced Y-axis ticks from 0 to a nice ceiling >= max (for bar charts) */
function getEqualYAxisTicks(max: number, tickCount: number = 5): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];
  const cap = max <= 1
    ? Math.ceil(max * 10) / 10
    : max <= 100
      ? Math.ceil(max / 20) * 20
      : Math.ceil(max / 50) * 50;
  const step = cap / (tickCount - 1);
  return Array.from({ length: tickCount }, (_, i) => Math.round(i * step * 100) / 100);
}

/** Visual tab content for c9-cs-opex (Reduced CS ticket handling): ticket flow bars + cost impact cards + benchmark callout */
export function CSOpExVisual({ rows, showInMillions, currencyCode }: { rows: CalculatorRow[]; showInMillions: boolean; currencyCode: string }) {
  const row = (formula: string) => rows.find((r) => r.formula === formula || r.formula?.startsWith(`${formula} `) || r.formula?.startsWith(`${formula}=`));
  const ticketsCurrent = (row('c')?.rawCustomerValue ?? 0) as number;
  const ticketsForter = (row('c')?.rawForterValue ?? 0) as number;
  const ticketsElim = ticketsCurrent - ticketsForter;
  const yMax = Math.max(ticketsCurrent, ticketsForter, 1) * 1.15;
  const chartData = [
    { name: 'Current', value: ticketsCurrent, fill: '#94a3b8' },
    { name: 'With Forter', value: ticketsForter, fill: '#22c55e' },
  ];
  const reductionPct = ticketsCurrent > 0 ? `${Math.round((ticketsElim / ticketsCurrent) * 100)}%` : (row('b')?.forterOutcome ?? '0%');
  const annualSaving = row('e')?.forterImprovement ?? '—';
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch h-full flex flex-col justify-between">
      {/* Left — Bar chart */}
      <div className="flex flex-col min-h-0 md:border-r md:border-border/60 md:pr-6">
        <h4 className="text-sm font-semibold text-muted-foreground mb-3">Refund tickets reaching CS: current vs. with Forter</h4>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 40, right: 40, left: 20, bottom: 8 }} barCategoryGap="50%" barGap={4}>
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 13, fontWeight: 600 }} />
            <YAxis hide domain={[0, yMax]} />
            <Bar dataKey="value" barSize={56} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
              <LabelList
                position="top"
                content={(props: unknown) => {
                  const { x, y, width, value } = (props as { x?: number; y?: number; width?: number; value?: number });
                  const formatted = fmtTickets(Number(value));
                  return (
                    <text
                      x={Number(x) + Number(width) / 2}
                      y={Number(y) - 8}
                      textAnchor="middle"
                      fontSize={13}
                      fontWeight={600}
                      fill={value === ticketsForter ? '#16a34a' : '#475569'}
                    >
                      {formatted}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex justify-center mt-2">
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            {reductionPct} reduction in refund ticket volumes
          </Badge>
        </div>
      </div>
      {/* Right — Value Impact (heading + three cards) */}
      <div className="flex flex-col gap-4 min-h-0">
        <h4 className="text-sm font-semibold text-muted-foreground">Value Impact</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 min-h-0">
          <Card className="w-full h-28 flex flex-col justify-between p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
            <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div>
              <div className="text-xl font-bold text-blue-700 dark:text-blue-300">{fmtTickets(ticketsElim)}</div>
              <div className="text-xs text-muted-foreground">tickets eliminated</div>
            </div>
          </Card>
          <Card className="w-full h-28 flex flex-col justify-between p-4 rounded-lg border bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700">
            <DollarSign className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            <div>
              <div className="text-xl font-bold text-slate-800 dark:text-slate-200">{row('d')?.customerInput ?? '—'}</div>
              <div className="text-xs text-muted-foreground">per CS contact</div>
            </div>
          </Card>
          <Card className="w-full h-28 flex flex-col justify-between p-4 rounded-lg border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
            <div>
              <div className="text-[1.25rem] font-bold text-green-700 dark:text-green-300">{annualSaving}</div>
              <div className="text-xs text-muted-foreground">annual CS OpEx saving</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Parse currency string (e.g. "£253,385") to number */
function parseCurrencyFromRow(s: string | undefined): number {
  if (s == null || s === '—') return 0;
  const numStr = String(s).replace(/[^\d.-]/g, '');
  const n = parseFloat(numStr);
  return Number.isFinite(n) ? n : 0;
}

/** Visual tab content for c12-ato-opex (ATO protection OpEx): chart + Value Impact cards */
export function ATOOpExVisual({ rows, showInMillions, currencyCode }: { rows: CalculatorRow[]; showInMillions: boolean; currencyCode: string }) {
  const rowC = rows.find((r) => r.formula === 'c' || r.formula?.startsWith('c ='));
  const rowD = rows.find((r) => r.formula === 'd');
  const rowE = rows.find((r) => r.formula === 'e' || r.formula?.startsWith('e ='));
  const costRow = rows.find((r) => r.valueDriver === 'cost');
  const atoAttempts = (rowC?.rawCustomerValue ?? 0) as number;
  const atoSucceed = (rowE?.rawCustomerValue ?? 0) as number;
  const atoForter = (rowE?.rawForterValue ?? 0) as number;
  const atoBlocked = atoAttempts - atoForter;
  const yMax = Math.max(atoSucceed, atoForter, 1) * 1.15;
  const chartData = [
    { name: 'Current', value: atoSucceed, fill: '#94a3b8' },
    { name: 'With Forter', value: atoForter, fill: '#22c55e' },
  ];
  const catchRatePct = (rowD?.rawForterValue ?? 0) as number;
  const annualOpExSaving = parseCurrencyFromRow(costRow?.forterImprovement);
  const avgAppeasementPerClaim = atoBlocked > 0 ? annualOpExSaving / atoBlocked : 0;
  const fmtCur = createCurrencyFormatter(currencyCode);
  return (
    <div className="flex gap-6 items-stretch h-full" style={{ minHeight: 0 }}>
      {/* Left — Chart: fills flex container so off-screen capture uses full width */}
      <div className="flex-1 min-w-0 md:border-r md:border-border/60 md:pr-6">
        <h4 className="text-sm font-semibold text-muted-foreground mb-3">Successful ATO events: current vs. with Forter</h4>
        <div style={{ height: 320 }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 40, right: 20, left: 20, bottom: 8 }} barCategoryGap="50%" barGap={4}>
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 13, fontWeight: 600 }} />
            <YAxis hide domain={[0, yMax]} />
            <Bar dataKey="value" barSize={56} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
              <LabelList
                position="top"
                content={(props: unknown) => {
                  const { x, y, width, value } = (props as { x?: number; y?: number; width?: number; value?: number });
                  return (
                    <text
                      x={Number(x) + Number(width) / 2}
                      y={Number(y) - 8}
                      textAnchor="middle"
                      fontSize={13}
                      fontWeight={600}
                      fill={value === atoForter ? '#16a34a' : '#475569'}
                    >
                      {Number(value).toLocaleString('en-US')}
                    </text>
                  );
                }}
              />
            </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center mt-2">
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            {Math.round(catchRatePct)}% catch rate on ATO attempts
          </Badge>
        </div>
      </div>
      {/* Right — Value Impact cards (fill height) */}
      <div className="flex-1 min-w-0 flex flex-col gap-3 self-stretch">
        <p className="text-sm font-semibold text-muted-foreground mb-3">Value Impact</p>
        <Card className="rounded-lg border p-4 flex flex-col gap-2 flex-1 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700">
          <Shield className="w-5 h-5 text-slate-500" />
          <div className="text-slate-700 dark:text-slate-300 font-bold text-xl">{atoBlocked.toLocaleString('en-US')}</div>
          <div className="text-xs text-muted-foreground">ATO events blocked</div>
        </Card>
        <Card className="rounded-lg border p-4 flex flex-col gap-2 flex-1 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800" title="Annual OpEx saving ÷ ATO events blocked = estimated average appeasement cost per claim avoided.">
          <Ban className="w-5 h-5 text-blue-500" />
          <div className="flex flex-col gap-1">
            <div className="text-blue-700 dark:text-blue-300 font-bold text-xl">{atoBlocked > 0 ? fmtCur(avgAppeasementPerClaim) : '—'}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              Estimated appeasement cost per claim
              <Info className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            </div>
          </div>
        </Card>
        <Card className="rounded-lg border p-4 flex flex-col gap-2 flex-1 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
          <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
          <div className="text-green-700 dark:text-green-300 font-bold text-2xl">{costRow?.forterImprovement ?? '—'}</div>
          <div className="text-xs text-muted-foreground">annual OpEx saving</div>
        </Card>
      </div>
    </div>
  );
}

/** Visual tab content for c14-marketing: signup population dot grids + Value Impact cards */
export function MarketingBudgetVisual({ rows, showInMillions, currencyCode }: { rows: CalculatorRow[]; showInMillions: boolean; currencyCode: string }) {
  const rowA = rows.find((r) => r.formula === 'a');
  const rowB = rows.find((r) => r.formula === 'b');
  const rowC = rows.find((r) => r.formula === 'c' || r.formula?.startsWith('c ='));
  const rowD = rows.find((r) => r.formula === 'd');
  const rowE = rows.find((r) => (r.formula === 'e' || r.formula?.startsWith('e =')) && r.valueDriver === 'cost');
  const monthlySignups = (rowA?.rawCustomerValue ?? 0) as number;
  const totalSignups = monthlySignups * 12;
  const rawB = (rowB?.rawCustomerValue ?? 0) as number;
  const fraudPctCurrent = rawB <= 1 && rawB >= 0 ? rawB * 100 : rawB;
  const fraudPctForter = (rowB?.rawForterValue ?? 0) as number;
  const dupsCurrent = (rowC?.rawCustomerValue ?? 0) as number;
  const dupsForter = (rowC?.rawForterValue ?? 0) as number;
  const dupsBlocked = dupsCurrent - dupsForter;
  // Pill matches "Percent of fraudulent sign-ups" Forter improvement (row B): relative reduction e.g. 95%
  const improvementStr = rowB?.forterImprovement;
  const improvementNum = improvementStr != null ? parseFloat(String(improvementStr).replace(/[^0-9.-]/g, '')) : NaN;
  const reductionPct = Number.isFinite(improvementNum) ? Math.round(Math.abs(improvementNum)) : (fraudPctCurrent > 0 ? Math.round(((fraudPctCurrent - fraudPctForter) / fraudPctCurrent) * 100) : 0);
  const bonusValue = (rowD?.rawCustomerValue ?? 0) as number;
  const fraudDotsCount = Math.round(fraudPctCurrent);
  const forterDotsCount = Math.round(fraudPctForter);
  const blockedDotsCount = Math.min(100, Math.max(0, fraudDotsCount - forterDotsCount));
  const residualDotsCount = Math.min(100, forterDotsCount);
  const dots = Array.from({ length: 100 }, (_, i) => i);
  return (
    <div className="flex gap-6 items-start">
      {/* Left — Waffle/population grids */}
      <div className="flex-1 min-w-0 md:border-r md:border-border/60 md:pr-6">
        <h4 className="text-sm font-semibold text-muted-foreground mb-3">Your signup population — fraudulent accounts highlighted</h4>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Today</p>
            <div className="grid grid-cols-10 gap-1">
              {dots.map((i) => (
                <div key={i} className={cn('w-5 h-5 rounded-full', i < fraudDotsCount ? 'bg-red-400' : 'bg-slate-200')} />
              ))}
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                Fraudulent ({fraudPctCurrent.toFixed(1)}%)
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-slate-200" />
                Legitimate
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">With Forter</p>
            <div className="grid grid-cols-10 gap-1">
              {dots.map((i) => {
                let bg = 'bg-slate-200';
                if (i < residualDotsCount) bg = 'bg-amber-300';
                else if (i < residualDotsCount + blockedDotsCount) bg = 'bg-green-400';
                return <div key={i} className={cn('w-5 h-5 rounded-full', bg)} />;
              })}
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-400" />
                Blocked by Forter
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-amber-300" />
                Residual ({fraudPctForter.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
        <div className="flex justify-center mt-3">
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            {reductionPct}% reduction in unwanted duplicate accounts
          </Badge>
        </div>
      </div>
      {/* Right — Value Impact cards */}
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <p className="text-sm font-semibold text-muted-foreground mb-3">Value Impact</p>
        <Card className="rounded-lg border p-4 flex flex-row gap-3 items-center h-24 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700">
          <Ban className="w-6 h-6 shrink-0 text-slate-500" />
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="text-slate-700 dark:text-slate-300 font-bold text-xl">{(rowC?.forterImprovement != null ? (() => { const n = parseInt(String(rowC.forterImprovement).replace(/[^0-9-]/g, ''), 10); return Number.isFinite(n) ? Math.abs(n) : dupsBlocked; })() : dupsBlocked).toLocaleString('en-US')}</div>
            <div className="text-xs text-muted-foreground">duplicate accounts blocked</div>
          </div>
        </Card>
        <Card className="rounded-lg border p-4 flex flex-row gap-3 items-center h-24 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <BadgeDollarSign className="w-6 h-6 shrink-0 text-amber-500" />
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="text-amber-700 dark:text-amber-300 font-bold text-xl">{rowD?.customerInput ?? '—'}</div>
            <div className="text-xs text-muted-foreground">avg bonus paid per fake signup</div>
          </div>
        </Card>
        <Card className="rounded-lg border p-4 flex flex-row gap-3 items-center h-24 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
          <TrendingUp className="w-6 h-6 shrink-0 text-green-600 dark:text-green-400" />
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="text-green-700 dark:text-green-300 font-bold text-2xl">{rowE?.forterImprovement ?? '—'}</div>
            <div className="text-xs text-muted-foreground">marketing budget protected</div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/** Visual tab content for c14-reactivation: multiplication chain + Value Impact cards */
export function ReactivationVisual({ rows, showInMillions, currencyCode, forReportCapture }: { rows: CalculatorRow[]; showInMillions: boolean; currencyCode: string; forReportCapture?: boolean }) {
  const rowA = rows.find((r) => r.formula === 'a');
  const rowB = rows.find((r) => r.formula === 'b');
  const rowC = rows.find((r) => r.formula === 'c' || r.formula?.startsWith('c ='));
  const rowD = rows.find((r) => r.formula === 'd');
  const rowE = rows.find((r) => r.formula === 'e');
  const rowF = rows.find((r) => (r.formula === 'f' || r.formula?.startsWith('f =')) && r.valueDriver === 'cost');

  const parseNum = (raw: number | undefined, display: string | undefined): number => {
    if (raw !== undefined && raw !== 0) return Number(raw);
    if (!display) return 0;
    const cleaned = String(display).replace(/[^0-9.-]/g, '');
    return parseFloat(cleaned) || 0;
  };

  const dupsCurrent = parseNum(rowC?.rawCustomerValue as number | undefined, rowC?.customerInput);
  const dupsForter = parseNum(rowC?.rawForterValue as number | undefined, rowC?.forterOutcome);
  const dupsBlocked = dupsCurrent - dupsForter;
  const commsPerYear = parseNum(rowD?.rawCustomerValue as number | undefined, rowD?.customerInput);
  const wastedCommsTotal = dupsCurrent * commsPerYear;
  const wastedCommsSaved = dupsBlocked * commsPerYear;

  const boxClass = forReportCapture
    ? "min-w-[11rem] w-44 h-36 flex-shrink-0 flex flex-col justify-between p-4 rounded-xl border-2 text-base"
    : "w-36 min-w-[9rem] h-28 flex-shrink-0 flex flex-col justify-between p-3 rounded-lg border";
  const connectorClass = forReportCapture
    ? "rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-base font-bold self-center shrink-0"
    : "rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1 text-sm font-bold self-center shrink-0";
  const numClass = forReportCapture ? "text-2xl" : "text-xl";
  const numClassLg = forReportCapture ? "text-3xl" : "text-2xl";
  const cardMinH = forReportCapture ? "min-h-[7rem]" : "min-h-[5rem]";
  const iconSize = forReportCapture ? "w-8 h-8" : "w-6 h-6";

  return (
    <div className={cn("flex gap-6 h-full", forReportCapture ? "flex-row items-stretch min-h-0" : "flex-col justify-between items-start")}>
      <div className={cn("min-w-0 md:border-r md:border-border/60 md:pr-6 flex flex-col", forReportCapture ? "flex-1 justify-center" : "flex-1")}>
        <h4 className={cn("font-semibold text-muted-foreground", forReportCapture ? "text-base mb-5" : "text-sm mb-3")}>How re-activation waste is calculated</h4>
        <div className="flex items-stretch gap-3 flex-wrap">
          <div className={cn(boxClass, "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700")}>
            <span className={cn("text-muted-foreground", forReportCapture ? "text-sm" : "text-xs")}>Fake accounts today</span>
            <span className={cn("font-bold text-slate-700 dark:text-slate-300", numClass)}>{rowC?.customerInput ?? '—'}</span>
            <span className={cn("text-muted-foreground", forReportCapture ? "text-sm" : "text-xs")}>→ {rowC?.forterOutcome ?? '—'} with Forter</span>
          </div>
          <span className={connectorClass}>×</span>
          <div className={cn(boxClass, "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700")}>
            <span className={cn("text-muted-foreground", forReportCapture ? "text-sm" : "text-xs")}>Comms per year</span>
            <span className={cn("font-bold text-slate-700 dark:text-slate-300", numClass)}>{rowD?.customerInput ?? '—'}</span>
            <span className={cn("text-muted-foreground", forReportCapture ? "text-sm" : "text-xs")}>emails / SMS per account</span>
          </div>
          <span className={connectorClass}>×</span>
          <div className={cn(boxClass, "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800")}>
            <span className={cn("text-muted-foreground", forReportCapture ? "text-sm" : "text-xs")}>Cost per outreach</span>
            <span className={cn("font-bold text-amber-700 dark:text-amber-300", numClass)}>{rowE?.customerInput ?? '—'}</span>
            <span className={cn("text-muted-foreground", forReportCapture ? "text-sm" : "text-xs")}>per email / SMS</span>
          </div>
          <span className={connectorClass}>=</span>
          <div className={cn(boxClass, "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800")}>
            <span className={cn("text-muted-foreground", forReportCapture ? "text-sm" : "text-xs")}>Wasted annually (today)</span>
            <span className={cn("font-bold text-red-600 dark:text-red-400", numClass)}>{rowF?.customerInput ?? '—'}</span>
            <span className={cn("text-muted-foreground", forReportCapture ? "text-sm" : "text-xs")}>spent on fake accounts</span>
          </div>
        </div>
        <div className={cn("flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg", forReportCapture ? "mt-6 py-4" : "mt-4")}>
          <TrendingUp className={cn("text-green-600 dark:text-green-400 shrink-0", iconSize)} />
          <div>
            <p className={cn("font-bold text-green-800 dark:text-green-300", forReportCapture ? "text-base" : "text-sm")}>95% of fake accounts eliminated</p>
          </div>
        </div>
      </div>
      <div className={cn("flex flex-col min-w-0 flex-1", forReportCapture ? "justify-center gap-4" : "gap-3")}>
        <p className={cn("font-semibold text-muted-foreground", forReportCapture ? "text-base mb-1" : "text-sm mb-0")}>Value Impact</p>
        <div className={cn("grid grid-cols-1 sm:grid-cols-3", forReportCapture ? "gap-4 flex-1 content-center" : "gap-3")}>
          <Card className={cn("rounded-lg border p-4 flex flex-row gap-3 items-center bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700", cardMinH, forReportCapture && "p-5")}>
            <Ban className={cn("shrink-0 text-slate-500", iconSize)} />
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className={cn("text-slate-700 dark:text-slate-300 font-bold", numClass)}>
                {dupsBlocked > 0 ? dupsBlocked.toLocaleString('en-US') : (rowC?.forterImprovement ?? '—')}
              </div>
              <div className={forReportCapture ? "text-sm text-muted-foreground" : "text-xs text-muted-foreground"}>fake accounts eliminated</div>
            </div>
          </Card>
          <Card className={cn("rounded-lg border p-4 flex flex-row gap-3 items-center bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800", cardMinH, forReportCapture && "p-5")}>
            <Mail className={cn("shrink-0 text-amber-500", iconSize)} />
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className={cn("text-amber-700 dark:text-amber-300 font-bold", numClass)}>
                {wastedCommsSaved > 0 ? wastedCommsSaved.toLocaleString('en-US') : `~${dupsBlocked.toLocaleString('en-US')} × ${rowD?.customerInput ?? '—'}`}
              </div>
              <div className={forReportCapture ? "text-sm text-muted-foreground" : "text-xs text-muted-foreground"}>outreach messages eliminated</div>
            </div>
          </Card>
          <Card className={cn("rounded-lg border p-4 flex flex-row gap-3 items-center bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800", cardMinH, forReportCapture && "p-5")}>
            <TrendingUp className={cn("shrink-0 text-green-600 dark:text-green-400", iconSize)} />
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className={cn("text-green-700 dark:text-green-300 font-bold", numClassLg)}>{rowF?.forterImprovement ?? '—'}</div>
              <div className={forReportCapture ? "text-sm text-muted-foreground" : "text-xs text-muted-foreground"}>re-activation spend saved</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Visual tab content for c14-kyc: KYC funnel + Value Impact cards */
export function KYCVisual({ rows, showInMillions, currencyCode }: { rows: CalculatorRow[]; showInMillions: boolean; currencyCode: string }) {
  const rowA = rows.find((r) => r.formula === 'a');
  const rowB = rows.find((r) => r.formula === 'b');
  const rowC = rows.find((r) => r.formula === 'c' || r.formula?.startsWith('c ='));
  const rowD = rows.find((r) => r.formula === 'd');
  const rowE = rows.find((r) => (r.formula === 'e' || r.formula?.startsWith('e =')) && r.valueDriver === 'cost');

  const parseNum = (raw: number | undefined, display: string | undefined): number => {
    if (raw !== undefined && raw !== 0) return Number(raw);
    if (!display) return 0;
    return parseFloat(String(display).replace(/[^0-9.-]/g, '')) || 0;
  };

  const totalSignups = parseNum(rowA?.rawCustomerValue as number | undefined, rowA?.customerInput);
  const kycPctCurrent = parseNum(rowB?.rawCustomerValue as number | undefined, rowB?.customerInput);
  const kycPctForter = parseNum(rowB?.rawForterValue as number | undefined, rowB?.forterOutcome);
  const checksCurrent = parseNum(rowC?.rawCustomerValue as number | undefined, rowC?.customerInput);
  const checksForter = parseNum(rowC?.rawForterValue as number | undefined, rowC?.forterOutcome);
  const checksElim = checksCurrent - checksForter;
  const reductionPct = kycPctCurrent > 0 ? Math.round((1 - kycPctForter / kycPctCurrent) * 100) : 0;

  const heightToday = Math.max((kycPctCurrent / 100) * 220, 56);
  const heightForter = Math.max((kycPctForter / 100) * 220, 56);
  const clipPath = 'polygon(10% 0%, 90% 0%, 75% 100%, 25% 100%)';

  return (
    <div className="grid grid-cols-2 gap-6 items-start h-full">
      <div className="min-w-0 md:border-r md:border-border/60 md:pr-6 flex flex-col justify-between">
        <h4 className="text-sm font-semibold text-muted-foreground mb-0">Accounts routed to KYC screening</h4>
        <div className="grid grid-cols-2 gap-6 items-end mt-4">
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm font-semibold text-center">Today</p>
            <div className="w-full max-w-[220px] mx-auto relative" style={{ height: `${heightToday}px` }}>
              <div className="absolute inset-0 bg-red-300 rounded-sm flex flex-col items-center justify-center" style={{ clipPath }}>
                <span className="font-bold text-white text-2xl">{kycPctCurrent.toFixed(0)}%</span>
                <span className="text-white text-sm opacity-80">screened</span>
              </div>
            </div>
            <p className="text-red-600 dark:text-red-400 font-semibold">{checksCurrent.toLocaleString('en-US')} checks</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm font-semibold text-center">With Forter</p>
            <div className="w-full max-w-[220px] mx-auto relative" style={{ height: `${heightForter}px` }}>
              <div className="absolute inset-0 bg-green-400 rounded-sm flex flex-col items-center justify-center" style={{ clipPath }}>
                <span className="font-bold text-white text-2xl">{kycPctForter.toFixed(0)}%</span>
                <span className="text-white text-sm opacity-80">screened</span>
              </div>
            </div>
            <p className="text-green-700 dark:text-green-400 font-semibold">{checksForter.toLocaleString('en-US')} checks</p>
          </div>
        </div>
        <div className="col-span-2 flex justify-center mt-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300 rounded-full text-sm font-medium">
            {checksElim.toLocaleString('en-US')} unnecessary KYC checks eliminated ({reductionPct}% reduction)
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-2">
          {checksElim.toLocaleString('en-US')} checks × {rowD?.customerInput ?? '—'} per check = {rowE?.forterImprovement ?? '—'} saved
        </p>
      </div>
      <div className="min-w-0 flex flex-col gap-3">
        <p className="text-sm font-semibold text-muted-foreground mb-3">Value Impact</p>
        <Card className="rounded-lg border p-4 flex flex-row gap-3 items-center h-24 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700">
          <UserCheck className="w-6 h-6 shrink-0 text-slate-500" />
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="text-slate-700 dark:text-slate-300 font-bold text-xl">{kycPctCurrent.toFixed(0)}% → {kycPctForter.toFixed(0)}%</div>
            <div className="text-xs text-muted-foreground">accounts requiring KYC</div>
          </div>
        </Card>
        <Card className="rounded-lg border p-4 flex flex-row gap-3 items-center h-24 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
          <ClipboardList className="w-6 h-6 shrink-0 text-red-400" />
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="text-red-700 dark:text-red-300 font-bold text-xl">{checksElim > 0 ? checksElim.toLocaleString('en-US') : (rowC?.forterImprovement ?? '—')}</div>
            <div className="text-xs text-muted-foreground">KYC checks eliminated</div>
          </div>
        </Card>
        <Card className="rounded-lg border p-4 flex flex-row gap-3 items-center h-24 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
          <TrendingUp className="w-6 h-6 shrink-0 text-green-600 dark:text-green-400" />
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="text-green-700 dark:text-green-300 font-bold text-2xl">{rowE?.forterImprovement ?? '—'}</div>
            <div className="text-xs text-muted-foreground">annual KYC spend saved</div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/** Visual tab content for c3-review: Two cards Current / With Forter + badge */
export function ManualReviewVisual({ rows, showInMillions, currencyCode, forReportCapture }: { rows: CalculatorRow[]; showInMillions: boolean; currencyCode: string; forReportCapture?: boolean }) {
  const matchFormula = (formulaId: string) => rows.find((r) => r.formula === formulaId || r.formula?.startsWith(`${formulaId} `) || r.formula?.startsWith(`${formulaId}=`));
  const reviewPctRow = matchFormula('b');
  const reviewCountRow = matchFormula('c');
  const hoursRow = matchFormula('e');
  const hourlyRow = matchFormula('f');
  const costRow = matchFormula('g');
  const custReviewPct = (reviewPctRow?.rawCustomerValue ?? 0) as number;
  const fortReviewPct = (reviewPctRow?.rawForterValue ?? 0) as number;
  const reviewDecreasePct = custReviewPct > 0 ? Math.round(((custReviewPct - fortReviewPct) / custReviewPct) * 100) : 0;
  const LineItem = ({ label, current, forter, formula }: { label: string; current: string; forter: string; formula?: string }) => (
    <div className="flex justify-between items-center gap-6 py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">
        {label}
        {formula != null && <span className="block italic text-xs mt-0.5">{formula}</span>}
      </span>
      <span className="text-sm font-medium tabular-nums text-right min-w-[6rem]">{current || forter}</span>
    </div>
  );
  const cardClass = "p-4 border-slate-200 dark:border-slate-700 min-w-0";
  const cardClassGreen = "p-4 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20 min-w-0";
  if (forReportCapture) {
    return (
      <div className="w-full h-full flex flex-col justify-center">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1.5rem', alignItems: 'stretch', width: '100%', minHeight: 320 }}>
          <Card className={cardClass}>
            <div className="text-sm font-semibold text-muted-foreground mb-3">Current state</div>
            <LineItem label="Review rate" current={reviewPctRow?.customerInput ?? '—'} forter="" />
            <LineItem label="Reviews per year" current={reviewCountRow?.customerInput ?? '—'} forter="" />
            <LineItem label="Total review hours" current={hoursRow?.customerInput ?? '—'} forter="" />
            <LineItem label="Hourly cost per reviewer" current={hourlyRow?.customerInput ?? '—'} forter="" />
            <LineItem label="Total annual review cost" current={costRow?.customerInput ?? '—'} forter="" />
          </Card>
          <div className="flex flex-col items-center justify-center gap-1 shrink-0">
            <ArrowRight className="w-6 h-6 text-muted-foreground" aria-hidden />
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">{reviewDecreasePct}% review rate reduction</Badge>
          </div>
          <Card className={cardClassGreen}>
            <div className="text-sm font-semibold text-muted-foreground mb-3">With Forter</div>
            <LineItem label="Review rate" current="" forter={reviewPctRow?.forterOutcome ?? '—'} />
            <LineItem label="Reviews per year" current="" forter={reviewCountRow?.forterOutcome ?? '—'} />
            <LineItem label="Total review hours" current="" forter={hoursRow?.forterOutcome ?? '—'} />
            <LineItem label="Hourly cost per reviewer" current="" forter={hourlyRow?.forterOutcome ?? '—'} />
            <LineItem label="Total annual review cost" current="" forter={costRow?.forterOutcome ?? '—'} />
          </Card>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6 h-full flex flex-col justify-center">
      <div className="flex flex-wrap items-stretch gap-4 justify-center">
        <Card className="p-4 min-w-[300px] border-slate-200 dark:border-slate-700">
          <div className="text-sm font-semibold text-muted-foreground mb-3">Current state</div>
          <LineItem label="Review rate" current={reviewPctRow?.customerInput ?? '—'} forter="" />
          <LineItem label="Reviews per year" current={reviewCountRow?.customerInput ?? '—'} forter="" />
          <LineItem label="Total review hours" current={hoursRow?.customerInput ?? '—'} forter="" />
          <LineItem label="Hourly cost per reviewer" current={hourlyRow?.customerInput ?? '—'} forter="" />
          <LineItem label="Total annual review cost" current={costRow?.customerInput ?? '—'} forter="" />
        </Card>
        <div className="flex flex-col items-center justify-center gap-1">
          <ArrowRight className="w-6 h-6 text-muted-foreground" aria-hidden />
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">{reviewDecreasePct}% review rate reduction</Badge>
        </div>
        <Card className="p-4 min-w-[300px] border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
          <div className="text-sm font-semibold text-muted-foreground mb-3">With Forter</div>
          <LineItem label="Review rate" current="" forter={reviewPctRow?.forterOutcome ?? '—'} />
          <LineItem label="Reviews per year" current="" forter={reviewCountRow?.forterOutcome ?? '—'} />
          <LineItem label="Total review hours" current="" forter={hoursRow?.forterOutcome ?? '—'} />
          <LineItem label="Hourly cost per reviewer" current="" forter={hourlyRow?.forterOutcome ?? '—'} />
          <LineItem label="Total annual review cost" current="" forter={costRow?.forterOutcome ?? '—'} />
        </Card>
      </div>
    </div>
  );
}

/** Visual tab content for c7-opex: Improve recovery efficiency — two cards Current / With Forter */
export function DisputeOpExVisual({ rows, showInMillions, currencyCode, forReportCapture }: { rows: CalculatorRow[]; showInMillions: boolean; currencyCode: string; forReportCapture?: boolean }) {
  const matchFormula = (formulaId: string) => rows.find((r) => r.formula === formulaId || r.formula?.startsWith(`${formulaId} `) || r.formula?.startsWith(`${formulaId}=`));
  const timeRow = matchFormula('a');
  const reviewsPerHourRow = matchFormula('b');
  const disputesRow = matchFormula('c');
  const hoursRow = matchFormula('d');
  const hourlyRow = matchFormula('e');
  const costRow = matchFormula('f');
  const custTime = (timeRow?.rawCustomerValue ?? 0) as number;
  const fortTime = (timeRow?.rawForterValue ?? 0) as number;
  const timeReductionPct = custTime > 0 ? Math.round(((custTime - fortTime) / custTime) * 100) : 0;
  const LineItem = ({ label, current, forter }: { label: string; current: string; forter: string }) => (
    <div className="flex justify-between items-center gap-6 py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium tabular-nums text-right min-w-[6rem]">{current || forter}</span>
    </div>
  );
  const gridStyle: React.CSSProperties = forReportCapture
    ? { display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1.5rem', alignItems: 'stretch', width: '100%', minHeight: 320, minWidth: 0 }
    : { display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1rem', alignItems: 'stretch', maxWidth: '56rem', margin: '0 auto', minWidth: 0 };
  return (
    <div className="space-y-6 h-full flex flex-col justify-center">
      <div style={gridStyle}>
        <Card className="p-4 min-w-0 border-slate-200 dark:border-slate-700">
          <div className="text-sm font-semibold text-muted-foreground mb-3">Current state</div>
          <LineItem label="Avg time to review CB (mins)" current={timeRow?.customerInput ?? '—'} forter="" />
          <LineItem label="# of reviews per hour" current={reviewsPerHourRow?.customerInput ?? '—'} forter="" />
          <LineItem label="Number of annual CB disputes" current={disputesRow?.customerInput ?? '—'} forter="" />
          <LineItem label="# of hours required for all chargebacks" current={hoursRow?.customerInput ?? '—'} forter="" />
          <LineItem label="Cost per hour of analyst" current={hourlyRow?.customerInput ?? '—'} forter="" />
          <LineItem label="Total cost" current={costRow?.customerInput ?? '—'} forter="" />
        </Card>
        <div className="flex flex-col items-center justify-center gap-1 shrink-0">
          <ArrowRight className="w-6 h-6 text-muted-foreground" aria-hidden />
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">{timeReductionPct}% faster review time</Badge>
        </div>
        <Card className="p-4 min-w-0 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
          <div className="text-sm font-semibold text-muted-foreground mb-3">With Forter</div>
          <LineItem label="Avg time to review CB (mins)" current="" forter={timeRow?.forterOutcome ?? '—'} />
          <LineItem label="# of reviews per hour" current="" forter={reviewsPerHourRow?.forterOutcome ?? '—'} />
          <LineItem label="Number of annual CB disputes" current="" forter={disputesRow?.forterOutcome ?? '—'} />
          <LineItem label="# of hours required for all chargebacks" current="" forter={hoursRow?.forterOutcome ?? '—'} />
          <LineItem label="Cost per hour of analyst" current="" forter={hourlyRow?.forterOutcome ?? '—'} />
          <LineItem label="Total cost" current="" forter={costRow?.forterOutcome ?? '—'} />
        </Card>
      </div>
    </div>
  );
}

/** Visual tab content for c8-returns: 3-column layout — egregious | non-egregious | value cards */
export function ReturnsAbuseVisual({ rows, showInMillions, currencyCode }: { rows: CalculatorRow[]; showInMillions: boolean; currencyCode: string }) {
  const rowG = rows.find((r) => r.label?.toLowerCase().includes('egregious returns abusers') && r.label?.toLowerCase().includes('# of egr'));
  const rowR = rows.find((r) => r.label?.toLowerCase().includes('non-egregious returns abusers') && r.label?.toLowerCase().includes('# of non'));
  // Net economic loss segments from exact calculator line items
  const rowI = rows.find((r) => r.label?.includes('Cost of goods sold') && r.formula?.startsWith('i'));
  const rowK = rows.find((r) => r.label?.includes('shipping') && r.label?.includes('merchant liability') && r.formula?.startsWith('k'));
  const rowL = rows.find((r) => r.label?.includes('fulfilment') && r.label?.includes('warehouse') && r.formula?.startsWith('l'));
  const rowM = rows.find((r) => r.label?.includes('TX processing fees') && r.formula?.startsWith('m'));
  const rowN = rows.find((r) => r.formula?.startsWith('n') && (r.label?.includes('Indirect: Lost commission profit') || r.label?.includes('Indirect: Lost profit due to inventory loss')));
  const rowO = rows.find((r) => r.formula?.startsWith('o ='));
  const rowP = rows.find((r) => r.formula?.startsWith('p ='));
  const rowS = rows.find((r) => r.label?.includes('Cost of goods sold') && r.formula === 's');
  const rowU = rows.find((r) => r.label?.includes('Inventory recouped'));
  const rowV = rows.find((r) => r.label?.includes('shipping') && r.label?.includes('merchant liability') && r.formula === 'v');
  const rowW = rows.find((r) => r.label?.includes('fulfilment') && r.label?.includes('warehouse') && r.formula === 'w');
  const rowX = rows.find((r) => r.label?.includes('TX processing fees') && r.formula === 'x');
  const rowY = rows.find((r) => r.formula === 'y' && (r.label?.includes('Indirect: Lost commission profit') || r.label?.includes('Indirect: Lost profit due to inventory loss')));
  const rowZ = rows.find((r) => r.formula?.startsWith('z ='));
  const rowAA = rows.find((r) => r.formula?.startsWith('aa ='));
  const rowAB = rows.find((r) => r.formula?.startsWith('ab ='));
  const rowE = rows.find((r) => r.formula === 'e = c*d' || r.formula?.startsWith('e ='));
  const rowF = rows.find((r) => r.formula === 'f');
  const rowQ = rows.find((r) => r.formula === 'q');
  const aovLabel = rowE?.customerInput ?? rowE?.forterOutcome ?? '—';
  const netEconomicLossTitle = `Net economic loss per abusive transaction (${aovLabel} AoV)`;

  const toNum = (s: string | undefined): number => {
    if (!s) return 0;
    const trimmed = s.trim();
    if (trimmed === '' || trimmed === '-' || trimmed === '—') return 0;
    const stripped = trimmed
      .replace(/[£$€]/g, '')
      .replace(/,/g, '')
      .replace(/\s/g, '')
      .replace(/[()]/g, '');
    const n = parseFloat(stripped);
    return isNaN(n) ? 0 : Math.abs(n);
  };

  const getCustomer = (row: typeof rowG) =>
    (row?.rawCustomerValue !== undefined && row.rawCustomerValue !== null && row.rawCustomerValue !== 0)
      ? Math.abs(row.rawCustomerValue as number)
      : toNum(row?.customerInput);

  const getForter = (row: typeof rowG) =>
    (row?.rawForterValue !== undefined && row.rawForterValue !== null && row.rawForterValue !== 0)
      ? Math.abs(row.rawForterValue as number)
      : toNum(row?.forterOutcome);

  // Unit costs — use displayed value for 2-way shipping (row stores one-way as rawCustomerValue but table shows twoWayShipping)
  const egr_cogs = getCustomer(rowI);
  const egr_shipping = toNum(rowK?.customerInput) || getCustomer(rowK);
  const egr_fulfilment = getCustomer(rowL);
  const egr_txFees = getCustomer(rowM);
  const egr_inventory = getCustomer(rowN);

  const non_cogs = getCustomer(rowS);
  const non_shipping = toNum(rowV?.customerInput) || getCustomer(rowV);
  const non_fulfilment = getCustomer(rowW);
  const non_txFees = getCustomer(rowX);
  const non_recouped = getCustomer(rowU);
  // COGS bar shows net COGS after inventory recouped (add back recouped into COGS segment); lost margin shows full indirect
  const non_cogs_net = Math.max(0, non_cogs - non_recouped);
  const non_inventory = getCustomer(rowY);

  // Parse plain integer strings like "2,748" by removing commas only
  const parseCount = (s: string | undefined): number => {
    if (!s) return 0;
    return parseInt(s.replace(/,/g, ''), 10) || 0;
  };

  const egrCurrent = parseCount(rowG?.customerInput);
  const egrForter = parseCount(rowG?.forterOutcome);
  const nonEgrCurrent = parseCount(rowR?.customerInput);
  const nonEgrForter = parseCount(rowR?.forterOutcome);

  const egrBlocked = egrCurrent - egrForter;
  const nonEgrBlocked = nonEgrCurrent - nonEgrForter;
  const totalBlockedFinal = egrBlocked + nonEgrBlocked;
  const totalBlockedDisplay = totalBlockedFinal.toLocaleString('en-US');

  // Weighted average cost per abuser
  const egrUnitCost = getCustomer(rowO);
  const nonEgrUnitCost = getCustomer(rowZ);
  const weightedAvg = totalBlockedFinal > 0
    ? (egrBlocked * egrUnitCost + nonEgrBlocked * nonEgrUnitCost) / totalBlockedFinal
    : 0;

  const sym = getCurrencySymbol(currencyCode);
  const fmtCur = (v: number) => `${sym}${Math.round(Math.abs(v)).toLocaleString('en-US')}`;

  const egrTotal = egr_cogs + egr_shipping + egr_fulfilment + egr_txFees + egr_inventory;
  const nonTotal = non_cogs_net + non_shipping + non_fulfilment + non_txFees + non_inventory;
  const costChartMax = Math.max(egrTotal + 1, nonTotal + 1, 1);
  // Nice Y-axis: round max up to even step and generate even tick values
  const getNiceCostScale = (max: number) => {
    if (max <= 0) return { niceMax: 100, ticks: [0, 25, 50, 75, 100] };
    let step = 25;
    if (max > 1000) step = 200;
    else if (max > 500) step = 100;
    else if (max > 200) step = 50;
    else if (max > 100) step = 25;
    else if (max > 50) step = 20;
    else if (max > 20) step = 10;
    const niceMax = Math.ceil(max / step) * step;
    const ticks: number[] = [];
    for (let t = 0; t <= niceMax; t += step) ticks.push(t);
    return { niceMax, ticks };
  };
  const costScale = getNiceCostScale(costChartMax);

  const egrVolumeData = [
    { name: 'Today', value: egrCurrent, fill: '#94a3b8' },
    { name: 'With Forter', value: egrForter, fill: '#22c55e' },
  ];
  const egrCostData = [{ name: 'Cost per abuser', cogs: egr_cogs, shipping: egr_shipping, fulfilment: egr_fulfilment, txFees: egr_txFees, divider: 1, inventory: egr_inventory }];

  const nonVolumeData = [
    { name: 'Today', value: nonEgrCurrent, fill: '#94a3b8' },
    { name: 'With Forter', value: nonEgrForter, fill: '#22c55e' },
  ];
  const nonCostData = [{ name: 'Cost per abuser', cogs: non_cogs_net, shipping: non_shipping, fulfilment: non_fulfilment, txFees: non_txFees, divider: 1, inventory: non_inventory }];

  const totalVolumeCurrent = egrCurrent + nonEgrCurrent;
  const reductionPct = totalVolumeCurrent > 0 ? Math.round((totalBlockedFinal / totalVolumeCurrent) * 100) : 0;
  const nonEgrReductionPct = nonEgrCurrent > 0 ? Math.round((nonEgrBlocked / nonEgrCurrent) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg mb-3 text-xs text-amber-800 dark:text-amber-200">
        <Info className="w-3 h-3 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <span>
          <strong>Refund excluded.</strong> Refund offsets against revenue received (net = £0). Only COGS, shipping, fulfilment, TX fees and lost margin represent true economic loss.
        </span>
      </div>

      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0 space-y-1 pr-4 border-r border-border">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">Egregious abuser transactions</p>
            <div className="flex flex-col items-end gap-0.5">
              <span className="px-2 py-0.5 bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300 rounded-full text-xs font-semibold whitespace-nowrap">
                {egrBlocked.toLocaleString('en-US')} blocked
              </span>
              <span className="text-xs text-green-700 dark:text-green-300 font-medium pr-1">
                {rowP?.forterImprovement ?? '—'} protected
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={egrVolumeData} margin={{ top: 20, right: 16, left: 16, bottom: 4 }} barCategoryGap="70%">
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: 'hsl(var(--foreground))' }} />
              <YAxis hide />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {egrVolumeData.map((e, i) => (
                  <Cell key={i} fill={e.fill} />
                ))}
                <LabelList dataKey="value" position="top" content={(props: { x?: number; y?: number; width?: number; value?: number }) => {
                  const { x, y, width, value } = props;
                  return (
                    <text x={Number(x) + Number(width) / 2} y={Number(y) - 4} textAnchor="middle" fontSize={11} fontWeight={600} fill={value === egrForter ? '#16a34a' : '#475569'}>
                      {Number(value ?? 0).toLocaleString('en-US')}
                    </text>
                  );
                }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs font-semibold text-muted-foreground">{netEconomicLossTitle}</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={egrCostData} margin={{ top: 16, right: 72, left: 8, bottom: 4 }} barCategoryGap="65%">
              <YAxis domain={[0, costScale.niceMax]} ticks={costScale.ticks} tickFormatter={(v) => `${sym}${v}`} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} width={32} />
              <XAxis hide />
              <RechartsTooltip formatter={(value: number, name: string, item: { dataKey?: string }) => { if (item?.dataKey === 'divider' || value == null) return null; return [fmtCur(value), name]; }} contentStyle={{ fontSize: 12 }} itemStyle={{ fontSize: 12 }} />
              <Bar dataKey="cogs" stackId="a" fill="#1e293b" name="COGS" />
              <Bar dataKey="shipping" stackId="a" fill="#475569" name="Shipping" />
              <Bar dataKey="fulfilment" stackId="a" fill="#64748b" name="Fulfilment" />
              <Bar dataKey="txFees" stackId="a" fill="#94a3b8" name="TX Fees" />
              <Bar dataKey="divider" stackId="a" fill="white" legendType="none" isAnimationActive={false} />
              <Bar dataKey="inventory" stackId="a" fill="#fca5a5" name="Lost margin (indirect) †" radius={[3, 3, 0, 0]}>
                <LabelList dataKey="inventory" position="top" content={(props: { x?: number; y?: number; width?: number }) => {
                  const { x, y, width } = props;
                  return (
                    <text x={Number(x) + Number(width) / 2} y={Number(y) - 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="hsl(var(--foreground))">
                      {fmtCur(egrTotal)}
                    </text>
                  );
                }} />
              </Bar>
              <Legend align="right" verticalAlign="middle" layout="vertical" iconSize={8} wrapperStyle={{ fontSize: 9 }} content={(props) => <DefaultLegendContent {...props} payload={[...(props.payload ?? [])].reverse()} />} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-1 italic">
            † Lost margin is an indirect cost — inventory lost to abusers reduces future selling capacity, not a direct cash outflow at point of return.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Estimated abuse benchmark for egregious cohort: {rowF?.customerInput ?? '—'} of returns claims
          </p>
        </div>

        <div className="flex-1 min-w-0 space-y-1 pl-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">Non-egregious abuser transactions</p>
            <div className="flex flex-col items-end gap-0.5">
              <span className="px-2 py-0.5 bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300 rounded-full text-xs font-semibold whitespace-nowrap">
                {nonEgrBlocked.toLocaleString('en-US')} captured
              </span>
              <span className="text-xs text-green-700 dark:text-green-300 font-medium pr-1">
                {rowAA?.forterImprovement ?? '—'} protected
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={nonVolumeData} margin={{ top: 20, right: 16, left: 16, bottom: 4 }} barCategoryGap="70%">
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: 'hsl(var(--foreground))' }} />
              <YAxis hide />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {nonVolumeData.map((e, i) => (
                  <Cell key={i} fill={e.fill} />
                ))}
                <LabelList dataKey="value" position="top" content={(props: { x?: number; y?: number; width?: number; value?: number }) => {
                  const { x, y, width, value } = props;
                  return (
                    <text x={Number(x) + Number(width) / 2} y={Number(y) - 4} textAnchor="middle" fontSize={11} fontWeight={600} fill={value === nonEgrForter ? '#16a34a' : '#475569'}>
                      {Number(value ?? 0).toLocaleString('en-US')}
                    </text>
                  );
                }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs font-semibold text-muted-foreground">{netEconomicLossTitle}</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={nonCostData} margin={{ top: 16, right: 72, left: 8, bottom: 4 }} barCategoryGap="65%">
              <YAxis domain={[0, costScale.niceMax]} ticks={costScale.ticks} tickFormatter={(v) => `${sym}${v}`} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} width={32} />
              <XAxis hide />
              <RechartsTooltip formatter={(value: number, name: string, item: { dataKey?: string }) => { if (item?.dataKey === 'divider' || value == null) return null; return [fmtCur(value), name]; }} contentStyle={{ fontSize: 12 }} itemStyle={{ fontSize: 12 }} />
              <Bar dataKey="cogs" stackId="a" fill="#1e293b" name="COGS" />
              <Bar dataKey="shipping" stackId="a" fill="#475569" name="Shipping" />
              <Bar dataKey="fulfilment" stackId="a" fill="#64748b" name="Fulfilment" />
              <Bar dataKey="txFees" stackId="a" fill="#94a3b8" name="TX Fees" />
              <Bar dataKey="divider" stackId="a" fill="white" legendType="none" isAnimationActive={false} />
              <Bar dataKey="inventory" stackId="a" fill="#fca5a5" name="Lost margin (indirect) †" radius={[3, 3, 0, 0]}>
                <LabelList dataKey="inventory" position="top" content={(props: { x?: number; y?: number; width?: number }) => {
                  const { x, y, width } = props;
                  return (
                    <text x={Number(x) + Number(width) / 2} y={Number(y) - 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="hsl(var(--foreground))">
                      {fmtCur(nonTotal)}
                    </text>
                  );
                }} />
              </Bar>
              <Legend align="right" verticalAlign="middle" layout="vertical" iconSize={8} wrapperStyle={{ fontSize: 9 }} content={(props) => <DefaultLegendContent {...props} payload={[...(props.payload ?? [])].reverse()} />} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-1 italic">
            † Lost margin is an indirect cost — inventory lost to abusers reduces future selling capacity, not a direct cash outflow at point of return.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Estimated abuse benchmark for non-egregious cohort: {rowQ?.customerInput ?? '—'} of returns claims
          </p>
        </div>

        <div className="w-48 shrink-0 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Value Impact (Totals)</p>
          <div className="flex flex-col gap-2">
            <Card className="rounded-lg border p-4 flex flex-col gap-0.5 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700">
              <Shield className="w-4 h-4 shrink-0 text-slate-400" />
              <div className="text-slate-700 dark:text-slate-300 font-bold text-2xl">{totalBlockedDisplay}</div>
              <div className="text-xs text-muted-foreground">{reductionPct}% of abusers captured</div>
            </Card>
            <Card className="rounded-lg border p-4 flex flex-col gap-0.5 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
              <BadgeDollarSign className="w-4 h-4 shrink-0 text-amber-400" />
              <div className="text-amber-700 dark:text-amber-300 font-bold text-2xl">{fmtCur(weightedAvg)}</div>
              <div className="text-xs text-muted-foreground">weighted avg. cost per abusive tx</div>
            </Card>
            <Card className="rounded-lg border p-4 flex flex-col gap-0.5 bg-green-100 dark:bg-green-950/30 border-green-300 dark:border-green-700">
              <TrendingUp className="w-4 h-4 shrink-0 text-green-500" />
              <div className="text-green-700 dark:text-green-300 font-bold text-3xl">{rowAB?.forterImprovement ?? '—'}</div>
              <div className="text-xs text-muted-foreground">total cost protected</div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Visual tab content for c8-inr: single section (INR abusers) + value impact column */
export function INRAbuseVisual({ rows, showInMillions, currencyCode }: { rows: CalculatorRow[]; showInMillions: boolean; currencyCode: string }) {
  const rowE = rows.find((r) => r.formula === 'e = c*d' || r.formula?.startsWith('e ='));
  const rowF = rows.find((r) => r.formula === 'f');
  const rowG = rows.find((r) => r.label?.toLowerCase().includes('inr abuser') || r.label?.toLowerCase().includes('estimated # of inr') || r.formula === 'g = a*f');
  const aovLabel = rowE?.customerInput ?? rowE?.forterOutcome ?? '—';
  const netEconomicLossTitle = `Net economic loss per abusive transaction (${aovLabel} AoV)`;
  // Net economic loss segments from exact calculator line items
  const rowI = rows.find((r) => r.label?.includes('Cost of goods sold') && (r.formula === 'i' || r.formula?.startsWith('i')));
  const rowK = rows.find((r) => r.label?.includes('shipping') && r.label?.includes('merchant liability') && (r.formula === 'k' || r.formula?.startsWith('k')));
  const rowL = rows.find((r) => r.label?.includes('fulfilment') && r.label?.includes('warehouse') && (r.formula === 'l' || r.formula?.startsWith('l')));
  const rowM = rows.find((r) => r.label?.includes('TX processing fees') && (r.formula === 'm' || r.formula?.startsWith('m')));
  const rowN = rows.find((r) => (r.formula === 'n' || r.formula?.startsWith('n')) && (r.label?.includes('Indirect: Lost commission profit') || r.label?.includes('Indirect: Lost profit due to inventory loss')));
  const rowO = rows.find((r) => r.label?.toLowerCase().includes('unit loss'));
  const rowP = rows.find((r) => r.label?.toLowerCase().includes('total loss') || r.valueDriver != null);

  const toNum = (s: string | undefined): number => {
    if (!s) return 0;
    const trimmed = s.trim();
    if (trimmed === '' || trimmed === '-' || trimmed === '—') return 0;
    const stripped = trimmed
      .replace(/[£$€]/g, '')
      .replace(/,/g, '')
      .replace(/\s/g, '')
      .replace(/[()]/g, '');
    const n = parseFloat(stripped);
    return isNaN(n) ? 0 : Math.abs(n);
  };

  const getCustomer = (row: CalculatorRow | undefined) =>
    (row?.rawCustomerValue !== undefined && row.rawCustomerValue !== null && row.rawCustomerValue !== 0)
      ? Math.abs(row.rawCustomerValue as number)
      : toNum(row?.customerInput);

  const parseCount = (s: string | undefined): number => {
    if (!s) return 0;
    return parseInt(s.replace(/,/g, ''), 10) || 0;
  };

  const currentAbusers = parseCount(rowG?.customerInput);
  const forterAbusers = parseCount(rowG?.forterOutcome);
  const blocked = currentAbusers - forterAbusers;
  const reductionPct = currentAbusers > 0 ? Math.round((blocked / currentAbusers) * 100) : 0;

  const cogs = getCustomer(rowI);
  const shipping = getCustomer(rowK);
  const fulfilment = getCustomer(rowL);
  const txFees = getCustomer(rowM);
  const inventory = getCustomer(rowN);
  const unitCostTotal = cogs + shipping + fulfilment + txFees + inventory;
  const costChartMax = Math.max(unitCostTotal + 1, 1);
  const getNiceCostScale = (max: number) => {
    if (max <= 0) return { niceMax: 100, ticks: [0, 25, 50, 75, 100] };
    let step = 25;
    if (max > 1000) step = 200;
    else if (max > 500) step = 100;
    else if (max > 200) step = 50;
    else if (max > 100) step = 25;
    else if (max > 50) step = 20;
    else if (max > 20) step = 10;
    const niceMax = Math.ceil(max / step) * step;
    const ticks: number[] = [];
    for (let t = 0; t <= niceMax; t += step) ticks.push(t);
    return { niceMax, ticks };
  };
  const costScale = getNiceCostScale(costChartMax);

  const sym = getCurrencySymbol(currencyCode);
  const fmtCur = (v: number) => `${sym}${Math.round(Math.abs(v)).toLocaleString('en-US')}`;

  const volumeData = [
    { name: 'Today', value: currentAbusers, fill: '#94a3b8' },
    { name: 'With Forter', value: forterAbusers, fill: '#22c55e' },
  ];
  const costData = [{ name: 'Cost per abuser', cogs, shipping, fulfilment, txFees, divider: 1, inventory }];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4 items-start">
        <div className="min-w-0 space-y-1 pr-4 border-r border-border">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">INR abusive transactions</p>
            <div className="flex flex-col items-end gap-0.5">
              <span className="px-2 py-0.5 bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300 rounded-full text-xs font-semibold whitespace-nowrap">
                {blocked.toLocaleString('en-US')} blocked
              </span>
              <span className="text-xs text-green-700 dark:text-green-300 font-medium pr-1">
                {rowP?.forterImprovement ?? '—'} protected
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={volumeData} margin={{ top: 42, right: 16, left: 16, bottom: 4 }} barCategoryGap="70%">
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: 'hsl(var(--foreground))' }} />
              <YAxis hide />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {volumeData.map((e, i) => (
                  <Cell key={i} fill={e.fill} />
                ))}
                <LabelList dataKey="value" position="top" formatter={(value: number) => Number(value ?? 0).toLocaleString('en-US')} style={{ fontSize: 11, fontWeight: 600, fill: 'hsl(var(--foreground))' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs font-semibold text-muted-foreground">{netEconomicLossTitle}</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={costData} margin={{ top: 28, right: 72, left: 8, bottom: 4 }} barCategoryGap="65%">
              <YAxis domain={[0, costScale.niceMax]} ticks={costScale.ticks} tickFormatter={(v) => `${sym}${v}`} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} width={32} />
              <XAxis hide />
              <RechartsTooltip formatter={(value: number, name: string, item: { dataKey?: string }) => { if (item?.dataKey === 'divider' || value == null) return null; return [fmtCur(value), name]; }} contentStyle={{ fontSize: 12 }} itemStyle={{ fontSize: 12 }} />
              <Bar dataKey="cogs" stackId="a" fill="#1e293b" name="COGS" />
              <Bar dataKey="shipping" stackId="a" fill="#475569" name="Shipping" />
              <Bar dataKey="fulfilment" stackId="a" fill="#64748b" name="Fulfilment" />
              <Bar dataKey="txFees" stackId="a" fill="#94a3b8" name="TX Fees" />
              <Bar dataKey="divider" stackId="a" fill="white" legendType="none" isAnimationActive={false} />
              <Bar dataKey="inventory" stackId="a" fill="#fca5a5" name="Lost margin (indirect) †" radius={[3, 3, 0, 0]}>
                <LabelList dataKey="inventory" position="top" content={(props: { x?: number; y?: number; width?: number }) => {
                  const { x, y, width } = props;
                  return (
                    <text x={Number(x) + Number(width) / 2} y={Number(y) - 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="hsl(var(--foreground))">
                      {fmtCur(unitCostTotal)}
                    </text>
                  );
                }} />
              </Bar>
              <Legend align="right" verticalAlign="middle" layout="vertical" iconSize={8} wrapperStyle={{ fontSize: 9 }} content={(props) => <DefaultLegendContent {...props} payload={[...(props.payload ?? [])].reverse()} />} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-1 italic">
            † Lost margin is an indirect cost — inventory lost to abusers reduces future selling capacity, not a direct cash outflow at point of claim.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Estimated abuse benchmark for INR cohort: {rowF?.customerInput ?? '—'} of INR claims
          </p>
        </div>

        <div className="min-w-0 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Value Impact</p>
          <div className="flex flex-col gap-2">
            <Card className="rounded-lg border p-4 flex flex-col gap-0.5 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700">
              <Shield className="w-4 h-4 shrink-0 text-slate-400" />
              <div className="text-slate-700 dark:text-slate-300 font-bold text-2xl">{blocked.toLocaleString('en-US')}</div>
              <div className="text-xs text-muted-foreground">{reductionPct}% of abusers blocked</div>
            </Card>
            <Card className="rounded-lg border p-4 flex flex-col gap-0.5 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
              <BadgeDollarSign className="w-4 h-4 shrink-0 text-amber-400" />
              <div className="text-amber-700 dark:text-amber-300 font-bold text-2xl">{fmtCur(getCustomer(rowO))}</div>
              <div className="text-xs text-muted-foreground">avg. cost per abusive claim</div>
            </Card>
            <Card className="rounded-lg border p-4 flex flex-col gap-0.5 bg-green-100 dark:bg-green-950/30 border-green-300 dark:border-green-700">
              <TrendingUp className="w-4 h-4 shrink-0 text-green-500" />
              <div className="text-green-700 dark:text-green-300 font-bold text-3xl">{rowP?.forterImprovement ?? '—'}</div>
              <div className="text-xs text-muted-foreground">total cost protected</div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Visual tab for c10-promotions: promotion abuse exploitation + GMV impact + value cards */
export function PromotionAbuseVisual({ rows, showInMillions, currencyCode }: { rows: CalculatorRow[]; showInMillions: boolean; currencyCode: string }) {
  const parseCur = (s: string | undefined): number => {
    if (!s) return 0;
    const n = parseFloat(s.replace(/[£$€,\s()]/g, '').replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? 0 : Math.abs(n);
  };
  const parsePct = (s: string | undefined): number => {
    if (!s) return 0;
    return parseFloat(s.replace(/[^0-9.-]/g, '')) || 0;
  };

  const rowA = rows.find(r => r.formula === 'a');
  const rowB = rows.find(r => r.formula === 'b');
  const rowD = rows.find(r => r.formula === 'd');
  const rowE = rows.find(r => r.formula === 'e');
  const rowG = rows.find(r => r.formula === 'g');
  const rowI = rows.find(r => r.valueDriver === 'revenue');
  const rowM = rows.find(r => r.valueDriver === 'profit');

  const totalGMV = parseCur(rowA?.customerInput);
  const abusePct = parsePct(rowB?.customerInput);
  const catchToday = parsePct(rowD?.customerInput);
  const catchForter = parsePct(rowD?.forterOutcome);
  const aovMultiplier = ((rowE?.rawCustomerValue as number) ?? parseFloat(String(rowE?.customerInput ?? '').replace(/x/g, ''))) || 1.5;
  const discountPct = parsePct(rowG?.customerInput);
  const lostGMVCurrent = parseCur(rowI?.customerInput);
  const lostGMVForter = parseCur(rowI?.forterOutcome);
  const gmvRecovered = lostGMVCurrent - lostGMVForter;
  const profitRecovered = parseCur(rowM?.forterImprovement);

  const sym = getCurrencySymbol(currencyCode);
  const fmtCur = (v: number) => showInMillions ? `${sym}${(v / 1_000_000).toFixed(1)}M` : `${sym}${Math.round(v).toLocaleString('en-US')}`;

  return (
    <div className="grid grid-cols-3 gap-6 items-start">
      <div className="col-span-2 space-y-4">
        {/* Section 1 — How abusers exploit your promotions */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-3">How abusers exploit your promotions</p>
          <div className="w-full h-10 bg-slate-700 rounded-lg flex items-center justify-between px-4">
            <span className="text-xs text-white font-medium">Abusive basket value</span>
            <span className="text-sm text-white font-bold">{aovMultiplier}× avg order value</span>
          </div>
          <div className="flex justify-center my-1">
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-0.5 h-3 bg-slate-400" />
              <div className="text-slate-400 text-xs">↓ {discountPct}% discount claimed</div>
              <div className="w-0.5 h-3 bg-slate-400" />
            </div>
          </div>
          <div className="w-full h-10 rounded-lg overflow-hidden flex">
            <div className="h-full flex items-center justify-center text-xs font-semibold text-slate-700 bg-slate-200" style={{ width: `${100 - discountPct}%` }}>
              Merchant receives ({100 - discountPct}%)
            </div>
            <div className="h-full flex items-center justify-center text-xs font-semibold text-white bg-red-400" style={{ width: `${discountPct}%` }}>
              Absorbed ({discountPct}%)
            </div>
          </div>
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            <span>Abusers typically target higher value items to maximise discount value</span>
          </div>
        </div>

        {/* Section 2 — Abuse scale: today vs with Forter */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mt-4 mb-2">Promotion abuse exposure: unprotected vs. protected</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Unprotected GMV exposure</div>
              <div className="text-xl font-bold text-red-600">({fmtCur(lostGMVCurrent)})</div>
              <div className="text-xs text-muted-foreground">{abusePct}% of GMV currently at risk</div>
              <div className="w-full h-1.5 bg-red-100 rounded mt-2">
                <div className="h-full bg-red-400 rounded" style={{ width: `${Math.min(abusePct * 5, 100)}%` }} />
              </div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Residual exposure with Forter</div>
              <div className="text-xl font-bold text-green-700">({fmtCur(lostGMVForter)})</div>
              <div className="text-xs text-muted-foreground">{catchForter}% of risk eliminated</div>
              <div className="w-full h-1.5 bg-green-100 rounded mt-2">
                <div className="h-full bg-green-400 rounded" style={{ width: `${Math.min(abusePct * (1 - catchForter / 100) * 5, 100)}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3 — Recovery callout */}
        <div className="flex items-center gap-2 mt-3 p-2.5 bg-green-50 border border-green-200 rounded-lg">
          <TrendingUp className="w-4 h-4 text-green-600 shrink-0" />
          <p className="text-xs text-green-800">
            <strong>{fmtCur(gmvRecovered)}</strong> net GMV protected — Forter&apos;s identity network identifies {catchForter}% of abusive accounts before discounts are applied
          </p>
        </div>
      </div>

      <div className="col-span-1 space-y-3">
        <p className="text-sm font-semibold mb-3">Value Impact</p>
        <div className="flex flex-col gap-3">
          <Card className="rounded-lg border border-t-4 border-t-slate-400 p-5 flex flex-col gap-0.5 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700">
            <Shield className="w-5 h-5 shrink-0 text-slate-400" />
            <div className="text-slate-700 dark:text-slate-300 font-bold text-3xl">{catchForter}%</div>
            <div className="text-xs text-muted-foreground">abusers blocked</div>
            <div className="text-xs text-muted-foreground opacity-70">vs {catchToday}% today</div>
          </Card>
          <Card className="rounded-lg border border-t-4 border-t-amber-400 p-5 flex flex-col gap-0.5 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
            <TrendingUp className="w-5 h-5 shrink-0 text-amber-500" />
            <div className="text-amber-700 dark:text-amber-300 font-bold text-3xl">{fmtCur(gmvRecovered)}</div>
            <div className="text-xs text-muted-foreground">net GMV protected</div>
            <div className="text-xs text-muted-foreground opacity-70">{abusePct}% of GMV was at risk</div>
          </Card>
          <Card className="rounded-lg border border-t-4 border-t-green-500 border-green-300 p-5 flex flex-col gap-0.5 bg-green-100 dark:bg-green-950/30 dark:border-green-700">
            <BadgeDollarSign className="w-5 h-5 shrink-0 text-green-500" />
            <div className="text-green-700 dark:text-green-300 font-bold text-3xl">{fmtCur(profitRecovered)}</div>
            <div className="text-xs text-muted-foreground">profitability protected</div>
            <div className="text-xs text-green-600 font-medium">{rowM?.forterImprovement ?? ''} improvement</div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Visual for c1-chargeback / c245-chargeback: Fraud chargeback rate bar + Value Impact cards (report capture). */
export function ChargebackVisual({ rows, showInMillions, currencyCode }: { rows: CalculatorRow[]; showInMillions: boolean; currencyCode: string }) {
  const rateRow = rows.find((r) => r.label?.includes("Gross Fraud Chargeback Rate") || r.formula === "b");
  const volumeRow = rows.find((r) => r.label?.toLowerCase().includes("fraud chargeback") && (r.formula === "c" || r.formula?.startsWith("c =") || r.valueDriver === "cost"));
  const costRow = rows.find((r) => r.valueDriver === "cost");
  const currentRate = (rateRow?.rawCustomerValue ?? 0) as number;
  const forterRate = (rateRow?.rawForterValue ?? 0) as number;
  const reductionPct = currentRate > 0 ? Math.round(((currentRate - forterRate) / currentRate) * 100) : 0;
  const isMore = forterRate > currentRate;
  const chartData = [
    { name: "Current", value: currentRate, fill: "#94a3b8" },
    { name: "With Forter", value: forterRate, fill: isMore ? "#ef4444" : "#22c55e" },
  ];
  const yMax = Math.max(currentRate, forterRate, 0.1) * 1.4 || 1;
  const yTicks = getEqualYAxisTicks(yMax, 5);
  const yDomainMax = yTicks[yTicks.length - 1] ?? yMax;
  const parseCurToNum = (s: string | undefined): number | null => {
    if (s == null || s === "—") return null;
    const trimmed = String(s).replace(/\s/g, "").replace(/\*.*$/, "");
    const neg = /^\(.*\)$/.test(trimmed);
    const n = parseFloat(trimmed.replace(/[^\d.-]/g, ""));
    return isNaN(n) ? null : neg ? -n : n;
  };
  const currentVal = parseCurToNum(volumeRow?.customerInput);
  const forterVal = parseCurToNum(volumeRow?.forterOutcome);
  const costReduction = parseCurToNum(costRow?.forterImprovement) ?? 0;
  const fmtCur = createCurrencyFormatter(currencyCode);
  const displayCurrent = currentVal != null ? fmtCur(Math.round(currentVal)) : "—";
  const displayForter = forterVal != null ? fmtCur(Math.round(forterVal)) : (volumeRow?.forterOutcome === "$0.00*" ? fmtCur(0) : (volumeRow?.forterOutcome ?? "—"));
  const cardClass = "rounded-lg border bg-card p-4 flex flex-col justify-center min-h-[5rem]";
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center min-h-0 h-full">
      <div className="flex flex-col gap-2 flex-1 min-w-0 md:border-r md:border-border/60 md:pr-6 justify-center">
        <h4 className="text-sm font-semibold text-muted-foreground">Fraud chargeback rate</h4>
        <div className="flex flex-col gap-2 w-full">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 24, right: 12, left: 12, bottom: 8 }} barCategoryGap={4} barGap={4}>
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600 }} />
              <YAxis domain={[0, yDomainMax]} ticks={yTicks} tick={{ fontSize: 11 }} tickFormatter={(v) => `${Number(v).toFixed(2)}%`} width={40} />
              <Bar dataKey="value" barSize={56} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
                <LabelList position="top" formatter={(v: number) => `${Number(v).toFixed(2)}%`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex justify-center">
            <Badge className={isMore ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"}>
              {isMore ? `${Math.abs(reductionPct)}% more chargebacks` : `${reductionPct}% fewer chargebacks`}
            </Badge>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3 flex-1 min-w-0 justify-center">
        <h4 className="text-sm font-semibold text-muted-foreground">Value Impact</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className={cardClass}>
            <div className="text-xs text-muted-foreground mb-1">Current fraud chargeback value</div>
            <div className="font-semibold">{displayCurrent}</div>
          </Card>
          <Card className={cardClass}>
            <div className="text-xs text-muted-foreground mb-1">Forter outcome fraud chargeback value</div>
            <div className="font-semibold">{displayForter}</div>
          </Card>
          <Card className={cn(cardClass, "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800")}>
            <div className="text-xs text-muted-foreground mb-1">SG&A cost reduction</div>
            <div className="font-bold text-green-800 dark:text-green-300">{fmtCur(Math.round(costReduction))}</div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Visual for c9-cx-uplift: Instant refunds CX uplift card chain (report capture). */
export function InstantRefundsCXVisual({ rows, currencyCode, forReportCapture }: { rows: CalculatorRow[]; showInMillions: boolean; currencyCode: string; forReportCapture?: boolean }) {
  const rowA = rows.find((r) => r.formula === "a");
  const rowB = rows.find((r) => r.formula === "b");
  const rowC = rows.find((r) => r.formula === "c");
  const rowD = rows.find((r) => r.formula === "d" || r.formula?.startsWith("d ="));
  const rowE = rows.find((r) => r.formula === "e" || r.formula?.startsWith("e ="));
  const rowF = rows.find((r) => r.formula === "f");
  const rowH = rows.find((r) => r.formula === "h" || r.formula?.startsWith("h ="));
  const rowI = rows.find((r) => r.formula === "i" || r.formula?.startsWith("i ="));
  const cardClass = forReportCapture
    ? "w-44 min-w-[11rem] flex-shrink-0 min-h-[9rem] p-4 flex flex-col justify-center items-center text-center overflow-visible"
    : "w-44 min-w-[11rem] flex-shrink-0 min-h-[9rem] p-4 flex flex-col justify-between overflow-visible";
  const cardClassWide = forReportCapture
    ? "min-w-[13rem] w-52 flex-shrink-0 min-h-[9rem] p-4 flex flex-col justify-center items-center text-center overflow-visible"
    : "min-w-[13rem] w-52 flex-shrink-0 min-h-[9rem] p-4 flex flex-col justify-between overflow-visible";
  const connector = (op: string) => (
    <div className="flex items-center self-center shrink-0" aria-hidden>
      <div className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1 text-sm font-bold text-muted-foreground">{op}</div>
    </div>
  );
  return (
    <div className="space-y-6 flex flex-col items-center justify-center w-full h-full">
      <div className="flex items-stretch gap-2 flex-nowrap justify-center">
        <Card className={cn(cardClass, "border-t-4 border-slate-400")}>
          <div className="text-xl font-bold text-slate-700 dark:text-slate-300">{rowA?.customerInput ?? "—"}</div>
          <div className="text-xs text-muted-foreground">Current eCommerce sales</div>
        </Card>
        {connector("×")}
        <Card className={cn(cardClassWide, "border-t-4 border-amber-400")}>
          <div className="text-xl font-bold text-amber-700 dark:text-amber-300">{rowD?.forterOutcome ?? "—"}</div>
          <div className="text-xs text-muted-foreground break-words">
            <span className="block">Expected sales uplift</span>
            <span className="block mt-0.5">From +{rowB?.forterOutcome ?? "—"} NPS pts via LSE benchmark ({rowC?.forterOutcome ?? "—"}/pt)</span>
          </div>
        </Card>
        {connector("=")}
        <Card className={cn(cardClass, "border-t-4 border-blue-400")}>
          <div className="text-xl font-bold text-blue-700 dark:text-blue-300">{rowE?.forterImprovement ?? "—"}</div>
          <div className="text-xs text-muted-foreground">Additional eCommerce sales</div>
        </Card>
        <div className="flex items-center self-center shrink-0" aria-hidden>
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
        </div>
        <Card className={cn(cardClassWide, "border-t-4 border-green-500 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800")}>
          <div className="text-xl font-bold text-green-700 dark:text-green-300">{rowI?.forterImprovement ?? "—"}</div>
          <div className="text-xs text-muted-foreground break-words">
            <span className="block">Profitability impact</span>
            {rowF && <span className="block mt-0.5">After {rowF.customerInput ?? "—"} {rowH ? `commission × ${rowH.customerInput ?? "—"} margin` : "margin"}</span>}
          </div>
        </Card>
      </div>
    </div>
  );
}

/** Visual for c245-revenue: Optimize payment funnel — key metrics from rows (report capture). */
export function PaymentFunnelSummaryVisual({ rows, currencyCode }: { rows: CalculatorRow[]; showInMillions: boolean; currencyCode: string }) {
  const approvedRow = rows.find((r) => r.label?.includes("Approved transactions") && (r.formula === "p" || r.formula?.startsWith("p =")));
  const valueRow = rows.find((r) => r.label?.includes("Value of approved") || r.formula === "q" || r.formula?.startsWith("q ="));
  const completionRow = rows.find((r) => r.label?.toLowerCase().includes("completion rate") || r.formula === "r" || r.formula?.startsWith("r ="));
  const fmtCur = createCurrencyFormatter(currencyCode);
  const cardClass = "rounded-lg border bg-card p-4 flex flex-col justify-center min-h-[5rem]";
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-muted-foreground">Payment funnel — key outcomes</h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {approvedRow && (
          <Card className={cardClass}>
            <div className="text-xs text-muted-foreground mb-1">Approved transactions (With Forter)</div>
            <div className="font-bold text-lg">{approvedRow.forterOutcome ?? "—"}</div>
          </Card>
        )}
        {valueRow && (
          <Card className={cn(cardClass, "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800")}>
            <div className="text-xs text-muted-foreground mb-1">Value of approved transactions</div>
            <div className="font-bold text-lg text-green-800 dark:text-green-300">{valueRow.forterOutcome ?? "—"}</div>
          </Card>
        )}
        {completionRow && (
          <Card className={cardClass}>
            <div className="text-xs text-muted-foreground mb-1">Completion</div>
            <div className="font-bold text-lg">{completionRow.forterOutcome ?? completionRow.customerInput ?? "—"}</div>
          </Card>
        )}
        {!approvedRow && !valueRow && !completionRow && (
          <Card className={cardClass}>
            <div className="text-xs text-muted-foreground">Key metrics from calculator</div>
            <div className="text-sm font-medium">{rows.filter((r) => r.forterOutcome || r.forterImprovement).length} value drivers</div>
          </Card>
        )}
      </div>
    </div>
  );
}

/** Full payment funnel visual for report capture: funnel bar chart (current state # of transactions) + Value Impact flow. */
export function PaymentFunnelFullVisual({
  rows,
  currencyCode,
  funnelBreakdown,
  totalTransactionAttempts = 0,
  deduplicationBreakdown,
  deduplicationEnabled = false,
}: {
  rows: CalculatorRow[];
  currencyCode: string;
  funnelBreakdown?: PaymentFunnelStage[] | null;
  totalTransactionAttempts?: number;
  deduplicationBreakdown?: DeduplicationBreakdown | null;
  deduplicationEnabled?: boolean;
}) {
  const fmtVol = (n: number) => n.toLocaleString("en-US");
  const fmtVolSigned = (n: number) => (n < 0 ? `(${Math.abs(n).toLocaleString("en-US")})` : n.toLocaleString("en-US"));
  const fmtCur = createCurrencyFormatter(currencyCode);
  const getRecoveryLabel = (stageId: string) => {
    switch (stageId) {
      case "preauth": return "false declines";
      case "3ds": return "exemption/frictionless shift";
      case "bank": return "additionally impacted";
      case "postauth": return "false declines";
      default: return "";
    }
  };
  const declineSegmentColor = (stage: PaymentFunnelStage) => {
    if (stage.id === "preauth") return "bg-red-300";
    if (stage.id === "3ds") return "bg-red-400";
    if (stage.id === "bank") return "bg-red-500";
    if (stage.id === "postauth") return "bg-red-600";
    return "bg-red-500";
  };

  if (!funnelBreakdown?.length) {
    return <PaymentFunnelSummaryVisual rows={rows} currencyCode={currencyCode} showInMillions={false} />;
  }

  const funnelStages = funnelBreakdown.filter((s) => !s.isPostCompletion);
  const totalRecoverableVol = funnelStages.reduce((sum, s) => sum + (s.recoverableVolume ?? 0), 0);
  const displayTotalRecoverable = deduplicationBreakdown?.approvedTxImprovement != null
    ? Math.round(deduplicationBreakdown.approvedTxImprovement)
    : totalRecoverableVol;
  const breakdown = deduplicationBreakdown;
  const cardClass = "rounded-lg border bg-card px-4 py-3 text-center shadow-sm w-[9.5rem] min-h-[5.25rem] flex flex-col justify-center items-center";
  const labelClass = "text-xs text-muted-foreground tracking-wide mb-0.5";
  const valueClass = "font-semibold text-foreground";

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-muted-foreground">Payment funnel — key outcomes</h4>
      {/* Current state (# of transactions) */}
      <div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-3 items-center text-sm">
        <div className="font-medium text-muted-foreground">Current state (# of transactions)</div>
        <div className="font-medium text-muted-foreground text-right">Forter recoverable</div>
        {funnelStages.map((stage) => {
          const isAttempts = stage.id === "attempts";
          const isDecline = stage.isDecline;
          const isCompleted = stage.isCompleted;
          const pctRemaining = Math.min(100, stage.pctRemaining);
          const pctDeducted = Math.min(100, stage.pctOfAttempts);
          const countRemaining = Math.round(totalTransactionAttempts * (pctRemaining / 100));
          const countDeducted = Math.round(totalTransactionAttempts * (pctDeducted / 100));
          const displayVal = isAttempts ? totalTransactionAttempts : isCompleted ? countRemaining : countDeducted;
          return (
            <div key={stage.id} className="contents">
              <div className="flex items-center gap-3">
                <div className="w-36 shrink-0 text-sm font-medium">{stage.label}</div>
                <div className="flex-1 min-w-0 h-6 rounded overflow-hidden flex">
                  {isAttempts && (
                    <div className="h-full flex-1 min-w-0 bg-green-400 rounded flex items-center pl-2 text-xs font-medium text-green-900/80" style={{ minWidth: "100%" }}>
                      {fmtVol(totalTransactionAttempts)}
                    </div>
                  )}
                  {isDecline && (
                    <>
                      <div className="h-full bg-muted/70 shrink-0 flex items-center rounded" style={{ width: `${pctRemaining}%`, minWidth: 0 }} />
                      {pctDeducted > 0 && (
                        <div className={cn("h-full shrink-0 flex items-center justify-end pr-1.5 rounded-r", declineSegmentColor(stage))} style={{ width: `${pctDeducted}%`, minWidth: "2rem" }} />
                      )}
                    </>
                  )}
                  {isCompleted && !isAttempts && (
                    <div className="h-full bg-green-800 rounded flex items-center pl-2 text-xs font-medium text-green-100" style={{ width: `${pctRemaining}%`, minWidth: 0 }}>
                      {fmtVol(countRemaining)}
                    </div>
                  )}
                </div>
                <div className="w-24 shrink-0 text-right text-xs">
                  {isAttempts && <span className="font-bold tabular-nums">{fmtVol(totalTransactionAttempts)}</span>}
                  {isDecline && !isAttempts && <span className="font-bold tabular-nums text-red-700 dark:text-red-300">{fmtVol(countDeducted)} tx</span>}
                  {isCompleted && <span className="font-bold tabular-nums text-green-800 dark:text-green-200">{fmtVol(countRemaining)}</span>}
                </div>
              </div>
              <div className="text-right max-w-[180px] text-xs">
                {isCompleted
                  ? (displayTotalRecoverable != null ? (displayTotalRecoverable === 0 ? "-" : `~${fmtVolSigned(displayTotalRecoverable)} tx total recoverable`) : null)
                  : stage.recoverableVolume != null && stage.recoverableVolume !== 0
                    ? `~${fmtVolSigned(stage.recoverableVolume)} tx ${getRecoveryLabel(stage.id) || "recoverable"}`
                    : "-"}
              </div>
            </div>
          );
        })}
        <div className="col-span-2 pt-2 border-t text-xs text-muted-foreground text-right">
          Total opportunity above ~{fmtVolSigned(displayTotalRecoverable)} recoverable transactions
        </div>
      </div>
      {/* Value Impact */}
      {breakdown && breakdown.aov != null && (
        <div className="flex flex-col gap-2 py-2">
          <p className="text-sm font-semibold text-muted-foreground mb-0">Value Impact</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <div className={cardClass}>
              <div className={labelClass}>Total recoverable</div>
              <div className={valueClass}>{Math.round(breakdown.approvedTxImprovement ?? totalRecoverableVol).toLocaleString("en-US")} tx</div>
            </div>
            {deduplicationEnabled && (
              <>
                <ChevronRight className="w-5 h-5 text-muted-foreground/50 flex-shrink-0" aria-hidden />
                <div className={cardClass}>
                  <div className={labelClass}>Less duplicate attempts</div>
                  <div className={valueClass}>
                    {breakdown.retryRate != null && breakdown.successRate != null
                      ? `${((breakdown.retryRate * breakdown.successRate) / 100).toFixed(1)}%`
                      : "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">({Math.abs(Math.round(breakdown.duplicateSuccessfulTx ?? 0)).toLocaleString("en-US")} tx)</div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground/50 flex-shrink-0" aria-hidden />
                <div className={cardClass}>
                  <div className={labelClass}>Deduplicated recoverable</div>
                  <div className={valueClass}>{Math.round((breakdown.approvedTxImprovement ?? 0) - (breakdown.duplicateSuccessfulTx ?? 0)).toLocaleString("en-US")} tx</div>
                </div>
              </>
            )}
            <ChevronRight className="w-5 h-5 text-muted-foreground/50 flex-shrink-0" aria-hidden />
            <div className={cardClass}>
              <div className={labelClass}>× Recovered AOV</div>
              <div className={valueClass}>{fmtCur(breakdown.recoveredOrderAOV ?? breakdown.aov)}</div>
            </div>
          </div>
          <div className="flex justify-center">
            <div className={cn(cardClass, "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 w-auto min-w-[12rem]")}>
              <div className={labelClass}>Recoverable GMV potential</div>
              <div className="font-bold text-lg text-green-800 dark:text-green-300">
                {fmtCur(
                  deduplicationEnabled
                    ? ((breakdown.approvedTxImprovement ?? 0) - (breakdown.duplicateSuccessfulTx ?? 0)) * (breakdown.recoveredOrderAOV ?? breakdown.aov) - (breakdown.gmvReduction ?? 0)
                    : (breakdown.approvedTxImprovement ?? totalRecoverableVol) * (breakdown.recoveredOrderAOV ?? breakdown.aov)
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Visual tab for c13-clv: customers at risk grids + CLV chain + value impact cards */
export function CLVChurnVisual({ rows, showInMillions, currencyCode }: { rows: CalculatorRow[]; showInMillions: boolean; currencyCode: string }) {
  const parseCount = (s: string | undefined): number => {
    if (!s) return 0;
    return parseInt(s.replace(/,/g, ''), 10) || 0;
  };
  const parseCur = (s: string | undefined): number => {
    if (!s) return 0;
    const n = parseFloat(s.replace(/[£$€,\s()]/g, '').replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? 0 : Math.abs(n);
  };
  const parsePct = (s: string | undefined): number => {
    if (!s) return 0;
    return parseFloat(s.replace(/[^0-9.-]/g, '')) || 0;
  };

  const rowA = rows.find(r => r.formula === 'a');
  const rowB = rows.find(r => r.formula === 'b');
  const rowC = rows.find(r => r.formula?.startsWith('c'));
  const rowD = rows.find(r => r.formula === 'd');
  const rowE = rows.find(r => r.formula?.startsWith('e'));
  const rowF = rows.find(r => r.formula === 'f');
  const rowG = rows.find(r => r.formula === 'g');
  const rowH = rows.find(r => r.formula?.startsWith('h'));
  const rowM = rows.find(r => r.valueDriver === 'profit');

  const totalLogins = parseCount(rowA?.customerInput);
  const fraudPct = parsePct(rowB?.customerInput);
  const fraudPctForter = parsePct(rowB?.forterOutcome);
  const atoAttempts = parseCount(rowC?.customerInput);
  const successfulAtoToday = parseCount(rowE?.customerInput); // E = c*(1-d): successful ATO today (uses current catch rate)
  const atoForter = parseCount(rowE?.forterOutcome);
  const atoBlocked = successfulAtoToday - atoForter;
  const currentCatchRate = parsePct(rowD?.customerInput);
  const catchRate = parsePct(rowD?.forterOutcome);
  const clvPerCustomer = parseCur(rowF?.customerInput);
  const churnLikelihood = parsePct(rowG?.customerInput);
  const clvChurnCurrent = parseCur(rowH?.customerInput);
  const clvChurnForter = parseCur(rowH?.forterOutcome);
  const clvRecovered = clvChurnCurrent - clvChurnForter;
  const profitRecovered = parseCur(rowM?.forterImprovement);

  const customersAtRiskCurrent = Math.round(successfulAtoToday * (churnLikelihood / 100));
  const customersAtRiskForter = Math.round(atoForter * (churnLikelihood / 100));
  const customersRetained = customersAtRiskCurrent - customersAtRiskForter;

  const sym = getCurrencySymbol(currencyCode);
  const fmtCur = (v: number) => showInMillions ? `${sym}${(v / 1_000_000).toFixed(1)}M` : `${sym}${Math.round(v).toLocaleString('en-US')}`;

  const forterRelativePct = atoAttempts > 0 ? (atoForter / atoAttempts) * 25 : 0;

  const clvAtRiskPerEvent = clvPerCustomer * (churnLikelihood / 100);

  return (
    <div className="grid grid-cols-3 gap-6 items-start">
      <div className="col-span-2 space-y-4">
        {/* Churn risk banner — first (top) */}
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            <strong>Churn risk:</strong> each successful ATO has a {churnLikelihood}% probability of permanently losing that customer and their {fmtCur(clvPerCustomer)} lifetime value. Forter&apos;s {catchRate}% catch rate reduces at-risk customers from <strong>{customersAtRiskCurrent.toLocaleString()}</strong> to <strong>{customersAtRiskForter.toLocaleString()}</strong>.
          </p>
        </div>

        {/* Section 1 — Broken-axis visual: total logins 75%, ATO bars 25% base */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-3">Where ATO churn risk sits within your login volume</p>
          <div className="grid grid-cols-[160px_1fr_auto] gap-x-4 gap-y-4 items-center">
            {/* Stage 1 — Total logins: 75% with break marker; stub fills to end of row */}
            <span className="text-sm font-medium">Total logins</span>
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <div className="relative flex items-center h-8 bg-slate-200 rounded-l shrink-0" style={{ width: '75%' }}>
                <span className="absolute right-2 text-xs text-slate-600 font-medium">
                  {totalLogins.toLocaleString()}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 shrink-0 px-0.5">
                <div className="w-3 h-0.5 bg-slate-400 rotate-12" />
                <div className="w-3 h-0.5 bg-slate-400 rotate-12" />
              </div>
              <div className="h-8 flex-1 min-w-0 bg-slate-200 rounded-r" />
            </div>
            <div className="w-8 shrink-0" />

            {/* Stage 2 — ATO logins: 25% width (3x smaller than total logins bar) */}
            <span className="text-sm font-medium">ATO logins</span>
            <div className="flex-1 flex items-center h-8 rounded overflow-hidden bg-slate-100">
              <div
                className="h-full bg-red-400 flex items-center justify-center text-xs text-white font-semibold rounded"
                style={{ width: '25%', minWidth: '3rem' }}
              >
                {atoAttempts.toLocaleString()}
              </div>
            </div>
            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium whitespace-nowrap">
              {parsePct(rowB?.customerInput).toFixed(1)}% of logins
            </span>

            {/* Stage 2b — Successful ATOs today (merchant's current catch rate) */}
            <span className="text-sm font-medium text-red-600">Successful ATOs today</span>
            <div className="flex-1 flex items-center h-8 rounded overflow-hidden bg-slate-100">
              <div
                className="h-full bg-red-600 flex items-center justify-center text-xs text-white font-semibold rounded"
                style={{
                  width: `${atoAttempts > 0 ? Math.max((successfulAtoToday / atoAttempts) * 25, 3) : 25}%`,
                  minWidth: '2.5rem',
                }}
              >
                {successfulAtoToday.toLocaleString()}
              </div>
            </div>
            <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium whitespace-nowrap">
              {currentCatchRate.toFixed(1)}% caught today
            </span>

            {/* Divider */}
            <div className="col-span-3 flex items-center gap-2 my-1">
              <div className="flex-1 border-t border-dashed border-slate-300" />
              <span className="text-xs text-muted-foreground px-2 bg-white">With Forter ↓</span>
              <div className="flex-1 border-t border-dashed border-slate-300" />
            </div>

            {/* Stage 3 — ATOs remaining with Forter: relative to 25% base */}
            <span className="text-sm font-medium text-green-700">ATO remaining post-Forter</span>
            <div className="flex-1 flex items-center h-8 rounded overflow-hidden bg-slate-100">
              <div
                className="h-full bg-green-500 flex items-center justify-center text-xs text-white font-semibold rounded"
                style={{ width: `${Math.max(forterRelativePct, 3)}%`, minWidth: '2.5rem' }}
              >
                {atoForter.toLocaleString()}
              </div>
            </div>
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium whitespace-nowrap">
              {catchRate}% blocked
            </span>
          </div>
        </div>

        {/* Section 2 — How we calculate customers at risk of churn */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mt-4 mb-2">How we calculate customers at risk of churn</p>
          <div className="flex items-stretch gap-3 w-full">
            <div className="flex-1 min-w-0 h-24 rounded-lg border p-2 flex flex-col justify-between bg-slate-50 border-slate-200">
              <span className="text-xs text-muted-foreground">Successful ATOs today</span>
              <span className="text-xl font-bold text-slate-700">{successfulAtoToday.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">unprotected events</span>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-sm font-bold self-center shrink-0">×</span>
            <div className="flex-1 min-w-0 h-24 rounded-lg border p-2 flex flex-col justify-between bg-amber-50 border-amber-200">
              <span className="text-xs text-muted-foreground">Churn likelihood</span>
              <span className="text-xl font-bold text-amber-700">{churnLikelihood}%</span>
              <span className="text-xs text-muted-foreground">probability per ATO event</span>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-sm font-bold self-center shrink-0">=</span>
            <div className="flex-1 min-w-0 h-24 rounded-lg border p-2 flex flex-col justify-between bg-red-50 border-red-200">
              <span className="text-xs text-muted-foreground">Customers at risk</span>
              <span className="text-xl font-bold text-red-600">{customersAtRiskCurrent.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">likely to churn without Forter</span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
            <TrendingUp className="w-3.5 h-3.5 text-green-600 shrink-0" />
            <p className="text-xs text-green-800">
              With Forter: only <strong>{customersAtRiskForter.toLocaleString()}</strong> customers remain at risk of full churn ({churnLikelihood}% churn likelihood), leaving <strong>{customersRetained.toLocaleString()}</strong> retained and protected from a negative CX
            </p>
          </div>
        </div>
      </div>

      <div className="col-span-1 space-y-3">
        <p className="text-sm font-semibold mb-3">Value Impact</p>
        <div className="flex flex-col gap-2">
          <Card className="rounded-lg border border-t-4 border-t-slate-400 p-5 flex flex-col gap-0.5 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700">
            <UserCheck className="w-5 h-5 shrink-0 text-slate-400" />
            <div className="text-slate-700 dark:text-slate-300 font-bold text-3xl">{customersRetained.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">customers retained</div>
            <div className="text-xs text-muted-foreground opacity-70">{catchRate}% ATO catch rate</div>
          </Card>
          <Card className="rounded-lg border border-t-4 border-t-amber-400 p-5 flex flex-col gap-0.5 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
            <BadgeDollarSign className="w-5 h-5 shrink-0 text-amber-400" />
            <div className="text-amber-700 dark:text-amber-300 font-bold text-3xl">{fmtCur(clvPerCustomer)}</div>
            <div className="text-xs text-muted-foreground">CLV per customer</div>
            <div className="text-xs text-muted-foreground opacity-70">lifetime GMV value</div>
          </Card>
          <Card className="rounded-lg border border-t-4 border-t-green-500 border-green-300 p-5 flex flex-col gap-0.5 bg-green-100 dark:bg-green-950/30 dark:border-green-700">
            <TrendingUp className="w-5 h-5 shrink-0 text-green-500" />
            <div className="text-green-700 dark:text-green-300 font-bold text-3xl">{fmtCur(clvRecovered)}</div>
            <div className="text-xs text-muted-foreground">CLV preserved</div>
            <div className="text-xs text-green-600 font-medium">{rowM?.forterImprovement ?? ''} profit protected</div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Apply custom benefit/calculator names (custom pathway) to standard drivers */
function applyCustomBenefitNames<T extends { id: string; label: string; calculatorTitle?: string }>(
  drivers: T[],
  customNames: Record<string, string> | undefined
): T[] {
  if (!customNames || Object.keys(customNames).length === 0) return drivers;
  return drivers.map((d) => {
    if (d.id.startsWith("custom-")) return d;
    const custom = customNames[d.id];
    if (custom === undefined) return d;
    return { ...d, label: custom, calculatorTitle: custom };
  });
}

/** Clickable performance highlight row that navigates to the corresponding Forter KPI section */
function PerformanceHighlightRow({
  label,
  badge,
  section,
  onNavigateToForterKPI,
  isLast,
}: {
  label: string;
  badge: string;
  section: ForterKPIFocusSection;
  onNavigateToForterKPI?: (section: ForterKPIFocusSection) => void;
  isLast?: boolean;
}) {
  const baseClassName = `flex justify-between items-center py-2 w-full ${isLast ? "" : "border-b"} ${onNavigateToForterKPI ? "cursor-pointer hover:bg-muted/50 transition-colors rounded-sm" : ""}`;
  const content = (
    <>
      <span className="text-sm text-muted-foreground">{label}</span>
      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
        {badge}
      </Badge>
    </>
  );
  if (onNavigateToForterKPI) {
    return (
      <button
        type="button"
        className={`${baseClassName} text-left`}
        onClick={() => onNavigateToForterKPI(section)}
        title="Go to Forter KPI input"
      >
        {content}
      </button>
    );
  }
  return <div className={baseClassName}>{content}</div>;
}

export interface ValueTotals {
  gmvUplift: number;
  costReduction: number;
  riskMitigation: number;
  ebitdaContribution: number;
  // Breakdowns for ROI tab sub-calculations (calculatorId = driver id for opening benefit modal)
  gmvUpliftBreakdown?: Array<{ label: string; value: number; challengeId?: string; calculatorId?: string }>;
  costReductionBreakdown?: Array<{ label: string; value: number; challengeId?: string; calculatorId?: string }>;
  riskMitigationBreakdown?: Array<{ label: string; value: number; challengeId?: string; calculatorId?: string }>;
  /** True when every enabled benefit driver has completed inputs and shows a quantitative value (not TBD). Used for summary tab completion. */
  allBenefitDriversHaveQuantitativeValue?: boolean;
  /** Fraction (0-1) of enabled benefit drivers that have quantitative value. Used for partial summary tab progress. */
  benefitDriversQuantitativeFraction?: number;
}

interface ValueSummaryOptionAProps {
  formData: CalculatorData;
  selectedChallenges: { [key: string]: boolean };
  onFormDataChange?: (field: keyof CalculatorData, value: number | Record<string, string>) => void;
  onForterKPIChange?: (field: keyof ForterKPIs, value: number) => void;
  onCustomCalculationsChange?: (calculations: CustomCalculation[]) => void;
  onSegmentInputChange?: (segmentId: string, field: keyof import("@/lib/segments").SegmentInputs, value: number) => void;
  onSegmentKPIChange?: (segmentId: string, field: keyof import("@/lib/segments").SegmentKPIs, value: number) => void;
  showInMillions?: boolean;
  onShowInMillionsChange?: (value: boolean) => void;
  onSelectUseCases?: () => void;
  onTotalsChange?: (totals: ValueTotals) => void;
  onChallengeChange?: (challengeId: string, checked: boolean) => void;
  isCustomMode?: boolean;
  // Investment inputs for fraud coverage sync
  investmentInputs?: import("@/lib/roiCalculations").InvestmentInputs;
  onInvestmentInputsChange?: (inputs: import("@/lib/roiCalculations").InvestmentInputs) => void;
  /** When a performance highlight is clicked, navigate to Forter KPI tab and focus this section (may open modals) */
  onNavigateToForterKPI?: (section: ForterKPIFocusSection) => void;
  /** When set, open the benefit modal for this calculator id (e.g. from ROI tab); clear on modal close */
  openBenefitCalculatorId?: string | null;
  onBenefitModalClose?: () => void;
  /** When user clicks "Generate Slides" in calculator modal, open report modal with this subset to create a calculator-only deck */
  onGenerateCalculatorSlides?: (subset: import("./GenerateReportModal").CalculatorSubsetForReport) => void;
}

export const ValueSummaryOptionA = ({
  formData,
  selectedChallenges,
  onFormDataChange,
  onForterKPIChange,
  onCustomCalculationsChange,
  onSegmentInputChange,
  onSegmentKPIChange,
  showInMillions: showInMillionsProp = false,
  onShowInMillionsChange,
  onSelectUseCases,
  onTotalsChange,
  onChallengeChange,
  isCustomMode = false,
  investmentInputs,
  onInvestmentInputsChange,
  onNavigateToForterKPI,
  openBenefitCalculatorId,
  onBenefitModalClose,
  onGenerateCalculatorSlides,
}: ValueSummaryOptionAProps) => {
  const forterKPIs = formData.forterKPIs || defaultForterKPIs;
  const [businessGrowthOpen, setBusinessGrowthOpen] = useState(true);
  const [riskAvoidanceOpen, setRiskAvoidanceOpen] = useState(true);
  const [riskMitigationOpen, setRiskMitigationOpen] = useState(true);
  const [selectedCalculatorId, setSelectedCalculatorId] = useState<string | null>(null);
  const [ebitdaChartModalOpen, setEbitdaChartModalOpen] = useState(false);
  const [calculatorModalTab, setCalculatorModalTab] = useState<'summary' | 'inputs' | 'calculator' | 'funnel' | 'visual' | 'success-stories'>('summary');
  const [funnelViewMode, setFunnelViewMode] = useState<'percent' | 'transactions'>('transactions');
  const [successStoriesViewed, setSuccessStoriesViewed] = useState<Set<string>>(new Set());
  const [funnelViewed, setFunnelViewed] = useState<Set<string>>(new Set());
  const [visualViewed, setVisualViewed] = useState<Set<string>>(new Set());
  const calculatorDialogRef = useRef<HTMLDivElement>(null);
  const [isCapturingBenefitPdf, setIsCapturingBenefitPdf] = useState(false);

  // When parent requests opening the benefit modal (e.g. from ROI tab), sync and open
  useEffect(() => {
    if (openBenefitCalculatorId != null && openBenefitCalculatorId !== '') {
      setSelectedCalculatorId(openBenefitCalculatorId);
      setCalculatorModalTab('summary');
    }
  }, [openBenefitCalculatorId]);

  // Duplicate (standalone) calculator helpers – standard pathway only
  const isDuplicateCalculator = (id: string) => !!(formData.standaloneCalculators?.[id]);
  const getSourceCalculatorId = (id: string) => formData.standaloneCalculators?.[id]?.sourceCalculatorId ?? id;

  /** When uplift is 0, show TBD unless enough inputs are entered to justify a 0 result (no improvement). */
  const normalizeZeroValueDriver = (driver: ValueDriver, data: CalculatorData): ValueDriver => {
    if (driver.value !== 0 || driver.isTBD || driver.id.startsWith("custom-")) return driver;
    const sourceId = data.standaloneCalculators?.[driver.id]?.sourceCalculatorId ?? driver.id;
    const applicableFormData = data.standaloneCalculators?.[driver.id]
      ? { ...data, ...data.standaloneCalculators[driver.id].inputs }
      : data;
    const hasSufficientInputs = getCalculatorCompletionPercentage(sourceId, applicableFormData) === 100;
    if (hasSufficientInputs) return driver;
    return { ...driver, isTBD: true };
  };
  const handleDuplicateCalculator = (driver: ValueDriver) => {
    const sourceId = getSourceCalculatorId(driver.id);
    const config = CALCULATOR_REQUIRED_INPUTS[sourceId];
    if (!config || !onFormDataChange) return;
    const inputs: Partial<CalculatorData> = {};
    config.requiredInputs.forEach((r) => {
      const v = formData[r.id as keyof CalculatorData];
      if (v !== undefined && v !== null) inputs[r.id as keyof CalculatorData] = v as number;
    });
    const newId = `${sourceId}-dup-${Date.now()}`;
    const next: Record<string, StandaloneCalculator> = {
      ...(formData.standaloneCalculators || {}),
      [newId]: {
        sourceCalculatorId: sourceId,
        customName: `${driver.label} (copy)`,
        inputs,
      },
    };
    onFormDataChange('standaloneCalculators' as keyof CalculatorData, next as any);
  };
  const handleRemoveDuplicateCalculator = (driverId: string) => {
    if (!formData.standaloneCalculators?.[driverId] || !onFormDataChange) return;
    const next = { ...formData.standaloneCalculators };
    delete next[driverId];
    onFormDataChange('standaloneCalculators' as keyof CalculatorData, next as any);
  };
  
  // Get analysis ID to scope localStorage keys per analysis
  const analysisId = (formData as any)._analysisId || 'default';
  
  // Persist driverStates to localStorage to survive tab navigation
  // Scope to analysis ID so each analysis has its own driver states
  // Type: true = enabled, false = disabled but visible, 'removed' = completely removed, undefined = default (enabled)
  const DRIVER_STATES_KEY = `forter_value_assessment_driver_states_${analysisId}`;
  const [driverStates, setDriverStates] = useState<{ [key: string]: boolean | 'removed' }>(() => {
    try {
      const saved = localStorage.getItem(DRIVER_STATES_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  
  // Reload driverStates when analysis ID changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRIVER_STATES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { [key: string]: boolean | 'removed' };
        setDriverStates(parsed);
      } else {
        setDriverStates({});
      }
    } catch {
      setDriverStates({});
    }
  }, [analysisId]);
  
  // Save driverStates to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(DRIVER_STATES_KEY, JSON.stringify(driverStates));
    } catch (error) {
      console.error('Failed to save driver states to localStorage:', error);
    }
  }, [driverStates, DRIVER_STATES_KEY]);
  
  // Track specifically which benefit IDs were added in custom mode (for benefits that share challenge IDs)
  // Persist to localStorage to survive component remounts
  // Scope to analysis ID so each analysis has its own enabled benefits
  const ENABLED_BENEFIT_IDS_KEY = `forter_value_assessment_enabled_benefit_ids_${analysisId}`;
  const [enabledBenefitIds, setEnabledBenefitIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(ENABLED_BENEFIT_IDS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return new Set(Array.isArray(parsed) ? parsed : []);
      }
    } catch {
      // Ignore parse errors
    }
    return new Set();
  });
  
  // Reload enabledBenefitIds when analysis ID changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ENABLED_BENEFIT_IDS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const newSet = new Set(Array.isArray(parsed) ? parsed : []);
        setEnabledBenefitIds(newSet);
      } else {
        setEnabledBenefitIds(new Set());
      }
    } catch {
      setEnabledBenefitIds(new Set());
    }
  }, [analysisId]);
  
  // Save enabledBenefitIds to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(ENABLED_BENEFIT_IDS_KEY, JSON.stringify(Array.from(enabledBenefitIds)));
    } catch (error) {
      console.error('Failed to save enabled benefit IDs to localStorage:', error);
    }
  }, [enabledBenefitIds, ENABLED_BENEFIT_IDS_KEY]);

  // In custom mode: edit standard benefit/calculator display name
  const [editingBenefitId, setEditingBenefitId] = useState<string | null>(null);
  const [editingBenefitName, setEditingBenefitName] = useState("");
  const saveCustomBenefitName = (driverId: string, newName: string) => {
    const trimmed = newName.trim();
    const prev = formData.customBenefitNames || {};
    const next = { ...prev };
    if (trimmed) next[driverId] = trimmed;
    else delete next[driverId];
    onFormDataChange?.("customBenefitNames", next);
    setEditingBenefitId(null);
  };

  // Protect c1-revenue from being removed if c1 benefit is enabled
  // This ensures c1-revenue stays visible even if something tries to mark it as removed
  useEffect(() => {
    if (enabledBenefitIds.has('c1') && driverStates['c1-revenue'] === 'removed') {
      console.log('[useEffect] PROTECTING c1-revenue - c1 benefit is enabled but driver is marked as removed, clearing removed state');
      setDriverStates(prev => {
        const next = { ...prev };
        delete next['c1-revenue'];
        return next;
      });
    }
  }, [enabledBenefitIds, driverStates]);
  const deduplicationEnabled = formData._deduplicationEnabled ?? true;
  const setDeduplicationEnabled = useCallback((value: boolean) => {
    onFormDataChange?.('_deduplicationEnabled' as keyof CalculatorData, value);
  }, [onFormDataChange]);
  const deduplicationRetryRate = formData._deduplicationRetryRate ?? 50;
  const setDeduplicationRetryRate = useCallback((value: number) => {
    onFormDataChange?.('_deduplicationRetryRate' as keyof CalculatorData, value);
  }, [onFormDataChange]);
  const deduplicationSuccessRate = formData._deduplicationSuccessRate ?? 75;
  const setDeduplicationSuccessRate = useCallback((value: number) => {
    onFormDataChange?.('_deduplicationSuccessRate' as keyof CalculatorData, value);
  }, [onFormDataChange]);
  const [showDeduplicationInfo, setShowDeduplicationInfo] = useState(false);
  
  // Fraud chargeback coverage state - synced with investment modal bidirectionally
  const fraudCBCoverageEnabled = investmentInputs?.fraudManagement?.includesFraudCBCoverage ?? false;
  
  const setFraudCBCoverageEnabled = (enabled: boolean) => {
    if (onInvestmentInputsChange && investmentInputs) {
      onInvestmentInputsChange({
        ...investmentInputs,
        fraudManagement: {
          ...investmentInputs.fraudManagement,
          includesFraudCBCoverage: enabled,
        },
      });
    }
  };
  
  // Margin prompt state for GMV calculators
  const [showMarginPrompt, setShowMarginPrompt] = useState(false);
  const [pendingCalculatorId, setPendingCalculatorId] = useState<string | null>(null);
  
  // Custom calculation dialog state
  const [showCustomCalcDialog, setShowCustomCalcDialog] = useState(false);
  const [editingCustomCalcId, setEditingCustomCalcId] = useState<string | null>(null);
  const [customCalcName, setCustomCalcName] = useState('');
  const [customCalcValue, setCustomCalcValue] = useState('');
  const [customCalcCategory, setCustomCalcCategory] = useState<'gmv_uplift' | 'cost_reduction' | 'risk_mitigation'>('gmv_uplift');
  const [customCalcSourceUrl, setCustomCalcSourceUrl] = useState('');
  const [customCalcUploadedFile, setCustomCalcUploadedFile] = useState<string | null>(null);
  const [customCalcFileName, setCustomCalcFileName] = useState<string | null>(null);
  
  // Get custom calculations from formData
  const customCalculations = formData.customCalculations || [];
  
  // Use prop if provided, otherwise default to true
  const showInMillions = showInMillionsProp ?? false;
  const handleShowInMillionsChange = (checked: boolean) => {
    if (onShowInMillionsChange) {
      onShowInMillionsChange(checked);
    }
  };
  
  // Open dialog for adding new custom calculation
  const handleOpenAddDialog = () => {
    setEditingCustomCalcId(null);
    setCustomCalcName('');
    setCustomCalcValue('');
    setCustomCalcCategory('gmv_uplift');
    setCustomCalcSourceUrl('');
    setCustomCalcUploadedFile(null);
    setCustomCalcFileName(null);
    setShowCustomCalcDialog(true);
  };
  
  // Open dialog for editing existing custom calculation
  const handleEditCustomCalculation = (id: string) => {
    const calc = customCalculations.find(c => c.id === id);
    if (calc) {
      setEditingCustomCalcId(id);
      setCustomCalcName(calc.name);
      setCustomCalcValue(calc.value.toLocaleString());
      setCustomCalcCategory(calc.category);
      setCustomCalcSourceUrl(calc.sourceUrl || '');
      setShowCustomCalcDialog(true);
    }
  };
  
  // Handle saving (add or update) a custom calculation
  const handleSaveCustomCalculation = () => {
    const value = parseFloat(customCalcValue.replace(/,/g, ''));
    if (!customCalcName.trim() || isNaN(value) || value <= 0) {
      return;
    }
    
    // In custom mode, require either a URL or uploaded file
    const hasSourceLink = customCalcSourceUrl.trim().length > 0;
    const hasUploadedFile = !!customCalcUploadedFile;
    if (isCustomMode && !hasSourceLink && !hasUploadedFile) {
      return; // Block save without source
    }
    
    // Build source URL - prefer link, fall back to uploaded file reference
    const finalSourceUrl = hasSourceLink 
      ? customCalcSourceUrl.trim() 
      : customCalcUploadedFile 
        ? `[Uploaded: ${customCalcFileName}]` 
        : undefined;
    
    if (editingCustomCalcId) {
      // Update existing
      const updated = customCalculations.map(c => 
        c.id === editingCustomCalcId 
          ? { ...c, name: customCalcName.trim(), value, category: customCalcCategory, sourceUrl: finalSourceUrl }
          : c
      );
      onCustomCalculationsChange?.(updated);
    } else {
      // Add new
      const newCalc: CustomCalculation = {
        id: `custom-${Date.now()}`,
        name: customCalcName.trim(),
        value,
        category: customCalcCategory,
        sourceUrl: finalSourceUrl,
      };
      const updated = [...customCalculations, newCalc];
      onCustomCalculationsChange?.(updated);
    }
    
    // Reset form and close
    setEditingCustomCalcId(null);
    setCustomCalcName('');
    setCustomCalcValue('');
    setCustomCalcCategory('gmv_uplift');
    setCustomCalcSourceUrl('');
    setCustomCalcUploadedFile(null);
    setCustomCalcFileName(null);
    setShowCustomCalcDialog(false);
  };
  
  // Handle file upload for calculator
  const handleCalculatorFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Store file reference (we store the file name, in production this would upload to storage)
      setCustomCalcFileName(file.name);
      setCustomCalcUploadedFile(file.name);
    }
  };
  
  // Handle removing a custom calculation
  const handleRemoveCustomCalculation = (id: string) => {
    const updated = customCalculations.filter(c => c.id !== id);
    onCustomCalculationsChange?.(updated);
  };

  // Handle removing a standard benefit driver (in custom mode)
  // This hides the specific driver without removing the benefit, so other drivers from the same benefit remain visible
  const handleRemoveBenefit = (driverId: string) => {
    
    // Map driver ID back to challenge IDs
    const driverToChallenges: Record<string, string[]> = {
      'c1-revenue': ['1'],
      'c1-chargeback': ['1'],
      'c245-revenue': ['2', '4', '5'],
      'c245-chargeback': ['2', '4', '5'],
      'c3-review': ['3'],
      'c7-disputes': ['7'],
      'c7-opex': ['7'],
      'c8-returns': ['8'],
      'c8-inr': ['8'],
      'c9-cx-uplift': ['9'],
      'c9-cs-opex': ['9'],
      'c10-promotions': ['10', '11'],
      'c12-ato-opex': ['12', '13'],
      'c13-clv': ['12', '13'],
      'c14-marketing': ['14', '15'],
      'c14-reactivation': ['14', '15'], // Reactivation is part of challenge 14/15
      'c14-kyc': ['14', '15'],
    };
    
    // Map challenge IDs to possible benefit IDs (from BENEFIT_OPTIONS)
    const challengeToBenefitIds: Record<string, string[]> = {
      '1': ['c1', 'chargeback'],
      '2': ['c45', 'chargeback'], // Combined c2 and c45 into c45
      '3': ['c3'],
      '4': ['c45', 'chargeback'],
      '5': ['c45', 'chargeback'],
      '7': ['c7-revenue', 'c7-opex'],
      '8': ['c8-returns', 'c8-inr'],
      '9': ['c9', 'c9-cs-opex'],
      '10': ['c10'],
      '11': ['c10'],
      '12': ['c12', 'c13'],
      '13': ['c12', 'c13'],
      '14': ['c14-marketing', 'c14-kyc'],
      '15': ['c14-marketing', 'c14-kyc'],
    };
    
    // Get challenge IDs for this driver
    const challengeIds = driverToChallenges[driverId];
    if (!challengeIds) {
      return;
    }
    
      // Simply hide this specific driver by setting its state to 'removed'
      // This allows other drivers from the same benefit to remain visible
      // Use 'removed' to distinguish from false (disabled but visible from switch)
      setDriverStates(prev => {
        const next = { ...prev };
        next[driverId] = 'removed';
        return next;
      });
    
    // Check if this was the last visible driver from its benefit
    // If so, remove the benefit from enabledBenefitIds so it can be added again
    const driverToSpecificBenefitId: Record<string, string | null> = {
      'c1-revenue': 'c1',
      'c1-chargeback': 'chargeback', // Maps to unified chargeback benefit
      'c245-revenue': 'c45', // Now maps to c45 (combined c2 and c45)
      'c245-chargeback': 'chargeback', // Maps to unified chargeback benefit
      'c3-review': 'c3',
      'c7-disputes': 'c7-revenue',
      'c7-opex': 'c7-opex',
      'c8-returns': 'c8-returns',
      'c8-inr': 'c8-inr',
      'c9-cx-uplift': 'c9',
      'c9-cs-opex': 'c9-cs-opex', // Now standalone
      'c10-promotions': 'c10',
      'c12-ato-opex': 'c12',
      'c13-clv': 'c13',
      'c14-marketing': 'c14-marketing',
      'c14-reactivation': 'c14-marketing', // Reactivation is part of marketing benefit
      'c14-kyc': 'c14-kyc',
    };
    
    const benefitId = driverToSpecificBenefitId[driverId];
    if (benefitId && enabledBenefitIds.has(benefitId)) {
      // Check if any other drivers from this benefit are still visible
      // Include TBD drivers in the check - they count as "visible" even if value is 0
      const allDriversForBenefit = Object.keys(driverToSpecificBenefitId)
        .filter(did => driverToSpecificBenefitId[did] === benefitId);
      
      // Check if any other drivers from this benefit are visible
      // A driver is visible if it's not explicitly removed (driverStates[did] !== 'removed')
      // This includes TBD drivers that haven't been hidden
      const hasVisibleDriver = allDriversForBenefit.some(did => 
        did !== driverId && driverStates[did] !== 'removed'
      );
      
      // In custom mode, when X button removes the last driver, remove from enabledBenefitIds
      // This makes the benefit available again in the dropdown
      // When re-added, handleAddBenefit will clear the 'removed' state
      if (!hasVisibleDriver) {
        setEnabledBenefitIds(prev => {
          const next = new Set(prev);
          next.delete(benefitId);
          return next;
        });
      }
    }
    
    // Check if this driver was auto-created (not from a benefit in enabledBenefitIds)
    // If so, we may need to disable the challenges
    // Reuse the driverToSpecificBenefitId already declared above
    const specificBenefitId = driverToSpecificBenefitId[driverId];
    const isFromBenefit = specificBenefitId ? enabledBenefitIds.has(specificBenefitId) : false;
    
    // If driver was auto-created (not from a benefit), check if we should disable challenges
    if (!isFromBenefit && challengeIds && onChallengeChange) {
      // Check if any other drivers from the same challenges are still visible
      // Get all drivers that use these challenges
      const allDriversUsingChallenges: string[] = [];
      Object.keys(driverToChallenges).forEach(did => {
        const didChallenges = driverToChallenges[did];
        if (didChallenges && didChallenges.some(cid => challengeIds.includes(cid))) {
          allDriversUsingChallenges.push(did);
        }
      });
      
      // Check if any of these drivers are still enabled (not hidden)
      const otherDriversStillVisible = allDriversUsingChallenges
        .filter(did => did !== driverId)
        .some(did => driverStates[did] !== 'removed');
      
      // Also check if any benefits are still using these challenges
      const benefitsUsingChallenges = Array.from(enabledBenefitIds).some(benefitId => {
        return challengeIds.some(challengeId => {
          const benefitIdsForChallenge = challengeToBenefitIds[challengeId] || [];
          return benefitIdsForChallenge.includes(benefitId);
        });
      });
      
      // Only disable challenges if no other drivers or benefits are using them
      if (!otherDriversStillVisible && !benefitsUsingChallenges) {
        challengeIds.forEach(id => onChallengeChange(id, false));
      }
    }
  };

  const driverIconMap: Record<string, LucideIcon> = {
    "c1-revenue": TrendingUp,
    "c245-revenue": CreditCard,
    "c1-chargeback": ShieldCheck,
    "c245-chargeback": ShieldAlert,
    "c3-review": ClipboardList,
    "c7-disputes": RefreshCcw,
    "c7-opex": RefreshCcw,
    "c8-returns": Scale,
    "c8-inr": ShieldAlert,
    "c9-cx-uplift": TrendingUp,
    "c9-cs-opex": Zap,
    "c10-promotions": Shield,
    "c12-ato-opex": UserCheck,
    "c13-clv": UserCheck,
    "c14-marketing": Shield,
    "c14-reactivation": Zap,
    "c14-kyc": ClipboardList,
  };

  const solutionIconMap: Record<string, LucideIcon> = {
    Shield,
    CreditCard,
    FileText,
    Ban,
    UserCheck,
    Building,
  };

  const getDriverIcon = (driverId: string) => driverIconMap[driverId] ?? ArrowUpRight;
  // Use source calculator id for icon so duplicates show the same icon as their source
  const getIconForDriver = (driver: ValueDriver) =>
    driver.id.startsWith("custom-") ? Sparkles : getDriverIcon(getSourceCalculatorId(driver.id));

  // Get active solutions from selected challenges (for showing all relevant solutions)
  const selectedSolutions = useMemo(() => {
    const solutions = new Set<string>();
    Object.entries(selectedChallenges).forEach(([challengeId, isSelected]) => {
      if (isSelected) {
        const challenge = ALL_CHALLENGES.find(c => c.id === challengeId);
        if (challenge) {
          challenge.solutionMapping.forEach(solution => solutions.add(solution));
        }
      }
    });
    return solutions;
  }, [selectedChallenges]);

  // Map drivers to their associated solutions
  const driverToSolutions: Record<string, string[]> = {
    "c1-revenue": ["fraud-management"],
    "c1-chargeback": ["fraud-management"],
    "c245-revenue": ["fraud-management", "payments-optimization"],
    "c245-chargeback": ["fraud-management", "payments-optimization"],
    "c3-review": ["fraud-management"],
    "c7-disputes": ["dispute-management"],
    "c7-opex": ["dispute-management"],
    "c8-returns": ["policy-abuse-prevention"],
    "c8-inr": ["policy-abuse-prevention"],
    "c9-cx-uplift": ["policy-abuse-prevention"],
    "c9-cs-opex": ["policy-abuse-prevention"],
    "c10-promotions": ["policy-abuse-prevention"],
    "c12-ato-opex": ["account-protection"],
    "c13-clv": ["account-protection"],
    "c14-marketing": ["account-protection"],
    "c14-reactivation": ["account-protection"],
    "c14-kyc": ["account-protection"],
  };

  // Get enabled solutions based on which drivers are turned on
  const enabledSolutions = useMemo(() => {
    const solutions = new Set<string>();
    Object.entries(driverStates).forEach(([driverId, isEnabled]) => {
      if (isEnabled !== false && driverToSolutions[driverId]) {
        driverToSolutions[driverId].forEach(solution => solutions.add(solution));
      }
    });
    Object.keys(driverToSolutions).forEach(driverId => {
      if (driverStates[driverId] === undefined) {
        const isC1Driver = driverId.startsWith("c1-");
        const isC245Driver = driverId.startsWith("c245-");
        const isC3Driver = driverId === "c3-review";
        const isC7Driver = driverId.startsWith("c7-");
        const isC8Driver = driverId.startsWith("c8-");
        const isC9Driver = driverId.startsWith("c9-");
        const isC10Driver = driverId.startsWith("c10-");
        const isC12Driver = driverId === "c12-ato-opex";
        const isC13Driver = driverId === "c13-clv";
        const isC14Driver = driverId.startsWith("c14-");
        
        const driverExists = 
          (isC1Driver && selectedChallenges["1"]) ||
          (isC245Driver && (selectedChallenges["2"] || selectedChallenges["4"] || selectedChallenges["5"])) ||
          (isC3Driver && selectedChallenges["3"]) ||
          (isC7Driver && selectedChallenges["7"]) ||
          (isC8Driver && selectedChallenges["8"]) ||
          (isC9Driver && selectedChallenges["9"]) ||
          (isC10Driver && (selectedChallenges["10"] || selectedChallenges["11"])) ||
          (isC12Driver && (selectedChallenges["12"] || selectedChallenges["13"])) ||
          (isC13Driver && (selectedChallenges["12"] || selectedChallenges["13"])) ||
          (isC14Driver && (selectedChallenges["14"] || selectedChallenges["15"]));
        
        if (driverExists) {
          driverToSolutions[driverId].forEach(solution => solutions.add(solution));
        }
      }
    });
    return solutions;
  }, [driverStates, selectedChallenges]);

  const isChallenge1Selected = selectedChallenges["1"] === true;
  const isChallenge2Selected = selectedChallenges["2"] === true;
  const isChallenge3Selected = selectedChallenges["3"] === true;
  const isChallenge4Selected = selectedChallenges["4"] === true;
  const isChallenge5Selected = selectedChallenges["5"] === true;
  const isChallenge7Selected = selectedChallenges["7"] === true;
  const isChallenge8Selected = selectedChallenges["8"] === true;
  const isChallenge9Selected = selectedChallenges["9"] === true;
  const isChallenge10Selected = selectedChallenges["10"] === true;
  const isChallenge11Selected = selectedChallenges["11"] === true;
  const isChallenge12Selected = selectedChallenges["12"] === true;
  const isChallenge13Selected = selectedChallenges["13"] === true;
  const isChallenge14Selected = selectedChallenges["14"] === true;
  const isChallenge15Selected = selectedChallenges["15"] === true;

  const isChallenge245Selected =
    isChallenge2Selected || isChallenge4Selected || isChallenge5Selected;
  const isChallenge10_11Selected = isChallenge10Selected || isChallenge11Selected;
  const isChallenge12_13Selected = isChallenge12Selected || isChallenge13Selected;
  const isChallenge14_15Selected = isChallenge14Selected || isChallenge15Selected;

  // Helper to get enabled state: true/undefined = enabled, false = disabled, 'removed' = removed
  // Must be defined before useMemo hooks that use it
  const getDriverEnabled = (driverId: string): boolean => {
    const state = driverStates[driverId];
    return state === true || state === undefined;
  };

  // Challenge 1 calculations
  const challenge1Results = useMemo(() => {
    if (!isChallenge1Selected || isChallenge245Selected) return null;

    const currentApprovalRate = formData.amerPreAuthApprovalRate ?? 0;
    const currentCBRate = formData.fraudCBRate ?? 0;
    
    let approvalImprovement = forterKPIs.approvalRateImprovement ?? 4;
    if (forterKPIs.approvalRateIsAbsolute) {
      const targetApproval = Math.min(100, Math.max(0, forterKPIs.approvalRateImprovement ?? 4));
      approvalImprovement = Math.max(0, targetApproval - currentApprovalRate);
    }
    approvalImprovement = Math.min(approvalImprovement, 100 - currentApprovalRate);
    
    let cbReduction = forterKPIs.chargebackReduction ?? 50;
    if (forterKPIs.chargebackReductionIsAbsolute) {
      const targetCBRate = Math.max(0, forterKPIs.chargebackReduction ?? 0);
      if (currentCBRate > 0) {
        cbReduction = Math.max(0, ((currentCBRate - targetCBRate) / currentCBRate) * 100);
      } else {
        cbReduction = 0;
      }
    }
    cbReduction = Math.min(100, Math.max(0, cbReduction));

    const inputs: Challenge1Inputs = {
      transactionAttempts: formData.amerGrossAttempts ?? 0,
      transactionAttemptsValue: formData.amerAnnualGMV ?? 0,
      grossMarginPercent: formData.amerGrossMarginPercent ?? 0,
      approvalRate: currentApprovalRate,
      fraudChargebackRate: currentCBRate,
      isMarketplace: formData.isMarketplace ?? false,
      commissionRate: formData.commissionRate ?? 100,
      currencyCode: formData.baseCurrency || 'USD',
      completedAOV: formData.completedAOV,
      forterCompletedAOV: forterKPIs.forterCompletedAOV,
      recoveredAovMultiplier: forterKPIs.recoveredAovMultiplier ?? 1.15,
      forterApprovalRateImprovement: approvalImprovement,
      forterChargebackReduction: cbReduction,
      deduplication: { enabled: deduplicationEnabled, retryRate: deduplicationRetryRate, successRate: deduplicationSuccessRate },
      includesFraudCBCoverage: fraudCBCoverageEnabled,
      gmvToNetSalesDeductionPct: getGmvToNetSalesDeductionPct(formData),
    };

    return calculateChallenge1(inputs);
  }, [isChallenge1Selected, isChallenge245Selected, formData, forterKPIs, deduplicationEnabled, deduplicationRetryRate, deduplicationSuccessRate, fraudCBCoverageEnabled]);

  // Challenge 245 calculations
  const challenge245Results = useMemo(() => {
    if (!isChallenge245Selected) return null;

    const currentPreAuthRate = formData.amerPreAuthApprovalRate ?? 0;
    const currentPostAuthRate = formData.amerPostAuthApprovalRate ?? 0;
    const current3DSRate = formData.amer3DSChallengeRate ?? 0;
    const currentCBRate = formData.fraudCBRate ?? 0;
    
    let preAuthImprovement = 0;
    if (forterKPIs.preAuthIncluded !== false) {
      preAuthImprovement = forterKPIs.preAuthApprovalImprovement ?? 4;
      if (forterKPIs.preAuthApprovalIsAbsolute) {
        const targetPreAuth = Math.min(100, Math.max(0, forterKPIs.preAuthApprovalImprovement ?? 4));
        preAuthImprovement = targetPreAuth - currentPreAuthRate; // allow negative (Forter outcome below customer)
      }
      preAuthImprovement = Math.min(preAuthImprovement, 100 - currentPreAuthRate);
    }
    
    let postAuthImprovement = 0;
    let targetPostAuthRate: number | undefined = undefined;
    if (forterKPIs.postAuthIncluded !== false) {
      postAuthImprovement = forterKPIs.postAuthApprovalImprovement ?? 2;
      if (forterKPIs.postAuthApprovalIsAbsolute) {
        const targetPostAuth = Math.min(100, Math.max(0, forterKPIs.postAuthApprovalImprovement ?? 2));
        postAuthImprovement = targetPostAuth - currentPostAuthRate; // allow negative (Forter outcome below customer)
      }
      postAuthImprovement = Math.min(postAuthImprovement, 100 - currentPostAuthRate);
    } else {
      targetPostAuthRate = 100;
      postAuthImprovement = 100 - currentPostAuthRate;
    }
    
    let threeDSReduction = forterKPIs.threeDSReduction ?? 20;
    if (forterKPIs.threeDSReductionIsAbsolute) {
      const target3DSRate = Math.min(100, Math.max(0, forterKPIs.threeDSReduction ?? 0));
      threeDSReduction = Math.max(0, current3DSRate - target3DSRate);
    }
    threeDSReduction = Math.min(threeDSReduction, current3DSRate);
    
    let cbReduction = forterKPIs.chargebackReduction ?? 50;
    let targetCBRate: number;
    if (forterKPIs.chargebackReductionIsAbsolute) {
      targetCBRate = Math.max(0, forterKPIs.chargebackReduction ?? 0);
      if (currentCBRate > 0) {
        cbReduction = Math.max(0, ((currentCBRate - targetCBRate) / currentCBRate) * 100);
      } else {
        cbReduction = 0;
      }
    } else {
      cbReduction = forterKPIs.chargebackReduction ?? 50;
      targetCBRate = currentCBRate * (1 - cbReduction / 100);
    }
    cbReduction = Math.min(100, Math.max(0, cbReduction));

    const inputs: Challenge245Inputs = {
      transactionAttempts: formData.amerGrossAttempts ?? 0,
      transactionAttemptsValue: formData.amerAnnualGMV ?? 0,
      grossMarginPercent: formData.amerGrossMarginPercent ?? 0,
      preAuthApprovalRate: currentPreAuthRate,
      postAuthApprovalRate: currentPostAuthRate,
      creditCardPct: formData.amerCreditCardPct ?? 0,
      creditCard3DSPct: current3DSRate,
      threeDSFailureRate: formData.amer3DSAbandonmentRate ?? 0,
      issuingBankDeclineRate: formData.amerIssuingBankDeclineRate ?? 0,
      forter3DSAbandonmentRate: forterKPIs.forter3DSAbandonmentRate ?? formData.amer3DSAbandonmentRate ?? 0,
      forterIssuingBankDeclineRate: forterKPIs.forterIssuingBankDeclineRate ?? formData.amerIssuingBankDeclineRate ?? 0,
      fraudChargebackRate: currentCBRate,
      isMarketplace: formData.isMarketplace ?? false,
      commissionRate: formData.commissionRate ?? 100,
      currencyCode: formData.baseCurrency || 'USD',
      completedAOV: formData.completedAOV,
      forterCompletedAOV: forterKPIs.forterCompletedAOV,
      recoveredAovMultiplier: forterKPIs.recoveredAovMultiplier ?? 1.15,
      forterPreAuthImprovement: preAuthImprovement,
      forterPostAuthImprovement: postAuthImprovement,
      forter3DSReduction: threeDSReduction,
      forterChargebackReduction: cbReduction,
      forterTargetCBRate: targetCBRate,
      forterTargetPostAuthRate: targetPostAuthRate,
      deduplication: { enabled: deduplicationEnabled, retryRate: deduplicationRetryRate, successRate: deduplicationSuccessRate },
      includesFraudCBCoverage: fraudCBCoverageEnabled,
      gmvToNetSalesDeductionPct: getGmvToNetSalesDeductionPct(formData),
    };

    return calculateChallenge245(inputs);
  }, [isChallenge245Selected, formData, forterKPIs, deduplicationEnabled, deduplicationRetryRate, deduplicationSuccessRate, fraudCBCoverageEnabled]);

  // Segmented aggregate values - use when segmentation is enabled so Value Summary matches Total calculator
  const isSegmentationEnabled = formData.segmentationEnabled && (formData.segments?.filter(s => s.enabled).length ?? 0) > 0;
  
  const segmentedC1RevenueTotal = useMemo(() => {
    if (!isSegmentationEnabled || !isChallenge1Selected || isChallenge245Selected) return null;
    return computeSegmentedAggregateValue(
      formData, forterKPIs, "c1", "revenue",
      deduplicationEnabled, deduplicationRetryRate, deduplicationSuccessRate, fraudCBCoverageEnabled
    );
  }, [isSegmentationEnabled, isChallenge1Selected, isChallenge245Selected, formData, forterKPIs, deduplicationEnabled, deduplicationRetryRate, deduplicationSuccessRate, fraudCBCoverageEnabled]);
  
  const segmentedC1ChargebackTotal = useMemo(() => {
    if (!isSegmentationEnabled || !isChallenge1Selected || isChallenge245Selected) return null;
    return computeSegmentedAggregateValue(
      formData, forterKPIs, "c1", "chargeback",
      deduplicationEnabled, deduplicationRetryRate, deduplicationSuccessRate, fraudCBCoverageEnabled
    );
  }, [isSegmentationEnabled, isChallenge1Selected, isChallenge245Selected, formData, forterKPIs, deduplicationEnabled, deduplicationRetryRate, deduplicationSuccessRate, fraudCBCoverageEnabled]);
  
  const segmentedC245RevenueTotal = useMemo(() => {
    if (!isSegmentationEnabled || !isChallenge245Selected) return null;
    return computeSegmentedAggregateValue(
      formData, forterKPIs, "c245", "revenue",
      deduplicationEnabled, deduplicationRetryRate, deduplicationSuccessRate, fraudCBCoverageEnabled
    );
  }, [isSegmentationEnabled, isChallenge245Selected, formData, forterKPIs, deduplicationEnabled, deduplicationRetryRate, deduplicationSuccessRate, fraudCBCoverageEnabled]);
  
  const segmentedC245ChargebackTotal = useMemo(() => {
    if (!isSegmentationEnabled || !isChallenge245Selected) return null;
    return computeSegmentedAggregateValue(
      formData, forterKPIs, "c245", "chargeback",
      deduplicationEnabled, deduplicationRetryRate, deduplicationSuccessRate, fraudCBCoverageEnabled
    );
  }, [isSegmentationEnabled, isChallenge245Selected, formData, forterKPIs, deduplicationEnabled, deduplicationRetryRate, deduplicationSuccessRate, fraudCBCoverageEnabled]);

  // Aggregated calculator rows for Total view (used for completion rate when segment analysis is enabled)
  const segmentedC1AggregateRows = useMemo(() => {
    if (!isSegmentationEnabled || !isChallenge1Selected || isChallenge245Selected) return [];
    return computeSegmentedAggregateRows(
      formData, forterKPIs, "c1", "revenue",
      deduplicationEnabled, deduplicationRetryRate, deduplicationSuccessRate, fraudCBCoverageEnabled
    );
  }, [isSegmentationEnabled, isChallenge1Selected, isChallenge245Selected, formData, forterKPIs, deduplicationEnabled, deduplicationRetryRate, deduplicationSuccessRate, fraudCBCoverageEnabled]);

  const segmentedC245AggregateRows = useMemo(() => {
    if (!isSegmentationEnabled || !isChallenge245Selected) return [];
    return computeSegmentedAggregateRows(
      formData, forterKPIs, "c245", "revenue",
      deduplicationEnabled, deduplicationRetryRate, deduplicationSuccessRate, fraudCBCoverageEnabled
    );
  }, [isSegmentationEnabled, isChallenge245Selected, formData, forterKPIs, deduplicationEnabled, deduplicationRetryRate, deduplicationSuccessRate, fraudCBCoverageEnabled]);

  // Aggregated chargeback calculator rows for Total view (so callout matches calculator modal Total)
  const segmentedC1ChargebackAggregateRows = useMemo(() => {
    if (!isSegmentationEnabled || !isChallenge1Selected || isChallenge245Selected) return [];
    return computeSegmentedAggregateRows(
      formData, forterKPIs, "c1", "chargeback",
      deduplicationEnabled, deduplicationRetryRate, deduplicationSuccessRate, fraudCBCoverageEnabled
    );
  }, [isSegmentationEnabled, isChallenge1Selected, isChallenge245Selected, formData, forterKPIs, deduplicationEnabled, deduplicationRetryRate, deduplicationSuccessRate, fraudCBCoverageEnabled]);

  const segmentedC245ChargebackAggregateRows = useMemo(() => {
    if (!isSegmentationEnabled || !isChallenge245Selected) return [];
    return computeSegmentedAggregateRows(
      formData, forterKPIs, "c245", "chargeback",
      deduplicationEnabled, deduplicationRetryRate, deduplicationSuccessRate, fraudCBCoverageEnabled
    );
  }, [isSegmentationEnabled, isChallenge245Selected, formData, forterKPIs, deduplicationEnabled, deduplicationRetryRate, deduplicationSuccessRate, fraudCBCoverageEnabled]);
  
  // Aggregated deduplication breakdown for segmented analysis
  const segmentedDeduplicationBreakdown = useMemo(() => {
    if (!isSegmentationEnabled) return null;
    const challengeType = isChallenge245Selected ? "c245" : isChallenge1Selected ? "c1" : null;
    if (!challengeType) return null;
    return computeSegmentedAggregateDeduplicationBreakdown(
      formData, forterKPIs, challengeType,
      deduplicationEnabled, deduplicationRetryRate, deduplicationSuccessRate
    );
  }, [isSegmentationEnabled, isChallenge1Selected, isChallenge245Selected, formData, forterKPIs, deduplicationEnabled, deduplicationRetryRate, deduplicationSuccessRate]);

  // Funnel: use aggregated segment funnel when segment analysis is on (so Approved transactions aligns with Total completion rate)
  const funnelToShow = useMemo((): PaymentFunnelStage[] => {
    if (isSegmentationEnabled && isChallenge245Selected && segmentedC245AggregateRows.length > 0) {
      return computeSegmentedAggregateFunnel(
        formData, forterKPIs, deduplicationEnabled, deduplicationRetryRate, deduplicationSuccessRate, fraudCBCoverageEnabled
      );
    }
    return challenge245Results?.calculator1?.funnelBreakdown ?? [];
  }, [isSegmentationEnabled, isChallenge245Selected, segmentedC245AggregateRows.length, formData, forterKPIs, deduplicationEnabled, deduplicationRetryRate, deduplicationSuccessRate, fraudCBCoverageEnabled, challenge245Results?.calculator1?.funnelBreakdown]);

  /** Funnel slide data for c245-revenue "Generate Slides" so the subset deck includes the payments funnel slide. */
  const c245FunnelSlideDataForReport = useMemo((): FunnelSlideData | null => {
    if (!isChallenge245Selected || !funnelToShow?.length) return null;
    const funnelStages = funnelToShow.filter((s: PaymentFunnelStage) => !s.isPostCompletion);
    if (funnelStages.length === 0) return null;
    const totalTransactionAttempts = formData.segmentationEnabled && (formData.segments?.filter((s: { enabled?: boolean }) => s.enabled).length ?? 0) > 0
      ? (formData.segments ?? []).filter((s: { enabled?: boolean }) => s.enabled).reduce((sum: number, s: { inputs?: { grossAttempts?: number } }) => sum + (s.inputs?.grossAttempts ?? 0), 0)
      : (formData.amerGrossAttempts ?? 0);
    const breakdownForTotal = isSegmentationEnabled ? segmentedDeduplicationBreakdown : (challenge245Results?.calculator1?.deduplicationBreakdown ?? null);
    const totalRecoverableVol = funnelStages.reduce((sum, s) => sum + (s.recoverableVolume ?? 0), 0);
    const displayTotalRecoverable = breakdownForTotal?.approvedTxImprovement != null ? Math.round(breakdownForTotal.approvedTxImprovement) : totalRecoverableVol;
    const fmtVol = (n: number) => n.toLocaleString("en-US");
    const showAsTransactions = funnelViewMode === "transactions";
    const stages = funnelStages.map((stage: PaymentFunnelStage) => {
      const isAttempts = stage.id === "attempts";
      const isCompleted = stage.isCompleted;
      const pctRemaining = Math.min(100, stage.pctRemaining);
      const pctDeducted = Math.min(100, stage.pctOfAttempts);
      const countRemaining = Math.round(totalTransactionAttempts * (pctRemaining / 100));
      const countDeducted = Math.round(totalTransactionAttempts * (pctDeducted / 100));
      const currentVal = showAsTransactions
        ? (isAttempts ? String(totalTransactionAttempts) : (isCompleted ? fmtVol(countRemaining) : fmtVol(countDeducted)))
        : (isAttempts ? "100%" : `${stage.pctOfAttempts.toFixed(1)}%`);
      const recoverableVal = isAttempts ? "" : (stage.recoverableVolume != null ? fmtVol(Math.round(stage.recoverableVolume)) : "—");
      return { label: stage.label, currentVal, recoverableVal };
    });
    return {
      viewMode: funnelViewMode,
      totalTransactionAttempts,
      totalRecoverable: fmtVol(Math.round(displayTotalRecoverable)),
      stages,
    };
  }, [isChallenge245Selected, funnelToShow, funnelViewMode, formData, isSegmentationEnabled, segmentedDeduplicationBreakdown, challenge245Results?.calculator1?.deduplicationBreakdown]);

  const challenge3Results = useMemo(() => {
    if (!isChallenge3Selected) return null;

    const currentReviewPct = formData.manualReviewPct ?? 0;
    const currentTimePerReview = formData.timePerReview ?? 0;
    
    let reviewReduction = forterKPIs.manualReviewReduction ?? 5;
    if (forterKPIs.manualReviewIsAbsolute) {
      const targetReviewPct = Math.max(0, forterKPIs.manualReviewReduction ?? 0);
      reviewReduction = Math.max(0, currentReviewPct - targetReviewPct);
    }
    reviewReduction = Math.min(reviewReduction, currentReviewPct);
    
    let timeReductionPct = forterKPIs.reviewTimeReduction ?? 30;
    if (forterKPIs.reviewTimeIsAbsolute) {
      const targetTime = Math.max(0, forterKPIs.reviewTimeReduction ?? 0);
      const timeReductionMinutes = Math.max(0, currentTimePerReview - targetTime);
      if (currentTimePerReview > 0) {
        timeReductionPct = (timeReductionMinutes / currentTimePerReview) * 100;
      } else {
        timeReductionPct = 0;
      }
    }
    timeReductionPct = Math.min(100, Math.max(0, timeReductionPct));

    const inputs: Challenge3Inputs = {
      transactionAttempts: formData.amerGrossAttempts ?? 0,
      manualReviewPct: currentReviewPct,
      timePerReview: currentTimePerReview,
      hourlyReviewerCost: formData.hourlyReviewerCost ?? 0,
      currencyCode: formData.baseCurrency || 'USD',
      forterReviewReduction: reviewReduction,
      forterTimeReduction: timeReductionPct,
    };

    return calculateChallenge3(inputs);
  }, [isChallenge3Selected, formData, forterKPIs]);

  // Challenge 7 calculations
  const challenge7Results = useMemo(() => {
    if (!isChallenge7Selected) return null;

    const currentFraudDisputeRate = formData.fraudDisputeRate ?? 0;
    const currentFraudWinRate = formData.fraudWinRate ?? 0;
    const currentServiceDisputeRate = formData.serviceDisputeRate ?? 0;
    const currentServiceWinRate = formData.serviceWinRate ?? 0;
    
    let fraudDisputeImprovement = forterKPIs.fraudDisputeRateImprovement ?? 45;
    if (forterKPIs.fraudDisputeIsAbsolute) {
      const targetFraudDispute = Math.min(100, forterKPIs.fraudDisputeRateImprovement ?? 45);
      fraudDisputeImprovement = targetFraudDispute - currentFraudDisputeRate;
    }
    
    let fraudWinChange = forterKPIs.fraudWinRateChange ?? -10;
    if (forterKPIs.fraudWinRateIsAbsolute) {
      const targetFraudWin = Math.min(100, Math.max(0, forterKPIs.fraudWinRateChange ?? 0));
      fraudWinChange = targetFraudWin - currentFraudWinRate;
    }
    
    let serviceDisputeImprovement = forterKPIs.serviceDisputeRateImprovement ?? 65;
    if (forterKPIs.serviceDisputeIsAbsolute) {
      const targetServiceDispute = Math.min(100, forterKPIs.serviceDisputeRateImprovement ?? 65);
      serviceDisputeImprovement = targetServiceDispute - currentServiceDisputeRate;
    }
    
    let serviceWinChange = forterKPIs.serviceWinRateChange ?? -10;
    if (forterKPIs.serviceWinRateIsAbsolute) {
      const targetServiceWin = Math.min(100, Math.max(0, forterKPIs.serviceWinRateChange ?? 0));
      serviceWinChange = targetServiceWin - currentServiceWinRate;
    }

    // Determine if payment challenges are selected (affects how we get chargeback values)
    const hasPaymentChallenges = isChallenge1Selected || isChallenge245Selected;

    const inputs: Challenge7Inputs = {
      transactionAttempts: formData.amerGrossAttempts ?? 0,
      transactionAttemptsValue: formData.amerAnnualGMV ?? 0,
      fraudChargebackRate: formData.fraudCBRate ?? 0,
      fraudDisputeRate: currentFraudDisputeRate,
      fraudWinRate: currentFraudWinRate,
      serviceChargebackRate: formData.serviceCBRate ?? 0,
      serviceDisputeRate: currentServiceDisputeRate,
      serviceWinRate: currentServiceWinRate,
      avgTimeToReviewCB: formData.avgTimeToReviewCB ?? 0,
      annualCBDisputes: formData.annualCBDisputes ?? 0,
      costPerHourAnalyst: formData.costPerHourAnalyst ?? 0,
      currencyCode: formData.baseCurrency || 'USD',
      forterFraudDisputeImprovement: fraudDisputeImprovement,
      forterFraudWinChange: fraudWinChange,
      forterServiceDisputeImprovement: serviceDisputeImprovement,
      forterServiceWinChange: serviceWinChange,
      forterTargetReviewTime: forterKPIs.disputeTimeReduction ?? 5,
      // Direct value inputs for standalone Challenge 7 (when no payment challenges selected)
      estFraudChargebackValue: formData.estFraudChargebackValue,
      estServiceChargebackValue: formData.estServiceChargebackValue,
      hasPaymentChallenges,
      // Fraud chargeback coverage
      includesFraudCBCoverage: fraudCBCoverageEnabled,
    };

    return calculateChallenge7(inputs);
  }, [isChallenge7Selected, isChallenge1Selected, isChallenge245Selected, formData, forterKPIs, fraudCBCoverageEnabled]);

  // Challenge 8 calculations
  const challenge8Results = useMemo(() => {
    if (!isChallenge8Selected) return null;

    const benchmarks = forterKPIs.abuseBenchmarks || defaultAbuseBenchmarks;

    // Customer inputs: use formData only; default to 0 when unset so calculator never shows phantom numbers
    const inputs: Challenge8Inputs = {
      expectedRefundsVolume: formData.expectedRefundsVolume ?? 0,
      avgRefundValue: formData.avgRefundValue ?? 0,
      isMarketplace: formData.isMarketplace ?? false,
      commissionRate: formData.commissionRate ?? 100,
      grossMarginPercent: formData.amerGrossMarginPercent ?? 0,
      avgOneWayShipping: formData.avgOneWayShipping ?? 0,
      avgFulfilmentCost: formData.avgFulfilmentCost ?? 0,
      txProcessingFeePct: formData.txProcessingFeePct ?? 0,
      avgCSTicketCost: formData.avgCSTicketCost ?? 0,
      pctINRClaims: formData.pctINRClaims ?? 0,
      pctReplacedCredits: formData.pctReplacedCredits ?? 0,
      currencyCode: formData.baseCurrency || 'USD',
      forterCatchRate: forterKPIs.forterCatchRate ?? 90,
      abuseAovMultiplier: forterKPIs.abuseAovMultiplier ?? 1.5,
      egregiousReturnsAbusePct: benchmarks.egregiousReturnsAbusePct,
      egregiousInventoryLossPct: benchmarks.egregiousInventoryLossPct,
      egregiousINRAbusePct: benchmarks.egregiousINRAbusePct,
      nonEgregiousReturnsAbusePct: benchmarks.nonEgregiousReturnsAbusePct,
      nonEgregiousInventoryLossPct: benchmarks.nonEgregiousInventoryLossPct,
      forterEgregiousReturnsReduction: benchmarks.forterEgregiousReturnsReduction,
      forterEgregiousINRReduction: benchmarks.forterEgregiousINRReduction,
      forterNonEgregiousReturnsReduction: benchmarks.forterNonEgregiousReturnsReduction,
    };

    return calculateChallenge8(inputs);
  }, [isChallenge8Selected, formData, forterKPIs]);

  // Challenge 10 calculations
  const challenge10Results = useMemo(() => {
    if (!isChallenge10_11Selected) return null;

    const benchmarks = forterKPIs.abuseBenchmarks || defaultAbuseBenchmarks;

    const inputs: Challenge10Inputs = {
      transactionAttemptsValue: formData.amerAnnualGMV ?? 0,
      avgDiscountByAbusers: formData.avgDiscountByAbusers ?? 0,
      promotionAbuseCatchRateToday: formData.promotionAbuseCatchRateToday ?? 0,
      isMarketplace: formData.isMarketplace ?? false,
      commissionRate: formData.commissionRate ?? 100,
      grossMarginPercent: formData.amerGrossMarginPercent ?? 0,
      currencyCode: formData.baseCurrency || 'USD',
      forterCatchRate: forterKPIs.forterCatchRate ?? 90,
      abuseAovMultiplier: forterKPIs.abuseAovMultiplier ?? 1.5,
      promotionAbuseAsGMVPct: benchmarks.promotionAbuseAsGMVPct ?? 2,
      gmvToNetSalesDeductionPct: getGmvToNetSalesDeductionPct(formData),
    };

    return calculateChallenge10(inputs);
  }, [isChallenge10_11Selected, formData, forterKPIs]);

  // Challenge 9: Instant Refunds
  const challenge9Results = useMemo(() => {
    if (!isChallenge9Selected) return null;

    // Current eCommerce sales = Net sales ($) from Reduce false declines (c1) or Optimize payment funnel (c245), so it matches the funnel
    const getNetSalesFromCalc = (res: typeof challenge245Results) => {
      if (!res?.calculator1) return undefined;
      if (res.calculator1.customerNetSales != null) return res.calculator1.customerNetSales;
      const row = res.calculator1.rows?.find((r: { label?: string }) => r.label === 'Net sales ($)');
      return (row as { rawCustomerValue?: number } | undefined)?.rawCustomerValue;
    };
    const netSalesFromC245 = getNetSalesFromCalc(challenge245Results ?? null);
    const netSalesFromC1 = getNetSalesFromCalc(challenge1Results ?? null);
    const completedCount = getCompletedTransactionCount(formData, isChallenge1Selected, isChallenge245Selected);
    const effectiveAOV = formData.completedAOV ?? ((formData.amerGrossAttempts ?? 0) > 0 ? (formData.amerAnnualGMV ?? 0) / (formData.amerGrossAttempts ?? 1) : 0);
    const derivedEcommerceSales = completedCount * effectiveAOV;
    // When a payment calculator is on, use its Net sales only (never derived), so Instant refunds matches 129.9m
    const currentEcommerceSales = (isChallenge245Selected && netSalesFromC245 != null)
      ? netSalesFromC245
      : (isChallenge1Selected && netSalesFromC1 != null)
        ? netSalesFromC1
        : derivedEcommerceSales;

    const inputs: Challenge9Inputs = {
      currentEcommerceSales,
      commissionRate: formData.commissionRate ?? 100,
      grossMarginPercent: formData.amerGrossMarginPercent ?? 0,
      refundRate: formData.refundRate ?? 0,
      expectedRefundsVolume: formData.expectedRefundsVolume ?? 0,
      pctRefundsToCS: formData.pctRefundsToCS ?? 0,
      costPerCSContact: formData.costPerCSContact ?? 0,
      currencyCode: formData.baseCurrency || 'USD',
      isMarketplace: formData.isMarketplace ?? false,
      npsIncreaseFromInstantRefunds: forterKPIs.npsIncreaseFromInstantRefunds ?? 10,
      lseNPSBenchmark: forterKPIs.lseNPSBenchmark ?? 1,
      forterCSReduction: forterKPIs.forterCSReduction ?? 78,
    };

    return calculateChallenge9(inputs);
  }, [isChallenge9Selected, isChallenge1Selected, isChallenge245Selected, formData, forterKPIs, challenge1Results, challenge245Results]);

  // Challenge 12/13: ATO Protection
  const challenge12_13Results = useMemo(() => {
    if (!isChallenge12_13Selected) return null;

    // #region agent log
    const _formAvgSalary = formData.avgSalaryPerCSMember;
    if (typeof fetch !== 'undefined') { fetch('http://127.0.0.1:7242/ingest/48d8bace-9783-46c3-bd20-05ff6ac70f53',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ValueSummaryOptionA.tsx:challenge12_13',message:'ATO inputs',data:{formAvgSalary:_formAvgSalary,passed:(formData.avgSalaryPerCSMember != null && formData.avgSalaryPerCSMember !== '') ? Number(formData.avgSalaryPerCSMember) : 0},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{}); }
    // #endregion
    const inputs: Challenge12_13Inputs = {
      monthlyLogins: (formData.monthlyLogins != null && formData.monthlyLogins !== '') ? Number(formData.monthlyLogins) : 0,
      customerLTV: formData.customerLTV ?? 0,
      avgAppeasementValue: formData.avgAppeasementValue ?? 0,
      avgSalaryPerCSMember: (formData.avgSalaryPerCSMember != null && formData.avgSalaryPerCSMember !== '') ? Number(formData.avgSalaryPerCSMember) : 0,
      avgHandlingTimePerATOClaim: formData.avgHandlingTimePerATOClaim ?? 0,
      pctChurnFromATO: formData.pctChurnFromATO ?? 0,
      commissionRate: formData.commissionRate ?? 100,
      grossMarginPercent: formData.amerGrossMarginPercent ?? 0,
      currencyCode: formData.baseCurrency || 'USD',
      isMarketplace: formData.isMarketplace ?? false,
      pctFraudulentLogins: forterKPIs.pctFraudulentLogins ?? 1,
      churnLikelihoodFromATO: forterKPIs.churnLikelihoodFromATO ?? 50,
      atoCatchRate: forterKPIs.atoCatchRate ?? 90,
      currentAtoCatchRate: formData.currentAtoCatchRate ?? 0,
      gmvToNetSalesDeductionPct: getGmvToNetSalesDeductionPct(formData),
    };

    return calculateChallenge12_13(inputs);
  }, [isChallenge12_13Selected, formData, forterKPIs]);

  // Challenge 14/15: Sign-up Protection
  const challenge14_15Results = useMemo(() => {
    if (!isChallenge14_15Selected) return null;

    // #region agent log
    const _formMonthlySignups = formData.monthlySignups;
    if (typeof fetch !== 'undefined') { fetch('http://127.0.0.1:7242/ingest/48d8bace-9783-46c3-bd20-05ff6ac70f53',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ValueSummaryOptionA.tsx:challenge14_15',message:'Sign-up inputs',data:{formMonthlySignups:_formMonthlySignups,passed:(formData.monthlySignups != null && formData.monthlySignups !== '') ? Number(formData.monthlySignups) : 0},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{}); }
    // #endregion
    const inputs: Challenge14_15Inputs = {
      monthlySignups: (formData.monthlySignups != null && formData.monthlySignups !== '') ? Number(formData.monthlySignups) : 0,
      avgNewMemberBonus: formData.avgNewMemberBonus ?? 0,
      numDigitalCommunicationsPerYear: formData.numDigitalCommunicationsPerYear ?? 0,
      avgCostPerOutreach: formData.avgCostPerOutreach ?? 0,
      avgKYCCostPerAccount: formData.avgKYCCostPerAccount ?? 0,
      pctAccountsGoingThroughKYC: formData.pctAccountsGoingThroughKYC ?? 0,
      currencyCode: formData.baseCurrency || 'USD',
      pctFraudulentSignups: forterKPIs.pctFraudulentSignups ?? 10,
      forterFraudulentSignupReduction: forterKPIs.forterFraudulentSignupReduction ?? 95,
      forterKYCReduction: forterKPIs.forterKYCReduction ?? 80,
    };

    return calculateChallenge14_15(inputs);
  }, [isChallenge14_15Selected, formData, forterKPIs]);

  // Calculate total recovery rate for Challenge 7
  // Formula: Total Recovery Rate = Total Recoveries / (Est. Fraud Chargebacks + Est. Service Chargebacks)
  const totalRecoveryMetrics = useMemo(() => {
    if (!challenge7Results) return null;
    
    const transactionValue = formData.amerAnnualGMV || 0;
    const fraudCBRate = formData.fraudCBRate || 0.5;
    const serviceCBRate = formData.serviceCBRate || 0.2;
    const fraudDisputeRate = formData.fraudDisputeRate || 50;
    const fraudWinRate = formData.fraudWinRate || 70;
    const serviceDisputeRate = formData.serviceDisputeRate || 30;
    const serviceWinRate = formData.serviceWinRate || 50;
    
    // Est. number of fraud and service chargebacks (in $)
    const estFraudCB = transactionValue * (fraudCBRate / 100);
    const estServiceCB = transactionValue * (serviceCBRate / 100);
    const totalCB = estFraudCB + estServiceCB;
    
    if (totalCB === 0) return null;
    
    // Current: Total recoveries = (Fraud disputed * Fraud win rate) + (Service disputed * Service win rate)
    const custFraudDisputed = estFraudCB * (fraudDisputeRate / 100);
    const custFraudWon = custFraudDisputed * (fraudWinRate / 100);
    const custServiceDisputed = estServiceCB * (serviceDisputeRate / 100);
    const custServiceWon = custServiceDisputed * (serviceWinRate / 100);
    const custTotalRecoveries = custFraudWon + custServiceWon;
    const custTotalRecoveryRate = (custTotalRecoveries / totalCB) * 100;
    
    // Forter rates
    const fortFraudDisputeRate = Math.min(100, fraudDisputeRate + (forterKPIs.fraudDisputeIsAbsolute ? forterKPIs.fraudDisputeRateImprovement - fraudDisputeRate : forterKPIs.fraudDisputeRateImprovement));
    const fortFraudWinRate = Math.max(0, fraudWinRate + (forterKPIs.fraudWinRateIsAbsolute ? forterKPIs.fraudWinRateChange - fraudWinRate : forterKPIs.fraudWinRateChange));
    const fortServiceDisputeRate = Math.min(100, serviceDisputeRate + (forterKPIs.serviceDisputeIsAbsolute ? forterKPIs.serviceDisputeRateImprovement - serviceDisputeRate : forterKPIs.serviceDisputeRateImprovement));
    const fortServiceWinRate = Math.max(0, serviceWinRate + (forterKPIs.serviceWinRateIsAbsolute ? forterKPIs.serviceWinRateChange - serviceWinRate : forterKPIs.serviceWinRateChange));
    
    // Forter: Total recoveries = (Fraud disputed * Fraud win rate) + (Service disputed * Service win rate)
    const fortFraudDisputed = estFraudCB * (fortFraudDisputeRate / 100);
    const fortFraudWon = fortFraudDisputed * (fortFraudWinRate / 100);
    const fortServiceDisputed = estServiceCB * (fortServiceDisputeRate / 100);
    const fortServiceWon = fortServiceDisputed * (fortServiceWinRate / 100);
    const fortTotalRecoveries = fortFraudWon + fortServiceWon;
    const fortTotalRecoveryRate = (fortTotalRecoveries / totalCB) * 100;
    
    return {
      current: custTotalRecoveryRate,
      target: fortTotalRecoveryRate,
      increase: fortTotalRecoveryRate - custTotalRecoveryRate,
    };
  }, [challenge7Results, formData, forterKPIs]);

  // C7 dispute pipeline breakdown for Visual tab (Total chargebacks → Disputed → Won → Recovered)
  const c7PipelineMetrics = useMemo(() => {
    if (!challenge7Results) return null;
    const transactionAttemptsValue = formData.amerAnnualGMV ?? 0;
    const baseEstFraud = (formData.estFraudChargebackValue !== undefined && formData.estFraudChargebackValue > 0)
      ? formData.estFraudChargebackValue
      : transactionAttemptsValue * ((formData.fraudCBRate ?? 0) / 100);
    const estService = (formData.estServiceChargebackValue !== undefined && formData.estServiceChargebackValue > 0)
      ? formData.estServiceChargebackValue
      : transactionAttemptsValue * ((formData.serviceCBRate ?? 0) / 100);
    const totalCB = baseEstFraud + estService;
    const fraudDisputeRate = formData.fraudDisputeRate ?? 0;
    const fraudWinRate = formData.fraudWinRate ?? 0;
    const serviceDisputeRate = formData.serviceDisputeRate ?? 0;
    const serviceWinRate = formData.serviceWinRate ?? 0;
    let fraudDispImprovement = forterKPIs.fraudDisputeRateImprovement ?? 45;
    if (forterKPIs.fraudDisputeIsAbsolute) {
      fraudDispImprovement = Math.min(100, forterKPIs.fraudDisputeRateImprovement ?? 45) - fraudDisputeRate;
    }
    let fraudWinCh = forterKPIs.fraudWinRateChange ?? -10;
    if (forterKPIs.fraudWinRateIsAbsolute) {
      fraudWinCh = Math.min(100, Math.max(0, forterKPIs.fraudWinRateChange ?? 0)) - fraudWinRate;
    }
    let servDispImprovement = forterKPIs.serviceDisputeRateImprovement ?? 65;
    if (forterKPIs.serviceDisputeIsAbsolute) {
      servDispImprovement = Math.min(100, forterKPIs.serviceDisputeRateImprovement ?? 65) - serviceDisputeRate;
    }
    let servWinCh = forterKPIs.serviceWinRateChange ?? -10;
    if (forterKPIs.serviceWinRateIsAbsolute) {
      servWinCh = Math.min(100, Math.max(0, forterKPIs.serviceWinRateChange ?? 0)) - serviceWinRate;
    }
    const custFraudDisp = baseEstFraud * (fraudDisputeRate / 100);
    const custFraudWon = custFraudDisp * (fraudWinRate / 100);
    const fortFraudDisp = fraudCBCoverageEnabled ? 0 : baseEstFraud * Math.min(1, (fraudDisputeRate + fraudDispImprovement) / 100);
    const fortFraudWon = fraudCBCoverageEnabled ? 0 : fortFraudDisp * Math.max(0, (fraudWinRate + fraudWinCh) / 100);
    const custServDisp = estService * (serviceDisputeRate / 100);
    const custServWon = custServDisp * (serviceWinRate / 100);
    const fortServDisp = estService * Math.min(1, (serviceDisputeRate + servDispImprovement) / 100);
    const fortServWon = fortServDisp * Math.max(0, (serviceWinRate + servWinCh) / 100);
    // When fraud chargeback coverage is on, Visual tab shows service chargebacks only (no fraud CB in pipeline)
    if (fraudCBCoverageEnabled) {
      return {
        totalCB: estService,
        custDisputed: custServDisp,
        fortDisputed: fortServDisp,
        custWon: custServWon,
        fortWon: fortServWon,
      };
    }
    return {
      totalCB,
      custDisputed: custFraudDisp + custServDisp,
      fortDisputed: fortFraudDisp + fortServDisp,
      custWon: custFraudWon + custServWon,
      fortWon: fortFraudWon + fortServWon,
    };
  }, [challenge7Results, formData, forterKPIs, fraudCBCoverageEnabled]);

  // Build drivers with performance highlights
  const businessGrowthDrivers: ValueDriver[] = useMemo(() => {
    console.log('[businessGrowthDrivers] useMemo running with enabledBenefitIds:', Array.from(enabledBenefitIds));
    console.log('[businessGrowthDrivers] driverStates:', Object.keys(driverStates).filter(k => driverStates[k] === 'removed').map(k => `${k}:${driverStates[k]}`));
    const drivers: ValueDriver[] = [];

    // Challenge 1: Reduce false declines (Pre-auth only)
    // In custom mode, only show if c1 benefit is enabled AND c45 is NOT enabled (mutual exclusivity)
    const hasC1 = enabledBenefitIds.has('c1');
    const hasC45 = enabledBenefitIds.has('c45');
    console.log('[businessGrowthDrivers] hasC1:', hasC1, 'hasC45:', hasC45, 'isCustomMode:', isCustomMode);
    // Challenge 1: Reduce false declines
    // In custom mode, ONLY show if c1 benefit is explicitly enabled AND c45 is NOT enabled (mutual exclusivity)
    // In standard mode, show if challenge 1 is selected and challenge 245 is not selected
    // In custom mode, do NOT show if no benefits are selected (empty state)
    // IMPORTANT: In custom mode, don't check challenge selection - only check enabledBenefitIds
    const shouldShowC1 = !isCustomMode 
      ? (isChallenge1Selected && !isChallenge245Selected)  // Standard mode: show if challenge selected
      : (hasC1 && !hasC45);  // Custom mode: ONLY check enabledBenefitIds, ignore challenge selection
    // In custom mode, also show if benefit is enabled even if challenge isn't selected yet
    const shouldShowC1Always = isCustomMode && hasC1 && !hasC45;
    
    // Show c1-revenue driver if visibility conditions are met
    // In standard mode: show if challenge 1 is selected and challenge 245 is not selected
    // In custom mode: show if c1 benefit is enabled, c45 is not enabled, and challenge 245 is not selected
    if (shouldShowC1) {
      // In custom mode, always show if c1 benefit is enabled (shouldShowC1 ensures this)
      // In standard mode, show if challenge is selected
      const shouldShowDriver = !isCustomMode 
        ? (isChallenge1Selected && !isChallenge245Selected)  // Standard mode: show if challenge selected
        : true;  // Custom mode: if shouldShowC1 is true, we should show the driver
      
      // Debug logging for c1-revenue visibility
      if (hasC1) {
        console.log('[businessGrowthDrivers] c1-revenue visibility:', {
          shouldShowC1,
          shouldShowDriver,
          hasC1,
          hasC45,
          isChallenge1Selected,
          isChallenge245Selected,
          isCustomMode,
          challenge1Results: !!challenge1Results,
          driverState: driverStates['c1-revenue'],
          enabledBenefitIds: Array.from(enabledBenefitIds)
        });
      }
      
      if (shouldShowDriver) {
        if (challenge1Results) {
          // C1 only (no C2,4,5): use row d "Fraud approval rate (%)" — customer input and Forter outcome, plus uplift
          const rowsForC1 = isSegmentationEnabled && segmentedC1AggregateRows.length > 0
            ? segmentedC1AggregateRows
            : challenge1Results.calculator1.rows;
          const fraudApprovalRow = rowsForC1.find((r) => r.label === "Fraud approval rate (%)");
          const parsePct = (s: string) => (s ? parseFloat(String(s).replace("%", "").trim()) : 0) || 0;
          const currentApproval = fraudApprovalRow ? parsePct(fraudApprovalRow.customerInput) : 0;
          const targetApproval = fraudApprovalRow ? parsePct(fraudApprovalRow.forterOutcome) : 0;
          const percentChange = currentApproval > 0
            ? ((targetApproval - currentApproval) / currentApproval) * 100
            : 0;

          // Use segmented total if available; otherwise use global result
          const driverValue = (isSegmentationEnabled && segmentedC1RevenueTotal !== null)
            ? segmentedC1RevenueTotal
            : challenge1Results.calculator1.revenueUplift;
          const rowsForCalculator = isSegmentationEnabled && segmentedC1AggregateRows.length > 0
            ? segmentedC1AggregateRows
            : challenge1Results.calculator1.rows;

          drivers.push({
            id: "c1-revenue",
            label: "Reduce false declines and approve more transactions",
            value: driverValue,
            enabled: getDriverEnabled("c1-revenue"),
            calculatorTitle: "Reduce false declines and approve more transactions",
            calculatorRows: rowsForCalculator,
            performanceHighlight: {
              label: "Fraud approval rate",
              current: Math.round(currentApproval * 10) / 10,
              target: Math.round(targetApproval * 10) / 10,
              unit: "%",
              percentChange,
            },
          });
        } else {
          // Show TBD driver when challenge is selected but no results yet, or benefit is enabled in custom mode
          drivers.push({
            id: "c1-revenue",
            label: "Reduce false declines and approve more transactions",
            value: 0,
            enabled: getDriverEnabled("c1-revenue"),
            calculatorTitle: "Reduce false declines and approve more transactions",
            isTBD: true,
          });
        }
      }
    }

    // Challenge 2/4/5: Optimize payment funnel
    // In standard mode: show whenever challenge 2/4/5 is selected.
    // In custom mode: show if c45 benefit is enabled OR challenge 2/4/5 is selected (so selecting the challenge shows the benefit), and c1 is NOT enabled.
    const shouldShowC245 = !isCustomMode 
      ? isChallenge245Selected  // Standard mode: show whenever challenge 2/4/5 is selected
      : ((hasC45 || isChallenge245Selected) && !hasC1);  // Custom mode: show when challenge 2/4/5 selected or c45 enabled, and c1 not enabled
    const shouldShowC245Always = isCustomMode && (hasC45 || isChallenge245Selected) && !hasC1;
    
    // Debug logging for c245 visibility
    if (isCustomMode && (hasC45 || shouldShowC245)) {
      console.log('[businessGrowthDrivers] c245 visibility check:', {
        shouldShowC245,
        hasC45,
        hasC1,
        enabledBenefitIds: Array.from(enabledBenefitIds),
        driverState: driverStates['c245-revenue']
      });
    }
    
      // Debug logging for c245-revenue visibility
      if (hasC45 || shouldShowC245) {
        console.log('[businessGrowthDrivers] c245-revenue visibility:', {
          shouldShowC245,
          hasC45,
          hasC1,
          isChallenge1Selected,
          isChallenge245Selected,
          isCustomMode,
          challenge245Results: !!challenge245Results,
          enabledBenefitIds: Array.from(enabledBenefitIds),
          driverState: driverStates['c245-revenue']
        });
      }
    
    // Show c245-revenue driver if visibility conditions are met
    if (shouldShowC245) {
      // In custom mode, always show if c45 benefit is enabled
      // In standard mode, show whenever challenge 2/4/5 is selected
      const shouldShowDriver = !isCustomMode 
        ? isChallenge245Selected  // Standard mode: show whenever challenge 2/4/5 is selected
        : true;  // Custom mode: if shouldShowC245 is true, we should show the driver
      
      // In custom mode, also show TBD driver if no results yet
      const driverState = driverStates['c245-revenue'];
      const isRemoved = driverState === 'removed';
      
      if (shouldShowDriver && !isRemoved) {
        if (challenge245Results) {
          // Completion rate: when segment analysis is enabled use aggregated rows (same as Total calculator); otherwise use global calculator row
          const rowsForCompletion = isSegmentationEnabled && segmentedC245AggregateRows.length > 0
            ? segmentedC245AggregateRows
            : challenge245Results.calculator1.rows;
          const completionRateRow = rowsForCompletion.find((r) => r.label === "Completion rate (%)");
          const parsePct = (s: string) => (s ? parseFloat(String(s).replace("%", "").trim()) : 0) || 0;
          const currentCompletion = completionRateRow ? parsePct(completionRateRow.customerInput) : 0;
          const targetCompletion = completionRateRow ? parsePct(completionRateRow.forterOutcome) : 0;
          const percentChange = currentCompletion > 0
            ? ((targetCompletion - currentCompletion) / currentCompletion) * 100
            : 0;

          // Use segmented total if available; otherwise use global result
          const driverValue = (isSegmentationEnabled && segmentedC245RevenueTotal !== null)
            ? segmentedC245RevenueTotal
            : challenge245Results.calculator1.revenueUplift;
          const rowsForCalculator = isSegmentationEnabled && segmentedC245AggregateRows.length > 0
            ? segmentedC245AggregateRows
            : challenge245Results.calculator1.rows;

          drivers.push({
            id: "c245-revenue",
            label: "Optimize payment funnel",
            value: driverValue,
            enabled: getDriverEnabled("c245-revenue"),
            calculatorTitle: "Reduce false declines and optimize payments",
            calculatorRows: rowsForCalculator,
            performanceHighlight: {
              label: "Completion rate",
              current: Math.round(currentCompletion * 10) / 10,
              target: Math.round(targetCompletion * 10) / 10,
              unit: "%",
              percentChange,
            },
          });
        } else {
          // Show TBD driver when benefit is enabled but no results yet
          drivers.push({
            id: "c245-revenue",
            label: "Optimize payment funnel",
            value: 0,
            enabled: getDriverEnabled("c245-revenue"),
            calculatorTitle: "Reduce false declines and optimize payments",
            isTBD: true,
          });
        }
      }
    }

    // Challenge 9: Instant refunds CX uplift (GMV uplift)
    // In custom mode, ONLY show if c9 benefit is explicitly enabled (c9-cs-opex is now separate)
    // In standard mode, show if challenge 9 is selected
    const shouldShowC9 = !isCustomMode || enabledBenefitIds.has('c9');
    const shouldShowC9Always = isCustomMode && enabledBenefitIds.has('c9');
    
    if (challenge9Results && shouldShowC9) {
      const npsIncrease = forterKPIs.npsIncreaseFromInstantRefunds || 10;
      
      drivers.push({
        id: "c9-cx-uplift",
        label: "Instant refunds CX uplift",
        value: challenge9Results.calculator1.gmvUplift,
        enabled: getDriverEnabled("c9-cx-uplift"),
        calculatorTitle: "Instant refunds CX uplift",
        calculatorRows: challenge9Results.calculator1.rows,
        performanceHighlight: {
          label: "Expected NPS increase",
          current: 0,
          target: npsIncrease,
          unit: " pts",
        },
      });
    } else if ((isChallenge9Selected || shouldShowC9Always) && shouldShowC9) {
      // TBD driver when challenge selected but no inputs - also show if benefit is enabled in custom mode
      drivers.push({
        id: "c9-cx-uplift",
        label: "Instant refunds CX uplift",
        value: 0,
        enabled: getDriverEnabled("c9-cx-uplift"),
        calculatorTitle: "Instant refunds CX uplift",
        isTBD: true,
      });
    }

    // Challenge 10/11: Protect profitability from promotion abuse (GMV uplift – value is GMV recovered; deduction to net sales applied in EBITDA)
    const shouldShowC10 = !isCustomMode || enabledBenefitIds.has('c10');
    const shouldShowC10Always = isCustomMode && enabledBenefitIds.has('c10');
    if (challenge10Results && shouldShowC10) {
      const catchRate = forterKPIs.forterCatchRate ?? 90;
      drivers.push({
        id: "c10-promotions",
        label: "Protect profitability from promotion abuse",
        value: challenge10Results.calculator1.revenueUplift,
        enabled: getDriverEnabled("c10-promotions"),
        calculatorTitle: "Protect profitability from promotion abuse",
        calculatorRows: challenge10Results.calculator1.rows,
        performanceHighlight: {
          label: "Catch Rate",
          current: 0,
          target: catchRate,
          unit: "%",
        },
      });
    } else if ((isChallenge10_11Selected || shouldShowC10Always) && shouldShowC10) {
      drivers.push({
        id: "c10-promotions",
        label: "Protect profitability from promotion abuse",
        value: 0,
        enabled: getDriverEnabled("c10-promotions"),
        calculatorTitle: "Protect profitability from promotion abuse",
        isTBD: true,
      });
    }

    // Add custom GMV uplift calculations
    customCalculations
      .filter(c => c.category === 'gmv_uplift')
      .forEach(custom => {
        drivers.push({
          id: custom.id,
          label: `${custom.name} (Custom)`,
          value: custom.value,
          enabled: getDriverEnabled(custom.id),
          calculatorTitle: `${custom.name} (Custom)`,
          sourceUrl: custom.sourceUrl,
        });
      });

    // Duplicated calculators (standard pathway): each has its own inputs
    if (isCustomMode && formData.standaloneCalculators) {
      const runOpts = { deduplicationEnabled, deduplicationRetryRate, deduplicationSuccessRate, fraudCBCoverageEnabled };
      Object.entries(formData.standaloneCalculators).forEach(([dupId, dup]) => {
        if (STANDALONE_CALC_SECTION[dup.sourceCalculatorId] !== "gmv") return;
        const merged = { ...formData, ...dup.inputs };
        const result = runStandaloneCalculator(dup.sourceCalculatorId, merged, forterKPIs, runOpts);
        if (!result) return;
        const content = getChallengeBenefitContent(dup.sourceCalculatorId);
        const label = dup.customName ?? (content?.benefitTitle ? `${content.benefitTitle} (copy)` : `${dup.sourceCalculatorId} (copy)`);
        drivers.push({
          id: dupId,
          label,
          value: result.value,
          enabled: getDriverEnabled(dupId),
          calculatorTitle: label,
          calculatorRows: result.rows,
        });
      });
    }

    // Filter out drivers that have been removed (driverStates[driverId] === 'removed')
    // false = disabled but visible (switch off), 'removed' = completely removed (X button)
    // IMPORTANT: Protect c1-revenue and c245-revenue from being filtered out if their benefits are enabled
    const filtered = drivers.filter(driver => {
      const isRemoved = driverStates[driver.id] === 'removed';
      // If c1-revenue is marked as removed but c1 benefit is enabled, don't filter it out
      if (driver.id === 'c1-revenue' && isRemoved && enabledBenefitIds.has('c1')) {
        console.log('[businessGrowthDrivers] PROTECTING c1-revenue from being filtered out - c1 benefit is enabled');
        return true; // Don't filter out
      }
      // If c245-revenue is marked as removed but c45 benefit is enabled, don't filter it out
      if (driver.id === 'c245-revenue' && isRemoved && enabledBenefitIds.has('c45')) {
        console.log('[businessGrowthDrivers] PROTECTING c245-revenue from being filtered out - c45 benefit is enabled');
        return true; // Don't filter out
      }
      return !isRemoved;
    });
    return applyCustomBenefitNames(filtered, formData.customBenefitNames).map(d => normalizeZeroValueDriver(d, formData));
  }, [challenge1Results, challenge245Results, challenge9Results, challenge10Results, customCalculations, driverStates, formData, formData.customBenefitNames, formData.standaloneCalculators, forterKPIs, isChallenge1Selected, isChallenge245Selected, isChallenge9Selected, isChallenge10_11Selected, isCustomMode, enabledBenefitIds, deduplicationEnabled, deduplicationRetryRate, deduplicationSuccessRate, fraudCBCoverageEnabled, isSegmentationEnabled, segmentedC1AggregateRows, segmentedC245AggregateRows, segmentedC1ChargebackAggregateRows, segmentedC245ChargebackAggregateRows]);

  const riskAvoidanceDrivers: ValueDriver[] = useMemo(() => {
    const drivers: ValueDriver[] = [];

    // Reduce fraud chargebacks - adaptive based on which payment calculator is active
    // Show c1-chargeback if c1 is active, c245-chargeback if c45 is active
    // In custom mode, ONLY show if 'chargeback' benefit is explicitly enabled (not auto-show based on c1/c45)
    // In standard mode, show if payment challenges are selected
    const hasChargebackBenefit = enabledBenefitIds.has('chargeback');
    const hasC1ForChargeback = enabledBenefitIds.has('c1');
    const hasC45ForChargeback = enabledBenefitIds.has('c45');
    const hasPaymentChallengesSelected = isChallenge1Selected || isChallenge245Selected;
    // In custom mode, only show chargeback if it's explicitly enabled as a benefit
    // In standard mode, show if payment challenges are selected
    const shouldShowChargeback = !isCustomMode 
      ? (hasPaymentChallengesSelected)  // Standard mode: show if payment challenges selected
      : (hasChargebackBenefit);  // Custom mode: ONLY show if chargeback benefit is explicitly enabled
    const shouldShowChargebackAlways = isCustomMode && hasChargebackBenefit;
    
    // Determine which chargeback calculator to show based on active payment calculator
    // Priority: c45 > c1 (if both somehow active, prefer c45)
    // Only show chargeback drivers if chargeback benefit is explicitly enabled (in custom mode)
    // In standard mode, show based on challenge selection
    const showC1Chargeback = shouldShowChargeback && (
      (!isCustomMode && isChallenge1Selected && !isChallenge245Selected) ||
      (isCustomMode && hasChargebackBenefit && hasC1ForChargeback && !hasC45ForChargeback)
    );
    const showC245Chargeback = shouldShowChargeback && (
      (!isCustomMode && isChallenge245Selected) ||
      (isCustomMode && hasChargebackBenefit && hasC45ForChargeback && !hasC1ForChargeback)
    );
    
    if (showC1Chargeback && challenge1Results && shouldShowChargeback) {
      const rowsForCB = (isSegmentationEnabled && segmentedC1ChargebackAggregateRows.length > 0)
        ? segmentedC1ChargebackAggregateRows
        : challenge1Results.calculator2.rows;
      const cbRow = rowsForCB.find((r) => r.label === "Gross Fraud Chargeback Rate (%)");
      const currentCB = cbRow?.rawCustomerValue ?? formData.fraudCBRate ?? 0;
      const targetCBFromRow = cbRow?.rawForterValue;
      const targetCB = targetCBFromRow !== undefined && targetCBFromRow !== null
        ? targetCBFromRow
        : forterKPIs.chargebackReductionIsAbsolute
          ? (forterKPIs.chargebackReduction ?? 0)
          : currentCB * (1 - (forterKPIs.chargebackReduction ?? 50) / 100);
      const percentChange = currentCB > 0
        ? ((targetCB - currentCB) / currentCB) * 100
        : 0;

      // Use segmented total if available; otherwise use global result
      const driverValue = (isSegmentationEnabled && segmentedC1ChargebackTotal !== null)
        ? segmentedC1ChargebackTotal
        : challenge1Results.calculator2.costReduction;

      drivers.push({
        id: "c1-chargeback",
        label: "Reduce fraud chargebacks",
        value: driverValue,
        enabled: getDriverEnabled("c1-chargeback"),
        calculatorTitle: "Reduce fraud chargebacks",
        calculatorRows: challenge1Results.calculator2.rows,
        performanceHighlight: {
          label: "Fraud Chargeback Rate",
          current: currentCB,
          target: Math.max(0, targetCB),
          unit: "%",
          percentChange,
          decimals: 2,
        },
      });
    } else if (showC245Chargeback && challenge245Results && shouldShowChargeback) {
      const rowsForCB = (isSegmentationEnabled && segmentedC245ChargebackAggregateRows.length > 0)
        ? segmentedC245ChargebackAggregateRows
        : challenge245Results.calculator2.rows;
      const cbRow = rowsForCB.find((r) => r.label === "Gross Fraud Chargeback Rate (%)");
      const currentCB = cbRow?.rawCustomerValue ?? formData.fraudCBRate ?? 0;
      const targetCBFromRow = cbRow?.rawForterValue;
      const targetCB = targetCBFromRow !== undefined && targetCBFromRow !== null
        ? targetCBFromRow
        : forterKPIs.chargebackReductionIsAbsolute
          ? (forterKPIs.chargebackReduction ?? 0)
          : currentCB * (1 - (forterKPIs.chargebackReduction ?? 50) / 100);
      const percentChange = currentCB > 0
        ? ((targetCB - currentCB) / currentCB) * 100
        : 0;

      // Use segmented total if available; otherwise use global result
      const driverValue = (isSegmentationEnabled && segmentedC245ChargebackTotal !== null)
        ? segmentedC245ChargebackTotal
        : challenge245Results.calculator2.costReduction;

      drivers.push({
        id: "c245-chargeback",
        label: "Reduce fraud chargebacks",
        value: driverValue,
        enabled: getDriverEnabled("c245-chargeback"),
        calculatorTitle: "Reduce fraud chargebacks",
        calculatorRows: challenge245Results.calculator2.rows,
        performanceHighlight: {
          label: "Fraud Chargeback Rate",
          current: currentCB,
          target: Math.max(0, targetCB),
          unit: "%",
          percentChange,
          decimals: 2,
        },
      });
    } else if ((shouldShowChargebackAlways || (isChallenge1Selected && !isChallenge245Selected) || isChallenge245Selected) && shouldShowChargeback) {
      // TBD driver - show appropriate one based on which payment calculator is active
      const driverId = showC245Chargeback ? "c245-chargeback" : "c1-chargeback";
      drivers.push({
        id: driverId,
        label: "Reduce fraud chargebacks",
        value: 0,
        enabled: getDriverEnabled(driverId),
        calculatorTitle: "Reduce fraud chargebacks",
        isTBD: true,
      });
    }

    // Challenge 3: Reduce manual review costs
    // In custom mode, ONLY show if c3 benefit is explicitly enabled
    // In standard mode, show if challenge 3 is selected
    const shouldShowC3 = !isCustomMode || enabledBenefitIds.has('c3');
    const shouldShowC3Always = isCustomMode && enabledBenefitIds.has('c3');
    
    if (challenge3Results && shouldShowC3) {
      const currentReview = formData.manualReviewPct || 5;
      const targetReview = forterKPIs.manualReviewIsAbsolute 
        ? forterKPIs.manualReviewReduction 
        : currentReview - forterKPIs.manualReviewReduction;
      const percentChange = currentReview > 0 
        ? ((targetReview - currentReview) / currentReview) * 100 
        : 0;

      drivers.push({
        id: "c3-review",
        label: "Reduce manual review costs",
        value: challenge3Results.calculator1.costReduction,
        enabled: getDriverEnabled("c3-review"),
        calculatorTitle: "Reduce manual review workflow",
        calculatorRows: challenge3Results.calculator1.rows,
        performanceHighlight: {
          label: "Review Rate",
          current: currentReview,
          target: Math.max(0, targetReview),
          unit: "%",
          percentChange,
        },
      });
    } else if ((isChallenge3Selected || shouldShowC3Always) && shouldShowC3) {
      // TBD driver - also show if benefit is enabled in custom mode
      drivers.push({
        id: "c3-review",
        label: "Reduce manual review costs",
        value: 0,
        enabled: getDriverEnabled("c3-review"),
        calculatorTitle: "Reduce manual review workflow",
        isTBD: true,
      });
    }

    // Challenge 7: Chargeback disputes
    // In custom mode, only show the specific benefit that was added
    // In custom mode, ONLY show if benefit is explicitly enabled
    // In standard mode, show if challenge 7 is selected
    const shouldShowC7Revenue = !isCustomMode || enabledBenefitIds.has('c7-revenue');
    const shouldShowC7OpEx = !isCustomMode || enabledBenefitIds.has('c7-opex');
    const shouldShowC7RevenueAlways = isCustomMode && enabledBenefitIds.has('c7-revenue');
    const shouldShowC7OpExAlways = isCustomMode && enabledBenefitIds.has('c7-opex');
    
    if ((isChallenge7Selected || shouldShowC7RevenueAlways || shouldShowC7OpExAlways) && challenge7Results) {
      // Determine if this is TBD based on whether we have meaningful inputs
      const hasPaymentChallenges = isChallenge1Selected || isChallenge245Selected;
      
      // Check for meaningful recovery inputs - include dispute/win rates OR direct value inputs
      const hasFraudInputs = (formData.fraudDisputeRate !== undefined && formData.fraudDisputeRate > 0) || 
                              (formData.estFraudChargebackValue !== undefined && formData.estFraudChargebackValue > 0);
      const hasServiceInputs = (formData.serviceDisputeRate !== undefined && formData.serviceDisputeRate > 0) ||
                                (formData.estServiceChargebackValue !== undefined && formData.estServiceChargebackValue > 0);
      
      const hasMeaningfulRecoveryInputs = hasPaymentChallenges 
        ? (formData.amerAnnualGMV && formData.amerAnnualGMV > 0) 
        : (hasFraudInputs || hasServiceInputs);
      
      const recoveryIsTBD = !hasMeaningfulRecoveryInputs;
      
      if (shouldShowC7Revenue) {
        drivers.push({
          id: "c7-disputes",
          label: "Increase chargeback recoveries",
          value: challenge7Results.calculator1.costReduction,
          enabled: getDriverEnabled("c7-disputes"),
          calculatorTitle: "Increase chargeback recoveries",
          calculatorRows: challenge7Results.calculator1.rows,
          isTBD: recoveryIsTBD,
          performanceHighlight: totalRecoveryMetrics && !recoveryIsTBD ? {
            label: "Total Recovery Rate",
            current: totalRecoveryMetrics.current,
            target: totalRecoveryMetrics.target,
            unit: "%",
            percentChange: totalRecoveryMetrics.current > 0 
              ? ((totalRecoveryMetrics.target - totalRecoveryMetrics.current) / totalRecoveryMetrics.current) * 100 
              : 0,
          } : undefined,
        });
      }
      
      // Add OpEx efficiency as a separate driver
      if (shouldShowC7OpEx) {
        const opExIsTBD = !formData.annualCBDisputes || formData.annualCBDisputes === 0;
        const currentReviewTime = formData.avgTimeToReviewCB || 20;
        const targetReviewTime = forterKPIs.disputeTimeReduction ?? 5;
        const percentChange = currentReviewTime > 0 
          ? ((targetReviewTime - currentReviewTime) / currentReviewTime) * 100 
          : 0;

        drivers.push({
          id: "c7-opex",
          label: "Improve recovery efficiency (OpEx)",
          value: challenge7Results.calculator2.costReduction,
          enabled: getDriverEnabled("c7-opex"),
          calculatorTitle: "Improve recovery efficiency (OpEx)",
          calculatorRows: challenge7Results.calculator2.rows,
          isTBD: opExIsTBD,
          performanceHighlight: !opExIsTBD ? {
            label: "Avg. Time to Review",
            current: currentReviewTime,
            target: targetReviewTime,
            unit: " mins",
            percentChange,
          } : undefined,
        });
      }
    } else if (isChallenge7Selected || shouldShowC7RevenueAlways || shouldShowC7OpExAlways) {
      // Fallback TBD drivers if calculations fail - also show if benefit is enabled in custom mode
      if (shouldShowC7Revenue || shouldShowC7RevenueAlways) {
        drivers.push({
          id: "c7-disputes",
          label: "Increase chargeback recoveries",
          value: 0,
          enabled: getDriverEnabled("c7-disputes"),
          calculatorTitle: "Increase chargeback recoveries",
          isTBD: true,
        });
      }
      if (shouldShowC7OpEx || shouldShowC7OpExAlways) {
        drivers.push({
          id: "c7-opex",
          label: "Improve recovery efficiency (OpEx)",
          value: 0,
          enabled: getDriverEnabled("c7-opex"),
          calculatorTitle: "Improve recovery efficiency (OpEx)",
          isTBD: true,
        });
      }
    }

    // Challenge 9: Reduced CS ticket handling OpEx
    // In custom mode, only show if c9-cs-opex benefit is enabled (now standalone)
    // In custom mode, ONLY show if benefit is explicitly enabled
    // In standard mode, show if challenge 9 is selected
    const shouldShowC9OpEx = !isCustomMode || enabledBenefitIds.has('c9-cs-opex');
    const shouldShowC9OpExAlways = isCustomMode && enabledBenefitIds.has('c9-cs-opex');
    
    if (challenge9Results && shouldShowC9OpEx) {
      const csReduction = forterKPIs.forterCSReduction || 78;
      
      drivers.push({
        id: "c9-cs-opex",
        label: "Reduced CS ticket handling",
        value: challenge9Results.calculator2.costReduction,
        enabled: getDriverEnabled("c9-cs-opex"),
        calculatorTitle: "Reduced CS ticket handling OpEx",
        calculatorRows: challenge9Results.calculator2.rows,
        performanceHighlight: {
          label: "Expected % of instant refunds",
          current: 0,
          target: csReduction,
          unit: "%",
        },
      });
    } else if ((isChallenge9Selected || shouldShowC9OpExAlways) && shouldShowC9OpEx) {
      // TBD driver - also show if benefit is enabled in custom mode
      drivers.push({
        id: "c9-cs-opex",
        label: "Reduced CS ticket handling",
        value: 0,
        enabled: getDriverEnabled("c9-cs-opex"),
        calculatorTitle: "Reduced CS ticket handling OpEx",
        isTBD: true,
      });
    }

    // Challenge 12/13: ATO OpEx savings
    // In custom mode, only show the specific benefit that was added
    // In custom mode, ONLY show if benefit is explicitly enabled
    // In standard mode, show if challenge 12/13 is selected
    const shouldShowC12 = !isCustomMode || enabledBenefitIds.has('c12');
    const shouldShowC12Always = isCustomMode && enabledBenefitIds.has('c12');
    
    if (challenge12_13Results && shouldShowC12) {
      const atoCatchRate = forterKPIs.atoCatchRate || 90;
      
      drivers.push({
        id: "c12-ato-opex",
        label: "ATO protection OpEx savings",
        value: challenge12_13Results.calculator1.costReduction,
        enabled: getDriverEnabled("c12-ato-opex"),
        calculatorTitle: "ATO protection OpEx savings",
        calculatorRows: challenge12_13Results.calculator1.rows,
        performanceHighlight: {
          label: "ATO Catch Rate",
          current: 0,
          target: atoCatchRate,
          unit: "%",
        },
      });
    } else if ((isChallenge12_13Selected || shouldShowC12Always) && shouldShowC12) {
      // TBD driver - also show if benefit is enabled in custom mode
      drivers.push({
        id: "c12-ato-opex",
        label: "ATO protection OpEx savings",
        value: 0,
        enabled: getDriverEnabled("c12-ato-opex"),
        calculatorTitle: "ATO protection OpEx savings",
        isTBD: true,
      });
    }

    // Challenge 14/15: Sign-up protection cost savings
    // Per mapping: these calculator benefits map to Challenges 14/15 (Account Protection / sign-up).
    // Only show when (1) challenge 14 or 15 is selected (guided), or (2) benefit explicitly added (custom).
    const shouldShowC14Marketing = (isChallenge14_15Selected && !isCustomMode) || (isCustomMode && enabledBenefitIds.has('c14-marketing'));
    const shouldShowC14Kyc = (isChallenge14_15Selected && !isCustomMode) || (isCustomMode && enabledBenefitIds.has('c14-kyc'));
    
    // In custom mode, show KYC benefit if it's enabled, regardless of whether challenges are selected or results exist
    const shouldShowC14KycAlways = isCustomMode && enabledBenefitIds.has('c14-kyc');
    
    const shouldShowKYC = shouldShowC14Kyc || shouldShowC14KycAlways;
    
    // Check if we have valid calculation results (not just an empty object)
    const hasValidResults = challenge14_15Results && 
      challenge14_15Results.calculator1 && 
      challenge14_15Results.calculator2 && 
      challenge14_15Results.calculator3;
    
    if (hasValidResults) {
      const signupReduction = forterKPIs.forterFraudulentSignupReduction || 95;
      
      if (shouldShowC14Marketing) {
        drivers.push({
          id: "c14-marketing",
          label: "Protect marketing budget",
          value: challenge14_15Results.calculator1.costReduction,
          enabled: getDriverEnabled("c14-marketing"),
          calculatorTitle: "Protect marketing budget against duplicate accounts",
          calculatorRows: challenge14_15Results.calculator1.rows,
          performanceHighlight: {
            label: "Fraud Signup Reduction",
            current: 0,
            target: signupReduction,
            unit: "%",
          },
        });

        // Only add reactivation driver if it hasn't been explicitly removed
        if (driverStates["c14-reactivation"] !== 'removed') {
          drivers.push({
            id: "c14-reactivation",
            label: "Reduce re-activation costs",
            value: challenge14_15Results.calculator2.costReduction,
            enabled: driverStates["c14-reactivation"] === true || driverStates["c14-reactivation"] === undefined,
            calculatorTitle: "Reduce re-activation costs on fake accounts",
            calculatorRows: challenge14_15Results.calculator2.rows,
            performanceHighlight: {
              label: "Fraud Signup Reduction",
              current: 0,
              target: signupReduction,
              unit: "%",
            },
          });
        }
      }

      if (shouldShowKYC && challenge14_15Results.calculator3) {
        const kycReduction = forterKPIs.forterKYCReduction || 80;
        
        drivers.push({
          id: "c14-kyc",
          label: "Optimize KYC costs",
          value: challenge14_15Results.calculator3.costReduction,
          enabled: getDriverEnabled("c14-kyc"),
          calculatorTitle: "Optimize KYC costs",
          calculatorRows: challenge14_15Results.calculator3.rows,
          performanceHighlight: {
            label: "KYC Reduction",
            current: 0,
            target: kycReduction,
            unit: "%",
          },
        });
      }
    }
    
    // Show TBD drivers if challenge is selected OR if benefit is enabled in custom mode
    // Always show KYC if it's enabled in custom mode, regardless of challenge selection or results
    if (!hasValidResults) {
      // Show marketing drivers if challenge is selected or marketing benefit is enabled
      if ((isChallenge14_15Selected || shouldShowC14Marketing) && shouldShowC14Marketing) {
        drivers.push({
          id: "c14-marketing",
          label: "Protect marketing budget",
          value: 0,
          enabled: getDriverEnabled("c14-marketing"),
          calculatorTitle: "Protect marketing budget against duplicate accounts",
          isTBD: true,
        });
        // Only add reactivation driver if it hasn't been explicitly removed
        if (driverStates["c14-reactivation"] !== 'removed') {
          drivers.push({
            id: "c14-reactivation",
            label: "Reduce re-activation costs",
            value: 0,
            enabled: driverStates["c14-reactivation"] === true || driverStates["c14-reactivation"] === undefined,
            calculatorTitle: "Reduce re-activation costs on fake accounts",
            isTBD: true,
          });
        }
      }
      
      // Always show KYC if it's enabled in custom mode, even if challenge isn't selected
      if (shouldShowKYC) {
        drivers.push({
          id: "c14-kyc",
          label: "Optimize KYC costs",
          value: 0,
          enabled: getDriverEnabled("c14-kyc"),
          calculatorTitle: "Optimize KYC costs",
          isTBD: true,
        });
      }
    } else if (shouldShowC14KycAlways && !challenge14_15Results?.calculator3) {
      // Fallback: If we have results but KYC calculator3 doesn't exist, and KYC is enabled, show TBD
      // This handles edge cases where results exist but calculator3 is missing
      drivers.push({
        id: "c14-kyc",
        label: "Optimize KYC costs",
        value: 0,
        enabled: getDriverEnabled("c14-kyc"),
        calculatorTitle: "Optimize KYC costs",
        isTBD: true,
      });
    }

    // Add custom cost reduction calculations
    customCalculations
      .filter(c => c.category === 'cost_reduction')
      .forEach(custom => {
        drivers.push({
          id: custom.id,
          label: `${custom.name} (Custom)`,
          value: custom.value,
          enabled: getDriverEnabled(custom.id),
          calculatorTitle: `${custom.name} (Custom)`,
          sourceUrl: custom.sourceUrl,
        });
      });

    // Duplicated calculators (standard pathway): each has its own inputs
    if (isCustomMode && formData.standaloneCalculators) {
      const runOpts = { deduplicationEnabled, deduplicationRetryRate, deduplicationSuccessRate, fraudCBCoverageEnabled };
      Object.entries(formData.standaloneCalculators).forEach(([dupId, dup]) => {
        if (STANDALONE_CALC_SECTION[dup.sourceCalculatorId] !== "cost") return;
        const merged = { ...formData, ...dup.inputs };
        const result = runStandaloneCalculator(dup.sourceCalculatorId, merged, forterKPIs, runOpts);
        if (!result) return;
        const content = getChallengeBenefitContent(dup.sourceCalculatorId);
        const label = dup.customName ?? (content?.benefitTitle ? `${content.benefitTitle} (copy)` : `${dup.sourceCalculatorId} (copy)`);
        drivers.push({
          id: dupId,
          label,
          value: result.value,
          enabled: getDriverEnabled(dupId),
          calculatorTitle: label,
          calculatorRows: result.rows,
        });
      });
    }

    // Filter out drivers that have been removed (driverStates[driverId] === 'removed')
    // false = disabled but visible (switch off), 'removed' = completely removed (X button)
    const filtered = drivers.filter(driver => driverStates[driver.id] !== 'removed');
    return applyCustomBenefitNames(filtered, formData.customBenefitNames).map(d => normalizeZeroValueDriver(d, formData));
  }, [challenge1Results, challenge245Results, challenge3Results, challenge7Results, challenge9Results, challenge12_13Results, challenge14_15Results, customCalculations, totalRecoveryMetrics, driverStates, formData, formData.customBenefitNames, formData.standaloneCalculators, forterKPIs, isChallenge1Selected, isChallenge245Selected, isChallenge3Selected, isChallenge7Selected, isChallenge9Selected, isChallenge12_13Selected, isChallenge14_15Selected, isCustomMode, Array.from(enabledBenefitIds).sort().join(','), deduplicationEnabled, deduplicationRetryRate, deduplicationSuccessRate, fraudCBCoverageEnabled]);

  const riskMitigationDrivers: ValueDriver[] = useMemo(() => {
    const drivers: ValueDriver[] = [];

    // Challenge 8: Returns/INR abuse
    // In custom mode, only show the specific benefit that was added (not both)
    // In custom mode, ONLY show if benefit is explicitly enabled
    // In standard mode, show if challenge 8 is selected
    const shouldShowReturns = !isCustomMode || enabledBenefitIds.has('c8-returns');
    const shouldShowINR = !isCustomMode || enabledBenefitIds.has('c8-inr');
    const shouldShowReturnsAlways = isCustomMode && enabledBenefitIds.has('c8-returns');
    const shouldShowINRAlways = isCustomMode && enabledBenefitIds.has('c8-inr');
    
    if (challenge8Results) {
      const benchmarks = forterKPIs.abuseBenchmarks || defaultAbuseBenchmarks;
      const parseCount = (s: string | undefined) => Number(String(s ?? "").replace(/,/g, "")) || 0;

      // Returns: weighted average catch rate by volume of abuse caught (egregious vs non-egregious)
      let returnsCatchRate = (benchmarks.forterEgregiousReturnsReduction + benchmarks.forterNonEgregiousReturnsReduction) / 2;
      const c1Rows = challenge8Results.calculator1.rows;
      const rowEgr = c1Rows.find((r) => r.formula === "g = a*f");
      const rowNonEgr = c1Rows.find((r) => r.formula === "r = a*q");
      if (rowEgr && rowNonEgr) {
        const custEgr = parseCount(rowEgr.customerInput);
        const fortEgr = parseCount(rowEgr.forterOutcome);
        const custNonEgr = parseCount(rowNonEgr.customerInput);
        const fortNonEgr = parseCount(rowNonEgr.forterOutcome);
        const egrBlocked = Math.max(0, custEgr - fortEgr);
        const nonEgrBlocked = Math.max(0, custNonEgr - fortNonEgr);
        const totalBlocked = egrBlocked + nonEgrBlocked;
        if (totalBlocked > 0) {
          returnsCatchRate =
            (egrBlocked * benchmarks.forterEgregiousReturnsReduction + nonEgrBlocked * benchmarks.forterNonEgregiousReturnsReduction) / totalBlocked;
        }
      }

      const inrCatchRate = benchmarks.forterEgregiousINRReduction;

      if (shouldShowReturns) {
        drivers.push({
          id: "c8-returns",
          label: "Block returns abusers",
          value: challenge8Results.calculator1.costReduction,
          enabled: getDriverEnabled("c8-returns"),
          calculatorTitle: "Block/Dissuade returns abusers",
          calculatorRows: challenge8Results.calculator1.rows,
          performanceHighlight: {
            label: "Catch Rate",
            current: 0,
            target: returnsCatchRate,
            unit: "%",
          },
        });
      }

      if (shouldShowINR) {
        drivers.push({
          id: "c8-inr",
          label: "Block INR abusers",
          value: challenge8Results.calculator2.costReduction,
          enabled: getDriverEnabled("c8-inr"),
          calculatorTitle: "Block INR (Item Not Received) abusers",
          calculatorRows: challenge8Results.calculator2.rows,
          performanceHighlight: {
            label: "Catch Rate",
            current: 0,
            target: inrCatchRate,
            unit: "%",
          },
        });
      }
    } else if (isChallenge8Selected || shouldShowReturnsAlways || shouldShowINRAlways) {
      // TBD drivers - also show if benefit is enabled in custom mode
      if (shouldShowReturns || shouldShowReturnsAlways) {
        drivers.push({
          id: "c8-returns",
          label: "Block returns abusers",
          value: 0,
          enabled: getDriverEnabled("c8-returns"),
          calculatorTitle: "Block/Dissuade returns abusers",
          isTBD: true,
        });
      }
      if (shouldShowINR || shouldShowINRAlways) {
        drivers.push({
          id: "c8-inr",
          label: "Block INR abusers",
          value: 0,
          enabled: getDriverEnabled("c8-inr"),
          calculatorTitle: "Block INR (Item Not Received) abusers",
          isTBD: true,
        });
      }
    }

    // Challenge 12/13: CLV loss mitigation (risk mitigation category)
    // In custom mode, only show the specific benefit that was added
    // In custom mode, ONLY show if benefit is explicitly enabled
    // In standard mode, show if challenge 12/13 is selected
    const shouldShowC13 = !isCustomMode || enabledBenefitIds.has('c13');
    const shouldShowC13Always = isCustomMode && enabledBenefitIds.has('c13');
    
    if (challenge12_13Results && shouldShowC13) {
      const atoCatchRate = forterKPIs.atoCatchRate || 90;
      
      drivers.push({
        id: "c13-clv",
        label: "Mitigate CLV loss from ATO churn",
        value: challenge12_13Results.calculator2.profitUplift,
        enabled: getDriverEnabled("c13-clv"),
        calculatorTitle: "Mitigate customer lifetime value loss from ATO churn",
        calculatorRows: challenge12_13Results.calculator2.rows,
        performanceHighlight: {
          label: "ATO Catch Rate",
          current: 0,
          target: atoCatchRate,
          unit: "%",
        },
      });
    } else if ((isChallenge12_13Selected || shouldShowC13Always) && shouldShowC13) {
      // TBD driver - also show if benefit is enabled in custom mode
      drivers.push({
        id: "c13-clv",
        label: "Mitigate CLV loss from ATO churn",
        value: 0,
        enabled: getDriverEnabled("c13-clv"),
        calculatorTitle: "Mitigate customer lifetime value loss from ATO churn",
        isTBD: true,
      });
    }

    // Add custom risk mitigation calculations
    customCalculations
      .filter(c => c.category === 'risk_mitigation')
      .forEach(custom => {
        drivers.push({
          id: custom.id,
          label: `${custom.name} (Custom)`,
          value: custom.value,
          enabled: getDriverEnabled(custom.id),
          calculatorTitle: `${custom.name} (Custom)`,
          sourceUrl: custom.sourceUrl,
        });
      });

    // Duplicated calculators (standard pathway): each has its own inputs
    if (isCustomMode && formData.standaloneCalculators) {
      const runOpts = { deduplicationEnabled, deduplicationRetryRate, deduplicationSuccessRate, fraudCBCoverageEnabled };
      Object.entries(formData.standaloneCalculators).forEach(([dupId, dup]) => {
        if (STANDALONE_CALC_SECTION[dup.sourceCalculatorId] !== "risk") return;
        const merged = { ...formData, ...dup.inputs };
        const result = runStandaloneCalculator(dup.sourceCalculatorId, merged, forterKPIs, runOpts);
        if (!result) return;
        const content = getChallengeBenefitContent(dup.sourceCalculatorId);
        const label = dup.customName ?? (content?.benefitTitle ? `${content.benefitTitle} (copy)` : `${dup.sourceCalculatorId} (copy)`);
        drivers.push({
          id: dupId,
          label,
          value: result.value,
          enabled: getDriverEnabled(dupId),
          calculatorTitle: label,
          calculatorRows: result.rows,
        });
      });
    }

    // Filter out drivers that have been removed (driverStates[driverId] === 'removed')
    // false = disabled but visible (switch off), 'removed' = completely removed (X button)
    const filtered = drivers.filter(driver => driverStates[driver.id] !== 'removed');
    return applyCustomBenefitNames(filtered, formData.customBenefitNames).map(d => normalizeZeroValueDriver(d, formData));
  }, [challenge8Results, challenge10Results, challenge12_13Results, customCalculations, driverStates, formData, formData.customBenefitNames, formData.standaloneCalculators, forterKPIs, isChallenge8Selected, isChallenge10_11Selected, isChallenge12_13Selected, isCustomMode, Array.from(enabledBenefitIds).sort().join(','), deduplicationEnabled, deduplicationRetryRate, deduplicationSuccessRate, fraudCBCoverageEnabled]);

  // Blended abuse catch rate: weighted by cost reduction (returns vs INR)
  const blendedAbuseCatchRate = useMemo(() => {
    const returnsDriver = riskMitigationDrivers.find((d) => d.id === "c8-returns");
    const inrDriver = riskMitigationDrivers.find((d) => d.id === "c8-inr");
    const returnsVal = returnsDriver?.value ?? 0;
    const inrVal = inrDriver?.value ?? 0;
    const returnsRate = returnsDriver?.performanceHighlight?.target ?? forterKPIs.forterCatchRate ?? 90;
    const inrRate = inrDriver?.performanceHighlight?.target ?? forterKPIs.forterCatchRate ?? 90;
    if (returnsVal > 0 && inrVal > 0) {
      return (returnsVal * returnsRate + inrVal * inrRate) / (returnsVal + inrVal);
    }
    if (returnsVal > 0) return returnsRate;
    if (inrVal > 0) return inrRate;
    return forterKPIs.forterCatchRate ?? 90;
  }, [riskMitigationDrivers, forterKPIs.forterCatchRate]);

  // Combine all drivers for lookup
  const allDrivers = useMemo(() => [
    ...businessGrowthDrivers,
    ...riskAvoidanceDrivers,
    ...riskMitigationDrivers,
  ], [businessGrowthDrivers, riskAvoidanceDrivers, riskMitigationDrivers]);

  // Get the currently selected calculator data (live, not snapshot)
  // Use driver.label as modal title to match the Value Summary display
  // For TBD drivers OR zero-value drivers, return info needed to show benefit summary without calculator
  const selectedCalculator = useMemo(() => {
    if (!selectedCalculatorId) return null;
    const driver = allDrivers.find(d => d.id === selectedCalculatorId);
    if (!driver) return null;
    
    // In Custom mode, never treat zero-value as TBD - show calculator so user can enter inputs
    // In Guided mode, treat TBD or zero-value as TBD (hide calculator until inputs provided)
    const effectivelyTBD = isCustomMode 
      ? driver.isTBD && !driver.calculatorRows  // Only TBD in custom mode if explicitly marked AND no rows available
      : (driver.isTBD || driver.value === 0);
    
    // For TBD drivers (without calculator rows), return with isTBD flag
    if (effectivelyTBD && !driver.calculatorRows) {
      return {
        title: driver.label,
        rows: undefined,
        isTBD: true,
      };
    }
    
    // Return with calculator rows (even if value is 0 in custom mode)
    return {
      title: driver.label,
      rows: driver.calculatorRows,
      isTBD: effectivelyTBD,
    };
  }, [selectedCalculatorId, allDrivers]);

  // Modal context for duplicate calculators: merged formData and callback that updates duplicate's inputs
  const modalContext = useMemo(() => {
    if (!selectedCalculatorId) {
      return {
        sourceIdForModal: null as string | null,
        isDuplicateSelected: false,
        modalFormData: formData,
        modalOnFormDataChange: onFormDataChange,
      };
    }
    const sourceIdForModal = getSourceCalculatorId(selectedCalculatorId);
    const isDuplicateSelected = isDuplicateCalculator(selectedCalculatorId);
    const modalFormData =
      isDuplicateSelected && formData.standaloneCalculators?.[selectedCalculatorId]
        ? { ...formData, ...formData.standaloneCalculators[selectedCalculatorId].inputs }
        : formData;
    // Clamp payment-funnel percent fields to 0–100 when editing from calculator or inputs
    const clampPaymentFunnelPercent = (field: keyof CalculatorData, value: number | Record<string, string>): number | Record<string, string> => {
      if ((field === 'amer3DSAbandonmentRate' || field === 'amerIssuingBankDeclineRate') && typeof value === 'number') {
        return Math.max(0, Math.min(100, value));
      }
      return value;
    };
    // Global fields: always update main formData so calculator maths, ROI tab, and exports stay in sync
    const GLOBAL_FORM_FIELDS = new Set<keyof CalculatorData>(['gmvToNetSalesDeductionPct', 'amerGrossMarginPercent', 'commissionRate']);
    const modalOnFormDataChange = isDuplicateSelected
      ? (field: keyof CalculatorData, value: number) => {
          const v = clampPaymentFunnelPercent(field, value) as number;
          if (GLOBAL_FORM_FIELDS.has(field)) {
            onFormDataChange?.(field, v);
            return;
          }
          const dup = formData.standaloneCalculators![selectedCalculatorId];
          onFormDataChange?.('standaloneCalculators' as keyof CalculatorData, {
            ...(formData.standaloneCalculators || {}),
            [selectedCalculatorId]: { ...dup, inputs: { ...dup.inputs, [field]: v } },
          } as any);
        }
      : (field: keyof CalculatorData, value: number | Record<string, string>) => {
          const v = clampPaymentFunnelPercent(field, value);
          onFormDataChange?.(field, v);
        };
    return { sourceIdForModal, isDuplicateSelected, modalFormData, modalOnFormDataChange };
  }, [selectedCalculatorId, formData, onFormDataChange]);

  // Totals
  const businessGrowthTotal = businessGrowthDrivers.reduce(
    (sum, d) => sum + (d.enabled ? d.value : 0),
    0
  );
  const riskAvoidanceTotal = riskAvoidanceDrivers.reduce(
    (sum, d) => sum + (d.enabled ? d.value : 0),
    0
  );
  const riskMitigationTotal = riskMitigationDrivers.reduce(
    (sum, d) => sum + (d.enabled ? d.value : 0),
    0
  );
  const totalValue = businessGrowthTotal + riskAvoidanceTotal + riskMitigationTotal;

  // EBITDA calculation
  // Split standard drivers from custom GMV calculations for proper margin application
  const standardGrowthTotal = businessGrowthDrivers
    .filter(d => !d.id.startsWith('custom-'))
    .reduce((sum, d) => sum + (d.enabled ? d.value : 0), 0);
  const customGmvTotal = businessGrowthDrivers
    .filter(d => d.id.startsWith('custom-'))
    .reduce((sum, d) => sum + (d.enabled ? d.value : 0), 0);
  
  const grossMarginPercent = formData.amerGrossMarginPercent || 50;
  const isMarketplace = formData.isMarketplace || false;
  const commissionRate = formData.commissionRate || 100;
  // GMV to net sales deduction (sales tax, returns/cancellations) – same as in calculators
  const netSalesMultiplier = 1 - getGmvToNetSalesDeductionPct(formData) / 100;
  // EBITDA from GMV: value of approved → net sales (× (1-deduction%)) → then commission & margin
  const standardGmvProfitability = isMarketplace
    ? standardGrowthTotal * netSalesMultiplier * (commissionRate / 100) * (grossMarginPercent / 100)
    : standardGrowthTotal * netSalesMultiplier * (grossMarginPercent / 100);
  // Custom GMV calculations: apply same net sales deduction then margin
  const customGmvProfitability = customGmvTotal * netSalesMultiplier * (isMarketplace ? (commissionRate / 100) : 1) * (grossMarginPercent / 100);
  const gmvProfitability = standardGmvProfitability + customGmvProfitability;
  const ebitdaContribution = gmvProfitability + riskAvoidanceTotal + riskMitigationTotal;

  // Report totals to parent when they change
  // Use a ref to store the callback to prevent it from triggering re-renders
  const onTotalsChangeRef = useRef(onTotalsChange);
  onTotalsChangeRef.current = onTotalsChange;
  
  // Use useEffect instead of useMemo to avoid infinite re-render loops
  useEffect(() => {
    // Build breakdown arrays with challengeId mappings
    const gmvUpliftBreakdown = businessGrowthDrivers
      .filter(d => d.enabled && d.value > 0)
      .map(d => ({
        label: d.label,
        value: d.value,
        calculatorId: d.id,
        challengeId: d.id.startsWith('c1-') ? '1' : 
                    d.id.startsWith('c245-') ? '2' :
                    d.id.startsWith('c9-') ? '9' :
                    d.id.startsWith('c10-') ? '10' : undefined,
      }));
    
    const costReductionBreakdown = riskAvoidanceDrivers
      .filter(d => d.enabled && d.value > 0)
      .map(d => ({
        label: d.label,
        value: d.value,
        calculatorId: d.id,
        challengeId: d.id.startsWith('c1-') ? '1' :
                    d.id.startsWith('c245-') ? '2' :
                    d.id.startsWith('c3-') ? '3' :
                    d.id.startsWith('c7-') ? '7' :
                    d.id.startsWith('c9-') ? '9' :
                    d.id.startsWith('c12-') ? '12' :
                    d.id.startsWith('c14-') ? '14' : undefined,
      }));
    
    const riskMitigationBreakdown = riskMitigationDrivers
      .filter(d => d.enabled && d.value > 0)
      .map(d => ({
        label: d.label,
        value: d.value,
        calculatorId: d.id,
        challengeId: d.id.startsWith('c8-') ? '8' :
                    d.id.startsWith('c10-') ? '10' :
                    d.id.startsWith('c13-') ? '13' : undefined,
      }));

    const enabledDrivers = [...businessGrowthDrivers, ...riskAvoidanceDrivers, ...riskMitigationDrivers].filter(d => d.enabled);
    const driversWithQuantitativeValue = enabledDrivers.filter(d => !d.isTBD).length;
    const allBenefitDriversHaveQuantitativeValue = enabledDrivers.length > 0 && driversWithQuantitativeValue === enabledDrivers.length;
    const benefitDriversQuantitativeFraction = enabledDrivers.length > 0 ? driversWithQuantitativeValue / enabledDrivers.length : 0;

    onTotalsChangeRef.current?.({
      gmvUplift: businessGrowthTotal,
      costReduction: riskAvoidanceTotal,
      riskMitigation: riskMitigationTotal,
      ebitdaContribution,
      gmvUpliftBreakdown,
      costReductionBreakdown,
      riskMitigationBreakdown,
      allBenefitDriversHaveQuantitativeValue,
      benefitDriversQuantitativeFraction,
    });
  }, [businessGrowthTotal, riskAvoidanceTotal, riskMitigationTotal, ebitdaContribution, businessGrowthDrivers, riskAvoidanceDrivers, riskMitigationDrivers]);

  const hasTBDDrivers = allDrivers.some(d => d.isTBD);
  const hasAnyResults =
    challenge1Results ||
    challenge245Results ||
    challenge3Results ||
    challenge7Results ||
    challenge8Results ||
    challenge9Results ||
    challenge10Results ||
    challenge12_13Results ||
    challenge14_15Results ||
    hasTBDDrivers;

  // Waterfall chart: inline top 4 + Other; modal top 10 + Other
  const MAX_INLINE_CHART_BARS = 4;
  const MAX_FULL_CHART_BARS = 10;

  type WaterfallEntry = { name: string; value: number; base: number; isTotal: boolean };

  const sortedWaterfallRawData = useMemo(() => {
    const rawData: { name: string; value: number; base: number; isTotal: boolean; originalLabel: string }[] = [];
    const toMultiLine = (label: string) => label.split(" ").join("\n");
    // Use exact calculator names for EBITDA attribution chart (e.g. "Optimize payment funnel")
    const getBenefitLabel = (driver: { id: string; calculatorTitle?: string; label: string }) =>
      CALCULATOR_ID_TO_LABEL[driver.id]?.label ?? driver.calculatorTitle ?? driver.label ?? getChallengeBenefitContent(driver.id)?.benefitTitle ?? driver.label;
    // EBITDA from GMV: value → net sales (× (1-deduction%)) → then commission & margin (align with calculators)
    const netSalesMultiplier = 1 - getGmvToNetSalesDeductionPct(formData) / 100;
    const marginMultiplier = formData.isMarketplace
      ? ((formData.commissionRate || 100) / 100) * ((formData.amerGrossMarginPercent || 50) / 100)
      : (formData.amerGrossMarginPercent || 50) / 100;

    const nonCustomGrowthDrivers = businessGrowthDrivers.filter(d => !d.id.startsWith('custom-'));
    nonCustomGrowthDrivers.forEach((driver) => {
      if (driver.enabled && driver.value > 0) {
        const ebitdaValue = driver.value * netSalesMultiplier * marginMultiplier;
        const label = getBenefitLabel(driver);
        rawData.push({ name: toMultiLine(label), originalLabel: label, value: ebitdaValue, base: 0, isTotal: false });
      }
    });
    const customGmvDrivers = businessGrowthDrivers.filter(d => d.id.startsWith('custom-'));
    customGmvDrivers.forEach((driver) => {
      if (driver.enabled && driver.value > 0) {
        const ebitdaValue = driver.value * netSalesMultiplier * marginMultiplier;
        const label = driver.calculatorTitle ?? driver.label;
        rawData.push({ name: toMultiLine(label), originalLabel: label, value: ebitdaValue, base: 0, isTotal: false });
      }
    });
    riskAvoidanceDrivers.forEach((driver) => {
      if (driver.enabled && driver.value > 0) {
        const label = getBenefitLabel(driver);
        rawData.push({ name: toMultiLine(label), originalLabel: label, value: driver.value, base: 0, isTotal: false });
      }
    });
    riskMitigationDrivers.forEach((driver) => {
      if (driver.enabled && driver.value > 0) {
        const label = getBenefitLabel(driver);
        rawData.push({ name: toMultiLine(label), originalLabel: label, value: driver.value, base: 0, isTotal: false });
      }
    });
    return [...rawData].sort((a, b) => b.value - a.value);
  }, [businessGrowthDrivers, riskAvoidanceDrivers, riskMitigationDrivers, formData.isMarketplace, formData.commissionRate, formData.amerGrossMarginPercent, formData.gmvToNetSalesDeductionPct, formData.country]);

  const buildWaterfallChartData = (sortedData: { name: string; value: number }[], maxBars: number): WaterfallEntry[] => {
    const chartData: WaterfallEntry[] = [];
    if (sortedData.length > maxBars) {
      const topBars = sortedData.slice(0, maxBars);
      const otherBars = sortedData.slice(maxBars);
      const otherTotal = otherBars.reduce((sum, item) => sum + item.value, 0);
      let runningTotal = 0;
      topBars.forEach((item) => {
        chartData.push({ name: item.name, value: item.value, base: runningTotal, isTotal: false });
        runningTotal += item.value;
      });
      if (otherTotal > 0) {
        chartData.push({ name: `Other\n(${otherBars.length})`, value: otherTotal, base: runningTotal, isTotal: false });
        runningTotal += otherTotal;
      }
    } else {
      let runningTotal = 0;
      sortedData.forEach((item) => {
        chartData.push({ name: item.name, value: item.value, base: runningTotal, isTotal: false });
        runningTotal += item.value;
      });
    }
    return chartData;
  };

  const waterfallData = useMemo(() => {
    const chartData = buildWaterfallChartData(sortedWaterfallRawData, MAX_INLINE_CHART_BARS);
    if (chartData.length > 0) {
      chartData.push({ name: "EBITDA\nContribution", value: ebitdaContribution, base: 0, isTotal: true });
    }
    return chartData;
  }, [sortedWaterfallRawData, ebitdaContribution]);

  const fullWaterfallData = useMemo(() => {
    const chartData = buildWaterfallChartData(sortedWaterfallRawData, MAX_FULL_CHART_BARS);
    if (chartData.length > 0) {
      chartData.push({ name: "EBITDA\nContribution", value: ebitdaContribution, base: 0, isTotal: true });
    }
    return chartData;
  }, [sortedWaterfallRawData, ebitdaContribution]);

  const currencyCode = formData.baseCurrency || "USD";
  const currencySymbol = getCurrencySymbol(currencyCode);

  const formatCurrency = (value: number): string => {
    const absValue = Math.abs(value);
    let formatted: string;
    
    // When showInMillions is on, ALWAYS show in millions with 1 decimal place
    if (showInMillions) {
      formatted = `${currencySymbol}${(absValue / 1000000).toFixed(1)}M`;
    } else {
      formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(absValue);
    }
    
    if (value < 0) return `(${formatted})`;
    if (value > 0) return `+${formatted}`;
    return formatted;
  };

  /** Round quarterly cost to a friendly readable number and return display string + tooltip copy */
  const getQuarterlyCostDisplay = (quarterly: number): { displayFormatted: string; exactFormatted: string; roundingNote: string } => {
    const abs = Math.abs(quarterly);
    let step: number;
    let roundingNote: string;
    if (abs >= 10_000_000) {
      step = 1_000_000;
      roundingNote = showInMillions ? "Rounded down to nearest million for readability." : "Rounded down to nearest 1M for readability.";
    } else if (abs >= 1_000_000) {
      step = 100_000;
      roundingNote = "Rounded down to nearest 100K for readability.";
    } else if (abs >= 100_000) {
      step = 25_000;
      roundingNote = "Rounded down to nearest 25K for readability.";
    } else if (abs >= 10_000) {
      step = 5_000;
      roundingNote = "Rounded down to nearest 5K for readability.";
    } else if (abs >= 1_000) {
      step = 1_000;
      roundingNote = "Rounded down to nearest 1K for readability.";
    } else if (abs >= 100) {
      step = 100;
      roundingNote = "Rounded down to nearest 100 for readability.";
    } else {
      step = 50;
      roundingNote = "Rounded down to nearest 50 for readability.";
    }
    const rounded = Math.floor(quarterly / step) * step;
    const exactFormatted = showInMillions
      ? `${currencySymbol}${(quarterly / 1_000_000).toFixed(2)}M`
      : new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(quarterly);
    const displayFormatted = showInMillions
      ? `~${currencySymbol}${(rounded / 1_000_000).toFixed(1)}M`
      : `~${new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(rounded)}`;
    return { displayFormatted, exactFormatted, roundingNote };
  };

  const handleDriverToggle = (driverId: string, enabled: boolean) => {
    // Switch should only toggle enabled state, not remove the driver
    // Use 'removed' for X button removal, false/true/undefined for enabled/disabled
    // Filter logic: only filter out 'removed', not false
    setDriverStates((prev) => {
      const currentState = prev[driverId];
      // If driver was explicitly removed (set to 'removed' by X button), don't allow switch to re-enable it
      if (currentState === 'removed') {
        return prev; // Don't allow switch to re-enable a removed driver
      }
      // Set enabled state: true = enabled, false = disabled but visible, undefined = enabled (default)
      return { ...prev, [driverId]: enabled ? true : false };
    });
  };

  // Check if margin data is needed for a calculator (only show "Additional Information needed" when actually missing)
  const needsMarginData = (driverId: string): boolean => {
    const gmvCalculators = ['c1-revenue', 'c245-revenue', 'c10-promotions'];
    const sourceId = getSourceCalculatorId(driverId);
    if (!gmvCalculators.includes(sourceId)) return false;

    const margin = formData.amerGrossMarginPercent;
    const hasGrossMargin = margin != null && Number(margin) > 0;
    const isRetailer = formData.isMarketplace === false || formData.isMarketplace === 0;
    const isMarketplace = formData.isMarketplace === true || formData.isMarketplace === 1;
    const commission = formData.commissionRate;
    const hasCommissionForMarketplace = isMarketplace && commission != null && Number(commission) > 0;

    if (hasGrossMargin && (isRetailer || hasCommissionForMarketplace)) return false;
    if (hasGrossMargin && !isMarketplace && formData.isMarketplace === undefined) return false;
    return true;
  };

  const handleDriverClick = (driver: ValueDriver) => {
    // Allow opening modal even when driver is disabled (greyed out) so users can view/edit calculator
    if (driver.calculatorRows || driver.isTBD) {
      // Check if we need margin data before opening calculator
      if (needsMarginData(driver.id)) {
        setPendingCalculatorId(driver.id);
        setShowMarginPrompt(true);
        return;
      }
      
      setSelectedCalculatorId(driver.id);
      // In custom mode, go directly to calculator tab so users can enter inputs
      setCalculatorModalTab(isCustomMode ? 'calculator' : 'summary');
    }
  };
  
  // Handle margin prompt save
  const handleMarginPromptSave = (grossMargin: number, isMarketplace: boolean, commissionRate?: number) => {
    // Update form data via parent callback
    onFormDataChange?.('amerGrossMarginPercent' as keyof CalculatorData, grossMargin);
    onFormDataChange?.('isMarketplace' as keyof CalculatorData, isMarketplace ? 1 : 0);
    if (commissionRate !== undefined) {
      onFormDataChange?.('commissionRate' as keyof CalculatorData, commissionRate);
    }
    
    // Open the pending calculator - go to calculator tab in custom mode
    if (pendingCalculatorId) {
      setSelectedCalculatorId(pendingCalculatorId);
      setCalculatorModalTab(isCustomMode ? 'calculator' : 'summary');
      setPendingCalculatorId(null);
    }
  };
  
  // Handle margin prompt skip
  const handleMarginPromptSkip = () => {
    // Open calculator anyway - go to calculator tab in custom mode
    if (pendingCalculatorId) {
      setSelectedCalculatorId(pendingCalculatorId);
      setCalculatorModalTab(isCustomMode ? 'calculator' : 'summary');
      setPendingCalculatorId(null);
    }
  };

  // Render inline comment for performance highlight (Option A style)
  const renderPerformanceHighlight = (highlight?: PerformanceHighlight) => {
    if (!highlight) return null;

    const decimals = highlight.decimals ?? 1;
    const isPositive = highlight.target >= highlight.current;
    const changeText = highlight.percentChange !== undefined
      ? `(${highlight.percentChange >= 0 ? "+" : ""}${highlight.percentChange.toFixed(1)}%)`
      : "";

    // If current is 0, just show the target value (e.g., for Catch Rate)
    const showOnlyTarget = highlight.current === 0;

    return (
      <p className="text-xs text-muted-foreground mt-1 pl-14">
        <span className="font-medium">{highlight.label}:</span>{" "}
        {showOnlyTarget ? (
          <span className="font-medium text-primary">{highlight.target.toFixed(decimals)}{highlight.unit}</span>
        ) : (
          <>
            <span className="text-foreground">{highlight.current.toFixed(decimals)}{highlight.unit}</span>
            <span className="mx-1">→</span>
            <span className="font-medium text-primary">{highlight.target.toFixed(decimals)}{highlight.unit}</span>
          </>
        )}
        {changeText && (
          <span className={`ml-1 font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}>
            {changeText}
          </span>
        )}
      </p>
    );
  };

  // Check if we have any challenges selected (not just results)
  const hasSelectedChallenges = Object.values(selectedChallenges).some(Boolean);
  const hasCustomCalculations = customCalculations.length > 0;
  
  // Map benefit IDs to calculator driver IDs
  const benefitToDriverId: Record<string, string> = {
    'c1': 'c1-revenue',
    'c3': 'c3-review',
    'c45': 'c245-revenue', // Combined c2 and c45 into one benefit
    'c7-revenue': 'c7-disputes',
    'c7-opex': 'c7-opex',
    'c8-returns': 'c8-returns',
    'c8-inr': 'c8-inr',
    'c9': 'c9-cx-uplift',
    'c10': 'c10-promotions',
    'c12': 'c12-ato-opex',
    'c13': 'c13-clv',
    'c14-marketing': 'c14-marketing',
    'c14-kyc': 'c14-kyc',
  };
  
  // Map benefit ID to driver IDs
  const benefitToDriverIds: Record<string, string[]> = {
    'c1': ['c1-revenue'],
    'c1-chargeback': ['c1-chargeback'],
    'c45': ['c245-revenue'],
    'c245-chargeback': ['c245-chargeback'],
    'chargeback': ['c1-chargeback', 'c245-chargeback'], // Adaptive - shows appropriate one based on active payment calculator
    'c3': ['c3-review'],
    'c7-revenue': ['c7-disputes'],
    'c7-opex': ['c7-opex'],
    'c8-returns': ['c8-returns'],
    'c8-inr': ['c8-inr'],
    'c9': ['c9-cx-uplift'],
    'c9-cs-opex': ['c9-cs-opex'],
    'c10': ['c10-promotions'],
    'c12': ['c12-ato-opex'],
    'c13': ['c13-clv'],
    'c14-marketing': ['c14-marketing', 'c14-reactivation'],
    'c14-kyc': ['c14-kyc'],
  };

  // Handle removing a benefit (for mutual exclusivity conflicts)
  const handleRemoveBenefitForConflict = (benefitId: string) => {
    try {
      // Map of benefits to their associated chargeback driver IDs
      const benefitToChargebackDrivers: Record<string, string[]> = {
        'c1': ['c1-chargeback'],
        'c45': ['c245-chargeback'],
      };
      
      // Get driver IDs for this benefit
      const driverIdsForBenefit = benefitToDriverIds[benefitId] || [];
      
      // Also get associated chargeback driver IDs if they exist
      const associatedChargebackDrivers = benefitToChargebackDrivers[benefitId];
      if (associatedChargebackDrivers) {
        driverIdsForBenefit.push(...associatedChargebackDrivers);
      }
      
      // DON'T remove 'chargeback' benefit here - it should remain if user added it separately
      // Only remove the chargeback drivers associated with this specific payment calculator
      
      // Mark all drivers as removed
      setDriverStates(prev => {
        const next = { ...prev };
        driverIdsForBenefit.forEach(driverId => {
          next[driverId] = 'removed';
        });
        return next;
      });
      
      // Remove from enabledBenefitIds and check challenges
      setEnabledBenefitIds(prev => {
        const next = new Set(prev);
        next.delete(benefitId);
        
        // DON'T remove 'chargeback' benefit - it can exist independently
        // Only remove it if it was the only thing using these challenges
        
        // Get the benefit to find its challenge IDs
        const benefit = BENEFIT_OPTIONS.find(b => b.id === benefitId);
        if (benefit) {
          // For mutual exclusivity conflicts, always disable the challenges
          // This ensures c1 challenges are disabled when c45 is added, and vice versa
          benefit.challengeIds.forEach(id => {
            onChallengeChange?.(id, false);
          });
        }
        
        return next;
      });
    } catch (error) {
      console.error('Error in handleRemoveBenefitForConflict:', error);
    }
  };

  // Handle replacing one benefit with another (for mutual exclusivity).
  // Uses a single atomic setState for benefit IDs so we never commit a state where both c1 and c45
  // are in the set (which would hide both) or where neither is (which would show neither).
  const handleReplaceBenefit = (removeBenefitId: string, addBenefitId: string, addChallengeIds: string[]) => {
    try {
      console.log('[handleReplaceBenefit] ========== STARTING REPLACEMENT ==========');
      console.log('[handleReplaceBenefit] removeBenefitId:', removeBenefitId);
      console.log('[handleReplaceBenefit] addBenefitId:', addBenefitId);
      console.log('[handleReplaceBenefit] addChallengeIds:', addChallengeIds);
      console.log('[handleReplaceBenefit] Current enabledBenefitIds BEFORE:', Array.from(enabledBenefitIds));
      console.log('[handleReplaceBenefit] Current driverStates BEFORE:', Object.keys(driverStates).filter(k => driverStates[k] === 'removed'));
      
      // Map of benefits to their associated chargeback driver IDs
      const benefitToChargebackDrivers: Record<string, string[]> = {
        'c1': ['c1-chargeback'],
        'c45': ['c245-chargeback'],
      };

      const hasChargebackBenefitBefore = enabledBenefitIds.has('chargeback');

      // Driver IDs to mark as removed (old benefit) — copy so we don't mutate benefitToDriverIds
      const driverIdsToRemove = [...(benefitToDriverIds[removeBenefitId] || [])];
      if (!hasChargebackBenefitBefore) {
        const associatedChargebackDrivers = benefitToChargebackDrivers[removeBenefitId];
        if (associatedChargebackDrivers) {
          driverIdsToRemove.push(...associatedChargebackDrivers);
        }
      }

      // Driver IDs to clear 'removed' for (new benefit)
      const driverIdsToAdd = [...(benefitToDriverIds[addBenefitId] || [])];
      const newChargebackDriver = benefitToChargebackDrivers[addBenefitId]?.[0];
      if (hasChargebackBenefitBefore && newChargebackDriver) {
        const index = driverIdsToAdd.indexOf(newChargebackDriver);
        if (index > -1) driverIdsToAdd.splice(index, 1);
      }

      const oldChargebackDriver = benefitToChargebackDrivers[removeBenefitId]?.[0];

      // 1) Atomic benefit ID swap: remove old, add new in one update so we never have both or neither.
      setEnabledBenefitIds(prev => {
        const next = new Set(prev);
        next.delete(removeBenefitId);
        next.add(addBenefitId);
        return next;
      });

      // 2) Single driver state update: mark old drivers removed, clear new drivers (and chargeback switch if needed).
      setDriverStates(prev => {
        const next = { ...prev };
        driverIdsToRemove.forEach(driverId => {
          if (!hasChargebackBenefitBefore || !driverId.includes('chargeback')) {
            next[driverId] = 'removed';
          }
        });
        if (hasChargebackBenefitBefore && oldChargebackDriver) {
          next[oldChargebackDriver] = 'removed';
        }
        if (hasChargebackBenefitBefore && newChargebackDriver && next[newChargebackDriver] === 'removed') {
          delete next[newChargebackDriver];
        }
        driverIdsToAdd.forEach(driverId => {
          if (next[driverId] === 'removed' || next[driverId] === false) delete next[driverId];
        });
        const newBenefitDrivers = benefitToDriverIds[addBenefitId] || [];
        newBenefitDrivers.forEach(driverId => {
          if (next[driverId] === 'removed' || next[driverId] === false) delete next[driverId];
        });
        return next;
      });

      // 3) Challenge selection: disable removed benefit's challenges, enable new benefit's challenges.
      const removeBenefit = BENEFIT_OPTIONS.find(b => b.id === removeBenefitId);
      if (removeBenefit) {
        removeBenefit.challengeIds.forEach(id => {
          if (!addChallengeIds.includes(id)) {
            onChallengeChange?.(id, false);
          }
        });
      }
      addChallengeIds.forEach(id => {
        onChallengeChange?.(id, true);
      });
    } catch (error) {
      console.error('Error in handleReplaceBenefit:', error);
    }
  };

  // Handle adding a benefit from BenefitSelector
  const handleAddBenefit = (challengeIds: string[], benefitId: string) => {
    try {
      // Special handling for 'chargeback' benefit - it can work standalone if challenges are selected
      // Check if challenges 1, 2, 4, or 5 are selected (payment-related challenges)
      if (benefitId === 'chargeback') {
        const hasPaymentChallenges = selectedChallenges['1'] || selectedChallenges['2'] || selectedChallenges['4'] || selectedChallenges['5'];
        const hasC1 = enabledBenefitIds.has('c1');
        const hasC45 = enabledBenefitIds.has('c45');
        
        // Allow chargeback if payment challenges are selected OR if c1/c45 is already enabled
        // This allows standalone chargeback addition when payment challenges are active
        if (!hasPaymentChallenges && !hasC1 && !hasC45) {
          // No payment challenges active - chargeback needs at least one payment calculator
          // But don't block it - let it be added and it will show when a payment calculator is added
        }
      }
      
      // Handle mutual exclusivity: if adding c45, disable c1 and vice versa
      if (benefitId === 'c45') {
        // Disable challenge 1 if it's selected
        if (selectedChallenges['1']) {
          onChallengeChange?.('1', false);
        }
      } else if (benefitId === 'c1') {
        // Disable challenges 2, 4, 5 if they're selected
        ['2', '4', '5'].forEach(id => {
          if (selectedChallenges[id]) {
            onChallengeChange?.(id, false);
          }
        });
      }
      
      // Clear 'removed' state for all drivers of this benefit when re-adding
      const driverIdsForBenefit = benefitToDriverIds[benefitId] || [];
      console.log('[handleAddBenefit] Adding benefit:', benefitId, 'Driver IDs:', driverIdsForBenefit);
      setDriverStates(prev => {
        const next = { ...prev };
        driverIdsForBenefit.forEach(driverId => {
          if (next[driverId] === 'removed') {
            // Clear the 'removed' state so the driver can be shown again
            console.log('[handleAddBenefit] Clearing removed state for driver:', driverId);
            delete next[driverId];
          }
        });
        
        // IMPORTANT: When adding chargeback, ensure c1-revenue is NOT removed if c1 is enabled
        // This prevents chargeback from accidentally removing c1-revenue
        if (benefitId === 'chargeback' && enabledBenefitIds.has('c1')) {
          if (next['c1-revenue'] === 'removed') {
            console.log('[handleAddBenefit] PROTECTING c1-revenue from being removed when chargeback is added');
            delete next['c1-revenue'];
          }
        }
        
        // IMPORTANT: When adding c1, ensure c1-revenue is never marked as removed
        if (benefitId === 'c1') {
          if (next['c1-revenue'] === 'removed') {
            console.log('[handleAddBenefit] PROTECTING c1-revenue - clearing removed state');
            delete next['c1-revenue'];
          }
          // Also ensure it's not set to removed in the future
          console.log('[handleAddBenefit] Ensuring c1-revenue is not removed for benefit c1');
        }
        
        console.log('[handleAddBenefit] Updated driverStates:', Object.keys(next).filter(k => next[k] === 'removed'));
        return next;
      });
      
      // Track the specific benefit ID being added (important for shared challenges like c8-returns/c8-inr)
      setEnabledBenefitIds(prev => {
        const next = new Set(prev);
        next.add(benefitId);
        return next;
      });
      
      // Enable the challenges for this benefit
      challengeIds.forEach(id => {
        onChallengeChange?.(id, true);
      });
      
      // In custom mode, DON'T automatically open the modal - let user click on the benefit from value summary
      // This allows them to see the benefit appear on the value summary page first
      // The modal will open when they click on the benefit driver
    } catch (error) {
      console.error('Error in handleAddBenefit:', error);
    }
  };
  
  // In custom mode, show the value summary if benefits are added, even if no results yet
  const hasAddedBenefits = isCustomMode && enabledBenefitIds.size > 0;
  
  if (!hasAnyResults && !hasCustomCalculations && !hasAddedBenefits) {
    return (
      <div className="space-y-6">
        {/* BenefitSelector for Custom Mode */}
        {isCustomMode && (
          <BenefitSelector 
            selectedChallenges={selectedChallenges}
            onAddBenefit={handleAddBenefit}
            onRemoveBenefit={handleRemoveBenefitForConflict}
            onReplaceBenefit={handleReplaceBenefit}
            enabledBenefitIds={enabledBenefitIds}
          />
        )}
        
        <Card className="p-12">
          <div className="text-center space-y-6 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
              <Scale className="w-8 h-8 text-muted-foreground" />
            </div>
            
            <div>
              <h3 className="text-xl font-semibold mb-2">
                {hasSelectedChallenges ? 'Enter Customer Data' : 'No Value Drivers Selected'}
              </h3>
              <p className="text-muted-foreground">
                {isCustomMode 
                  ? 'Add custom calculations or select a standard benefit calculator above'
                  : hasSelectedChallenges 
                    ? 'Please enter data in the Customer Inputs tab to see the value assessment.'
                    : 'Add custom calculations or go back to select use cases to build your value model'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={handleOpenAddDialog} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Custom Calculation
              </Button>
              {/* Hide "Select Use Cases" in custom mode */}
              {!isCustomMode && !hasSelectedChallenges && onSelectUseCases && (
                <Button variant="outline" onClick={onSelectUseCases} className="gap-2">
                  <ClipboardList className="w-4 h-4" />
                  Select Use Cases
                </Button>
              )}
            </div>
          </div>
        </Card>
        
        {/* Custom calculation dialog */}
        <Dialog open={showCustomCalcDialog} onOpenChange={setShowCustomCalcDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCustomCalcId ? 'Edit Custom Calculation' : 'Add Custom Calculation'}</DialogTitle>
              <DialogDescription>
                Add a value driver from an external calculator or spreadsheet
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="calc-name">Name</Label>
                <Input
                  id="calc-name"
                  placeholder="e.g., Regional fraud prevention savings"
                  value={customCalcName}
                  onChange={(e) => setCustomCalcName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="calc-value">Value ($)</Label>
                <Input
                  id="calc-value"
                  placeholder="e.g., 500,000"
                  value={customCalcValue}
                  onChange={(e) => setCustomCalcValue(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="calc-category">Category</Label>
                <Select value={customCalcCategory} onValueChange={(v) => setCustomCalcCategory(v as 'gmv_uplift' | 'cost_reduction' | 'risk_mitigation')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gmv_uplift">GMV Uplift</SelectItem>
                    <SelectItem value="cost_reduction">Cost Reduction</SelectItem>
                    <SelectItem value="risk_mitigation">Risk Mitigation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="calc-url">Calculator Link (optional)</Label>
                <Input
                  id="calc-url"
                  placeholder="e.g., https://docs.google.com/spreadsheets/..."
                  value={customCalcSourceUrl}
                  onChange={(e) => setCustomCalcSourceUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Link to the source calculator or spreadsheet
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCustomCalcDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveCustomCalculation}>{editingCustomCalcId ? 'Save Changes' : 'Add Custom Calculation'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Check which highlights should be shown based on enabled drivers (only when benefit is toggled ON and metric is an improvement)
  const approvalImprovement = challenge245Results ? forterKPIs.preAuthApprovalImprovement : forterKPIs.approvalRateImprovement;
  const showApprovalRate = ((challenge1Results && getDriverEnabled("c1-revenue")) || (challenge245Results && getDriverEnabled("c245-revenue"))) && (approvalImprovement ?? 0) > 0;
  const threeDSCurrent = formData.amer3DSChallengeRate || 30;
  const threeDSTarget = forterKPIs.threeDSReduction ?? 0;
  const threeDSDecreasePct = threeDSCurrent > 0 ? Math.round(((threeDSCurrent - threeDSTarget) / threeDSCurrent) * 100) : 0;
  const show3DS = challenge245Results && getDriverEnabled("c245-revenue") && threeDSDecreasePct > 0;
  const chargebackCurrent = formData.fraudCBRate || 0.5;
  const chargebackReductionBps = forterKPIs.chargebackReductionIsAbsolute
    ? Math.round((chargebackCurrent - (forterKPIs.chargebackReduction ?? 0)) * 100)
    : Math.round(chargebackCurrent * (forterKPIs.chargebackReduction ?? 50) / 100 * 100);
  const showChargeback = ((challenge1Results && getDriverEnabled("c1-chargeback")) || (challenge245Results && getDriverEnabled("c245-chargeback"))) && chargebackReductionBps > 0;
  const manualReviewCurrent = formData.manualReviewPct || 5;
  const manualReviewTarget = forterKPIs.manualReviewReduction ?? 0;
  const manualReviewDecreasePct = manualReviewCurrent > 0 ? Math.round(((manualReviewCurrent - manualReviewTarget) / manualReviewCurrent) * 100) : 0;
  const showManualReview = challenge3Results && getDriverEnabled("c3-review") && manualReviewDecreasePct > 0;
  const recoveryIncreasePct = totalRecoveryMetrics && totalRecoveryMetrics.current > 0
    ? Math.round(((totalRecoveryMetrics.target - totalRecoveryMetrics.current) / totalRecoveryMetrics.current) * 100)
    : 0;
  const showDispute = challenge7Results && getDriverEnabled("c7-disputes") && recoveryIncreasePct > 0;
  const showAbuse = challenge8Results && (getDriverEnabled("c8-returns") || getDriverEnabled("c8-inr")) && (blendedAbuseCatchRate ?? forterKPIs.forterCatchRate ?? 0) > 0;
  const showInstantRefundsNPS = challenge9Results && getDriverEnabled("c9-cx-uplift") && (forterKPIs.npsIncreaseFromInstantRefunds ?? 0) > 0;
  const showInstantRefundsCS = challenge9Results && getDriverEnabled("c9-cs-opex") && (forterKPIs.forterCSReduction ?? 0) > 0;
  const showAtoCatchRate = (getDriverEnabled("c12-ato-opex") || getDriverEnabled("c13-clv")) && (forterKPIs.atoCatchRate ?? 0) > 0;
  const showFraudulentSignupReduction = (getDriverEnabled("c14-marketing") || getDriverEnabled("c14-reactivation") || getDriverEnabled("c14-kyc")) && (forterKPIs.forterFraudulentSignupReduction ?? 0) > 0;
  const hasAnyHighlight = showApprovalRate || show3DS || showChargeback || showManualReview || showDispute || showAbuse || showInstantRefundsNPS || showInstantRefundsCS || showAtoCatchRate || showFraudulentSignupReduction;

  return (
    <>
      <div className="grid md:grid-cols-2 gap-6">
        {/* Left side - Value Drivers */}
        <div className="space-y-4">

          {/* GMV Uplift Section */}
          {businessGrowthDrivers.length > 0 && (
            <Collapsible open={businessGrowthOpen} onOpenChange={setBusinessGrowthOpen}>
              <Card className="overflow-hidden transition-transform duration-150 ease-out hover:scale-[1.01] active:scale-[0.98]">
                <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    {businessGrowthOpen ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                    <span className="font-semibold">GMV Uplift</span>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t">
                    {businessGrowthDrivers.map((driver) => {
                      const Icon = getIconForDriver(driver);
                      const isCustom = driver.id.startsWith('custom-');

                      return (
                        <div
                          key={driver.id}
                          className={`p-4 border-b last:border-b-0 transition-transform duration-150 ease-out hover:scale-[1.01] active:scale-[0.98] ${
                            !driver.enabled && "opacity-50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <Switch
                                checked={driver.enabled}
                                onCheckedChange={(checked) =>
                                  handleDriverToggle(driver.id, checked)
                                }
                              />
                              <Icon className={`w-4 h-4 shrink-0 ${isCustom ? 'text-amber-500' : 'text-primary'}`} aria-hidden />
                              {isCustomMode && !isCustom && editingBenefitId === driver.id ? (
                                <Input
                                  value={editingBenefitName}
                                  onChange={(e) => setEditingBenefitName(e.target.value)}
                                  onBlur={() => saveCustomBenefitName(driver.id, editingBenefitName)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveCustomBenefitName(driver.id, editingBenefitName);
                                    if (e.key === "Escape") setEditingBenefitId(null);
                                  }}
                                  className="h-8 text-sm flex-1 min-w-0"
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <span
                                  className={`text-sm flex-1 min-w-0 ${(driver.calculatorRows || driver.isTBD || isCustom) ? 'cursor-pointer hover:underline hover:text-primary' : ''}`}
                                  onClick={() => {
                                    if (isCustom) {
                                      handleEditCustomCalculation(driver.id);
                                    } else if (driver.calculatorRows || driver.isTBD) {
                                      handleDriverClick(driver);
                                    }
                                  }}
                                >
                                  {driver.label}
                                </span>
                              )}
                              {isCustomMode && !isCustom && editingBenefitId !== driver.id && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingBenefitId(driver.id);
                                    setEditingBenefitName(driver.label);
                                  }}
                                  className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
                                  title="Edit benefit name"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              )}
                              {isCustomMode && !isCustom && CALCULATOR_REQUIRED_INPUTS[getSourceCalculatorId(driver.id)] && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDuplicateCalculator(driver);
                                  }}
                                  className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
                                  title="Duplicate calculator (separate inputs)"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              )}
                              {isCustomMode && !isCustom && isDuplicateCalculator(driver.id) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveDuplicateCalculator(driver.id);
                                  }}
                                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                  title="Remove duplicate calculator"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                              {isCustom && driver.sourceUrl && (
                                <a
                                  href={driver.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
                                  title="Open source calculator"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                              {isCustom && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleRemoveCustomCalculation(driver.id); }}
                                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                  title="Remove custom calculation"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                              {/* Remove benefit button in custom mode for standard benefits (not for duplicates; they use Remove duplicate above) */}
                              {isCustomMode && !isCustom && !isDuplicateCalculator(driver.id) && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleRemoveBenefit(driver.id); }}
                                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                  title="Remove benefit"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            <div className="text-right">
                              <span className={`font-semibold whitespace-nowrap ${(driver.isTBD && driver.value === 0) ? 'text-muted-foreground italic' : driver.value === 0 ? 'text-muted-foreground' : ''}`}>
                                {(driver.isTBD && driver.value === 0) ? 'TBC' : formatCurrency(driver.value)}
                              </span>
                              {isCustom && (
                                <p className="text-[10px] text-amber-600">custom value</p>
                              )}
                              {(driver.isTBD && driver.value === 0) && !isCustom && (
                                <p className="text-[10px] text-muted-foreground">enter inputs to calculate</p>
                              )}
                              {!driver.isTBD && driver.value === 0 && !isCustom && (
                                <p className="text-[10px] text-muted-foreground">no improvement from current</p>
                              )}
                              {!isCustom && driver.value !== 0 && deduplicationEnabled && (driver.id === "c1-revenue" || driver.id === "c245-revenue") && (
                                <p className="text-[10px] text-muted-foreground">deduplicated impact</p>
                              )}
                              {!isCustom && driver.value !== 0 && isSegmentationEnabled && (driver.id === "c1-revenue" || driver.id === "c1-chargeback" || driver.id === "c245-revenue" || driver.id === "c245-chargeback") && (
                                <p className="text-[10px] text-primary">Sum of Segments</p>
                              )}
                            </div>
                          </div>
                          {/* Inline performance highlight comment */}
                          {driver.enabled && !isCustom && (driver.value > 0 || !driver.isTBD) && !isCustomMode && renderPerformanceHighlight(driver.performanceHighlight)}
                        </div>
                      );
                    })}
                    <div className="p-4 bg-muted/30">
                      <div className="flex items-center justify-between font-semibold">
                        <span>GMV uplift annual potential</span>
                        <span className="text-foreground font-semibold">
                          {formatCurrency(businessGrowthTotal)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground">
                        <span className="italic">EBITDA contribution from GMV</span>
                        <span className="font-medium text-gray-600 dark:text-gray-400">
                          {formatCurrency(gmvProfitability)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Cost Reduction Section */}
          {riskAvoidanceDrivers.length > 0 && (
            <Collapsible open={riskAvoidanceOpen} onOpenChange={setRiskAvoidanceOpen}>
              <Card className="overflow-hidden transition-transform duration-150 ease-out hover:scale-[1.01] active:scale-[0.98]">
                <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    {riskAvoidanceOpen ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                    <span className="font-semibold">Cost Reduction</span>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t">
                    {riskAvoidanceDrivers.map((driver) => {
                      const Icon = getIconForDriver(driver);
                      const isCustom = driver.id.startsWith('custom-');

                      return (
                        <div
                          key={driver.id}
                          className={`p-4 border-b last:border-b-0 transition-transform duration-150 ease-out hover:scale-[1.01] active:scale-[0.98] ${
                            !driver.enabled && "opacity-50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <Switch
                                checked={driver.enabled}
                                onCheckedChange={(checked) =>
                                  handleDriverToggle(driver.id, checked)
                                }
                              />
                              <Icon className={`w-4 h-4 shrink-0 ${isCustom ? 'text-amber-500' : 'text-primary'}`} aria-hidden />
                              {isCustomMode && !isCustom && editingBenefitId === driver.id ? (
                                <Input
                                  value={editingBenefitName}
                                  onChange={(e) => setEditingBenefitName(e.target.value)}
                                  onBlur={() => saveCustomBenefitName(driver.id, editingBenefitName)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveCustomBenefitName(driver.id, editingBenefitName);
                                    if (e.key === "Escape") setEditingBenefitId(null);
                                  }}
                                  className="h-8 text-sm flex-1 min-w-0"
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <span
                                  className={`text-sm flex-1 min-w-0 ${(driver.calculatorRows || driver.isTBD || isCustom) ? 'cursor-pointer hover:underline hover:text-primary' : ''}`}
                                  onClick={() => {
                                    if (isCustom) {
                                      handleEditCustomCalculation(driver.id);
                                    } else if (driver.calculatorRows || driver.isTBD) {
                                      handleDriverClick(driver);
                                    }
                                  }}
                                >
                                  {driver.label}
                                </span>
                              )}
                              {isCustomMode && !isCustom && editingBenefitId !== driver.id && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingBenefitId(driver.id);
                                    setEditingBenefitName(driver.label);
                                  }}
                                  className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
                                  title="Edit benefit name"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              )}
                              {isCustomMode && !isCustom && CALCULATOR_REQUIRED_INPUTS[getSourceCalculatorId(driver.id)] && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDuplicateCalculator(driver);
                                  }}
                                  className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
                                  title="Duplicate calculator (separate inputs)"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              )}
                              {isCustomMode && !isCustom && isDuplicateCalculator(driver.id) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveDuplicateCalculator(driver.id);
                                  }}
                                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                  title="Remove duplicate calculator"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                              {isCustom && driver.sourceUrl && (
                                <a
                                  href={driver.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
                                  title="Open source calculator"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                              {isCustom && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleRemoveCustomCalculation(driver.id); }}
                                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                  title="Remove custom calculation"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                              {/* Remove benefit button in custom mode for standard benefits (not for duplicates; they use Remove duplicate above) */}
                              {isCustomMode && !isCustom && !isDuplicateCalculator(driver.id) && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleRemoveBenefit(driver.id); }}
                                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                  title="Remove benefit"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            <div className="text-right">
                              <span className={`font-semibold whitespace-nowrap ${(driver.isTBD && driver.value === 0) ? 'text-muted-foreground italic' : driver.value === 0 ? 'text-muted-foreground' : ''}`}>
                                {(driver.isTBD && driver.value === 0) ? 'TBC' : formatCurrency(driver.value)}
                              </span>
                              {isCustom && (
                                <p className="text-[10px] text-amber-600">custom value</p>
                              )}
                              {(driver.isTBD && driver.value === 0) && !isCustom && (
                                <p className="text-[10px] text-muted-foreground">enter inputs to calculate</p>
                              )}
                              {!driver.isTBD && driver.value === 0 && !isCustom && (
                                <p className="text-[10px] text-muted-foreground">no improvement from current</p>
                              )}
                            </div>
                          </div>
                          {/* Inline performance highlight comment */}
                          {driver.enabled && !isCustom && (driver.value > 0 || !driver.isTBD) && !isCustomMode && renderPerformanceHighlight(driver.performanceHighlight)}
                        </div>
                      );
                    })}
                    <div className="p-4 bg-muted/30 font-semibold flex items-center justify-between">
                      <span>Cost reduction annual potential</span>
                      <span className="text-foreground font-semibold">
                        {formatCurrency(riskAvoidanceTotal)}
                      </span>
                    </div>
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Risk Mitigation Section */}
          {riskMitigationDrivers.length > 0 && (
            <Collapsible open={riskMitigationOpen} onOpenChange={setRiskMitigationOpen}>
              <Card className="overflow-hidden transition-transform duration-150 ease-out hover:scale-[1.01] active:scale-[0.98]">
                <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    {riskMitigationOpen ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                    <span className="font-semibold">Risk Mitigation</span>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t">
                    {riskMitigationDrivers.map((driver) => {
                      const Icon = getIconForDriver(driver);
                      const isCustom = driver.id.startsWith('custom-');

                      return (
                        <div
                          key={driver.id}
                          className={`p-4 border-b last:border-b-0 transition-transform duration-150 ease-out hover:scale-[1.01] active:scale-[0.98] ${
                            !driver.enabled && "opacity-50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <Switch
                                checked={driver.enabled}
                                onCheckedChange={(checked) =>
                                  handleDriverToggle(driver.id, checked)
                                }
                              />
                              <Icon className={`w-4 h-4 shrink-0 ${isCustom ? 'text-amber-500' : 'text-primary'}`} aria-hidden />
                              {isCustomMode && !isCustom && editingBenefitId === driver.id ? (
                                <Input
                                  value={editingBenefitName}
                                  onChange={(e) => setEditingBenefitName(e.target.value)}
                                  onBlur={() => saveCustomBenefitName(driver.id, editingBenefitName)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveCustomBenefitName(driver.id, editingBenefitName);
                                    if (e.key === "Escape") setEditingBenefitId(null);
                                  }}
                                  className="h-8 text-sm flex-1 min-w-0"
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <span
                                  className={`text-sm flex-1 min-w-0 ${(driver.calculatorRows || driver.isTBD || isCustom) ? 'cursor-pointer hover:underline hover:text-primary' : ''}`}
                                  onClick={() => {
                                    if (isCustom) {
                                      handleEditCustomCalculation(driver.id);
                                    } else if (driver.calculatorRows || driver.isTBD) {
                                      handleDriverClick(driver);
                                    }
                                  }}
                                >
                                  {driver.label}
                                </span>
                              )}
                              {isCustomMode && !isCustom && editingBenefitId !== driver.id && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingBenefitId(driver.id);
                                    setEditingBenefitName(driver.label);
                                  }}
                                  className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
                                  title="Edit benefit name"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              )}
                              {isCustomMode && !isCustom && CALCULATOR_REQUIRED_INPUTS[getSourceCalculatorId(driver.id)] && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDuplicateCalculator(driver);
                                  }}
                                  className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
                                  title="Duplicate calculator (separate inputs)"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              )}
                              {isCustomMode && !isCustom && isDuplicateCalculator(driver.id) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveDuplicateCalculator(driver.id);
                                  }}
                                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                  title="Remove duplicate calculator"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                              {isCustom && driver.sourceUrl && (
                                <a
                                  href={driver.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
                                  title="Open source calculator"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                              {isCustom && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleRemoveCustomCalculation(driver.id); }}
                                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                  title="Remove custom calculation"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                              {/* Remove benefit button in custom mode for standard benefits (not for duplicates; they use Remove duplicate above) */}
                              {isCustomMode && !isCustom && !isDuplicateCalculator(driver.id) && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleRemoveBenefit(driver.id); }}
                                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                  title="Remove benefit"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            <div className="text-right">
                              <span className={`font-semibold whitespace-nowrap ${(driver.isTBD && driver.value === 0) ? 'text-muted-foreground italic' : driver.value === 0 ? 'text-muted-foreground' : ''}`}>
                                {(driver.isTBD && driver.value === 0) ? 'TBC' : formatCurrency(driver.value)}
                              </span>
                              {isCustom && (
                                <p className="text-[10px] text-amber-600">custom value</p>
                              )}
                              {(driver.isTBD && driver.value === 0) && !isCustom && (
                                <p className="text-[10px] text-muted-foreground">enter inputs to calculate</p>
                              )}
                              {!driver.isTBD && driver.value === 0 && !isCustom && (
                                <p className="text-[10px] text-muted-foreground">no improvement from current</p>
                              )}
                            </div>
                          </div>
                          {/* Inline performance highlight comment */}
                          {driver.enabled && !isCustom && (driver.value > 0 || !driver.isTBD) && !isCustomMode && renderPerformanceHighlight(driver.performanceHighlight)}
                        </div>
                      );
                    })}
                    <div className="p-4 bg-muted/30 font-semibold flex items-center justify-between">
                      <span>Risk mitigation annual potential</span>
                      <span className="text-foreground font-semibold">
                        {formatCurrency(riskMitigationTotal)}
                      </span>
                    </div>
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Add Custom Calculation Button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleOpenAddDialog}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Custom Calculation
          </Button>
          
          {/* BenefitSelector for Custom Mode - in main content area */}
          {isCustomMode && (
            <BenefitSelector 
              selectedChallenges={selectedChallenges}
              onAddBenefit={handleAddBenefit}
              enabledBenefitIds={enabledBenefitIds}
            />
          )}
        </div>

        {/* Right side - Summary (keeping current design) */}
        <div className="space-y-4">
          {/* Millions toggle */}
          <div className="flex items-center justify-end gap-2">
            <span className="text-sm text-muted-foreground">Show in millions</span>
            <Switch checked={showInMillions} onCheckedChange={handleShowInMillionsChange} />
          </div>

          {/* Summary Card */}
          <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
            <div className="flex gap-4">
              {/* Left side - Totals */}
              <div className="flex-1">
                {businessGrowthTotal > 0 && (
                  <>
                    <div className="flex items-start gap-3 mb-4">
                      <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-base font-semibold text-foreground mb-1">
                          Annual Economic Benefit
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Includes full GMV Impact
                        </p>
                      </div>
                    </div>
                    <p className="text-5xl font-bold text-green-600 dark:text-green-400 mb-6">
                      {formatCurrency(totalValue)}
                    </p>
                  </>
                )}

                <div className={businessGrowthTotal > 0 ? "pt-4 border-t border-green-200 dark:border-green-700" : ""}>
                  <div className="flex items-start gap-3 mb-2">
                    {businessGrowthTotal === 0 && (
                      <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-base font-semibold text-foreground mb-1">
                        Annual run-rate Contribution to EBITDA
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {businessGrowthTotal > 0
                          ? isMarketplace
                            ? "Net of GMV→net sales deduction, then commission and gross margin"
                            : "Net of GMV→net sales deduction, then gross margin"
                          : "Cost Reduction"}
                      </p>
                    </div>
                  </div>
                  <p className={`font-bold text-green-600 dark:text-green-400 ${businessGrowthTotal > 0 ? "text-3xl" : "text-5xl"}`}>
                    {formatCurrency(ebitdaContribution)}
                  </p>
                </div>
              </div>

              {/* Right side - Solution Icons */}
              {selectedSolutions.size > 0 && (
                <div className="flex flex-col items-end gap-1 pl-3 border-l border-green-200 dark:border-green-700 shrink-0">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
                    Required<br />Solutions
                  </p>
                  {SOLUTION_PRODUCTS.filter(product => selectedSolutions.has(product.id)).map(product => {
                    const IconComponent = solutionIconMap[product.icon];
                    const isEnabled = enabledSolutions.has(product.id);
                    return (
                      <div
                        key={product.id}
                        className={`flex items-center gap-1.5 transition-opacity ${!isEnabled ? 'opacity-40' : ''}`}
                        title={product.name}
                      >
                        {IconComponent && <IconComponent className={`w-3.5 h-3.5 shrink-0 ${isEnabled ? 'text-green-700 dark:text-green-300' : 'text-muted-foreground'}`} />}
                        <span className={`text-[11px] font-medium ${isEnabled ? 'text-green-800 dark:text-green-200' : 'text-muted-foreground'}`}>
                          {product.name.split(' ')[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>

          {/* Quarterly cost of inaction - custom path: below value call-out */}
          {isCustomMode && ebitdaContribution > 0 && (() => {
            const quarterlyEbitda = ebitdaContribution / 4;
            const { displayFormatted, exactFormatted, roundingNote } = getQuarterlyCostDisplay(quarterlyEbitda);
            const quarterlyGmv = businessGrowthTotal / 4;
            const gmvDisplay = businessGrowthTotal > 0 ? getQuarterlyCostDisplay(quarterlyGmv) : null;
            return (
              <Card className="p-4 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                  <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Quarterly Cost of Inaction
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 rounded p-0.5 focus:outline-none focus:ring-2 focus:ring-amber-400">
                        <Info className="w-4 h-4 shrink-0" aria-label="Calculation breakdown" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs p-3">
                      <p className="font-medium mb-1">Calculation</p>
                      {gmvDisplay && (
                        <p className="text-muted-foreground text-sm">
                          Annual GMV uplift ÷ 4 = {formatCurrency(businessGrowthTotal)} ÷ 4 = {gmvDisplay.exactFormatted} in foregone GMV per quarter.
                        </p>
                      )}
                      <p className="text-muted-foreground text-sm">
                        Annual EBITDA uplift ÷ 4 = {formatCurrency(ebitdaContribution)} ÷ 4 = {exactFormatted} EBITDA lost per quarter.
                      </p>
                      <p className="text-muted-foreground text-sm mt-1">{roundingNote} Values shown above are approximate.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="pl-6 space-y-1">
                  {gmvDisplay && (
                    <p className="text-xl font-bold text-amber-800 dark:text-amber-200">
                      {gmvDisplay.displayFormatted} in foregone GMV per quarter
                    </p>
                  )}
                  <p className="text-xl font-bold text-amber-800 dark:text-amber-200">
                    {displayFormatted} EBITDA lost per quarter
                  </p>
                </div>
              </Card>
            );
          })()}

          {/* Performance Highlights — hidden in custom value pathway */}
          {!isCustomMode && hasAnyHighlight && (
            <Card className="p-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                Performance Highlights
                <span className="text-gray-500 dark:text-gray-400 text-xs font-normal italic">(click to edit)</span>
              </h4>
              <div className="space-y-2 [&>*:last-child]:border-b-0">
                {/* Approval Rate */}
                {showApprovalRate && (
                  <PerformanceHighlightRow
                    label="Approval Rate with Forter"
                    badge={`${challenge245Results ? forterKPIs.preAuthApprovalImprovement : forterKPIs.approvalRateImprovement}%`}
                    section={challenge245Results ? "c245" : "c1"}
                    onNavigateToForterKPI={onNavigateToForterKPI}
                  />
                )}
                {/* 3DS Reduction - only shown when percentageDecrease > 0 (improvement) */}
                {show3DS && (
                  <PerformanceHighlightRow
                    label="3DS Reduction"
                    badge={`${threeDSDecreasePct}%`}
                    section="c245"
                    onNavigateToForterKPI={onNavigateToForterKPI}
                  />
                )}
                {/* Fraud Chargeback Reduction - only shown when bpsReduction > 0 (improvement) */}
                {showChargeback && (
                  <PerformanceHighlightRow
                    label="Fraud Chargeback Reduction"
                    badge={`${chargebackReductionBps}bps`}
                    section={challenge245Results ? "c245" : "c1"}
                    onNavigateToForterKPI={onNavigateToForterKPI}
                  />
                )}
                {/* Manual Review - only shown when percentageDecrease > 0 (improvement) */}
                {showManualReview && (
                  <PerformanceHighlightRow
                    label="Manual Review Eliminated"
                    badge={`${manualReviewDecreasePct}%`}
                    section="manual-review"
                    onNavigateToForterKPI={onNavigateToForterKPI}
                  />
                )}
                {/* Recovery Rate Increase - only shown when percentIncrease > 0 (improvement) */}
                {showDispute && totalRecoveryMetrics && (
                  <PerformanceHighlightRow
                    label="Recovery Rate Increase"
                    badge={`+${recoveryIncreasePct}%`}
                    section="disputes"
                    onNavigateToForterKPI={onNavigateToForterKPI}
                  />
                )}
                {/* Abuse Blocked */}
                {showAbuse && (
                  <PerformanceHighlightRow
                    label="Abuse Catch Rate"
                    badge={`${blendedAbuseCatchRate.toFixed(1)}%`}
                    section="abuse"
                    onNavigateToForterKPI={onNavigateToForterKPI}
                  />
                )}
                {/* Expected NPS Increase */}
                {showInstantRefundsNPS && (
                  <PerformanceHighlightRow
                    label="Expected NPS increase"
                    badge={`+${forterKPIs.npsIncreaseFromInstantRefunds || 10} pts`}
                    section="instant-refunds"
                    onNavigateToForterKPI={onNavigateToForterKPI}
                  />
                )}
                {/* Expected % of instant refunds */}
                {showInstantRefundsCS && (
                  <PerformanceHighlightRow
                    label="Expected % of instant refunds"
                    badge={`${forterKPIs.forterCSReduction || 78}%`}
                    section="instant-refunds"
                    onNavigateToForterKPI={onNavigateToForterKPI}
                  />
                )}
                {/* ATO Catch Rate */}
                {showAtoCatchRate && (
                  <PerformanceHighlightRow
                    label="ATO Catch Rate"
                    badge={`${forterKPIs.atoCatchRate ?? 90}%`}
                    section="ato"
                    onNavigateToForterKPI={onNavigateToForterKPI}
                  />
                )}
                {/* Fraudulent sign-up reduction */}
                {showFraudulentSignupReduction && (
                  <PerformanceHighlightRow
                    label="Fraudulent sign-up reduction"
                    badge={`${forterKPIs.forterFraudulentSignupReduction ?? 95}%`}
                    section="signup"
                    onNavigateToForterKPI={onNavigateToForterKPI}
                  />
                )}
              </div>
            </Card>
          )}

          {/* Quarterly cost of inaction - guided path: above EBITDA attribution chart */}
          {!isCustomMode && ebitdaContribution > 0 && (() => {
            const quarterlyEbitda = ebitdaContribution / 4;
            const { displayFormatted, exactFormatted, roundingNote } = getQuarterlyCostDisplay(quarterlyEbitda);
            const quarterlyGmv = businessGrowthTotal / 4;
            const gmvDisplay = businessGrowthTotal > 0 ? getQuarterlyCostDisplay(quarterlyGmv) : null;
            return (
              <Card className="p-4 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                  <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Quarterly Cost of Inaction
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 rounded p-0.5 focus:outline-none focus:ring-2 focus:ring-amber-400">
                        <Info className="w-4 h-4 shrink-0" aria-label="Calculation breakdown" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs p-3">
                      <p className="font-medium mb-1">Calculation</p>
                      {gmvDisplay && (
                        <p className="text-muted-foreground text-sm">
                          Annual GMV uplift ÷ 4 = {formatCurrency(businessGrowthTotal)} ÷ 4 = {gmvDisplay.exactFormatted} in foregone GMV per quarter.
                        </p>
                      )}
                      <p className="text-muted-foreground text-sm">
                        Annual EBITDA uplift ÷ 4 = {formatCurrency(ebitdaContribution)} ÷ 4 = {exactFormatted} EBITDA lost per quarter.
                      </p>
                      <p className="text-muted-foreground text-sm mt-1">{roundingNote} Values shown above are approximate.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="pl-6 space-y-1">
                  {gmvDisplay && (
                    <p className="text-xl font-bold text-amber-800 dark:text-amber-200">
                      {gmvDisplay.displayFormatted} in foregone GMV per quarter
                    </p>
                  )}
                  <p className="text-xl font-bold text-amber-800 dark:text-amber-200">
                    {displayFormatted} EBITDA lost per quarter
                  </p>
                </div>
              </Card>
            );
          })()}

          {/* Waterfall Chart */}
          {waterfallData.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-sm font-semibold">Forter Annual EBITDA Attribution</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEbitdaChartModalOpen(true)}
                  className="gap-1.5 shrink-0"
                >
                  <Expand className="h-3.5 w-3.5" />
                  Expand
                </Button>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={waterfallData}
                    margin={{ top: 30, right: 30, left: 30, bottom: 80 }}
                    barCategoryGap="30%"
                  >
                    <XAxis
                      dataKey="name"
                      tick={(props) => {
                        const { x, y, payload } = props;
                        const lines = payload.value.split('\n');
                        return (
                          <g transform={`translate(${x},${y})`}>
                            {lines.map((line: string, i: number) => (
                              <text
                                key={i}
                                x={0}
                                y={i * 12}
                                dy={8}
                                textAnchor="middle"
                                fill="hsl(var(--foreground))"
                                fontSize={10}
                              >
                                {line}
                              </text>
                            ))}
                          </g>
                        );
                      }}
                      interval={0}
                      height={70}
                      tickLine={false}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(v) => showInMillions ? `${currencySymbol}${(v / 1_000_000).toFixed(1)}M` : `${currencySymbol}${Math.round(v / 1000)}K`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" />
                    {/* Invisible base bar to create floating effect */}
                    <Bar dataKey="base" stackId="stack" fill="transparent" />
                    {/* Visible value bar on top of base */}
                    <Bar dataKey="value" stackId="stack" radius={[4, 4, 0, 0]}>
                      {waterfallData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.isTotal ? "#22c55e" : "#1a1a1a"} 
                        />
                      ))}
                      <LabelList
                        dataKey="value"
                        position="top"
                        content={(props) => {
                          const { x, y, width, value, index } = props as any;
                          const entry = waterfallData[index];
                          const color = entry?.isTotal ? "#22c55e" : "#1a1a1a";
                          const formattedValue = showInMillions
                            ? `${currencySymbol}${(Number(value) / 1_000_000).toFixed(1)}M`
                            : `${currencySymbol}${Math.round(Number(value) / 1000).toLocaleString()}K`;
                          return (
                            <text
                              x={Number(x) + Number(width) / 2}
                              y={Number(y) - 8}
                              textAnchor="middle"
                              fill={color}
                              fontSize={12}
                              fontWeight={600}
                            >
                              {formattedValue}
                            </text>
                          );
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* EBITDA Attribution – full chart modal */}
      <Dialog open={ebitdaChartModalOpen} onOpenChange={setEbitdaChartModalOpen}>
        <DialogContent className="max-w-6xl w-[min(100%,min(72rem,calc(100vw-2rem)))] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Forter Annual EBITDA Attribution</DialogTitle>
            <DialogDescription>
              Full breakdown of value drivers contributing to EBITDA. Top {MAX_FULL_CHART_BARS} shown; remainder in Other.
            </DialogDescription>
          </DialogHeader>
          <div className="h-[28rem] min-h-[24rem] pr-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={fullWaterfallData}
                margin={{ top: 24, right: 24, left: 24, bottom: 100 }}
                barCategoryGap="20%"
              >
                <XAxis
                  dataKey="name"
                  tick={(props) => {
                    const { x, y, payload } = props;
                    const lines = payload.value.split("\n");
                    return (
                      <g transform={`translate(${x},${y})`}>
                        {lines.map((line: string, i: number) => (
                          <text key={i} x={0} y={i * 14} dy={10} textAnchor="middle" fill="hsl(var(--foreground))" fontSize={11}>
                            {line}
                          </text>
                        ))}
                      </g>
                    );
                  }}
                  interval={0}
                  height={90}
                  tickLine={false}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v) =>
                    showInMillions ? `${currencySymbol}${(v / 1_000_000).toFixed(1)}M` : `${currencySymbol}${Math.round(v / 1000)}K`
                  }
                  axisLine={false}
                  tickLine={false}
                />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <Bar dataKey="base" stackId="stack" fill="transparent" />
                <Bar dataKey="value" stackId="stack" radius={[4, 4, 0, 0]}>
                  {fullWaterfallData.map((entry, index) => (
                    <Cell key={`full-cell-${index}`} fill={entry.isTotal ? "#22c55e" : "#1a1a1a"} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="top"
                    content={(props) => {
                      const { x, y, width, value, index } = props as any;
                      const entry = fullWaterfallData[index];
                      const color = entry?.isTotal ? "#22c55e" : "#1a1a1a";
                      const formattedValue = showInMillions
                        ? `${currencySymbol}${(Number(value) / 1_000_000).toFixed(1)}M`
                        : `${currencySymbol}${Math.round(Number(value) / 1000).toLocaleString()}K`;
                      return (
                        <text
                          x={Number(x) + Number(width) / 2}
                          y={Number(y) - 8}
                          textAnchor="middle"
                          fill={color}
                          fontSize={12}
                          fontWeight={600}
                        >
                          {formattedValue}
                        </text>
                      );
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DialogContent>
      </Dialog>

      {/* Calculator Dialog */}
      <Dialog
        open={selectedCalculatorId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCalculatorId(null);
            onBenefitModalClose?.();
          }
        }}
      >
        <DialogContent ref={calculatorDialogRef} className="max-w-6xl w-[min(100%,min(72rem,calc(100vw-2rem)))] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-0">
            <div className="flex items-center justify-between pr-8 w-full">
              <div>
                <DialogTitle>{selectedCalculator?.title}</DialogTitle>
                <DialogDescription className="sr-only">
                  Calculator breakdown for {selectedCalculator?.title}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
              {/* Screenshot (PDF): icon-only button; PDF is saved via browser download (e.g. Downloads folder) */}
              {selectedCalculatorId && selectedCalculator && (() => {
                const captureBenefitPdf = async () => {
                  setIsCapturingBenefitPdf(true);
                  const hasFunnel = selectedCalculatorId === 'c245-revenue';
                  const srcId = modalContext.sourceIdForModal ?? selectedCalculatorId ?? '';
                  const hasVisual = ['c1-revenue', 'c1-chargeback', 'c245-chargeback', 'c3-review', 'c7-disputes', 'c7-opex', 'c9-cs-opex', 'c9-cx-uplift', 'c10-promotions', 'c12-ato-opex', 'c13-clv'].includes(srcId);
                  const tabsInOrder = (() => {
                    const tabs: string[] = ['summary', 'inputs', 'calculator'];
                    if (hasFunnel) tabs.push('funnel');
                    if (hasVisual) tabs.push('visual');
                    if (hasCaseStudy(srcId)) tabs.push('success-stories');
                    return tabs as const;
                  })();
                  const prevTab = calculatorModalTab;
                  try {
                    const html2canvas = (await import('html2canvas')).default;
                    const { jsPDF } = await import('jspdf');
                    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
                    const pageWidth = pdf.internal.pageSize.getWidth();
                    const pageHeight = pdf.internal.pageSize.getHeight();
                    const margin = 10;
                    let hadPage = false;
                    for (const tab of tabsInOrder) {
                      setCalculatorModalTab(tab);
                      await new Promise((r) => setTimeout(r, 400));
                      const dialogEl = calculatorDialogRef.current;
                      const section = dialogEl?.querySelector(`[data-benefit-pdf="${tab}"]`);
                      if (!section || !(section instanceof HTMLElement)) continue;
                      // Single capture of the section: expand dialog and section so full content is visible (no scroll-stitch to avoid blanks)
                      const el = section as HTMLElement;
                      const dialogPrevOverflow = dialogEl.style.overflow;
                      const dialogPrevMaxHeight = dialogEl.style.maxHeight;
                      const dialogPrevHeight = dialogEl.style.height;
                      dialogEl.style.overflow = 'visible';
                      dialogEl.style.maxHeight = 'none';
                      dialogEl.style.height = 'auto';
                      const prevHeight = el.style.height;
                      const prevOverflow = el.style.overflow;
                      const prevMaxHeight = el.style.maxHeight;
                      const prevMinHeight = el.style.minHeight;
                      el.style.overflow = 'visible';
                      el.style.maxHeight = 'none';
                      el.style.minHeight = '0';
                      el.style.height = 'auto';
                      await new Promise((r) => setTimeout(r, 150));
                      // Expand inner scrollables (e.g. calculator table's max-h-[600px] overflow-auto) so full content is captured
                      const innerScrollables: { el: HTMLElement; overflow: string; overflowY: string; maxHeight: string; height: string; minHeight: string }[] = [];
                      el.querySelectorAll('*').forEach((node) => {
                        if (node instanceof HTMLElement) {
                          const style = window.getComputedStyle(node);
                          const overflowY = style.overflowY;
                          if ((overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') && node.scrollHeight > node.clientHeight) {
                            innerScrollables.push({
                              el: node,
                              overflow: node.style.overflow,
                              overflowY: node.style.overflowY,
                              maxHeight: node.style.maxHeight,
                              height: node.style.height,
                              minHeight: node.style.minHeight,
                            });
                            node.style.overflow = 'visible';
                            node.style.overflowY = 'visible';
                            node.style.maxHeight = 'none';
                            node.style.minHeight = '0';
                            node.style.height = 'auto';
                          }
                        }
                      });
                      await new Promise((r) => setTimeout(r, 120));
                      const fullHeight = Math.max(el.scrollHeight, el.offsetHeight, el.clientHeight);
                      el.style.height = `${fullHeight}px`;
                      await new Promise((r) => setTimeout(r, 100));
                      const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
                      innerScrollables.forEach(({ el: innerEl, overflow, overflowY, maxHeight, height, minHeight }) => {
                        innerEl.style.overflow = overflow;
                        innerEl.style.overflowY = overflowY;
                        innerEl.style.maxHeight = maxHeight;
                        innerEl.style.height = height;
                        innerEl.style.minHeight = minHeight;
                      });
                      el.style.height = prevHeight;
                      el.style.overflow = prevOverflow;
                      el.style.maxHeight = prevMaxHeight;
                      el.style.minHeight = prevMinHeight;
                      dialogEl.style.overflow = dialogPrevOverflow;
                      dialogEl.style.maxHeight = dialogPrevMaxHeight;
                      dialogEl.style.height = dialogPrevHeight;
                      const imgW = pageWidth - margin * 2;
                      const availableH = pageHeight - margin * 2;
                      const canvasPxPerMm = canvas.width / imgW;
                      const sliceHeightPx = availableH * canvasPxPerMm;
                      const numPages = Math.max(1, Math.ceil(canvas.height / sliceHeightPx));
                      for (let pageIndex = 0; pageIndex < numPages; pageIndex++) {
                        if (hadPage || pageIndex > 0) pdf.addPage('a4', 'p');
                        const sourceY = pageIndex * sliceHeightPx;
                        const sourceH = Math.min(sliceHeightPx, canvas.height - sourceY);
                        if (sourceH <= 0) continue;
                        const sliceCanvas = document.createElement('canvas');
                        sliceCanvas.width = canvas.width;
                        sliceCanvas.height = Math.ceil(sourceH);
                        const ctx = sliceCanvas.getContext('2d');
                        if (!ctx) continue;
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
                        ctx.drawImage(canvas, 0, sourceY, canvas.width, sourceH, 0, 0, canvas.width, sourceH);
                        const drawH = sourceH / canvasPxPerMm;
                        pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, margin, imgW, drawH);
                        hadPage = true;
                      }
                    }
                    if (hadPage) {
                      const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '');
                      const analysisName = (formData as { _analysisName?: string })._analysisName || formData.customerName || 'Value_Assessment';
                      const sanitizedAnalysisName = analysisName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').slice(0, 50) || 'Value_Assessment';
                      const safeTitle = (selectedCalculator?.title ?? 'Benefit').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').slice(0, 40);
                      const filename = `${sanitizedAnalysisName}_Benefit_${safeTitle}_${dateStr}.pdf`;
                      pdf.save(filename);
                      toast.success(`PDF saved to your downloads: ${filename}`);
                    } else {
                      toast.error('Could not capture benefit content. Please try again.');
                    }
                    setCalculatorModalTab(prevTab);
                  } catch (e) {
                    console.error('Benefit PDF capture error:', e);
                    toast.error('Failed to generate PDF. Please try again.');
                    setCalculatorModalTab(prevTab);
                  } finally {
                    setIsCapturingBenefitPdf(false);
                  }
                };
                return (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={captureBenefitPdf}
                        disabled={isCapturingBenefitPdf}
                        aria-label="Screenshot benefit as PDF"
                      >
                        {isCapturingBenefitPdf ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Camera className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>Screenshot this benefit (PDF)</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })()}
              {/* Generate Slides Button: opens report modal to create Google Slides subset (calculator + success story) or falls back to PPTX download */}
              {(() => {
                const isSegmentableCalculator = selectedCalculatorId === "c1-revenue" ||
                  selectedCalculatorId === "c1-chargeback" ||
                  selectedCalculatorId === "c245-revenue" ||
                  selectedCalculatorId === "c245-chargeback";
                const isSegmentationEnabledForDownload = formData.segmentationEnabled && (formData.segments?.filter(s => s.enabled).length ?? 0) > 0;
                const showSegmentedDownload = isSegmentableCalculator && isSegmentationEnabledForDownload;

                const handleGenerateOrDownload = () => {
                  if (!selectedCalculatorId || !selectedCalculator?.title) return;
                  
                  if (showSegmentedDownload) {
                    // Import the calculation functions dynamically and compute segment rows
                    const challengeType = selectedCalculatorId.startsWith("c1-") ? "c1" as const : "c245" as const;
                    const calculatorType = selectedCalculatorId.endsWith("-revenue") ? "revenue" as const : "chargeback" as const;
                    const enabledSegments = (formData.segments || []).filter(s => s.enabled);
                    
                    // Compute segment results for download
                    const segmentData: Array<{ name: string; rows: CalculatorRow[] }> = [];
                    
                    for (const segment of enabledSegments) {
                      // Use the same calculation logic as SegmentCalculatorTabs
                      const segmentInputs = segment.inputs;
                      const segmentKPIs = segment.kpis;
                      const grossAttempts = segmentInputs.grossAttempts ?? 0;
                      const annualGMV = segmentInputs.annualGMV ?? 0;
                      
                      if (grossAttempts > 0 && annualGMV > 0) {
                        let result: { rows: CalculatorRow[]; value: number } | null = null;
                        
                        if (challengeType === "c1") {
                          const currentApprovalRate = segmentInputs.preAuthApprovalRate ?? 0;
                          const currentCBRate = segmentInputs.fraudCBRate ?? 0;
                          let approvalImprovement = segmentKPIs.approvalRateTarget ?? 0;
                          if (forterKPIs.approvalRateIsAbsolute && approvalImprovement > 0) {
                            approvalImprovement = Math.max(0, approvalImprovement - currentApprovalRate);
                          }
                          approvalImprovement = Math.min(approvalImprovement, 100 - currentApprovalRate);
                          
                          let cbReduction = segmentKPIs.chargebackRateTarget ?? 0;
                          if (forterKPIs.chargebackReductionIsAbsolute && cbReduction > 0) {
                            if (currentCBRate > 0) {
                              cbReduction = Math.max(0, ((currentCBRate - cbReduction) / currentCBRate) * 100);
                            } else {
                              cbReduction = 0;
                            }
                          }
                          cbReduction = Math.min(100, Math.max(0, cbReduction));
                          
                          const inputs: Challenge1Inputs = {
                            transactionAttempts: grossAttempts,
                            transactionAttemptsValue: annualGMV,
                            grossMarginPercent: formData.amerGrossMarginPercent || 50,
                            approvalRate: currentApprovalRate,
                            fraudChargebackRate: currentCBRate,
                            isMarketplace: formData.isMarketplace || false,
                            commissionRate: formData.commissionRate || 100,
                            currencyCode: formData.baseCurrency || 'USD',
                            completedAOV: segmentInputs.completedAOV ?? (grossAttempts > 0 ? annualGMV / grossAttempts : 0),
                            forterCompletedAOV: forterKPIs.forterCompletedAOV,
                            recoveredAovMultiplier: forterKPIs.recoveredAovMultiplier ?? 1.15,
                            forterApprovalRateImprovement: approvalImprovement,
                            forterChargebackReduction: cbReduction,
                            deduplication: { enabled: deduplicationEnabled, retryRate: deduplicationRetryRate, successRate: deduplicationSuccessRate },
                          };
                          
                          const results = calculateChallenge1(inputs);
                          result = calculatorType === "revenue"
                            ? { rows: results.calculator1.rows, value: results.calculator1.revenueUplift }
                            : { rows: results.calculator2.rows, value: results.calculator2.costReduction };
                        } else {
                          // Challenge 2/4/5
                          const currentPreAuthRate = segmentInputs.preAuthApprovalRate ?? 0;
                          const currentPostAuthRate = segmentInputs.postAuthApprovalRate ?? 0;
                          const current3DSRate = segmentInputs.threeDSChallengeRate ?? 0;
                          const currentCBRate = segmentInputs.fraudCBRate ?? 0;
                          const creditCardPct = segmentInputs.creditCardPct ?? 0;
                          const threeDSFailureRate = segmentInputs.threeDSAbandonmentRate ?? 0;
                          const issuingBankDeclineRate = segmentInputs.issuingBankDeclineRate ?? 0;
                          
                          let preAuthImprovement = 0;
                          const preAuthIncluded = segmentKPIs.preAuthIncluded ?? forterKPIs.preAuthIncluded !== false;
                          if (preAuthIncluded) {
                            preAuthImprovement = segmentKPIs.preAuthApprovalTarget ?? 0;
                            if (forterKPIs.preAuthApprovalIsAbsolute && preAuthImprovement > 0) {
                              preAuthImprovement = preAuthImprovement - currentPreAuthRate; // allow negative (Forter outcome below customer)
                            }
                            preAuthImprovement = Math.min(preAuthImprovement, 100 - currentPreAuthRate);
                          }
                          
                          let postAuthImprovement = 0;
                          let targetPostAuthRate: number | undefined = undefined;
                          const postAuthIncluded = segmentKPIs.postAuthIncluded ?? forterKPIs.postAuthIncluded !== false;
                          if (postAuthIncluded) {
                            postAuthImprovement = segmentKPIs.postAuthApprovalTarget ?? 0;
                            if (forterKPIs.postAuthApprovalIsAbsolute && postAuthImprovement > 0) {
                              postAuthImprovement = postAuthImprovement - currentPostAuthRate; // allow negative (Forter outcome below customer)
                            }
                            postAuthImprovement = Math.min(postAuthImprovement, 100 - currentPostAuthRate);
                          } else {
                            targetPostAuthRate = 100;
                            postAuthImprovement = 100 - currentPostAuthRate;
                          }
                          
                          let threeDSReduction = segmentKPIs.threeDSRateTarget ?? 0;
                          if (forterKPIs.threeDSReductionIsAbsolute && threeDSReduction > 0) {
                            threeDSReduction = Math.max(0, current3DSRate - threeDSReduction);
                          }
                          threeDSReduction = Math.min(threeDSReduction, current3DSRate);
                          
                          let cbReduction = segmentKPIs.chargebackRateTarget ?? 0;
                          let targetCBRate: number;
                          if (forterKPIs.chargebackReductionIsAbsolute && cbReduction > 0) {
                            targetCBRate = Math.max(0, cbReduction);
                            if (currentCBRate > 0) {
                              cbReduction = Math.max(0, ((currentCBRate - targetCBRate) / currentCBRate) * 100);
                            } else {
                              cbReduction = 0;
                            }
                          } else {
                            targetCBRate = currentCBRate * (1 - cbReduction / 100);
                          }
                          cbReduction = Math.min(100, Math.max(0, cbReduction));
                          
                          const inputs: Challenge245Inputs = {
                            transactionAttempts: grossAttempts,
                            transactionAttemptsValue: annualGMV,
                            grossMarginPercent: formData.amerGrossMarginPercent || 50,
                            preAuthApprovalRate: currentPreAuthRate,
                            postAuthApprovalRate: currentPostAuthRate,
                            creditCardPct,
                            creditCard3DSPct: current3DSRate,
                            threeDSFailureRate,
                            issuingBankDeclineRate,
                            fraudChargebackRate: currentCBRate,
                            isMarketplace: formData.isMarketplace || false,
                            commissionRate: formData.commissionRate || 100,
                            currencyCode: formData.baseCurrency || 'USD',
                            completedAOV: segmentInputs.completedAOV ?? (grossAttempts > 0 ? annualGMV / grossAttempts : 0),
                            forterCompletedAOV: forterKPIs.forterCompletedAOV,
                            recoveredAovMultiplier: forterKPIs.recoveredAovMultiplier ?? 1.15,
                            forterPreAuthImprovement: preAuthImprovement,
                            forterPostAuthImprovement: postAuthImprovement,
                            forter3DSReduction: threeDSReduction,
                            forterChargebackReduction: cbReduction,
                            forterTargetCBRate: targetCBRate,
                            forterTargetPostAuthRate: targetPostAuthRate,
                            deduplication: { enabled: deduplicationEnabled, retryRate: deduplicationRetryRate, successRate: deduplicationSuccessRate },
                          };
                          
                          const results = calculateChallenge245(inputs);
                          result = calculatorType === "revenue"
                            ? { rows: results.calculator1.rows, value: results.calculator1.revenueUplift }
                            : { rows: results.calculator2.rows, value: results.calculator2.costReduction };
                        }
                        
                        if (result) {
                          segmentData.push({ name: segment.name, rows: result.rows });
                        }
                      }
                    }
                    
                    // Build total rows by aggregating segment data
                    // The Total tab displays summed values for currency/number rows and weighted averages for percent rows
                    let totalRows: CalculatorRow[] = [];
                    if (segmentData.length > 0) {
                      const firstSegmentRows = segmentData[0].rows;
                      const currencyCode = formData.baseCurrency || 'USD';
                      const fmtCur = createCurrencyFormatter(currencyCode);
                      
                      // Aggregate rows across segments
                      totalRows = firstSegmentRows.map((templateRow, rowIndex) => {
                        // Skip section headers
                        if (!templateRow.formula && templateRow.label && !templateRow.customerInput) {
                          return { ...templateRow };
                        }
                        
                        const inferredType: "percent" | "currency" | "number" =
                          templateRow.valueType === "percent" ? "percent" :
                          templateRow.valueType === "currency" ? "currency" :
                          templateRow.customerInput?.includes("%") || templateRow.forterOutcome?.includes("%") ? "percent" :
                          templateRow.customerInput?.includes("$") || templateRow.forterOutcome?.includes("$") ||
                          templateRow.customerInput?.includes("€") || templateRow.forterOutcome?.includes("€") ||
                          templateRow.customerInput?.includes("£") || templateRow.forterOutcome?.includes("£") ? "currency" : "number";
                        
                        // Parse value from display string
                        const parseValue = (display: string | undefined): number | undefined => {
                          if (!display) return undefined;
                          let s = display.trim();
                          if (!s) return undefined;
                          let negative = false;
                          if (s.startsWith("(") && s.endsWith(")")) {
                            negative = true;
                            s = s.slice(1, -1).trim();
                          }
                          s = s.replace(/[$€£%,]/g, "").trim();
                          const v = parseFloat(s);
                          if (isNaN(v)) return undefined;
                          return negative ? -v : v;
                        };
                        
                        let customerSum = 0, forterSum = 0;
                        let hasCustomer = false, hasForter = false;
                        let totalWeight = 0;
                        
                        for (let i = 0; i < segmentData.length; i++) {
                          const segmentRows = segmentData[i].rows;
                          if (!segmentRows[rowIndex]) continue;
                          const row = segmentRows[rowIndex];
                          const weight = enabledSegments[i]?.inputs.grossAttempts ?? 0;
                          
                          const custVal = row.rawCustomerValue ?? parseValue(row.customerInput);
                          const fortVal = row.rawForterValue ?? parseValue(row.forterOutcome);
                          
                          if (inferredType === "percent") {
                            if (custVal !== undefined && weight > 0) {
                              customerSum += custVal * weight;
                              hasCustomer = true;
                            }
                            if (fortVal !== undefined && weight > 0) {
                              forterSum += fortVal * weight;
                              hasForter = true;
                            }
                            totalWeight += weight;
                          } else {
                            if (custVal !== undefined) { customerSum += custVal; hasCustomer = true; }
                            if (fortVal !== undefined) { forterSum += fortVal; hasForter = true; }
                          }
                        }
                        
                        const customerAgg = inferredType === "percent" ? (totalWeight > 0 ? customerSum / totalWeight : undefined) : (hasCustomer ? customerSum : undefined);
                        const forterAgg = inferredType === "percent" ? (totalWeight > 0 ? forterSum / totalWeight : undefined) : (hasForter ? forterSum : undefined);
                        
                        const formatVal = (val: number, type: typeof inferredType) => {
                          if (type === "percent") return `${val.toFixed(2)}%`;
                          if (type === "currency") return fmtCur(val);
                          return Math.round(val).toLocaleString();
                        };
                        
                        // Calculate improvement delta (percent rows: relative % improvement, not %pts)
                        let improvementDisplay = templateRow.forterImprovement;
                        if (forterAgg !== undefined && customerAgg !== undefined) {
                          const delta = forterAgg - customerAgg;
                          if (inferredType === "percent") {
                            const rel = typeof customerAgg === "number" && customerAgg !== 0
                              ? ((forterAgg - customerAgg) / customerAgg) * 100
                              : NaN;
                            improvementDisplay = Number.isFinite(rel)
                              ? `${rel >= 0 ? "+" : ""}${rel.toFixed(2)}%`
                              : "—";
                          } else if (inferredType === "currency") {
                            improvementDisplay = delta >= 0 ? fmtCur(delta) : `(${fmtCur(Math.abs(delta))})`;
                          } else {
                            improvementDisplay = delta >= 0 ? `+${Math.round(delta).toLocaleString()}` : Math.round(delta).toLocaleString();
                          }
                        }
                        
                        return {
                          ...templateRow,
                          customerInput: customerAgg !== undefined ? formatVal(customerAgg, inferredType) : templateRow.customerInput,
                          forterImprovement: improvementDisplay,
                          forterOutcome: forterAgg !== undefined ? formatVal(forterAgg, inferredType) : templateRow.forterOutcome,
                          rawCustomerValue: customerAgg,
                          rawForterValue: forterAgg,
                          editableCustomerField: undefined,
                          editableForterField: undefined,
                        };
                      });
                    }
                    
                    if (onGenerateCalculatorSlides) {
                      onGenerateCalculatorSlides({
                        calculatorId: selectedCalculatorId,
                        calculatorTitle: selectedCalculator.title,
                        rows: selectedCalculator.rows || [],
                        segmentData,
                        totalRows,
                        ...(selectedCalculatorId === "c245-revenue" && c245FunnelSlideDataForReport && { funnelSlide: c245FunnelSlideDataForReport }),
                      });
                    } else {
                      generateCalculatorSlide(
                        selectedCalculatorId,
                        selectedCalculator.title,
                        selectedCalculator.rows || [],
                        formData,
                        true,
                        segmentData,
                        totalRows
                      );
                    }
                  } else {
                    // Non-segmented: use the rows directly from the driver
                    // But we need to recalculate to ensure we have current data
                    let calculatedRows = selectedCalculator.rows || [];
                    
                    // For non-segmented calculators, recalculate to get accurate data
                    if (selectedCalculatorId === "c1-revenue" && challenge1Results) {
                      calculatedRows = challenge1Results.calculator1.rows;
                    } else if (selectedCalculatorId === "c1-chargeback" && challenge1Results) {
                      calculatedRows = challenge1Results.calculator2.rows;
                    } else if (selectedCalculatorId === "c245-revenue" && challenge245Results) {
                      calculatedRows = challenge245Results.calculator1.rows;
                    } else if (selectedCalculatorId === "c245-chargeback" && challenge245Results) {
                      calculatedRows = challenge245Results.calculator2.rows;
                    }
                    
                    if (onGenerateCalculatorSlides) {
                      onGenerateCalculatorSlides({
                        calculatorId: selectedCalculatorId,
                        calculatorTitle: selectedCalculator.title,
                        rows: calculatedRows,
                        ...(selectedCalculatorId === "c245-revenue" && c245FunnelSlideDataForReport && { funnelSlide: c245FunnelSlideDataForReport }),
                      });
                    } else {
                      generateCalculatorSlide(
                        selectedCalculatorId,
                        selectedCalculator.title,
                        calculatedRows,
                        formData
                      );
                    }
                  }
                };
                
                // Show button if we have rows or can calculate them
                const hasRows = selectedCalculator?.rows && selectedCalculator.rows.length > 0;
                const canCalculate = (selectedCalculatorId === "c1-revenue" || selectedCalculatorId === "c1-chargeback") && challenge1Results ||
                                    (selectedCalculatorId === "c245-revenue" || selectedCalculatorId === "c245-chargeback") && challenge245Results;
                
                if (!hasRows && !canCalculate) return null;
                
                return (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={handleGenerateOrDownload}
                  >
                    <Presentation className="w-4 h-4" />
                    Generate Slide{showSegmentedDownload ? 's' : ''}
                  </Button>
                );
              })()}
              </div>
              {/* Deduplication toggle - show for GMV uplift calculators on calculator, funnel, or visual tab */}
              {(calculatorModalTab === 'calculator' || calculatorModalTab === 'funnel' || calculatorModalTab === 'visual') && (selectedCalculatorId === "c1-revenue" || selectedCalculatorId === "c245-revenue") && (
                <div className="flex items-center gap-3 ml-auto">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="deduplication-toggle"
                      checked={deduplicationEnabled}
                      onCheckedChange={setDeduplicationEnabled}
                    />
                    <Label htmlFor="deduplication-toggle" className="text-sm font-medium whitespace-nowrap">
                      Apply Deduplication
                    </Label>
                  </div>
                  <Popover open={showDeduplicationInfo} onOpenChange={setShowDeduplicationInfo}>
                    <PopoverTrigger asChild>
                      <button className="p-1 rounded-full hover:bg-muted" aria-label="Deduplication info">
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[420px]" align="end">
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Deduplication Assumptions</h4>
                          <p className="text-xs text-muted-foreground mb-3">
                            Deduplication accounts for customers who retry transactions after initial declines. 
                            Some "new" approvals represent retries of previously declined legitimate transactions.
                          </p>
                        </div>
                        
                        {/* Full calculation breakdown table */}
                        {(() => {
                          // Use segmented breakdown when segmentation is enabled, otherwise fall back to global
                          const breakdown = isSegmentationEnabled 
                            ? segmentedDeduplicationBreakdown
                            : (challenge245Results?.calculator1?.deduplicationBreakdown || 
                               challenge1Results?.calculator1?.deduplicationBreakdown);
                          if (!breakdown) return null;
                          
                          const fmtCur = createCurrencyFormatter(formData.baseCurrency || 'USD');
                          const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
                          const isSimplified = breakdown.approvedTxImprovement !== undefined;
                          
                          return (
                            <div className="border rounded-md overflow-hidden mb-3">
                              <table className="w-full text-xs">
                                <thead className="bg-muted">
                                  <tr>
                                    <th className="px-2 py-1 text-left font-medium w-12">Formula</th>
                                    <th className="px-2 py-1 text-left font-medium">Description</th>
                                    <th className="px-2 py-1 text-right font-medium">Value</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {isSimplified ? (
                                    <>
                                      <tr>
                                        <td className="px-2 py-1 text-muted-foreground">a</td>
                                        <td className="px-2 py-1">Approved transactions (#) improvement (Forter − Customer)</td>
                                        <td className="px-2 py-1 text-right font-mono">{fmt(Math.round(breakdown.approvedTxImprovement!))}</td>
                                      </tr>
                                      <tr className="bg-muted/50 font-medium">
                                        <td className="px-2 py-1 text-muted-foreground">b = −a</td>
                                        <td className="px-2 py-1">Total delta (inverse)</td>
                                        <td className="px-2 py-1 text-right font-mono">{fmt(Math.round(breakdown.nonFraudDelta))}</td>
                                      </tr>
                                      <tr className="bg-blue-50 dark:bg-blue-950">
                                        <td className="px-2 py-1 text-muted-foreground">c</td>
                                        <td className="px-2 py-1">Assumed retry rate</td>
                                        <td className="px-2 py-1 text-right font-mono">{breakdown.retryRate.toFixed(1)}%</td>
                                      </tr>
                                      <tr className="bg-blue-50 dark:bg-blue-950">
                                        <td className="px-2 py-1 text-muted-foreground">d</td>
                                        <td className="px-2 py-1">Assumed success rate</td>
                                        <td className="px-2 py-1 text-right font-mono">{breakdown.successRate.toFixed(1)}%</td>
                                      </tr>
                                      <tr className="font-medium">
                                        <td className="px-2 py-1 text-muted-foreground">e = b×c×d</td>
                                        <td className="px-2 py-1">Duplicate successful transactions</td>
                                        <td className="px-2 py-1 text-right font-mono">{fmt(Math.round(breakdown.duplicateSuccessfulTx))}</td>
                                      </tr>
                                      <tr>
                                        <td className="px-2 py-1 text-muted-foreground">f</td>
                                        <td className="px-2 py-1">Completed AOV</td>
                                        <td className="px-2 py-1 text-right font-mono">{fmtCur(breakdown.aov)}</td>
                                      </tr>
                                      {breakdown.recoveredOrderAOV != null && breakdown.aovMultiplier != null ? (
                                        <>
                                          <tr>
                                            <td className="px-2 py-1 text-muted-foreground">g</td>
                                            <td className="px-2 py-1">Recovered AOV multiplier (Forter KPI)</td>
                                            <td className="px-2 py-1 text-right font-mono">{(breakdown.aovMultiplier).toFixed(2)}×</td>
                                          </tr>
                                          <tr>
                                            <td className="px-2 py-1 text-muted-foreground">h = f×g</td>
                                            <td className="px-2 py-1">Recovered AOV</td>
                                            <td className="px-2 py-1 text-right font-mono">{fmtCur(breakdown.recoveredOrderAOV)}</td>
                                          </tr>
                                        </>
                                      ) : null}
                                      <tr className="bg-green-50 dark:bg-green-950 font-semibold">
                                        <td className="px-2 py-1 text-muted-foreground">{breakdown.recoveredOrderAOV != null ? "i = e×h" : "g = e×f"}</td>
                                        <td className="px-2 py-1">Deduplication GMV (added to value of approved transactions)</td>
                                        <td className="px-2 py-1 text-right font-mono">{fmtCur(breakdown.gmvReduction)}</td>
                                      </tr>
                                    </>
                                  ) : (
                                    <>
                                      <tr>
                                        <td className="px-2 py-1 text-muted-foreground">a</td>
                                        <td className="px-2 py-1">Fraud transaction drop-off</td>
                                        <td className="px-2 py-1 text-right font-mono">{fmt(Math.round(breakdown.fraudTxDropOff))}</td>
                                      </tr>
                                      <tr className="bg-muted/50 font-medium">
                                        <td className="px-2 py-1 text-muted-foreground">b</td>
                                        <td className="px-2 py-1">Total delta</td>
                                        <td className="px-2 py-1 text-right font-mono">{fmt(Math.round(breakdown.nonFraudDelta))}</td>
                                      </tr>
                                      <tr className="bg-blue-50 dark:bg-blue-950">
                                        <td className="px-2 py-1 text-muted-foreground">c</td>
                                        <td className="px-2 py-1">Assumed retry rate</td>
                                        <td className="px-2 py-1 text-right font-mono">{breakdown.retryRate.toFixed(1)}%</td>
                                      </tr>
                                      <tr className="bg-blue-50 dark:bg-blue-950">
                                        <td className="px-2 py-1 text-muted-foreground">d</td>
                                        <td className="px-2 py-1">Assumed success rate</td>
                                        <td className="px-2 py-1 text-right font-mono">{breakdown.successRate.toFixed(1)}%</td>
                                      </tr>
                                      <tr className="font-medium">
                                        <td className="px-2 py-1 text-muted-foreground">e = b×c×d</td>
                                        <td className="px-2 py-1">Duplicate successful transactions</td>
                                        <td className="px-2 py-1 text-right font-mono">{fmt(Math.round(breakdown.duplicateSuccessfulTx))}</td>
                                      </tr>
                                      <tr>
                                        <td className="px-2 py-1 text-muted-foreground">f</td>
                                        <td className="px-2 py-1">Completed AOV</td>
                                        <td className="px-2 py-1 text-right font-mono">{fmtCur(breakdown.aov)}</td>
                                      </tr>
                                      {breakdown.recoveredOrderAOV != null && breakdown.aovMultiplier != null ? (
                                        <>
                                          <tr>
                                            <td className="px-2 py-1 text-muted-foreground">g</td>
                                            <td className="px-2 py-1">Recovered AOV multiplier (Forter KPI)</td>
                                            <td className="px-2 py-1 text-right font-mono">{(breakdown.aovMultiplier).toFixed(2)}×</td>
                                          </tr>
                                          <tr>
                                            <td className="px-2 py-1 text-muted-foreground">h = f×g</td>
                                            <td className="px-2 py-1">Recovered AOV</td>
                                            <td className="px-2 py-1 text-right font-mono">{fmtCur(breakdown.recoveredOrderAOV)}</td>
                                          </tr>
                                        </>
                                      ) : null}
                                      <tr className="bg-green-50 dark:bg-green-950 font-semibold">
                                        <td className="px-2 py-1 text-muted-foreground">{breakdown.recoveredOrderAOV != null ? "i = e×h" : "g = e×f"}</td>
                                        <td className="px-2 py-1">Deduplication GMV (added to value of approved transactions)</td>
                                        <td className="px-2 py-1 text-right font-mono">{fmtCur(breakdown.gmvReduction)}</td>
                                      </tr>
                                    </>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          );
                        })()}
                        
                        <div className="space-y-3 border-t pt-3">
                          <div>
                            <Label htmlFor="retry-rate" className="text-xs">
                              Retry Rate (% of declined customers who retry)
                            </Label>
                            <div className="flex items-center gap-2 mt-1">
                              <Input
                                id="retry-rate"
                                type="number"
                                min={0}
                                max={100}
                                value={deduplicationRetryRate}
                                onChange={(e) => setDeduplicationRetryRate(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                                className="h-8 w-20"
                              />
                              <span className="text-sm text-muted-foreground">%</span>
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="success-rate" className="text-xs">
                              Success Rate (% of retries that succeed)
                            </Label>
                            <div className="flex items-center gap-2 mt-1">
                              <Input
                                id="success-rate"
                                type="number"
                                min={0}
                                max={100}
                                value={deduplicationSuccessRate}
                                onChange={(e) => setDeduplicationSuccessRate(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                                className="h-8 w-20"
                              />
                              <span className="text-sm text-muted-foreground">%</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground border-t pt-2">
                          Deduplication factor: {((deduplicationRetryRate / 100) * (deduplicationSuccessRate / 100) * 100).toFixed(1)}% 
                          of incremental GMV already captured
                        </p>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          </DialogHeader>
          
          {/* Tabs for Benefit Summary vs Calculator */}
          <Tabs value={calculatorModalTab} onValueChange={(v) => {
              setCalculatorModalTab(v as 'summary' | 'inputs' | 'calculator' | 'funnel' | 'visual' | 'success-stories');
              const calcId = modalContext.sourceIdForModal ?? selectedCalculatorId ?? '';
              if (v === 'success-stories' && calcId) setSuccessStoriesViewed(prev => new Set(prev).add(calcId));
              if (v === 'funnel' && calcId) setFunnelViewed(prev => new Set(prev).add(calcId));
              if (v === 'visual' && calcId) setVisualViewed(prev => new Set(prev).add(calcId));
            }} className="w-full">
            {/* Show all 3 tabs (Benefit Summary, Inputs, Calculator) in both Guided and Custom mode when calculator has required inputs */}
            {(() => {
              const { sourceIdForModal, modalFormData } = modalContext;
              const hasCalculatorRows = selectedCalculator?.rows && selectedCalculator.rows.length > 0;
              const hasInputsConfig = sourceIdForModal ? !!CALCULATOR_REQUIRED_INPUTS[sourceIdForModal] : false;
              // In Guided mode always show Calculator tab when modal is open; in Custom mode show when we have rows
              const showCalculatorTab = !!selectedCalculatorId && (isCustomMode ? hasCalculatorRows : true);
              const showInputsTab = selectedCalculatorId && hasInputsConfig; // Always show if config exists
              const isInputsComplete = sourceIdForModal ? getCalculatorCompletionPercentage(sourceIdForModal, modalFormData) === 100 : false;
              
              // Calculate number of visible tabs (Benefit Summary, optional Inputs, optional Calculator, Success Story)
              const showSuccessStoriesTab = hasCaseStudy(modalContext.sourceIdForModal ?? selectedCalculatorId ?? '');
              const showFunnelTab = showCalculatorTab && selectedCalculatorId === 'c245-revenue' && (funnelToShow?.length ?? 0) > 0;
              const showVisualTab = showCalculatorTab && (() => {
                const src = (modalContext.sourceIdForModal ?? selectedCalculatorId) ?? '';
                const title = (selectedCalculator?.title ?? '').toLowerCase();
                const isPromotionAbuseByTitle = title.includes('promotion abuse');
                const hasVisualById = ['c1-revenue', 'c1-chargeback', 'c245-chargeback', 'c3-review', 'c7-disputes', 'c7-opex', 'c8-returns', 'c8-inr', 'c9-cs-opex', 'c9-cx-uplift', 'c10-promotions', 'c12-ato-opex', 'c13-clv', 'c14-marketing', 'c14-reactivation', 'c14-kyc'].includes(src);
                return hasVisualById || isPromotionAbuseByTitle;
              })();
              const tabCount = 2 + (showInputsTab ? 1 : 0) + (showCalculatorTab ? 1 : 0) + (showFunnelTab ? 1 : 0) + (showVisualTab ? 1 : 0) + 1;
              const gridCols = tabCount === 7 ? 'grid-cols-7' : tabCount === 6 ? 'grid-cols-6' : tabCount === 5 ? 'grid-cols-5' : tabCount === 4 ? 'grid-cols-4' : tabCount === 3 ? 'grid-cols-3' : 'grid-cols-2';
              
              return (
                <TabsList className={`grid w-full max-w-2xl ${gridCols}`}>
                  <TabsTrigger value="summary" className="gap-2">
                    Benefit Summary
                    {isInputsComplete && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  </TabsTrigger>
                  {showInputsTab && (
                    <TabsTrigger value="inputs" className="gap-2">
                      Inputs
                      {isInputsComplete && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                    </TabsTrigger>
                  )}
                  {showCalculatorTab && (
                    <TabsTrigger value="calculator" className="gap-2">
                      Calculator
                      {isInputsComplete && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                    </TabsTrigger>
                  )}
                  {showFunnelTab && (
                    <TabsTrigger value="funnel" className="gap-2">
                      Visual
                      {funnelViewed.has(modalContext.sourceIdForModal ?? selectedCalculatorId ?? '') && (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-green-500" />
                      )}
                    </TabsTrigger>
                  )}
                  {showVisualTab && (
                    <TabsTrigger value="visual" className="gap-2">
                      Visual
                      {visualViewed.has(modalContext.sourceIdForModal ?? selectedCalculatorId ?? '') && (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-green-500" />
                      )}
                    </TabsTrigger>
                  )}
                  {showSuccessStoriesTab ? (
                    <TabsTrigger value="success-stories" className="gap-2">
                      Success Story
                      {successStoriesViewed.has(modalContext.sourceIdForModal ?? selectedCalculatorId ?? '') && (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-green-500" />
                      )}
                    </TabsTrigger>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <TabsTrigger value="success-stories" className="gap-2" disabled>
                            <Lock className="w-4 h-4 shrink-0" />
                            Success Story
                          </TabsTrigger>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>No case study available for this benefit</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </TabsList>
              );
            })()}
            
            {/* Benefit Summary Tab */}
            <TabsContent value="summary" className="mt-4">
              <div data-benefit-pdf="summary" className="min-h-0">
              {(() => {
                const content = (modalContext.sourceIdForModal ?? selectedCalculatorId) ? getChallengeBenefitContent(modalContext.sourceIdForModal ?? selectedCalculatorId!) : null;
                if (!content) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No challenge/benefit information available for this calculator.</p>
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Challenge (Left) */}
                      <Card className="p-6 border-destructive/20 bg-destructive/5">
                        <div className="flex items-start gap-3 mb-4">
                          <div className="p-2 rounded-full bg-destructive/10">
                            <AlertTriangle className="w-5 h-5 text-destructive" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">The Challenge</h3>
                            <p className="text-sm text-muted-foreground">{content.challengeTitle}</p>
                          </div>
                        </div>
                        <p className="text-sm leading-relaxed text-foreground/90">
                          {content.challengeDescription}
                        </p>
                      </Card>
                      
                      {/* Benefit (Right) */}
                      <Card className="p-6 border-primary/20 bg-primary/5">
                        <div className="flex items-start gap-3 mb-4">
                          <div className="p-2 rounded-full bg-primary/10">
                            <CheckCircle2 className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">The Benefit</h3>
                            <p className="text-sm text-muted-foreground">{content.benefitTitle}</p>
                          </div>
                        </div>
                        <p className="text-sm leading-relaxed text-foreground/90 mb-4">
                          {content.benefitDescription}
                        </p>
                        {content.benefitPoints && content.benefitPoints.length > 0 && (
                          <div className="space-y-3 pt-3 border-t border-primary/10">
                            {content.benefitPoints.map((point, idx) => (
                              <div key={idx} className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                <div>
                                  <span className="font-medium text-sm">{point.title}:</span>
                                  <span className="text-sm text-muted-foreground ml-1">{point.description}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>
                    </div>
                  </div>
                );
              })()}
              </div>
            </TabsContent>
            
            {/* Inputs Tab - shows all relevant customer inputs and KPIs for the calculator */}
            <TabsContent value="inputs" className="mt-4">
              <div data-benefit-pdf="inputs" className="min-h-0">
              {modalContext.sourceIdForModal && CALCULATOR_REQUIRED_INPUTS[modalContext.sourceIdForModal] && (
                <CalculatorInputsTab
                  calculatorId={modalContext.sourceIdForModal}
                  formData={modalContext.modalFormData}
                  onFormDataChange={(field, value) => (modalContext.modalOnFormDataChange ?? onFormDataChange)?.(field, value)}
                  onForterKPIChange={(field, value) => onForterKPIChange?.(field, value)}
                  currency={modalContext.modalFormData.baseCurrency || 'USD'}
                />
              )}
              </div>
            </TabsContent>
            
            {/* Calculator Tab */}
            <TabsContent value="calculator" className="mt-4">
              <div data-benefit-pdf="calculator" className="min-h-0">
              {selectedCalculator && (() => {
                const sourceId = modalContext.sourceIdForModal ?? selectedCalculatorId;
                // Determine if we should show segment tabs for this calculator
                const isSegmentableCalculator = sourceId === "c1-revenue" || 
                  sourceId === "c1-chargeback" || 
                  sourceId === "c245-revenue" || 
                  sourceId === "c245-chargeback";
                const isSegmentationEnabled = modalContext.modalFormData.segmentationEnabled && (modalContext.modalFormData.segments?.filter(s => s.enabled).length ?? 0) > 0;
                
                // Show fraud coverage toggle for chargeback calculators and Challenge 1 (reduce false declines / reduce fraud chargebacks)
                const showFraudCoverageToggle = sourceId === "c1-chargeback" || sourceId === "c245-chargeback" || sourceId === "c7-disputes";
                
                return (
                  <div className="space-y-4">
                    {/* Fraud Chargeback Coverage Toggle */}
                    {showFraudCoverageToggle && (
                      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
                        <Switch
                          id="fraud-cb-coverage-calc"
                          checked={fraudCBCoverageEnabled}
                          onCheckedChange={setFraudCBCoverageEnabled}
                        />
                        <div className="flex-1">
                          <Label htmlFor="fraud-cb-coverage-calc" className="cursor-pointer font-medium">
                            Includes Fraud Chargeback Coverage
                          </Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {fraudCBCoverageEnabled 
                              ? selectedCalculatorId === "c7-disputes"
                                ? "Fraud chargebacks excluded - only service chargebacks are shown"
                                : "Forter assumes fraud chargeback liability - fraud chargebacks override to $0"
                              : "Enable if prospect will purchase fraud chargeback coverage"}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {/* Calculator Display */}
                    {isSegmentableCalculator && isSegmentationEnabled ? (
                      <SegmentCalculatorTabs
                        challengeType={sourceId.startsWith("c1-") ? "c1" as const : "c245" as const}
                        calculatorType={sourceId.endsWith("-revenue") ? "revenue" as const : "chargeback" as const}
                        formData={modalContext.modalFormData}
                        globalForterKPIs={forterKPIs}
                        deduplicationEnabled={deduplicationEnabled}
                        deduplicationRetryRate={deduplicationRetryRate}
                        deduplicationSuccessRate={deduplicationSuccessRate}
                        includesFraudCBCoverage={fraudCBCoverageEnabled}
                        onSegmentInputChange={onSegmentInputChange}
                        onSegmentKPIChange={onSegmentKPIChange}
                        onFormDataChange={(field, value) => (modalContext.modalOnFormDataChange ?? onFormDataChange)?.(field, value)}
                      />
                    ) : (
                      <EditableCalculatorDisplay 
                        title={selectedCalculator.title} 
                        rows={selectedCalculator.rows}
                        onCustomerFieldChange={(field, value) => (modalContext.modalOnFormDataChange ?? onFormDataChange)?.(field, value)}
                        onForterFieldChange={(field, value) => {
                          // Handle abuseBenchmarks fields specially
                          const abuseBenchmarkFields = [
                            'egregiousReturnsAbusePct',
                            'egregiousINRAbusePct',
                            'nonEgregiousReturnsAbusePct',
                            'forterEgregiousReturnsReduction',
                            'forterEgregiousINRReduction',
                            'forterNonEgregiousReturnsReduction'
                          ];
                          
                          const fieldStr = String(field);
                          
                          // Handle forterCatchRate: sync with forterEgregiousReturnsReduction bidirectionally
                          if (fieldStr === 'forterCatchRate') {
                            // Update catch rate
                            onForterKPIChange?.('forterCatchRate' as keyof ForterKPIs, value);
                            // Also sync with forterEgregiousReturnsReduction in abuseBenchmarks
                            const currentBenchmarks = forterKPIs.abuseBenchmarks || defaultAbuseBenchmarks;
                            const updatedBenchmarks = { ...currentBenchmarks, forterEgregiousReturnsReduction: value };
                            onForterKPIChange?.('abuseBenchmarks' as keyof ForterKPIs, updatedBenchmarks as any);
                          } else if (fieldStr === 'forterEgregiousReturnsReduction') {
                            // When reduction is edited, sync catch rate
                            const currentBenchmarks = forterKPIs.abuseBenchmarks || defaultAbuseBenchmarks;
                            const updatedBenchmarks = { ...currentBenchmarks, forterEgregiousReturnsReduction: value };
                            onForterKPIChange?.('abuseBenchmarks' as keyof ForterKPIs, updatedBenchmarks as any);
                            // Also update catch rate to match
                            onForterKPIChange?.('forterCatchRate' as keyof ForterKPIs, value);
                          } else if (abuseBenchmarkFields.includes(fieldStr)) {
                            const currentBenchmarks = forterKPIs.abuseBenchmarks || defaultAbuseBenchmarks;
                            const updatedBenchmarks = { ...currentBenchmarks, [fieldStr]: value };
                            onForterKPIChange?.('abuseBenchmarks' as keyof ForterKPIs, updatedBenchmarks as any);
                          } else if (fieldStr === 'forter3DSAbandonmentRate' || fieldStr === 'forterIssuingBankDeclineRate') {
                            onForterKPIChange?.(field, Math.max(0, Math.min(100, value)));
                          } else {
                            onForterKPIChange?.(field, value);
                          }
                        }}
                        formData={modalContext.modalFormData}
                        forterKPIs={forterKPIs}
                      />
                    )}
                  </div>
                );
              })()}
              </div>
            </TabsContent>

            {/* Funnel Tab – waterfall % or # transactions; no chargebacks section; c245-revenue only */}
            <TabsContent value="funnel" className="mt-4">
              <div data-benefit-pdf="funnel" className="min-h-0 space-y-4">
                {(() => {
                  const funnel = funnelToShow;
                  if (!funnel || funnel.length === 0) {
                    return (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>Funnel data is not available. Complete payment funnel inputs to see the chart.</p>
                      </div>
                    );
                  }
                  const funnelStages = funnel.filter((s: PaymentFunnelStage) => !s.isPostCompletion);
                  const totalRecoverableVol = funnelStages.reduce((sum, s) => sum + (s.recoverableVolume ?? 0), 0);
                  // Use same source as first card so funnel total matches "TOTAL RECOVERABLE" card (avoids off-by-one)
                  const breakdownForTotal = isSegmentationEnabled ? segmentedDeduplicationBreakdown : (challenge245Results?.calculator1?.deduplicationBreakdown ?? null);
                  const displayTotalRecoverable = breakdownForTotal?.approvedTxImprovement != null ? Math.round(breakdownForTotal.approvedTxImprovement) : totalRecoverableVol;
                  const fmtVol = (n: number) => n.toLocaleString('en-US');
                  const fmtVolSigned = (n: number) => n < 0 ? `(${Math.abs(n).toLocaleString('en-US')})` : n.toLocaleString('en-US');
                  const fmtVolK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));
                  const getRecoveryLabel = (stageId: string) => {
                    switch (stageId) {
                      case 'preauth': return 'false declines';
                      case '3ds': return 'exemption/frictionless shift';
                      case 'bank': return 'more authorizations';
                      case 'postauth': return 'false declines';
                      default: return '';
                    }
                  };
                  const modalFormData = modalContext.modalFormData;
                  const totalTransactionAttempts = (modalFormData.segmentationEnabled && (modalFormData.segments?.filter((s: { enabled?: boolean }) => s.enabled).length ?? 0) > 0)
                    ? (modalFormData.segments ?? []).filter((s: { enabled?: boolean }) => s.enabled).reduce((sum: number, s: { inputs?: { grossAttempts?: number } }) => sum + (s.inputs?.grossAttempts ?? 0), 0)
                    : (modalFormData.amerGrossAttempts ?? 0);
                  const showAsTransactions = funnelViewMode === 'transactions';
                  const declineSegmentColor = (stage: PaymentFunnelStage) => {
                    if (stage.id === 'preauth') return 'bg-red-300';
                    if (stage.id === '3ds') return 'bg-red-400';
                    if (stage.id === 'bank') return 'bg-red-500';
                    if (stage.id === 'postauth') return 'bg-red-600';
                    return 'bg-red-500';
                  };
                  return (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-4 mb-4">
                        <h4 className="text-sm font-semibold text-center text-muted-foreground flex-1">
                          How transactions flow — payments funnel
                        </h4>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">%</span>
                          <Switch
                            id="funnel-view-mode"
                            checked={showAsTransactions}
                            onCheckedChange={(checked) => {
                              const mode = checked ? 'transactions' : 'percent';
                              setFunnelViewMode(mode);
                              onFormDataChange?.('_funnelViewMode' as keyof CalculatorData, mode);
                            }}
                          />
                          <span className="text-xs text-muted-foreground"># of transactions</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-3 items-center text-sm">
                        <div className="font-medium text-muted-foreground">{showAsTransactions ? 'Current state (# of transactions)' : 'Current state (% of attempts)'}</div>
                        <div className="font-medium text-muted-foreground text-right">Forter recoverable</div>
                        {funnelStages.map((stage: PaymentFunnelStage) => {
                          const isAttempts = stage.id === 'attempts';
                          const isDecline = stage.isDecline;
                          const isCompleted = stage.isCompleted;
                          const pctRemaining = Math.min(100, stage.pctRemaining);
                          const pctDeducted = Math.min(100, stage.pctOfAttempts);
                          const countRemaining = Math.round(totalTransactionAttempts * (pctRemaining / 100));
                          const countDeducted = Math.round(totalTransactionAttempts * (pctDeducted / 100));
                          const displayVal = showAsTransactions ? (isAttempts ? totalTransactionAttempts : (isCompleted ? countRemaining : countDeducted)) : (isAttempts ? '100' : stage.pctOfAttempts.toFixed(1));
                          const displaySuffix = showAsTransactions ? '' : '%';
                          return (
                            <div key={stage.id} className="contents group">
                              <div className="flex items-center gap-3">
                                <div className="w-40 shrink-0 text-sm font-medium">{stage.label}</div>
                                <div className="flex-1 min-w-0 h-7 rounded overflow-hidden flex">
                                  {isAttempts && (
                                    <div className="h-full flex-1 min-w-0 bg-green-400 rounded flex items-center pl-2 text-xs font-medium text-green-900/80" style={{ minWidth: '100%' }}>
                                      {showAsTransactions ? fmtVol(totalTransactionAttempts) : '100%'}
                                    </div>
                                  )}
                                  {isDecline && (
                                    <>
                                      <div className="h-full bg-muted/70 shrink-0 flex items-center rounded" style={{ width: `${pctRemaining}%`, minWidth: 0 }} />
                                      {pctDeducted > 0 && (
                                        <div
                                          className={cn("h-full shrink-0 flex items-center justify-end pr-1.5 rounded-r", declineSegmentColor(stage))}
                                          style={{ width: `${pctDeducted}%`, minWidth: '2rem' }}
                                        />
                                      )}
                                    </>
                                  )}
                                  {isCompleted && !isAttempts && (
                                    <div className="h-full bg-green-800 rounded flex items-center pl-2 text-xs font-medium text-green-100" style={{ width: `${pctRemaining}%`, minWidth: 0 }}>
                                      {showAsTransactions ? fmtVol(countRemaining) : `${stage.pctOfAttempts.toFixed(1)}%`}
                                    </div>
                                  )}
                                </div>
                                <div className="w-28 shrink-0 text-right flex flex-col justify-center">
                                  {isAttempts && (
                                    <>
                                      <span className="text-lg font-bold tabular-nums">{showAsTransactions ? fmtVol(totalTransactionAttempts) : '100%'}</span>
                                      <span className="text-xs text-muted-foreground">baseline</span>
                                    </>
                                  )}
                                  {isDecline && !isAttempts && (
                                    <>
                                      <span className="text-lg font-bold tabular-nums text-red-700 dark:text-red-300">{showAsTransactions ? fmtVol(countDeducted) : `${stage.pctOfAttempts.toFixed(1)}%`}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {stage.id === '3ds' ? 'lost' : stage.id === 'bank' ? 'rejected' : 'declined'}
                                      </span>
                                    </>
                                  )}
                                  {isCompleted && (
                                    <>
                                      <span className="text-lg font-bold tabular-nums text-green-800 dark:text-green-200">{showAsTransactions ? fmtVol(countRemaining) : `${stage.pctOfAttempts.toFixed(1)}%`}</span>
                                      <span className="text-xs text-muted-foreground">converted</span>
                                    </>
                                  )}
                                </div>
                                <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground/40" aria-hidden />
                              </div>
                              <div className="text-right max-w-[200px]">
                                {isCompleted ? (
                                  displayTotalRecoverable != null ? (
                                    displayTotalRecoverable === 0 ? (
                                      <span className="text-muted-foreground">-</span>
                                    ) : (
                                      <span className="block">
                                        <span className={cn("font-bold", displayTotalRecoverable >= 0 ? "text-green-800 dark:text-green-300 text-base" : "text-red-600 dark:text-red-400 text-sm")}>~{fmtVolSigned(displayTotalRecoverable)} tx</span>
                                        <span className="block text-xs text-muted-foreground mt-0.5">{displayTotalRecoverable < 0 ? 'additionally impacted' : 'total recoverable'}</span>
                                      </span>
                                    )
                                  ) : null
                                ) : stage.recoverableVolume != null ? (
                                  stage.recoverableVolume === 0 ? (
                                    <span className="text-muted-foreground">-</span>
                                  ) : showAsTransactions ? (
                                    <span className="block">
                                      <span className={cn("font-bold text-sm", stage.recoverableVolume >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400")}>~{fmtVolSigned(stage.recoverableVolume)} tx</span>
                                      <span className="block text-xs text-muted-foreground mt-0.5">{stage.recoverableVolume < 0 ? 'additionally impacted' : (getRecoveryLabel(stage.id) || 'recoverable')}</span>
                                    </span>
                                  ) : (
                                    (() => {
                                      const declinedCount = totalTransactionAttempts * (stage.pctOfAttempts / 100);
                                      const recoveryPct = declinedCount > 0 ? Math.round((stage.recoverableVolume / declinedCount) * 100) : 0;
                                      const isNegative = stage.recoverableVolume < 0;
                                      const label = isNegative ? 'additionally impacted' : getRecoveryLabel(stage.id);
                                      return (
                                        <span className="block">
                                          <span className={cn("font-bold text-sm", stage.recoverableVolume >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400")}>{isNegative ? `(${Math.abs(recoveryPct)}%)` : `${recoveryPct}%`}</span>
                                          <span className="block text-xs text-muted-foreground mt-0.5">{label}</span>
                                        </span>
                                      );
                                    })()
                                  )
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                        <div className="col-span-2 pt-2 border-t text-xs text-muted-foreground text-right">
                          Total opportunity above ~{fmtVolSigned(displayTotalRecoverable)} recoverable transactions
                        </div>
                      </div>
                      {/* Recoverable GMV: horizontal card flow (slide-style) */}
                      {(() => {
                        const breakdown = isSegmentationEnabled
                          ? segmentedDeduplicationBreakdown
                          : (challenge245Results?.calculator1?.deduplicationBreakdown ?? null);
                        if (!breakdown || breakdown.aov == null) return null;
                        const fmtCur = createCurrencyFormatter(formData.baseCurrency || 'USD');
                        const approvedTx = breakdown.approvedTxImprovement ?? totalRecoverableVol;
                        const recoveredAov = breakdown.recoveredOrderAOV ?? breakdown.aov;
                        const dupTx = Math.round(breakdown.duplicateSuccessfulTx ?? 0);
                        const dupPct = breakdown.retryRate != null && breakdown.successRate != null
                          ? (breakdown.retryRate * breakdown.successRate) / 100
                          : 0;
                        const dedupRecoverableTx = approvedTx + dupTx;
                        const displayGmv = (isSegmentationEnabled && segmentedC245RevenueTotal != null)
                          ? segmentedC245RevenueTotal
                          : (deduplicationEnabled
                            ? (challenge245Results?.calculator1?.deduplicatedRevenueUplift ?? (approvedTx * recoveredAov - Math.abs(breakdown.gmvReduction ?? 0)))
                            : (challenge245Results?.calculator1?.revenueUplift ?? approvedTx * recoveredAov));
                        const cardClass = "rounded-lg border bg-card px-4 py-3 text-center shadow-sm w-[9.5rem] min-h-[5.25rem] flex flex-col justify-center items-center";
                        const labelClass = "text-xs text-muted-foreground tracking-wide mb-0.5";
                        const valueClass = "font-semibold text-foreground";
                        const hasRecoveredAovMultiplier = breakdown.recoveredOrderAOV != null && breakdown.aovMultiplier != null;
                        return (
                          <div className="flex flex-col gap-4 py-2">
                            <p className="text-sm font-semibold text-muted-foreground mb-0">Value Impact</p>
                            <div className="flex flex-wrap items-center justify-center gap-2">
                              <div className={cardClass}>
                                <div className={labelClass}>Total recoverable</div>
                                <div className={valueClass}>{Math.round(approvedTx).toLocaleString('en-US')} tx</div>
                              </div>
                              {deduplicationEnabled && (
                                <>
                                  <ChevronRight className="w-5 h-5 text-muted-foreground/50 flex-shrink-0" aria-hidden />
                                  <div className={cardClass}>
                                    <div className={cn("flex items-center justify-center gap-1", labelClass)}>
                                      Less duplicate attempts
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button type="button" className="rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring" aria-label="How duplicate attempts are calculated">
                                            <Info className="w-3.5 h-3.5 shrink-0" />
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-xs p-3">
                                          <p className="font-medium mb-1">Duplicate attempts</p>
                                          <p className="text-muted-foreground text-sm">
                                            Duplicate successful transactions = total recoverable × retry rate × success rate. We assume {breakdown.retryRate?.toFixed(1) ?? '—'}% of declined customers retry and {breakdown.successRate?.toFixed(1) ?? '—'}% of those retries succeed, so about {dupPct.toFixed(1)}% of the recoverable volume are duplicates that would have been recovered anyway.
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                    <div className={valueClass}>{dupPct.toFixed(1)}%</div>
                                    <div className="text-xs text-muted-foreground">({Math.abs(dupTx).toLocaleString('en-US')} tx)</div>
                                  </div>
                                  <ChevronRight className="w-5 h-5 text-muted-foreground/50 flex-shrink-0" aria-hidden />
                                  <div className={cardClass}>
                                    <div className={labelClass}>Deduplicated recoverable</div>
                                    <div className={valueClass}>{Math.round(dedupRecoverableTx).toLocaleString('en-US')} tx</div>
                                  </div>
                                </>
                              )}
                              <ChevronRight className="w-5 h-5 text-muted-foreground/50 flex-shrink-0" aria-hidden />
                              <div className={cardClass}>
                                <div className={cn("flex items-center justify-center gap-1", labelClass)}>
                                  × Recovered AOV
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button type="button" className="rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring" aria-label="How recovered average order value is calculated">
                                        <Info className="w-3.5 h-3.5 shrink-0" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs p-3">
                                      <p className="font-medium mb-1">Recovered average order value</p>
                                      <p className="text-muted-foreground text-sm">
                                        {hasRecoveredAovMultiplier
                                          ? <>Recovered average order value = completed average order value × recovered average order value multiplier (from Forter benchmarks). Recoverable transactions are valued at this higher average order value to reflect the typically larger basket size of recovered orders.</>
                                          : <>When no multiplier is set, recovered average order value equals completed average order value. Configure the recovered average order value multiplier in Forter benchmarks to value recoverable transactions at a higher average order value.</>
                                        }
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                <div className={valueClass}>{fmtCur(recoveredAov)}</div>
                              </div>
                            </div>
                            <div className="flex justify-center">
                              <div className={cn(cardClass, "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 w-auto min-w-[12rem]")}>
                                <div className={labelClass}>Recoverable GMV potential</div>
                                <div className="font-bold text-lg text-green-800 dark:text-green-300">{fmtCur(displayGmv)}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}
              </div>
            </TabsContent>

            {/* Visual Tab – c1-revenue, chargeback, c3-review, c7-disputes, c7-opex, c9-cs-opex, c9-cx-uplift */}
            <TabsContent value="visual" className="mt-4">
              <div data-benefit-pdf="visual" className="min-h-0 space-y-6">
                {/* c9-cs-opex: Reduced CS ticket handling visual (ticket flow + cost impact + callout) */}
                {selectedCalculatorId === 'c9-cs-opex' && challenge9Results?.calculator2 && (
                  <CSOpExVisual
                    rows={challenge9Results.calculator2.rows}
                    showInMillions={false}
                    currencyCode={modalContext.modalFormData?.baseCurrency ?? formData.baseCurrency ?? 'USD'}
                  />
                )}
                {selectedCalculatorId === 'c12-ato-opex' && challenge12_13Results?.calculator1 && (
                  <ATOOpExVisual
                    rows={challenge12_13Results.calculator1.rows}
                    showInMillions={false}
                    currencyCode={modalContext.modalFormData?.baseCurrency ?? formData.baseCurrency ?? 'USD'}
                  />
                )}
                {selectedCalculatorId === 'c14-marketing' && selectedCalculator?.rows && (
                  <MarketingBudgetVisual
                    rows={selectedCalculator.rows}
                    showInMillions={false}
                    currencyCode={modalContext.modalFormData?.baseCurrency ?? formData.baseCurrency ?? 'USD'}
                  />
                )}
                {selectedCalculatorId === 'c14-reactivation' && selectedCalculator?.rows && (
                  <ReactivationVisual
                    rows={selectedCalculator.rows}
                    showInMillions={false}
                    currencyCode={modalContext.modalFormData?.baseCurrency ?? formData.baseCurrency ?? 'USD'}
                  />
                )}
                {selectedCalculatorId === 'c14-kyc' && selectedCalculator?.rows && (
                  <KYCVisual
                    rows={selectedCalculator.rows}
                    showInMillions={false}
                    currencyCode={modalContext.modalFormData?.baseCurrency ?? formData.baseCurrency ?? 'USD'}
                  />
                )}
                {selectedCalculatorId === 'c8-returns' && selectedCalculator?.rows && (
                  <ReturnsAbuseVisual
                    rows={selectedCalculator.rows}
                    showInMillions={false}
                    currencyCode={modalContext.modalFormData?.baseCurrency ?? formData.baseCurrency ?? 'USD'}
                  />
                )}
                {selectedCalculatorId === 'c8-inr' && selectedCalculator?.rows && (
                  <INRAbuseVisual
                    rows={selectedCalculator.rows}
                    showInMillions={false}
                    currencyCode={modalContext.modalFormData?.baseCurrency ?? formData.baseCurrency ?? 'USD'}
                  />
                )}
                {(((modalContext.sourceIdForModal ?? selectedCalculatorId) === 'c10-promotions') || (selectedCalculator?.title?.toLowerCase().includes('promotion abuse'))) && selectedCalculator?.rows && (
                  <PromotionAbuseVisual
                    rows={selectedCalculator.rows}
                    showInMillions={false}
                    currencyCode={modalContext.modalFormData?.baseCurrency ?? formData.baseCurrency ?? 'USD'}
                  />
                )}
                {((modalContext.sourceIdForModal ?? selectedCalculatorId) === 'c13-clv') && selectedCalculator?.rows && (
                  <CLVChurnVisual
                    rows={selectedCalculator.rows}
                    showInMillions={false}
                    currencyCode={modalContext.modalFormData?.baseCurrency ?? formData.baseCurrency ?? 'USD'}
                  />
                )}
                {/* c1-revenue: Approval rate bar + Value Impact (same card flow as funnel) */}
                {(selectedCalculatorId === 'c1-revenue' && challenge1Results?.calculator1) && (() => {
                  // When segmentation is on, use aggregated rows/breakdown so Visual matches Total calculator (e.g. Approved transactions = Total recoverable)
                  const rows = (isSegmentationEnabled && segmentedC1AggregateRows.length > 0) ? segmentedC1AggregateRows : challenge1Results.calculator1.rows;
                  const approvalRow = rows.find((r) => r.formula === 'd');
                  const currentApproval = (approvalRow?.rawCustomerValue ?? 0) as number;
                  const forterApproval = (approvalRow?.rawForterValue ?? 0) as number;
                  const breakdownBase = challenge1Results.calculator1.deduplicationBreakdown;
                  const breakdown = (isSegmentationEnabled && isChallenge1Selected && !isChallenge245Selected && segmentedDeduplicationBreakdown)
                    ? segmentedDeduplicationBreakdown
                    : breakdownBase;
                  const currencyCode = modalContext.modalFormData?.baseCurrency ?? formData.baseCurrency ?? 'USD';
                  const fmtCur = createCurrencyFormatter(currencyCode);
                  const cardClass = "rounded-lg border bg-card p-4 text-center shadow-sm min-h-[5.5rem] flex flex-col justify-center items-center w-full";
                  const labelClass = "text-xs text-muted-foreground tracking-wide mb-0.5";
                  const valueClass = "font-semibold text-foreground";
                  const chartData = [
                    { name: 'Current', value: currentApproval, fill: '#94a3b8' },
                    { name: 'With Forter', value: forterApproval, fill: '#22c55e' },
                  ];
                  const approvedTx = breakdown?.approvedTxImprovement ?? 0;
                  const recoveredAov = breakdown?.recoveredOrderAOV ?? breakdown?.aov ?? 0;
                  const dupTx = Math.round(breakdown?.duplicateSuccessfulTx ?? 0);
                  const dupPct = breakdown?.retryRate != null && breakdown?.successRate != null
                    ? (breakdown.retryRate * breakdown.successRate) / 100
                    : 0;
                  const dedupRecoverableTx = approvedTx + dupTx;
                  const displayGmv = (isSegmentationEnabled && segmentedC1RevenueTotal != null)
                    ? segmentedC1RevenueTotal
                    : (deduplicationEnabled && breakdownBase
                      ? (challenge1Results.calculator1.deduplicatedRevenueUplift ?? challenge1Results.calculator1.revenueUplift)
                      : challenge1Results.calculator1.revenueUplift);
                  const hasRecoveredAovMultiplier = breakdown?.recoveredOrderAOV != null && breakdown?.aovMultiplier != null;
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch min-h-0">
                      {/* Left: Fraud approval rate + vertical bar chart — fills available space */}
                      <div className="flex flex-col gap-3 flex-1 min-w-0 md:border-r md:border-border/60 md:pr-6 min-h-[280px]">
                        <h4 className="text-sm font-semibold text-muted-foreground">Fraud approval rate</h4>
                        <div className="flex-1 min-h-0 flex items-center justify-center w-full">
                          <ResponsiveContainer width="100%" height="100%" minHeight={240}>
                            <BarChart data={chartData} margin={{ top: 24, right: 12, left: 12, bottom: 8 }} barCategoryGap={4} barGap={4}>
                              <ReferenceLine y={0} stroke="hsl(var(--border))" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600 }} />
                              <YAxis domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tick={{ fontSize: 11 }} width={32} />
                              <Bar dataKey="value" barSize={56} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                                {chartData.map((entry, i) => (
                                  <Cell key={i} fill={entry.fill} />
                                ))}
                                <LabelList position="top" formatter={(v: number) => `${v.toFixed(1)}%`} />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      {/* Right: Value Impact — 2×2×1 grid, equal card sizes */}
                      {breakdown && breakdown.aov != null && (
                        <div className="flex flex-col gap-3 flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-muted-foreground">Value Impact</h4>
                          <div className="grid grid-cols-2 gap-3 py-2">
                            {/* Row 1: 2 cards */}
                            <div className={cardClass}>
                              <div className={labelClass}>Total recoverable</div>
                              <div className={valueClass}>{Math.round(approvedTx).toLocaleString('en-US')} tx</div>
                            </div>
                            {deduplicationEnabled ? (
                              <div className={cardClass}>
                                <div className={cn("flex items-center justify-center gap-1", labelClass)}>
                                  Less duplicate attempts
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button type="button" className="rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring" aria-label="How duplicate attempts are calculated">
                                        <Info className="w-3.5 h-3.5 shrink-0" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs p-3">
                                      <p className="font-medium mb-1">Duplicate attempts</p>
                                      <p className="text-muted-foreground text-sm">
                                        Duplicate successful transactions = total recoverable × retry rate × success rate. We assume {breakdown.retryRate?.toFixed(1) ?? '—'}% of declined customers retry and {breakdown.successRate?.toFixed(1) ?? '—'}% of those retries succeed, so about {dupPct.toFixed(1)}% of the recoverable volume are duplicates that would have been recovered anyway.
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                <div className={valueClass}>{dupPct.toFixed(1)}%</div>
                                <div className="text-xs text-muted-foreground">({Math.abs(dupTx).toLocaleString('en-US')} tx)</div>
                              </div>
                            ) : (
                              <div className={cardClass}>
                                <div className={cn("flex items-center justify-center gap-1", labelClass)}>
                                  × Recovered AOV
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button type="button" className="rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring" aria-label="How recovered average order value is calculated">
                                        <Info className="w-3.5 h-3.5 shrink-0" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs p-3">
                                      <p className="font-medium mb-1">Recovered average order value</p>
                                      <p className="text-muted-foreground text-sm">
                                        {hasRecoveredAovMultiplier
                                          ? <>Recovered average order value = completed average order value × recovered average order value multiplier (from Forter benchmarks). Recoverable transactions are valued at this higher average order value to reflect the typically larger basket size of recovered orders.</>
                                          : <>When no multiplier is set, recovered average order value equals completed average order value. Configure the recovered average order value multiplier in Forter benchmarks to value recoverable transactions at a higher average order value.</>
                                        }
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                <div className={valueClass}>{fmtCur(recoveredAov)}</div>
                              </div>
                            )}
                            {/* Row 2: 2 cards */}
                            {deduplicationEnabled ? (
                              <>
                                <div className={cardClass}>
                                  <div className={labelClass}>Deduplicated recoverable</div>
                                  <div className={valueClass}>{Math.round(dedupRecoverableTx).toLocaleString('en-US')} tx</div>
                                </div>
                                <div className={cardClass}>
                                  <div className={cn("flex items-center justify-center gap-1", labelClass)}>
                                    × Recovered AOV
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button type="button" className="rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring" aria-label="How recovered average order value is calculated">
                                          <Info className="w-3.5 h-3.5 shrink-0" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs p-3">
                                        <p className="font-medium mb-1">Recovered average order value</p>
                                        <p className="text-muted-foreground text-sm">
                                          {hasRecoveredAovMultiplier
                                            ? <>Recovered average order value = completed average order value × recovered average order value multiplier (from Forter benchmarks). Recoverable transactions are valued at this higher average order value to reflect the typically larger basket size of recovered orders.</>
                                            : <>When no multiplier is set, recovered average order value equals completed average order value. Configure the recovered average order value multiplier in Forter benchmarks to value recoverable transactions at a higher average order value.</>
                                          }
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                  <div className={valueClass}>{fmtCur(recoveredAov)}</div>
                                </div>
                              </>
                            ) : null}
                            {/* Row 3: Recoverable GMV potential card (no divider) */}
                            <div className={cn(cardClass, "col-span-2 bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800")}>
                              <div className={labelClass}>Recoverable GMV potential</div>
                              <div className="font-bold text-lg text-green-800 dark:text-green-300">{fmtCur(displayGmv)}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
                {/* c1-chargeback / c245-chargeback: Chargeback rate (left) + Value Impact (right), bars with visible colors */}
                {((selectedCalculatorId === 'c1-chargeback' && challenge1Results?.calculator2) || (selectedCalculatorId === 'c245-chargeback' && challenge245Results?.calculator2)) && (() => {
                  const res = selectedCalculatorId === 'c1-chargeback' ? challenge1Results!.calculator2 : challenge245Results!.calculator2;
                  const rows = (selectedCalculatorId === 'c1-chargeback' && isSegmentationEnabled && segmentedC1ChargebackAggregateRows.length > 0)
                    ? segmentedC1ChargebackAggregateRows
                    : (selectedCalculatorId === 'c245-chargeback' && isSegmentationEnabled && segmentedC245ChargebackAggregateRows.length > 0)
                      ? segmentedC245ChargebackAggregateRows
                      : res.rows;
                  const rateRow = rows.find((r) => r.label?.includes('Gross Fraud Chargeback Rate') || r.formula === 'b');
                  const volumeRow = rows.find((r) => r.label?.toLowerCase().includes('fraud chargeback') && (r.formula === 'c' || r.formula?.startsWith('c =') || r.valueDriver === 'cost'));
                  const currentRate = (rateRow?.rawCustomerValue ?? 0) as number;
                  const forterRate = (rateRow?.rawForterValue ?? 0) as number;
                  const currencyCode = modalContext.modalFormData?.baseCurrency ?? formData.baseCurrency ?? 'USD';
                  const fmtCur = createCurrencyFormatter(currencyCode);
                  const reductionPct = currentRate > 0 ? Math.round(((currentRate - forterRate) / currentRate) * 100) : 0;
                  const isMore = forterRate > currentRate;
                  const chartData = [
                    { name: 'Current', value: currentRate, fill: '#94a3b8' },
                    { name: 'With Forter', value: forterRate, fill: isMore ? '#ef4444' : '#22c55e' },
                  ];
                  const yMax = Math.max(currentRate, forterRate, 0.1) * 1.4 || 1;
                  const yTicks = getEqualYAxisTicks(yMax, 5);
                  const yDomainMax = yTicks[yTicks.length - 1] ?? yMax;
                  const cardClass = "rounded-lg border bg-card p-4 flex flex-col justify-center min-h-[5rem]";
                  const parseCurToNum = (s: string | undefined): number | null => {
                    if (s == null || s === '—') return null;
                    const trimmed = String(s).replace(/\s/g, '').replace(/\*.*$/, '');
                    const neg = /^\(.*\)$/.test(trimmed);
                    const numStr = trimmed.replace(/[^\d.-]/g, '');
                    const n = parseFloat(numStr);
                    if (Number.isNaN(n)) return null;
                    return neg ? -n : n;
                  };
                  const currentVal = parseCurToNum(volumeRow?.customerInput);
                  const forterVal = parseCurToNum(volumeRow?.forterOutcome);
                  const displayCurrent = currentVal != null ? fmtCur(Math.round(currentVal)) : '—';
                  const displayForter = forterVal != null ? fmtCur(Math.round(forterVal)) : (volumeRow?.forterOutcome === '$0.00*' ? fmtCur(0) : (volumeRow?.forterOutcome ?? '—'));
                  const costReductionToShow = (selectedCalculatorId === 'c1-chargeback' && isSegmentationEnabled && segmentedC1ChargebackTotal !== null)
                    ? segmentedC1ChargebackTotal
                    : (selectedCalculatorId === 'c245-chargeback' && isSegmentationEnabled && segmentedC245ChargebackTotal !== null)
                      ? segmentedC245ChargebackTotal
                      : res.costReduction;
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch min-h-0">
                      {/* Left: Fraud chargeback rate chart with visible colored bars */}
                      <div className="flex flex-col gap-3 flex-1 min-w-0 md:border-r md:border-border/60 md:pr-6 min-h-[240px]">
                        <h4 className="text-sm font-semibold text-muted-foreground">Fraud chargeback rate</h4>
                        <div className="flex-1 min-h-0 flex items-center justify-center w-full">
                          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                            <BarChart data={chartData} margin={{ top: 24, right: 12, left: 12, bottom: 8 }} barCategoryGap={4} barGap={4}>
                              <ReferenceLine y={0} stroke="hsl(var(--border))" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600 }} />
                              <YAxis domain={[0, yDomainMax]} ticks={yTicks} tick={{ fontSize: 11 }} tickFormatter={(v) => `${Number(v).toFixed(2)}%`} width={40} />
                              <Bar dataKey="value" barSize={56} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                                {chartData.map((entry, i) => (
                                  <Cell key={i} fill={entry.fill} />
                                ))}
                                <LabelList position="top" formatter={(v: number) => `${Number(v).toFixed(2)}%`} />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex justify-center">
                          <Badge className={isMore ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"}>
                            {isMore ? `${Math.abs(reductionPct)}% more chargebacks` : `${reductionPct}% fewer chargebacks`}
                          </Badge>
                        </div>
                      </div>
                      {/* Right: Value Impact */}
                      <div className="flex flex-col gap-3 flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-muted-foreground">Value Impact</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-2">
                          <Card className={cardClass}>
                            <div className="text-xs text-muted-foreground mb-1">Current fraud chargeback value</div>
                            <div className="font-semibold">{displayCurrent}</div>
                          </Card>
                          <Card className={cardClass}>
                            <div className="text-xs text-muted-foreground mb-1">Forter outcome fraud chargeback value</div>
                            <div className="font-semibold">{displayForter}</div>
                          </Card>
                          <Card className={cn(cardClass, "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800")}>
                            <div className="text-xs text-muted-foreground mb-1">SG&A cost reduction</div>
                            <div className="font-bold text-green-800 dark:text-green-300">{fmtCur(Math.round(costReductionToShow))}</div>
                          </Card>
                        </div>
                        {fraudCBCoverageEnabled && (
                          <p className="text-xs text-muted-foreground mt-1">
                            When Fraud Chargeback Coverage is included, Forter assumes liability for fraud chargebacks, so the Forter outcome fraud chargeback value is $0.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}
                {/* c3-review: Two cards Current / With Forter + badge */}
                {selectedCalculatorId === 'c3-review' && challenge3Results?.calculator1 && (
                  <ManualReviewVisual
                    rows={challenge3Results.calculator1.rows}
                    showInMillions={false}
                    currencyCode={modalContext.modalFormData?.baseCurrency ?? formData.baseCurrency ?? 'USD'}
                  />
                )}
                {/* c7-opex: Improve recovery efficiency — two cards Current / With Forter */}
                {selectedCalculatorId === 'c7-opex' && challenge7Results?.calculator2 && (
                  <DisputeOpExVisual
                    rows={challenge7Results.calculator2.rows}
                    showInMillions={false}
                    currencyCode={modalContext.modalFormData?.baseCurrency ?? formData.baseCurrency ?? 'USD'}
                  />
                )}
                {/* c7-disputes: Recovery pipeline (current vs. with Forter) — stacked bars + Improvement column */}
                {(selectedCalculatorId === 'c7-disputes' && totalRecoveryMetrics && challenge7Results && c7PipelineMetrics) && (() => {
                  const pipeline = c7PipelineMetrics;
                  const currencyCode = modalContext.modalFormData?.baseCurrency ?? formData.baseCurrency ?? 'USD';
                  const fmtCur = createCurrencyFormatter(currencyCode);
                  const maxVal = Math.max(pipeline.totalCB, pipeline.custDisputed, pipeline.fortDisputed, pipeline.custWon, pipeline.fortWon, 1);
                  const toPct = (v: number) => (maxVal > 0 ? (v / maxVal) * 100 : 0);
                  const additionalRecovery = fraudCBCoverageEnabled ? (pipeline.fortWon - pipeline.custWon) : (challenge7Results.fortTotalRecoveries - pipeline.custWon);
                  const disputeRateCurrent = pipeline.totalCB > 0 ? (pipeline.custDisputed / pipeline.totalCB) * 100 : 0;
                  const disputeRateForter = pipeline.totalCB > 0 ? (pipeline.fortDisputed / pipeline.totalCB) * 100 : 0;
                  const disputeRatePts = disputeRateForter - disputeRateCurrent;
                  const winRateCurrent = pipeline.custDisputed > 0 ? (pipeline.custWon / pipeline.custDisputed) * 100 : 0;
                  const winRateForter = pipeline.fortDisputed > 0 ? (pipeline.fortWon / pipeline.fortDisputed) * 100 : 0;
                  const winRateChangePts = winRateForter - winRateCurrent;
                  const recoveryRateCurrent = pipeline.totalCB > 0 ? (pipeline.custWon / pipeline.totalCB) * 100 : 0;
                  const recoveryRateForter = pipeline.totalCB > 0 ? (pipeline.fortWon / pipeline.totalCB) * 100 : 0;
                  const recoveryRatePts = recoveryRateForter - recoveryRateCurrent;
                  return (
                    <div className="space-y-6">
                      <h4 className="text-sm font-semibold text-muted-foreground">Recovery pipeline (current vs. with Forter)</h4>
                      {fraudCBCoverageEnabled && (
                        <p className="text-xs text-muted-foreground">Service chargebacks only — fraud chargebacks excluded (Fraud Chargeback Coverage enabled).</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-block w-4 h-3 rounded bg-slate-300 dark:bg-slate-400" />
                        <span>Current</span>
                        <span className="inline-block w-4 h-3 rounded bg-green-500 dark:bg-green-600 ml-2" />
                        <span>With Forter</span>
                      </div>
                      <div className="grid grid-cols-[140px_1fr_200px] gap-x-4 gap-y-3 items-center text-sm">
                        <div className="font-medium text-muted-foreground">Stage</div>
                        <div className="font-medium text-muted-foreground" />
                        <div className="font-medium text-muted-foreground text-right">Improvement</div>
                        {/* Total Chargebacks — single grey bar */}
                        <div className="font-medium">Total Chargebacks</div>
                        <div className="flex flex-col gap-1 min-h-[28px] justify-center">
                          <div className="flex items-center gap-2 h-6">
                            <div className="flex-1 h-full rounded overflow-hidden bg-muted/50 min-w-0">
                              <div className="h-full rounded bg-slate-400 dark:bg-slate-500" style={{ width: '100%' }} />
                            </div>
                            <span className="text-xs font-medium tabular-nums shrink-0 w-20 text-right">{fmtCur(pipeline.totalCB)}</span>
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">{fmtCur(pipeline.totalCB)} Total CB exposure.</div>
                        {/* Disputed — two stacked bars: Current (grey), With Forter (green) */}
                        <div className="font-medium">Disputed</div>
                        <div className="flex flex-col gap-1 min-h-[52px] justify-center">
                          <div className="flex items-center gap-2 h-6">
                            <div className="flex-1 h-full rounded overflow-hidden bg-muted/30 min-w-0 flex">
                              <div className="h-full rounded-l bg-slate-300 dark:bg-slate-400" style={{ width: `${toPct(pipeline.custDisputed)}%`, minWidth: pipeline.custDisputed > 0 ? 6 : 0 }} />
                            </div>
                            <span className="text-xs font-medium tabular-nums shrink-0 w-20 text-right text-muted-foreground">{fmtCur(pipeline.custDisputed)}</span>
                          </div>
                          <div className="flex items-center gap-2 h-6">
                            <div className="flex-1 h-full rounded overflow-hidden bg-muted/30 min-w-0 flex">
                              <div className="h-full rounded-l bg-green-500 dark:bg-green-600" style={{ width: `${toPct(pipeline.fortDisputed)}%`, minWidth: pipeline.fortDisputed > 0 ? 6 : 0 }} />
                            </div>
                            <span className="text-xs font-medium tabular-nums shrink-0 w-20 text-right text-green-700 dark:text-green-400">{fmtCur(pipeline.fortDisputed)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 text-xs">
                            {disputeRatePts >= 0 ? '+' : ''}{disputeRatePts.toFixed(1)}% dispute rate
                          </Badge>
                        </div>
                        {/* Won — two stacked bars */}
                        <div className="font-medium">Won</div>
                        <div className="flex flex-col gap-1 min-h-[52px] justify-center">
                          <div className="flex items-center gap-2 h-6">
                            <div className="flex-1 h-full rounded overflow-hidden bg-muted/30 min-w-0 flex">
                              <div className="h-full rounded-l bg-slate-300 dark:bg-slate-400" style={{ width: `${toPct(pipeline.custWon)}%`, minWidth: pipeline.custWon > 0 ? 6 : 0 }} />
                            </div>
                            <span className="text-xs font-medium tabular-nums shrink-0 w-20 text-right text-muted-foreground">{fmtCur(pipeline.custWon)}</span>
                          </div>
                          <div className="flex items-center gap-2 h-6">
                            <div className="flex-1 h-full rounded overflow-hidden bg-muted/30 min-w-0 flex">
                              <div className="h-full rounded-l bg-green-500 dark:bg-green-600" style={{ width: `${toPct(pipeline.fortWon)}%`, minWidth: pipeline.fortWon > 0 ? 6 : 0 }} />
                            </div>
                            <span className="text-xs font-medium tabular-nums shrink-0 w-20 text-right text-green-700 dark:text-green-400">{fmtCur(pipeline.fortWon)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-xs">
                            {winRateChangePts >= 0 ? '+' : ''}{winRateChangePts.toFixed(1)}% win rate
                          </Badge>
                        </div>
                        {/* Recovered $ — two stacked bars */}
                        <div className="font-medium">Recovered $</div>
                        <div className="flex flex-col gap-1 min-h-[52px] justify-center">
                          <div className="flex items-center gap-2 h-6">
                            <div className="flex-1 h-full rounded overflow-hidden bg-muted/30 min-w-0 flex">
                              <div className="h-full rounded-l bg-slate-300 dark:bg-slate-400" style={{ width: `${toPct(pipeline.custWon)}%`, minWidth: pipeline.custWon > 0 ? 6 : 0 }} />
                            </div>
                            <span className="text-xs font-medium tabular-nums shrink-0 w-20 text-right text-muted-foreground">{fmtCur(pipeline.custWon)}</span>
                          </div>
                          <div className="flex items-center gap-2 h-6">
                            <div className="flex-1 h-full rounded overflow-hidden bg-muted/30 min-w-0 flex">
                              <div className="h-full rounded-l bg-green-500 dark:bg-green-600" style={{ width: `${toPct(pipeline.fortWon)}%`, minWidth: pipeline.fortWon > 0 ? 6 : 0 }} />
                            </div>
                            <span className="text-xs font-medium tabular-nums shrink-0 w-20 text-right text-green-700 dark:text-green-400">{fmtCur(pipeline.fortWon)}</span>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="text-xs text-green-700 dark:text-green-400">+{recoveryRatePts.toFixed(1)}%pts recovery rate.</div>
                          <div className="text-sm font-semibold text-green-800 dark:text-green-300">+{fmtCur(additionalRecovery)} additional recovery.</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {selectedCalculatorId === 'c9-cx-uplift' && selectedCalculator?.rows && (() => {
                  const rows = selectedCalculator.rows;
                  const rowA = rows.find((r) => r.formula === 'a');
                  const rowB = rows.find((r) => r.formula === 'b');
                  const rowC = rows.find((r) => r.formula === 'c');
                  const rowD = rows.find((r) => r.formula === 'd' || r.formula?.startsWith('d ='));
                  const rowE = rows.find((r) => r.formula === 'e' || r.formula?.startsWith('e ='));
                  const rowF = rows.find((r) => r.formula === 'f');
                  const rowH = rows.find((r) => r.formula === 'h');
                  const rowI = rows.find((r) => r.formula === 'i' || r.formula?.startsWith('i ='));
                  const connector = (op: string) => (
                    <div className="flex items-center self-center shrink-0" aria-hidden>
                      <div className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1 text-sm font-bold text-muted-foreground">{op}</div>
                    </div>
                  );
                  const cardClass = "w-44 min-w-[11rem] flex-shrink-0 min-h-[9rem] p-4 flex flex-col justify-between overflow-visible";
                  const cardClassWide = "min-w-[13rem] w-52 flex-shrink-0 min-h-[9rem] p-4 flex flex-col justify-between overflow-visible";
                  return (
                    <div className="space-y-6">
                      {/* Section 1 — Multiplication chain (all cards on same row; scroll horizontally if needed) */}
                      <div className="flex items-stretch gap-2 flex-nowrap overflow-x-auto min-w-0 pb-1">
                        <Card className={cn(cardClass, "border-t-4 border-slate-400")}>
                          <div className="text-xl font-bold text-slate-700 dark:text-slate-300">{rowA?.customerInput ?? '—'}</div>
                          <div className="text-xs text-muted-foreground">Current eCommerce sales</div>
                        </Card>
                        {connector('×')}
                        <Card className={cn(cardClassWide, "border-t-4 border-amber-400")}>
                          <div className="text-xl font-bold text-amber-700 dark:text-amber-300">{rowD?.forterOutcome ?? '—'}</div>
                          <div className="text-xs text-muted-foreground break-words">
                            <span className="block">Expected sales uplift</span>
                            <span className="block mt-0.5">From +{rowB?.forterOutcome ?? '—'} NPS pts via LSE benchmark ({rowC?.forterOutcome ?? '—'}/pt)</span>
                          </div>
                        </Card>
                        {connector('=')}
                        <Card className={cn(cardClass, "border-t-4 border-blue-400")}>
                          <div className="text-xl font-bold text-blue-700 dark:text-blue-300">{rowE?.forterImprovement ?? '—'}</div>
                          <div className="text-xs text-muted-foreground">Additional eCommerce sales</div>
                        </Card>
                        <div className="flex items-center self-center shrink-0" aria-hidden>
                          <ArrowRight className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <Card className={cn(cardClassWide, "border-t-4 border-green-500 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800")}>
                          <div className="text-xl font-bold text-green-700 dark:text-green-300">{rowI?.forterImprovement ?? '—'}</div>
                          <div className="text-xs text-muted-foreground break-words">
                            <span className="block">Profitability impact</span>
                            {rowF && (
                              <span className="block mt-0.5">After {rowF.customerInput ?? '—'} {rowH ? `commission × ${rowH.customerInput ?? '—'} margin` : 'margin'}</span>
                            )}
                          </div>
                        </Card>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </TabsContent>

            {/* Success Story Tab – case study slide image when available */}
            <TabsContent value="success-stories" className="mt-4">
              <div data-benefit-pdf="success-stories" className="min-h-0">
                {(() => {
                  const calcId = modalContext.sourceIdForModal ?? selectedCalculatorId ?? '';
                  const imagePath = getCaseStudyImagePath(calcId);
                  if (!imagePath) {
                    return (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No success story available for this benefit.</p>
                      </div>
                    );
                  }
                  return (
                    <div className="flex justify-center">
                      <img
                        src={imagePath}
                        alt="Success story case study"
                        className="max-w-full h-auto rounded-lg border object-contain"
                      />
                    </div>
                  );
                })()}
              </div>
            </TabsContent>

            {/* Footer: Back bottom-left, Go-forward bottom-right */}
            {(() => {
              const hasInputsConfig = modalContext.sourceIdForModal ? !!CALCULATOR_REQUIRED_INPUTS[modalContext.sourceIdForModal] : false;
              const hasCalculatorRows = selectedCalculator?.rows && selectedCalculator.rows.length > 0;
              const showCalculatorTab = !!selectedCalculatorId && (isCustomMode ? hasCalculatorRows : true);
              const showInputsTab = !!selectedCalculatorId && hasInputsConfig;
              const showForwardFromSummary = !!selectedCalculatorId && (hasInputsConfig || (isCustomMode ? hasCalculatorRows : true));
              return (
                <div className="flex justify-between items-center pt-4 mt-4 border-t">
                  <div className="flex items-center">
{(calculatorModalTab === 'inputs' || calculatorModalTab === 'calculator' || calculatorModalTab === 'funnel' || calculatorModalTab === 'visual' || calculatorModalTab === 'success-stories') && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => {
                            if (calculatorModalTab === 'funnel') setCalculatorModalTab('calculator');
                            else if (calculatorModalTab === 'visual') setCalculatorModalTab('calculator');
                            else if (calculatorModalTab === 'calculator') setCalculatorModalTab(showInputsTab ? 'inputs' : 'summary');
                            else if (calculatorModalTab === 'inputs') setCalculatorModalTab('summary');
                            else if (calculatorModalTab === 'success-stories') setCalculatorModalTab(selectedCalculatorId === 'c245-revenue' && (funnelToShow?.length ?? 0) > 0 ? 'funnel' : (selectedCalculatorId === 'c1-revenue' || selectedCalculatorId === 'c1-chargeback' || selectedCalculatorId === 'c245-chargeback' || selectedCalculatorId === 'c3-review' || selectedCalculatorId === 'c7-disputes' || selectedCalculatorId === 'c7-opex' || selectedCalculatorId === 'c8-returns' || selectedCalculatorId === 'c8-inr' || selectedCalculatorId === 'c9-cs-opex' || selectedCalculatorId === 'c9-cx-uplift' || selectedCalculatorId === 'c10-promotions' || selectedCalculatorId === 'c12-ato-opex' || selectedCalculatorId === 'c13-clv' || selectedCalculatorId === 'c14-marketing' || selectedCalculatorId === 'c14-reactivation' || selectedCalculatorId === 'c14-kyc') ? 'visual' : 'calculator');
                          }}
                        >
                          <ChevronLeft className="w-4 h-4" /> Back
                        </Button>
                      )}
                  </div>
                  <div className="flex items-center gap-2">
                    {calculatorModalTab === 'summary' && showForwardFromSummary && (
                      <Button size="sm" className="gap-2" onClick={() => setCalculatorModalTab(hasInputsConfig ? 'inputs' : 'calculator')}>
                        {hasInputsConfig ? 'Go to inputs' : 'Go to Calculator'} <ArrowRight className="w-4 h-4" />
                      </Button>
                    )}
                    {calculatorModalTab === 'inputs' && showCalculatorTab && (
                      <Button size="sm" className="gap-2" onClick={() => setCalculatorModalTab('calculator')}>
                        Go to Calculator <ArrowRight className="w-4 h-4" />
                      </Button>
                    )}
                    {calculatorModalTab === 'calculator' && selectedCalculatorId === 'c245-revenue' && (funnelToShow?.length ?? 0) > 0 && (
                      <Button size="sm" className="gap-2" onClick={() => setCalculatorModalTab('funnel')}>
                        Go to Visual <ArrowRight className="w-4 h-4" />
                      </Button>
                    )}
                    {(calculatorModalTab === 'calculator' && (selectedCalculatorId === 'c1-revenue' || selectedCalculatorId === 'c1-chargeback' || selectedCalculatorId === 'c245-chargeback' || selectedCalculatorId === 'c3-review' || selectedCalculatorId === 'c7-disputes' || selectedCalculatorId === 'c7-opex' || selectedCalculatorId === 'c8-returns' || selectedCalculatorId === 'c8-inr' || selectedCalculatorId === 'c9-cs-opex' || selectedCalculatorId === 'c9-cx-uplift' || selectedCalculatorId === 'c10-promotions' || selectedCalculatorId === 'c12-ato-opex' || selectedCalculatorId === 'c13-clv' || selectedCalculatorId === 'c14-marketing' || selectedCalculatorId === 'c14-reactivation' || selectedCalculatorId === 'c14-kyc')) && (
                      <Button size="sm" className="gap-2" onClick={() => setCalculatorModalTab('visual')}>
                        Go to Visual <ArrowRight className="w-4 h-4" />
                      </Button>
                    )}
                    {calculatorModalTab === 'funnel' && hasCaseStudy(modalContext.sourceIdForModal ?? selectedCalculatorId ?? '') && (
                      <Button size="sm" className="gap-2" onClick={() => setCalculatorModalTab('success-stories')}>
                        Go to Success Story <ArrowRight className="w-4 h-4" />
                      </Button>
                    )}
                    {calculatorModalTab === 'visual' && hasCaseStudy(modalContext.sourceIdForModal ?? selectedCalculatorId ?? '') && (
                      <Button size="sm" className="gap-2" onClick={() => setCalculatorModalTab('success-stories')}>
                        Go to Success Story <ArrowRight className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })()}
          </Tabs>
        </DialogContent>
      </Dialog>


      {/* Custom Calculation Dialog */}
      <Dialog open={showCustomCalcDialog} onOpenChange={setShowCustomCalcDialog}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {editingCustomCalcId ? 'Edit Custom Calculation' : 'Add Custom Calculation'}
            </DialogTitle>
            <DialogDescription>
              {editingCustomCalcId 
                ? 'Update your custom value driver details.' 
                : 'Add a custom value driver to your assessment. Custom items will be clearly marked.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <Label htmlFor="custom-name">Benefit Name</Label>
              <Input
                id="custom-name"
                value={customCalcName}
                onChange={(e) => setCustomCalcName(e.target.value)}
                placeholder="e.g., Operational savings from automation"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-category">Benefit Category</Label>
              <Select
                value={customCalcCategory}
                onValueChange={(v) => setCustomCalcCategory(v as 'gmv_uplift' | 'cost_reduction' | 'risk_mitigation')}
              >
                <SelectTrigger id="custom-category" className="bg-background">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="gmv_uplift">GMV Uplift</SelectItem>
                  <SelectItem value="cost_reduction">Cost Reduction</SelectItem>
                  <SelectItem value="risk_mitigation">Risk Mitigation</SelectItem>
                </SelectContent>
              </Select>
              {customCalcCategory === 'gmv_uplift' && (
                <div className="space-y-3 p-3 bg-muted/30 rounded-lg border mt-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    GMV uplift requires margin data for EBITDA calculation
                  </p>
                  
                  {/* Commission field - only for marketplaces */}
                  {formData.isMarketplace && (
                    <div className="space-y-1">
                      <Label htmlFor="custom-commission" className="text-xs font-medium">
                        Commission / Take Rate (%) <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="custom-commission"
                        type="number"
                        min="0"
                        max="100"
                        value={formData.commissionRate ?? ''}
                        onChange={(e) => onFormDataChange?.('commissionRate', parseFloat(e.target.value) || 0)}
                        placeholder="e.g., 15"
                        className="h-8 text-sm"
                      />
                      <p className="text-xs text-muted-foreground">Your marketplace commission rate</p>
                    </div>
                  )}
                  
                  {/* Gross Margin field - always shown for GMV uplift */}
                  <div className="space-y-1">
                    <Label htmlFor="custom-margin" className="text-xs font-medium">
                      Gross Margin (%) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="custom-margin"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.amerGrossMarginPercent ?? ''}
                      onChange={(e) => onFormDataChange?.('amerGrossMarginPercent', parseFloat(e.target.value) || 0)}
                      placeholder="e.g., 50"
                      className="h-8 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      {formData.isMarketplace 
                        ? "Applied to commission revenue for EBITDA"
                        : "Applied to GMV for EBITDA contribution"
                      }
                    </p>
                  </div>
                  
                  {/* Show calculated EBITDA preview if we have values */}
                  {customCalcValue && formData.amerGrossMarginPercent && (
                    <div className="pt-2 border-t">
                      <p className="text-xs font-medium text-primary">
                        Estimated EBITDA contribution: {getCurrencySymbol(formData.baseCurrency || 'USD')}
                        {(() => {
                          const gmv = parseFloat(customCalcValue.replace(/,/g, '')) || 0;
                          const margin = (formData.amerGrossMarginPercent || 0) / 100;
                          const commission = formData.isMarketplace ? (formData.commissionRate || 0) / 100 : 1;
                          const ebitda = gmv * commission * margin;
                          return ebitda.toLocaleString(undefined, { maximumFractionDigits: 0 });
                        })()}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-value">
                {customCalcCategory === 'gmv_uplift' ? 'GMV Uplift Value' : 'Benefit Value'} ({getCurrencySymbol(formData.baseCurrency || 'USD')})
              </Label>
              <Input
                id="custom-value"
                value={customCalcValue}
                onChange={(e) => {
                  // Allow only numbers and commas
                  const cleaned = e.target.value.replace(/[^0-9,]/g, '');
                  setCustomCalcValue(cleaned);
                }}
                placeholder="e.g., 500,000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-source-url" className={isCustomMode ? "font-medium" : ""}>
                Calculator Link {isCustomMode ? <span className="text-destructive">*</span> : "(optional)"}
              </Label>
              <Input
                id="custom-source-url"
                value={customCalcSourceUrl}
                onChange={(e) => setCustomCalcSourceUrl(e.target.value)}
                placeholder="e.g., https://docs.google.com/spreadsheets/d/..."
                type="url"
              />
              {isCustomMode && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-muted-foreground">Or</span>
                  <div className="relative">
                    <Button variant="outline" size="sm" className="gap-2 text-xs">
                      <FileText className="w-3 h-3" />
                      {customCalcFileName ? customCalcFileName : "Upload Calculator File"}
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv,.gsheet"
                        onChange={handleCalculatorFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </Button>
                  </div>
                  {customCalcFileName && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => { setCustomCalcUploadedFile(null); setCustomCalcFileName(null); }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {isCustomMode 
                  ? "Required: Link to your Google Sheets, Excel file, or upload a calculator file."
                  : "Add a link to your Google Sheets or external calculator for reference."
                }
              </p>
              {isCustomMode && !customCalcSourceUrl.trim() && !customCalcUploadedFile && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  A calculator link or file is required in Custom pathway
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setShowCustomCalcDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveCustomCalculation}
              disabled={
                !customCalcName.trim() || 
                !customCalcValue || 
                (isCustomMode && !customCalcSourceUrl.trim() && !customCalcUploadedFile) ||
                (customCalcCategory === 'gmv_uplift' && !formData.amerGrossMarginPercent) ||
                (customCalcCategory === 'gmv_uplift' && formData.isMarketplace && !formData.commissionRate)
              }
            >
              {editingCustomCalcId ? 'Save Changes' : 'Add Custom Calculation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Margin Prompt Dialog */}
      <MarginPromptDialog
        open={showMarginPrompt}
        onOpenChange={setShowMarginPrompt}
        grossMarginPercent={formData.amerGrossMarginPercent}
        isMarketplace={formData.isMarketplace}
        commissionRate={formData.commissionRate}
        onSave={handleMarginPromptSave}
        onSkip={handleMarginPromptSkip}
      />
    </>
  );
};
