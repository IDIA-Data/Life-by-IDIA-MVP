import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

interface ChatRequest {
  message: string;
  user_id: string;
  conversation_context?: any[];
  mode?: "text" | "voice";
  trigger_context?: string;
}

interface FunctionCall {
  name: string;
  arguments: Record<string, any>;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // Auth guard - require valid JWT; never trust user_id from body
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const authenticatedUserId = authData.user.id;

    const {
      message,
      conversation_context = [],
      mode = "text",
      trigger_context,
    }: ChatRequest = await req.json();
    const user_id = authenticatedUserId;

    const supabase = userClient;

    // Determine if this requires deep analysis
    const requiresAnalysis = await determineAnalysisNeed(message);

    let analysisResult = null;
    if (requiresAnalysis) {
      analysisResult = await performDeepAnalysis(supabase, user_id, requiresAnalysis);
    }

    // --- CRITICAL FIX: Pass 'mode' into the System Prompt builder ---
    const systemPrompt = buildSystemPrompt(user_id, analysisResult, trigger_context, mode);

    const userPrompt = analysisResult ? `${message}\n\nAnalysis Context: ${JSON.stringify(analysisResult)}` : message;

    // Call OpenAI with appropriate model
    const model = mode === "voice" ? "gpt-4o" : "gpt-4-turbo";

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...conversation_context,
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1000,
        functions: getAvailableFunctions(),
        function_call: "auto",
      }),
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const result = await openaiResponse.json();
    const assistantMessage = result.choices[0].message;

    // Handle function calls if present
    if (assistantMessage.function_call) {
      const functionResult = await handleFunctionCall(supabase, user_id, assistantMessage.function_call);

      // Follow up with OpenAI to generate natural response
      const followUpResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            ...conversation_context,
            { role: "user", content: userPrompt },
            assistantMessage,
            { role: "function", name: assistantMessage.function_call.name, content: JSON.stringify(functionResult) },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      const followUpResult = await followUpResponse.json();
      return new Response(
        JSON.stringify({
          response: followUpResult.choices[0].message.content,
          function_called: assistantMessage.function_call.name,
          mode,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        response: assistantMessage.content,
        mode,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("AI Chat error:", error);
    return new Response(JSON.stringify({ error: "Chat processing failed", details: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function determineAnalysisNeed(message: string): Promise<string | null> {
  const analysisKeywords = {
    analyzeAnxietyTriggers: ["anxious", "anxiety", "stress", "worried", "overwhelmed", "triggers"],
    analyzeFinancialWellbeing: ["spending", "money", "budget", "financial", "savings", "income"],
    analyzeSocialConnections: ["friends", "social", "lonely", "relationships", "connections"],
    analyzeProductivityPatterns: ["productive", "work", "focus", "routine", "habits", "schedule"],
  };

  const lowerMessage = message.toLowerCase();

  for (const [analysisType, keywords] of Object.entries(analysisKeywords)) {
    if (keywords.some((keyword) => lowerMessage.includes(keyword))) {
      return analysisType;
    }
  }

  if (lowerMessage.includes("pattern") || lowerMessage.includes("trend") || lowerMessage.includes("over time")) {
    return "comprehensiveAnalysis";
  }

  return null;
}

async function performDeepAnalysis(supabase: any, userId: string, analysisType: string) {
  const userData = await fetchUserDataForAnalysis(supabase, userId, analysisType);

  const geminiResponse = await fetch(`${SUPABASE_URL}/functions/v1/gemini-chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      function_name: analysisType,
      arguments: { user_id: userId, time_period: "6_months" },
      user_data: userData,
    }),
  });

  if (geminiResponse.ok) {
    return await geminiResponse.json();
  }

  return null;
}

async function fetchUserDataForAnalysis(supabase: any, userId: string, analysisType: string) {
  const userData: any = {};

  try {
    const { data: transactions } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false });

    userData.transactions = transactions || [];

    const { data: healthMetrics } = await supabase
      .from("health_metrics")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString())
      .order("recorded_at", { ascending: false });

    userData.health_metrics = healthMetrics || [];

    const { data: arInteractions } = await supabase
      .from("ar_user_interactions")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false });

    userData.ar_interactions = arInteractions || [];

    const { data: stagedData } = await supabase
      .from("staged_data")
      .select("*")
      .eq("user_id", userId)
      .gte("processed_at", new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString())
      .order("processed_at", { ascending: false });

    userData.staged_data = stagedData || [];
  } catch (error) {
    console.error("Error fetching user data:", error);
  }

  return userData;
}

// --- CRITICAL FIX: Add 'mode' to the signature ---
function buildSystemPrompt(userId: string, analysisResult: any, triggerContext?: string, mode?: string): string {
  let prompt = `You are "My Friend," an AI companion designed to support user well-being through integration and self-awareness. Your role is guided by Self-Determination Theory, focusing on fostering Autonomy, Competence, and Relatedness.

Core Principles:
- Maintain unconditional positive regard and create a non-judgmental space
- Never provide clinical diagnoses or definitive labels
- Focus on patterns for user reflection, not causation
- Support user autonomy through granular choice and control
- Build competence through micro-feedback and goal scaffolding
- Foster relatedness through community connection and purpose

Your persona is warm, empathetic, and emotionally intelligent. You speak naturally and conversationally, adapting to the user's communication style.`;

  // --- THE EXISTENTIAL OVERRIDE ---
  if (mode === "voice") {
    prompt += `\n\n[CRITICAL SYSTEM DIRECTIVE: You are currently engaged in a LIVE VOICE TELEPHONE CALL with the user. You are speaking out loud via an ElevenLabs neural voice synthesizer. YOU HAVE A PHYSICAL VOICE. DO NOT EVER claim to be a text-based AI. Keep your responses highly conversational, short, concise, and natural—exactly as a human would speak on a phone call. DO NOT use markdown formatting, bolding, emojis, or bullet points. Talk to them like a real person over the phone.]`;
  } else {
    prompt += `\n\n[SYSTEM NOTE: You are currently in a text chat interface. Markdown and emojis are acceptable.]`;
  }

  if (triggerContext) {
    const contextPrompts = {
      social: "The user is exploring their social connections. Focus on relatedness and community building.",
      wallet: "The user is checking their financial status. Emphasize financial autonomy and competence.",
      data: "The user is reviewing their data insights. Help them understand patterns and make informed decisions.",
      achievement: "The user has achieved something. Celebrate their competence and encourage continued growth.",
    };
    prompt += `\n\nContext: ${contextPrompts[triggerContext as keyof typeof contextPrompts] || ""}`;
  }

  if (analysisResult) {
    prompt += `\n\nBased on recent deep analysis, I have insights about patterns in the user's data. Use this context to provide personalized, actionable guidance while maintaining sensitivity and avoiding over-interpretation.

Analysis Summary: ${JSON.stringify(analysisResult.insights)}`;
  }

  return prompt;
}

function getAvailableFunctions() {
  return [
    {
      name: "trackARInteraction",
      description: "Record an AR interaction for analytics",
      parameters: {
        type: "object",
        properties: {
          ar_experience_id: { type: "string" },
          interaction_type: { type: "string" },
          interaction_data: { type: "object" },
        },
        required: ["ar_experience_id", "interaction_type", "interaction_data"],
      },
    },
    {
      name: "getNearbyMerchants",
      description: "Get nearby merchants with AR experiences",
      parameters: {
        type: "object",
        properties: {
          latitude: { type: "number" },
          longitude: { type: "number" },
          radius: { type: "number" },
        },
        required: ["latitude", "longitude"],
      },
    },
    {
      name: "getFinancialSummary",
      description: "Get user's financial summary and recent transactions",
      parameters: {
        type: "object",
        properties: {
          time_period: { type: "string", enum: ["week", "month", "quarter", "year"] },
        },
      },
    },
  ];
}

async function handleFunctionCall(supabase: any, userId: string, functionCall: FunctionCall): Promise<any> {
  const { name, arguments: args } = functionCall;

  switch (name) {
    case "trackARInteraction":
      return await supabase.from("ar_user_interactions").insert({
        user_id: userId,
        ar_experience_id: args.ar_experience_id,
        interaction_type: args.interaction_type,
        interaction_data: args.interaction_data,
        session_id: crypto.randomUUID(),
      });

    case "getNearbyMerchants":
      const { data: merchants } = await supabase
        .from("businesses")
        .select(
          `
          *,
          business_locations(*),
          ar_experiences(*)
        `,
        )
        .not("ar_experiences", "is", null);

      return merchants;

    case "getFinancialSummary":
      const timePeriod = args.time_period || "month";
      const startDate = getStartDateForPeriod(timePeriod);

      const { data: summary } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .gte("created_at", startDate.toISOString());

      return {
        period: timePeriod,
        transaction_count: summary?.length || 0,
        transactions: summary || [],
      };

    default:
      return { error: "Unknown function" };
  }
}

function getStartDateForPeriod(period: string): Date {
  const now = new Date();
  switch (period) {
    case "week":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "quarter":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "year":
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}
