# IDIA Governance Protocol — Base Mainnet Deployment

**Network:** Base Mainnet (Chain ID 8453)  
**RPC:** https://mainnet.base.org  
**Explorer:** https://basescan.org  
**USDC:** 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913  

---

## Pre-flight checklist

Complete ALL of these before deploying any contracts.

### 1. Gnosis Safe on Base Mainnet

Deploy at: https://app.safe.global/new-safe/create?chain=base

**Signers (minimum 3):**

| Signer | Address | Notes |
|--------|---------|-------|
| Shawn | `0xF8b25E8017E0d83443DBD0f37289d3f849eEdF37` | Deployer wallet |
| Eddie | `<Eddie's personal wallet>` | NOT the relayer — a separate wallet |
| Third party | `<TBD>` | Board member, advisor, or legal counsel |

**Threshold: 2-of-3** — any two signers can approve a transaction.

📝 Record: **Mainnet Safe = ____________**

### 2. Fund wallets

| Wallet | Needs | Why |
|--------|-------|-----|
| Deployer | ~0.01 ETH on Base | Gas for 10 contract deployments + wiring calls |
| Relayer (`0xd816...`) | ~0.05 ETH on Base | Gas for ongoing settlement transactions |
| Relayer (`0xd816...`) | USDC on Base | For royalty payouts (Phase 1-3 of settlement) |

Bridge ETH to Base via https://bridge.base.org or buy directly via Coinbase.

### 3. Remix compiler settings

```
Compiler:     0.8.24+
EVM Version:  cancun
Optimization: On, 200 runs
viaIR:        On
```

### 4. MetaMask on Base Mainnet

| Field | Value |
|-------|-------|
| Network Name | Base |
| RPC URL | `https://mainnet.base.org` |
| Chain ID | `8453` |
| Symbol | ETH |
| Explorer | `https://basescan.org` |

---

## Key addresses

```
Mainnet Safe:       <from step above — record before proceeding>
Deployer (Shawn):   0xF8b25E8017E0d83443DBD0f37289d3f849eEdF37
Relayer (new):      0xd816D83703764551A7F292dbC435669AA89631a7
```

---

## Differences from testnet

| Setting | Testnet (84532) | Mainnet (8453) |
|---------|-----------------|----------------|
| TimelockController minDelay | `60` (1 minute) | `172800` (48 hours) |
| Safe threshold | 1-of-2 | **2-of-3** |
| USDC address | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Chain import (edge functions) | `baseSepolia` | `base` |
| RPC | `https://sepolia.base.org` | `https://mainnet.base.org` |

**Everything else — contract code, constructor patterns, wiring order — is identical.**

---

## PHASE 1: Deploy contracts (10 deployments in Remix)

### Step 1: TimelockController

File: `DeployTimelock.sol` → select **TimelockController**.

**Constructor:**
```
172800, [], ["0x0000000000000000000000000000000000000000"], 0xF8b25E8017E0d83443DBD0f37289d3f849eEdF37
```

| Param | Value |
|-------|-------|
| minDelay | `172800` (48 hours — Operating Agreement requirement) |
| proposers | `[]` |
| executors | `["0x0000000000000000000000000000000000000000"]` |
| admin | deployer (temporary) |

📝 **Timelock = ____________**

---

### Step 2a: Escrow — Team & Advisors (15%)

File: `IDIAEscrow.sol` → select **IDIAEscrow**.

**Constructor:**
```
Team & Advisors, <SAFE_ADDRESS>, 0xd816D83703764551A7F292dbC435669AA89631a7, 0xd816D83703764551A7F292dbC435669AA89631a7, ["0xF8b25E8017E0d83443DBD0f37289d3f849eEdF37"]
```

| Param | Value |
|-------|-------|
| _category | `Team & Advisors` |
| _owner | Mainnet Safe |
| _treasury | Relayer |
| _automatedDistributor | Relayer |
| _approvers | `["deployer"]` |

📝 **Team Escrow = ____________**

---

### Step 2b: Escrow — Ecosystem / Treasury (30%)

**Constructor:**
```
Ecosystem / Treasury, <SAFE_ADDRESS>, 0xd816D83703764551A7F292dbC435669AA89631a7, 0xd816D83703764551A7F292dbC435669AA89631a7, ["0xF8b25E8017E0d83443DBD0f37289d3f849eEdF37"]
```

📝 **Ecosystem Escrow = ____________**

---

### Step 2c: Escrow — Liquidity & Staking (35%)

**Constructor:**
```
Liquidity & Staking, <SAFE_ADDRESS>, 0xd816D83703764551A7F292dbC435669AA89631a7, 0xd816D83703764551A7F292dbC435669AA89631a7, ["0xF8b25E8017E0d83443DBD0f37289d3f849eEdF37"]
```

📝 **Liquidity Escrow = ____________**

---

### Step 2d: Escrow — Early Investors (10%)

**Constructor:**
```
Early Investors, <SAFE_ADDRESS>, 0xd816D83703764551A7F292dbC435669AA89631a7, 0xd816D83703764551A7F292dbC435669AA89631a7, ["0xF8b25E8017E0d83443DBD0f37289d3f849eEdF37"]
```

📝 **Investor Escrow = ____________**

---

### Step 2e: Escrow — Public Sale / Airdrop (10%)

**Constructor:**
```
Public Sale / Airdrop, <SAFE_ADDRESS>, 0xd816D83703764551A7F292dbC435669AA89631a7, 0xd816D83703764551A7F292dbC435669AA89631a7, ["0xF8b25E8017E0d83443DBD0f37289d3f849eEdF37"]
```

📝 **Public Escrow = ____________**

---

### Step 3: IDIA Token

File: `IDIA.sol` → select **IDIA**.

**Constructor (fill in escrow addresses from Steps 2a-2e):**
```
<Team Escrow>, <Ecosystem Escrow>, <Liquidity Escrow>, <Investor Escrow>, <Public Escrow>, <SAFE_ADDRESS>
```

📝 **IDIA Token = ____________**

**Verify immediately:**
- `totalSupply()` → `10000000000000000000000000000`
- `balanceOf(<Team Escrow>)` → `1500000000000000000000000000`
- `balanceOf(<Ecosystem Escrow>)` → `3000000000000000000000000000`

---

### Step 4: IDIAGovernor

File: `IDIAGovernor.sol` → select **IDIAGovernor**.

**Constructor:**
```
<IDIA Token>, <Timelock>
```

📝 **Governor = ____________**

---

### Step 5: IDIARegistry

File: `IDIARegistry.sol` → select **IDIARegistry**.

**Constructor:**
```
0xF8b25E8017E0d83443DBD0f37289d3f849eEdF37
```

📝 **Registry = ____________**

---

### Step 6: IDIAPoolFactory

File: `IDIAPoolFactory.sol` → select **IDIAPoolFactory**.

**Constructor:**
```
<IDIA Token>, <Registry>, 0xF8b25E8017E0d83443DBD0f37289d3f849eEdF37
```

📝 **Factory = ____________**

---

### Step 7: IDIALiabilityReceipt

File: `IDIALiabilityReceipt.sol` → select **IDIALiabilityReceipt**.

**Constructor:**
```
<SAFE_ADDRESS>, 0xd816D83703764551A7F292dbC435669AA89631a7
```

📝 **LiabilityReceipt = ____________**

---

## PHASE 2: Wiring (deployer wallet, directly in Remix)

### Step 8a: Registry → Factory ownership

On **IDIARegistry**, call `transferOwnership`:
- `newOwner`: `<Factory address>`

### Step 8b: Governor → Timelock proposer

On **TimelockController**, call `grantRole`:
- `role`: `0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1`
- `account`: `<Governor address>`

### Step 8c: Timelock admin → Safe

On **TimelockController**, call `grantRole`:
- `role`: `0x0000000000000000000000000000000000000000000000000000000000000000`
- `account`: `<Mainnet Safe address>`

### Step 8d: Factory → Safe ownership

On **IDIAPoolFactory**, call `transferOwnership`:
- `newOwner`: `<Mainnet Safe address>`

### Step 8e: Revoke deployer Timelock admin

On **TimelockController**, call `revokeRole`:
- `role`: `0x0000000000000000000000000000000000000000000000000000000000000000`
- `account`: `0xF8b25E8017E0d83443DBD0f37289d3f849eEdF37`

⚠️ **8c MUST complete before 8e.** Verify `hasRole(0x00...00, <Safe>)` returns true before revoking.

---

## PHASE 3: Safe batch — initialize 5 escrows

Go to Safe Transaction Builder on Base Mainnet. Batch 5 calls:

| # | To | Function | _token |
|---|---|---|---|
| 1 | Team Escrow | `initialize` | `<IDIA Token>` |
| 2 | Ecosystem Escrow | `initialize` | `<IDIA Token>` |
| 3 | Liquidity Escrow | `initialize` | `<IDIA Token>` |
| 4 | Investor Escrow | `initialize` | `<IDIA Token>` |
| 5 | Public Escrow | `initialize` | `<IDIA Token>` |

Requires 2-of-3 signatures. Coordinate with Eddie.

---

## PHASE 4: Verify contracts on BaseScan

For each contract:

1. Go to `https://basescan.org/address/<address>#code`
2. Click **Verify and Publish**
3. Compiler: `v0.8.24`, Optimization: Yes (200), viaIR: Yes, License: MIT
4. Use **Standard JSON Input** from Remix (Compiler tab → Compilation Details)

Or use the Remix Etherscan plugin with a BaseScan API key (free at https://basescan.org/myapikey).

---

## PHASE 5: Post-deployment validation

Run the verification page (`idia-verify.html`) with mainnet addresses updated.
Or manually check in Remix:

- [ ] `IDIA.totalSupply()` → 10B (10^28 wei)
- [ ] Each escrow `escrowBalance()` → correct allocation
- [ ] Each escrow `initialized()` → true
- [ ] Each escrow `automatedDistributor()` → relayer address
- [ ] Each escrow `isApprover(deployer)` → true
- [ ] `IDIAGovernor.votingDelay()` → 43200
- [ ] `IDIAGovernor.votingPeriod()` → 302400
- [ ] `TimelockController.getMinDelay()` → 172800
- [ ] `TimelockController.hasRole(PROPOSER_ROLE, governor)` → true
- [ ] `TimelockController.hasRole(ADMIN_ROLE, safe)` → true
- [ ] `TimelockController.hasRole(ADMIN_ROLE, deployer)` → false
- [ ] `IDIAPoolFactory.owner()` → safe
- [ ] `IDIALiabilityReceipt.hasRole(MINTER_ROLE, relayer)` → true

---

## PHASE 6: Update off-chain systems

### App config (`src/config/contracts.ts`)

Change `ACTIVE_DEPLOYMENT` from `'testnet'` to `'mainnet'` and fill in the mainnet addresses.

### Supabase secrets

```bash
supabase secrets set BASE_RPC_URL=https://mainnet.base.org
supabase secrets set IDIA_TOKEN_ADDRESS=<mainnet IDIA token>
supabase secrets set REGISTRY_ADDRESS=<mainnet registry>
supabase secrets set LIABILITY_RECEIPT_ADDRESS=<mainnet receipt>
supabase secrets set POOL_FACTORY_ADDRESS=<mainnet factory>
supabase secrets set GLOBAL_WAR_CHEST=<mainnet timelock>
supabase secrets set ESCROW_ECOSYSTEM=<mainnet ecosystem escrow>
supabase secrets set TREASURY_WALLET=0xd816D83703764551A7F292dbC435669AA89631a7
```

### Edge function chain config

```typescript
// Change:
import { baseSepolia } from "npm:viem@2.9.20/chains";
chain: baseSepolia,

// To:
import { base } from "npm:viem@2.9.20/chains";
chain: base,
```

### Admin dashboard + verification page

Update the address constants at the top of both HTML files.

---

## Deployment record

```
═══════════════════════════════════════════════════════
  IDIA GOVERNANCE PROTOCOL — MAINNET DEPLOYMENT
  Network:   Base Mainnet (8453)
  Date:      ____________________
  Deployer:  0xF8b25E8017E0d83443DBD0f37289d3f849eEdF37
  Safe:      ____________________  (2-of-3)
  Relayer:   0xd816D83703764551A7F292dbC435669AA89631a7
═══════════════════════════════════════════════════════

  TimelockController:         0x____________________ (48hr delay)

  Team Escrow (15%):          0x____________________
  Ecosystem Escrow (30%):     0x____________________
  Liquidity Escrow (35%):     0x____________________
  Investor Escrow (10%):      0x____________________
  Public Escrow (10%):        0x____________________

  IDIA Token:                 0x____________________
  IDIAGovernor:               0x____________________
  IDIARegistry:               0x____________________
  IDIAPoolFactory:            0x____________________
  IDIALiabilityReceipt:       0x____________________

═══════════════════════════════════════════════════════
  Wiring verified:
  [ ] 5 escrows initialized (Safe batch, 2-of-3)
  [ ] Registry → Factory ownership
  [ ] Governor → Timelock proposer
  [ ] Timelock admin → Safe
  [ ] Factory → Safe
  [ ] Deployer Timelock admin revoked
  [ ] All contracts verified on BaseScan
  [ ] Edge functions updated with mainnet addresses
  [ ] App config switched to mainnet
  [ ] Event indexer deployed and running
═══════════════════════════════════════════════════════
```
