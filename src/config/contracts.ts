/**
 * IDIA Governance Protocol — Contract Configuration
 *
 * Single source of truth for all deployed contract addresses and ABIs.
 *
 * ACTIVE_DEPLOYMENT controls which network the app targets:
 *   'mainnet' (default) — Base mainnet (Chain ID 8453) for production
 *   'testnet'           — Base Sepolia (Chain ID 84532) for internal testing
 *
 * To build for internal testing, change ACTIVE_DEPLOYMENT to 'testnet'.
 * For production releases, leave it as 'mainnet'.
 */

export type DeploymentEnv = "testnet" | "mainnet";

// ─── PRODUCTION LOCK ────────────────────────────────────────────────
// The protocol is LIVE on Base Mainnet (Chain ID 8453). The mainnet
// addresses below are the on-chain source of truth. DO NOT flip this
// toggle to 'testnet' on production branches and DO NOT zero-out the
// mainnet block under any circumstance.
export const ACTIVE_DEPLOYMENT: DeploymentEnv = "mainnet";
// ─────────────────────────────────────────────────────────────────────

interface ProtocolAddresses {
  safe: string;
  treasury: string;
  timelock: string;
  idiaToken: string;
  governor: string;
  registry: string;
  poolFactory: string;
  liabilityReceipt: string;
  escrow: {
    team: string;
    ecosystem: string;
    liquidity: string;
    investors: string;
    publicSale: string;
  };
  usdc: string;
}

const DEPLOYMENTS: Record<DeploymentEnv, ProtocolAddresses> = {
  // ── Base Mainnet (Chain ID 8453) — Production ─────────────────
  mainnet: {
    safe: "0x0910EF34C9F59A90d90FF505B1036DEed4a25d59",
    treasury: "0xd816D83703764551A7F292dbC435669AA89631a7",
    timelock: "0xd3Fd7dD19a4aFD41c8C7FeEdC6d05d77B1141BC5",
    idiaToken: "0x6526F939D257E67896821c25B6C24Daa404a01FB",
    governor: "0x9777067CAd2892D20decAF1a5ccb78e6B291B87a",
    registry: "0x137D913d89d0D6a5b2d1Db76173770C94d25387B",
    poolFactory: "0x0188FCB027D834E03DD0288D360937ceC4d267bb",
    liabilityReceipt: "0x5eA57335f7086f1C069d769a9012835B80a00BD3",
    escrow: {
      team: "0xF0E67683783ef5879b43ef99ab04Bc27A9a71074",
      ecosystem: "0xd052C6F3846b4Fe56E579880Ec9ea2764ABDe708",
      liquidity: "0xdC93412182b2fBf68b4282255d772d6Cd01fE8A1",
      investors: "0xDc93eca954fD2625001b2fb9E9A098914365ADe9",
      publicSale: "0xAE51E24674d9665febC188a8f82a4bB647BF014c",
    },
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },

  // ── Base Sepolia (Chain ID 84532) — Internal Testing ──────────
  testnet: {
    safe: "0x0910EF34C9F59A90d90FF505B1036DEed4a25d59",
    treasury: "0xd816D83703764551A7F292dbC435669AA89631a7",
    timelock: "0xab31029D8A9F2b79233E4fAF8eEb80330613af55",
    idiaToken: "0x18306e920946FA7e42990C5D6F9402750407bF4B",
    governor: "0xc91f062d37f178b766F4424df544c3CA1AC3D7FD",
    registry: "0xDf7e629eb6083FEe5c66DfF3D4b4A682C4cC1C08",
    poolFactory: "0xDf7e629eb6083FEe5c66DfF3D4b4A682C4cC1C08",
    liabilityReceipt: "0x9f7aA33e0Cb21252A7E00C570768a4fd72A06A36",
    escrow: {
      team: "0x5636a3fa473AceD6faaeEC7ebD24c85846A6638B",
      ecosystem: "0x465D3395bf827Cc06d366765d2CE2cBd1b54bBB2",
      liquidity: "0xF6bbc8a8bcbd80E25a6a37BaA9a0271e9f401136",
      investors: "0xb4F5bB829FC7492Df7daA44374eda653245C5F6f",
      publicSale: "0x45BC46e0C52f2d1d2c22BC267Eb5D27c42B8E5f8",
    },
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  },
};

export const PROTOCOL = DEPLOYMENTS[ACTIVE_DEPLOYMENT];

/**
 * Helper to check if we're running in test mode.
 * Use this throughout the app instead of checking ACTIVE_DEPLOYMENT directly.
 */
export const IS_TESTNET = (ACTIVE_DEPLOYMENT as DeploymentEnv) === "testnet";

// ─── BOOT GUARD ─────────────────────────────────────────────────────
// Runtime trace so live production tracking can confirm at a glance
// that the bundle loaded the mainnet block (and not a stale testnet
// build). Fires once on module import.
if ((ACTIVE_DEPLOYMENT as DeploymentEnv) !== "mainnet") {
  console.error("[PROTOCOL][BOOT][END:FAIL] Non-mainnet deployment detected — ACTIVE_DEPLOYMENT =", ACTIVE_DEPLOYMENT);
} else {
  console.log("[PROTOCOL][BOOT][START] Loading mainnet contract config…");
  console.log("[PROTOCOL][BOOT][END:OK] Live · Base Mainnet · idiaToken =", PROTOCOL.idiaToken);
}
// ─────────────────────────────────────────────────────────────────────

// ── Minimal ABIs (only the functions the app needs to call) ─────────

// IDIA Token is a standard ERC20Votes governance token on Base Mainnet.
// All methods below — including `transfer`, `approve`, `delegate`,
// `delegates`, and `getVotes` — are live on-chain. Do NOT strip them on
// the (incorrect) assumption that IDIA is a non-transferable receipt.
export const IDIA_TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function delegate(address delegatee)",
  "function delegateBySig(address delegatee, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s)",
  "function delegates(address account) view returns (address)",
  "function getVotes(address account) view returns (uint256)",
  "function nonces(address owner) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
];

export const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

export const GOVERNOR_ABI = [
  "function name() view returns (string)",
  "function votingDelay() view returns (uint256)",
  "function votingPeriod() view returns (uint256)",
  "function proposalThreshold() view returns (uint256)",
  "function state(uint256 proposalId) view returns (uint8)",
  "function propose(address[] targets, uint256[] values, bytes[] calldatas, string description) returns (uint256)",
  "function castVote(uint256 proposalId, uint8 support) returns (uint256)",
  "function castVoteWithReason(uint256 proposalId, uint8 support, string reason) returns (uint256)",
  "function castVoteBySig(uint256 proposalId, uint8 support, address voter, bytes signature) returns (uint256)",
  "function nonces(address owner) view returns (uint256)",
  "function queue(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) returns (uint256)",
  "function execute(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) returns (uint256)",
  "function hasVoted(uint256 proposalId, address account) view returns (bool)",
  "function proposalVotes(uint256 proposalId) view returns (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes)",
  "function proposalSnapshot(uint256 proposalId) view returns (uint256)",
  "function proposalDeadline(uint256 proposalId) view returns (uint256)",
  "function proposalProposer(uint256 proposalId) view returns (address)",
  "function quorum(uint256 blockNumber) view returns (uint256)",
  "function cancel(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) returns (uint256)",
  "event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)",
  // OpenZeppelin v5 Governor custom errors — required so ethers can decode reverts
  // instead of logging them as "unknown custom error" hex selectors.
  "error GovernorAlreadyCastVote(address voter)",
  "error GovernorAlreadyQueuedProposal(uint256 proposalId)",
  "error GovernorDisabledDeposit()",
  "error GovernorInsufficientProposerVotes(address proposer, uint256 votes, uint256 threshold)",
  "error GovernorInvalidProposalLength(uint256 targets, uint256 calldatas, uint256 values)",
  "error GovernorInvalidQuorumFraction(uint256 quorumNumerator, uint256 quorumDenominator)",
  "error GovernorInvalidSignature(address voter)",
  "error GovernorInvalidVoteParams()",
  "error GovernorInvalidVoteType()",
  "error GovernorInvalidVotingPeriod(uint256 votingPeriod)",
  "error GovernorNonexistentProposal(uint256 proposalId)",
  "error GovernorNotQueuedProposal(uint256 proposalId)",
  "error GovernorOnlyExecutor(address account)",
  "error GovernorOnlyProposer(address account)",
  "error GovernorQueueNotImplemented()",
  "error GovernorRestrictedProposer(address proposer)",
  "error GovernorUnexpectedProposalState(uint256 proposalId, uint8 current, bytes32 expectedStates)",
  "error QueueEmpty()",
  "error QueueFull()",
];


export const REGISTRY_ABI = [
  "function getPoolByLocation(string location) view returns (address)",
  "function isRegistered(string location) view returns (bool)",
  "function registeredCount() view returns (uint256)",
  "function getAllLocations() view returns (string[])",
];

export const LIABILITY_RECEIPT_ABI = [
  "function totalReceipts() view returns (uint256)",
  "function getReceipt(uint256 tokenId) view returns (tuple(address dataBuyer, bytes32[] acaHashes, uint256 purchaseAmount, bytes32 synapseReceiptId, string dataBundleRef, uint256 mintedAt, uint256 blockNumber))",
  "function getReceiptsByBuyer(address buyer) view returns (uint256[])",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function locked(uint256 tokenId) view returns (bool)",
];

export const PROPOSAL_STATES = [
  "Pending",
  "Active",
  "Canceled",
  "Defeated",
  "Succeeded",
  "Queued",
  "Expired",
  "Executed",
];

export const BLOCKS_PER_DAY = 43200; // 86400 seconds / 2 seconds per block
