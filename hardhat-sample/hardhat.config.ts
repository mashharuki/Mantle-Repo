import { defineConfig, configVariable } from "hardhat/config";
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";

export default defineConfig({
  plugins: [hardhatToolboxViem],

  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  networks: {
    // ローカルシミュレーション（デフォルト）
    hardhat: {
      type: "edr-simulated",
      chainType: "l1",
    },

    // Mantle Sepolia Testnet
    // ガストークンはMNT（ETHではない）
    mantleSepolia: {
      type: "http",
      chainType: "generic",
      url: configVariable("MANTLE_SEPOLIA_RPC_URL"),
      accounts: [configVariable("DEPLOYER_PRIVATE_KEY")],
      // Mantle Sepolia: chainId 5003
    },

    // Mantle Mainnet
    mantleMainnet: {
      type: "http",
      chainType: "generic",
      url: configVariable("MANTLE_MAINNET_RPC_URL"),
      accounts: [configVariable("DEPLOYER_PRIVATE_KEY")],
      // Mantle Mainnet: chainId 5000
    },
  },

  // Mantle Explorer（Blockscout）でのコントラクト検証
  etherscan: {
    apiKey: {
      mantleSepolia: configVariable("MANTLE_EXPLORER_API_KEY"),
      mantleMainnet: configVariable("MANTLE_EXPLORER_API_KEY"),
    },
    customChains: [
      {
        network: "mantleSepolia",
        chainId: 5003,
        urls: {
          apiURL: "https://explorer.sepolia.mantle.xyz/api",
          browserURL: "https://explorer.sepolia.mantle.xyz",
        },
      },
      {
        network: "mantleMainnet",
        chainId: 5000,
        urls: {
          apiURL: "https://explorer.mantle.xyz/api",
          browserURL: "https://explorer.mantle.xyz",
        },
      },
    ],
  },
});
