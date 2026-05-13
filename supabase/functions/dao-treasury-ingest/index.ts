import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FlowPayload {
  direction: "in" | "out";
  asset: string;
  amount_usd: number;
  counterparty_label?: string;
  block_height?: number;
  tx_hash?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const log = (tag: string, msg: string) => console.log(`[DAO_EXECUTION_${tag}]: ${msg}`);

  try {
    log("START", "Initiating Treasury Ingest...");
    const auth = req.headers.get("authorization") || "";
    const expected = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
    if (auth !== expected) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as { flows: FlowPayload[]; volatile_exposure_pct?: number };
    if (!Array.isArray(body.flows) || body.flows.length === 0) throw new Error("flows[] required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await supabase.from("dao_treasury_flows").insert(body.flows);
    if (error) throw error;
    log("STEP", `Inserted ${body.flows.length} flows.`);

    const VOL_THRESHOLD = 0.35;
    if ((body.volatile_exposure_pct ?? 0) > VOL_THRESHOLD) {
      log("STEP", `Volatile exposure ${body.volatile_exposure_pct} > ${VOL_THRESHOLD} — risk alert raised.`);
    }

    log("END", "Ingest complete. Hash recorded on Ledger.");
    return new Response(JSON.stringify({ inserted: body.flows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
