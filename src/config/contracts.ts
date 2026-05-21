/**
 * IDIA Governance Protocol — Contract Configuration
 *
 * Single source of truth for all deployed contract addresses and ABIs.
 *
 * ACTIVE_DEPLOYMENT controls which network the app targets:
 *   'mainnet' (default) — Base mainnet (Chain ID 8453) for production
 *   'testnet'           — Base Sepolia (Chain ID 84532) for internal testing
 */

export type DeploymentEnv = 'testnet' | 'mainnet';

// ─── MASTER TOGGLE ──────────────────────────────────────────────────
export const ACTIVE_DEPLOYMENT: DeploymentEnv = 'mainnet';
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
  mainnet: {
    safe: '0x0910EF34C9F59A90d90FF505B1036DEed4a25d59',
    treasury: '0xd816D83703764551A7F292dbC435669AA89631a7',
    timelock: '0xd3Fd7dD19a4aFD41c8C7FeEdC6d05d77B1141BC5',
    idiaToken: '0x6526F939D257E67896821c25B6C24Daa404a01FB',
    governor: '0x9777067CAd2892D20decAF1a5ccb78e6B291B87a',
    registry: '0x137D913d89d0D6a5b2d1Db76173770C94d25387B',
    poolFactory: '0x0188FCB027D834E03DD0288D360937ceC4d267bb',
    liabilityReceipt: '0x5eA57335f7086f1C069d769a9012835B80a00BD3',
    escrow: {
      team: '0xF0E67683783ef5879b43ef99ab04Bc27A9a71074',
      ecosystem: '0xd052C6F3846b4Fe56E579880Ec9ea2764ABDe708',
      liquidity: '0xdC93412182b2fBf68b4282255d772d6Cd01fE8A1',
      investors: '0xDc93eca954fD2625001b2fb9E9A098914365ADe9',
      publicSale: '0xAE51E24674d9665febC188a8f82a4bB647BF014c',
    },
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  testnet: {
    safe: '0x0910EF34C9F59A90d90FF505B1036DEed4a25d59',
    treasury: '0xd816D83703764551A7F292dbC435669AA89631a7',
    timelock: '0xab31029D8A9F2b79233E4fAF8eEb80330613af55',
    idiaToken: '0x18306e920946FA7e42990C5D6F9402750407bF4B',
    governor: '0x9777067CAd2892D20decAf1a5ccb78e6B291B87a',
    registry: '0xDf7e629eb6083FEe5c66DfF3D4b4A682C4cC1C08',
    poolFactory: '0xDf7e629eb6083FEe5c66DfF3D4b4A682C4cC1C08',
    liabilityReceipt: '0x9f7aA33e0Cb21252A7E00C570768a4fd72A06A36',
    escrow: {
      team: '0x5636a3fa473AceD6faaeEC7ebD24c85846A6638B',
      ecosystem: '0x465D3395bf827Cc06d366765d2CE2cBd1b54bBB2',
      liquidity: '0xF6bbc8a8bcbd80E25a6a37BaA9a0271e9f401136',
      investors: '0xb4F5bB829FC7492Df7daA44374eda653245C5F6f',
      publicSale: '0x45BC46e0C52f2d1d2c22BC267Eb5D27c42B8E5f8',
    },
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  },
};

export const PROTOCOL = DEPLOYMENTS[ACTIVE_DEPLOYMENT];
export const IS_TESTNET = ACTIVE_DEPLOYMENT === 'testnet';

// ── ABIs ────────────────────────────────────────────────────────────

export const IDIA_TOKEN_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function delegate(address delegatee)',
  'function delegates(address account) view returns (address)',
  'function getVotes(address account) view returns (uint256)',
  'function getPastTotalSupply(uint256 blockNumber) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
];

export const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

export const GOVERNOR_ABI = [
  // Read
  'function name() view returns (string)',
  'function votingDelay() view returns (uint256)',
  'function votingPeriod() view returns (uint256)',
  'function proposalThreshold() view returns (uint256)',
  'function quorumNumerator() view returns (uint256)',
  'function QUORUM_DENOMINATOR() view returns (uint256)',
  'function quorum(uint256 blockNumber) view returns (uint256)',
  'function state(uint256 proposalId) view returns (uint8)',
  'function proposalVotes(uint256 proposalId) view returns (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes)',
  'function proposalSnapshot(uint256 proposalId) view returns (uint256)',
  'function proposalDeadline(uint256 proposalId) view returns (uint256)',
  'function proposalProposer(uint256 proposalId) view returns (address)',
  'function hasVoted(uint256 proposalId, address account) view returns (bool)',
  'function proposalsPaused() view returns (bool)',
  'function safe() view returns (address)',
  // Timing bounds
  'function minVotingDelay() view returns (uint256)',
  'function maxVotingDelay() view returns (uint256)',
  'function minVotingPeriod() view returns (uint256)',
  'function maxVotingPeriod() view returns (uint256)',
  // Write — standard propose (uses default timing)
  'function propose(address[] targets, uint256[] values, bytes[] calldatas, string description) returns (uint256)',
  // Write — custom timing propose
  'function proposeWithTiming(address[] targets, uint256[] values, bytes[] calldatas, string description, uint256 customDelay, uint256 customPeriod) returns (uint256)',
  // Write — voting
  'function castVote(uint256 proposalId, uint8 support) returns (uint256)',
  'function castVoteWithReason(uint256 proposalId, uint8 support, string reason) returns (uint256)',
  // Write — execution
  'function queue(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) returns (uint256)',
  'function execute(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) returns (uint256)',
  // Events (for log parsing)
  'event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)',
  'event ProposalTimingSet(uint256 indexed proposalId, uint256 customDelay, uint256 customPeriod)',
  'event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason)',
];

export const REGISTRY_ABI = [
  'function getPoolByLocation(string location) view returns (address)',
  'function isRegistered(string location) view returns (bool)',
  'function registeredCount() view returns (uint256)',
  'function getAllLocations() view returns (string[])',
];

export const LIABILITY_RECEIPT_ABI = [
  'function totalReceipts() view returns (uint256)',
  'function getReceipt(uint256 tokenId) view returns (tuple(address dataBuyer, bytes32[] acaHashes, uint256 purchaseAmount, bytes32 synapseReceiptId, string dataBundleRef, uint256 mintedAt, uint256 blockNumber))',
  'function getReceiptsByBuyer(address buyer) view returns (uint256[])',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function locked(uint256 tokenId) view returns (bool)',
];

// ── Proposal State Enum (matches Governor.sol) ──────────────────────

export const PROPOSAL_STATES: Record<number, string> = {
  0: 'Pending',
  1: 'Active',
  2: 'Canceled',
  3: 'Defeated',
  4: 'Succeeded',
  5: 'Queued',
  6: 'Expired',
  7: 'Executed',
};

export const PROPOSAL_STATE_COLORS: Record<number, string> = {
  0: 'bg-yellow-100 text-yellow-800',
  1: 'bg-green-100 text-green-800',
  2: 'bg-gray-100 text-gray-500',
  3: 'bg-red-100 text-red-800',
  4: 'bg-blue-100 text-blue-800',
  5: 'bg-purple-100 text-purple-800',
  6: 'bg-gray-100 text-gray-500',
  7: 'bg-teal-100 text-teal-800',
};

// ── Block timing helpers (Base L2 ~2s/block) ────────────────────────

export const BLOCKS_PER_HOUR = 1800;
export const BLOCKS_PER_DAY = 43200;

export function blocksToHumanTime(blocks: number): string {
  if (blocks < BLOCKS_PER_HOUR) return `${Math.round(blocks / 30)} min`;
  if (blocks < BLOCKS_PER_DAY) return `${(blocks / BLOCKS_PER_HOUR).toFixed(1)} hours`;
  return `${(blocks / BLOCKS_PER_DAY).toFixed(1)} days`;
}
