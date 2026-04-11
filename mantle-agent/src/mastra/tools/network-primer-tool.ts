import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const SNAPSHOT_DATE = "2026-03-08";

const NETWORK_DATA = {
	mainnet: {
		chainId: 5000,
		rpcUrl: "https://rpc.mantle.xyz",
		wsUrl: "wss://rpc.mantle.xyz",
		explorer: "https://mantlescan.xyz/",
		gasToken: "MNT",
		bridgeUrl: "https://app.mantle.xyz/bridge",
		wmntAddress: "0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8",
		recommendedSolidity: "v0.8.23 or below",
		l1Contracts:
			"https://docs.mantle.xyz/network/system-information/on-chain-system/key-l1-contract-address",
		l2Contracts:
			"https://docs.mantle.xyz/network/system-information/off-chain-system/key-l2-contract-address",
		tokenList: "https://token-list.mantle.xyz",
	},
	testnet: {
		chainId: 5003,
		rpcUrl: "https://rpc.sepolia.mantle.xyz",
		wsUrl: "N/A",
		explorer: "https://sepolia.mantlescan.xyz/",
		gasToken: "MNT",
		bridgeUrl: "https://app.mantle.xyz/bridge?network=sepolia",
		wmntAddress: "0x19f5557E23e9914A18239990f6C70D68FDF0deD5",
		faucetUrl: "https://faucet.sepolia.mantle.xyz/",
		recommendedSolidity: "v0.8.23 or below",
	},
};

const KEY_DIFFERENCES = [
	"Gas token is MNT — wallets must be funded with MNT, not ETH, before transacting.",
	"'Inclusion' (transaction visible in L2 block) ≠ 'L1-backed settlement finality'. The strongest finality requires L1 conditions to be satisfied.",
	"Mantle v2 Skadi uses a ZK validity proving module and Ethereum data availability via blobs (as of 2026-03-08 snapshot; treat architecture details as live-verify items).",
	"Mainnet Chain ID: 5000 / Sepolia Testnet Chain ID: 5003 — use these exact values in wallet and RPC config.",
	"Official public RPC endpoints are rate-limited. Use dedicated providers for production workloads.",
	"Recommended Solidity compiler: v0.8.23 or below (as of 2026-03-08 snapshot).",
];

const CONTRACT_SOURCES = {
	l1SystemContracts:
		"https://docs.mantle.xyz/network/system-information/on-chain-system/key-l1-contract-address",
	l2SystemContracts:
		"https://docs.mantle.xyz/network/system-information/off-chain-system/key-l2-contract-address",
	tokenList: "https://token-list.mantle.xyz",
	bridgeReference: "https://bridge.mantle.xyz",
	providerDirectory:
		"https://docs.mantle.xyz/network/for-developers/resources-and-tooling/node-endpoints-and-providers",
};

export const getMantleNetworkInfo = createTool({
	id: "get-mantle-network-info",
	description:
		"Returns structured Mantle Network fundamentals: chain IDs, RPC endpoints, gas token, key differences from Ethereum, contract sources, and developer hints. All values are from the verified snapshot dated 2026-03-08. Time-sensitive values (fees, throughput, architecture rollout) must be live-verified.",
	inputSchema: z.object({
		topic: z
			.enum(["basics", "mainnet", "testnet", "differences", "contracts"])
			.default("basics")
			.describe("Which aspect of Mantle Network to query"),
	}),
	outputSchema: z.object({
		topic: z.string(),
		snapshotDate: z.string(),
		gasToken: z.string(),
		mainnet: z
			.object({
				chainId: z.number(),
				rpcUrl: z.string(),
				wsUrl: z.string(),
				explorer: z.string(),
				bridgeUrl: z.string(),
				wmntAddress: z.string(),
				recommendedSolidity: z.string(),
			})
			.optional(),
		testnet: z
			.object({
				chainId: z.number(),
				rpcUrl: z.string(),
				explorer: z.string(),
				bridgeUrl: z.string(),
				wmntAddress: z.string(),
				faucetUrl: z.string().optional(),
				recommendedSolidity: z.string(),
			})
			.optional(),
		keyDifferences: z.array(z.string()).optional(),
		contractSources: z
			.object({
				l1SystemContracts: z.string(),
				l2SystemContracts: z.string(),
				tokenList: z.string(),
				bridgeReference: z.string(),
				providerDirectory: z.string(),
			})
			.optional(),
		liveVerifyItems: z.array(z.string()),
		docsUrl: z.string(),
	}),
	execute: async (inputData) => {
		const { topic } = inputData;

		const liveVerifyItems = [
			"Fee levels and throughput",
			"Architecture rollout status (ZK prover, blob DA details)",
			"Exact contract addresses for tokens and bridges",
			"Current RPC provider availability",
		];

		const base = {
			topic: topic ?? "basics",
			snapshotDate: SNAPSHOT_DATE,
			gasToken: "MNT",
			liveVerifyItems,
			docsUrl: "https://docs.mantle.xyz/network/for-developers/quick-access",
		};

		switch (topic) {
			case "mainnet":
				return { ...base, mainnet: NETWORK_DATA.mainnet };
			case "testnet":
				return { ...base, testnet: NETWORK_DATA.testnet };
			case "differences":
				return { ...base, keyDifferences: KEY_DIFFERENCES };
			case "contracts":
				return { ...base, contractSources: CONTRACT_SOURCES };
			case "basics":
			default:
				return {
					...base,
					mainnet: NETWORK_DATA.mainnet,
					testnet: NETWORK_DATA.testnet,
					keyDifferences: KEY_DIFFERENCES,
					contractSources: CONTRACT_SOURCES,
				};
		}
	},
});
