/**
 * Hardhat config for IDIA Token Beta on Flare Coston2 testnet.
 *
 * Setup:
 *   cd contracts
 *   npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts dotenv
 *   npx hardhat compile
 *
 * Deploy:
 *   npx hardhat run scripts/deploy.ts --network coston2
 *
 * Required env vars (.env file in contracts/):
 *   PRIVATE_KEY=<deployer wallet private key, NEVER commit>
 *   COSTON2_RPC=https://coston2-api.flare.network/ext/C/rpc
 */

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "0x" + "0".repeat(64);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    coston2: {
      url: process.env.COSTON2_RPC ?? "https://coston2-api.flare.network/ext/C/rpc",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 114,
    },
    flare: {
      url: "https://flare-api.flare.network/ext/C/rpc",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 14,
    },
  },
  etherscan: {
    // Flare verification config — fill in API keys when available
    apiKey: {
      coston2: process.env.FLARE_EXPLORER_API_KEY ?? "no-api-key-needed",
    },
    customChains: [
      {
        network: "coston2",
        chainId: 114,
        urls: {
          apiURL: "https://coston2-explorer.flare.network/api",
          browserURL: "https://coston2-explorer.flare.network",
        },
      },
    ],
  },
};

export default config;
