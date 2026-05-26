import {
	CHAIN_IDS,
	getPublicClient,
	type Network,
	type PendingSignatureOutput,
} from "@/lib/viem-clients";
import { createTool } from "@mastra/core/tools";
import { encodeFunctionData } from "viem";
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
		"Increment the Counter contract by 1. Returns an unsigned transaction for the user to sign via MetaMask.",
	inputSchema: z.object({
		contractAddress: z
			.string()
			.optional()
			.describe(
				`Counter contract address (default: ${DEFAULT_COUNTER_ADDRESS})`,
			),
		fromAddress: z
			.string()
			.optional()
			.describe("Sender address (optional, for gas estimation)"),
		network: networkSchema.describe("Mantle network"),
	}),
	outputSchema: z.object({
		type: z.literal("pending_signature"),
		description: z.string(),
		unsignedTx: z.object({
			to: z.string(),
			data: z.string(),
			value: z.string(),
			gas: z.string().optional(),
			chainId: z.number(),
		}),
		simulationPassed: z.boolean(),
		estimatedFee: z.string(),
	}),
	execute: async (input): Promise<PendingSignatureOutput> => {
		const network = (input.network ?? "testnet") as Network;
		const address = (input.contractAddress ??
			DEFAULT_COUNTER_ADDRESS) as `0x${string}`;
		const data = encodeFunctionData({ abi: COUNTER_ABI, functionName: "inc" });
		const publicClient = getPublicClient(network);
		let gas: bigint | undefined;
		try {
			gas = await publicClient.estimateGas({
				to: address,
				data,
				...(input.fromAddress
					? { account: input.fromAddress as `0x${string}` }
					: {}),
			});
			gas = (gas * 120n) / 100n;
		} catch {
			/* ignore */
		}
		return {
			type: "pending_signature",
			description: `Increment Counter at ${address} by 1`,
			unsignedTx: {
				to: address,
				data,
				value: "0",
				...(gas ? { gas: gas.toString() } : {}),
				chainId: CHAIN_IDS[network],
			},
			simulationPassed: false,
			estimatedFee: gas ? `~${(gas * 2000000n) / 10n ** 18n} MNT` : "unknown",
		};
	},
});

export const counterIncrementBy = createTool({
	id: "counter-increment-by",
	description:
		"Increment the Counter contract by a specified amount. Returns an unsigned transaction for the user to sign via MetaMask.",
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
		fromAddress: z.string().optional().describe("Sender address (optional)"),
		network: networkSchema.describe("Mantle network"),
	}),
	outputSchema: z.object({
		type: z.literal("pending_signature"),
		description: z.string(),
		unsignedTx: z.object({
			to: z.string(),
			data: z.string(),
			value: z.string(),
			gas: z.string().optional(),
			chainId: z.number(),
		}),
		simulationPassed: z.boolean(),
		estimatedFee: z.string(),
	}),
	execute: async (input): Promise<PendingSignatureOutput> => {
		const network = (input.network ?? "testnet") as Network;
		const address = (input.contractAddress ??
			DEFAULT_COUNTER_ADDRESS) as `0x${string}`;
		const data = encodeFunctionData({
			abi: COUNTER_ABI,
			functionName: "incBy",
			args: [BigInt(input.amount)],
		});
		const publicClient = getPublicClient(network);
		let gas: bigint | undefined;
		try {
			gas = await publicClient.estimateGas({
				to: address,
				data,
				...(input.fromAddress
					? { account: input.fromAddress as `0x${string}` }
					: {}),
			});
			gas = (gas * 120n) / 100n;
		} catch {
			/* ignore */
		}
		return {
			type: "pending_signature",
			description: `Increment Counter at ${address} by ${input.amount}`,
			unsignedTx: {
				to: address,
				data,
				value: "0",
				...(gas ? { gas: gas.toString() } : {}),
				chainId: CHAIN_IDS[network],
			},
			simulationPassed: false,
			estimatedFee: gas ? `~${(gas * 2000000n) / 10n ** 18n} MNT` : "unknown",
		};
	},
});

export const counterReset = createTool({
	id: "counter-reset",
	description:
		"Reset the Counter contract value to 0. Returns an unsigned transaction for the user to sign via MetaMask.",
	inputSchema: z.object({
		contractAddress: z
			.string()
			.optional()
			.describe(
				`Counter contract address (default: ${DEFAULT_COUNTER_ADDRESS})`,
			),
		fromAddress: z.string().optional().describe("Sender address (optional)"),
		network: networkSchema.describe("Mantle network"),
	}),
	outputSchema: z.object({
		type: z.literal("pending_signature"),
		description: z.string(),
		unsignedTx: z.object({
			to: z.string(),
			data: z.string(),
			value: z.string(),
			gas: z.string().optional(),
			chainId: z.number(),
		}),
		simulationPassed: z.boolean(),
		estimatedFee: z.string(),
	}),
	execute: async (input): Promise<PendingSignatureOutput> => {
		const network = (input.network ?? "testnet") as Network;
		const address = (input.contractAddress ??
			DEFAULT_COUNTER_ADDRESS) as `0x${string}`;
		const data = encodeFunctionData({
			abi: COUNTER_ABI,
			functionName: "reset",
		});
		const publicClient = getPublicClient(network);
		let gas: bigint | undefined;
		try {
			gas = await publicClient.estimateGas({
				to: address,
				data,
				...(input.fromAddress
					? { account: input.fromAddress as `0x${string}` }
					: {}),
			});
			gas = (gas * 120n) / 100n;
		} catch {
			/* ignore */
		}
		return {
			type: "pending_signature",
			description: `Reset Counter at ${address} to 0`,
			unsignedTx: {
				to: address,
				data,
				value: "0",
				...(gas ? { gas: gas.toString() } : {}),
				chainId: CHAIN_IDS[network],
			},
			simulationPassed: false,
			estimatedFee: gas ? `~${(gas * 2000000n) / 10n ** 18n} MNT` : "unknown",
		};
	},
});
