import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Presentation, FileText, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useGoogleLogin } from "@react-oauth/google";
import { CalculatorData } from "@/pages/Index";
import { ValueTotals } from "@/components/calculator/ValueSummaryOptionA";
import { InvestmentInputs, calculateROI, calculateInvestmentCosts } from "@/lib/roiCalculations";
import { StrategicObjectiveId } from "@/lib/useCaseMapping";
import type { CalculatorRow } from "@/lib/calculations";
import { getValueDeckPayload, getExecutiveSummaryPayload, getCalculatorSubsetPayload } from "@/lib/reportGeneration";
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
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const pendingDocTypeRef = useRef<"slides" | "docs" | null>(null);
  const pendingSubsetRef = useRef<CalculatorSubsetForReport | null>(null);

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
          typeof caseStudySourcePresentationId === "string" && caseStudySourcePresentationId.trim()
            ? { caseStudySourcePresentationId: caseStudySourcePresentationId.trim() }
            : undefined
        ),
        ...(customerLogoUrl ? { customerLogoUrl } : {}),
      };
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
    const options = {
      hasInvestment,
      selectedObjectives,
      ...(typeof caseStudySourcePresentationId === "string" &&
        caseStudySourcePresentationId.trim() && { caseStudySourcePresentationId: caseStudySourcePresentationId.trim() }),
    };

    let reportData: Record<string, unknown>;
    if (docType === "slides") {
      reportData = {
        ...getValueDeckPayload(formData, valueTotals, selectedChallenges, roiResults, options),
        ...(customerLogoUrl ? { customerLogoUrl } : {}),
      };
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
        console.log("ERROR: Missing docType or token after OAuth");
        return;
      }

      setGenerating(true);
      try {
        const url = await createAndGetUrl(token, docType);
        setReportUrl(url);
        if (docType === "docs") onExecutiveSummaryGenerated?.(url);
        else onValueDeckGenerated?.(url);
        toast.success("Report created! Click the link below to open it.");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("Report generation failed:", msg);
        toast.error(msg.length > 400 ? `Failed: ${msg.slice(0, 397)}…` : msg);
      } finally {
        setGenerating(false);
      }
    },
    onError: (err) => {
      pendingDocTypeRef.current = null;
      pendingSubsetRef.current = null;
      setGenerating(false);
      console.log("ERROR: OAuth failed or cancelled - " + (err?.message ?? String(err)));
      toast.error("Google sign-in was cancelled or failed. Please try again.");
    },
  });

  const handleOpenSlides = () => {
    setReportUrl(null);
    pendingDocTypeRef.current = "slides";
    if (calculatorSubset) pendingSubsetRef.current = calculatorSubset;
    login();
  };

  const handleOpenDocs = () => {
    setReportUrl(null);
    pendingDocTypeRef.current = "docs";
    login();
  };

  const isSubsetMode = !!calculatorSubset;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Presentation className="w-5 h-5 text-primary" />
            {isSubsetMode ? "Generate Slides" : "Generate Value Reports"}
          </DialogTitle>
          <DialogDescription>
            {isSubsetMode
              ? "Create a Google Slides deck with this calculator and its success story, using the same templates as the full value report."
              : "Download editable reports based on the value assessment data."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isSubsetMode ? (
            <Button
              disabled={generating}
              onClick={handleOpenSlides}
              className="w-full gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Presentation className="w-4 h-4" />
                  Generate Slides
                </>
              )}
            </Button>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-2 rounded-lg border-2 border-transparent p-4 min-h-[140px] hover:border-blue-400/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors">
              <button
                type="button"
                disabled={generating}
                onClick={handleOpenDocs}
                className="flex flex-col items-start text-left w-full"
              >
                <FileText className="w-8 h-8 mb-2" style={{ color: "#4285F4" }} />
                <span className="font-semibold text-foreground">Executive 1-Page Summary</span>
                <span className="text-sm text-muted-foreground mt-1 block">Google document with top value drivers, target outcomes, and ROI.</span>
                <span className="mt-auto pt-3 text-xs font-medium rounded px-2 py-1 bg-muted text-muted-foreground">docs</span>
              </button>
              {lastExecutiveSummaryUrl && (
                <a
                  href={lastExecutiveSummaryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1 w-fit"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open last generated
                </a>
              )}
            </div>
            <div className="flex flex-col gap-2 rounded-lg border-2 border-transparent p-4 min-h-[140px] hover:border-amber-400/50 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-colors">
              <button
                type="button"
                disabled={generating}
                onClick={handleOpenSlides}
                className="flex flex-col items-start text-left w-full"
              >
                <Presentation className="w-8 h-8 mb-2" style={{ color: "#F9AB00" }} />
                <span className="font-semibold text-foreground">Value Assessment Deck</span>
                <span className="text-sm text-muted-foreground mt-1 block">Slides with value summary, use cases, and ROI projections.</span>
                <span className="mt-auto pt-3 text-xs font-medium rounded px-2 py-1 bg-muted text-muted-foreground">slides</span>
              </button>
              {lastValueDeckUrl && (
                <a
                  href={lastValueDeckUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1 w-fit"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open last generated
                </a>
              )}
            </div>
          </div>
          )}

          {generating && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              Generating your report...
            </p>
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
            You&apos;ll be asked to sign in with Google. Your report will be created in your Google Drive.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Shown when Google OAuth is not configured (no client ID). No hook used. */
function GenerateReportModalNotConfigured({
  open,
  onOpenChange,
}: Pick<GenerateReportModalProps, "open" | "onOpenChange">) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Presentation className="w-5 h-5 text-primary" />
            Generate Value Reports
          </DialogTitle>
          <DialogDescription>
            Google export is not configured. Set <code className="text-xs bg-muted px-1 rounded">VITE_GOOGLE_CLIENT_ID</code> in your environment to enable Google Slides and Google Docs export.
          </DialogDescription>
        </DialogHeader>
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
    />
  );
}
