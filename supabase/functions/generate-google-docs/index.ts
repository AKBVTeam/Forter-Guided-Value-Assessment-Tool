import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DRIVE_FOLDER_ID = "1YJYslxbkg1H_L_579wesIlaWaJfz4nK1";

function formatDateDDMMYYYY(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function fileName(clientName: string): string {
  return `Forter Value Assessment - ${clientName} - ${formatDateDDMMYYYY()}`;
}

async function driveCreateFile(
  accessToken: string,
  name: string,
  mimeType: string
): Promise<{ id: string }> {
  const res = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      parents: [DRIVE_FOLDER_ID],
      mimeType,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive create failed: ${res.status} ${err}`);
  }
  return res.json();
}

async function buildGoogleDoc(
  accessToken: string,
  docId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const p = payload as {
    analysisName?: string;
    headline?: string;
    opportunityStatement?: string;
    strategicAlignment?: { objectives: Array<{ name: string; description: string }>; useCases: Array<{ name: string }> } | null;
    problemStatement?: string[] | null;
    recommendedApproach?: { solutions: string[]; outcomesTable: Array<{ metric: string; current: string; target: string }> };
    investment?: Array<{ label: string; val: string }> | null;
    projectedValue?: { rows: Array<{ label: string; val: string }>; nextSteps: string[] } | null;
    valueDrivers?: Array<{ label: string; value: string }>;
  };
  const requests: Record<string, unknown>[] = [];
  let index = 1;

  const insert = (text: string): void => {
    requests.push({
      insertText: {
        location: { index },
        text: text + "\n",
      },
    });
    index += (text + "\n").length;
  };

  const analysisName = p.analysisName ?? "Value Assessment";
  const headline = p.headline ?? "";
  const opportunityStatement = p.opportunityStatement ?? "";

  insert("EXECUTIVE SUMMARY");
  insert("");
  insert(`VALUE ASSESSMENT  ·  ${analysisName}`);
  insert("");
  insert(headline);
  insert("");
  insert("Developed by:  [Champion Name], [Key Deal Players]");
  insert("");
  insert("HEADLINE");
  insert(opportunityStatement);
  insert("");

  if (p.strategicAlignment?.objectives?.length) {
    insert("STRATEGIC ALIGNMENT");
    insert("This initiative directly supports key strategic priorities:");
    for (const obj of p.strategicAlignment.objectives) {
      insert(`→  ${obj.name}: ${obj.description}`);
    }
    if (p.strategicAlignment.useCases?.length) {
      insert("TARGETED USE CASES");
      for (const uc of p.strategicAlignment.useCases) {
        insert(`→  ${uc.name}`);
      }
    }
    insert("");
  } else if (p.problemStatement?.length) {
    insert("THE PROBLEM STATEMENT");
    insert("This initiative addresses the following high-priority challenges:");
    for (const item of p.problemStatement) {
      insert(`→  ${item}`);
    }
    insert("");
  }

  const recApproach = p.recommendedApproach ?? { solutions: [], outcomesTable: [] };
  insert("RECOMMENDED APPROACH");
  (recApproach.solutions || []).forEach((s: string, i: number) => {
    insert(`${i + 1}.  ${s}`);
  });
  insert("Forter was found to meet and exceed all requirements for this solution.");
  insert("");
  insert("KEY METRICS — TARGET OUTCOMES");
  const rows = recApproach.outcomesTable ?? [];
  const tableText = ["Key Metric\tCurrent Measure\tTarget with Forter"].concat(
    rows.map((r: { metric: string; current: string; target: string }) => `${r.metric}\t${r.current}\t${r.target}`)
  ).join("\n");
  insert(tableText);
  insert("");

  if (p.valueDrivers?.length) {
    insert("VALUE DRIVERS — FINANCIAL IMPACT");
    for (const row of p.valueDrivers) {
      insert(`${row.label}\t${row.value}`);
    }
    insert("");
  }

  if (p.investment?.length) {
    insert("REQUIRED INVESTMENT");
    for (const row of p.investment) {
      insert(`${row.label}\t${row.val}`);
    }
    insert("");
  }
  if (p.projectedValue) {
    insert("PROJECTED VALUE");
    for (const row of p.projectedValue.rows ?? []) {
      insert(`${row.label}\t${row.val}`);
    }
    insert("");
    insert("NEXT STEPS");
    (p.projectedValue.nextSteps ?? []).forEach((s: string, i: number) => {
      insert(`${i + 1}.  ${s}`);
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

async function buildGoogleSlides(
  accessToken: string,
  presentationId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const p = payload as {
    titleSlide: { customerName: string; headline: string; date: string };
    executiveSlide: { problems: string[]; solutions: string[]; valueCategories: Array<{ label: string; sub: string; val: string }>; ebitda: string; roiMetrics: Array<{ label: string; val: string }> };
    valueSummarySlide: { categories: Array<{ label: string; value: string; items: Array<{ label: string; value: number }> }>; ebitda: string; kpis: Array<{ metric: string; current: string; target: string; improvement?: string }> };
    valueDriversSlide: { rows: Array<{ label: string; value: string }> };
    targetOutcomesSlide: { rows: Array<{ metric: string; current: string; target: string; improvement: string }> };
    roiSlide: { metrics: Array<{ label: string; value: string }>; yearTable: Array<{ year: number; grossEBITDA: string; forterCost: string; netEBITDA: string }>; totalRow: { grossEBITDA: string; forterCost: string; netEBITDA: string } } | null;
    nextStepsSlide: { steps: Array<{ num: string; title: string; body: string }> };
    appendixSlides: Array<{ title: string; problem: string; solution: string; benefit: string; isTBD: boolean; tableRows: Array<{ cells: string[] }> }>;
  };

  const getPres = await fetch(
    `https://slides.googleapis.com/v1/presentations/${presentationId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!getPres.ok) throw new Error("Failed to get presentation");
  const pres = await getPres.json();
  const defaultSlideId = pres.slides?.[0]?.objectId;

  const requests: Record<string, unknown>[] = [];
  if (defaultSlideId) {
    requests.push({ deleteObject: { objectId: defaultSlideId } });
  }

  // Use TITLE_AND_BODY so every slide has title + body placeholders for insertText
  const slideCount =
    1 + 1 + 1 + 1 + 1 + (p.roiSlide ? 1 : 0) + 1 + (p.appendixSlides?.length ?? 0);
  for (let i = 0; i < slideCount; i++) {
    requests.push({
      createSlide: {
        insertionIndex: i,
        slideLayoutReference: { predefinedLayout: "TITLE_AND_BODY" },
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
      body: JSON.stringify({ requests }),
    }
  );
  if (!batchRes.ok) {
    const err = await batchRes.text();
    throw new Error(`Slides batchUpdate create failed: ${batchRes.status} ${err}`);
  }

  const getPres2 = await fetch(
    `https://slides.googleapis.com/v1/presentations/${presentationId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const pres2 = await getPres2.json();
  const slides = pres2.slides || [];

  type PageEl = { objectId: string; transform?: { translateX?: number; translateY?: number }; shape?: { text?: unknown; placeholder?: { type?: string } } };
  const getTextIds = (slide: { pageElements?: PageEl[] }) => {
    const el = slide.pageElements || [];
    const textShapes = el.filter((e) => e.shape?.text) as PageEl[];
    const titlePlaceholder = textShapes.find((e) => e.shape?.placeholder?.type === "TITLE");
    const bodyPlaceholder = textShapes.find((e) => e.shape?.placeholder?.type === "BODY");
    return {
      titleId: titlePlaceholder?.objectId ?? textShapes[0]?.objectId,
      bodyId: bodyPlaceholder?.objectId ?? textShapes[1]?.objectId,
    };
  };

  const insertRequests: Record<string, unknown>[] = [];
  let slideIdx = 0;

  const addSlideText = (title: string, body: string): void => {
    const slide = slides[slideIdx];
    if (!slide) return;
    const { titleId, bodyId } = getTextIds(slide);
    if (titleId) insertRequests.push({ insertText: { objectId: titleId, insertionIndex: 0, text: title } });
    if (bodyId) insertRequests.push({ insertText: { objectId: bodyId, insertionIndex: 0, text: body } });
    slideIdx++;
  };

  const titleSlide = p.titleSlide ?? { customerName: "Customer", headline: "", date: formatDateDDMMYYYY() };
  addSlideText(
    titleSlide.customerName,
    `${titleSlide.customerName} x Forter Business Value Assessment\n${titleSlide.headline}\n${titleSlide.date}`
  );

  const execSlide = p.executiveSlide ?? { problems: [], solutions: [], valueCategories: [], ebitda: "", roiMetrics: [] };
  addSlideText(
    "Executive Summary",
    [
      "Key headline:",
      titleSlide.headline || "—",
      "",
      "Key Challenges:",
      ...(execSlide.problems || []).map((x: string) => `→ ${x}`),
      "Recommended Approach:",
      ...(execSlide.solutions || []).map((x: string) => `→ ${x}`),
      "Value at Stake:",
      ...(execSlide.valueCategories || []).map((c: { label: string; val: string }) => `${c.label}: ${c.val}`),
      execSlide.ebitda ? `Annual EBITDA Contribution: ${execSlide.ebitda}` : "",
      ...(execSlide.roiMetrics || []).map((m: { label: string; val: string }) => `${m.label}: ${m.val}`),
    ].filter(Boolean).join("\n")
  );

  const valueSummary = p.valueSummarySlide ?? { categories: [], ebitda: "", kpis: [] };
  addSlideText(
    "Value Summary",
    [
      "Total annual economic benefit:",
      valueSummary.ebitda ? `Annual EBITDA: ${valueSummary.ebitda}` : "—",
      "",
      ...(valueSummary.categories || []).map((c: { label: string; value: string }) => `${c.label}: ${c.value}`),
      "Key metrics:",
      ...(valueSummary.kpis || []).slice(0, 5).map((k: { metric: string; current: string; target: string; improvement?: string }) => `${k.metric}: ${k.current} → ${k.target} (${k.improvement ?? ""})`),
    ].filter(Boolean).join("\n")
  );

  const valueDrivers = p.valueDriversSlide ?? { rows: [] };
  addSlideText(
    "Value Drivers",
    (valueDrivers.rows || []).map((r: { label: string; value: string }) => `${r.label}: ${r.value}`).join("\n")
  );

  const targetOutcomes = p.targetOutcomesSlide ?? { rows: [] };
  addSlideText(
    "Target Outcomes",
    (targetOutcomes.rows || []).map((r: { metric: string; current: string; target: string; improvement: string }) => `${r.metric}\t${r.current}\t${r.target}\t${r.improvement}`).join("\n")
  );
  if (p.roiSlide) {
    addSlideText(
      "ROI Summary",
      [
        ...p.roiSlide.metrics.map((m: { label: string; value: string }) => `${m.label}: ${m.value}`),
        "Year\tGross EBITDA\tForter Cost\tNet EBITDA",
        ...p.roiSlide.yearTable.map((y: { year: number; grossEBITDA: string; forterCost: string; netEBITDA: string }) => `Year ${y.year}\t${y.grossEBITDA}\t${y.forterCost}\t${y.netEBITDA}`),
        `Total\t${p.roiSlide.totalRow.grossEBITDA}\t${p.roiSlide.totalRow.forterCost}\t${p.roiSlide.totalRow.netEBITDA}`,
      ].join("\n")
    );
  }

  const nextSteps = p.nextStepsSlide ?? { steps: [] };
  addSlideText(
    "Next Steps",
    (nextSteps.steps || []).map((s: { num: string; title: string; body: string }) => `${s.num}. ${s.title}\n${s.body}`).join("\n\n")
  );
  for (const app of p.appendixSlides ?? []) {
    const body = app.isTBD
      ? `The Challenge\n${app.problem}\n\nThe Forter Solution\n${app.solution}\n\nComplete the customer inputs to generate detailed value calculations.`
      : [app.problem, app.solution, app.benefit].join("\n\n") + "\n\n" + app.tableRows.map((r) => r.cells.join("\t")).join("\n");
    addSlideText(app.title, body);
  }

  if (insertRequests.length > 0) {
    batchRes = await fetch(
      `https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requests: insertRequests }),
      }
    );
    if (!batchRes.ok) {
      const err = await batchRes.text();
      throw new Error(`Slides insertText failed: ${batchRes.status} ${err}`);
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const { accessToken, reportData, clientName, docType } = await req.json();
    if (!accessToken || !reportData || !clientName || !docType) {
      return new Response(
        JSON.stringify({ error: "Missing accessToken, reportData, clientName, or docType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (docType !== "slides" && docType !== "docs") {
      return new Response(
        JSON.stringify({ error: "docType must be 'slides' or 'docs'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const name = fileName(clientName);

    if (docType === "docs") {
      const file = await driveCreateFile(
        accessToken,
        name,
        "application/vnd.google-apps.document"
      );
      await buildGoogleDoc(accessToken, file.id, reportData);
      return new Response(
        JSON.stringify({
          docsUrl: `https://docs.google.com/document/d/${file.id}/edit`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const file = await driveCreateFile(
      accessToken,
      name,
      "application/vnd.google-apps.presentation"
    );
    await buildGoogleSlides(accessToken, file.id, reportData);
    return new Response(
      JSON.stringify({
        slidesUrl: `https://docs.google.com/presentation/d/${file.id}/edit`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-google-docs error:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
