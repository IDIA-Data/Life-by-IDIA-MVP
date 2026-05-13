/**
 * Deploy IDIATokenBeta to the configured network.
 * Usage: npx hardhat run scripts/deploy.ts --network coston2
 */

import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("\n─── IDIA Token Beta Deployment ───────────────────────");
  console.log(`Network:          ${network.name} (chainId ${network.chainId})`);
  console.log(`Deployer:         ${deployer.address}`);
  console.log(`Balance:          ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} native`);
  console.log("──────────────────────────────────────────────────────\n");

  const Token = await ethers.getContractFactory("IDIATokenBeta");
  console.log("Deploying...");
  const token = await Token.deploy();
  await token.waitForDeployment();

  const addr = await token.getAddress();
  console.log(`\nIDIATokenBeta deployed at: ${addr}`);
  console.log(`Owner:                      ${await token.owner()}`);
  console.log(`Minter (deployer):          authorized=${await token.authorizedMinters(deployer.address)}`);
  console.log(`Minting enabled:            ${await token.mintingEnabled()}`);
  console.log(`Burning enabled:            ${await token.burningEnabled()}`);

  console.log("\n─── Next steps ────────────────────────────────────────");
  console.log("1. Save the contract address — you'll need it for the backend edge function.");
  console.log("2. Authorize the treasury wallet as a minter:");
  console.log(`     npx hardhat run scripts/authorize-minter.ts --network ${network.name === "unknown" ? "coston2" : network.name}`);
  console.log("3. Verify on block explorer (optional):");
  console.log(`     npx hardhat verify --network ${network.name === "unknown" ? "coston2" : network.name} ${addr}`);
  console.log("──────────────────────────────────────────────────────\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
