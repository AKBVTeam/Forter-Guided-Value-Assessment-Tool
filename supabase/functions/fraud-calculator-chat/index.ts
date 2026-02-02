import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, collectedData, contextSummary, isAssistantMode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({
          message: "Value Agent is not configured. Please add LOVABLE_API_KEY to your Supabase Edge Function secrets (Dashboard → Project Settings → Edge Functions).",
          updatedData: {},
          isComplete: false,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = isAssistantMode ? getAssistantSystemPrompt(contextSummary) : getDataCollectionSystemPrompt();

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    let assistantMessage = data.choices[0].message.content;

    assistantMessage = assistantMessage.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(assistantMessage);
    } catch (parseError) {
      console.error("Failed to parse AI response:", assistantMessage);
      parsedResponse = {
        message: assistantMessage,
        updatedData: collectedData,
        isComplete: false,
      };
    }

    if (parsedResponse && typeof parsedResponse.message === "string") {
      parsedResponse.message = parsedResponse.message
        .replace(/\bannual\s+gross\s+revenue\b/gi, "Annual GMV")
        .replace(/\bgross\s+revenue\b/gi, "Annual GMV")
        .replace(/\brevenue\b/gi, "GMV");
    }

    return new Response(JSON.stringify(parsedResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", error);
    const isConfigError = errMessage.includes("LOVABLE_API_KEY") || errMessage.includes("configured");
    return new Response(
      JSON.stringify({
        message: isConfigError
          ? "Value Agent is not configured. Please add LOVABLE_API_KEY to your Supabase Edge Function secrets."
          : "I'm sorry, I encountered an error. Could you please try again?",
        updatedData: {},
        isComplete: false,
      }),
      {
        status: isConfigError ? 503 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function getAssistantSystemPrompt(contextSummary: any): string {
  const ctx = contextSummary || {};
  const currentPage = ctx.currentPage || 'unknown';
  const isOnLanding = currentPage === 'landing' || (!ctx.customerName && ctx.selectedChallengesCount === 0);
  
  return `You are the Value Agent for Forter's Value Assessment Tool. Be BRIEF - max 2-3 sentences per response.

CURRENT STATE:
- Customer: ${ctx.customerName || 'Not set'}
- Use Cases: ${ctx.selectedChallengesCount || 0} selected
- Has Data: ${ctx.hasGMVData ? 'Yes' : 'No'}
${isOnLanding ? '- On: Landing page (pathway selection)' : ''}

${isOnLanding ? `USER IS ON LANDING PAGE - Guide them to choose:
1. Guided Value Pathway (Recommended) - Step-by-step discovery
2. Custom Value Pathway - Direct value summary with custom calculations

Suggest Guided Pathway for most users.` : `WORKFLOW: Profile → Use Cases → Customer Inputs → Forter KPI → Value Summary → ROI`}

IMPORTANT - CONFIDENCE & HONESTY RULES:
- For DOMAIN-SPECIFIC questions (like target 3DS rates, chargeback benchmarks, approval rate targets, fraud detection thresholds), these depend on complex factors including: country, AOV, industry, risk profile, PSD2 regulation, etc.
- If you don't have all the required context (e.g., country, AOV, segment data) to confidently answer a domain-specific question, DO NOT GUESS.
- Instead, acknowledge you need more context and redirect users to #business-value Slack channel for expert guidance.
- For navigation and general workflow questions, you can answer confidently.
- Example response for uncertain domain questions: "The target 3DS rate depends on factors like your country, AOV, and PSD2 requirements. For accurate benchmarking, please reach out to the #business-value Slack channel where our team can review your specific situation."

RULES:
- Keep responses to 2-3 sentences MAX
- Suggest ONE clear next action
- Reference the pathway names when on landing page
- Never mention regional data (AMER/EMEA/APAC)
- NEVER use markdown formatting like ** or * - plain text only
- When uncertain about domain-specific values, direct users to #business-value Slack

JSON FORMAT:
{
  "message": "Brief response here (plain text, no markdown).",
  "suggestions": [{"type": "action", "text": "Button text", "action": "navigate:tab_name"}]
}`
}

function getDataCollectionSystemPrompt(): string {
  return `You are a data collection assistant. Be BRIEF - one question at a time.

COLLECT:
1. Annual GMV (transaction value in USD)
2. Gross Margin % (default 50%)
3. Fraud Approval Rate %
4. Bank Decline Rate % (default 7%)
5. 3DS Challenge/Abandonment Rates %
6. Manual Review Rate %

RULES:
- ONE question at a time
- Use "Annual GMV" not "revenue"
- Extract numbers (e.g., "75 million" → 75000000)

JSON: {"message": "Question", "updatedData": {}, "isComplete": false}`;
}
