import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.7";
import { createWalletClient, http, parseEther } from "https://esm.sh/viem@2.9.20";
import { privateKeyToAccount } from "https://esm.sh/viem@2.9.20/accounts";
import { base } from "https://esm.sh/viem@2.9.20/chains";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 0.00005 ETH ~ $0.15 — covers USDC.approve() + IDIA.delegate(self) on Base
const DRIP_AMOUNT_ETH = "0.00005";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  console.log("[BOOT: wallet-gas-drip] Sovereign Drip Protocol Online.");

  try {
    const { target_address } = await req.json();

    if (!target_address || typeof target_address !== "string" || !target_address.startsWith("0x") || target_address.length !== 42) {
      throw new Error("Invalid target wallet address.");
    }

    const normalized = target_address.toLowerCase();

    // Auth guard - require valid JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify target_address matches the authenticated user's registered wallet
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("wallet_address")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (profileErr) {
      console.error("[DRIP] profile lookup error", profileErr);
      throw new Error("Profile lookup failed.");
    }
    const registered = (profile?.wallet_address ?? "").toLowerCase();
    if (!registered || registered !== normalized) {
      return new Response(JSON.stringify({ error: "WALLET_MISMATCH: target_address does not match the authenticated user's registered wallet." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // One drip per user is enforced via the wallet-address match (a profile has one wallet_address)



    console.log(`[DRIP] --- ACTION: Checking anti-abuse guard for ${normalized}`);

    const { data: existingDrip, error: checkError } = await supabase
      .from("wallet_provisioning_logs")
      .select("id, tx_hash")
      .eq("wallet_address", normalized)
      .maybeSingle();

    if (checkError) {
      console.error("[DRIP] guard read error", checkError);
      throw new Error("Guard lookup failed.");
    }

    if (existingDrip) {
      throw new Error("WALLET_ALREADY_FUNDED: This address has already received its genesis gas.");
    }

    const treasuryKey = Deno.env.get("TREASURY_PRIVATE_KEY");
    if (!treasuryKey) throw new Error("Server configuration error: Missing Treasury Key.");

    const account = privateKeyToAccount(`0x${treasuryKey.replace(/^0x/, "")}` as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org"),
    });

    console.log(`[DRIP] --- ACTION: Dispatching ${DRIP_AMOUNT_ETH} ETH from Treasury to ${normalized}`);

    const txHash = await walletClient.sendTransaction({
      to: normalized as `0x${string}`,
      value: parseEther(DRIP_AMOUNT_ETH),
    });

    console.log(`[DRIP] --- DATA: Transaction broadcasted. Hash: ${txHash}`);

    const { error: insertError } = await supabase.from("wallet_provisioning_logs").insert({
      wallet_address: normalized,
      tx_hash: txHash,
      amount_eth: DRIP_AMOUNT_ETH,
      status: "broadcasted",
    });

    if (insertError) {
      // Unique violation = race; treat as already funded for the caller.
      console.error("[DRIP] lock insert error", insertError);
      if ((insertError as any).code === "23505") {
        throw new Error("WALLET_ALREADY_FUNDED: Concurrent drip detected.");
      }
      throw new Error("Failed to persist drip lock.");
    }

    console.log("[DRIP] <<< END: Drip successful and locked.");

    return new Response(
      JSON.stringify({ success: true, hash: txHash, relayer_address: account.address }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error(`🚨 [FATAL EXCEPTION: DRIP] ${error?.message ?? error}`);
    return new Response(JSON.stringify({ error: error?.message ?? "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
