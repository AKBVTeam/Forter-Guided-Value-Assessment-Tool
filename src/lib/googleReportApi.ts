/**
 * Google Slides and Docs API calls from the frontend using OAuth access token.
 * Creates files in the user's Drive (root) and populates them with report data.
 * No Supabase Edge Functions — all calls go directly to Google APIs from the browser.
 * Uses Forter brand design system (1:1 with PowerPoint/DOCX formatting).
 */

import { getCaseStudySlideNumbersInOrder } from "@/lib/caseStudyMapping";

// Forter brand design system (hex without #) — align with reportGeneration.ts
const NAVY = "0D1B3E";
const BLUE = "2563EB";
const GREEN = "16A34A";
const GRAY = "6B7280";
const WHITE = "FFFFFF";
const LIGHT_BLUE = "A5C8FF"; // title slide subtitle in PPT
const LIGHT_BG = "F5F7FA"; // content slide background (match PPT)
const ALT_ROW = "F9FAFB"; // alternating table row (match PPT)
const RED = "DC2626"; // negative values (match PPT)
const BODY_GRAY = "374151"; // body text in DOCX
const FONT_HEAD = "Poppins";
const FONT_BODY = "Proxima Nova";

/** Convert hex (e.g. "0D1B3E") to RGB 0–1 for Google APIs. */
function hexToRgb(hex: string): { red: number; green: number; blue: number } {
  const n = parseInt(hex.replace(/^#/, ""), 16);
  return {
    red: ((n >> 16) & 0xff) / 255,
    green: ((n >> 8) & 0xff) / 255,
    blue: (n & 0xff) / 255,
  };
}


/** PPT uses inches; Google Slides API uses PT. 1 inch = 72 PT. */
function inchToPt(inches: number): number {
  return inches * 72;
}

// Google Slides canvas is fixed at 10" × 5.63" (cannot be changed via API). PPT is 13.33" × 7.5".
const SX = 10 / 13.33;
const SY = 5.63 / 7.5;
const FONT_SCALE = Math.min(SX, SY);

function scaledFontSize(n: number): number {
  return Math.round(n * FONT_SCALE);
}

/** Truncate text so it fits within slide text boxes (avoid spill). Match PPT behavior. */
function truncateForSlide(text: string, maxChars: number): string {
  const t = String(text ?? "").trim();
  if (t.length <= maxChars) return t;
  return t.slice(0, maxChars - 1).trim() + "…";
}

/** Format number as currency (0 decimals, with symbol). Matches reportGeneration formatCurrency. */
function formatCurrencyForSlide(value: number, currencyCode: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Create a TEXT_BOX shape request (x,y,w,h in PPT inches; scaled to Google Slides canvas). */
function createTextBoxRequest(
  objectId: string,
  pageId: string,
  x: number,
  y: number,
  w: number,
  h: number
): Record<string, unknown> {
  return {
    createShape: {
      objectId,
      shapeType: "TEXT_BOX",
      elementProperties: {
        pageObjectId: pageId,
        size: {
          width: { magnitude: inchToPt(w * SX), unit: "PT" },
          height: { magnitude: inchToPt(h * SY), unit: "PT" },
        },
        transform: {
          scaleX: 1,
          scaleY: 1,
          translateX: inchToPt(x * SX),
          translateY: inchToPt(y * SY),
          unit: "PT",
        },
      },
    },
  };
}

/** True if URL is http/https. Google Slides/Docs APIs do not accept data: or blob: URLs. */
function isPublicImageUrl(url: string): boolean {
  const u = url.trim();
  return u.startsWith("https://") || u.startsWith("http://");
}

/** Upload base64 PNG to Drive and make it publicly readable; return URL for Slides createImage. */
async function uploadBase64ImageToDrive(
  accessToken: string,
  base64: string,
  fileName: string
): Promise<{ url: string; fileId: string }> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "image/png" });

  const metadata = JSON.stringify({ name: fileName, mimeType: "image/png" });
  const form = new FormData();
  form.append("metadata", new Blob([metadata], { type: "application/json" }));
  form.append("file", blob);

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    }
  );
  if (!uploadRes.ok) throw new Error(`Drive image upload failed: ${uploadRes.status}`);
  const { id: fileId } = (await uploadRes.json()) as { id: string };

  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });

  return {
    fileId,
    url: `https://drive.google.com/uc?export=view&id=${fileId}`,
  };
}

/** Delete a Drive file (e.g. temporary visual image after presentation is built). */
async function deleteDriveFile(accessToken: string, fileId: string): Promise<void> {
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

/** Create an IMAGE request (x,y,w,h in PPT inches; scaled to Google Slides canvas). URL must be publicly accessible. */
function createImageRequest(
  objectId: string,
  pageId: string,
  x: number,
  y: number,
  w: number,
  h: number,
  url: string
): Record<string, unknown> {
  return {
    createImage: {
      objectId,
      url,
      elementProperties: {
        pageObjectId: pageId,
        size: {
          width: { magnitude: inchToPt(w * SX), unit: "PT" },
          height: { magnitude: inchToPt(h * SY), unit: "PT" },
        },
        transform: {
          scaleX: 1,
          scaleY: 1,
          translateX: inchToPt(x * SX),
          translateY: inchToPt(y * SY),
          unit: "PT",
        },
      },
    },
  };
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDateMMMDDYYYY(): string {
  const d = new Date();
  const mmm = MONTH_ABBR[d.getMonth()];
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mmm} ${dd}, ${yyyy}`;
}

export function googleReportFileName(clientName: string): string {
  return `[BV] ${clientName} x Forter - Value_Assessment (${formatDateMMMDDYYYY()})`;
}

/** File name for Executive Summary Google Doc. */
export function googleReportExecutiveSummaryFileName(merchantName: string): string {
  return `[BV] ${merchantName} x Forter - Executive Summary (${formatDateMMMDDYYYY()})`;
}

/** File name for calculator-subset Google Slides (single benefit + success story). */
export function googleReportCalculatorSubsetFileName(merchantName: string, calculatorTitle: string): string {
  const safeTitle = calculatorTitle.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, " ").trim().slice(0, 50);
  return `[BV] ${merchantName} - ${safeTitle || "Calculator"} (${formatDateMMMDDYYYY()})`;
}

/**
 * Create a new file in the user's Google Drive (root). Returns the file id.
 */
export async function driveCreateFile(
  accessToken: string,
  name: string,
  mimeType: "application/vnd.google-apps.presentation" | "application/vnd.google-apps.document"
): Promise<{ id: string }> {
  const res = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType,
      // Omit parents so the file is created in the user's Drive root
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Drive create failed: ${res.status} ${err}`);
  }
  return res.json();
}

/**
 * Populate a Google Doc with executive summary content via batchUpdate.
 */
export async function buildGoogleDoc(
  accessToken: string,
  docId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const p = payload as {
    customerName?: string;
    analysisName?: string;
    headline?: string;
    opportunityStatement?: string;
    strategicAlignment?: { objectives: Array<{ name: string; description: string }>; useCases: Array<{ name: string }> } | null;
    problemStatement?: string[] | null;
    recommendedApproach?: { solutions: string[]; outcomesTable: Array<{ metric: string; current: string; target: string; improvement?: string }> };
    investment?: Array<{ label: string; val: string }> | null;
    projectedValue?: { rows: Array<{ label: string; val: string }>; nextSteps: string[] } | null;
    valueDrivers?: Array<{ label: string; value: string }>;
    customerLogoUrl?: string;
    isCustomPathway?: boolean;
  };
  const requests: Record<string, unknown>[] = [];

  // Customer logo in header (top right). Requires public https/http URL; data/blob URLs are invalid.
  let defaultHeaderId: string | undefined;
  const customerLogoUrlForDoc =
    p.customerLogoUrl?.trim() && p.customerLogoUrl.length < 2000 && isPublicImageUrl(p.customerLogoUrl.trim())
      ? p.customerLogoUrl.trim()
      : undefined;
  if (customerLogoUrlForDoc) {
    try {
      const docRes = await fetch(`https://docs.googleapis.com/v1/documents/${docId}?fields=documentStyle`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (docRes.ok) {
        const docData = (await docRes.json()) as { documentStyle?: { defaultHeaderId?: string } };
        defaultHeaderId = docData.documentStyle?.defaultHeaderId;
      }
    } catch {
      // ignore; we will skip header logo
    }
  }

  // Page setup: top and bottom margin 0.5 inches (36 PT)
  const marginPt = 0.5 * 72; // 36 PT
  requests.push({
    updateDocumentStyle: {
      documentStyle: {
        marginTop: { magnitude: marginPt, unit: "PT" as const },
        marginBottom: { magnitude: marginPt, unit: "PT" as const },
      },
      fields: "marginTop,marginBottom",
    },
  });

  let index = 1;
  type DocStyle = "section" | "title" | "headline" | "body" | "subtitle" | "bullet" | "bodyItalicGreen" | "bodyBoldValue";
  const segments: { startIndex: number; endIndex: number; style: DocStyle; text: string }[] = [];

  const insert = (text: string, style?: DocStyle): void => {
    const s = text + "\n";
    const startIndex = index;
    requests.push({
      insertText: {
        location: { index },
        text: s,
      },
    });
    index += s.length;
    if (style && s.trim().length > 0) {
      segments.push({ startIndex, endIndex: index, style, text: s });
    }
  };

  const customerName = p.customerName ?? p.analysisName ?? "Value Assessment";
  const headline = p.headline ?? "";
  const opportunityStatement = p.opportunityStatement ?? "";

  // Doc starts with title "Unlocking $X in Annual EBITDA..." (11pt), then developed by, then HEADLINE section
  insert(headline, "headline");
  insert("Developed by:  [Champion Name], [Key Deal Players]", "subtitle");
  insert("HEADLINE", "section");
  insert(opportunityStatement, "body");

  const isCustomPathwayDoc = !!p.isCustomPathway;
  const placeholderText = `[User to add relevant text here to share with ${customerName}]`;

  if (isCustomPathwayDoc) {
    insert("STRATEGIC ALIGNMENT", "section");
    insert(placeholderText, "body");
    insert("TARGETED CAPABILITIES WITH FORTER", "section");
    insert(placeholderText, "body");
    insert("RECOMMENDED APPROACH", "section");
    insert(placeholderText, "body");
    insert("TARGET OUTCOMES", "section");
    insert(placeholderText, "body");
  } else {
    if (p.strategicAlignment?.objectives?.length) {
      insert("STRATEGIC ALIGNMENT", "section");
      insert(`This initiative directly supports ${customerName}'s key strategic priorities:`, "body");
      for (const obj of p.strategicAlignment.objectives) {
        insert(`→  ${obj.name}: ${obj.description}`, "bullet");
      }
      if (p.strategicAlignment.useCases?.length) {
        insert("TARGETED CAPABILITIES WITH FORTER", "section");
        for (const uc of p.strategicAlignment.useCases) {
          insert(`→  ${uc.name}`, "bullet");
        }
      }
    } else if (p.problemStatement?.length) {
      insert("THE PROBLEM STATEMENT", "section");
      insert("This initiative addresses the following high-priority challenges:", "body");
      for (const item of p.problemStatement) {
        insert(`→  ${item}`, "bullet");
      }
    }

    const recApproach = p.recommendedApproach ?? { solutions: [], outcomesTable: [] };
    insert("RECOMMENDED APPROACH", "section");
    (recApproach.solutions || []).forEach((s: string, i: number) => {
      insert(`${i + 1}.  ${s}`, "bullet");
    });
    insert("TARGET OUTCOMES", "section");
    const outcomesRows = recApproach.outcomesTable ?? [];
    insert("Key Metric  |  Improvement", "subtitle");
    for (const r of outcomesRows) {
      const displayVal = (r as { improvement?: string }).improvement ?? r.target;
      insert(`${r.metric}  |  ${displayVal}`, "body");
    }
  }

  if (p.investment?.length) {
    insert("REQUIRED INVESTMENT", "section");
    for (const row of p.investment) {
      insert(`${row.label}`, "body");
      insert(`${row.val}`, "bodyBoldValue");
    }
  }
  if (p.projectedValue) {
    insert("PROJECTED VALUE", "section");
    for (const row of p.projectedValue.rows ?? []) {
      insert(`${row.label}`, "body");
      insert(`${row.val}`, "bodyBoldValue");
    }
    insert("NEXT STEPS", "section");
    (p.projectedValue.nextSteps ?? []).forEach((s: string, i: number) => {
      insert(`${i + 1}.  ${s}`, "bullet");
    });
  }

  // 1:1 formatting — apply Forter styles (same as DOCX)
  const navyRgb = hexToRgb(NAVY);
  const blueRgb = hexToRgb(BLUE);
  const grayRgb = hexToRgb(GRAY);
  // Docs API uses foregroundColor.color.rgbColor (OptionalColor wrapper)
  const docColor = (rgb: { red: number; green: number; blue: number }) => ({
    color: { rgbColor: rgb },
  });
  const FONT_PT = 8;
  const TITLE_FONT_PT = 11; // Main doc title (Unlocking $X in Annual EBITDA...)
  const docStyle = (style: DocStyle): { textStyle: Record<string, unknown>; fields: string } => {
    switch (style) {
      case "section":
        return {
          textStyle: {
            bold: true,
            fontSize: { magnitude: FONT_PT, unit: "PT" },
            foregroundColor: docColor(navyRgb),
            weightedFontFamily: { fontFamily: FONT_HEAD, weight: 700 },
          },
          fields: "bold,fontSize,foregroundColor,weightedFontFamily",
        };
      case "title":
        return {
          textStyle: {
            bold: true,
            fontSize: { magnitude: FONT_PT, unit: "PT" },
            foregroundColor: docColor(blueRgb),
            weightedFontFamily: { fontFamily: FONT_HEAD, weight: 700 },
          },
          fields: "bold,fontSize,foregroundColor,weightedFontFamily",
        };
      case "headline":
        return {
          textStyle: {
            bold: true,
            fontSize: { magnitude: TITLE_FONT_PT, unit: "PT" },
            foregroundColor: docColor(navyRgb),
            weightedFontFamily: { fontFamily: FONT_HEAD, weight: 700 },
          },
          fields: "bold,fontSize,foregroundColor,weightedFontFamily",
        };
      case "subtitle":
        return {
          textStyle: {
            bold: true,
            fontSize: { magnitude: FONT_PT, unit: "PT" },
            foregroundColor: docColor(grayRgb),
            weightedFontFamily: { fontFamily: FONT_BODY },
          },
          fields: "bold,fontSize,foregroundColor,weightedFontFamily",
        };
      case "bullet":
        return {
          textStyle: {
            fontSize: { magnitude: FONT_PT, unit: "PT" },
            foregroundColor: docColor(hexToRgb(BODY_GRAY)),
            weightedFontFamily: { fontFamily: FONT_BODY },
          },
          fields: "fontSize,foregroundColor,weightedFontFamily",
        };
      case "bodyBoldValue":
        return {
          textStyle: {
            bold: true,
            fontSize: { magnitude: FONT_PT, unit: "PT" },
            foregroundColor: docColor(navyRgb),
            weightedFontFamily: { fontFamily: FONT_HEAD, weight: 700 },
          },
          fields: "bold,fontSize,foregroundColor,weightedFontFamily",
        };
      case "bodyItalicGreen":
        return {
          textStyle: {
            italic: true,
            fontSize: { magnitude: FONT_PT, unit: "PT" },
            foregroundColor: docColor(hexToRgb(GREEN)),
            weightedFontFamily: { fontFamily: FONT_BODY },
          },
          fields: "italic,fontSize,foregroundColor,weightedFontFamily",
        };
      default:
        return {
          textStyle: {
            fontSize: { magnitude: FONT_PT, unit: "PT" },
            foregroundColor: docColor(hexToRgb(BODY_GRAY)),
            weightedFontFamily: { fontFamily: FONT_BODY },
          },
          fields: "fontSize,foregroundColor,weightedFontFamily",
        };
    }
  };
  for (const seg of segments) {
    const { textStyle, fields } = docStyle(seg.style);
    requests.push({
      updateTextStyle: {
        range: { startIndex: seg.startIndex, endIndex: seg.endIndex },
        textStyle,
        fields,
      },
    });
  }

  // Section headers: navy bottom border underline (match Word doc)
  for (const seg of segments) {
    if (seg.style === "section") {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: seg.startIndex, endIndex: seg.endIndex },
          paragraphStyle: {
            borderBottom: {
              color: { color: { rgbColor: navyRgb } },
              dashStyle: "SOLID",
              padding: { magnitude: 4, unit: "PT" },
              width: { magnitude: 1, unit: "PT" },
            },
            spaceAbove: { magnitude: 16, unit: "PT" },
            spaceBelow: { magnitude: 4, unit: "PT" },
          },
          fields: "borderBottom,spaceAbove,spaceBelow",
        },
      });
    }
  }

  // Bullets/numbered: only prefix (→  or "1.  ") in blue, rest stays dark gray
  for (const seg of segments) {
    if (seg.style === "bullet") {
      const isNumbered = /^\d/.test(seg.text.trim());
      const prefixLength = isNumbered ? 4 : 3;
      const end = Math.min(seg.startIndex + prefixLength, seg.endIndex - 1);
      if (end > seg.startIndex) {
        requests.push({
          updateTextStyle: {
            range: { startIndex: seg.startIndex, endIndex: end },
            textStyle: { bold: true, foregroundColor: docColor(blueRgb) },
            fields: "bold,foregroundColor",
          },
        });
      }
    }
  }

  // Yellow highlight for AE-attention placeholders [like this] in the Doc
  const yellowRgbDoc = hexToRgb("FEF08A");
  const bracketRegexDoc = /\[[^\]]*\]/g;
  for (const seg of segments) {
    let match: RegExpExecArray | null;
    bracketRegexDoc.lastIndex = 0;
    while ((match = bracketRegexDoc.exec(seg.text)) !== null) {
      const start = seg.startIndex + match.index;
      const end = seg.startIndex + match.index + match[0].length;
      requests.push({
        updateTextStyle: {
          range: { startIndex: start, endIndex: end },
          textStyle: {
            backgroundColor: { color: { rgbColor: yellowRgbDoc } },
          },
          fields: "backgroundColor",
        },
      });
    }
  }

  // Customer logo in header (top right)
  if (customerLogoUrlForDoc && defaultHeaderId) {
    requests.push({
      insertInlineImage: {
        uri: customerLogoUrlForDoc,
        location: { segmentId: defaultHeaderId, index: 1 },
        objectSize: {
          height: { magnitude: 40, unit: "PT" as const },
          width: { magnitude: 120, unit: "PT" as const },
        },
      },
    });
    requests.push({
      updateParagraphStyle: {
        range: { segmentId: defaultHeaderId, startIndex: 1, endIndex: 2 },
        paragraphStyle: { alignment: "END" as const },
        fields: "alignment",
      },
    });
  }

  const batchRes = await fetch(
    `https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requests }),
    }
  );
  if (!batchRes.ok) {
    const err = await batchRes.text();
    throw new Error(`Docs batchUpdate failed: ${batchRes.status} ${err}`);
  }
}

type SlidesPayload = {
  currency?: string;
  titleSlide: { customerName: string; headline: string; date: string };
  executiveSlide: { problems: string[]; solutions: string[]; valueCategories: Array<{ label: string; sub: string; val: string }>; ebitda: string; roiMetrics: Array<{ label: string; val: string }> };
  valueSummarySlide: { categories: Array<{ label: string; value: string; items: Array<{ label: string; value: number }> }>; ebitda: string; kpis: Array<{ metric: string; current: string; target: string; improvement?: string }> };
  valueDriversSlide: { rows: Array<{ category?: string; label: string; value: string }> };
  targetOutcomesSlide: { rows: Array<{ metric: string; current: string; target: string; improvement: string }> };
  roiSlide: { metrics: Array<{ label: string; value: string }>; yearTable: Array<{ year: number; grossEBITDA: string; forterCost: string; netEBITDA: string }>; totalRow: { grossEBITDA: string; forterCost: string; netEBITDA: string } } | null;
  nextStepsSlide: { steps: Array<{ num: string; title: string; body: string }> };
  appendixSlides: Array<{ title: string; problem: string; solution: string; benefit: string; isTBD: boolean; badge?: string; tableRows: Array<{ cells: string[] }>; funnelSlide?: { viewMode: 'percent' | 'transactions'; totalTransactionAttempts: number; totalRecoverable: string; stages: Array<{ label: string; currentVal: string; recoverableVal: string }> } }>;
  /** Optional: customer logo URL (publicly accessible). Shown on title slide next to content area and as small logo on content slides. */
  customerLogoUrl?: string;
  /** Optional: copy these slides from another presentation into the Case Studies section (order = display order). Same length as case study slots. */
  caseStudySourceSlides?: Array<{ presentationId: string; pageObjectId: string }>;
  /** Optional: if set and caseStudySourceSlides is not provided, fetch this presentation and use its first N slides (N = case study count) in order. */
  caseStudySourcePresentationId?: string;
  /** Optional: case study slide numbers to include (for selected benefits). When set, only these slides are created/copied; order = display order. */
  caseStudySlideNumbers?: number[];
  /** When true (custom value pathway), Executive Summary, Key Performance Improvements, and Target Outcomes are not populated. */
  isCustomPathway?: boolean;
};

/** Create a RECTANGLE or ELLIPSE shape (x,y,w,h in PPT inches; scaled to Google Slides canvas). */
function createRectRequest(
  objectId: string,
  pageId: string,
  x: number,
  y: number,
  w: number,
  h: number,
  shapeType: "RECTANGLE" | "ELLIPSE" = "RECTANGLE"
): Record<string, unknown> {
  return {
    createShape: {
      objectId,
      shapeType,
      elementProperties: {
        pageObjectId: pageId,
        size: {
          width: { magnitude: inchToPt(w * SX), unit: "PT" },
          height: { magnitude: inchToPt(h * SY), unit: "PT" },
        },
        transform: {
          scaleX: 1,
          scaleY: 1,
          translateX: inchToPt(x * SX),
          translateY: inchToPt(y * SY),
          unit: "PT",
        },
      },
    },
  };
}

/** Append createShape + insertText + updateTextStyle for one text box. */
function addTextBox(
  requests: Record<string, unknown>[],
  id: string,
  pageId: string,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  opts: { bold?: boolean; fontSize?: number; colorRgb: { red: number; green: number; blue: number }; fontFamily: string; alignment?: "START" | "CENTER" | "END" }
): void {
  if (!text.trim()) return;
  requests.push(createTextBoxRequest(id, pageId, x, y, w, h));
  requests.push({ insertText: { objectId: id, insertionIndex: 0, text } });
  requests.push({
    updateTextStyle: {
      objectId: id,
      textRange: { type: "ALL" as const },
      style: {
        bold: opts.bold ?? false,
        fontSize: { magnitude: scaledFontSize(opts.fontSize ?? 10), unit: "PT" as const },
        foregroundColor: { opaqueColor: { rgbColor: opts.colorRgb } },
        fontFamily: opts.fontFamily,
      },
      fields: "bold,fontSize,foregroundColor,fontFamily",
    },
  });
  if (opts.alignment) {
    requests.push({
      updateParagraphStyle: {
        objectId: id,
        textRange: { type: "ALL" as const },
        style: { alignment: opts.alignment },
        fields: "alignment",
      },
    });
  }
}

/**
 * Populate a Google Slides presentation by replicating the PowerPoint layout:
 * BLANK slides + createShape (TEXT_BOX) + createTable, then insertText and updateTextStyle.
 */
export async function buildGoogleSlides(
  accessToken: string,
  presentationId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const p = payload as Partial<SlidesPayload>;
  // Resolve case study source from payload or env (so .env is used even if payload missed it)
  const envCaseStudyId =
    typeof import.meta !== "undefined" && (import.meta as { env?: { VITE_CASE_STUDY_SOURCE_PRESENTATION_ID?: string } }).env?.VITE_CASE_STUDY_SOURCE_PRESENTATION_ID;
  const caseStudySourcePresentationId =
    (typeof p.caseStudySourcePresentationId === "string" && p.caseStudySourcePresentationId.trim()) || (typeof envCaseStudyId === "string" && envCaseStudyId.trim()) || undefined;
  if (caseStudySourcePresentationId) (p as Record<string, unknown>).caseStudySourcePresentationId = caseStudySourcePresentationId;

  const getPres = await fetch(
    `https://slides.googleapis.com/v1/presentations/${presentationId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!getPres.ok) throw new Error("Failed to get presentation");
  const pres = await getPres.json();
  const defaultSlideId = pres.slides?.[0]?.objectId;

  const createRequests: Record<string, unknown>[] = [];
  if (defaultSlideId) {
    createRequests.push({ deleteObject: { objectId: defaultSlideId } });
  }

  const isSubset = !p.executiveSlide && Array.isArray(p.appendixSlides) && p.appendixSlides.length > 0;
  const isCustomPathwayEarly = !!(p as { isCustomPathway?: boolean }).isCustomPathway;
  const caseStudySlideNums =
    Array.isArray(p.caseStudySlideNumbers) && p.caseStudySlideNumbers.length > 0
      ? p.caseStudySlideNumbers
      : isSubset ? [] : getCaseStudySlideNumbersInOrder();
  const caseStudyCount = caseStudySlideNums.length > 0 ? caseStudySlideNums.length + 1 : 0; // +1 for divider slide (full deck only)
  const appendixDividerCount = (p.appendixSlides?.length ?? 0) > 0 ? 1 : 0;
  const driverDataRows = p.valueDriversSlide?.rows ?? [];
  const driverPageCount = Math.max(1, Math.ceil(driverDataRows.length / 11));
    const isAppendixCalculationRow = (cells: string[]) => {
    const hasData = !!(cells[2]?.trim() || cells[3]?.trim() || cells[4]?.trim());
    const isSubtotal = /deduplicated|net sales|ebitda contribution|total|subtotal/i.test(cells[1] ?? "");
    if (!hasData && !isSubtotal) return false;
    if (cells[0]?.trim() && !cells[1]?.trim() && !cells[2]?.trim() && !cells[3]?.trim() && !cells[4]?.trim()) return false;
    if (cells[1]?.trim() && !cells[2]?.trim() && !cells[3]?.trim() && !cells[4]?.trim() && !isSubtotal) return false;
    return true;
  };
  const totalAppendixContentSlides = (p.appendixSlides ?? []).reduce((sum, app) => {
    const tableRows = app.tableRows || [];
    const calculationRows = tableRows.filter((row) =>
      isAppendixCalculationRow((row.cells || []).slice(0, 5).map((c) => String(c ?? "")))
    );
    const calcPages = Math.max(1, Math.ceil(calculationRows.length / 12));
    const funnelPage = (app as { funnelSlide?: unknown }).funnelSlide ? 1 : 0;
    // Visuals are moved to "Value Proposition Insights" section (full deck only), not in appendix
    const visualPage = 0;
    return sum + calcPages + funnelPage + visualPage;
  }, 0);
  /** Full deck only: visuals moved from appendix into "Value Proposition Insights" section before Next Steps. One visual per unique title (e.g. one "Reduce fraud chargebacks" even if both c1 and c245 are selected). */
  const valuePropositionVisualSlides: Array<{ title: string; visualImageBase64: string; badge?: string }> = isSubset
    ? []
    : (p.appendixSlides ?? [])
        .filter((app) => (app as { visualImageBase64?: string }).visualImageBase64 && !app.isTBD)
        .reduce(
          (acc, app) => {
            const title = app.title;
            if (acc.some((a) => a.title === title)) return acc;
            return [
              ...acc,
              {
                title,
                visualImageBase64: (app as { visualImageBase64: string }).visualImageBase64,
                badge: (app as { badge?: string }).badge ?? undefined,
              },
            ];
          },
          [] as Array<{ title: string; visualImageBase64: string; badge?: string }>
        );
  const valuePropositionSlideCount = isSubset ? 0 : 1 + valuePropositionVisualSlides.length; // 1 section title + N visual slides
  // Subset (calculator modal): no title, no appendix divider, no case studies divider — only appendix content + case study image slides
  // Full deck: optionally end with GVA Case Study Deck last slide (when caseStudySourcePresentationId is set)
  // Custom pathway: omit Executive Summary and Target Outcomes slides (two fewer slides)
  const closingGvaSlideCount = !isSubset && caseStudySourcePresentationId ? 1 : 0;
  const fullDeckSlideCount = 1 + 1 + 1 + 1 + driverPageCount + 1 + (p.roiSlide ? 1 : 0) + 1 + caseStudyCount + appendixDividerCount + totalAppendixContentSlides + closingGvaSlideCount + valuePropositionSlideCount;
  const slideCount = isSubset
    ? totalAppendixContentSlides + caseStudySlideNums.length
    : isCustomPathwayEarly ? fullDeckSlideCount - 2 : fullDeckSlideCount;
  const contentSlideOffsetEarly = isCustomPathwayEarly ? 1 : 0;
  const nextStepsIndexForCreation = 4 - contentSlideOffsetEarly + driverPageCount + (isCustomPathwayEarly ? 1 : 2);
  for (let i = 0; i < slideCount; i++) {
    const insertionIndex = isSubset
      ? i
      : i < nextStepsIndexForCreation
        ? i
        : i < nextStepsIndexForCreation + valuePropositionSlideCount
          ? nextStepsIndexForCreation + (i - nextStepsIndexForCreation)
          : nextStepsIndexForCreation + valuePropositionSlideCount + (i - nextStepsIndexForCreation - valuePropositionSlideCount);
    createRequests.push({
      createSlide: {
        insertionIndex,
        slideLayoutReference: { predefinedLayout: "BLANK" },
      },
    });
  }

  let batchRes = await fetch(
    `https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requests: createRequests }),
    }
  );
  if (!batchRes.ok) {
    const err = await batchRes.text();
    console.error("[Google Slides API] create batchUpdate failed. Full response:", err);
    throw new Error(`Slides batchUpdate create failed: ${batchRes.status} ${err.slice(0, 500)}`);
  }

  const getPres2 = await fetch(
    `https://slides.googleapis.com/v1/presentations/${presentationId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const pres2 = await getPres2.json();
  const slides = (pres2.slides || []) as Array<{ objectId: string }>;

  const titleSlide = p.titleSlide ?? { customerName: "Customer", headline: "", date: formatDateMMMDDYYYY() };
  const execSlide = p.executiveSlide ?? { problems: [], solutions: [], valueCategories: [], ebitda: "", roiMetrics: [] };
  const valueSummary = p.valueSummarySlide ?? { categories: [], ebitda: "", kpis: [] };
  const valueDrivers = p.valueDriversSlide ?? { rows: [] };
  const targetOutcomes = p.targetOutcomesSlide ?? { rows: [] };
  const nextSteps = p.nextStepsSlide ?? { steps: [] };
  const isCustomPathway = !!(p as { isCustomPathway?: boolean }).isCustomPathway;
  /** When custom pathway, Executive Summary slide is omitted so content slides shift back by 1. */
  const contentSlideOffset = isCustomPathway ? 1 : 0;
  /** Only use logo when URL is public (https/http). Data/blob URLs cause Slides API to return 400. */
  const customerLogoUrlForSlides =
    p.customerLogoUrl?.trim() && isPublicImageUrl(p.customerLogoUrl.trim()) ? p.customerLogoUrl.trim() : undefined;

  // Use PPT values in code; scale helpers apply when passing to API (via createTextBoxRequest/createRectRequest/tables).
  const CONTENT_W = 12.33;
  const FOOTER_Y = 7.15;
  const sx = (v: number) => v * SX;
  const sy = (v: number) => v * SY;

  const navyRgb = hexToRgb(NAVY);
  const blueRgb = hexToRgb(BLUE);
  const grayRgb = hexToRgb(GRAY);
  const whiteRgb = hexToRgb(WHITE);
  const greenRgb = hexToRgb(GREEN);
  const lightBlueRgb = hexToRgb(LIGHT_BLUE);
  const lightBgRgb = hexToRgb(LIGHT_BG);

  const requests: Record<string, unknown>[] = [];
  const uploadedVisualImageIds: string[] = [];

  /** Only push updateParagraphStyle for table cells when the cell has text (API 400 on empty cells). */
  function safeParagraphAlign(
    reqs: Record<string, unknown>[],
    objectId: string,
    rowIndex: number,
    columnIndex: number,
    alignment: "START" | "CENTER" | "END",
    cellText: string
  ): void {
    if (!cellText?.trim()) return;
    reqs.push({
      updateParagraphStyle: {
        objectId,
        cellLocation: { rowIndex, columnIndex },
        textRange: { type: "ALL" },
        style: { alignment },
        fields: "alignment",
      },
    });
  }

  // Content slide background (instruction + all content slides except title/dividers). Subset has no title or dividers.
  const titleSlideIndex = isSubset ? -1 : 1;
  const s0 = !isSubset && titleSlideIndex >= 0 ? slides[titleSlideIndex]?.objectId : undefined;
  for (let i = 0; i < slides.length; i++) {
    if (isSubset) {
      // Subset: all slides are content (light bg)
    } else if (i === 1) continue; // full deck: title slide keeps navy (or uses GVA last-slide image)
    const sid = slides[i]?.objectId;
    if (sid) {
      requests.push({
        updatePageProperties: {
          objectId: sid,
          pageProperties: {
            pageBackgroundFill: {
              solidFill: { color: { rgbColor: lightBgRgb }, alpha: 1 },
            },
          },
          fields: "pageBackgroundFill",
        },
      });
    }
  }

  // Fetch last slide of GVA Case Study Deck to use as title slide background (image).
  let titleSlideBgUrl: string | undefined;
  if (s0 && caseStudySourcePresentationId) {
    try {
      const srcPresRes = await fetch(
        `https://slides.googleapis.com/v1/presentations/${caseStudySourcePresentationId}?fields=slides.objectId`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (srcPresRes.ok) {
        const srcData = (await srcPresRes.json()) as { slides?: Array<{ objectId: string }> };
        const srcSlides = srcData.slides ?? [];
        const titleBgSlide = srcSlides.length >= 2 ? srcSlides[srcSlides.length - 2] : srcSlides[srcSlides.length - 1];
        if (titleBgSlide?.objectId) {
          const thumbRes = await fetch(
            `https://slides.googleapis.com/v1/presentations/${caseStudySourcePresentationId}/pages/${titleBgSlide.objectId}/thumbnail?thumbnailProperties.mimeType=PNG&thumbnailProperties.thumbnailSize=LARGE`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (thumbRes.ok) {
            const thumbData = (await thumbRes.json()) as { contentUrl?: string };
            if (thumbData.contentUrl) titleSlideBgUrl = thumbData.contentUrl;
          }
        }
      }
    } catch (e) {
      console.warn("[Title slide background] Failed to fetch GVA Case Study last slide thumbnail:", e);
    }
  }

  // ----- Slide 0: General Template Guidelines (instruction / how-to use) — skip for subset -----
  const sHowTo = !isSubset ? slides[0]?.objectId : undefined;
  if (sHowTo) {
    const redRgbHowTo = hexToRgb(RED);
    const fee2e2Rgb = hexToRgb("FEE2E2");
    requests.push(createRectRequest("howto_warn_bg", sHowTo, 0, 0, 13.33, 0.45));
    requests.push({
      updateShapeProperties: {
        objectId: "howto_warn_bg",
        shapeProperties: {
          shapeBackgroundFill: { solidFill: { color: { rgbColor: fee2e2Rgb }, alpha: 1 } },
        },
        fields: "shapeBackgroundFill.solidFill.color",
      },
    });
    addTextBox(requests, "howto_warn_txt", sHowTo, 3.5, 0.06, 9.0, 0.32, "⚠️  DELETE THIS PAGE PRIOR TO SHARING", {
      bold: true, fontSize: 16, colorRgb: redRgbHowTo, fontFamily: FONT_BODY,
    });
    addTextBox(requests, "howto_title", sHowTo, 0.5, 0.5, 12.33, 0.5, "General template guidelines", {
      bold: true, fontSize: 24, colorRgb: navyRgb, fontFamily: FONT_HEAD,
    });
    addTextBox(requests, "howto_sub", sHowTo, 0.5, 0.92, 12.33, 0.3, isCustomPathway
      ? "Slides will pre-populate based on the Custom Value Calculator inputs (no Executive Summary or Target Outcomes)."
      : "Slides will pre-populate based on the Guided Value Calculator Inputs", {
      fontSize: 14, colorRgb: grayRgb, fontFamily: FONT_BODY,
    });
    const bodyGrayRgb = hexToRgb(BODY_GRAY);
    const bulletTexts = [
      "●  Resubmitting the Generate Report button will always create a new presentation",
      "●  Use judgement to determine what slides to share externally",
      "●  If materials are used to paste into another slide deck, ensure formatting is aligned",
      "●  The Next Steps slide contains highlighted placeholders that must be completed manually",
      "●  Appendix calculator slides may span multiple pages for longer models — review before presenting",
    ];
    const bulletYs = [1.32, 1.68, 2.04, 2.4, 2.76];
    bulletTexts.forEach((txt, i) => {
      addTextBox(requests, `howto_bullet_${i}`, sHowTo, 0.5, bulletYs[i], 12.33, 0.22, txt, {
        fontSize: 14.5, colorRgb: bodyGrayRgb, fontFamily: FONT_BODY,
      });
    });
    // Slide map table (PPT inches; scale for Slides canvas). When ROI is not in deck, show Value Proposition Insights instead of ROI Summary.
    const roiRowCustom: [string, string, string] = p.roiSlide
      ? ["4 — ROI Summary", "3-year projection (if investment entered)", "Auto-populated"]
      : ["4 — Value Proposition Insights", "Key value visuals and insights", "Auto-populated"];
    const roiRowFull: [string, string, string] = p.roiSlide
      ? ["6 — ROI Summary", "3-year projection (if investment entered)", "Auto-populated"]
      : ["6 — Value Proposition Insights", "Key value visuals and insights", "Auto-populated"];
    const howtoDataRows: [string, string, string][] = isCustomPathway
      ? [
          ["1 — Title", "Customer name, report type, date", "Auto-populated"],
          ["2 — Value Summary", "Active value category cards (no KPI pills)", "Auto-populated"],
          ["3 — Value Drivers", "Ranked breakdown of value contributors", "Auto-populated"],
          roiRowCustom,
          ["5 — Next Steps ✏️", "Action items and stakeholder names", "MUST BE EDITED MANUALLY"],
          ["6+ — Appendix", "Standard benefit calculator slides only", "Auto-populated"],
        ]
      : [
          ["1 — Title", "Customer name, report type, date", "Auto-populated"],
          ["2 — Executive Summary", "Challenges, approach, value metrics", "Auto-populated"],
          ["3 — Value Summary", "Active value category cards + KPI pills", "Auto-populated"],
          ["4 — Value Drivers", "Ranked breakdown of value contributors", "Auto-populated"],
          ["5 — Target Outcomes", "Current vs Forter KPI table", "Auto-populated"],
          roiRowFull,
          ["7 — Next Steps ✏️", "Action items and stakeholder names", "MUST BE EDITED MANUALLY"],
          ["8+ — Appendix", "Calculator detail slides (may span multiple pages)", "Auto-populated"],
        ];
    const howtoTableRows = 1 + howtoDataRows.length;
    requests.push({
      createTable: {
        objectId: "table_howto",
        elementProperties: {
          pageObjectId: sHowTo,
          size: {
            width: { magnitude: inchToPt(12.33 * SX), unit: "PT" },
            height: { magnitude: inchToPt(2.52 * SY), unit: "PT" },
          },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: inchToPt(0.5 * SX),
            translateY: inchToPt(3.35 * SY),
            unit: "PT",
          },
        },
        rows: howtoTableRows,
        columns: 3,
      },
    });
    requests.push({
      updateTableColumnProperties: {
        objectId: "table_howto",
        columnIndices: [0],
        tableColumnProperties: { columnWidth: { magnitude: inchToPt(2.8 * SX), unit: "PT" } },
        fields: "columnWidth",
      },
    });
    requests.push({
      updateTableColumnProperties: {
        objectId: "table_howto",
        columnIndices: [1],
        tableColumnProperties: { columnWidth: { magnitude: inchToPt(5.8 * SX), unit: "PT" } },
        fields: "columnWidth",
      },
    });
    requests.push({
      updateTableColumnProperties: {
        objectId: "table_howto",
        columnIndices: [2],
        tableColumnProperties: { columnWidth: { magnitude: inchToPt(3.73 * SX), unit: "PT" } },
        fields: "columnWidth",
      },
    });
    const howtoRowIndices = Array.from({ length: howtoTableRows }, (_, i) => i);
    requests.push({
      updateTableRowProperties: {
        objectId: "table_howto",
        rowIndices: howtoRowIndices,
        tableRowProperties: { minRowHeight: { magnitude: inchToPt(0.28 * SY), unit: "PT" } },
        fields: "minRowHeight",
      },
    });
    const howtoHeaderCells = ["Slide", "Content", "Notes"];
    howtoHeaderCells.forEach((cell, c) => {
      requests.push({
        insertText: {
          objectId: "table_howto",
          cellLocation: { rowIndex: 0, columnIndex: c },
          insertionIndex: 0,
          text: cell,
        },
      });
    });
    howtoDataRows.forEach((row, r) => {
      row.forEach((cell, c) => {
        requests.push({
          insertText: {
            objectId: "table_howto",
            cellLocation: { rowIndex: r + 1, columnIndex: c },
            insertionIndex: 0,
            text: cell,
          },
        });
      });
    });
    requests.push({
      updateTableCellProperties: {
        objectId: "table_howto",
        tableRange: { location: { rowIndex: 0, columnIndex: 0 }, rowSpan: 1, columnSpan: 3 },
        tableCellProperties: {
          tableCellBackgroundFill: { solidFill: { color: { rgbColor: navyRgb }, alpha: 1 } },
        },
        fields: "tableCellBackgroundFill.solidFill.color",
      },
    });
    for (let c = 0; c < 3; c++) {
      requests.push({
        updateTextStyle: {
          objectId: "table_howto",
          cellLocation: { rowIndex: 0, columnIndex: c },
          textRange: { type: "ALL" },
          style: { bold: true, fontSize: { magnitude: scaledFontSize(10), unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: whiteRgb } }, fontFamily: FONT_BODY },
          fields: "bold,fontSize,foregroundColor,fontFamily",
        },
      });
    }
    const howtoGreenRgb = hexToRgb(GREEN);
    const howtoRedRgb = hexToRgb(RED);
    const howtoAltRgb = hexToRgb(ALT_ROW);
    for (let r = 1; r < howtoTableRows; r++) {
      if (r % 2 === 1) {
        requests.push({
          updateTableCellProperties: {
            objectId: "table_howto",
            tableRange: { location: { rowIndex: r, columnIndex: 0 }, rowSpan: 1, columnSpan: 3 },
            tableCellProperties: {
              tableCellBackgroundFill: { solidFill: { color: { rgbColor: howtoAltRgb }, alpha: 1 } },
            },
            fields: "tableCellBackgroundFill.solidFill.color",
          },
        });
      }
      for (let c = 0; c < 3; c++) {
        const isNotesCol = c === 2;
        // Only Next Steps row (Notes col) is red "MUST BE EDITED MANUALLY"; all other notes stay green "Auto-populated"
        const nextStepsRowIndex = isCustomPathway ? 5 : 7; // table row (1-based): custom = row 5, full = row 7
        const isRedNotes = isNotesCol && r === nextStepsRowIndex;
        requests.push({
          updateTextStyle: {
            objectId: "table_howto",
            cellLocation: { rowIndex: r, columnIndex: c },
            textRange: { type: "ALL" },
            style: {
              fontSize: { magnitude: scaledFontSize(10), unit: "PT" },
              fontFamily: FONT_BODY,
              ...(isNotesCol ? { foregroundColor: { opaqueColor: { rgbColor: isRedNotes ? howtoRedRgb : howtoGreenRgb } } } : {}),
              ...(isRedNotes ? { bold: true } : {}),
            },
            fields: isRedNotes ? "fontSize,fontFamily,foregroundColor,bold" : isNotesCol ? "fontSize,fontFamily,foregroundColor" : "fontSize,fontFamily",
          },
        });
      }
    }
  }

  // ----- Title slide: GVA Case Study last-slide image as background (if available), else navy. White text on top. -----
  if (s0) {
    if (titleSlideBgUrl) {
      requests.push({
        createImage: {
          objectId: "s0_bg_image",
          url: titleSlideBgUrl,
          elementProperties: {
            pageObjectId: s0,
            size: {
              width: { magnitude: 720, unit: "PT" },
              height: { magnitude: 405.36, unit: "PT" },
            },
            transform: {
              scaleX: 1,
              scaleY: 1,
              translateX: 0,
              translateY: 0,
              unit: "PT",
            },
          },
        },
      });
    } else {
      requests.push({
        updatePageProperties: {
          objectId: s0,
          pageProperties: {
            pageBackgroundFill: {
              solidFill: { color: { rgbColor: navyRgb }, alpha: 1 },
            },
          },
          fields: "pageBackgroundFill",
        },
      });
    }
    // Title slide content: left-aligned with Forter logo, positioned lower
    const s0ContentX = 1.0;
    const s0ContentYStart = 2.2;
    addTextBox(requests, "s0_customer", s0, s0ContentX, s0ContentYStart, 7.5, 1.2, titleSlide.customerName, {
      bold: true, fontSize: 52, colorRgb: whiteRgb, fontFamily: FONT_HEAD,
    });
    addTextBox(requests, "s0_sub", s0, s0ContentX, s0ContentYStart + 1.2, 7.5, 0.7, "Forter Business Value Assessment", {
      bold: true, fontSize: 28, colorRgb: whiteRgb, fontFamily: FONT_HEAD,
    });
    if (titleSlide.headline) {
      addTextBox(requests, "s0_headline", s0, s0ContentX, s0ContentYStart + 2.3, 7.5, 0.8, truncateForSlide(titleSlide.headline, 80), {
        fontSize: 15, colorRgb: lightBlueRgb, fontFamily: FONT_BODY,
      });
    }
    // Horizontal line under headline — solid white (fill + outline so it always appears white)
    const s0LineY = s0ContentYStart + 3.17;
    requests.push(createRectRequest("s0_line", s0, s0ContentX, s0LineY, 7.0, 0.012));
    requests.push({
      updateShapeProperties: {
        objectId: "s0_line",
        shapeProperties: {
          shapeBackgroundFill: {
            solidFill: { color: { rgbColor: whiteRgb }, alpha: 1 },
          },
          outline: {
            outlineFill: { solidFill: { color: { rgbColor: whiteRgb }, alpha: 1 } },
            weight: { magnitude: 0.25, unit: "PT" },
          },
        },
        fields: "shapeBackgroundFill.solidFill.color,shapeBackgroundFill.solidFill.alpha,outline.outlineFill.solidFill.color,outline.weight",
      },
    });
    addTextBox(requests, "s0_date", s0, s0ContentX, s0LineY + 0.2, 4.0, 0.4, titleSlide.date, {
      bold: true, fontSize: 15, colorRgb: whiteRgb, fontFamily: FONT_BODY,
    });
    // Customer logo top right, above main title content (next to where Forter logo would sit)
    if (customerLogoUrlForSlides) {
      requests.push(createImageRequest("s0_customer_logo", s0, 10.8, 0.22, 1.2, 0.5, customerLogoUrlForSlides));
    }
  }

  // ----- Full deck only: Slide 2 Executive Summary through Next Steps -----
  let slideIdx = 0;
  if (!isSubset) {
  // ----- Slide 2: Executive Summary (omitted entirely in custom pathway; slide not created) -----
  const s1 = !isCustomPathway ? slides[2]?.objectId : undefined;
  if (s1) {
    if (customerLogoUrlForSlides) {
      requests.push(createImageRequest("s1_customer_logo", s1, 11.15, 0.1, 0.95, 0.32, customerLogoUrlForSlides));
    }
    addTextBox(requests, "s1_section", s1, 0.5, 0.15, 12.0, 0.2, truncateForSlide(`${titleSlide.customerName} x Forter Business Value Assessment`, 52), {
      bold: true, fontSize: 10, colorRgb: blueRgb, fontFamily: FONT_HEAD,
    });
    addTextBox(requests, "s1_page", s1, 0.28, FOOTER_Y, 1.0, 0.2, "3", {
      fontSize: 7.5, colorRgb: grayRgb, fontFamily: FONT_BODY,
    });
    addTextBox(requests, "s1_footer", s1, 7.0, FOOTER_Y, 6.0, 0.2, "© Forter, Inc. All rights Reserved  |  Confidential", {
      fontSize: 7.5, colorRgb: grayRgb, fontFamily: FONT_BODY, alignment: "END",
    });
    addTextBox(requests, "s1_title", s1, 0.5, 0.38, CONTENT_W, 0.65, "Executive Summary", {
      bold: true, fontSize: 28, colorRgb: navyRgb, fontFamily: FONT_HEAD,
    });
    if (titleSlide.headline) {
      addTextBox(requests, "s1_subtitle", s1, 0.5, 0.95, CONTENT_W, 0.35, truncateForSlide(titleSlide.headline, 85), {
        fontSize: 10, colorRgb: grayRgb, fontFamily: FONT_BODY,
      });
    }
    const s1LeftW = 5.8;
    const s1BulletStep = 0.42;
    addTextBox(requests, "s1_challenges_h", s1, 0.5, 1.32, s1LeftW, 0.28, "Key Challenges Identified", {
      bold: true, fontSize: 10, colorRgb: blueRgb, fontFamily: FONT_HEAD,
    });
    (execSlide.problems || []).slice(0, 5).forEach((prob, i) => {
      addTextBox(requests, `s1_p${i}`, s1, 0.5, 1.6 + i * s1BulletStep, s1LeftW, 0.42, `→  ${truncateForSlide(prob, 72)}`, {
        fontSize: 11, colorRgb: hexToRgb("374151"), fontFamily: FONT_BODY,
      });
    });
    const s1ApproachY = 1.6 + 5 * s1BulletStep + 0.14;
    addTextBox(requests, "s1_approach_h", s1, 0.5, s1ApproachY, s1LeftW, 0.28, "Recommended Approach", {
      bold: true, fontSize: 10, colorRgb: blueRgb, fontFamily: FONT_HEAD,
    });
    (execSlide.solutions || []).slice(0, 5).forEach((sol, i) => {
      addTextBox(requests, `s1_s${i}`, s1, 0.5, s1ApproachY + 0.28 + i * s1BulletStep, s1LeftW, 0.42, `→  ${truncateForSlide(sol, 72)}`, {
        fontSize: 11, colorRgb: hexToRgb("374151"), fontFamily: FONT_BODY,
      });
    });
    const s1RightX = 6.8;
    const s1RightW = 6.0;
    addTextBox(requests, "s1_value_h", s1, s1RightX, 0.82, s1RightW, 0.28, "Value at Stake", {
      bold: true, fontSize: 10, colorRgb: blueRgb, fontFamily: FONT_HEAD,
    });
    const cardH = 0.78;
    const cardGap = 0.08;
    const cardStartY = 1.22;
    const borderGrayRgb = hexToRgb("E5E7EB");
    (execSlide.valueCategories || []).forEach((card, i) => {
      const yPos = cardStartY + i * (cardH + cardGap);
      requests.push(createRectRequest(`s1_card_bg_${i}`, s1, s1RightX, yPos, s1RightW, cardH));
      requests.push({
        updateShapeProperties: {
          objectId: `s1_card_bg_${i}`,
          shapeProperties: {
            shapeBackgroundFill: { solidFill: { color: { rgbColor: whiteRgb }, alpha: 1 } },
            outline: {
              outlineFill: { solidFill: { color: { rgbColor: borderGrayRgb }, alpha: 1 } },
              weight: { magnitude: 0.75, unit: "PT" },
            },
          },
          fields: "shapeBackgroundFill.solidFill.color,outline.outlineFill.solidFill.color,outline.weight",
        },
      });
      addTextBox(requests, `s1_card_l${i}`, s1, s1RightX + 0.1, yPos + 0.06, s1RightW - 0.15, 0.26, truncateForSlide(card.label, 22), {
        fontSize: 11, colorRgb: grayRgb, fontFamily: FONT_BODY,
      });
      addTextBox(requests, `s1_card_s${i}`, s1, s1RightX + 0.1, yPos + 0.32, s1RightW - 0.15, 0.24, truncateForSlide(card.sub, 55), {
        fontSize: 8, colorRgb: hexToRgb("9CA3AF"), fontFamily: FONT_BODY,
      });
      addTextBox(requests, `s1_card_v${i}`, s1, s1RightX + 2.0, yPos + 0.08, s1RightW - 2.0, 0.55, truncateForSlide(card.val, 14), {
        bold: true, fontSize: 20, colorRgb: greenRgb, fontFamily: FONT_HEAD,
        alignment: "END",
      });
    });
    const ebitdaY = cardStartY + (execSlide.valueCategories?.length ?? 0) * (cardH + cardGap) + 0.14;
    requests.push(createRectRequest("rect_s1_ebitda", s1, s1RightX, ebitdaY, s1RightW, 0.95));
    requests.push({
      updateShapeProperties: {
        objectId: "rect_s1_ebitda",
        shapeProperties: {
          shapeBackgroundFill: {
            solidFill: { color: { rgbColor: navyRgb }, alpha: 1 },
          },
        },
        fields: "shapeBackgroundFill.solidFill.color",
      },
    });
    addTextBox(requests, "s1_ebitda_h", s1, s1RightX + 0.1, ebitdaY + 0.06, s1RightW - 2.0, 0.26, "Annual EBITDA Contribution", {
      bold: true, fontSize: 12, colorRgb: whiteRgb, fontFamily: FONT_HEAD,
    });
    addTextBox(requests, "s1_ebitda_desc", s1, s1RightX + 0.1, ebitdaY + 0.34, s1RightW - 2.0, 0.48, truncateForSlide("Total of above, applying commission & gross margin to GMV Uplift · Net of deduplication", 100), {
      fontSize: 9, colorRgb: hexToRgb("86EFAC"), fontFamily: FONT_BODY,
    });
    addTextBox(requests, "s1_ebitda_val", s1, s1RightX + 2.2, ebitdaY + 0.1, s1RightW - 2.2, 0.75, truncateForSlide(execSlide.ebitda || "", 14), {
      bold: true, fontSize: 20, colorRgb: hexToRgb("86EFAC"), fontFamily: FONT_HEAD,
      alignment: "END",
    });
    const roiY = ebitdaY + 0.95 + 0.1;
    const miniCards = execSlide.roiMetrics || [];
    const miniW = miniCards.length === 1 ? s1RightW : (s1RightW - 0.12) / 2;
    const miniCardH = 0.88;
    miniCards.forEach((mc, i) => {
      const xPos = s1RightX + i * (miniW + 0.08);
      requests.push(createRectRequest(`s1_roi_bg_${i}`, s1, xPos, roiY, miniW, miniCardH));
      requests.push({
        updateShapeProperties: {
          objectId: `s1_roi_bg_${i}`,
          shapeProperties: {
            shapeBackgroundFill: { solidFill: { color: { rgbColor: whiteRgb }, alpha: 1 } },
            outline: {
              outlineFill: { solidFill: { color: { rgbColor: borderGrayRgb }, alpha: 1 } },
              weight: { magnitude: 0.75, unit: "PT" },
            },
          },
          fields: "shapeBackgroundFill.solidFill.color,outline.outlineFill.solidFill.color,outline.weight",
        },
      });
      addTextBox(requests, `s1_roi_l${i}`, s1, xPos + 0.12, roiY + 0.06, miniW - 0.2, 0.28, truncateForSlide(mc.label, 40), {
        fontSize: 9, colorRgb: grayRgb, fontFamily: FONT_BODY,
      });
      addTextBox(requests, `s1_roi_v${i}`, s1, xPos + 0.12, roiY + 0.38, miniW - 0.2, 0.44, truncateForSlide(mc.val, 16), {
        bold: true, fontSize: 17, colorRgb: blueRgb, fontFamily: FONT_HEAD,
      });
    });
  }

  // ----- Slide 3: Value Summary (slide index 2 when custom pathway) -----
  const s2 = slides[3 - contentSlideOffset]?.objectId;
  if (s2) {
    if (customerLogoUrlForSlides) {
      requests.push(createImageRequest("s2_customer_logo", s2, 11.15, 0.1, 0.95, 0.32, customerLogoUrlForSlides));
    }
    addTextBox(requests, "s2_section", s2, 0.5, 0.15, 12.0, 0.2, truncateForSlide(`${titleSlide.customerName} x Forter Business Value Assessment`, 52), {
      bold: true, fontSize: 10, colorRgb: blueRgb, fontFamily: FONT_HEAD,
    });
    addTextBox(requests, "s2_page", s2, 0.28, FOOTER_Y, 1.0, 0.2, String(4 - contentSlideOffset), { fontSize: 7.5, colorRgb: grayRgb, fontFamily: FONT_BODY });
    addTextBox(requests, "s2_footer", s2, 7.0, FOOTER_Y, 6.0, 0.2, "© Forter, Inc. All rights Reserved  |  Confidential", {
      fontSize: 7.5, colorRgb: grayRgb, fontFamily: FONT_BODY, alignment: "END",
    });
    addTextBox(requests, "s2_title", s2, 0.5, 0.38, CONTENT_W, 0.65, "Value Summary", {
      bold: true, fontSize: 26, colorRgb: navyRgb, fontFamily: FONT_HEAD,
    });
    const cats = valueSummary.categories || [];
    const valueSummaryGap = 0.15;
    const contentLeft = 0.4;
    const cardW = cats.length === 1
      ? CONTENT_W - 0.8
      : cats.length === 2
      ? (CONTENT_W - 0.8 - valueSummaryGap) / 2
      : (CONTENT_W - 0.8 - valueSummaryGap * 2) / 3;
    const borderGrayRgbS2 = hexToRgb("E5E7EB");
    const currency = (p as { currency?: string }).currency ?? "USD";
    const s2CardsY = 1.1;
    const s2CardH = 2.5;
    cats.forEach((cat, i) => {
      const xPos = contentLeft + i * (cardW + valueSummaryGap);
      requests.push(createRectRequest(`s2_cat_bg_${i}`, s2, xPos, s2CardsY, cardW, s2CardH));
      requests.push({
        updateShapeProperties: {
          objectId: `s2_cat_bg_${i}`,
          shapeProperties: {
            shapeBackgroundFill: { solidFill: { color: { rgbColor: whiteRgb }, alpha: 1 } },
            outline: {
              outlineFill: { solidFill: { color: { rgbColor: borderGrayRgbS2 }, alpha: 1 } },
              weight: { magnitude: 0.75, unit: "PT" },
            },
          },
          fields: "shapeBackgroundFill.solidFill.color,outline.outlineFill.solidFill.color,outline.weight",
        },
      });
      addTextBox(requests, `s2_cat_l${i}`, s2, xPos + 0.12, s2CardsY + 0.08, cardW - 0.24, 0.22, truncateForSlide(cat.label.toUpperCase(), 18), {
        bold: true, fontSize: 10, colorRgb: blueRgb, fontFamily: FONT_HEAD,
      });
      addTextBox(requests, `s2_cat_v${i}`, s2, xPos + 0.12, s2CardsY + 0.32, cardW - 0.24, 0.55, truncateForSlide(cat.value, 12), {
        bold: true, fontSize: cats.length >= 3 ? 18 : 22, colorRgb: greenRgb, fontFamily: FONT_HEAD,
      });
      requests.push(createRectRequest(`s2_sep_${i}`, s2, xPos + 0.18, s2CardsY + 1.05, cardW - 0.36, 0.01));
      requests.push({
        updateShapeProperties: {
          objectId: `s2_sep_${i}`,
          shapeProperties: {
            shapeBackgroundFill: { solidFill: { color: { rgbColor: hexToRgb("E5E7EB") }, alpha: 1 } },
          },
          fields: "shapeBackgroundFill.solidFill.color",
        },
      });
      const labelW = cardW - 0.95;
      const top3Items = [...(cat.items || [])].sort((a, b) => Number(b.value) - Number(a.value)).slice(0, 3);
      addTextBox(requests, `s2_cat_top3_${i}`, s2, xPos + 0.12, s2CardsY + 1.06, labelW + 0.95, 0.22, "Top 3 value drivers", {
        fontSize: 7, colorRgb: hexToRgb("9CA3AF"), fontFamily: FONT_BODY,
      });
      top3Items.forEach((item, j) => {
        const itemY = s2CardsY + 1.28 + j * 0.38;
        addTextBox(requests, `s2_cat_i${i}_${j}`, s2, xPos + 0.12, itemY, labelW, 0.32, item.label, {
          fontSize: 7, colorRgb: grayRgb, fontFamily: FONT_BODY,
        });
        const itemValFormatted = formatCurrencyForSlide(Number(item.value), currency);
        addTextBox(requests, `s2_cat_iv${i}_${j}`, s2, xPos + cardW - 0.95, itemY, 0.95, 0.32, itemValFormatted, {
          bold: true, fontSize: 7, colorRgb: navyRgb, fontFamily: FONT_BODY,
          alignment: "END",
        });
      });
    });
    const s2EbitdaY = s2CardsY + s2CardH + 0.2;
    const s2EbitdaH = 0.72;
    const s2EbitdaRightEdge = contentLeft + cats.length * cardW + (cats.length > 1 ? (cats.length - 1) * valueSummaryGap : 0);
    const s2EbitdaW = s2EbitdaRightEdge - 0.5;
    requests.push(createRectRequest("rect_s2_ebitda", s2, 0.5, s2EbitdaY, s2EbitdaW, s2EbitdaH));
    requests.push({
      updateShapeProperties: {
        objectId: "rect_s2_ebitda",
        shapeProperties: {
          shapeBackgroundFill: {
            solidFill: { color: { rgbColor: navyRgb }, alpha: 1 },
          },
        },
        fields: "shapeBackgroundFill.solidFill.color",
      },
    });
    addTextBox(requests, "s2_ebitda_h", s2, 0.55, s2EbitdaY + 0.1, 7.0, 0.3, "Annual EBITDA Contribution", {
      bold: true, fontSize: 14, colorRgb: whiteRgb, fontFamily: FONT_HEAD,
    });
    addTextBox(requests, "s2_ebitda_sub", s2, 0.65, s2EbitdaY + 0.4, 7.0, 0.24, "Net of deduplication assumptions", {
      fontSize: 8, colorRgb: hexToRgb("9CA3AF"), fontFamily: FONT_BODY,
    });
    addTextBox(requests, "s2_ebitda_val", s2, Math.max(5.5, 0.5 + s2EbitdaW - 5.95), s2EbitdaY + 0.08, 5.63, 0.55, truncateForSlide(valueSummary.ebitda || "", 14), {
      bold: true, fontSize: 24, colorRgb: hexToRgb("86EFAC"), fontFamily: FONT_HEAD,
      alignment: "END",
    });
    const s2KpiY = s2EbitdaY + s2EbitdaH + 0.22;
    if (!isCustomPathway) {
    addTextBox(requests, "s2_kpi_h", s2, 0.5, s2KpiY, CONTENT_W, 0.26, "KEY PERFORMANCE IMPROVEMENTS", {
      bold: true, fontSize: 9, colorRgb: navyRgb, fontFamily: FONT_HEAD,
    });
    const kpis = (valueSummary.kpis || []).slice(0, 20);
    const kpiCols = 5;
    const kpiPillW = 2.38;
    const kpiPillGap = 0.1;
    const kpiPillH = 1.05;
    kpis.forEach((kpi, i) => {
      const col = i % kpiCols;
      const row = Math.floor(i / kpiCols);
      const pillX = 0.5 + col * (kpiPillW + kpiPillGap);
      const pillY = s2KpiY + 0.3 + row * (kpiPillH + 0.12);
      requests.push(createRectRequest(`s2_kpi_bg_${i}`, s2, pillX, pillY, kpiPillW, kpiPillH));
      requests.push({
        updateShapeProperties: {
          objectId: `s2_kpi_bg_${i}`,
          shapeProperties: {
            shapeBackgroundFill: { solidFill: { color: { rgbColor: whiteRgb }, alpha: 1 } },
            outline: {
              outlineFill: { solidFill: { color: { rgbColor: borderGrayRgbS2 }, alpha: 1 } },
              weight: { magnitude: 0.75, unit: "PT" },
            },
          },
          fields: "shapeBackgroundFill.solidFill.color,outline.outlineFill.solidFill.color,outline.weight",
        },
      });
      const headlineResult = (kpi.improvement ?? kpi.target ?? `${kpi.current} → ${kpi.target}`).replace(/^\+/, "");
      const showCurrentTargetLine = !!(kpi.improvement && (kpi.current || kpi.target));
      const kpiTextW = kpiPillW - 0.24;
      addTextBox(requests, `s2_kpi_m${i}`, s2, pillX + 0.12, pillY + 0.06, kpiTextW, 0.26, truncateForSlide(kpi.metric, 28), {
        fontSize: 9, colorRgb: grayRgb, fontFamily: FONT_BODY,
      });
      addTextBox(requests, `s2_kpi_imp${i}`, s2, pillX + 0.12, pillY + 0.3, kpiTextW, 0.38, truncateForSlide(headlineResult, 12), {
        bold: true, fontSize: 16, colorRgb: greenRgb, fontFamily: FONT_HEAD,
      });
      addTextBox(requests, `s2_kpi_cur${i}`, s2, pillX + 0.12, pillY + 0.66, kpiTextW, 0.24, showCurrentTargetLine ? truncateForSlide(`${kpi.current} → ${kpi.target}`, 22) : "", {
        fontSize: 9, colorRgb: hexToRgb("9CA3AF"), fontFamily: FONT_BODY,
      });
    });
    }
  }

  // ----- Slide 4: Value Drivers (table, paginated) -----
  const MAX_DRIVER_ROWS_PER_PAGE = 11;
  const driverPages: Array<{ rows: Array<{ label: string; value: string }>; isLastPage: boolean }> = [];
  for (let start = 0; start < driverDataRows.length; start += MAX_DRIVER_ROWS_PER_PAGE) {
    const slice = driverDataRows.slice(start, start + MAX_DRIVER_ROWS_PER_PAGE);
    driverPages.push({ rows: slice, isLastPage: start + MAX_DRIVER_ROWS_PER_PAGE >= driverDataRows.length });
  }
  if (driverPages.length === 0) driverPages.push({ rows: [], isLastPage: true });

  const altRowRgb = hexToRgb(ALT_ROW);
  driverPages.forEach((page, pageIndex) => {
    const pageSlide = slides[4 - contentSlideOffset + pageIndex]?.objectId;
    if (!pageSlide) return;
    if (customerLogoUrlForSlides) {
      requests.push(createImageRequest(`s3_customer_logo_${pageIndex}`, pageSlide, 11.15, 0.1, 0.95, 0.32, customerLogoUrlForSlides));
    }
    const pageLabel = driverPages.length > 1 ? ` (Page ${pageIndex + 1} of ${driverPages.length})` : "";
    const pageNum = String(5 - contentSlideOffset + pageIndex);
    addTextBox(requests, `s3_section_${pageIndex}`, pageSlide, 0.5, 0.15, 12.0, 0.2, truncateForSlide(`${titleSlide.customerName} x Forter Business Value Assessment`, 52), {
      bold: true, fontSize: 10, colorRgb: blueRgb, fontFamily: FONT_HEAD,
    });
    addTextBox(requests, `s3_page_${pageIndex}`, pageSlide, 0.28, FOOTER_Y, 1.0, 0.2, pageNum, { fontSize: 11, colorRgb: grayRgb, fontFamily: FONT_BODY });
    addTextBox(requests, `s3_footer_${pageIndex}`, pageSlide, 7.0, FOOTER_Y, 6.0, 0.2, "© Forter, Inc. All rights Reserved  |  Confidential", {
      fontSize: 11, colorRgb: grayRgb, fontFamily: FONT_BODY, alignment: "END",
    });
    addTextBox(requests, `s3_title_${pageIndex}`, pageSlide, 0.5, 0.38, CONTENT_W, 0.65, `Value Drivers${pageLabel}`, {
      bold: true, fontSize: 30, colorRgb: navyRgb, fontFamily: FONT_HEAD,
    });
    const tableRowCount = 1 + page.rows.length + (page.isLastPage ? 1 : 0);
    const tableId = `table_drivers_${pageIndex}`;
    requests.push({
      createTable: {
        objectId: tableId,
        elementProperties: {
          pageObjectId: pageSlide,
          size: {
            width: { magnitude: inchToPt(12.33 * SX), unit: "PT" },
            height: { magnitude: inchToPt(5.5 * SY), unit: "PT" },
          },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: inchToPt(0.5 * SX),
            translateY: inchToPt(1.15 * SY),
            unit: "PT",
          },
        },
        rows: tableRowCount,
        columns: 3,
      },
    });
    requests.push({
      updateTableColumnProperties: {
        objectId: tableId,
        columnIndices: [0],
        tableColumnProperties: { columnWidth: { magnitude: inchToPt(2.4 * SX), unit: "PT" } },
        fields: "columnWidth",
      },
    });
    requests.push({
      updateTableColumnProperties: {
        objectId: tableId,
        columnIndices: [1],
        tableColumnProperties: { columnWidth: { magnitude: inchToPt(7.1 * SX), unit: "PT" } },
        fields: "columnWidth",
      },
    });
    requests.push({
      updateTableColumnProperties: {
        objectId: tableId,
        columnIndices: [2],
        tableColumnProperties: { columnWidth: { magnitude: inchToPt(2.83 * SX), unit: "PT" } },
        fields: "columnWidth",
      },
    });
    const driverRowIndices = Array.from({ length: tableRowCount }, (_, i) => i);
    requests.push({
      updateTableRowProperties: {
        objectId: tableId,
        rowIndices: driverRowIndices,
        tableRowProperties: { minRowHeight: { magnitude: inchToPt(0.22 * SY), unit: "PT" } },
        fields: "minRowHeight",
      },
    });
    requests.push({ insertText: { objectId: tableId, cellLocation: { rowIndex: 0, columnIndex: 0 }, insertionIndex: 0, text: "Category" } });
    requests.push({ insertText: { objectId: tableId, cellLocation: { rowIndex: 0, columnIndex: 1 }, insertionIndex: 0, text: "Value Driver" } });
    requests.push({ insertText: { objectId: tableId, cellLocation: { rowIndex: 0, columnIndex: 2 }, insertionIndex: 0, text: "Annual Value" } });
    const ZWSP = "\u200B";
    page.rows.forEach((r, idx) => {
      const cat = truncateForSlide((r as { category?: string }).category ?? "", 18);
      requests.push({ insertText: { objectId: tableId, cellLocation: { rowIndex: idx + 1, columnIndex: 0 }, insertionIndex: 0, text: cat || ZWSP } });
      requests.push({ insertText: { objectId: tableId, cellLocation: { rowIndex: idx + 1, columnIndex: 1 }, insertionIndex: 0, text: r.label || ZWSP } });
      requests.push({ insertText: { objectId: tableId, cellLocation: { rowIndex: idx + 1, columnIndex: 2 }, insertionIndex: 0, text: r.value || ZWSP } });
    });
    if (page.isLastPage) {
      requests.push({ insertText: { objectId: tableId, cellLocation: { rowIndex: tableRowCount - 1, columnIndex: 0 }, insertionIndex: 0, text: ZWSP } });
      requests.push({ insertText: { objectId: tableId, cellLocation: { rowIndex: tableRowCount - 1, columnIndex: 1 }, insertionIndex: 0, text: "Total" } });
      requests.push({ insertText: { objectId: tableId, cellLocation: { rowIndex: tableRowCount - 1, columnIndex: 2 }, insertionIndex: 0, text: valueSummary.ebitda || ZWSP } });
    }
    requests.push({
      updateTableCellProperties: {
        objectId: tableId,
        tableRange: { location: { rowIndex: 0, columnIndex: 0 }, rowSpan: 1, columnSpan: 3 },
        tableCellProperties: { tableCellBackgroundFill: { solidFill: { color: { rgbColor: navyRgb }, alpha: 1 } } },
        fields: "tableCellBackgroundFill.solidFill.color",
      },
    });
    requests.push({
      updateTextStyle: {
        objectId: tableId,
        cellLocation: { rowIndex: 0, columnIndex: 0 },
        textRange: { type: "ALL" },
        style: { bold: true, fontSize: { magnitude: scaledFontSize(10), unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: whiteRgb } }, fontFamily: FONT_BODY },
        fields: "bold,fontSize,foregroundColor,fontFamily",
      },
    });
    requests.push({
      updateTextStyle: {
        objectId: tableId,
        cellLocation: { rowIndex: 0, columnIndex: 1 },
        textRange: { type: "ALL" },
        style: { bold: true, fontSize: { magnitude: scaledFontSize(10), unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: whiteRgb } }, fontFamily: FONT_BODY },
        fields: "bold,fontSize,foregroundColor,fontFamily",
      },
    });
    requests.push({
      updateTextStyle: {
        objectId: tableId,
        cellLocation: { rowIndex: 0, columnIndex: 2 },
        textRange: { type: "ALL" },
        style: { bold: true, fontSize: { magnitude: scaledFontSize(10), unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: whiteRgb } }, fontFamily: FONT_BODY },
        fields: "bold,fontSize,foregroundColor,fontFamily",
      },
    });
    safeParagraphAlign(requests, tableId, 0, 2, "END", "Annual Value");
    if (page.isLastPage) {
      requests.push({
        updateTableCellProperties: {
          objectId: tableId,
          tableRange: { location: { rowIndex: tableRowCount - 1, columnIndex: 0 }, rowSpan: 1, columnSpan: 3 },
          tableCellProperties: { tableCellBackgroundFill: { solidFill: { color: { rgbColor: navyRgb }, alpha: 1 } } },
          fields: "tableCellBackgroundFill.solidFill.color",
        },
      });
      requests.push({
        updateTextStyle: {
          objectId: tableId,
          cellLocation: { rowIndex: tableRowCount - 1, columnIndex: 0 },
          textRange: { type: "ALL" },
          style: { bold: true, fontSize: { magnitude: scaledFontSize(10), unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: whiteRgb } }, fontFamily: FONT_BODY },
          fields: "bold,fontSize,foregroundColor,fontFamily",
        },
      });
      requests.push({
        updateTextStyle: {
          objectId: tableId,
          cellLocation: { rowIndex: tableRowCount - 1, columnIndex: 1 },
          textRange: { type: "ALL" },
          style: { bold: true, fontSize: { magnitude: scaledFontSize(10), unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: whiteRgb } }, fontFamily: FONT_BODY },
          fields: "bold,fontSize,foregroundColor,fontFamily",
        },
      });
      requests.push({
        updateTextStyle: {
          objectId: tableId,
          cellLocation: { rowIndex: tableRowCount - 1, columnIndex: 2 },
          textRange: { type: "ALL" },
          style: { bold: true, fontSize: { magnitude: scaledFontSize(10), unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: whiteRgb } }, fontFamily: FONT_BODY },
          fields: "bold,fontSize,foregroundColor,fontFamily",
        },
      });
      safeParagraphAlign(requests, tableId, tableRowCount - 1, 2, "END", valueSummary.ebitda ?? "");
    }
    page.rows.forEach((r, idx) => {
      const rowIndex = idx + 1;
      if (idx % 2 === 1) {
        requests.push({
          updateTableCellProperties: {
            objectId: tableId,
            tableRange: { location: { rowIndex, columnIndex: 0 }, rowSpan: 1, columnSpan: 3 },
            tableCellProperties: { tableCellBackgroundFill: { solidFill: { color: { rgbColor: altRowRgb }, alpha: 1 } } },
            fields: "tableCellBackgroundFill.solidFill.color",
          },
        });
      }
      for (let col = 0; col < 3; col++) {
        requests.push({
          updateTextStyle: {
            objectId: tableId,
            cellLocation: { rowIndex, columnIndex: col },
            textRange: { type: "ALL" },
            style: {
              fontSize: { magnitude: scaledFontSize(10), unit: "PT" },
              fontFamily: FONT_BODY,
              ...(col === 2 ? { bold: true, foregroundColor: { opaqueColor: { rgbColor: greenRgb } } } : {}),
            },
            fields: col === 2 ? "bold,fontSize,foregroundColor,fontFamily" : "fontSize,fontFamily",
          },
        });
      }
      safeParagraphAlign(requests, tableId, rowIndex, 2, "END", r.value ?? "");
    });
  });

  const baseAfterDrivers = 4 - contentSlideOffset + driverPageCount;
  // ----- Slide 5: Target Outcomes (table; skipped for custom value pathway) -----
  const s4 = slides[baseAfterDrivers]?.objectId;
  if (s4 && !isCustomPathway) {
    if (customerLogoUrlForSlides) {
      requests.push(createImageRequest("s4_customer_logo", s4, 11.15, 0.1, 0.95, 0.32, customerLogoUrlForSlides));
    }
    addTextBox(requests, "s4_section", s4, 0.5, 0.15, 12.0, 0.2, truncateForSlide(`${titleSlide.customerName} x Forter Business Value Assessment`, 52), {
      bold: true, fontSize: 10, colorRgb: blueRgb, fontFamily: FONT_HEAD,
    });
    addTextBox(requests, "s4_page", s4, 0.28, FOOTER_Y, 1.0, 0.2, String(baseAfterDrivers + 1), { fontSize: 11, colorRgb: grayRgb, fontFamily: FONT_BODY });
    addTextBox(requests, "s4_footer", s4, 7.0, FOOTER_Y, 6.0, 0.2, "© Forter, Inc. All rights Reserved  |  Confidential", {
      fontSize: 11, colorRgb: grayRgb, fontFamily: FONT_BODY, alignment: "END",
    });
    addTextBox(requests, "s4_title", s4, 0.5, 0.38, CONTENT_W, 0.65, "Target Outcomes", {
      bold: true, fontSize: 30, colorRgb: navyRgb, fontFamily: FONT_HEAD,
    });
    const kpiRows = targetOutcomes.rows || [];
    const kpiTableRows = 1 + kpiRows.length;
    requests.push({
      createTable: {
        objectId: "table_outcomes",
        elementProperties: {
          pageObjectId: s4,
          size: {
            width: { magnitude: inchToPt(12.33 * SX), unit: "PT" },
            height: { magnitude: inchToPt(5.0 * SY), unit: "PT" },
          },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: inchToPt(0.5 * SX),
            translateY: inchToPt(1.15 * SY),
            unit: "PT",
          },
        },
        rows: kpiTableRows,
        columns: 4,
      },
    });
    const outcomesColWidths = [5.0, 2.5, 2.5, 2.33];
    for (let c = 0; c < 4; c++) {
      requests.push({
        updateTableColumnProperties: {
          objectId: "table_outcomes",
          columnIndices: [c],
          tableColumnProperties: { columnWidth: { magnitude: inchToPt(outcomesColWidths[c] * SX), unit: "PT" } },
          fields: "columnWidth",
        },
      });
    }
    const outcomesRowIndices = Array.from({ length: kpiTableRows }, (_, i) => i);
    requests.push({
      updateTableRowProperties: {
        objectId: "table_outcomes",
        rowIndices: outcomesRowIndices,
        tableRowProperties: { minRowHeight: { magnitude: inchToPt(0.44 * SY), unit: "PT" } },
        fields: "minRowHeight",
      },
    });
    requests.push({
      insertText: {
        objectId: "table_outcomes",
        cellLocation: { rowIndex: 0, columnIndex: 0 },
        insertionIndex: 0,
        text: "Key Metric",
      },
    });
    requests.push({
      insertText: {
        objectId: "table_outcomes",
        cellLocation: { rowIndex: 0, columnIndex: 1 },
        insertionIndex: 0,
        text: "Current",
      },
    });
    requests.push({
      insertText: {
        objectId: "table_outcomes",
        cellLocation: { rowIndex: 0, columnIndex: 2 },
        insertionIndex: 0,
        text: "With Forter",
      },
    });
    requests.push({
      insertText: {
        objectId: "table_outcomes",
        cellLocation: { rowIndex: 0, columnIndex: 3 },
        insertionIndex: 0,
        text: "Improvement",
      },
    });
    kpiRows.forEach((r, idx) => {
      requests.push({
        insertText: {
          objectId: "table_outcomes",
          cellLocation: { rowIndex: idx + 1, columnIndex: 0 },
          insertionIndex: 0,
          text: r.metric,
        },
      });
      requests.push({
        insertText: {
          objectId: "table_outcomes",
          cellLocation: { rowIndex: idx + 1, columnIndex: 1 },
          insertionIndex: 0,
          text: r.current,
        },
      });
      requests.push({
        insertText: {
          objectId: "table_outcomes",
          cellLocation: { rowIndex: idx + 1, columnIndex: 2 },
          insertionIndex: 0,
          text: r.target,
        },
      });
      requests.push({
        insertText: {
          objectId: "table_outcomes",
          cellLocation: { rowIndex: idx + 1, columnIndex: 3 },
          insertionIndex: 0,
          text: r.improvement,
        },
      });
    });
    requests.push({
      updateTableCellProperties: {
        objectId: "table_outcomes",
        tableRange: { location: { rowIndex: 0, columnIndex: 0 }, rowSpan: 1, columnSpan: 4 },
        tableCellProperties: {
          tableCellBackgroundFill: {
            solidFill: { color: { rgbColor: navyRgb }, alpha: 1 },
          },
        },
        fields: "tableCellBackgroundFill.solidFill.color",
      },
    });
    for (let c = 0; c < 4; c++) {
      requests.push({
        updateTextStyle: {
          objectId: "table_outcomes",
          cellLocation: { rowIndex: 0, columnIndex: c },
          textRange: { type: "ALL" },
          style: { bold: true, fontSize: { magnitude: scaledFontSize(10), unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: whiteRgb } }, fontFamily: FONT_BODY },
          fields: "bold,fontSize,foregroundColor,fontFamily",
        },
      });
    }
    // Proxima Nova for all Target Outcomes data cells, fontSize 10
    kpiRows.forEach((_, idx) => {
      for (let c = 0; c < 4; c++) {
        requests.push({
          updateTextStyle: {
            objectId: "table_outcomes",
            cellLocation: { rowIndex: idx + 1, columnIndex: c },
            textRange: { type: "ALL" },
            style: { fontSize: { magnitude: scaledFontSize(10), unit: "PT" }, fontFamily: FONT_BODY },
            fields: "fontSize,fontFamily",
          },
        });
      }
    });
    // Green bold for "With Forter" column
    kpiRows.forEach((_, idx) => {
      requests.push({
        updateTextStyle: {
          objectId: "table_outcomes",
          cellLocation: { rowIndex: idx + 1, columnIndex: 2 },
          textRange: { type: "ALL" },
          style: { bold: true, foregroundColor: { opaqueColor: { rgbColor: greenRgb } }, fontFamily: FONT_BODY },
          fields: "bold,foregroundColor,fontFamily",
        },
      });
    });
    // Center align columns 1, 2, 3 only when cell has content
    const outcomesHeaderLabels = ["Key Metric", "Current", "With Forter", "Improvement"];
    [0, ...kpiRows.map((_, i) => i + 1)].forEach((rowIdx) => {
      [1, 2, 3].forEach((col) => {
        const cellText =
          rowIdx === 0
            ? outcomesHeaderLabels[col]
            : [kpiRows[rowIdx - 1]?.current, kpiRows[rowIdx - 1]?.target, kpiRows[rowIdx - 1]?.improvement][col - 1];
        safeParagraphAlign(requests, "table_outcomes", rowIdx, col, "CENTER", cellText ?? "");
      });
    });
    // Alternating row fills
    kpiRows.forEach((_, idx) => {
      if (idx % 2 === 1) {
        requests.push({
          updateTableCellProperties: {
            objectId: "table_outcomes",
            tableRange: { location: { rowIndex: idx + 1, columnIndex: 0 }, rowSpan: 1, columnSpan: 4 },
            tableCellProperties: {
              tableCellBackgroundFill: {
                solidFill: { color: { rgbColor: hexToRgb(ALT_ROW) }, alpha: 1 },
              },
            },
            fields: "tableCellBackgroundFill.solidFill.color",
          },
        });
      }
    });
    // Red for negative improvement (match PPT)
    const redRgb = hexToRgb(RED);
    kpiRows.forEach((r, idx) => {
      if (r.improvement?.startsWith("-")) {
        requests.push({
          updateTextStyle: {
            objectId: "table_outcomes",
            cellLocation: { rowIndex: idx + 1, columnIndex: 3 },
            textRange: { type: "ALL" },
            style: { bold: true, foregroundColor: { opaqueColor: { rgbColor: redRgb } }, fontFamily: FONT_BODY },
            fields: "bold,foregroundColor,fontFamily",
          },
        });
      }
    });
  }

  // ----- Slide 6: ROI Summary (optional). When custom pathway, Target Outcomes slide is omitted so ROI is at baseAfterDrivers. -----
  const roiSlideIndex = baseAfterDrivers + (isCustomPathway ? 0 : 1);
  slideIdx = baseAfterDrivers + (isCustomPathway ? (p.roiSlide ? 1 : 0) : (p.roiSlide ? 2 : 1));
  if (p.roiSlide && slides[roiSlideIndex]?.objectId) {
    const s5 = slides[roiSlideIndex].objectId;
    const roi = p.roiSlide;
    const pageNum = String(roiSlideIndex + 1);
    if (customerLogoUrlForSlides) {
      requests.push(createImageRequest("s5_customer_logo", s5, 11.15, 0.1, 0.95, 0.32, customerLogoUrlForSlides));
    }
    addTextBox(requests, "s5_section", s5, 0.5, 0.15, 12.0, 0.2, truncateForSlide(`${titleSlide.customerName} x Forter Business Value Assessment`, 52), {
      bold: true, fontSize: 10, colorRgb: blueRgb, fontFamily: FONT_HEAD,
    });
    addTextBox(requests, "s5_page", s5, 0.28, FOOTER_Y, 1.0, 0.2, pageNum, { fontSize: 11, colorRgb: grayRgb, fontFamily: FONT_BODY });
    addTextBox(requests, "s5_footer", s5, 7.0, FOOTER_Y, 6.0, 0.2, "© Forter, Inc. All rights Reserved  |  Confidential", {
      fontSize: 11, colorRgb: grayRgb, fontFamily: FONT_BODY, alignment: "END",
    });
    addTextBox(requests, "s5_title", s5, 0.5, 0.38, CONTENT_W, 0.65, "ROI Summary", {
      bold: true, fontSize: 30, colorRgb: navyRgb, fontFamily: FONT_HEAD,
    });
    const s5CardW = 6.0;
    const s5CardGap = 0.4;
    const s5CardH = 1.35;
    const s5Row0Y = 1.2;
    const s5Row1Y = 2.7;
    roi.metrics.forEach((metric, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const xPos = col === 0 ? 0.5 : 6.9;
      const yPos = row === 0 ? s5Row0Y : s5Row1Y;
      requests.push(createRectRequest(`s5_metric_bg_${idx}`, s5, xPos, yPos, s5CardW, s5CardH));
      requests.push({
        updateShapeProperties: {
          objectId: `s5_metric_bg_${idx}`,
          shapeProperties: {
            shapeBackgroundFill: { solidFill: { color: { rgbColor: whiteRgb }, alpha: 1 } },
            outline: {
              outlineFill: { solidFill: { color: { rgbColor: idx === 3 ? hexToRgb(GREEN) : hexToRgb(BLUE) }, alpha: 1 } },
              weight: { magnitude: 2, unit: "PT" },
            },
          },
          fields: "shapeBackgroundFill.solidFill.color,outline.outlineFill.solidFill.color,outline.weight",
        },
      });
      addTextBox(requests, `s5_metric_l${idx}`, s5, xPos + 0.15, yPos + 0.08, s5CardW - 0.3, 0.26, metric.label, {
        fontSize: 15, colorRgb: grayRgb, fontFamily: FONT_BODY,
      });
      addTextBox(requests, `s5_metric_v${idx}`, s5, xPos + 0.15, yPos + 0.3, s5CardW - 0.3, 0.62, metric.value, {
        bold: true, fontSize: 28, colorRgb: idx === 3 ? greenRgb : blueRgb, fontFamily: FONT_HEAD,
      });
    });
    const roiTableRows = 1 + (roi.yearTable?.length ?? 0) + 1;
    requests.push({
      createTable: {
        objectId: "table_roi",
        elementProperties: {
          pageObjectId: s5,
          size: {
            width: { magnitude: inchToPt(12.33 * SX), unit: "PT" },
            height: { magnitude: inchToPt(2.2 * SY), unit: "PT" },
          },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: inchToPt(0.5 * SX),
            translateY: inchToPt(4.2 * SY),
            unit: "PT",
          },
        },
        rows: roiTableRows,
        columns: 4,
      },
    });
    const roiColWidths = [1.5, 3.5, 3.5, 3.83];
    roiColWidths.forEach((w, c) => {
      requests.push({
        updateTableColumnProperties: {
          objectId: "table_roi",
          columnIndices: [c],
          tableColumnProperties: { columnWidth: { magnitude: inchToPt(w * SX), unit: "PT" } },
          fields: "columnWidth",
        },
      });
    });
    const roiRowIndices = Array.from({ length: roiTableRows }, (_, i) => i);
    requests.push({
      updateTableRowProperties: {
        objectId: "table_roi",
        rowIndices: roiRowIndices,
        tableRowProperties: { minRowHeight: { magnitude: inchToPt(0.45 * SY), unit: "PT" } },
        fields: "minRowHeight",
      },
    });
    requests.push({
      insertText: {
        objectId: "table_roi",
        cellLocation: { rowIndex: 0, columnIndex: 0 },
        insertionIndex: 0,
        text: "Year",
      },
    });
    requests.push({
      insertText: {
        objectId: "table_roi",
        cellLocation: { rowIndex: 0, columnIndex: 1 },
        insertionIndex: 0,
        text: "Gross EBITDA",
      },
    });
    requests.push({
      insertText: {
        objectId: "table_roi",
        cellLocation: { rowIndex: 0, columnIndex: 2 },
        insertionIndex: 0,
        text: "Forter Cost",
      },
    });
    requests.push({
      insertText: {
        objectId: "table_roi",
        cellLocation: { rowIndex: 0, columnIndex: 3 },
        insertionIndex: 0,
        text: "Net EBITDA",
      },
    });
    (roi.yearTable || []).forEach((y, idx) => {
      requests.push({
        insertText: {
          objectId: "table_roi",
          cellLocation: { rowIndex: idx + 1, columnIndex: 0 },
          insertionIndex: 0,
          text: `Year ${y.year}`,
        },
      });
      requests.push({
        insertText: {
          objectId: "table_roi",
          cellLocation: { rowIndex: idx + 1, columnIndex: 1 },
          insertionIndex: 0,
          text: y.grossEBITDA,
        },
      });
      requests.push({
        insertText: {
          objectId: "table_roi",
          cellLocation: { rowIndex: idx + 1, columnIndex: 2 },
          insertionIndex: 0,
          text: y.forterCost,
        },
      });
      requests.push({
        insertText: {
          objectId: "table_roi",
          cellLocation: { rowIndex: idx + 1, columnIndex: 3 },
          insertionIndex: 0,
          text: y.netEBITDA,
        },
      });
    });
    const tot = roi.totalRow;
    requests.push({
      insertText: {
        objectId: "table_roi",
        cellLocation: { rowIndex: roiTableRows - 1, columnIndex: 0 },
        insertionIndex: 0,
        text: "Total",
      },
    });
    requests.push({
      insertText: {
        objectId: "table_roi",
        cellLocation: { rowIndex: roiTableRows - 1, columnIndex: 1 },
        insertionIndex: 0,
        text: tot.grossEBITDA,
      },
    });
    requests.push({
      insertText: {
        objectId: "table_roi",
        cellLocation: { rowIndex: roiTableRows - 1, columnIndex: 2 },
        insertionIndex: 0,
        text: tot.forterCost,
      },
    });
    requests.push({
      insertText: {
        objectId: "table_roi",
        cellLocation: { rowIndex: roiTableRows - 1, columnIndex: 3 },
        insertionIndex: 0,
        text: tot.netEBITDA,
      },
    });
    requests.push({
      updateTableCellProperties: {
        objectId: "table_roi",
        tableRange: { location: { rowIndex: 0, columnIndex: 0 }, rowSpan: 1, columnSpan: 4 },
        tableCellProperties: {
          tableCellBackgroundFill: {
            solidFill: { color: { rgbColor: navyRgb }, alpha: 1 },
          },
        },
        fields: "tableCellBackgroundFill.solidFill.color",
      },
    });
    requests.push({
      updateTableCellProperties: {
        objectId: "table_roi",
        tableRange: { location: { rowIndex: roiTableRows - 1, columnIndex: 0 }, rowSpan: 1, columnSpan: 4 },
        tableCellProperties: {
          tableCellBackgroundFill: {
            solidFill: { color: { rgbColor: navyRgb }, alpha: 1 },
          },
        },
        fields: "tableCellBackgroundFill.solidFill.color",
      },
    });
    // Proxima Nova for ROI table data rows
    const roiDataRowCount = roiTableRows - 2;
    for (let r = 0; r < roiDataRowCount; r++) {
      for (let c = 0; c < 4; c++) {
        requests.push({
          updateTextStyle: {
            objectId: "table_roi",
            cellLocation: { rowIndex: r + 1, columnIndex: c },
            textRange: { type: "ALL" },
            style: { fontFamily: FONT_BODY },
            fields: "fontFamily",
          },
        });
      }
    }
    for (let c = 0; c < 4; c++) {
      requests.push({
        updateTextStyle: {
          objectId: "table_roi",
          cellLocation: { rowIndex: 0, columnIndex: c },
          textRange: { type: "ALL" },
          style: { bold: true, foregroundColor: { opaqueColor: { rgbColor: whiteRgb } }, fontFamily: FONT_BODY },
          fields: "bold,foregroundColor,fontFamily",
        },
      });
      requests.push({
        updateTextStyle: {
          objectId: "table_roi",
          cellLocation: { rowIndex: roiTableRows - 1, columnIndex: c },
          textRange: { type: "ALL" },
          style: { bold: true, foregroundColor: { opaqueColor: { rgbColor: c === 3 ? hexToRgb("86EFAC") : whiteRgb } }, fontFamily: FONT_BODY },
          fields: "bold,foregroundColor,fontFamily",
        },
      });
    }
    // END alignment for columns 1, 2, 3 only when cell has content
    const roiYearTable = roi.yearTable ?? [];
    for (let r = 1; r < roiTableRows; r++) {
      const isTotalRow = r === roiTableRows - 1;
      const rowData = isTotalRow ? tot : roiYearTable[r - 1];
      const cellTexts =
        rowData == null
          ? ["", "", ""]
          : [rowData.grossEBITDA ?? "", rowData.forterCost ?? "", rowData.netEBITDA ?? ""];
      [1, 2, 3].forEach((col) => {
        safeParagraphAlign(requests, "table_roi", r, col, "END", cellTexts[col - 1] ?? "");
      });
    }
    slideIdx = baseAfterDrivers + (isCustomPathway ? 1 : 2);
  }

  const valuePropStartIndex = baseAfterDrivers + (isCustomPathway ? 1 : 2);
  // ----- Value Proposition Insights (full deck only): divider (Case Studies style) + visual slides, before Next Steps -----
  if (!isSubset && valuePropositionSlideCount > 0) {
    const sValuePropTitle = slides[valuePropStartIndex]?.objectId;
    if (sValuePropTitle) {
      requests.push({
        updatePageProperties: {
          objectId: sValuePropTitle,
          pageProperties: {
            pageBackgroundFill: {
              solidFill: { color: { rgbColor: navyRgb }, alpha: 1 },
            },
          },
          fields: "pageBackgroundFill",
        },
      });
      addTextBox(requests, "svp_title", sValuePropTitle, 0.5, 2.4, CONTENT_W, 0.5, "Value Proposition Insights", {
        bold: true, fontSize: 40, colorRgb: whiteRgb, fontFamily: FONT_HEAD,
      });
      const merchantName = titleSlide.customerName || "Customer";
      addTextBox(requests, "svp_subtitle", sValuePropTitle, 0.5, 3.2, CONTENT_W, 0.3, truncateForSlide(`How ${merchantName}'s business benefits from a Forter partnership`, 80), {
        fontSize: 14, colorRgb: lightBlueRgb, fontFamily: FONT_BODY,
      });
    }
    const badgeColors: Record<string, { bg: string; text: string }> = {
      "GMV Uplift": { bg: "DBEAFE", text: "1D4ED8" },
      "Cost Reduction": { bg: "FEF3C7", text: "92400E" },
      "Risk Mitigation": { bg: "FCE7F3", text: "9D174D" },
    };
    const lightBorderRgb = hexToRgb("E8EAED");
    const badgeH = 0.56;
    for (let v = 0; v < valuePropositionVisualSlides.length; v++) {
      const item = valuePropositionVisualSlides[v];
      const visualSlide = slides[valuePropStartIndex + 1 + v]?.objectId;
      if (!visualSlide) continue;
      const pageNum = String(valuePropStartIndex + 2 + v);
      const { url: visualUrl, fileId: visualFileId } = await uploadBase64ImageToDrive(
        accessToken,
        item.visualImageBase64,
        `valueprop_visual_${v}_${Date.now()}.png`
      );
      uploadedVisualImageIds.push(visualFileId);
      addTextBox(requests, `svp_vis_sec_${v}`, visualSlide, 0.5, 0.15, 12.0, 0.2, truncateForSlide(`${titleSlide.customerName} x Forter Business Value Assessment`, 52), {
        bold: true, fontSize: 10, colorRgb: blueRgb, fontFamily: FONT_HEAD,
      });
      addTextBox(requests, `svp_vis_title_${v}`, visualSlide, 0.5, 0.38, CONTENT_W, 0.38, truncateForSlide(item.title, 55), {
        bold: true, fontSize: 18, colorRgb: navyRgb, fontFamily: FONT_HEAD,
      });
      addTextBox(requests, `svp_vis_page_${v}`, visualSlide, 0.28, FOOTER_Y, 1.0, 0.2, pageNum, {
        fontSize: 7.5, colorRgb: grayRgb, fontFamily: FONT_BODY,
      });
      addTextBox(requests, `svp_vis_ft_${v}`, visualSlide, 7.0, FOOTER_Y, 6.0, 0.2, "© Forter, Inc. All rights Reserved  |  Confidential", {
        fontSize: 7.5, colorRgb: grayRgb, fontFamily: FONT_BODY, alignment: "END",
      });
      if (item.badge && badgeColors[item.badge]) {
        const bc = badgeColors[item.badge];
        requests.push(createRectRequest(`svp_vis_badge_bg_${v}`, visualSlide, 10.8, 0.08, 1.9, badgeH));
        requests.push({
          updateShapeProperties: {
            objectId: `svp_vis_badge_bg_${v}`,
            shapeProperties: {
              shapeBackgroundFill: { solidFill: { color: { rgbColor: hexToRgb(bc.bg) }, alpha: 1 } },
              outline: {
                outlineFill: { solidFill: { color: { rgbColor: lightBorderRgb } } },
                weight: { magnitude: 0.5, unit: "PT" },
              },
            },
            fields: "shapeBackgroundFill.solidFill.color,outline.outlineFill.solidFill.color,outline.weight",
          },
        });
        addTextBox(requests, `svp_vis_badge_txt_${v}`, visualSlide, 10.8, 0.08 + (badgeH - 0.2) / 2, 1.9, 0.2, item.badge, {
          bold: true, fontSize: 9, colorRgb: hexToRgb(bc.text), fontFamily: FONT_HEAD, alignment: "CENTER",
        });
        requests.push({
          updateParagraphStyle: {
            objectId: `svp_vis_badge_txt_${v}`,
            textRange: { type: "ALL" },
            style: { alignment: "CENTER" },
            fields: "alignment",
          },
        });
      }
      // Image starts below title (title y=0.38, h=0.38 → ends 0.76); slightly reduced height
      requests.push(createImageRequest(`svp_vis_img_${v}`, visualSlide, 0.1, 0.80, 13.13, 5.95, visualUrl));
    }
    slideIdx = valuePropStartIndex + valuePropositionSlideCount;
  }

  // ----- Next Steps -----
  const sNext = slides[slideIdx]?.objectId;
  if (sNext) {
    const pageNum = String(slideIdx + 1);
    if (customerLogoUrlForSlides) {
      requests.push(createImageRequest("snext_customer_logo", sNext, 11.15, 0.1, 0.95, 0.32, customerLogoUrlForSlides));
    }
    addTextBox(requests, "snext_section", sNext, 0.5, 0.15, 12.0, 0.2, truncateForSlide(`${titleSlide.customerName} x Forter Business Value Assessment`, 52), {
      bold: true, fontSize: 10, colorRgb: blueRgb, fontFamily: FONT_HEAD,
    });
    addTextBox(requests, "snext_page", sNext, 0.28, FOOTER_Y, 1.0, 0.2, pageNum, { fontSize: 11, colorRgb: grayRgb, fontFamily: FONT_BODY });
    addTextBox(requests, "snext_footer", sNext, 7.0, FOOTER_Y, 6.0, 0.2, "© Forter, Inc. All rights Reserved  |  Confidential", {
      fontSize: 11, colorRgb: grayRgb, fontFamily: FONT_BODY, alignment: "END",
    });
    addTextBox(requests, "snext_title", sNext, 0.5, 0.38, CONTENT_W, 0.65, "Next Steps", {
      bold: true, fontSize: 30, colorRgb: navyRgb, fontFamily: FONT_HEAD,
    });
    // Amber banner background (match PPT)
    requests.push(createRectRequest("rect_snext_banner", sNext, 0.5, 1.28, 12.33, 0.62));
    requests.push({
      updateShapeProperties: {
        objectId: "rect_snext_banner",
        shapeProperties: {
          shapeBackgroundFill: {
            solidFill: { color: { rgbColor: hexToRgb("FEF3C7") }, alpha: 1 },
          },
          outline: {
            outlineFill: { solidFill: { color: { rgbColor: hexToRgb("F59E0B") } } },
            weight: { magnitude: 1.5, unit: "PT" },
          },
        },
        fields: "shapeBackgroundFill.solidFill.color,outline.outlineFill.solidFill.color,outline.weight",
      },
    });
    addTextBox(requests, "snext_banner", sNext, 0.7, 1.35, CONTENT_W - 0.2, 0.42, truncateForSlide("✏️   Action required — Account Executive: All highlighted fields must be completed manually before sharing with the customer.", 130), {
      bold: true, fontSize: 14, colorRgb: hexToRgb("92400E"), fontFamily: FONT_BODY,
    });
    const steps = nextSteps.steps || [];
    const borderGrayRgbNext = hexToRgb("E5E7EB");
    const stepCardW = 6.02;
    const stepCardH = 2.1;
    const stepCardGap = 0.18;
    const stepStartY = 2.05;
    steps.forEach((step, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const xPos = 0.5 + col * (stepCardW + stepCardGap);
      const yPos = stepStartY + row * 2.3;
      requests.push(createRectRequest(`snext_card_bg_${i}`, sNext, xPos, yPos, stepCardW, stepCardH));
      requests.push({
        updateShapeProperties: {
          objectId: `snext_card_bg_${i}`,
          shapeProperties: {
            shapeBackgroundFill: { solidFill: { color: { rgbColor: whiteRgb }, alpha: 1 } },
            outline: {
              outlineFill: { solidFill: { color: { rgbColor: borderGrayRgbNext }, alpha: 1 } },
              weight: { magnitude: 0.75, unit: "PT" },
            },
          },
          fields: "shapeBackgroundFill.solidFill.color,outline.outlineFill.solidFill.color,outline.weight",
        },
      });
      requests.push(createRectRequest(`ellipse_snext_${i}`, sNext, xPos + 0.18, yPos + 0.18, 0.44, 0.44, "ELLIPSE"));
      requests.push({
        updateShapeProperties: {
          objectId: `ellipse_snext_${i}`,
          shapeProperties: {
            shapeBackgroundFill: {
              solidFill: { color: { rgbColor: blueRgb }, alpha: 1 },
            },
          },
          fields: "shapeBackgroundFill.solidFill.color",
        },
      });
      addTextBox(requests, `snext_num${i}`, sNext, xPos + 0.18, yPos + 0.18, 0.44, 0.44, step.num, {
        bold: true, fontSize: 18, colorRgb: whiteRgb, fontFamily: FONT_HEAD,
      });
      requests.push({
        updateParagraphStyle: {
          objectId: `snext_num${i}`,
          textRange: { type: "ALL" },
          style: { alignment: "CENTER" },
          fields: "alignment",
        },
      });
      const stepTitleText = truncateForSlide(step.title, 42);
      addTextBox(requests, `snext_t${i}`, sNext, xPos + 0.72, yPos + 0.2, stepCardW - 0.54, 0.4, stepTitleText, {
        bold: true, fontSize: 17, colorRgb: navyRgb, fontFamily: FONT_HEAD,
      });
      // Yellow highlight for [placeholder] in Next Steps titles (AE attention)
      const bracketRegexTitle = /\[[^\]]*\]/g;
      let titleMatch: RegExpExecArray | null;
      bracketRegexTitle.lastIndex = 0;
      while ((titleMatch = bracketRegexTitle.exec(stepTitleText)) !== null) {
        requests.push({
          updateTextStyle: {
            objectId: `snext_t${i}`,
            textRange: {
              type: "FIXED_RANGE" as const,
              startIndex: titleMatch.index,
              endIndex: titleMatch.index + titleMatch[0].length,
            },
            style: {
              backgroundColor: {
                opaqueColor: { rgbColor: hexToRgb("FEF08A") },
              },
            },
            fields: "backgroundColor.opaqueColor.rgbColor",
          },
        });
      }
      const stepBodyText = truncateForSlide(step.body, 140);
      addTextBox(requests, `snext_b${i}`, sNext, xPos + 0.18, yPos + 0.66, stepCardW - 0.36, stepCardH - 0.66, stepBodyText, {
        fontSize: 15, colorRgb: hexToRgb("374151"), fontFamily: FONT_BODY,
      });
      const bracketRegex = /\[[^\]]*\]/g;
      let match: RegExpExecArray | null;
      while ((match = bracketRegex.exec(stepBodyText)) !== null) {
        requests.push({
          updateTextStyle: {
            objectId: `snext_b${i}`,
            textRange: {
              type: "FIXED_RANGE" as const,
              startIndex: match.index,
              endIndex: match.index + match[0].length,
            },
            style: {
              backgroundColor: {
                opaqueColor: { rgbColor: hexToRgb("FEF08A") },
              },
            },
            fields: "backgroundColor.opaqueColor.rgbColor",
          },
        });
      }
    });
    slideIdx += 1;
  }
  }

  // ----- Case Studies: divider + image slides (subset has no divider, images start at slideIdx) -----
  if (isSubset) slideIdx = totalAppendixContentSlides;
  if ((!isSubset && caseStudyCount > 0 && caseStudySlideNums.length > 0) || (isSubset && caseStudySlideNums.length > 0)) {
    const sCaseDiv = !isSubset ? slides[slideIdx]?.objectId : undefined;
    if (sCaseDiv) {
      requests.push({
        updatePageProperties: {
          objectId: sCaseDiv,
          pageProperties: {
            pageBackgroundFill: {
              solidFill: { color: { rgbColor: navyRgb }, alpha: 1 },
            },
          },
          fields: "pageBackgroundFill",
        },
      });
      addTextBox(requests, "case_div_title", sCaseDiv, 0.5, 2.4, CONTENT_W, 0.5, "Case Studies", {
        bold: true, fontSize: 40, colorRgb: whiteRgb, fontFamily: FONT_HEAD,
      });
      addTextBox(requests, "case_div_sub", sCaseDiv, 0.5, 3.2, CONTENT_W, 0.3, "Success stories from the GVA Case Study Deck", {
        fontSize: 14, colorRgb: lightBlueRgb, fontFamily: FONT_BODY,
      });
    }
    const caseStudyOffset = isSubset ? 0 : 1;
    for (let i = 0; i < caseStudySlideNums.length; i++) {
      const slideNum = caseStudySlideNums[i];
      const caseSlide = slides[slideIdx + caseStudyOffset + i]?.objectId;
      if (!caseSlide) continue;

      let imageInserted = false;

      if (p.caseStudySourcePresentationId) {
        try {
          const srcPres = await fetch(
            `https://slides.googleapis.com/v1/presentations/${p.caseStudySourcePresentationId}?fields=slides.objectId`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (srcPres.ok) {
            const srcData = (await srcPres.json()) as { slides?: Array<{ objectId: string }> };
            const srcSlides = srcData.slides ?? [];
            const pageObjectId = srcSlides[slideNum - 1]?.objectId;

            if (pageObjectId) {
              const thumbRes = await fetch(
                `https://slides.googleapis.com/v1/presentations/${p.caseStudySourcePresentationId}/pages/${pageObjectId}/thumbnail?thumbnailProperties.mimeType=PNG&thumbnailProperties.thumbnailSize=LARGE`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
              );
              if (thumbRes.ok) {
                const thumbData = (await thumbRes.json()) as { contentUrl?: string };
                const contentUrl = thumbData.contentUrl;
                if (contentUrl) {
                  requests.push({
                    createImage: {
                      objectId: `case_img_${i}`,
                      url: contentUrl,
                      elementProperties: {
                        pageObjectId: caseSlide,
                        size: {
                          width: { magnitude: 720, unit: "PT" },     // 10" × 72pt (full canvas width)
                          height: { magnitude: 405.36, unit: "PT" }, // 5.63" × 72pt (full canvas height)
                        },
                        transform: {
                          scaleX: 1,
                          scaleY: 1,
                          translateX: 0,
                          translateY: 0,
                          unit: "PT",
                        },
                      },
                    },
                  });
                  imageInserted = true;
                }
              } else if (thumbRes.status === 401) {
                throw new Error("Google sign-in expired. Please sign out, sign in again with Google, then generate the report.");
              } else if (thumbRes.status === 403) {
                console.warn(`[Case studies] No access to slide ${slideNum} in source presentation. Ensure the source deck is shared with "Anyone with the link can view".`);
              }
            }
          } else if (srcPres.status === 401) {
            throw new Error("Google sign-in expired. Please sign out, sign in again with Google, then generate the report.");
          }
        } catch (err: unknown) {
          if (err instanceof Error && err.message.includes("sign-in")) throw err;
          console.warn(`[Case studies] Failed to load thumbnail for slide ${slideNum}:`, err);
        }
      }

      if (!imageInserted) {
        addTextBox(
          requests,
          `case_placeholder_${i}`,
          caseSlide,
          0.5, 1.5, 9.0, 1.2,
          `Case study slide ${slideNum} — Set VITE_CASE_STUDY_SOURCE_PRESENTATION_ID in .env to your GVA Case Study Deck ID (share with "Anyone with the link can view").`,
          { fontSize: 11, colorRgb: grayRgb, fontFamily: FONT_BODY }
        );
      }
    }
  }

  // ----- Appendix slides (subset: no divider, content starts at 0) -----
  const appendixSlides = p.appendixSlides ?? [];
  const appendixStartIndex = isSubset ? -1 : slideIdx + caseStudyCount;
  if (appendixSlides.length > 0 && !isSubset) {
    const sAppDiv = appendixStartIndex >= 0 ? slides[appendixStartIndex]?.objectId : undefined;
    if (sAppDiv) {
      requests.push({
        updatePageProperties: {
          objectId: sAppDiv,
          pageProperties: {
            pageBackgroundFill: {
              solidFill: { color: { rgbColor: navyRgb }, alpha: 1 },
            },
          },
          fields: "pageBackgroundFill",
        },
      });
      addTextBox(requests, "app_div_title", sAppDiv, 0.5, 2.2, CONTENT_W, 0.8, "Appendix", {
        bold: true, fontSize: 40, colorRgb: whiteRgb, fontFamily: FONT_HEAD,
      });
      addTextBox(requests, "app_div_sub", sAppDiv, 0.5, 3.1, CONTENT_W, 0.3, "Calculator Details & Methodology", {
        fontSize: 14, colorRgb: lightBlueRgb, fontFamily: FONT_BODY,
      });
    }
  }
  const appendixContentStartIndex = isSubset ? 0 : appendixStartIndex + (appendixSlides.length > 0 ? 1 : 0);
  let appendixContentSlideIndex = 0;
  for (let a = 0; a < appendixSlides.length; a++) {
    const app = appendixSlides[a];
    const tableRows = app.tableRows || [];
    const nonSectionRows = tableRows.filter((row) =>
      isAppendixCalculationRow((row.cells || []).slice(0, 5).map((c) => String(c ?? "")))
    );
    const pageCount = app.isTBD ? 1 : Math.max(1, Math.ceil(nonSectionRows.length / 12));

    // Subset (benefits modal "Generate slides"): put funnel visual first, same screenshot as full value report
    const funnelSlideData = (app as { funnelSlide?: { viewMode: string; totalTransactionAttempts: number; totalRecoverable: string; stages: Array<{ label: string; currentVal: string; recoverableVal: string }> } }).funnelSlide;
    if (isSubset && funnelSlideData) {
      const funnelSlide = slides[appendixContentStartIndex + appendixContentSlideIndex];
      if (funnelSlide?.objectId) {
        const visualB64 = (app as { visualImageBase64?: string }).visualImageBase64;
        if (visualB64) {
          const { url: visualUrl, fileId: visualFileId } = await uploadBase64ImageToDrive(
            accessToken,
            visualB64,
            `subset_funnel_${a}_${Date.now()}.png`
          );
          uploadedVisualImageIds.push(visualFileId);
          const pageNum = String(appendixContentStartIndex + appendixContentSlideIndex);
          addTextBox(requests, `sfunnel_subset_sec_${a}`, funnelSlide.objectId, 0.5, 0.15, 12.0, 0.2, truncateForSlide(`${titleSlide.customerName} x Forter Business Value Assessment`, 52), {
            bold: true, fontSize: 10, colorRgb: blueRgb, fontFamily: FONT_HEAD,
          });
          addTextBox(requests, `sfunnel_subset_title_${a}`, funnelSlide.objectId, 0.5, 0.35, CONTENT_W, 0.5, "How transactions flow — Payments funnel", {
            bold: true, fontSize: 16, colorRgb: navyRgb, fontFamily: FONT_HEAD,
          });
          addTextBox(requests, `sfunnel_subset_page_${a}`, funnelSlide.objectId, 0.28, FOOTER_Y, 1.0, 0.2, pageNum, {
            fontSize: 7.5, colorRgb: grayRgb, fontFamily: FONT_BODY,
          });
          addTextBox(requests, `sfunnel_subset_ft_${a}`, funnelSlide.objectId, 7.0, FOOTER_Y, 6.0, 0.2, "© Forter, Inc. All rights Reserved  |  Confidential", {
            fontSize: 7.5, colorRgb: grayRgb, fontFamily: FONT_BODY, alignment: "END",
          });
          requests.push(createImageRequest(`sfunnel_subset_img_${a}`, funnelSlide.objectId, 0.1, 0.80, 13.13, 5.95, visualUrl));
        } else {
          addTextBox(requests, `sfunnel_sec_${a}`, funnelSlide.objectId, 0.5, 0.15, 12.0, 0.2, truncateForSlide(`${titleSlide.customerName} x Forter Business Value Assessment`, 52), {
            bold: true, fontSize: 10, colorRgb: blueRgb, fontFamily: FONT_HEAD,
          });
          addTextBox(requests, `sfunnel_page_${a}`, funnelSlide.objectId, 0.28, FOOTER_Y, 1.0, 0.2, String(appendixContentStartIndex + appendixContentSlideIndex), {
            fontSize: 7.5, colorRgb: grayRgb, fontFamily: FONT_BODY,
          });
          addTextBox(requests, `sfunnel_ft_${a}`, funnelSlide.objectId, 7.0, FOOTER_Y, 6.0, 0.2, "© Forter, Inc. All rights Reserved  |  Confidential", {
            fontSize: 7.5, colorRgb: grayRgb, fontFamily: FONT_BODY, alignment: "END",
          });
          addTextBox(requests, `sfunnel_title_${a}`, funnelSlide.objectId, 0.5, 0.35, CONTENT_W, 0.5, "How transactions flow — Payments funnel", {
            bold: true, fontSize: 16, colorRgb: navyRgb, fontFamily: FONT_HEAD,
          });
          addTextBox(requests, `sfunnel_view_${a}`, funnelSlide.objectId, 10.5, 0.35, 2.0, 0.25, funnelSlideData.viewMode === "transactions" ? "# of transactions" : "% of attempts", {
            fontSize: 9, colorRgb: grayRgb, fontFamily: FONT_BODY,
          });
          const rowH = 0.38;
          let y = 0.95;
          addTextBox(requests, `sfunnel_col1_${a}`, funnelSlide.objectId, 0.5, y, 7.0, 0.22, "Stage", { bold: true, fontSize: 9, colorRgb: navyRgb, fontFamily: FONT_HEAD });
          addTextBox(requests, `sfunnel_col2_${a}`, funnelSlide.objectId, 7.2, y, 2.8, 0.22, "Current state", { bold: true, fontSize: 9, colorRgb: navyRgb, fontFamily: FONT_HEAD });
          addTextBox(requests, `sfunnel_col3_${a}`, funnelSlide.objectId, 10.0, y, 2.5, 0.22, "Forter recoverable", { bold: true, fontSize: 9, colorRgb: navyRgb, fontFamily: FONT_HEAD });
          y += rowH;
          const funnelStages = funnelSlideData.stages || [];
          for (let i = 0; i < funnelStages.length; i++) {
            const row = funnelStages[i];
            addTextBox(requests, `sfunnel_r${a}_${i}_l`, funnelSlide.objectId, 0.5, y, 7.0, 0.28, truncateForSlide(row.label, 32), { fontSize: 9, colorRgb: grayRgb, fontFamily: FONT_BODY });
            addTextBox(requests, `sfunnel_r${a}_${i}_c`, funnelSlide.objectId, 7.2, y, 2.8, 0.28, row.currentVal, { fontSize: 9, colorRgb: navyRgb, fontFamily: FONT_BODY, alignment: "END" });
            addTextBox(requests, `sfunnel_r${a}_${i}_r`, funnelSlide.objectId, 10.0, y, 2.5, 0.28, row.recoverableVal, { fontSize: 9, colorRgb: blueRgb, fontFamily: FONT_BODY, alignment: "END" });
            y += rowH;
          }
        }
        appendixContentSlideIndex++;
      }
    }

    for (let pageIdx = 0; pageIdx < pageCount; pageIdx++) {
      const slide = slides[appendixContentStartIndex + appendixContentSlideIndex];
      if (!slide?.objectId) {
        appendixContentSlideIndex++;
        continue;
      }
      const pageLabel = pageCount > 1 ? ` (Page ${pageIdx + 1} of ${pageCount})` : "";
      const pageNum = isSubset ? String(appendixContentStartIndex + appendixContentSlideIndex) : String(slideIdx + caseStudyCount + 1 + appendixContentSlideIndex);
      addTextBox(requests, `sapp_sec_${a}_${pageIdx}`, slide.objectId, 0.5, 0.15, 12.0, 0.2, truncateForSlide(`${titleSlide.customerName} x Forter Business Value Assessment`, 52), {
        bold: true, fontSize: 10, colorRgb: blueRgb, fontFamily: FONT_HEAD,
      });
      addTextBox(requests, `sapp_page_${a}_${pageIdx}`, slide.objectId, 0.28, FOOTER_Y, 1.0, 0.2, pageNum, {
        fontSize: 7.5, colorRgb: grayRgb, fontFamily: FONT_BODY,
      });
      addTextBox(requests, `sapp_ft_${a}_${pageIdx}`, slide.objectId, 7.0, FOOTER_Y, 6.0, 0.2, "© Forter, Inc. All rights Reserved  |  Confidential", {
        fontSize: 7.5, colorRgb: grayRgb, fontFamily: FONT_BODY, alignment: "END",
      });
      addTextBox(requests, `sapp_title_${a}_${pageIdx}`, slide.objectId, 0.5, 0.35, CONTENT_W, 0.42, truncateForSlide(app.title, 55) + pageLabel, {
        bold: true, fontSize: 16, colorRgb: navyRgb, fontFamily: FONT_HEAD,
      });
      if (pageIdx === 0 && (app as { badge?: string }).badge) {
        const appBadge = (app as { badge?: string }).badge;
        const badgeColors: Record<string, { bg: string; text: string }> = {
          "GMV Uplift": { bg: "DBEAFE", text: "1D4ED8" },
          "Cost Reduction": { bg: "FEF3C7", text: "92400E" },
          "Risk Mitigation": { bg: "FCE7F3", text: "9D174D" },
        };
        const bc = appBadge ? badgeColors[appBadge] : undefined;
        if (bc) {
          const lightBorderRgb = hexToRgb("E8EAED");
          const badgeH = 0.56;
          requests.push(createRectRequest(`sapp_badge_bg_${a}`, slide.objectId, 10.8, 0.08, 1.9, badgeH));
          requests.push({
            updateShapeProperties: {
              objectId: `sapp_badge_bg_${a}`,
              shapeProperties: {
                shapeBackgroundFill: { solidFill: { color: { rgbColor: hexToRgb(bc.bg) }, alpha: 1 } },
                outline: {
                  outlineFill: { solidFill: { color: { rgbColor: lightBorderRgb } } },
                  weight: { magnitude: 0.5, unit: "PT" },
                },
              },
              fields: "shapeBackgroundFill.solidFill.color,outline.outlineFill.solidFill.color,outline.weight",
            },
          });
          addTextBox(requests, `sapp_badge_txt_${a}`, slide.objectId, 10.8, 0.08 + (badgeH - 0.2) / 2, 1.9, 0.2, appBadge, {
            bold: true, fontSize: 9, colorRgb: hexToRgb(bc.text), fontFamily: FONT_HEAD, alignment: "CENTER",
          });
          requests.push({
            updateParagraphStyle: {
              objectId: `sapp_badge_txt_${a}`,
              textRange: { type: "ALL" },
              style: { alignment: "CENTER" },
              fields: "alignment",
            },
          });
        }
      }
      if (app.isTBD) {
        if (pageIdx === 0) {
          addTextBox(requests, `sapp_ch_h_${a}`, slide.objectId, 0.5, 1.0, CONTENT_W, 0.25, "The Challenge", {
            bold: true, fontSize: 12, colorRgb: navyRgb, fontFamily: FONT_HEAD,
          });
          addTextBox(requests, `sapp_ch_${a}`, slide.objectId, 0.5, 1.28, CONTENT_W, 0.9, truncateForSlide(app.problem, 120), {
            fontSize: 9, colorRgb: grayRgb, fontFamily: FONT_BODY,
          });
          addTextBox(requests, `sapp_sol_h_${a}`, slide.objectId, 0.5, 2.3, CONTENT_W, 0.25, "The Forter Solution", {
            bold: true, fontSize: 12, colorRgb: blueRgb, fontFamily: FONT_HEAD,
          });
          addTextBox(requests, `sapp_sol_${a}`, slide.objectId, 0.5, 2.58, CONTENT_W, 0.8, truncateForSlide(app.solution, 120), {
            fontSize: 9, colorRgb: grayRgb, fontFamily: FONT_BODY,
          });
          addTextBox(requests, `sapp_tbd_${a}`, slide.objectId, 0.5, 7.5 - 0.4, CONTENT_W, 0.25, "Complete the customer inputs to generate detailed value calculations for this benefit.", {
            fontSize: 9, colorRgb: grayRgb, fontFamily: FONT_BODY,
          });
        }
      } else {
        if (pageIdx === 0) {
          addTextBox(requests, `sapp_sub_${a}`, slide.objectId, 0.5, 0.80, CONTENT_W, 0.52, app.solution ?? "", {
            fontSize: 10, colorRgb: grayRgb, fontFamily: FONT_BODY,
          });
        }
        const pageRows = nonSectionRows.slice(pageIdx * 12, pageIdx * 12 + 12);
        if (pageRows.length > 0) {
          const rows = 1 + pageRows.length;
          const tableId = `table_app_${a}_${pageIdx}`;
        requests.push({
          createTable: {
            objectId: tableId,
            elementProperties: {
              pageObjectId: slide.objectId,
              size: {
                width: { magnitude: inchToPt(12.33 * SX), unit: "PT" },
                height: { magnitude: inchToPt(5.0 * SY), unit: "PT" },
              },
              transform: {
                scaleX: 1,
                scaleY: 1,
                translateX: inchToPt(0.5 * SX),
                translateY: inchToPt(1.38 * SY),
                unit: "PT",
              },
            },
            rows,
            columns: 5,
          },
        });
        requests.push({
          updateTableCellProperties: {
            objectId: tableId,
            tableRange: { location: { rowIndex: 0, columnIndex: 0 }, rowSpan: rows, columnSpan: 5 },
            tableCellProperties: {
              tableCellBackgroundFill: { solidFill: { color: { rgbColor: hexToRgb("FFFFFF") }, alpha: 1 } },
            },
            fields: "tableCellBackgroundFill.solidFill.color",
          },
        });
        const appColWidths = [1.07, 4.07, 1.97, 1.97, 3.25];
        appColWidths.forEach((w, c) => {
          requests.push({
            updateTableColumnProperties: {
              objectId: tableId,
              columnIndices: [c],
              tableColumnProperties: { columnWidth: { magnitude: inchToPt(w * SX), unit: "PT" } },
              fields: "columnWidth",
            },
          });
        });
        const appRowIndices = Array.from({ length: rows }, (_, i) => i);
        requests.push({
          updateTableRowProperties: {
            objectId: tableId,
            rowIndices: appRowIndices,
            tableRowProperties: { minRowHeight: { magnitude: inchToPt(0.15 * SY), unit: "PT" } },
            fields: "minRowHeight",
          },
        });
        const headerCells = ["Formula", "Description", "Customer Inputs", "Forter Improvement", "Forter Outcome"];
        headerCells.forEach((cell, c) => {
          requests.push({
            insertText: {
              objectId: tableId,
              cellLocation: { rowIndex: 0, columnIndex: c },
              insertionIndex: 0,
              text: cell,
            },
          });
        });
        const ZWSP = "\u200B";
        pageRows.forEach((row, r) => {
          const cells = (row.cells || []).slice(0, 5).map((c) => String(c ?? ""));
          for (let c = 0; c < 5; c++) {
            let cellText = (cells[c] ?? "").trim();
            // Forter Improvement: show negative numbers as (value) instead of -value
            if (c === 3 && cellText && cellText.startsWith("-")) {
              cellText = "(" + cellText.slice(1) + ")";
            }
            requests.push({
              insertText: {
                objectId: tableId,
                cellLocation: { rowIndex: r + 1, columnIndex: c },
                insertionIndex: 0,
                text: cellText || ZWSP,
              },
            });
          }
        });
        requests.push({
          updateTableCellProperties: {
            objectId: tableId,
            tableRange: { location: { rowIndex: 0, columnIndex: 0 }, rowSpan: 1, columnSpan: 5 },
            tableCellProperties: {
              tableCellBackgroundFill: {
                solidFill: { color: { rgbColor: navyRgb }, alpha: 1 },
              },
            },
            fields: "tableCellBackgroundFill.solidFill.color",
          },
        });
        headerCells.forEach((label, colIdx) => {
          if (!String(label).trim()) return;
          requests.push({
            updateTextStyle: {
              objectId: tableId,
              cellLocation: { rowIndex: 0, columnIndex: colIdx },
              textRange: { type: "ALL" },
              style: { bold: true, fontSize: { magnitude: 7, unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: whiteRgb } }, fontFamily: FONT_BODY },
              fields: "bold,fontSize,foregroundColor,fontFamily",
            },
          });
        });
        const appendixFontPt = 7;
        pageRows.forEach((row, r) => {
          const cells = (row.cells || []).slice(0, 5).map((c) => String(c ?? ""));
          const desc = (cells[1] ?? "").toLowerCase();
          const formulaCell = (cells[0] ?? "").trim();
          const isSubtotalRow = /deduplicated|net sales|ebitda contribution|total|subtotal/i.test(desc);
          const isCalculationRow = formulaCell.includes("=") && !isSubtotalRow;
          const boldOutcome = isCalculationRow || isSubtotalRow;
          const impVal = cells[3] ?? "";
          const impDisplayVal = impVal.trim().startsWith("-") ? "(" + impVal.trim().slice(1) + ")" : impVal;
          for (let c = 0; c < 5; c++) {
            const cellText = (cells[c] ?? "").trim();
            const isFormula = c === 0;
            const isImprovement = c === 3;
            const isOutcome = c === 4;
            const impIsNeg = impVal.startsWith("-") || impVal.startsWith("(");
            if (isFormula) {
              requests.push({
                updateTextStyle: {
                  objectId: tableId,
                  cellLocation: { rowIndex: r + 1, columnIndex: c },
                  textRange: { type: "ALL" },
                  style: {
                    fontSize: { magnitude: appendixFontPt, unit: "PT" },
                    foregroundColor: { opaqueColor: { rgbColor: hexToRgb(GRAY) } },
                    fontFamily: FONT_BODY,
                  },
                  fields: "fontSize,foregroundColor,fontFamily",
                },
              });
            } else if (isImprovement && cellText) {
              requests.push({
                updateTextStyle: {
                  objectId: tableId,
                  cellLocation: { rowIndex: r + 1, columnIndex: c },
                  textRange: { type: "ALL" },
                  style: {
                    bold: true,
                    fontSize: { magnitude: appendixFontPt, unit: "PT" },
                    foregroundColor: {
                      opaqueColor: { rgbColor: impIsNeg ? hexToRgb(RED) : hexToRgb(GREEN) },
                    },
                    fontFamily: FONT_BODY,
                  },
                  fields: "bold,fontSize,foregroundColor,fontFamily",
                },
              });
              safeParagraphAlign(requests, tableId, r + 1, 3, "END", impDisplayVal);
            } else if (isOutcome && cellText) {
              requests.push({
                updateTextStyle: {
                  objectId: tableId,
                  cellLocation: { rowIndex: r + 1, columnIndex: c },
                  textRange: { type: "ALL" },
                  style: {
                    bold: boldOutcome,
                    fontSize: { magnitude: appendixFontPt, unit: "PT" },
                    foregroundColor: { opaqueColor: { rgbColor: navyRgb } },
                    fontFamily: FONT_BODY,
                  },
                  fields: "bold,fontSize,foregroundColor,fontFamily",
                },
              });
              safeParagraphAlign(requests, tableId, r + 1, 4, "END", cells[4]);
            } else {
              requests.push({
                updateTextStyle: {
                  objectId: tableId,
                  cellLocation: { rowIndex: r + 1, columnIndex: c },
                  textRange: { type: "ALL" },
                  style: {
                    fontSize: { magnitude: appendixFontPt, unit: "PT" },
                    fontFamily: FONT_BODY,
                  },
                  fields: "fontSize,fontFamily",
                },
              });
              if (c === 2 && cellText) safeParagraphAlign(requests, tableId, r + 1, 2, "END", cells[2]);
            }
          }
        });
        const appendixSubtotalGreenRgb = hexToRgb("D6EFD8");
        const appendixCalcRowRgb = hexToRgb("F3F4F6");
        pageRows.forEach((row, r) => {
          const cells = (row.cells || []).slice(0, 5).map((c) => String(c ?? ""));
          const desc = (cells[1] ?? "").toLowerCase();
          const formulaCell = (cells[0] ?? "").trim();
          const isSubtotalRow = /deduplicated|net sales|ebitda contribution|total|subtotal/i.test(desc);
          const isCalculationRow = formulaCell.includes("=") && !isSubtotalRow;
          for (let c = 0; c < 5; c++) {
            if (isCalculationRow) {
              requests.push({
                updateTableCellProperties: {
                  objectId: tableId,
                  tableRange: { location: { rowIndex: r + 1, columnIndex: c }, rowSpan: 1, columnSpan: 1 },
                  tableCellProperties: {
                    tableCellBackgroundFill: { solidFill: { color: { rgbColor: appendixCalcRowRgb }, alpha: 1 } },
                  },
                  fields: "tableCellBackgroundFill.solidFill.color",
                },
              });
              requests.push({
                updateTextStyle: {
                  objectId: tableId,
                  cellLocation: { rowIndex: r + 1, columnIndex: c },
                  textRange: { type: "ALL" },
                  style: { bold: true, fontSize: { magnitude: appendixFontPt, unit: "PT" }, fontFamily: FONT_BODY },
                  fields: "bold,fontSize,fontFamily",
                },
              });
            }
            if (isSubtotalRow) {
              requests.push({
                updateTableCellProperties: {
                  objectId: tableId,
                  tableRange: { location: { rowIndex: r + 1, columnIndex: c }, rowSpan: 1, columnSpan: 1 },
                  tableCellProperties: {
                    tableCellBackgroundFill: { solidFill: { color: { rgbColor: appendixSubtotalGreenRgb }, alpha: 1 } },
                  },
                  fields: "tableCellBackgroundFill.solidFill.color",
                },
              });
            }
            requests.push({
              updateTableCellProperties: {
                objectId: tableId,
                tableRange: { location: { rowIndex: r + 1, columnIndex: c }, rowSpan: 1, columnSpan: 1 },
                tableCellProperties: { contentAlignment: "MIDDLE" },
                fields: "contentAlignment",
              },
            });
          }
        });
        }
      }
      appendixContentSlideIndex++;
    }
    // Full deck only: funnel after calculator. Subset renders funnel first (above) and uses screenshot when available.
    const funnelSlideDataAfterCalc = (app as { funnelSlide?: { viewMode: string; totalTransactionAttempts: number; totalRecoverable: string; stages: Array<{ label: string; currentVal: string; recoverableVal: string }> } }).funnelSlide;
    if (!isSubset && funnelSlideDataAfterCalc) {
      const slide = slides[appendixContentStartIndex + appendixContentSlideIndex];
      if (slide?.objectId) {
        const pageNum = String(slideIdx + caseStudyCount + 1 + appendixContentSlideIndex);
        addTextBox(requests, `sfunnel_sec_${a}`, slide.objectId, 0.5, 0.15, 12.0, 0.2, truncateForSlide(`${titleSlide.customerName} x Forter Business Value Assessment`, 52), {
          bold: true, fontSize: 10, colorRgb: blueRgb, fontFamily: FONT_HEAD,
        });
        addTextBox(requests, `sfunnel_page_${a}`, slide.objectId, 0.28, FOOTER_Y, 1.0, 0.2, pageNum, {
          fontSize: 7.5, colorRgb: grayRgb, fontFamily: FONT_BODY,
        });
        addTextBox(requests, `sfunnel_ft_${a}`, slide.objectId, 7.0, FOOTER_Y, 6.0, 0.2, "© Forter, Inc. All rights Reserved  |  Confidential", {
          fontSize: 7.5, colorRgb: grayRgb, fontFamily: FONT_BODY, alignment: "END",
        });
        addTextBox(requests, `sfunnel_title_${a}`, slide.objectId, 0.5, 0.35, CONTENT_W, 0.5, "How transactions flow — Payments funnel", {
          bold: true, fontSize: 16, colorRgb: navyRgb, fontFamily: FONT_HEAD,
        });
        addTextBox(requests, `sfunnel_view_${a}`, slide.objectId, 10.5, 0.35, 2.0, 0.25, funnelSlideDataAfterCalc.viewMode === "transactions" ? "# of transactions" : "% of attempts", {
          fontSize: 9, colorRgb: grayRgb, fontFamily: FONT_BODY,
        });
        const funnelStages = funnelSlideDataAfterCalc.stages || [];
        const rowH = 0.38;
        let y = 0.95;
        addTextBox(requests, `sfunnel_col1_${a}`, slide.objectId, 0.5, y, 7.0, 0.22, "Stage", { bold: true, fontSize: 9, colorRgb: navyRgb, fontFamily: FONT_HEAD });
        addTextBox(requests, `sfunnel_col2_${a}`, slide.objectId, 7.2, y, 2.8, 0.22, "Current state", { bold: true, fontSize: 9, colorRgb: navyRgb, fontFamily: FONT_HEAD });
        addTextBox(requests, `sfunnel_col3_${a}`, slide.objectId, 10.0, y, 2.5, 0.22, "Forter recoverable", { bold: true, fontSize: 9, colorRgb: navyRgb, fontFamily: FONT_HEAD });
        y += rowH;
        for (let i = 0; i < funnelStages.length; i++) {
          const row = funnelStages[i];
          addTextBox(requests, `sfunnel_r${a}_${i}_l`, slide.objectId, 0.5, y, 7.0, 0.28, truncateForSlide(row.label, 32), { fontSize: 9, colorRgb: grayRgb, fontFamily: FONT_BODY });
          addTextBox(requests, `sfunnel_r${a}_${i}_c`, slide.objectId, 7.2, y, 2.8, 0.28, row.currentVal, { fontSize: 9, colorRgb: navyRgb, fontFamily: FONT_BODY, alignment: "END" });
          addTextBox(requests, `sfunnel_r${a}_${i}_r`, slide.objectId, 10.0, y, 2.5, 0.28, row.recoverableVal, { fontSize: 9, colorRgb: blueRgb, fontFamily: FONT_BODY, alignment: "END" });
          y += rowH;
        }
        appendixContentSlideIndex++;
      }
    }
    // Visuals are in "Value Proposition Insights" section (full deck), not in appendix
  }

  // Full deck: last slide = GVA Case Study Deck last slide (when caseStudySourcePresentationId is set)
  if (!isSubset && p.caseStudySourcePresentationId && slides.length > 0) {
    const lastSlideObjectId = slides[slides.length - 1]?.objectId;
    if (lastSlideObjectId) {
      try {
        const srcPresRes = await fetch(
          `https://slides.googleapis.com/v1/presentations/${p.caseStudySourcePresentationId}?fields=slides.objectId`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (srcPresRes.ok) {
          const srcData = (await srcPresRes.json()) as { slides?: Array<{ objectId: string }> };
          const srcSlides = srcData.slides ?? [];
          const gvaLastSlide = srcSlides.length > 0 ? srcSlides[srcSlides.length - 1] : undefined;
          if (gvaLastSlide?.objectId) {
            const thumbRes = await fetch(
              `https://slides.googleapis.com/v1/presentations/${p.caseStudySourcePresentationId}/pages/${gvaLastSlide.objectId}/thumbnail?thumbnailProperties.mimeType=PNG&thumbnailProperties.thumbnailSize=LARGE`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (thumbRes.ok) {
              const thumbData = (await thumbRes.json()) as { contentUrl?: string };
              if (thumbData.contentUrl) {
                requests.push({
                  createImage: {
                    objectId: "deck_closing_slide_image",
                    url: thumbData.contentUrl,
                    elementProperties: {
                      pageObjectId: lastSlideObjectId,
                      size: {
                        width: { magnitude: 720, unit: "PT" },
                        height: { magnitude: 405.36, unit: "PT" },
                      },
                      transform: {
                        scaleX: 1,
                        scaleY: 1,
                        translateX: 0,
                        translateY: 0,
                        unit: "PT",
                      },
                    },
                  },
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn("[Value deck] Failed to add GVA last slide as closing slide:", err);
      }
    }
  }

  if (requests.length > 0) {
    batchRes = await fetch(
      `https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requests }),
      }
    );
    if (!batchRes.ok) {
      const responseText = await batchRes.text();
      // Log full API response so console shows exact rejection reason
      console.error("[Google Slides API] batchUpdate failed. Full response:", responseText);
      let errMsg = `Slides batchUpdate failed: ${batchRes.status}`;
      try {
        const json = JSON.parse(responseText) as {
          error?: { message?: string; status?: string; details?: Array<{ message?: string; reason?: string }> };
        };
        if (json?.error?.message) errMsg += ` — ${json.error.message}`;
        if (json?.error?.details?.length) {
          const detail = json.error.details[0];
          if (detail?.message) errMsg += ` (${detail.message})`;
        }
        if (!json?.error?.message && responseText) errMsg += ` — ${responseText.slice(0, 500)}`;
      } catch {
        if (responseText) errMsg += ` — ${responseText.slice(0, 500)}`;
      }
      throw new Error(errMsg);
    }
  }

  if (uploadedVisualImageIds.length > 0) {
    Promise.all(uploadedVisualImageIds.map((id) => deleteDriveFile(accessToken, id))).catch((e) =>
      console.warn("[Visual cleanup] Failed to delete temp Drive images:", e)
    );
  }
}
