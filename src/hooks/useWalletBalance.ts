import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ethers } from "ethers"; // <-- Swapped viem for ethers (Native Infrastructure)

// Base Mainnet USDC Contract
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Minimal Human-Readable ABI for read-only operations via ethers
const USDC_ABI = [
  "function balanceOf(address account) view returns (uint256)"
];

export interface WalletBalance {
  usdc_balance: number;
  cash_balance: number;
  idia_token_balance: number;
  total_earned: number;
}

const ZERO_FLOOR: WalletBalance = {
  cash_balance: 0,
  usdc_balance: 0,
  idia_token_balance: 0,
  total_earned: 0,
};

// Purge any legacy persisted wallet state (no-persistence rule)
const purgeLegacyWalletCache = () => {
  console.log("🧹 [CACHE_PURGE_LOG] START: Executing legacy wallet cache purge.");
  try {
    const keys = ["wallet_balance", "user_wallet", "user_wallets", "cash_balance", "idia_balance"];
    keys.forEach((k) => {
      window.localStorage.removeItem(k);
      window.sessionStorage.removeItem(k);
    });
    console.log("🧹 [CACHE_PURGE_LOG] END: Cache purge completed successfully.");
  } catch (error) {
    console.error("🚨 [CACHE_PURGE_LOG] ERROR_START: purgeLegacyWalletCache failed.");
    console.error("🚨 [CACHE_PURGE_LOG] ERROR_DETAILS:", error instanceof Error ? error.message : String(error));
    console.error("🚨 [CACHE_PURGE_LOG] ERROR_END: purgeLegacyWalletCache terminated.");
  }
};

export const useWalletBalance = () => {
  const [balance, setBalance] = useState<WalletBalance>(ZERO_FLOOR);
  const [loading, setLoading] = useState(true);
  const [fiatProvisioned, setFiatProvisioned] = useState(false);
  const [usdcProvisioned, setUsdcProvisioned] = useState(false);
  const [usdcAddress, setUsdcAddress] = useState<string | null>(null);

  const applyRow = useCallback((row: any | null, userId: string) => {
    console.log("⚙️ [DATA_APPLY_LOG] START: Executing applyRow for user:", userId);
    try {
      if (!row) {
        console.info(`⚙️ [DATA_APPLY_LOG] ACTION: No vault row for ${userId} — anchoring to Zero Floor`);
        setBalance((prev) => ({
          ...ZERO_FLOOR,
          usdc_balance: prev.usdc_balance, // Preserve absolute on-chain truth
        }));
        return;
      }

      console.info(`⚙️ [DATA_APPLY_LOG] PAYLOAD:`, row);
      setBalance((prev) => ({
        cash_balance: Number(row.cash_balance) || 0,
        usdc_balance: prev.usdc_balance, // Isolate USDC to ethers fetching only
        idia_token_balance: Number(row.idia_token_balance) || 0,
        total_earned: 0,
      }));
      console.log("⚙️ [DATA_APPLY_LOG] END: Successfully applied new wallet balances.");
    } catch (error) {
      console.error("🚨 [DATA_APPLY_LOG] ERROR_START: applyRow execution failed.");
      console.error("🚨 [DATA_APPLY_LOG] ERROR_DETAILS:", error instanceof Error ? error.message : String(error));
      console.error("🚨 [DATA_APPLY_LOG] ERROR_END: applyRow terminated.");
    }
  }, []);

  const fetchBalance = useCallback(async () => {
    console.log("🌐 [FETCH_BALANCE_LOG] START: Initializing fetchBalance routine.");
    purgeLegacyWalletCache();

    try {
      console.log("🌐 [FETCH_BALANCE_LOG] ACTION: Awaiting Supabase Auth User.");
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        console.error("🚨 [FETCH_BALANCE_LOG] ERROR_START: Supabase auth fetch failed.");
        console.error("🚨 [FETCH_BALANCE_LOG] ERROR_DETAILS:", authError.message);
        console.error("🚨 [FETCH_BALANCE_LOG] ERROR_END: Auth check terminated.");
        throw authError;
      }

      if (!user) {
        console.log("🌐 [FETCH_BALANCE_LOG] END: No active user session. Anchoring to Zero Floor.");
        setBalance(ZERO_FLOOR);
        setLoading(false);
        return;
      }

      // 1. Ingest IDIA Token & Cash Ledger State
      console.log(`🌐 [FETCH_BALANCE_LOG] ACTION: Ingesting LKS (Ledger State) for User: ${user.id}`);
      let fiatBalance = 0;
      let tokenBalance = 0;

      const { data: walletData, error: walletError } = await supabase
        .from("wallets")
        .select("cash_balance, idia_token_balance")
        .eq("user_id", user.id)
        .maybeSingle();

      if (walletError) {
        console.error("🚨 [FETCH_BALANCE_LOG] ERROR_START: Supabase 'wallets' query failed.");
        console.error("🚨 [FETCH_BALANCE_LOG] ERROR_DETAILS: Check Database connection.", walletError.message);
        console.error("🚨 [FETCH_BALANCE_LOG] ERROR_END: Supabase query terminated.");
        setFiatProvisioned(false);
      } else if (walletData) {
        fiatBalance = Number(walletData.cash_balance) || 0;
        tokenBalance = Number(walletData.idia_token_balance) || 0;
        setFiatProvisioned(true);
      } else {
        setFiatProvisioned(false);
      }

      // 2. Fetch Global Vault Identity from Profiles
      console.log("🌐 [FETCH_BALANCE_LOG] ACTION: Querying profiles for global wallet_address.");
      let usdcBalance = 0;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("wallet_address")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("🚨 [FETCH_BALANCE_LOG] ERROR_START: Failed to query profile for wallet_address.");
        console.error("🚨 [FETCH_BALANCE_LOG] ERROR_DETAILS:", profileError.message);
        console.error("🚨 [FETCH_BALANCE_LOG] ERROR_END: Profile query terminated.");
      }

      const walletAddress = profile?.wallet_address;

      if (walletAddress && walletAddress.startsWith("0x")) {
        console.log(`🌐 [FETCH_BALANCE_LOG] SUCCESS: Wallet identified: ${walletAddress}`);
        setUsdcProvisioned(true);
        setUsdcAddress(walletAddress);
        console.log("🌐 [FETCH_BALANCE_LOG] ACTION: Initializing ethers JSON RPC provider for USDC hydration.");

        try {
          // Replaced Viem with Ethers natively
          const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
          const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);

          const rawBalance = await usdcContract.balanceOf(walletAddress);
          usdcBalance = Number(ethers.formatUnits(rawBalance, 6));

          console.log(`🌐 [FETCH_BALANCE_LOG] SUCCESS: Verified absolute on-chain USDC truth: $${usdcBalance}`);
        } catch (chainErr: any) {
          console.error("🚨 [FETCH_BALANCE_LOG] ERROR_START: Ethers smart contract read failed.");
          console.error("🚨 [FETCH_BALANCE_LOG] ERROR_DETAILS:", chainErr.message || String(chainErr));
          console.error("🚨 [FETCH_BALANCE_LOG] ERROR_END: Ethers reading terminated.");
        }
      } else {
        console.log("🌐 [FETCH_BALANCE_LOG] INFO: No valid sovereign wallet mapped in profiles. Bypassing ethers fetch.");
        setUsdcProvisioned(false);
        setUsdcAddress(null);
      }

      setBalance({
        cash_balance: fiatBalance,
        usdc_balance: usdcBalance, // Overrides db column with strict on-chain data
        idia_token_balance: tokenBalance,
        total_earned: 0,
      });

      console.log("🌐 [FETCH_BALANCE_LOG] END: Wallet fetch routine completed successfully.");
    } catch (err) {
      console.error("🚨 [FETCH_BALANCE_LOG] ERROR_START: Fatal exception during fetchBalance.");
      console.error("🚨 [FETCH_BALANCE_LOG] ERROR_DETAILS:", err instanceof Error ? err.message : String(err));
      console.error("🚨 [FETCH_BALANCE_LOG] ERROR_END: fetchBalance execution terminated.");
      setBalance(ZERO_FLOOR);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log("🔄 [REALTIME_SYNC_LOG] START: Initializing useWalletBalance effect hook.");
    let channel: any;
    let cancelled = false;

    const setup = async () => {
      console.log("🔄 [REALTIME_SYNC_LOG] ACTION: Beginning channel setup.");
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || cancelled) {
          console.log("🔄 [REALTIME_SYNC_LOG] ABORT: User missing or hook cancelled. Bypassing setup.");
          setLoading(false);
          return;
        }

        await fetchBalance();

        console.log(`🔄 [REALTIME_SYNC_LOG] ACTION: Subscribing to postgres_changes for user: ${user.id}`);
        channel = supabase
          .channel(`vault-sync-${user.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "wallets",
              filter: `user_id=eq.${user.id}`,
            },
            (payload) => {
              console.log("📡 [REALTIME_SYNC_LOG] DATA_RECEIVED: Realtime Delta Detected:", payload);
              if (payload.eventType === "DELETE") {
                console.log("📡 [REALTIME_SYNC_LOG] ACTION: Delete event received. Anchoring to Zero Floor.");
                setBalance(ZERO_FLOOR);
                return;
              }
              applyRow(payload.new, user.id);
            },
          )
          .subscribe((status, err) => {
            console.log(`📡 [REALTIME_SYNC_LOG] STATUS_UPDATE: Channel state is now: ${status}`);
            if (err) {
              console.error("🚨 [REALTIME_SYNC_LOG] ERROR_START: Supabase channel subscription failed.");
              console.error("🚨 [REALTIME_SYNC_LOG] ERROR_DETAILS:", err);
              console.error("🚨 [REALTIME_SYNC_LOG] ERROR_END: Subscription error logged.");
            }
          });

        console.log("🔄 [REALTIME_SYNC_LOG] END: Channel setup completed.");
      } catch (error) {
        console.error("🚨 [REALTIME_SYNC_LOG] ERROR_START: Setup routine exception.");
        console.error("🚨 [REALTIME_SYNC_LOG] ERROR_DETAILS:", error instanceof Error ? error.message : String(error));
        console.error("🚨 [REALTIME_SYNC_LOG] ERROR_END: Setup routine terminated.");
      }
    };

    setup();

    // Auto-poll the blockchain every 15 seconds parallel to Hub's design
    const interval = setInterval(() => {
      console.log("🔄 [REALTIME_SYNC_LOG] INFO: 15-second polling tick fired for ethers fetch.");
      fetchBalance();
    }, 15000);

    // React to auth changes — purge state on sign-out, refetch on sign-in
    console.log("🔐 [AUTH_STATE_LOG] START: Attaching AuthState listener.");
    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      console.log(`🔐 [AUTH_STATE_LOG] EVENT_DETECTED: Auth state shifted to [${event}]`);
      try {
        if (event === "SIGNED_OUT") {
          console.log("🔐 [AUTH_STATE_LOG] ACTION: Purging context and channels due to sign out.");
          purgeLegacyWalletCache();
          setBalance(ZERO_FLOOR);
          if (channel) supabase.removeChannel(channel);
        } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          console.log("🔐 [AUTH_STATE_LOG] ACTION: Firing fetchBalance due to valid session.");
          fetchBalance();
        }
        console.log("🔐 [AUTH_STATE_LOG] END: Auth event handled successfully.");
      } catch (error) {
        console.error("🚨 [AUTH_STATE_LOG] ERROR_START: Auth state change handler failed.");
        console.error("🚨 [AUTH_STATE_LOG] ERROR_DETAILS:", error instanceof Error ? error.message : String(error));
        console.error("🚨 [AUTH_STATE_LOG] ERROR_END: Auth state change handler terminated.");
      }
    });

    return () => {
      console.log("🧹 [HOOK_CLEANUP_LOG] START: Unmounting useWalletBalance.");
      cancelled = true;
      clearInterval(interval);
      if (channel) {
        console.log("🧹 [HOOK_CLEANUP_LOG] ACTION: Removing Supabase realtime channel.");
        supabase.removeChannel(channel);
      }
      authSub.subscription.unsubscribe();
      console.log("🧹 [HOOK_CLEANUP_LOG] END: Unmount operations completed.");
    };
  }, [fetchBalance, applyRow]);

  return { balance, loading, refreshBalance: fetchBalance, fiatProvisioned, usdcProvisioned, usdcAddress };
};