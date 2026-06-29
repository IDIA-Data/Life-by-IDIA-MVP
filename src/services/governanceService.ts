/**
 * Governance Service — On-chain Governor interaction layer.
 *
 * Reads proposal state from the IDIAGovernor contract and provides
 * write functions for proposing and voting. Write operations require
 * a connected signer from walletService.
 */

import { ethers } from "ethers";
import { supabase } from "../integrations/supabase/client";
import { walletService, NETWORKS } from "./walletService";
import {
  PROTOCOL,
  ACTIVE_DEPLOYMENT,
  GOVERNOR_ABI,
  IDIA_TOKEN_ABI,
  PROPOSAL_STATES,
  BLOCKS_PER_DAY,
} from "../config/contracts";

// ── Types ────────────────────────────────────────────────────────────

export interface ProposalOnChain {
  proposalId: string;
  proposer: string;
  description: string;
  state: number;
  stateName: string;
  forVotes: string;
  againstVotes: string;
  abstainVotes: string;
  voteStart: number;
  voteEnd: number;
  hasVoted: boolean;
  targets: string[];
  values: string[];
  calldatas: string[];
}

export interface GovernorParams {
  votingDelay: number;
  votingPeriod: number;
  proposalThreshold: string;
  quorumNumerator: number;
  quorumDenominator: number;
  minVotingDelay: number;
  maxVotingDelay: number;
  minVotingPeriod: number;
  maxVotingPeriod: number;
  isPaused: boolean;
}

export interface GaslessBallotSignature {
  signature: string;
  v: number;
  r: string;
  s: string;
  signerAddress: string;
}

export interface StrictCastVoteBySigRelayPayload {
  actionType: "CAST_VOTE";
  proposalId: string;
  support: 0 | 1 | 2;
  voteWeight: string;
  tophatOverride: false;
  voterAddress: string;
  voter: string;
  acaHash: string;
  chainId: number;
  signature: string;
}

// ── Service ──────────────────────────────────────────────────────────

// Module-level caches (shared across all proposal cards) so we don't hammer
// the public Base RPC every time a card mounts. Quorum is a snapshot-bound
// value that effectively never changes within a vote window, so a 60s TTL
// keeps the UI accurate without flooding the node.
const QUORUM_TTL_MS = 60_000;
const _quorumCache = new Map<string, { value: string; at: number }>();
const _inflight = new Map<string, Promise<string>>();
const STRICT_CAST_VOTE_BY_SIG_ABI = [
  "function castVoteBySig(uint256 proposalId, uint8 support, address voter, bytes signature) returns (uint256)",
];

class GovernanceService {
  // Cache provider so all calls share one instance
  private _provider: ethers.JsonRpcProvider | null = null;

  private getProvider(): ethers.JsonRpcProvider {
    if (!this._provider) {
      const networkKey = ACTIVE_DEPLOYMENT === "mainnet" ? "base" : "baseSepolia";
      const network = NETWORKS[networkKey];
      this._provider = new ethers.JsonRpcProvider(network.rpcUrl, network.chainId, {
        batchMaxCount: 5,
      });
    }
    return this._provider;
  }

  // Small delay to avoid RPC rate limits
  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  /**
   * Retry an RPC call with exponential backoff when the node returns a
   * rate-limit error (-32016 / 429 / "rate limit"). Non-rate-limit errors
   * propagate immediately. Keeps quorum accurate under RPC pressure.
   */
  private async withRpcRetry<T>(fn: () => Promise<T>, label: string, max = 3): Promise<T> {
    let lastErr: any;
    for (let i = 0; i < max; i++) {
      try {
        return await fn();
      } catch (e: any) {
        lastErr = e;
        const code = e?.info?.error?.code ?? e?.code;
        const msg = (e?.info?.error?.message || e?.shortMessage || e?.message || "").toLowerCase();
        const rateLimited = code === -32016 || code === 429 || msg.includes("rate limit") || msg.includes("throttle");
        if (!rateLimited) throw e;
        const wait = 600 * Math.pow(2, i) + Math.floor(Math.random() * 250);
        console.warn(`[RPC_RETRY] ${label} rate-limited, retry ${i + 1}/${max} in ${wait}ms`);
        await this.delay(wait);
      }
    }
    throw lastErr;
  }

  /** Cached + de-duplicated quorum lookup. Multiple callers share one RPC. */
  private async cachedQuorum(key: string, loader: () => Promise<string>): Promise<string> {
    const hit = _quorumCache.get(key);
    if (hit && Date.now() - hit.at < QUORUM_TTL_MS) return hit.value;
    const existing = _inflight.get(key);
    if (existing) return existing;
    const p = (async () => {
      try {
        const value = await loader();
        _quorumCache.set(key, { value, at: Date.now() });
        return value;
      } finally {
        _inflight.delete(key);
      }
    })();
    _inflight.set(key, p);
    return p;
  }

  /** Trigger the governance-indexer edge function to run immediately. */
  private async triggerIndexer(): Promise<void> {
    try {
      await supabase.functions.invoke("governance-indexer", { body: {} });
      console.log("[GovernanceService] Indexer triggered");
    } catch (e: any) {
      console.warn("[GovernanceService] Failed to trigger indexer:", e?.message || e);
    }
  }

  private getGovernorReadOnly(): ethers.Contract {
    return new ethers.Contract(PROTOCOL.governor, GOVERNOR_ABI, this.getProvider());
  }

  private getTokenReadOnly(): ethers.Contract {
    return new ethers.Contract(PROTOCOL.idiaToken, IDIA_TOKEN_ABI, this.getProvider());
  }

  // ── Read: Governor Parameters ─────────────────────────────

  async getGovernorParams(): Promise<GovernorParams> {
    const gov = this.getGovernorReadOnly();

    // Explicit, independent resolution to prevent individual contract method crashes
    let votingDelay = 0;
    let votingPeriod = 0;
    let proposalThreshold = 0n;
    let quorumNumerator = 0;
    let quorumDenominator = 1;
    let minVotingDelay = 0;
    let maxVotingDelay = 0;
    let minVotingPeriod = 0;
    let maxVotingPeriod = 0;
    let isPaused = false;

    try {
      votingDelay = Number(await gov.votingDelay());
    } catch (e) {
      console.warn("[GovernanceService] votingDelay missing");
    }
    try {
      votingPeriod = Number(await gov.votingPeriod());
    } catch (e) {
      console.warn("[GovernanceService] votingPeriod missing");
    }
    try {
      proposalThreshold = await gov.proposalThreshold();
    } catch (e) {
      console.warn("[GovernanceService] proposalThreshold missing");
    }
    try {
      quorumNumerator = Number(await gov.quorumNumerator());
    } catch (e) {
      console.warn("[GovernanceService] quorumNumerator missing");
    }
    try {
      quorumDenominator = Number(await gov["QUORUM_DENOMINATOR"]());
    } catch (e) {
      console.warn("[GovernanceService] QUORUM_DENOMINATOR missing");
    }
    try {
      minVotingDelay = Number(await gov.minVotingDelay());
    } catch (e) {
      console.warn("[GovernanceService] minVotingDelay missing");
    }
    try {
      maxVotingDelay = Number(await gov.maxVotingDelay());
    } catch (e) {
      console.warn("[GovernanceService] maxVotingDelay missing");
    }
    try {
      minVotingPeriod = Number(await gov.minVotingPeriod());
    } catch (e) {
      console.warn("[GovernanceService] minVotingPeriod missing");
    }
    try {
      maxVotingPeriod = Number(await gov.maxVotingPeriod());
    } catch (e) {
      console.warn("[GovernanceService] maxVotingPeriod missing");
    }
    try {
      isPaused = await gov.proposalsPaused();
    } catch (e) {
      console.warn("[GovernanceService] proposalsPaused missing");
    }

    return {
      votingDelay,
      votingPeriod,
      proposalThreshold: ethers.formatEther(proposalThreshold),
      quorumNumerator,
      quorumDenominator,
      minVotingDelay,
      maxVotingDelay,
      minVotingPeriod,
      maxVotingPeriod,
      isPaused,
    };
  }

  // Replace failing direct calls with raw call encoding
  private async callRaw(methodName: string, params: any[] = []): Promise<any> {
    const iface = new ethers.Interface(GOVERNOR_ABI);
    const data = iface.encodeFunctionData(methodName, params);
    const provider = this.getProvider();

    try {
      const result = await provider.call({
        to: PROTOCOL.governor,
        data: data,
      });
      return iface.decodeFunctionResult(methodName, result)[0];
    } catch (e) {
      console.error(`[GovernanceService] Raw call error for ${methodName}:`, e);
      return null;
    }
  }

  // Computes quorum as numerator * delegatedSupply / denominator
  private async computeQuorumFromSupply(timepoint?: number): Promise<bigint | null> {
    try {
      const provider = this.getProvider();
      const TOKEN_ABI = [
        "function getPastTotalSupply(uint256 timepoint) view returns (uint256)",
        "function totalSupply() view returns (uint256)",
      ];
      const token = new ethers.Contract(PROTOCOL.idiaToken, TOKEN_ABI, provider);

      const [numeratorRaw, denominatorRaw] = await Promise.all([
        this.callRaw("quorumNumerator", []).catch(() => null),
        this.callRaw("QUORUM_DENOMINATOR", []).catch(() => null),
      ]);

      const numerator = numeratorRaw != null ? BigInt(numeratorRaw) : 4n;
      const denominator = denominatorRaw != null ? BigInt(denominatorRaw) : 100n;

      if (denominator === 0n) return null;

      let supply = 0n;
      let usedFallback = false;

      try {
        const targetBlock = timepoint ?? (await provider.getBlockNumber()) - 1;
        supply = await token.getPastTotalSupply(targetBlock);
      } catch (e) {
        console.warn(
          "[QUORUM_FALLBACK] getPastTotalSupply failed or unavailable. Falling back to totalSupply (Warning: inflated value).",
        );
        supply = await token.totalSupply().catch(() => 0n);
        usedFallback = true;
      }

      if (supply === 0n) return null;

      const q = (supply * numerator) / denominator;
      console.log(
        `[QUORUM_FALLBACK] ${usedFallback ? "totalSupply" : "delegatedSupply"}=${supply} num=${numerator} den=${denominator} → quorum=${q}`,
      );
      return q;
    } catch (e) {
      console.warn("[QUORUM_FALLBACK] computeQuorumFromSupply failed", e);
      return null;
    }
  }

  // Uses raw caller, with deterministic delegated-supply fallback.
  async getCurrentQuorum(): Promise<string> {
    return this.cachedQuorum("current", async () => {
      const provider = this.getProvider();
      try {
        const blockNumber = await this.withRpcRetry(() => provider.getBlockNumber(), "getBlockNumber");
        const quorum = await this.withRpcRetry(() => this.callRaw("quorum", [blockNumber - 1]), "quorum(current)");
        if (quorum && BigInt(quorum) > 0n) {
          return ethers.formatEther(quorum);
        }
        console.warn("[QUORUM_FALLBACK] Governor.quorum() returned 0 — computing from delegated supply");
        const computed = await this.computeQuorumFromSupply(blockNumber - 1);
        return computed ? ethers.formatEther(computed) : "0";
      } catch (e) {
        console.warn("[GovernanceService] getCurrentQuorum failed after retries", e);
        const currentBlock = await provider.getBlockNumber().catch(() => undefined);
        const computed = await this.computeQuorumFromSupply(currentBlock ? currentBlock - 1 : undefined);
        return computed ? ethers.formatEther(computed) : "0";
      }
    });
  }

  // ── Read: Exact Proposal Quorum ───────────────────────────

  async getProposalQuorum(proposalId: string): Promise<string> {
    return this.cachedQuorum(`prop:${proposalId}`, async () => {
      const gov = this.getGovernorReadOnly();
      try {
        const snapshotBlock = await this.withRpcRetry(
          () => gov.proposalSnapshot(proposalId),
          `proposalSnapshot(${proposalId})`,
        );
        if (Number(snapshotBlock) === 0) {
          const computed = await this.computeQuorumFromSupply();
          return computed ? ethers.formatEther(computed) : "0";
        }

        const quorum = await this.withRpcRetry(() => gov.quorum(snapshotBlock), `quorum(${proposalId})`);
        if (BigInt(quorum) > 0n) return ethers.formatEther(quorum);

        console.warn(`[QUORUM_FALLBACK] proposal ${proposalId} quorum=0 — falling back to delegated supply math`);
        const computed = await this.computeQuorumFromSupply(Number(snapshotBlock));
        return computed ? ethers.formatEther(computed) : "0";
      } catch (error) {
        console.error(`[GovernanceService] Quorum fetch failed for proposal ${proposalId} after retries:`, error);
        // Fall back to current block logic if snapshot lookup fails
        const provider = this.getProvider();
        const currentBlock = await provider.getBlockNumber().catch(() => undefined);
        const computed = await this.computeQuorumFromSupply(currentBlock ? currentBlock - 1 : undefined);
        return computed ? ethers.formatEther(computed) : "0";
      }
    });
  }

  // ── Read: Delegation info ─────────────────────────────────

  async getDelegationInfo(address: string): Promise<{
    balance: string;
    votingPower: string;
    delegatee: string;
    isDelegated: boolean;
    isSelfDelegated: boolean;
  }> {
    const token = this.getTokenReadOnly();
    const [balance, votes, delegatee] = await Promise.all([
      token.balanceOf(address).catch(() => 0n),
      token.getVotes(address).catch(() => 0n),
      token.delegates(address).catch(() => ethers.ZeroAddress),
    ]);

    const isDelegated = delegatee !== ethers.ZeroAddress;
    const isSelfDelegated = delegatee.toLowerCase() === address.toLowerCase();

    return {
      balance: ethers.formatEther(balance),
      votingPower: ethers.formatEther(votes),
      delegatee,
      isDelegated,
      isSelfDelegated,
    };
  }

  // ── Read: Proposals from Database (Optimized) ─────────────

  async getRecentProposals(address: string): Promise<ProposalOnChain[]> {
    const network = ACTIVE_DEPLOYMENT === "mainnet" ? "mainnet" : "testnet";
    console.log(`[GovernanceService] Fetching proposals from database (network: ${network})`);

    const { data: dbProposals, error } = await supabase
      .from("governance_proposals")
      .select("*")
      .eq("network", network)
      .order("block_created", { ascending: false });

    if (error || !dbProposals || dbProposals.length === 0) {
      console.warn("[GovernanceService] Database query empty or failed:", error?.message);
      return [];
    }

    const gov = this.getGovernorReadOnly();
    const proposals: ProposalOnChain[] = [];

    // Process sequentially to protect the RPC node
    for (const row of dbProposals as any[]) {
      let hasVoted = false;
      if (address) {
        try {
          hasVoted = await gov.hasVoted(row.proposal_id, address);
          if (dbProposals.length > 3) await this.delay(200);
        } catch {
          // Fallback to false if the RPC node stalls on this specific check
        }
      }

      proposals.push({
        proposalId: row.proposal_id,
        proposer: row.proposer,
        description: row.description,
        state: row.state,
        stateName: row.state_name || PROPOSAL_STATES[row.state] || "Unknown",
        forVotes: row.for_votes || "0",
        againstVotes: row.against_votes || "0",
        abstainVotes: row.abstain_votes || "0",
        voteStart: Number(row.vote_start),
        voteEnd: Number(row.vote_end),
        hasVoted,
        targets: row.targets || [],
        values: row.callvalues || [],
        calldatas: row.calldatas || [],
      });
    }

    return proposals;
  }

  // ── Read: Single proposal state ───────────────────────────

  async getProposalState(proposalId: string): Promise<{
    state: number;
    stateName: string;
    forVotes: string;
    againstVotes: string;
    abstainVotes: string;
  }> {
    const gov = this.getGovernorReadOnly();
    const [state, votes] = await Promise.all([
      gov.state(proposalId).catch(() => 0),
      gov.proposalVotes(proposalId).catch(() => [0n, 0n, 0n]),
    ]);

    return {
      state: Number(state),
      stateName: PROPOSAL_STATES[Number(state)] || "Unknown",
      againstVotes: ethers.formatEther(votes[0]),
      forVotes: ethers.formatEther(votes[1]),
      abstainVotes: ethers.formatEther(votes[2]),
    };
  }

  // ── Write: Create proposal ───────────────────────────────

  async propose(
    description: string,
    targets: string[] = [PROTOCOL.idiaToken],
    values: string[] = ["0"],
    calldatas: string[] = ["0x"],
  ): Promise<{ hash: string; proposalId?: string }> {
    const signer = walletService.getConnectedSigner();
    if (!signer) throw new Error("Wallet not connected");

    console.log("[PROPOSAL_SUBMIT][ALIGNMENT][START] Compiling and sanitizing calldata vectors.");
    const cleanTargets = targets.map((t) => ethers.getAddress(t.trim()));
    const cleanValues = values.map((v) => BigInt(v));
    const cleanCalldatas = calldatas.map((c) => (c.startsWith("0x") ? c : `0x${c}`));
    if (cleanTargets.length !== cleanValues.length || cleanTargets.length !== cleanCalldatas.length) {
      console.error("🚨 [PROPOSAL_SUBMIT][ALIGNMENT][FAIL] Mismatched array parameter metrics.");
      throw new Error("Array length mismatch: targets, values, and calldatas must align.");
    }
    const cleanDescription = description.trim();
    console.log("[PROPOSAL_SUBMIT][ALIGNMENT][SUCCESS]", {
      targets: cleanTargets,
      values: cleanValues.map(String),
      calldatas: cleanCalldatas,
      description: cleanDescription,
    });

    // Strict OZ v4 ABI — only the canonical 4-arg propose. Prevents ethers
    // from ever resolving to the Bravo-style 5-arg overload (selector
    // 0x3bccf4fd) that the IDIAGovernor contract does NOT implement.
    const STRICT_PROPOSE_ABI = [
      "function propose(address[] targets, uint256[] values, bytes[] calldatas, string description) returns (uint256)",
    ];
    const gov = new ethers.Contract(PROTOCOL.governor, STRICT_PROPOSE_ABI, signer);
    const proposeFn = gov.getFunction("propose(address[],uint256[],bytes[],string)");
    console.log("[PROPOSAL_SUBMIT][RELAY_DISPATCH][START] Broadcasting strict 4-argument payload.", {
      selector: proposeFn.fragment.selector,
      signature: proposeFn.fragment.format("sighash"),
    });
    try {
      const tx = await proposeFn(cleanTargets, cleanValues, cleanCalldatas, cleanDescription);
      const receipt = await tx.wait();
      console.log("[PROPOSAL_SUBMIT][RELAY_DISPATCH][SUCCESS] On-chain proposal initialized successfully.");
      const proposalId = this.extractProposalIdFromReceipt(
        receipt,
        cleanTargets,
        cleanValues.map((v) => v.toString()),
        cleanCalldatas,
        cleanDescription,
      );
      this.triggerIndexer().catch(() => {});
      return { hash: tx.hash, proposalId };
    } catch (err: any) {
      console.error(
        "[PROPOSAL_SUBMIT][RELAY_DISPATCH][FATAL_FAIL] Core transaction thread snapped. Reason: ",
        err?.message ?? err,
      );
      throw err;
    }
  }

  // ── Write: Create proposal with custom timing ─────────────

  async proposeWithTiming(
    description: string,
    customDelay: number,
    customPeriod: number,
    targets: string[] = [PROTOCOL.idiaToken],
    values: string[] = ["0"],
    calldatas: string[] = ["0x"],
  ): Promise<{ hash: string; proposalId?: string }> {
    const signer = walletService.getConnectedSigner();
    if (!signer) throw new Error("Wallet not connected");

    console.log("[PROPOSAL_SUBMIT][ALIGNMENT][START] Compiling and sanitizing calldata vectors (timed).");
    const cleanTargets = targets.map((t) => ethers.getAddress(t.trim()));
    const cleanValues = values.map((v) => BigInt(v));
    const cleanCalldatas = calldatas.map((c) => (c.startsWith("0x") ? c : `0x${c}`));
    if (cleanTargets.length !== cleanValues.length || cleanTargets.length !== cleanCalldatas.length) {
      console.error("🚨 [PROPOSAL_SUBMIT][ALIGNMENT][FAIL] Mismatched array parameter metrics (timed).");
      throw new Error("Array length mismatch: targets, values, and calldatas must align.");
    }
    const cleanDescription = description.trim();
    console.log("[PROPOSAL_SUBMIT][ALIGNMENT][SUCCESS] (timed)", {
      targets: cleanTargets,
      values: cleanValues.map(String),
      calldatas: cleanCalldatas,
      description: cleanDescription,
      customDelay,
      customPeriod,
    });

    const gov = new ethers.Contract(PROTOCOL.governor, GOVERNOR_ABI, signer);
    console.log("[PROPOSAL_SUBMIT][RELAY_DISPATCH][START] Broadcasting timed payload to contract address...");
    try {
      const tx = await gov.proposeWithTiming(
        cleanTargets,
        cleanValues,
        cleanCalldatas,
        cleanDescription,
        customDelay,
        customPeriod,
      );
      const receipt = await tx.wait();
      console.log("[PROPOSAL_SUBMIT][RELAY_DISPATCH][SUCCESS] On-chain timed proposal initialized successfully.");
      const proposalId = this.extractProposalIdFromReceipt(
        receipt,
        cleanTargets,
        cleanValues.map((v) => v.toString()),
        cleanCalldatas,
        cleanDescription,
      );
      this.triggerIndexer().catch(() => {});
      return { hash: tx.hash, proposalId };
    } catch (err: any) {
      console.error(
        "[PROPOSAL_SUBMIT][RELAY_DISPATCH][FATAL_FAIL] Timed transaction thread snapped. Reason: ",
        err?.message ?? err,
      );
      throw err;
    }
  }

  // ── Write: Cast vote ──────────────────────────────────────

  async castVote(proposalId: string, support: 0 | 1 | 2, reason?: string): Promise<{ hash: string }> {
    const signer = walletService.getConnectedSigner();
    if (!signer) throw new Error("Wallet not connected");

    const gov = new ethers.Contract(PROTOCOL.governor, GOVERNOR_ABI, signer);

    const tx = reason
      ? await gov.castVoteWithReason(proposalId, support, reason)
      : await gov.castVote(proposalId, support);

    await tx.wait();
    this.triggerIndexer().catch(() => {});
    return { hash: tx.hash };
  }

  /**
   * Resolves the authoritative EIP-712 domain for the Governor contract.
   * Prefers EIP-5267 `eip712Domain()` (OZ v4.7+) which returns the exact tuple
   * used by `_domainSeparatorV4()` on-chain. Falls back to `name()` + hardcoded
   * `version="1"` + ACTIVE_DEPLOYMENT chainId only if the contract pre-dates 5267.
   */
  private async getGovernorEip712Domain(): Promise<{
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
    source: "chain" | "fallback";
  }> {
    const provider = this.getProvider();
    const EIP5267_ABI = [
      "function eip712Domain() view returns (bytes1 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions)",
    ];
    try {
      const gov = new ethers.Contract(PROTOCOL.governor, EIP5267_ABI, provider);
      const res = await gov.eip712Domain();
      const resolved = {
        name: String(res[1]),
        version: String(res[2]),
        chainId: Number(res[3]),
        verifyingContract: String(res[4]),
        source: "chain" as const,
      };
      console.log("[GOV_VOTE][DOMAIN][CHAIN_TRUTH]", resolved);
      return resolved;
    } catch (err: any) {
      console.warn(
        "[GOV_VOTE][DOMAIN][FALLBACK] eip712Domain() unavailable, deriving manually:",
        err?.shortMessage || err?.message,
      );
      let name = "IDIAGovernor";
      try {
        const gov = new ethers.Contract(PROTOCOL.governor, ["function name() view returns (string)"], provider);
        name = (await gov.name()) || name;
      } catch {
        /* keep default */
      }
      const fallback = {
        name,
        version: "1",
        chainId: ACTIVE_DEPLOYMENT === "mainnet" ? 8453 : 84532,
        verifyingContract: PROTOCOL.governor,
        source: "fallback" as const,
      };
      console.log("[GOV_VOTE][DOMAIN][FALLBACK] resolved", fallback);
      return fallback;
    }
  }

  /**
   * Gasless EIP-712 Ballot signing for OpenZeppelin Governor's `castVoteBySig`.
   * The user's local signer signs offline; the relayer broadcasts the tx.
   */
  async signBallot(proposalId: string | number | bigint, support: 0 | 1 | 2): Promise<GaslessBallotSignature> {
    console.log("[GOV_VOTE][SIGN_BALLOT][START] Initiating gasless ballot signature sequence.");
    try {
      const signer = walletService.getConnectedSigner();
      if (!signer) {
        console.error("[GOV_VOTE][SIGN_BALLOT][FATAL_STALL] Wallet not connected.");
        throw new Error("Wallet not connected");
      }
      const signerAddress = await signer.getAddress();
      console.log(`[GOV_VOTE][SIGN_BALLOT][STEP_1] Signer resolved: ${signerAddress}`);

      // Normalize proposalId to a raw BigInt ONCE. Never .toString() / Number()
      // before signing — uint256 EIP-712 hashing requires the integer itself.
      const proposalIdBig: bigint = typeof proposalId === "bigint" ? proposalId : BigInt(proposalId);

      console.log("[GOV_VOTE][SIGN_BALLOT][STEP_2] Fetching dynamic EIP-712 domain truth from Base Mainnet...");

      // 1. Connect directly to the Governor to read its immutable domain strings (EIP-5267).
      const govRead = new ethers.Contract(
        PROTOCOL.governor,
        [
          "function eip712Domain() view returns (bytes1 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions)",
        ],
        (signer as any).provider || this.getProvider(),
      );

      console.log("[GOV_VOTE][SIGN_BALLOT][STEP_2A] Invoking eip712Domain() on contract:", PROTOCOL.governor);
      const onChainDomain = await govRead.eip712Domain();
      console.log("[GOV_VOTE][SIGN_BALLOT][STEP_2B] Raw on-chain domain tuple received:", {
        fields: onChainDomain.fields,
        name: onChainDomain.name,
        version: onChainDomain.version,
        chainId: onChainDomain.chainId?.toString?.(),
        verifyingContract: onChainDomain.verifyingContract,
      });

      // 2. Map the exact on-chain strings to the signing domain.
      const domain = {
        name: onChainDomain.name,
        version: onChainDomain.version,
        chainId: Number(onChainDomain.chainId),
        verifyingContract: onChainDomain.verifyingContract,
      };

      console.log(
        `[GOV_VOTE][SIGN_BALLOT][DOMAIN_TRUTH] name="${domain.name}" version="${domain.version}" chainId=${domain.chainId} verifyingContract=${domain.verifyingContract}`,
      );

      // Fetch the Governor's per-voter nonce for v5 replay protection.
      const govNonceRead = new ethers.Contract(
        PROTOCOL.governor,
        ["function nonces(address) view returns (uint256)"],
        (signer as any).provider || this.getProvider(),
      );
      const voterNonce: bigint = await govNonceRead.nonces(signerAddress);

      const types = {
        Ballot: [
          { name: "proposalId", type: "uint256" },
          { name: "support", type: "uint8" },
          { name: "voter", type: "address" },
          { name: "nonce", type: "uint256" },
        ],
      };

      // CRITICAL: proposalId MUST be raw BigInt (no .toString()) so it hashes as
      // a 32-byte integer matching the OpenZeppelin v5 contract structure.
      const value = {
        proposalId: proposalIdBig,
        support: Number(support),
        voter: signerAddress,
        nonce: voterNonce,
      };

      // Hard guard — if a regression ever coerces this away from bigint, fail
      // loudly instead of silently producing a mismatched EIP-712 digest.
      if (typeof value.proposalId !== "bigint") {
        throw new Error(
          `[GOV_VOTE][SIGN_BALLOT][FATAL_STALL] proposalId must be bigint for EIP-712 hashing, got ${typeof value.proposalId}`,
        );
      }

      console.log(
        `[GOV_VOTE][SIGN_BALLOT][PAYLOAD_AUDIT] ProposalId: ${value.proposalId.toString()} (Type: ${typeof value.proposalId})`,
      );
      console.log(`[GOV_VOTE][SIGN_BALLOT][PAYLOAD_AUDIT] Support: ${value.support} (Type: ${typeof value.support})`);
      console.log(`[GOV_VOTE][SIGN_BALLOT][V5_PAYLOAD] voter=${value.voter} nonce=${value.nonce.toString()}`);

      console.log("[GOV_VOTE][SIGN_BALLOT][STEP_3] Executing signTypedData with dynamic domain...");
      const signature = await (signer as any).signTypedData(domain, types, value);
      console.log("[GOV_VOTE][SIGN_BALLOT][STEP_3][SUCCESS] Raw signature acquired:", signature);

      // NOTE: ethers.verifyTypedData() recovers the signer using the same domain
      // we just signed against — it cannot detect on-chain separator drift. We
      // intentionally skip that check and trust eip712Domain() chain-truth instead.
      console.log(
        '[GOV_VOTE][PRE_FLIGHT][SIGN][SKIP] reason="local recovery cannot validate on-chain separator; trusting eip712Domain() chain-truth instead"',
      );

      const sig = ethers.Signature.from(signature);
      console.log(`[GOV_VOTE][SIGN_BALLOT][END] Ballot signed successfully. v: ${sig.v}, r: ${sig.r}, s: ${sig.s}`);

      return { signature, v: sig.v, r: sig.r, s: sig.s, signerAddress };
    } catch (error: any) {
      console.error("[GOV_VOTE][SIGN_BALLOT][FATAL_STALL] Ballot signature sequence failed:", error?.message || error);
      throw error;
    }
  }

  compileStrictCastVoteBySigRelayPayload(
    proposalId: string | number | bigint,
    support: 0 | 1 | 2,
    ballot: GaslessBallotSignature,
    acaHash: string,
    voteWeight: number | string = 0,
    chainId: number = ACTIVE_DEPLOYMENT === "mainnet" ? 8453 : 84532,
  ): StrictCastVoteBySigRelayPayload {
    console.log("[GOV_VOTE][COMPILE_PAYLOAD][START] Enforcing strict relay payload architecture.");
    try {
      const cleanSupport = Number(support) as 0 | 1 | 2;
      if (cleanSupport !== 0 && cleanSupport !== 1 && cleanSupport !== 2) {
        console.error(`[GOV_VOTE][COMPILE_PAYLOAD][FATAL_STALL] Invalid support value: ${support}`);
        throw new Error(`Invalid vote support value: ${support}`);
      }

      const voter = ballot.signerAddress.toLowerCase();
      // Normalize to a serialized 65-byte hex string regardless of how the wallet returned it.
      const signature = ethers.Signature.from(ballot.signature).serialized;

      console.log(`[GOV_VOTE][COMPILE_PAYLOAD][DATA] Voter: ${voter}, ChainId: ${chainId}, AcaHash: ${acaHash}`);

      const secureRelayBody: StrictCastVoteBySigRelayPayload = {
        actionType: "CAST_VOTE",
        proposalId: proposalId.toString(),
        support: cleanSupport,
        voteWeight: voteWeight.toString(),
        tophatOverride: false,
        voterAddress: voter,
        voter,
        acaHash,
        chainId,
        signature,
      };

      console.log("[GOV_VOTE][COMPILE_PAYLOAD][END] JSON packet configured successfully.");
      return secureRelayBody;
    } catch (error: any) {
      console.error("[GOV_VOTE][COMPILE_PAYLOAD][FATAL_STALL] Payload compilation failed:", error?.message || error);
      throw error;
    }
  }

  // ── Write: Delegate ───────────────────────────────────────

  async delegate(delegatee: string): Promise<{ hash: string }> {
    if (!walletService.getRawWallet()) {
      console.error("[CRITICAL] Wallet service has no wallet instance.");
      throw new Error("Wallet not initialized. Check your storage migration.");
    }

    const signer = walletService.getConnectedSigner();
    if (!signer) throw new Error("Signer could not be connected");

    const token = new ethers.Contract(PROTOCOL.idiaToken, IDIA_TOKEN_ABI, signer);
    const tx = await token.delegate(delegatee);
    await tx.wait();
    return { hash: tx.hash };
  }

  async selfDelegate(): Promise<{ hash: string }> {
    if (!walletService.getRawWallet()) {
      console.error("[CRITICAL] Wallet service has no wallet instance.");
      throw new Error("Wallet not initialized. Check your storage migration.");
    }
    const address = walletService.getAddress();
    if (!address) throw new Error("Wallet not connected");
    return this.delegate(address);
  }

  /**
   * Gasless self-delegation via EIP-712 `delegateBySig` + Supabase relayer.
   * The user's local signer signs the typed-data offline; the relayer pays gas.
   */
  async signAndRelaySelfDelegation(): Promise<{ hash: string; acaHash?: string }> {
    if (!walletService.getRawWallet()) {
      console.error("[CRITICAL] Wallet service has no wallet instance.");
      throw new Error("Wallet not initialized. Check your storage migration.");
    }
    const { supabase } = await import("@/integrations/supabase/client");
    const signer = walletService.getConnectedSigner();
    if (!signer) throw new Error("Signer could not be connected");
    const address = await signer.getAddress();

    const provider = this.getProvider();
    const token = new ethers.Contract(
      PROTOCOL.idiaToken,
      ["function nonces(address) view returns (uint256)", "function name() view returns (string)"],
      provider,
    );

    const [nonceRaw, tokenName] = [await token.nonces(address), await token.name().catch(() => "IDIA")];
    const nonce = Number(nonceRaw);
    const expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour
    const chainId = ACTIVE_DEPLOYMENT === "mainnet" ? 8453 : 84532;

    const domain = {
      name: tokenName,
      version: "1",
      chainId,
      verifyingContract: PROTOCOL.idiaToken,
    };
    const types = {
      Delegation: [
        { name: "delegatee", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "expiry", type: "uint256" },
      ],
    };
    const value = { delegatee: address, nonce, expiry };

    console.log("[SELF_DELEGATE] signing EIP-712 Delegation", { address, nonce, expiry });
    const signature = await (signer as any).signTypedData(domain, types, value);
    const sig = ethers.Signature.from(signature);

    const { data, error } = await supabase.functions.invoke("relay-delegation", {
      body: {
        delegatee: address,
        nonce,
        expiry,
        v: sig.v,
        r: sig.r,
        s: sig.s,
      },
    });
    if (error) throw new Error(error.message || "Relayer call failed");
    if (!data?.tx_hash) throw new Error(data?.error || "Relayer returned no tx hash");
    return { hash: data.tx_hash, acaHash: data.aca_hash };
  }

  async undelegate(): Promise<{ hash: string }> {
    return this.delegate(ethers.ZeroAddress);
  }

  // ── Helpers ───────────────────────────────────────────────

  private extractProposalIdFromReceipt(
    receipt: ethers.TransactionReceipt,
    targets?: string[],
    values?: string[],
    calldatas?: string[],
    description?: string,
  ): string | undefined {
    try {
      const govInterface = new ethers.Interface(GOVERNOR_ABI);
      for (const log of receipt.logs) {
        try {
          const parsed = govInterface.parseLog({ topics: log.topics as string[], data: log.data });
          console.log("[DEBUG_TX_LOGS] Event Parsed:", parsed?.name);
          if (parsed?.name === "ProposalCreated") {
            console.log("[DEBUG_TX_LOGS] ProposalCreated Arg0:", parsed.args[0].toString());
            return parsed.args[0].toString();
          }
        } catch {
          /* not our event */
        }
      }
    } catch (e) {
      console.error("[DEBUG_TX_LOGS] Parse failed:", e);
    }

    // Fallback: compute proposalId deterministically using OZ v4 hashProposal formula.
    if (targets && values && calldatas && description !== undefined) {
      try {
        const descHash = ethers.keccak256(ethers.toUtf8Bytes(description));
        const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
          ["address[]", "uint256[]", "bytes[]", "bytes32"],
          [targets, values.map((v) => BigInt(v)), calldatas, descHash],
        );
        const id = BigInt(ethers.keccak256(encoded)).toString();
        console.log("[DEBUG_TX_LOGS] proposalId derived via hashProposal fallback:", id);
        return id;
      } catch (e) {
        console.error("[DEBUG_TX_LOGS] hashProposal fallback failed:", e);
      }
    }
    return undefined;
  }
}

export const governanceService = new GovernanceService();
