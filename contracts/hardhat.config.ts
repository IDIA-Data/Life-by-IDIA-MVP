/**
 * Hardhat config for IDIATokenBeta on Base.
 *
 * Networks:
 *   base         — Base Mainnet  (chainId 8453)  — PRODUCTION
 *   baseSepolia  — Base Sepolia  (chainId 84532) — internal testing
 *
 * Setup:
 *   cd contracts
 *   npm install
 *   npx hardhat compile
 *
 * Deploy:
 *   npm run deploy:base           # mainnet
 *   npm run deploy:baseSepolia    # testnet
 *
 * Required env vars (.env file in contracts/):
 *   PRIVATE_KEY=<deployer wallet private key, NEVER commit>
 *   ALCHEMY_API_KEY=<Alchemy API key for Base>
 *   BASESCAN_API_KEY=<Basescan API key for contract verification (optional)>
 *
 * Optional overrides (use full URLs if you don't want to compose with ALCHEMY_API_KEY):
 *   BASE_RPC_URL=...
 *   BASE_SEPOLIA_RPC_URL=...
 */

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "0x" + "0".repeat(64);
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY ?? "";

const BASE_RPC_URL =
  process.env.BASE_RPC_URL ??
  (ALCHEMY_API_KEY
    ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
    : "https://mainnet.base.org");

const BASE_SEPOLIA_RPC_URL =
  process.env.BASE_SEPOLIA_RPC_URL ??
  (ALCHEMY_API_KEY
    ? `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
    : "https://sepolia.base.org");

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
    base: {
      url: BASE_RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 8453,
    },
    baseSepolia: {
      url: BASE_SEPOLIA_RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 84532,
    },
  },
  etherscan: {
    apiKey: {
      base: process.env.BASESCAN_API_KEY ?? "",
      baseSepolia: process.env.BASESCAN_API_KEY ?? "",
    },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org",
        },
      },
    ],
  },
};

export default config;
