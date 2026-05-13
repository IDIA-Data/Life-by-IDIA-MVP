import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useSovereignWallet = (userId: string | undefined) => {
  const [globalWalletAddress, setGlobalWalletAddress] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const inFlightRef = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    console.log("🔄 [SOVEREIGN_SYNC_LOG] START: Initializing Hook Lifecycle.");

    if (!userId) {
      console.log("🔄 [SOVEREIGN_SYNC_LOG] ABORT: No userId provided. Standing by.");
      setIsHydrating(false);
      return;
    }

    let channel: any;

    const initializeSovereignState = async () => {
      console.log(`🌐 [HYDRATION_LOG] START: Fetching global truth for UserID: ${userId}`);

      try {
        // Step 1: Initial Fetch - Using 'id' for the query filter
        const { data, error } = await supabase.from("profiles").select("wallet_address").eq("id", userId).maybeSingle();

        if (error) {
          console.error("🚨 [HYDRATION_LOG] ERROR_START: Supabase query failed.");
          console.error("🚨 [HYDRATION_LOG] ERROR_DETAILS:", error.message);
          throw error;
        }

        if (data?.wallet_address) {
          setGlobalWalletAddress(data.wallet_address);
          console.log(`🌐 [HYDRATION_LOG] END: Successfully hydrated global state: ${data.wallet_address}`);
        } else {
          console.log("🌐 [HYDRATION_LOG] END: Profile exists but wallet is empty.");
        }

        // Step 2: Establish Realtime Subscription
        channel = supabase
          .channel(`sovereign-vault-sync-${userId}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "profiles",
              filter: `id=eq.${userId}`,
            },
            (payload) => {
              console.log("📡 [REALTIME_LOG] DATA_RECEIVED: Remote Profile Update Detected.");
              const updatedAddress = (payload.new as any).wallet_address;

              if (updatedAddress && updatedAddress !== globalWalletAddress) {
                setGlobalWalletAddress(updatedAddress);
                toast({
                  title: "Identity Synced",
                  description: "Vault detected from another device.",
                });
              }
            },
          )
          .subscribe();
      } catch (err: any) {
        console.error("🚨 [HYDRATION_LOG] FATAL: Unexpected exception.");
      } finally {
        setIsHydrating(false);
      }
    };

    initializeSovereignState();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, toast]);

  // STEP 2: Upsert when a new connection occurs
  const syncWalletToSupabase = async (newAddress: string) => {
    if (!userId) {
      console.error("🚨 [SUPABASE_SYNC_LOG] ERROR: Cannot sync wallet. Missing userId.");
      return false;
    }

    // Concurrency guard: prevents the failure→re-render→retry loop
    if (inFlightRef.current) {
      console.warn("🛑 [SUPABASE_SYNC_LOG] SKIP: Sync already in flight.");
      return false;
    }
    inFlightRef.current = true;

    console.log(`\n🌐 [SUPABASE_SYNC_LOG] START: Committing wallet ${newAddress} for UserID: ${userId}`);

    try {
      // STEP 1: UPDATE-only path. The handle_new_user trigger guarantees the row exists.
      // This avoids ever inserting a NULL account_type and tripping profiles_account_type_check.
      const { data: updated, error: updateError } = await supabase
        .from("profiles")
        .update({
          wallet_address: newAddress,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .select("id");

      if (updateError) {
        console.error("🚨 [SUPABASE_SYNC_LOG] UPDATE_ERROR:", updateError.message);
        throw updateError;
      }

      // STEP 2: Defensive fallback — if the trigger somehow hasn't run yet,
      // upsert with ALL CHECK-constrained columns populated with safe defaults.
      if (!updated || updated.length === 0) {
        console.warn("⚠️ [SUPABASE_SYNC_LOG] No profile row found — creating with safe defaults.");
        const { error: upsertError } = await supabase.from("profiles").upsert(
          {
            id: userId,
            user_id: userId,
            platform_guid: userId,
            account_type: "individual", // satisfies profiles_account_type_check
            ai_assistant_name: "Friend",
            kyc_tier: 1,
            wallet_address: newAddress,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "id" },
        );
        if (upsertError) {
          console.error("🚨 [SUPABASE_SYNC_LOG] FALLBACK_UPSERT_ERROR:", upsertError.message);
          throw upsertError;
        }
      }

      setGlobalWalletAddress(newAddress);
      console.log("🌐 [SUPABASE_SYNC_LOG] END: Global state secured in Supabase.");

      toast({
        title: "Vault Synced",
        description: "Sovereign identity aligned across all devices.",
      });

      return true;
    } catch (err: any) {
      console.error("🚨 [SUPABASE_SYNC_LOG] FATAL: Sync failure.", err?.message);
      return false;
    } finally {
      inFlightRef.current = false;
    }
  };

  return {
    globalWalletAddress,
    isHydrating,
    syncWalletToSupabase,
  };
};
