import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Presentation, FileText, Loader2, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { useGoogleLogin } from "@react-oauth/google";
import { CalculatorData } from "@/pages/Index";
import { ValueTotals } from "@/components/calculator/ValueSummaryOptionA";
import { InvestmentInputs, calculateROI, calculateInvestmentCosts } from "@/lib/roiCalculations";
import { StrategicObjectiveId } from "@/lib/useCaseMapping";
import type { CalculatorRow } from "@/lib/calculations";
import { getValueDeckPayload, getExecutiveSummaryPayload, getCalculatorSubsetPayload, generateValueDeckPptx, generateExecutiveSummaryDocx, generateCalculatorSubsetPptx, type ValueDeckPayload, type FunnelSlideData } from "@/lib/reportGeneration";
import { captureVisualImages } from "@/lib/captureVisualImages";
import {
  googleReportFileName,
  googleReportExecutiveSummaryFileName,
  googleReportCalculatorSubsetFileName,
  driveCreateFile,
  buildGoogleDoc,
  buildGoogleSlides,
} from "@/lib/googleReportApi";

/** When set, modal generates a calculator-subset deck (title + calculator slide(s) + success story) instead of full report. */
export interface CalculatorSubsetForReport {
  calculatorId: string;
  calculatorTitle: string;
  rows: CalculatorRow[];
  segmentData?: Array<{ name: string; rows: CalculatorRow[] }>;
  totalRows?: CalculatorRow[];
  /** Payment funnel slide data (c245-revenue). When set, one extra slide is added after the first appendix entry. */
  funnelSlide?: FunnelSlideData;
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
  /** When set, show "Generate Slides" for this calculator only (subset deck). */
  calculatorSubset?: CalculatorSubsetForReport | null;
  /** Last generated Executive 1-Page Summary URL (so user can open it from the modal without regenerating). */
  lastExecutiveSummaryUrl?: string | null;
  /** Last generated Value Assessment Deck URL. */
  lastValueDeckUrl?: string | null;
  /** Called when a new Executive Summary is generated; parent should save the URL. */
  onExecutiveSummaryGenerated?: (url: string) => void;
  /** Called when a new Value Assessment Deck is generated; parent should save the URL. */
  onValueDeckGenerated?: (url: string) => void;
}

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/presentations",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive.file",
].join(" ");

/** Only rendered when GoogleOAuthProvider is present (clientId set). Uses useGoogleLogin. */
function GenerateReportModalWithGoogle({
  open,
  onOpenChange,
  formData,
  valueTotals,
  selectedChallenges,
  investmentInputs,
  selectedObjectives,
  customerLogoUrl,
  onReportGenerated,
  calculatorSubset,
  lastExecutiveSummaryUrl = null,
  lastValueDeckUrl = null,
  onExecutiveSummaryGenerated,
  onValueDeckGenerated,
}: GenerateReportModalProps) {
  const [generating, setGenerating] = useState(false);
  const [generatingDocType, setGeneratingDocType] = useState<"slides" | "docs" | null>(null);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [downloadingOffice, setDownloadingOffice] = useState<"pptx" | "docx" | null>(null);
  const pendingDocTypeRef = useRef<"slides" | "docs" | null>(null);
  const pendingSubsetRef = useRef<CalculatorSubsetForReport | null>(null);
  const pendingIsSubsetRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const cancelGeneration = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setGenerating(false);
    setGeneratingDocType(null);
    setDownloadingOffice(null);
    pendingDocTypeRef.current = null;
    pendingSubsetRef.current = null;
    pendingIsSubsetRef.current = false;
    toast.info("Report generation cancelled.");
  };

  const merchantName = formData.customerName || "Customer";

  const createAndGetUrl = async (accessToken: string, docType: "slides" | "docs"): Promise<string> => {
    const subset = pendingSubsetRef.current;
    pendingSubsetRef.current = null;

    if (docType === "slides" && subset) {
      const caseStudySourcePresentationId = import.meta.env.VITE_CASE_STUDY_SOURCE_PRESENTATION_ID as string | undefined;
      const reportData = {
        ...getCalculatorSubsetPayload(
          subset.calculatorId,
          subset.calculatorTitle,
          subset.rows,
          formData,
          subset.segmentData,
          subset.totalRows,
          {
            ...(typeof caseStudySourcePresentationId === "string" && caseStudySourcePresentationId.trim()
              ? { caseStudySourcePresentationId: caseStudySourcePresentationId.trim() }
              : {}),
            ...(subset.funnelSlide && { funnelSlide: subset.funnelSlide }),
          }
        ),
        ...(customerLogoUrl ? { customerLogoUrl } : {}),
      };
      if (reportData.appendixSlides?.length) {
        reportData.appendixSlides = await captureVisualImages(reportData.appendixSlides, formData);
      }
      const fileName = googleReportCalculatorSubsetFileName(merchantName, subset.calculatorTitle);
      const file = await driveCreateFile(accessToken, fileName, "application/vnd.google-apps.presentation");
      await buildGoogleSlides(accessToken, file.id, reportData);
      onReportGenerated?.();
      return `https://docs.google.com/presentation/d/${file.id}/edit`;
    }

    const roiResults = calculateROI(formData, valueTotals, investmentInputs);
    const costs = calculateInvestmentCosts(investmentInputs, formData);
    const hasInvestment = costs.totalACV > 0 || costs.integrationCost > 0;
    const caseStudySourcePresentationId = import.meta.env.VITE_CASE_STUDY_SOURCE_PRESENTATION_ID as string | undefined;
    const analysisId = (formData as any)._analysisId ?? "default";
    const driverStatesKey = `forter_value_assessment_driver_states_${analysisId}`;
    let driverStates: Record<string, boolean | "removed"> | undefined;
    try {
      const saved = typeof localStorage !== "undefined" ? localStorage.getItem(driverStatesKey) : null;
      driverStates = saved ? (JSON.parse(saved) as Record<string, boolean | "removed">) : undefined;
    } catch {
      driverStates = undefined;
    }
    const isCustomPathway = (formData as any)._pathwayMode === "custom";
    const options = {
      hasInvestment,
      selectedObjectives,
      ...(driverStates && { driverStates }),
      ...(isCustomPathway && { isCustomPathway: true }),
      ...(typeof caseStudySourcePresentationId === "string" &&
        caseStudySourcePresentationId.trim() && { caseStudySourcePresentationId: caseStudySourcePresentationId.trim() }),
    };

    let reportData: Record<string, unknown>;
    if (docType === "slides") {
      reportData = {
        ...getValueDeckPayload(formData, valueTotals, selectedChallenges, roiResults, options),
        ...(customerLogoUrl ? { customerLogoUrl } : {}),
      };
      const slidesData = reportData as { appendixSlides?: ValueDeckPayload["appendixSlides"] };
      if (slidesData.appendixSlides?.length) {
        slidesData.appendixSlides = await captureVisualImages(slidesData.appendixSlides, formData);
      }
    } else {
      const docPayload = getExecutiveSummaryPayload(formData, valueTotals, selectedChallenges, roiResults, options);
      const deckPayload = getValueDeckPayload(formData, valueTotals, selectedChallenges, roiResults, options);
      reportData = {
        ...docPayload,
        valueDrivers: deckPayload.valueDriversSlide?.rows ?? [],
        ...(customerLogoUrl ? { customerLogoUrl } : {}),
      };
    }

    const fileName =
      docType === "docs"
        ? googleReportExecutiveSummaryFileName(merchantName)
        : googleReportFileName(merchantName);
    const mimeType =
      docType === "slides"
        ? "application/vnd.google-apps.presentation"
        : "application/vnd.google-apps.document";

    const file = await driveCreateFile(accessToken, fileName, mimeType);

    if (docType === "slides") {
      await buildGoogleSlides(accessToken, file.id, reportData);
      onReportGenerated?.();
      return `https://docs.google.com/presentation/d/${file.id}/edit`;
    } else {
      await buildGoogleDoc(accessToken, file.id, reportData);
      onReportGenerated?.();
      return `https://docs.google.com/document/d/${file.id}/edit`;
    }
  };

  const login = useGoogleLogin({
    flow: "implicit",
    ux_mode: "popup",
    scope: GOOGLE_SCOPES,
    onSuccess: async (tokenResponse) => {
      const docType = pendingDocTypeRef.current;
      pendingDocTypeRef.current = null;
      const token = tokenResponse.access_token ?? "";
      console.log("OAUTH SUCCESS", token ? `${token.substring(0, 10)}...` : "(empty)");
      console.log("Step 2: OAuth token received: " + (token ? "***" : "MISSING"));

      if (!docType || !token) {
        setGenerating(false);
        setGeneratingDocType(null);
        console.log("ERROR: Missing docType or token after OAuth");
        return;
      }

      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;
      setGeneratingDocType(docType);
      setGenerating(true);
      try {
        const url = await createAndGetUrl(token, docType);
        if (signal.aborted) return;
        setReportUrl(url);
        if (docType === "docs") {
          onExecutiveSummaryGenerated?.(url);
        } else if (!pendingIsSubsetRef.current) {
          onValueDeckGenerated?.(url);
        }
        toast.success("Report created! Click the link below to open it.");
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        const msg = e instanceof Error ? e.message : String(e);
        console.error("Report generation failed:", msg);
        toast.error(msg.length > 400 ? `Failed: ${msg.slice(0, 397)}…` : msg);
      } finally {
        pendingIsSubsetRef.current = false;
        if (!abortRef.current?.signal.aborted) {
          setGeneratingDocType(null);
          setGenerating(false);
        }
        abortRef.current = null;
      }
    },
    onError: (err) => {
      pendingDocTypeRef.current = null;
      pendingSubsetRef.current = null;
      pendingIsSubsetRef.current = false;
      setGeneratingDocType(null);
      setGenerating(false);
      console.log("ERROR: OAuth failed or cancelled - " + (err?.message ?? String(err)));
      toast.error("Google sign-in was cancelled or failed. Please try again.");
    },
  });

  const handleOpenSlides = () => {
    setReportUrl(null);
    pendingDocTypeRef.current = "slides";
    pendingIsSubsetRef.current = !!calculatorSubset;
    if (calculatorSubset) pendingSubsetRef.current = calculatorSubset;
    login();
  };

  const handleOpenDocs = () => {
    setReportUrl(null);
    pendingDocTypeRef.current = "docs";
    login();
  };

  const buildReportOptions = () => {
    const roiResults = calculateROI(formData, valueTotals, investmentInputs);
    const costs = calculateInvestmentCosts(investmentInputs, formData);
    const hasInvestment = costs.totalACV > 0 || costs.integrationCost > 0;
    const analysisId = (formData as any)._analysisId ?? "default";
    const driverStatesKey = `forter_value_assessment_driver_states_${analysisId}`;
    let driverStates: Record<string, boolean | "removed"> | undefined;
    try {
      const saved = typeof localStorage !== "undefined" ? localStorage.getItem(driverStatesKey) : null;
      driverStates = saved ? (JSON.parse(saved) as Record<string, boolean | "removed">) : undefined;
    } catch { driverStates = undefined; }
    const isCustomPathway = (formData as any)._pathwayMode === "custom";
    return { roiResults, hasInvestment, driverStates, isCustomPathway };
  };

  const handleDownloadPptx = async () => {
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    setDownloadingOffice("pptx");
    try {
      const { roiResults, hasInvestment, driverStates, isCustomPathway } = buildReportOptions();
      const opts = {
        hasInvestment,
        selectedObjectives,
        ...(driverStates && { driverStates }),
        ...(isCustomPathway && { isCustomPathway: true }),
      };
      const payload = getValueDeckPayload(formData, valueTotals, selectedChallenges, roiResults, opts);
      let appendixSlides = payload.appendixSlides;
      if (appendixSlides?.length) {
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        appendixSlides = await captureVisualImages(appendixSlides, formData);
      }
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      await generateValueDeckPptx(formData, valueTotals, selectedChallenges, roiResults, opts, appendixSlides);
      if (!signal.aborted) toast.success("PowerPoint downloaded successfully.");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      const msg = e instanceof Error ? e.message : String(e);
      console.error("PPTX generation failed:", msg);
      toast.error(msg.length > 300 ? `Failed: ${msg.slice(0, 297)}…` : `Failed: ${msg}`);
    } finally {
      if (!abortRef.current?.signal.aborted) setDownloadingOffice(null);
      abortRef.current = null;
    }
  };

  const handleDownloadDocx = async () => {
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    setDownloadingOffice("docx");
    try {
      const { roiResults, hasInvestment, driverStates, isCustomPathway } = buildReportOptions();
      const opts = {
        hasInvestment,
        selectedObjectives,
        ...(driverStates && { driverStates }),
        ...(isCustomPathway && { isCustomPathway: true }),
      };
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      await generateExecutiveSummaryDocx(formData, valueTotals, selectedChallenges, roiResults, opts);
      if (!signal.aborted) toast.success("Word document downloaded successfully.");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      const msg = e instanceof Error ? e.message : String(e);
      console.error("DOCX generation failed:", msg);
      toast.error(msg.length > 300 ? `Failed: ${msg.slice(0, 297)}…` : `Failed: ${msg}`);
    } finally {
      if (!abortRef.current?.signal.aborted) setDownloadingOffice(null);
      abortRef.current = null;
    }
  };

  const handleDownloadSubsetPptx = async () => {
    if (!calculatorSubset) return;
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    setDownloadingOffice("pptx");
    try {
      const caseStudySourcePresentationId = import.meta.env.VITE_CASE_STUDY_SOURCE_PRESENTATION_ID as string | undefined;
      const reportData = getCalculatorSubsetPayload(
        calculatorSubset.calculatorId,
        calculatorSubset.calculatorTitle,
        calculatorSubset.rows,
        formData,
        calculatorSubset.segmentData,
        calculatorSubset.totalRows,
        {
          ...(typeof caseStudySourcePresentationId === "string" && caseStudySourcePresentationId.trim()
            ? { caseStudySourcePresentationId: caseStudySourcePresentationId.trim() }
            : {}),
          ...(calculatorSubset.funnelSlide && { funnelSlide: calculatorSubset.funnelSlide }),
        }
      );
      if (reportData.appendixSlides?.length) {
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        reportData.appendixSlides = await captureVisualImages(reportData.appendixSlides, formData);
      }
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      await generateCalculatorSubsetPptx(reportData, formData);
      if (!signal.aborted) toast.success("PowerPoint downloaded successfully.");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Subset PPTX generation failed:", msg);
      toast.error(msg.length > 300 ? `Failed: ${msg.slice(0, 297)}…` : `Failed: ${msg}`);
    } finally {
      if (!abortRef.current?.signal.aborted) setDownloadingOffice(null);
      abortRef.current = null;
    }
  };

  const isSubsetMode = !!calculatorSubset;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isSubsetMode ? "sm:max-w-[500px]" : "sm:max-w-[560px]"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Presentation className="w-5 h-5 text-primary" />
            {isSubsetMode ? "Generate Slides" : "Generate Value Reports"}
          </DialogTitle>
          <DialogDescription>
            {isSubsetMode
              ? "Download slides for this calculator as a PowerPoint file."
              : "Download editable reports as Microsoft Office files."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isSubsetMode && (
            <div className="space-y-3">
              <Button
                disabled={generating || !!downloadingOffice}
                onClick={handleDownloadSubsetPptx}
                className="w-full gap-2"
              >
                {downloadingOffice === "pptx" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating PowerPoint…
                  </>
                ) : (
                  <>
                    <Presentation className="w-4 h-4" style={{ color: "#D24726" }} />
                    Download PowerPoint (.pptx)
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                disabled
                className="w-full gap-2 opacity-50"
              >
                <Presentation className="w-4 h-4" />
                Generate Google Slides
              </Button>
            </div>
          )}
          {!isSubsetMode && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Microsoft Office — Download</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-2 rounded-lg border-2 border-transparent p-4 min-h-[140px] hover:border-blue-400/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors">
                  <button
                    type="button"
                    disabled={generating || !!downloadingOffice}
                    onClick={handleDownloadDocx}
                    className="flex flex-col items-start text-left w-full"
                  >
                    <FileText className="w-8 h-8 mb-2" style={{ color: "#2B579A" }} />
                    <span className="font-semibold text-foreground">Executive Summary</span>
                    <span className="text-sm text-muted-foreground mt-1 block">Word document with top value drivers, target outcomes, and ROI.</span>
                    <span className="mt-auto pt-3 text-xs font-medium rounded px-2 py-1 bg-muted text-muted-foreground">.docx</span>
                  </button>
                </div>
                <div className="flex flex-col gap-2 rounded-lg border-2 border-transparent p-4 min-h-[140px] hover:border-orange-400/50 hover:bg-orange-50/50 dark:hover:bg-orange-950/20 transition-colors">
                  <button
                    type="button"
                    disabled={generating || !!downloadingOffice}
                    onClick={handleDownloadPptx}
                    className="flex flex-col items-start text-left w-full"
                  >
                    <Presentation className="w-8 h-8 mb-2" style={{ color: "#D24726" }} />
                    <span className="font-semibold text-foreground">Value Assessment Deck</span>
                    <span className="text-sm text-muted-foreground mt-1 block">PowerPoint with value summary, use cases, visuals, and ROI.</span>
                    <span className="mt-auto pt-3 text-xs font-medium rounded px-2 py-1 bg-muted text-muted-foreground">.pptx</span>
                  </button>
                </div>
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-4 opacity-50">Google Workspace</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 opacity-50 pointer-events-none select-none">
                <div className="flex flex-col gap-2 rounded-lg border-2 border-dashed border-muted p-4 min-h-[140px]">
                  <div className="flex flex-col items-start text-left w-full">
                    <FileText className="w-8 h-8 mb-2 text-muted-foreground" />
                    <span className="font-semibold text-muted-foreground">Executive 1-Page Summary</span>
                    <span className="text-sm text-muted-foreground mt-1 block">Google Docs</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 rounded-lg border-2 border-dashed border-muted p-4 min-h-[140px]">
                  <div className="flex flex-col items-start text-left w-full">
                    <Presentation className="w-8 h-8 mb-2 text-muted-foreground" />
                    <span className="font-semibold text-muted-foreground">Value Assessment Deck</span>
                    <span className="text-sm text-muted-foreground mt-1 block">Google Slides</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {downloadingOffice && (
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                {downloadingOffice === "pptx"
                  ? "Generating PowerPoint with visual captures — this may take a minute…"
                  : "Generating Word document…"}
              </p>
              <Button variant="outline" size="sm" onClick={cancelGeneration} className="shrink-0">
                <X className="w-3.5 h-3.5 mr-1" />
                Cancel
              </Button>
            </div>
          )}

          {generating && (
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                {generatingDocType === "slides"
                  ? "Generating your report, this may take a few minutes to prepare"
                  : "Generating your report..."}
              </p>
              <Button variant="outline" size="sm" onClick={cancelGeneration} className="shrink-0">
                <X className="w-3.5 h-3.5 mr-1" />
                Cancel
              </Button>
            </div>
          )}

          {reportUrl && !generating && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-medium flex items-center gap-2 text-green-600 dark:text-green-500">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Report created successfully
              </p>
              <Button
                asChild
                className="w-full gap-2"
              >
                <a
                  href={reportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4" />
                  Click here to open your report
                </a>
              </Button>
              <p className="text-xs text-muted-foreground break-all font-mono">
                {reportUrl}
              </p>
            </div>
          )}

          <p className="text-xs text-muted-foreground border-t pt-3">
            Microsoft Office reports download directly to your device.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Shown when Google OAuth is not configured (no client ID). Still offers Microsoft Office downloads. */
function GenerateReportModalNotConfigured({
  open,
  onOpenChange,
  formData,
  valueTotals,
  selectedChallenges,
  investmentInputs,
  selectedObjectives,
}: Pick<GenerateReportModalProps, "open" | "onOpenChange" | "formData" | "valueTotals" | "selectedChallenges" | "investmentInputs" | "selectedObjectives">) {
  const [downloadingOffice, setDownloadingOffice] = useState<"pptx" | "docx" | null>(null);
  const ncAbortRef = useRef<AbortController | null>(null);

  const cancelGeneration = () => {
    ncAbortRef.current?.abort();
    ncAbortRef.current = null;
    setDownloadingOffice(null);
    toast.info("Report generation cancelled.");
  };

  const buildOpts = () => {
    const roiResults = calculateROI(formData, valueTotals, investmentInputs);
    const costs = calculateInvestmentCosts(investmentInputs, formData);
    const hasInvestment = costs.totalACV > 0 || costs.integrationCost > 0;
    const analysisId = (formData as any)._analysisId ?? "default";
    let driverStates: Record<string, boolean | "removed"> | undefined;
    try {
      const saved = typeof localStorage !== "undefined" ? localStorage.getItem(`forter_value_assessment_driver_states_${analysisId}`) : null;
      driverStates = saved ? (JSON.parse(saved) as Record<string, boolean | "removed">) : undefined;
    } catch { driverStates = undefined; }
    const isCustomPathway = (formData as any)._pathwayMode === "custom";
    return { roiResults, hasInvestment, driverStates, isCustomPathway };
  };

  const handleDownloadPptx = async () => {
    ncAbortRef.current = new AbortController();
    const signal = ncAbortRef.current.signal;
    setDownloadingOffice("pptx");
    try {
      const { roiResults, hasInvestment, driverStates, isCustomPathway } = buildOpts();
      const opts = { hasInvestment, selectedObjectives, ...(driverStates && { driverStates }), ...(isCustomPathway && { isCustomPathway: true }) };
      const payload = getValueDeckPayload(formData, valueTotals, selectedChallenges, roiResults, opts);
      let appendixSlides = payload.appendixSlides;
      if (appendixSlides?.length) {
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        appendixSlides = await captureVisualImages(appendixSlides, formData);
      }
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      await generateValueDeckPptx(formData, valueTotals, selectedChallenges, roiResults, opts, appendixSlides);
      if (!signal.aborted) toast.success("PowerPoint downloaded successfully.");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      toast.error(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      if (!ncAbortRef.current?.signal.aborted) setDownloadingOffice(null);
      ncAbortRef.current = null;
    }
  };

  const handleDownloadDocx = async () => {
    ncAbortRef.current = new AbortController();
    const signal = ncAbortRef.current.signal;
    setDownloadingOffice("docx");
    try {
      const { roiResults, hasInvestment, driverStates, isCustomPathway } = buildOpts();
      const opts = { hasInvestment, selectedObjectives, ...(driverStates && { driverStates }), ...(isCustomPathway && { isCustomPathway: true }) };
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      await generateExecutiveSummaryDocx(formData, valueTotals, selectedChallenges, roiResults, opts);
      if (!signal.aborted) toast.success("Word document downloaded successfully.");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      toast.error(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      if (!ncAbortRef.current?.signal.aborted) setDownloadingOffice(null);
      ncAbortRef.current = null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Presentation className="w-5 h-5 text-primary" />
            Generate Value Reports
          </DialogTitle>
          <DialogDescription>
            Download editable Microsoft Office reports to share with your customer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Microsoft Office</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-2 rounded-lg border-2 border-transparent p-4 min-h-[140px] hover:border-blue-400/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors">
              <button type="button" disabled={!!downloadingOffice} onClick={handleDownloadDocx} className="flex flex-col items-start text-left w-full">
                <FileText className="w-8 h-8 mb-2" style={{ color: "#2B579A" }} />
                <span className="font-semibold text-foreground">Executive Summary</span>
                <span className="text-sm text-muted-foreground mt-1 block">Word document with top value drivers, target outcomes, and ROI.</span>
                <span className="mt-auto pt-3 text-xs font-medium rounded px-2 py-1 bg-muted text-muted-foreground">.docx</span>
              </button>
            </div>
            <div className="flex flex-col gap-2 rounded-lg border-2 border-transparent p-4 min-h-[140px] hover:border-orange-400/50 hover:bg-orange-50/50 dark:hover:bg-orange-950/20 transition-colors">
              <button type="button" disabled={!!downloadingOffice} onClick={handleDownloadPptx} className="flex flex-col items-start text-left w-full">
                <Presentation className="w-8 h-8 mb-2" style={{ color: "#D24726" }} />
                <span className="font-semibold text-foreground">Value Assessment Deck</span>
                <span className="text-sm text-muted-foreground mt-1 block">PowerPoint with value summary, use cases, visuals, and ROI.</span>
                <span className="mt-auto pt-3 text-xs font-medium rounded px-2 py-1 bg-muted text-muted-foreground">.pptx</span>
              </button>
            </div>
          </div>
          {downloadingOffice && (
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                {downloadingOffice === "pptx" ? "Generating PowerPoint with visual captures — this may take a minute…" : "Generating Word document…"}
              </p>
              <Button variant="outline" size="sm" onClick={cancelGeneration} className="shrink-0">
                <X className="w-3.5 h-3.5 mr-1" />
                Cancel
              </Button>
            </div>
          )}
          <div className="pt-2 border-t">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Google Workspace</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 opacity-50 pointer-events-none select-none">
              <div className="flex flex-col gap-2 rounded-lg border-2 border-dashed border-muted p-4 min-h-[100px]">
                <FileText className="w-8 h-8 mb-2 text-muted-foreground/50" />
                <span className="font-semibold text-muted-foreground">Google Docs</span>
              </div>
              <div className="flex flex-col gap-2 rounded-lg border-2 border-dashed border-muted p-4 min-h-[100px]">
                <Presentation className="w-8 h-8 mb-2 text-muted-foreground/50" />
                <span className="font-semibold text-muted-foreground">Google Slides</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const hasGoogleClientId = () =>
  Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim());

export function GenerateReportModal(props: GenerateReportModalProps) {
  if (hasGoogleClientId()) {
    return <GenerateReportModalWithGoogle {...props} />;
  }
  return (
    <GenerateReportModalNotConfigured
      open={props.open}
      onOpenChange={props.onOpenChange}
      formData={props.formData}
      valueTotals={props.valueTotals}
      selectedChallenges={props.selectedChallenges}
      investmentInputs={props.investmentInputs}
      selectedObjectives={props.selectedObjectives}
    />
  );
}
