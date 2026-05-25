import {
	getAgentWalletClient,
	getExplorerUrl,
	getPublicClient,
} from "@/lib/viem-clients";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const DEFAULT_COUNTER_ADDRESS =
	"0xfDFaDffE28d17935A48ffB1Ab3076dBc8CadE623" as const;

const COUNTER_ABI = [
	{
		inputs: [],
		name: "x",
		outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "owner",
		outputs: [{ internalType: "address", name: "", type: "address" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "inc",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
		name: "incBy",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [],
		name: "reset",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
] as const;

const networkSchema = z.enum(["mainnet", "testnet"]).default("testnet");

export const getCounterState = createTool({
	id: "get-counter-state",
	description:
		"Read the current state of the Counter contract on Mantle Network. Returns the current count value (x) and the owner address.",
	inputSchema: z.object({
		contractAddress: z
			.string()
			.optional()
			.describe(
				`Counter contract address (default: ${DEFAULT_COUNTER_ADDRESS})`,
			),
		network: networkSchema.describe("Mantle network to query"),
	}),
	outputSchema: z.object({
		contractAddress: z.string(),
		x: z.string(),
		owner: z.string(),
		network: z.string(),
	}),
	execute: async (input) => {
		const network = input.network ?? "testnet";
		const address = (input.contractAddress ??
			DEFAULT_COUNTER_ADDRESS) as `0x${string}`;
		const client = getPublicClient(network);

		const [x, owner] = await Promise.all([
			client.readContract({ address, abi: COUNTER_ABI, functionName: "x" }),
			client.readContract({ address, abi: COUNTER_ABI, functionName: "owner" }),
		]);

		return {
			contractAddress: address,
			x: x.toString(),
			owner: owner as string,
			network,
		};
	},
});

export const counterIncrement = createTool({
	id: "counter-increment",
	description:
		"Increment the Counter contract by 1. Requires AGENT_PRIVATE_KEY to be set and the agent address must be the contract owner.",
	inputSchema: z.object({
		contractAddress: z
			.string()
			.optional()
			.describe(
				`Counter contract address (default: ${DEFAULT_COUNTER_ADDRESS})`,
			),
		network: networkSchema.describe("Mantle network"),
	}),
	outputSchema: z.object({
		txHash: z.string(),
		explorerUrl: z.string(),
		contractAddress: z.string(),
		network: z.string(),
	}),
	execute: async (input) => {
		const network = input.network ?? "testnet";
		const address = (input.contractAddress ??
			DEFAULT_COUNTER_ADDRESS) as `0x${string}`;
		const walletClient = getAgentWalletClient(network);
		const publicClient = getPublicClient(network);

		const { request } = await publicClient.simulateContract({
			address,
			abi: COUNTER_ABI,
			functionName: "inc",
			account: walletClient.account,
		});
		const txHash = await walletClient.writeContract(request);

		return {
			txHash,
			explorerUrl: getExplorerUrl(txHash, network),
			contractAddress: address,
			network,
		};
	},
});

export const counterIncrementBy = createTool({
	id: "counter-increment-by",
	description:
		"Increment the Counter contract by a specified amount. Requires AGENT_PRIVATE_KEY to be set and the agent address must be the contract owner.",
	inputSchema: z.object({
		amount: z
			.number()
			.int()
			.positive()
			.describe("Amount to increment by (must be > 0)"),
		contractAddress: z
			.string()
			.optional()
			.describe(
				`Counter contract address (default: ${DEFAULT_COUNTER_ADDRESS})`,
			),
		network: networkSchema.describe("Mantle network"),
	}),
	outputSchema: z.object({
		txHash: z.string(),
		explorerUrl: z.string(),
		contractAddress: z.string(),
		amount: z.number(),
		network: z.string(),
	}),
	execute: async (input) => {
		const network = input.network ?? "testnet";
		const address = (input.contractAddress ??
			DEFAULT_COUNTER_ADDRESS) as `0x${string}`;
		const walletClient = getAgentWalletClient(network);
		const publicClient = getPublicClient(network);

		const { request } = await publicClient.simulateContract({
			address,
			abi: COUNTER_ABI,
			functionName: "incBy",
			args: [BigInt(input.amount)],
			account: walletClient.account,
		});
		const txHash = await walletClient.writeContract(request);

		return {
			txHash,
			explorerUrl: getExplorerUrl(txHash, network),
			contractAddress: address,
			amount: input.amount,
			network,
		};
	},
});

export const counterReset = createTool({
	id: "counter-reset",
	description:
		"Reset the Counter contract value to 0. Requires AGENT_PRIVATE_KEY to be set and the agent address must be the contract owner.",
	inputSchema: z.object({
		contractAddress: z
			.string()
			.optional()
			.describe(
				`Counter contract address (default: ${DEFAULT_COUNTER_ADDRESS})`,
			),
		network: networkSchema.describe("Mantle network"),
	}),
	outputSchema: z.object({
		txHash: z.string(),
		explorerUrl: z.string(),
		contractAddress: z.string(),
		network: z.string(),
	}),
	execute: async (input) => {
		const network = input.network ?? "testnet";
		const address = (input.contractAddress ??
			DEFAULT_COUNTER_ADDRESS) as `0x${string}`;
		const walletClient = getAgentWalletClient(network);
		const publicClient = getPublicClient(network);

		const { request } = await publicClient.simulateContract({
			address,
			abi: COUNTER_ABI,
			functionName: "reset",
			account: walletClient.account,
		});
		const txHash = await walletClient.writeContract(request);

		return {
			txHash,
			explorerUrl: getExplorerUrl(txHash, network),
			contractAddress: address,
			network,
		};
	},
});
