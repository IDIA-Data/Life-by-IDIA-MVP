/**
 * Authorize a minter address on a deployed IDIATokenBeta contract.
 * Run AFTER deploying. Edit the values below first.
 *
 * Usage: npx hardhat run scripts/authorize-minter.ts --network coston2
 */

import { ethers } from "hardhat";

// EDIT THESE VALUES BEFORE RUNNING ──────────────────────────────────
const CONTRACT_ADDRESS = "0xPASTE_DEPLOYED_ADDRESS_HERE";
const MINTER_ADDRESS = "0xPASTE_TREASURY_WALLET_ADDRESS_HERE";
// ────────────────────────────────────────────────────────────────────

async function main() {
  if (CONTRACT_ADDRESS.includes("PASTE") || MINTER_ADDRESS.includes("PASTE")) {
    throw new Error("Edit CONTRACT_ADDRESS and MINTER_ADDRESS in this script first.");
  }

  const [signer] = await ethers.getSigners();
  console.log(`Signer (must be owner): ${signer.address}`);

  const token = await ethers.getContractAt("IDIATokenBeta", CONTRACT_ADDRESS);
  const owner = await token.owner();

  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(`Signer is not owner. Owner is ${owner}.`);
  }

  console.log(`Authorizing ${MINTER_ADDRESS} as a minter...`);
  const tx = await token.authorizeMinter(MINTER_ADDRESS);
  console.log(`Tx: ${tx.hash}`);
  await tx.wait();

  const isAuthorized = await token.authorizedMinters(MINTER_ADDRESS);
  console.log(`\nDone. authorizedMinters[${MINTER_ADDRESS}] = ${isAuthorized}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
