/**
 * Vault Guard — Dual-Layer Existence Check (Keychain + Supabase)
 * Protects legacy addresses from accidental overwrite while silently
 * provisioning vaults for truly new users.
 */
import { walletService } from "@/services/walletService";
import { supabase } from "@/integrations/supabase/client";

export interface VaultGuardResult {
  isNewUser: boolean;
  localExists: boolean;
  remoteExists: boolean;
  address: string | null;
}

async function syncWalletToSupabase(address: string, userId: string): Promise<void> {
  console.log("[START] Vault Sync → Supabase", { userId, address });
  try {
    // Defensive: only set if currently null — never overwrite a legacy address
    const { error } = await supabase
      .from("profiles")
      .update({ wallet_address: address })
      .eq("user_id", userId)
      .is("wallet_address", null);
    if (error) {
      console.error("[ERROR] Vault Sync failed:", error.message);
      throw error;
    }
    window.dispatchEvent(new CustomEvent("vault-linked", { detail: { address } }));
    console.log("[END] Vault Sync → Supabase locked");
  } catch (e) {
    console.error("[ERROR] Vault Sync exception:", e);
    throw e;
  }
}

export async function runVaultGuard(userId: string): Promise<VaultGuardResult> {
  console.log("[START] Vault Guard");

  // Local Check
  console.log("[PROCESS] Vault Guard: Local Keychain check");
  let localExists = false;
  try {
    localExists = await walletService.hasWallet();
  } catch (e) {
    console.warn("[WARN] Vault Guard: Local check failed", e);
  }

  // Remote Check
  console.log("[PROCESS] Vault Guard: Remote Supabase check");
  let remoteAddress: string | null = null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("wallet_address")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) console.warn("[WARN] Vault Guard: Remote query error", error.message);
    remoteAddress = (data as any)?.wallet_address || null;
  } catch (e) {
    console.warn("[WARN] Vault Guard: Remote check exception", e);
  }
  const remoteExists = !!remoteAddress;

  // STATE A — Identity exists somewhere → preserve
  if (localExists || remoteExists) {
    console.log(
      `[INFO] Vault Guard: Identity detected in ${localExists ? "Keychain" : "Supabase Profile"}. Preserving identity.`,
    );
    let address: string | null = remoteAddress;
    if (localExists) {
      try {
        const info = await walletService.loadWallet();
        if (info?.address) address = info.address;
      } catch {}
    }
    console.log("[END] Vault Guard: Existing identity preserved");
    return { isNewUser: false, localExists, remoteExists, address };
  }

  // STATE B — Truly new user → silent provision
  console.log("[PROCESS] Vault Guard: Silent vault create (new user)");
  try {
    const { address } = await walletService.createWallet();
    await syncWalletToSupabase(address, userId);
    console.log("[END] Vault Guard: New vault provisioned", { address });
    return { isNewUser: true, localExists: false, remoteExists: false, address };
  } catch (e) {
    console.error("[ERROR] Vault Guard: Silent provision failed", e);
    throw e;
  }
}
