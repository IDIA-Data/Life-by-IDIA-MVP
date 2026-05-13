# IDIA Life Smart Contracts

This folder contains the Solidity contracts for the IDIA Life beta on Flare Coston2 testnet.

## Contract: `IDIATokenBeta`

A non-transferable receipt token issued for ACA (Auditable Consent Artifact) contributions during beta.

### Key features

- **Non-transferable** between users — `transfer()` and `transferFrom()` revert. This is intentional; tokens are records, not currency.
- **Mintable** by authorized minters (treasury wallets) on behalf of users
- **Burnable** by holders (for redemptions) or by authorized minters (for backend-orchestrated flows)
- **Operational toggles** — owner can enable/disable minting and burning independently
- **Pausable** — owner can pause all minting/burning at once if needed
- **Reentrancy guarded** on all state-changing functions
- **Provenance ledger** — every mint/burn is recorded as a struct with the ACA hash, recipient, amount, timestamp
- **Address enumeration** — tracks all unique holder addresses for off-chain indexing
- **Reverts unexpected funds** — rejects native tokens, owner can rescue stray ERC-20 tokens

### Events

```solidity
event ACAMinted(address indexed recipient, bytes32 indexed acaHash, uint256 amount, uint256 indexed mintId, uint256 timestamp, address minter);
event ACABurned(address indexed from, bytes32 indexed acaHash, uint256 amount, uint256 indexed burnId, uint256 timestamp, string reason);
event MinterAuthorized(address indexed minter, address indexed authorizedBy);
event MinterRevoked(address indexed minter, address indexed revokedBy);
event MintingToggled(bool enabled, address indexed by);
event BurningToggled(bool enabled, address indexed by);
```

The backend can subscribe to `ACAMinted` and `ACABurned` events to populate Supabase records with the resulting transaction hashes.

## Setup

```bash
cd contracts
npm install
```

Create a `.env` file with your deployer wallet's private key:

```
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
COSTON2_RPC=https://coston2-api.flare.network/ext/C/rpc
```

The `.env` file is gitignored at the project root. **Never commit private keys.**

## Deployment

### 1. Compile

```bash
npm run compile
```

### 2. Get test C2FLR

The deployer wallet needs C2FLR to pay gas. Visit https://faucet.flare.network and request tokens for your deployer address.

### 3. Deploy to Coston2

```bash
npm run deploy:coston2
```

Save the contract address printed at the end.

### 4. Authorize a treasury wallet as minter

Edit `scripts/authorize-minter.ts`:
- Set `CONTRACT_ADDRESS` to the deployed address from step 3
- Set `MINTER_ADDRESS` to the treasury wallet that will mint on behalf of users

Then:

```bash
npm run authorize:coston2
```

The treasury wallet's private key will go into the Supabase edge function as a secret.

## Backend integration

The backend edge function pattern is:

```typescript
// supabase/functions/mint-aca-receipt/index.ts (planned)
import { ethers } from "https://esm.sh/ethers@6.13.0";

const treasury = new ethers.Wallet(Deno.env.get("TREASURY_PRIVATE_KEY")!, provider);
const token = new ethers.Contract(CONTRACT_ADDRESS, ABI, treasury);

const tx = await token.mintForACA(userWallet, acaHash, amount);
await tx.wait();

// Update Supabase row with tx.hash as liability_token_hash
```

## Security notes

- The contract uses OpenZeppelin's `Ownable`, `Pausable`, `ReentrancyGuard` for safety primitives.
- **The deployer wallet is the owner** — they can authorize minters, pause the contract, and rescue tokens. Use a hardware wallet or multisig for production.
- **Authorized minters can mint to any address** — compromise of a minter key allows unlimited minting. Each minter wallet should be treated as sensitive.
- **The contract intentionally does NOT implement IERC20** — it is not a tradable token. Wallets that auto-detect ERC-20s may show a confusing balance; the symbol IDIA-B is intentional.
- **No upgrade mechanism** — if the contract needs changes, deploy a new one and migrate balances off-chain.

## Out of scope (not in this contract)

- ERC-20 transfer functionality
- USDC/payment-token integration (handled separately by the data-buying flow)
- Royalty distribution (handled by edge functions and a separate treasury wallet)
- DAO governance (separate contracts to be deployed later)
