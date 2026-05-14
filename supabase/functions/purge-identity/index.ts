// Purge Identity edge function — irreversible GDPR/CCPA right-to-erasure.
// Deletes all rows owned by the caller from every public-schema table with a
// user_id column, then deletes the auth user itself.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Tables in the public schema with a user_id column. Discovered via
// information_schema at implementation time. Missing tables are tolerated
// gracefully at runtime.
const USER_OWNED_TABLES = [
  "account_conversion_requests",
  "ai_audit_ledger",
  "api_keys",
  "api_metrics",
  "ar_user_interactions",
  "business_users",
  "creator_profiles",
  "dao_votes",
  "data_connections",
  "data_sources",
  "delt_transfers",
  "device_events",
  "egress_logs",
  "employees",
  "facility_assignments",
  "fiat_ledger",
  "good_deeds",
  "governance_ledger",
  "health_metrics",
  "hri_baselines",
  "hri_scores",
  "legal_agreements",
  "password_reset_tokens",
  "processed_operator_telemetry",
  "pulse_survey_responses",
  "raw_health_data",
  "raw_strava_data",
  "security_event_logs",
  "security_preferences",
  "social_analytics_consent",
  "social_health_metrics",
  "staged_health_data",
  "staged_lifestyle_data",
  "synapse_controller",
  "synapse_credit_ledger",
  "team_members",
  "telemetry_logs",
  "transactions",
  "trust_circle_members",
  "trust_score_history",
  "urban_flow_events",
  "user_api_keys",
  "user_interests",
  "user_invoices",
  "user_passkeys",
  "user_payment_methods",
  "user_permission_overrides",
  "user_preferences",
  "user_proposals",
  "user_subscriptions",
  "user_votes",
  "wallets",
  // profiles last so triggers referencing it during cascade have a chance to fire
  "profiles",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate caller JWT
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } =
      await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Admin client — bypasses RLS for purge
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const purged: string[] = [];
    const failed: Array<{ table: string; error: string }> = [];

    for (const table of USER_OWNED_TABLES) {
      try {
        const { error } = await admin.from(table).delete().eq("user_id", userId);
        if (error) {
          // Tolerate missing-table / schema-mismatch errors, surface others
          failed.push({ table, error: error.message });
        } else {
          purged.push(table);
        }
      } catch (e) {
        failed.push({ table, error: (e as Error).message });
      }
    }

    // Also clean profiles by id (some rows keyed by id, not user_id)
    try {
      await admin.from("profiles").delete().eq("id", userId);
    } catch (_) { /* ignore */ }

    // Finally delete the auth user — irreversible
    const { error: deleteUserErr } =
      await admin.auth.admin.deleteUser(userId, true);

    if (deleteUserErr) {
      console.error("[purge-identity] auth.admin.deleteUser failed", deleteUserErr);
      return new Response(
        JSON.stringify({
          ok: false,
          stage: "auth_delete",
          error: deleteUserErr.message,
          purged,
          failed,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, user_id: userId, purged, failed }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("[purge-identity] fatal", e);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
