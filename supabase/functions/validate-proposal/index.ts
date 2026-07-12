import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type LegalRisk = "none" | "low" | "medium" | "high";

interface Verdict {
  score: number;
  feedback: string;
  legal_risk: LegalRisk;
  legal_reasons: string[];
  status: "approved" | "under_review" | "rejected";
  word_count: number;
}

const countWords = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

function decideStatus(score: number, legal: LegalRisk): Verdict["status"] {
  if (legal === "high" || score < 4) return "rejected";
  if (legal === "medium" || score < 7) return "under_review";
  return "approved";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth guard
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: authData, error: authErr } = await userClient.auth.getUser();
      if (authErr || !authData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { proposalId, title, description, category } = await req.json();

    if (!title || !description) {
      return new Response(JSON.stringify({ error: "title and description required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const wordCount = countWords(String(description));
    // Hard structural gate — 50 words minimum
    if (wordCount < 50) {
      const verdict: Verdict = {
        score: 2,
        feedback: `Proposal description is too short (${wordCount}/50 words minimum). Add more detail — what, why, how, and expected outcome.`,
        legal_risk: "none",
        legal_reasons: [],
        status: "rejected",
        word_count: wordCount,
      };
      return new Response(JSON.stringify(verdict), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are the governance validator for IDIA Data Inc. (a Delaware C-Corp) and IDIA DUNA (a Wyoming Decentralized Unincorporated Nonprofit Association).

Evaluate a governance proposal on TWO independent axes:

1. STRUCTURAL LEGIBILITY (score 0-10):
   - 8-10: coherent, on-topic, specific, actionable, well-formed English.
   - 4-7: partially clear but vague, off-topic drift, or missing rationale/outcome.
   - 0-3: spam, gibberish, promotional, empty, or incoherent.

2. LEGAL RISK to IDIA Data Inc. / IDIA DUNA (one of: none | low | medium | high).
   Flag any of the following and set risk accordingly:
   - HIGH: defamation of a person/entity, incitement to violence, targeted harassment, doxxing, promises of guaranteed yields or unregistered securities offerings, unlawful directives, sanctions/OFAC violations, instructions to breach fiduciary duty, third-party IP infringement, criminal facilitation.
   - MEDIUM: ambiguous financial promises, aggressive/hostile tone toward named parties, regulatory grey areas (tax, AML), potential IP concerns needing counsel review.
   - LOW: minor ambiguity easily fixed with counsel review.
   - NONE: clean.

Respond with STRICT JSON only, no prose, matching:
{"score": number, "feedback": string, "legal_risk": "none"|"low"|"medium"|"high", "legal_reasons": string[]}

Keep feedback under 280 chars, user-facing, actionable.`;

    const userPrompt = `Category: ${category ?? "governance"}
Title: ${title}

Description:
${description}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Lovable-API-Key": LOVABLE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("[validate-proposal] Gateway error", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiRes.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Contact workspace admin." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: "AI validator unavailable" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const raw = aiJson.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { score: 5, feedback: "Validator returned unparseable output.", legal_risk: "medium", legal_reasons: ["parser_fallback"] };
    }

    const score = Math.max(0, Math.min(10, Number(parsed.score ?? 5)));
    const legal_risk: LegalRisk = ["none", "low", "medium", "high"].includes(parsed.legal_risk)
      ? parsed.legal_risk
      : "medium";
    const legal_reasons: string[] = Array.isArray(parsed.legal_reasons) ? parsed.legal_reasons.slice(0, 8).map(String) : [];
    const feedback: string = String(parsed.feedback ?? "").slice(0, 500) || "No feedback provided.";
    const status = decideStatus(score, legal_risk);

    const verdict: Verdict = { score, feedback, legal_risk, legal_reasons, status, word_count: wordCount };

    // Legacy path: if a proposalId is provided, mirror status to the DB (best-effort).
    if (proposalId) {
      const dbStatus = status === "approved" ? "active" : status === "under_review" ? "under_review" : "rejected";
      const { error } = await supabase
        .from("dao_proposals")
        .update({ status: dbStatus })
        .eq("id", proposalId);
      if (error) console.warn("[validate-proposal] update warn:", error.message);
    }

    return new Response(JSON.stringify(verdict), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[validate-proposal] FATAL", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
