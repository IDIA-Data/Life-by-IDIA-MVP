import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { privateKeyToAccount } from "npm:viem@2.9.20/accounts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const rawKey = Deno.env.get("RELAYER_PRIVATE_KEY");
    if (!rawKey) {
      return new Response(JSON.stringify({ error: "RELAYER_PRIVATE_KEY not set" }), { status: 400 });
    }

    const formatted = rawKey.trim().startsWith("0x") ? rawKey.trim() : `0x${rawKey.trim()}`;
    const account = privateKeyToAccount(formatted as `0x${string}`);

    const expected = "0xd816D83703764551A7F292dbC435669AA89631a7".toLowerCase();
    const derived = account.address.toLowerCase();
    const match = derived === expected;

    return new Response(
      JSON.stringify({
        match,
        expected: "0xd816D83703764551A7F292dbC435669AA89631a7",
        derived: account.address,
        key_length: rawKey.trim().length,
        has_0x_prefix: rawKey.trim().startsWith("0x"),
      }),
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});