/**
 * EVM Wallet Service for IDIA Life
 *
 * Manages the user's wallet on Base (mainnet) and Base Sepolia (testnet).
 * Token contract addresses (IDIA, USDC) are per-network — switching networks
 * automatically uses the correct contracts and refreshes balances.
 */

import { ethers } from 'ethers';
import { Preferences } from '@capacitor/preferences';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { isNative } from './platform';
import {
  ACTIVE_DEPLOYMENT,
  IDIA_TOKEN_ABI,
  ERC20_ABI,
} from '../config/contracts';

// ── Network Configuration ────────────────────────────────────────────

export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  symbol: string;
  blockExplorer: string;
  isTestnet: boolean;
  // Token contract addresses for THIS network
  idiaToken: string;  // Empty string if not deployed on this network
  usdc: string;       // USDC contract for this chain
}

export const NETWORKS: Record<string, NetworkConfig> = {
  coston2: {
    name: 'Flare Testnet Coston2',
    chainId: 114,
    rpcUrl: 'https://coston2-api.flare.network/ext/C/rpc',
    symbol: 'C2FLR',
    blockExplorer: 'https://coston2-explorer.flare.network',
    isTestnet: true,
  },
  flare: {
    name: 'Flare',
    chainId: 14,
    rpcUrl: 'https://flare-api.flare.network/ext/C/rpc',
    symbol: 'FLR',
    blockExplorer: 'https://flare-explorer.flare.network',
    isTestnet: false,
  },
  ethereum: {
    name: 'Ethereum',
    chainId: 1,
    rpcUrl: 'https://eth.llamarpc.com',
    symbol: 'ETH',
    blockExplorer: 'https://etherscan.io',
    isTestnet: false,
  },
  polygon: {
    name: 'Polygon',
    chainId: 137,
    rpcUrl: 'https://polygon-rpc.com',
    symbol: 'MATIC',
    blockExplorer: 'https://polygonscan.com',
    isTestnet: false,
  },
  base: {
    name: 'Base',
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    symbol: 'ETH',
    blockExplorer: 'https://basescan.org',
    isTestnet: false,
    idiaToken: '0x6526F939D257E67896821c25B6C24Daa404a01FB',  // Mainnet IDIA
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  baseSepolia: {
    name: 'Base Sepolia',
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    symbol: 'ETH',
    blockExplorer: 'https://sepolia.basescan.org',
    isTestnet: true,
    idiaToken: '0x18306e920946FA7e42990C5D6F9402750407bF4B',  // Testnet IDIA
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  },
};

const DEFAULT_NETWORK = ACTIVE_DEPLOYMENT === 'mainnet' ? 'base' : 'baseSepolia';

// ── Storage Keys ─────────────────────────────────────────────────────

const STORAGE_KEYS = {
  ENCRYPTED_MNEMONIC: 'idia_wallet_mnemonic',
  ACTIVE_NETWORK: 'idia_wallet_network',
  WALLET_EXISTS: 'idia_wallet_exists',
} as const;

// ── Types ────────────────────────────────────────────────────────────

export interface WalletInfo {
  address: string;
  activeNetwork: string;
}

export interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  balanceFormatted: string;
  symbol: string;
  network: string;
  decimals: number;
  contractAddress?: string;
}

export interface TxRequest {
  to: string;
  amount: string;
  data?: string;
}

export interface TxResult {
  hash: string;
  from: string;
  to: string;
  amount: string;
  network: string;
  blockExplorerUrl: string;
}

export interface WalletBalances {
  eth: TokenBalance;
  idia: TokenBalance;
  usdc: TokenBalance;
}

const KEYS = {
  MNEMONIC: 'idia_wallet_mnemonic',
  EXISTS: 'idia_wallet_exists',
  NETWORK: 'idia_wallet_network',
} as const;

async function storeSecureKeys(mnemonic: string): Promise<void> {
  console.log('[START] Wallet: storeSecureKeys');
  try {
    await SecureStoragePlugin.set({ key: KEYS.MNEMONIC, value: mnemonic });
    await SecureStoragePlugin.set({ key: KEYS.EXISTS, value: 'true' });
    await SecureStoragePlugin.set({ key: KEYS.NETWORK, value: DEFAULT_NETWORK });
    console.log('[END] Wallet: storeSecureKeys complete');
  } catch (e) {
    console.error('[ERROR] Wallet: storeSecureKeys failed', e);
    throw e;
  }
}

class WalletService {
  private wallet: ethers.HDNodeWallet | null = null;
  private activeNetwork: string = DEFAULT_NETWORK;
  private mnemonic: string | null = null;

  // ── Wallet Lifecycle ──────────────────────────────────────────

  async hasWallet(): Promise<boolean> {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEYS.WALLET_EXISTS });
      return value === 'true';
    } catch { return false; }
  }

  async createWallet(): Promise<{ address: string; mnemonic: string }> {
    const w = ethers.Wallet.createRandom();
    const mnemonic = w.mnemonic?.phrase;
    if (!mnemonic) throw new Error('Failed to generate mnemonic');

    await Preferences.set({ key: STORAGE_KEYS.ENCRYPTED_MNEMONIC, value: mnemonic });
    await Preferences.set({ key: STORAGE_KEYS.WALLET_EXISTS, value: 'true' });
    await Preferences.set({ key: STORAGE_KEYS.ACTIVE_NETWORK, value: DEFAULT_NETWORK });

    await storeSecureKeys(mnemonic);
    this.wallet = w as ethers.HDNodeWallet;
    this.activeNetwork = DEFAULT_NETWORK;
    this.wallet = w as ethers.HDNodeWallet;
    this.mnemonic = mnemonic;
    this.activeNetwork = DEFAULT_NETWORK;

    if (!isNative()) console.warn('SECURITY: Mnemonic in localStorage on web. Use native for production.');
    return { address: w.address, mnemonic };
  }

  async importWallet(mnemonic: string): Promise<{ address: string }> {
    const trimmed = mnemonic.trim();
    if (!ethers.Mnemonic.isValidMnemonic(trimmed)) throw new Error('Invalid mnemonic');
    const w = ethers.HDNodeWallet.fromMnemonic(ethers.Mnemonic.fromPhrase(trimmed));
    await Preferences.set({ key: STORAGE_KEYS.ENCRYPTED_MNEMONIC, value: trimmed });
    await Preferences.set({ key: STORAGE_KEYS.WALLET_EXISTS, value: 'true' });
    await Preferences.set({ key: STORAGE_KEYS.ACTIVE_NETWORK, value: DEFAULT_NETWORK });

    this.wallet = w;
    this.mnemonic = trimmed;
    this.activeNetwork = DEFAULT_NETWORK;
    return { address: w.address };
  }

  async loadWallet(): Promise<WalletInfo | null> {
    try {
      const { value: mnemonic } = await SecureStoragePlugin.get({ key: KEYS.MNEMONIC });
      if (!mnemonic) return null;
      this.wallet = ethers.HDNodeWallet.fromMnemonic(ethers.Mnemonic.fromPhrase(mnemonic));
      this.mnemonic = mnemonic;

    try {
  const { value: net } = await Preferences.get({ key: STORAGE_KEYS.ACTIVE_NETWORK });
  if (net && NETWORKS[net]) {
    // Don't load a testnet network on a mainnet build (or vice versa)
    const storedIsTestnet = NETWORKS[net].isTestnet;
    const buildIsTestnet = DEFAULT_NETWORK === 'baseSepolia';
    if (storedIsTestnet === buildIsTestnet) {
      this.activeNetwork = net;
    } else {
      // Stored network doesn't match build mode — reset to default
      this.activeNetwork = DEFAULT_NETWORK;
      await Preferences.set({ key: STORAGE_KEYS.ACTIVE_NETWORK, value: DEFAULT_NETWORK });
    }
  }
} catch {}

      return { address: this.wallet.address, activeNetwork: this.activeNetwork };
    } catch { return null; }
  }

  getAddress(): string | null { return this.wallet?.address || null; }

  async getSeedPhrase(): Promise<string | null> {
    try { const { value } = await SecureStoragePlugin.get({ key: KEYS.MNEMONIC }); return value || null; } catch { return null; }
  }

  async deleteWallet(): Promise<void> {
    this.wallet = null;
    this.mnemonic = null;
    this.activeNetwork = DEFAULT_NETWORK;
    try { await SecureStoragePlugin.remove({ key: KEYS.MNEMONIC }); } catch {}
    try { await SecureStoragePlugin.remove({ key: KEYS.EXISTS }); } catch {}
    try { await SecureStoragePlugin.remove({ key: KEYS.NETWORK }); } catch {}
  }

  getAddress(): string | null { return this.wallet?.address || null; }
  getRawWallet(): ethers.HDNodeWallet | null { return this.wallet; }
  getSeedPhrase(): string | null { return this.mnemonic; }

  // ── Network Management ────────────────────────────────────────

  async switchNetwork(networkKey: string): Promise<void> {
    if (!NETWORKS[networkKey]) throw new Error(`Unknown network: ${networkKey}`);
    this.activeNetwork = networkKey;
    await Preferences.set({ key: STORAGE_KEYS.ACTIVE_NETWORK, value: networkKey });
  }

  getActiveNetwork(): NetworkConfig { return NETWORKS[this.activeNetwork]; }
  getActiveNetworkKey(): string { return this.activeNetwork; }

  getAvailableNetworks(): Array<{ key: string; config: NetworkConfig }> {
    return Object.entries(NETWORKS).map(([key, config]) => ({ key, config }));
  }

  /**
   * Get token addresses for the active (or specified) network.
   * Returns empty string if a token isn't deployed on that network.
   */
  private getTokenAddresses(networkKey?: string): { idiaToken: string; usdc: string } {
    const net = NETWORKS[networkKey || this.activeNetwork];
    return { idiaToken: net.idiaToken, usdc: net.usdc };
  }

  // ── Providers and Signers ─────────────────────────────────────

  private getProvider(networkKey?: string): ethers.JsonRpcProvider {
    const network = NETWORKS[networkKey || this.activeNetwork];
    return new ethers.JsonRpcProvider(network.rpcUrl, network.chainId);
  }

  private getSigner(networkKey?: string): ethers.Wallet {
    if (!this.wallet) throw new Error('No wallet loaded');
    const provider = this.getProvider(networkKey);
    return new ethers.Wallet(this.wallet.privateKey, provider);
  }

  // ── Balance Reading ───────────────────────────────────────────

  async getNativeBalance(networkKey?: string): Promise<TokenBalance> {
    if (!this.wallet) throw new Error('No wallet loaded');
    const network = NETWORKS[networkKey || this.activeNetwork];
    const provider = this.getProvider(networkKey);
    const balance = await provider.getBalance(this.wallet.address);
    return {
      symbol: network.symbol, name: network.name,
      balance: balance.toString(), balanceFormatted: ethers.formatEther(balance), decimals: 18,
    };
  }

  async getIDIABalance(networkKey?: string): Promise<TokenBalance> {
    if (!this.wallet) throw new Error('No wallet loaded');
    const { idiaToken } = this.getTokenAddresses(networkKey);

    // If IDIA token isn't deployed on this network, return zero
    if (!idiaToken) {
      return { symbol: 'IDIA', name: 'IDIA Token', balance: '0', balanceFormatted: '0.0', decimals: 18, contractAddress: '' };
    }

    const provider = this.getProvider(networkKey);
    const token = new ethers.Contract(idiaToken, IDIA_TOKEN_ABI, provider);
    const balance = await token.balanceOf(this.wallet.address);

    return {
      symbol: 'IDIA', name: 'IDIA Token',
      balance: balance.toString(), balanceFormatted: ethers.formatEther(balance),
      decimals: 18, contractAddress: idiaToken,
    };
  }

  async getUSDCBalance(networkKey?: string): Promise<TokenBalance> {
    if (!this.wallet) throw new Error('No wallet loaded');
    const { usdc } = this.getTokenAddresses(networkKey);

    if (!usdc) {
      return { symbol: 'USDC', name: 'USD Coin', balance: '0', balanceFormatted: '0.00', decimals: 6, contractAddress: '' };
    }

    const provider = this.getProvider(networkKey);
    const usdcContract = new ethers.Contract(usdc, ERC20_ABI, provider);
    const balance = await usdcContract.balanceOf(this.wallet.address);

    return {
      symbol: 'USDC', name: 'USD Coin',
      balance: balance.toString(), balanceFormatted: ethers.formatUnits(balance, 6),
      decimals: 6, contractAddress: usdc,
    };
  }

  async getTokenBalance(tokenAddress: string, networkKey?: string): Promise<TokenBalance> {
    if (!this.wallet) throw new Error('No wallet loaded');
    const provider = this.getProvider(networkKey);
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const [balance, symbol, name, decimals] = await Promise.all([
      token.balanceOf(this.wallet.address), token.symbol(), token.name(), token.decimals(),
    ]);
    return {
      symbol, name, balance: balance.toString(),
      balanceFormatted: ethers.formatUnits(balance, decimals),
      decimals: Number(decimals), contractAddress: tokenAddress,
    };
  }

  async getAllBalances(networkKey?: string): Promise<WalletBalances> {
    const [eth, idia, usdc] = await Promise.all([
      this.getNativeBalance(networkKey),
      this.getIDIABalance(networkKey),
      this.getUSDCBalance(networkKey),
    ]);
    return { eth, idia, usdc };
  }

  // ── Governance Delegation ─────────────────────────────────────

  async delegateVotes(delegatee?: string): Promise<TransactionResult> {
    if (!this.wallet) throw new Error('No wallet loaded');
    const { idiaToken } = this.getTokenAddresses();
    if (!idiaToken) throw new Error('IDIA token not deployed on this network');

    const signer = this.getSigner();
    const token = new ethers.Contract(idiaToken, IDIA_TOKEN_ABI, signer);
    const target = delegatee || this.wallet.address;
    const tx = await token.delegate(target);
    await tx.wait();

    const network = this.getActiveNetwork();
    return {
      hash: tx.hash, from: this.wallet.address, to: idiaToken,
      amount: '0', network: network.name,
      blockExplorerUrl: `${network.blockExplorer}/tx/${tx.hash}`,
    };
  }

  async getVotingPower(): Promise<string> {
    if (!this.wallet) throw new Error('No wallet loaded');
    const { idiaToken } = this.getTokenAddresses();
    if (!idiaToken) return '0';

    const provider = this.getProvider();
    const token = new ethers.Contract(idiaToken, IDIA_TOKEN_ABI, provider);
    const votes = await token.getVotes(this.wallet.address);
    return ethers.formatEther(votes);
  }

  async getDelegatee(): Promise<string> {
    if (!this.wallet) throw new Error('No wallet loaded');
    const { idiaToken } = this.getTokenAddresses();
    if (!idiaToken) return ethers.ZeroAddress;

    const provider = this.getProvider();
    const token = new ethers.Contract(idiaToken, IDIA_TOKEN_ABI, provider);
    return await token.delegates(this.wallet.address);
  }

  // ── Transactions ──────────────────────────────────────────────

  async sendNative(to: string, amount: string): Promise<TransactionResult> {
    if (!this.wallet) throw new Error('No wallet loaded');
    if (!ethers.isAddress(to)) throw new Error('Invalid recipient address');
    const signer = this.getSigner();
    const network = this.getActiveNetwork();
    const tx = await signer.sendTransaction({ to, value: ethers.parseEther(amount) });
    await tx.wait();
    return {
      hash: tx.hash, from: this.wallet.address, to, amount,
      network: network.name, blockExplorerUrl: `${network.blockExplorer}/tx/${tx.hash}`,
    };
  }

  async sendIDIA(to: string, amount: string): Promise<TransactionResult> {
    if (!this.wallet) throw new Error('No wallet loaded');
    if (!ethers.isAddress(to)) throw new Error('Invalid recipient address');
    const { idiaToken } = this.getTokenAddresses();
    if (!idiaToken) throw new Error('IDIA token not deployed on this network');

    const signer = this.getSigner();
    const network = this.getActiveNetwork();
    const token = new ethers.Contract(idiaToken, IDIA_TOKEN_ABI, signer);
    const tx = await token.transfer(to, ethers.parseEther(amount));
    await tx.wait();
    return {
      hash: tx.hash, from: this.wallet.address, to,
      amount: `${amount} IDIA`, network: network.name,
      blockExplorerUrl: `${network.blockExplorer}/tx/${tx.hash}`,
    };
  }

  async sendToken(tokenAddress: string, to: string, amount: string): Promise<TransactionResult> {
    if (!this.wallet) throw new Error('No wallet loaded');
    if (!ethers.isAddress(to)) throw new Error('Invalid recipient address');
    const signer = this.getSigner();
    const network = this.getActiveNetwork();
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const decimals = await token.decimals();
    const symbol = await token.symbol();
    const tx = await token.transfer(to, ethers.parseUnits(amount, decimals));
    await tx.wait();
    return {
      hash: tx.hash, from: this.wallet.address, to,
      amount: `${amount} ${symbol}`, network: network.name,
      blockExplorerUrl: `${network.blockExplorer}/tx/${tx.hash}`,
    };
  }

  async estimateTransfer(to: string, amount: string): Promise<{
    gasFeeFormatted: string; totalCostFormatted: string; symbol: string;
  } | null> {
    if (!this.wallet) return null;
    try {
      const provider = this.getProvider();
      const network = this.getActiveNetwork();
      const amountWei = ethers.parseEther(amount);
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || 0n;
      const gasLimit = await provider.estimateGas({ from: this.wallet.address, to: req.to, value: amountWei, data: req.data });
      const gasFeeWei = gasPrice * gasLimit;
      return {
        gasFeeFormatted: ethers.formatEther(gasFeeWei),
        totalCostFormatted: ethers.formatEther(amountWei + gasFeeWei),
        symbol: net.symbol,
        network: net.name,
      };
    } catch (e) { console.error('Estimate failed:', e); return null; }
  }

  async sendTransaction(req: TxRequest): Promise<TxResult> {
    if (!this.wallet) throw new Error('No wallet');
    if (!ethers.isAddress(req.to)) throw new Error('Invalid recipient address');
    const net = NETWORKS[this.activeNetwork];
    const provider = this.getProvider();
    const signer = this.wallet.connect(provider);
    const tx = await signer.sendTransaction({ to: req.to, value: ethers.parseEther(req.amount), data: req.data });
    await tx.wait();
    return {
      hash: tx.hash,
      from: this.wallet.address,
      to: req.to,
      amount: req.amount,
      network: net.name,
      blockExplorerUrl: `${net.blockExplorer}/tx/${tx.hash}`,
    };
  }
}

export const walletService = new WalletService();