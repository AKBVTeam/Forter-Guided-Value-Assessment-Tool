/**
 * Captures benefit visual tab content via html2canvas and attaches base64 PNG to appendix slides.
 * Uses React 18 createRoot to mount visual components off-screen, no React hooks in this module.
 */
import { createRoot } from "react-dom/client";
import React from "react";
import type { CalculatorRow } from "@/lib/calculations";
import type { ValueDeckPayload } from "@/lib/reportGeneration";
import { getCalculatorRowsForCalculatorId, getCalculatorTablesForVisual, getChallenge245ResultForCapture, CALCULATOR_ID_TO_LABEL } from "@/lib/reportGeneration";
import type { CalculatorData } from "@/pages/Index";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  ManualReviewVisual,
  DisputeOpExVisual,
  ReturnsAbuseVisual,
  CSOpExVisual,
  PromotionAbuseVisual,
  ATOOpExVisual,
  CLVChurnVisual,
  MarketingBudgetVisual,
  ReactivationVisual,
  KYCVisual,
  INRAbuseVisual,
  ChargebackVisual,
  InstantRefundsCXVisual,
  PaymentFunnelSummaryVisual,
  PaymentFunnelFullVisual,
} from "@/components/calculator/ValueSummaryOptionA";

type VisualProps = { rows: CalculatorRow[]; currencyCode: string; showInMillions: boolean; forReportCapture?: boolean };
type VisualComponent = React.FC<VisualProps>;

/** Calculator IDs that have a dedicated visual component (rows + currencyCode only).
 * c1-revenue and c7-disputes are rendered inline in the modal (no standalone component), so they are not in this map. */
export const CALCULATOR_VISUAL_COMPONENTS: Record<string, VisualComponent> = {
  "c1-chargeback": ChargebackVisual,
  "c245-revenue": PaymentFunnelSummaryVisual,
  "c245-chargeback": ChargebackVisual,
  "c3-review": ManualReviewVisual,
  "c7-opex": DisputeOpExVisual,
  "c8-returns": ReturnsAbuseVisual,
  "c8-inr": INRAbuseVisual,
  "c9-cx-uplift": InstantRefundsCXVisual,
  "c9-cs-opex": CSOpExVisual,
  "c10-promotions": PromotionAbuseVisual,
  "c12-ato-opex": ATOOpExVisual,
  "c13-clv": CLVChurnVisual,
  "c14-marketing": MarketingBudgetVisual,
  "c14-reactivation": ReactivationVisual,
  "c14-kyc": KYCVisual,
};

/** Resolve appendix slide title to a calculator ID by matching CALCULATOR_ID_TO_LABEL (fallback when slide has no calculatorId). */
function findCalculatorIdByTitle(title: string): string | null {
  const raw = (title || "").trim();
  if (!raw) return null;
  const toTry = [raw, raw.split(" - ")[0].trim()].filter(Boolean);
  for (const t of toTry) {
    const appLower = t.toLowerCase();
    for (const [calcId, { label }] of Object.entries(CALCULATOR_ID_TO_LABEL)) {
      const labLower = (label || "").toLowerCase();
      if (labLower.includes(appLower) || appLower.includes(labLower)) return calcId;
    }
  }
  return null;
}

/**
 * Capture visual tab screenshots for each non-TBD appendix slide that has a mapped visual.
 * Mutates and returns the same appendixSlides array with visualImageBase64 set where captured.
 */
export async function captureVisualImages(
  appendixSlides: ValueDeckPayload["appendixSlides"],
  formData: CalculatorData
): Promise<ValueDeckPayload["appendixSlides"]> {
  const currencyCode = formData.baseCurrency ?? "USD";
  const showInMillions = false;

  for (let i = 0; i < appendixSlides.length; i++) {
    const app = appendixSlides[i];
    if (app.isTBD) continue;

    const calculatorId = (app as { calculatorId?: string }).calculatorId ?? findCalculatorIdByTitle(app.title);
    if (!calculatorId) continue;

    const VisualComponent = CALCULATOR_VISUAL_COMPONENTS[calculatorId];
    if (!VisualComponent) continue;

    // c8-returns and c8-inr need tables from getCalculatorTablesForVisual (tables[0]=returns, tables[1]=INR)
    let rows: CalculatorRow[];
    if (calculatorId === "c8-returns") {
      const tables = getCalculatorTablesForVisual(calculatorId, formData);
      rows = tables[0]?.rows ?? [];
    } else if (calculatorId === "c8-inr") {
      const tables = getCalculatorTablesForVisual(calculatorId, formData);
      rows = tables[1]?.rows ?? [];
    } else {
      const fromId = getCalculatorRowsForCalculatorId(calculatorId, formData);
      rows = fromId ?? [];
    }
    if (!rows?.length) {
      console.warn(`[captureVisualImages] No rows for ${calculatorId} — skipping visual`);
      continue;
    }

    if (calculatorId === "c8-returns" || calculatorId === "c8-inr") {
      console.log(`[captureVisualImages] ${calculatorId} rows:`, rows.map((r) => ({ formula: r.formula, label: r.label?.slice(0, 40) })));
    }

    const CONTAINER_WIDTH = 1400;
    // Slightly shorter aspect to match slide image area (title + image, no overlap)
    const TARGET_ASPECT = 5.95 / 13.13;
    const TARGET_HEIGHT = Math.round(CONTAINER_WIDTH * TARGET_ASPECT);

    const container = document.createElement("div");
    container.style.cssText = `
      position: absolute;
      left: -9999px;
      top: 0;
      width: ${CONTAINER_WIDTH}px;
      height: ${TARGET_HEIGHT}px;
      min-height: ${TARGET_HEIGHT}px;
      background: #F5F7FA;
      overflow: hidden;
      padding: 28px 36px;
      box-sizing: border-box;
      font-family: ui-sans-serif, system-ui, sans-serif;
      display: flex;
      flex-direction: column;
    `;
    document.body.appendChild(container);
    let root: ReturnType<typeof createRoot> | null = null;

    try {
      const isC245Revenue = calculatorId === "c245-revenue";
      const c245Result = isC245Revenue ? getChallenge245ResultForCapture(formData) : null;
      const funnelBreakdown = c245Result?.calculator1?.funnelBreakdown ?? null;
      const dedupBreakdown = c245Result?.calculator1?.deduplicationBreakdown ?? null;
      const totalAttempts = formData.amerGrossAttempts ?? 0;

      root = createRoot(container);
      const visualElement =
        isC245Revenue && funnelBreakdown?.length
          ? React.createElement(PaymentFunnelFullVisual, {
              rows,
              currencyCode,
              funnelBreakdown,
              totalTransactionAttempts: totalAttempts,
              deduplicationBreakdown: dedupBreakdown ?? undefined,
              deduplicationEnabled: Boolean((formData as Record<string, unknown>).deduplicationEnabled),
            })
        : React.createElement(VisualComponent, {
            rows,
            currencyCode,
            showInMillions,
            forReportCapture: true,
          });
      const wrapper = React.createElement("div", {
        style: { width: "100%", height: "100%", display: "flex", flexDirection: "column" },
      }, visualElement);
      root.render(React.createElement(TooltipProvider, null, wrapper));

      // Wait for Recharts/SVG to paint before capture. Chart-heavy visuals need longer.
      const waitMs =
        calculatorId === "c8-returns" || calculatorId === "c8-inr"
          ? 1600
          : calculatorId === "c12-ato-opex"
            ? 1200
            : calculatorId === "c13-clv"
              ? 1100
              : calculatorId === "c14-marketing"
                ? 1100
                : calculatorId === "c245-revenue"
                  ? 1100
                  : 900;
      await new Promise((r) => setTimeout(r, waitMs));

      // Let the browser complete a paint cycle so SVG/charts are in the DOM for html2canvas
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#F5F7FA",
        width: CONTAINER_WIDTH,
        height: TARGET_HEIGHT,
        windowWidth: CONTAINER_WIDTH,
        windowHeight: TARGET_HEIGHT,
      });

      if (canvas.height > 50 && canvas.width > 50) {
        const dataUrl = canvas.toDataURL("image/png");
        const base64 = dataUrl.split(",")[1] ?? "";
        if (base64) (app as { visualImageBase64?: string }).visualImageBase64 = base64;
      }
    } catch (err) {
      console.warn("[captureVisualImages] Failed for", calculatorId, app.title, err);
    } finally {
      if (root) {
        try {
          root.unmount();
        } catch (_) {}
      }
      container.remove();
    }
  }

  return appendixSlides;
}
