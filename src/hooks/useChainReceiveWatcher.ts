/**
 * useChainReceiveWatcher — polls Base RPC for the connected wallet's
 * ETH, IDIA, and USDC balances and fires `onReceive` when any balance
 * increases. First-run baselines silently (never fires on initial load).
 */
import { useEffect, useRef } from "react";
import { ethers } from "ethers";
import { PROTOCOL } from "@/config/contracts";

const USDC_ADDRESS = PROTOCOL.usdc;
const IDIA_ADDRESS = PROTOCOL.idiaToken;

const resolveBaseRpc = (): string => {
  console.log("🟢 [RPC_RESOLVER][START] Evaluating Base RPC endpoint configuration...");

  const env = (import.meta as any).env;
  console.log("🟢 [RPC_RESOLVER][DEBUG] import.meta.env object present:", !!env);

  const raw = env?.VITE_ALCHEMY_RPC_URL;
  console.log(
    "🟢 [RPC_RESOLVER][DEBUG] Raw value extracted from env:",
    raw ? `[Length: ${String(raw).length} chars]` : "UNDEFINED/NULL",
  );

  if (!raw) {
    console.warn(
      "⚠️ [RPC_RESOLVER][FALLBACK] VITE_ALCHEMY_RPC_URL is missing from environment. Deflecting to public node.",
    );
    console.log("🟢 [RPC_RESOLVER][END] Returning public Base node endpoint.");
    return "https://mainnet.base.org";
  }

  // Strip possible literal wrapped quotes baked in by certain bundler/deployment setups
  const cleaned = String(raw)
    .trim()
    .replace(/^["']|["']$/g, "");
  console.log(`🟢 [RPC_RESOLVER][DEBUG] Sanitized target URL: "${cleaned}"`);

  const regex = /^https:\/\/\S+$/;
  const isValid = regex.test(cleaned);
  console.log("🟢 [RPC_RESOLVER][DEBUG] Regex string validation check passed:", isValid);

  if (isValid) {
    console.log("🟢 [RPC_RESOLVER][END] Active Alchemy RPC endpoint resolved successfully.");
    return cleaned;
  }

  console.warn(
    "⚠️ [RPC_RESOLVER][FALLBACK] Cleaned URL string failed regex format verification. Deflecting to public node.",
  );
  console.log("🟢 [RPC_RESOLVER][END] Returning public Base node endpoint.");
  return "https://mainnet.base.org";
};

const ERC20_ABI = ["function balanceOf(address account) view returns (uint256)"];
const POLL_MS = 30_000;
const RPC_DELAY_MS = 400;

export type ChainAsset = "ETH" | "IDIA" | "USDC";

export interface ChainReceipt {
  asset: ChainAsset;
  amount: number;
  address: string;
  observed_at: string;
}

interface BalanceSnapshot {
  eth: number;
  idia: number;
  usdc: number;
}

const sleep = (ms: number) => {
  return new Promise((r) => setTimeout(r, ms));
};

const readSeen = (address: string): BalanceSnapshot | null => {
  try {
    const raw = localStorage.getItem(`idia_chain_seen_v1:${address.toLowerCase()}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.eth === "number" && typeof parsed?.idia === "number" && typeof parsed?.usdc === "number") {
      return parsed;
    }
  } catch {}
  return null;
};

const writeSeen = (address: string, snap: BalanceSnapshot) => {
  try {
    localStorage.setItem(`idia_chain_seen_v1:${address.toLowerCase()}`, JSON.stringify(snap));
  } catch {}
};

export function useChainReceiveWatcher(
  walletAddress: string | null | undefined,
  onReceive: (receipt: ChainReceipt) => void,
) {
  const onReceiveRef = useRef(onReceive);
  useEffect(() => {
    onReceiveRef.current = onReceive;
  }, [onReceive]);

  useEffect(() => {
    console.log("🟢 [WATCHER_LIFECYCLE][START] useChainReceiveWatcher effect hook ignited.");
    console.log("🟢 [WATCHER_LIFECYCLE][CHECK] Target wallet address parameter:", walletAddress);

    if (!walletAddress || !walletAddress.startsWith("0x")) {
      console.log(
        "⚠️ [WATCHER_LIFECYCLE][ABORT] Address invalid or missing hex prefix. Terminating watcher loop initialization.",
      );
      return;
    }

    let cancelled = false;
    const address = walletAddress;
    let previous: BalanceSnapshot | null = readSeen(address);

    console.log("🟢 [WATCHER_LIFECYCLE][INIT] Local state cached balance historical record found:", !!previous);

    const rpcEndpoint = resolveBaseRpc();
    console.log(`🟢 [WATCHER_LIFECYCLE][CONNECT] Building JsonRpcProvider connection pipe to: ${rpcEndpoint}`);

    const provider = new ethers.JsonRpcProvider(rpcEndpoint, ethers.Network.from(8453), {
      staticNetwork: ethers.Network.from(8453),
    });

    const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
    const idia = new ethers.Contract(IDIA_ADDRESS, ERC20_ABI, provider);

    const tick = async () => {
      console.log(`🟢 [POLL_LOOP][TICK_START] Beginning token metric pull for wallet target: ${address}`);
      try {
        console.log("🟢 [POLL_LOOP][RPC_CALL] Fetching USDC token contract allocation balance...");
        const rawUsdc = await usdc.balanceOf(address).catch((err) => {
          console.error("🔴 [POLL_LOOP][RPC_ERROR] USDC balance query execution dropped:", err);
          return 0n;
        });
        console.log(
          `🟢 [POLL_LOOP][RPC_SUCCESS] USDC tracking completed. Hex value data payload: ${rawUsdc.toString()}`,
        );

        console.log(`🟢 [POLL_LOOP][THROTTLE_DELAY] Entering standard cooldown hold for ${RPC_DELAY_MS}ms...`);
        await sleep(RPC_DELAY_MS);
        console.log("🟢 [POLL_LOOP][THROTTLE_DELAY] Cooldown complete. Continuing execution.");

        if (cancelled) {
          console.log("⚠️ [POLL_LOOP][ABORT] Watcher effect unmounted during contract delay. Halting execution flow.");
          return;
        }

        console.log("🟢 [POLL_LOOP][RPC_CALL] Fetching IDIA token contract allocation balance...");
        const rawIdia = await idia.balanceOf(address).catch((err) => {
          console.error("🔴 [POLL_LOOP][RPC_ERROR] IDIA balance query execution dropped:", err);
          return 0n;
        });
        console.log(
          `🟢 [POLL_LOOP][RPC_SUCCESS] IDIA tracking completed. Hex value data payload: ${rawIdia.toString()}`,
        );

        console.log(`🟢 [POLL_LOOP][THROTTLE_DELAY] Entering standard cooldown hold for ${RPC_DELAY_MS}ms...`);
        await sleep(RPC_DELAY_MS);
        console.log("🟢 [POLL_LOOP][THROTTLE_DELAY] Cooldown complete. Continuing execution.");

        if (cancelled) {
          console.log("⚠️ [POLL_LOOP][ABORT] Watcher effect unmounted during contract delay. Halting execution flow.");
          return;
        }

        console.log("🟢 [POLL_LOOP][RPC_CALL] Querying chain provider for native Base ETH allocation...");
        const rawEth = await provider.getBalance(address).catch((err) => {
          console.error("🔴 [POLL_LOOP][RPC_ERROR] Native balance check query failed on provider execution:", err);
          return 0n;
        });
        console.log(
          `🟢 [POLL_LOOP][RPC_SUCCESS] Native Base ETH tracking completed. Hex value payload: ${rawEth.toString()}`,
        );

        if (cancelled) {
          console.log(
            "⚠️ [POLL_LOOP][ABORT] Target hook flag canceled execution before block compilation step reached.",
          );
          return;
        }

        const current: BalanceSnapshot = {
          eth: Number(ethers.formatEther(rawEth)),
          idia: Number(ethers.formatEther(rawIdia)),
          usdc: Number(ethers.formatUnits(rawUsdc, 6)),
        };

        console.log("🟢 [POLL_LOOP][DATA_COMPILE] Generated state snapshots:", JSON.stringify(current));

        if (previous) {
          console.log("🟢 [POLL_LOOP][EVALUATION] Delta delta checks processing against local benchmark reference...");
          const checks: Array<[ChainAsset, number, number]> = [
            ["ETH", current.eth, previous.eth],
            ["IDIA", current.idia, previous.idia],
            ["USDC", current.usdc, previous.usdc],
          ];

          for (const [asset, now, then] of checks) {
            const delta = now - then;
            console.log(
              `🟢 [POLL_LOOP][EVALUATION_METRIC] Asset: ${asset} | Prior: ${then} | Now: ${now} | Delta: ${delta}`,
            );

            // small floor to ignore floating-point noise (~1 gwei worth of ETH, $0.0001)
            if (delta > 0.0000001) {
              console.log(
                `🟢 [POLL_LOOP][EVENT_TRIGGER] Positive balance modification discovered for ${asset}. Dispatching trigger...`,
              );
              onReceiveRef.current({
                asset,
                amount: delta,
                address,
                observed_at: new Date().toISOString(),
              });
            }
          }
        } else {
          console.log(
            "🟢 [POLL_LOOP][BASELINE] No history present. Caching current state baseline configuration data silently.",
          );
        }

        previous = current;
        writeSeen(address, current);
        console.log("🟢 [POLL_LOOP][TICK_END] Poll interval processing cycle successfully compiled.");
      } catch (e) {
        console.error(
          "🔴 [POLL_LOOP][FATAL_TICK_FAIL] Critical failure thrown inside poll processing sequence loop wrapper:",
          e,
        );
      }
    };

    // Prime baseline immediately, then poll on interval
    tick();
    const interval = setInterval(tick, POLL_MS);

    return () => {
      console.log(
        "🟢 [WATCHER_LIFECYCLE][CLEANUP] Hooks tear-down sequence initiated. Clearing intervals and canceling active processing cycles.",
      );
      cancelled = true;
      clearInterval(interval);
      console.log("🟢 [WATCHER_LIFECYCLE][END] useChainReceiveWatcher loop completely deactivated.");
    };
  }, [walletAddress]);
}
