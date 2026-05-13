import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const log = (tag: string, msg: string) => console.log(`[DAO_EXECUTION_${tag}]: ${msg}`);

  try {
    log("START", "Hat eligibility sweep...");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: hats, error } = await supabase
      .from("dao_hats")
      .select("id,user_id,hat_type,eligibility_status,granted_at")
      .is("revoked_at", null);
    if (error) throw error;

    let grayed = 0, severed = 0;
    for (const h of hats ?? []) {
      const ageDays = (Date.now() - new Date(h.granted_at).getTime()) / 86400_000;
      let next = h.eligibility_status;
      if (ageDays > 395) next = "severed";
      else if (ageDays > 365) next = "grayed";
      if (next !== h.eligibility_status) {
        const update: Record<string, unknown> = { eligibility_status: next };
        if (next === "severed") update.revoked_at = new Date().toISOString();
        await supabase.from("dao_hats").update(update).eq("id", h.id);
        if (next === "grayed") grayed++; else severed++;
      }
    }

    log("STEP", `Grayed=${grayed} Severed=${severed}`);
    log("END", "Sweep complete.");
    return new Response(JSON.stringify({ grayed, severed }), {
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
