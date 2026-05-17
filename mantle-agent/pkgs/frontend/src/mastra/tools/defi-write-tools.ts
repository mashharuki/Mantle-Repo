import {
	getAgentAddress,
	getAgentWalletClient,
	getExplorerUrl,
	getPublicClient,
} from "@/lib/viem-clients";
import { createTool } from "@mastra/core/tools";
import { erc20Abi, formatUnits, parseUnits } from "viem";
import { z } from "zod";

type Network = "mainnet" | "sepolia";

// Agni Finance contract addresses per network
const AGNI_ADDRESSES: Record<
	Network,
	{ swapRouter: `0x${string}`; quoterV2: `0x${string}` }
> = {
	mainnet: {
		swapRouter: "0x319B69888136b4290B9370Cef5c13B57AC4a1c4a",
		quoterV2: "0xc4aaDc921E1cdb66c5300Bc158a313292923C0cb",
	},
	sepolia: {
		swapRouter: "0xe38cfa32Aca0E9FA29245dc0fce04CD9ea87B8A4",
		quoterV2: "0x9Da17239D0C6A9E65Ce93A5E07F65C34C64B9E2e",
	},
};

// Known tokens per network
const KNOWN_TOKENS: Record<
	Network,
	Record<string, { address: `0x${string}`; decimals: number }>
> = {
	mainnet: {
		MNT: {
			address: "0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8",
			decimals: 18,
		},
		WMNT: {
			address: "0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8",
			decimals: 18,
		},
		USDT: {
			address: "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE",
			decimals: 6,
		},
		USDC: {
			address: "0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9",
			decimals: 6,
		},
		WETH: {
			address: "0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111",
			decimals: 18,
		},
	},
	sepolia: {
		/*
		MNT: {
			address: "0x67A1f4A939A477C58C43Ae46f38fF81f3e10F1f3",
			decimals: 18,
		},
		*/
		WMNT: {
			address: "0x67A1f4A939b477A6b7c5BF94D97E45dE87E608eF",
			decimals: 18,
		},
		MANA: {
			address: "0xF6762aFB45ac0aF7ddC5aA92B885c6ECe57874dc",
			decimals: 18,
		},
	},
};

// Agni QuoterV2 ABI (quoteExactInputSingle)
const QUOTER_V2_ABI = [
	{
		inputs: [
			{
				components: [
					{ name: "tokenIn", type: "address" },
					{ name: "tokenOut", type: "address" },
					{ name: "amountIn", type: "uint256" },
					{ name: "fee", type: "uint24" },
					{ name: "sqrtPriceLimitX96", type: "uint160" },
				],
				name: "params",
				type: "tuple",
			},
		],
		name: "quoteExactInputSingle",
		outputs: [
			{ name: "amountOut", type: "uint256" },
			{ name: "sqrtPriceX96After", type: "uint160" },
			{ name: "initializedTicksCrossed", type: "uint32" },
			{ name: "gasEstimate", type: "uint256" },
		],
		stateMutability: "nonpayable",
		type: "function",
	},
] as const;

// Agni SwapRouter ABI (exactInputSingle)
const SWAP_ROUTER_ABI = [
	{
		inputs: [
			{
				components: [
					{ name: "tokenIn", type: "address" },
					{ name: "tokenOut", type: "address" },
					{ name: "fee", type: "uint24" },
					{ name: "recipient", type: "address" },
					{ name: "deadline", type: "uint256" },
					{ name: "amountIn", type: "uint256" },
					{ name: "amountOutMinimum", type: "uint256" },
					{ name: "sqrtPriceLimitX96", type: "uint160" },
				],
				name: "params",
				type: "tuple",
			},
		],
		name: "exactInputSingle",
		outputs: [{ name: "amountOut", type: "uint256" }],
		stateMutability: "payable",
		type: "function",
	},
] as const;

function resolveToken(
	symbolOrAddress: string,
	network: Network,
): { address: `0x${string}`; decimals: number } | null {
	const upper = symbolOrAddress.toUpperCase();
	const tokens = KNOWN_TOKENS[network];
	if (tokens[upper]) return tokens[upper];
	if (/^0x[0-9a-fA-F]{40}$/.test(symbolOrAddress)) {
		return { address: symbolOrAddress as `0x${string}`, decimals: 18 };
	}
	return null;
}

const networkSchema = z.enum(["mainnet", "sepolia"]).default("sepolia");

export const sendNativeToken = createTool({
	id: "send-native-token",
	description:
		"Send native MNT tokens from the agent wallet to a specified address. Requires AGENT_PRIVATE_KEY to be set.",
	inputSchema: z.object({
		to: z.string().describe("Recipient address (0x...)"),
		amount: z.string().describe("Amount in MNT (human-readable, e.g. '0.001')"),
		network: networkSchema.describe("Mantle network"),
	}),
	outputSchema: z.object({
		txHash: z.string(),
		explorerUrl: z.string(),
		from: z.string(),
		to: z.string(),
		amountMNT: z.string(),
		network: z.string(),
	}),
	execute: async (input) => {
		const network = input.network ?? "sepolia";
		const walletClient = getAgentWalletClient(network);
		const agentAddress = getAgentAddress();
		const value = parseUnits(input.amount, 18);

		const txHash = await walletClient.sendTransaction({
			to: input.to as `0x${string}`,
			value,
			account: walletClient.account!,
			chain: walletClient.chain,
		});

		return {
			txHash,
			explorerUrl: getExplorerUrl(txHash, network),
			from: agentAddress,
			to: input.to,
			amountMNT: input.amount,
			network,
		};
	},
});

export const approveERC20Token = createTool({
	id: "approve-erc20-token",
	description:
		"Approve a spender to use ERC-20 tokens from the agent wallet. Requires AGENT_PRIVATE_KEY to be set.",
	inputSchema: z.object({
		tokenAddress: z.string().describe("ERC-20 token contract address (0x...)"),
		spender: z.string().describe("Spender address to approve (0x...)"),
		amount: z
			.string()
			.describe("Amount to approve in human-readable units (e.g. '100.5')"),
		decimals: z
			.number()
			.int()
			.default(18)
			.describe("Token decimals (default: 18)"),
		network: networkSchema.describe("Mantle network"),
	}),
	outputSchema: z.object({
		txHash: z.string(),
		explorerUrl: z.string(),
		tokenAddress: z.string(),
		spender: z.string(),
		amount: z.string(),
		network: z.string(),
	}),
	execute: async (input) => {
		const network = input.network ?? "sepolia";
		const walletClient = getAgentWalletClient(network);
		const publicClient = getPublicClient(network);
		const decimals = input.decimals ?? 18;
		const amountWei = parseUnits(input.amount, decimals);

		const { request } = await publicClient.simulateContract({
			address: input.tokenAddress as `0x${string}`,
			abi: erc20Abi,
			functionName: "approve",
			args: [input.spender as `0x${string}`, amountWei],
			account: walletClient.account,
		});
		const txHash = await walletClient.writeContract(request);

		return {
			txHash,
			explorerUrl: getExplorerUrl(txHash, network),
			tokenAddress: input.tokenAddress,
			spender: input.spender,
			amount: input.amount,
			network,
		};
	},
});

export const executeAgniSwap = createTool({
	id: "execute-agni-swap",
	description:
		"Execute a token swap on Agni Finance (Uniswap V3 fork) on Mantle Network. " +
		"By default, quotes via QuoterV2 first; set amountOutMinimum to skip the quote step entirely (useful on testnet where pools may not exist). " +
		"Requires AGENT_PRIVATE_KEY to be set.",
	inputSchema: z.object({
		tokenIn: z.string().describe("Input token symbol (e.g. WMNT) or address"),
		tokenOut: z.string().describe("Output token symbol (e.g. USDT) or address"),
		amountIn: z
			.string()
			.describe("Input amount in human-readable units (e.g. '0.01')"),
		amountOutMinimum: z
			.string()
			.optional()
			.describe(
				"Minimum output amount in human-readable units (e.g. '0'). " +
				"If provided, the QuoterV2 quote step is skipped entirely. " +
				"Use '0' on testnet when no pool exists yet.",
			),
		slippageBps: z
			.number()
			.int()
			.min(1)
			.max(1000)
			.default(50)
			.describe("Slippage tolerance in bps applied to the QuoterV2 quote (ignored when amountOutMinimum is provided)"),
		feeTier: z
			.number()
			.int()
			.default(2500)
			.describe(
				"Agni pool fee tier: 100, 500, 2500, or 10000 (default: 2500 = 0.25%)",
			),
		network: networkSchema.describe("Mantle network"),
	}),
	outputSchema: z.object({
		approveTxHash: z.string().optional(),
		swapTxHash: z.string(),
		amountIn: z.string(),
		amountOutMinimum: z.string(),
		quotedAmountOut: z.string().optional(),
		tokenIn: z.string(),
		tokenOut: z.string(),
		network: z.string(),
		quoteSkipped: z.boolean(),
		explorerUrls: z.object({
			approve: z.string().optional(),
			swap: z.string(),
		}),
	}),
	execute: async (input) => {
		const network = input.network ?? "sepolia";
		const feeTier = input.feeTier ?? 2500;
		const slippageBps = input.slippageBps ?? 50;
		const addresses = AGNI_ADDRESSES[network];

		const tokenInInfo = resolveToken(input.tokenIn, network);
		const tokenOutInfo = resolveToken(input.tokenOut, network);
		if (!tokenInInfo) throw new Error(`Unknown tokenIn: ${input.tokenIn}`);
		if (!tokenOutInfo) throw new Error(`Unknown tokenOut: ${input.tokenOut}`);

		const amountInWei = parseUnits(input.amountIn, tokenInInfo.decimals);
		const agentAddress = getAgentAddress();
		const publicClient = getPublicClient(network);
		const walletClient = getAgentWalletClient(network);

		// Step 1: Determine amountOutMinimum
		let amountOutMin: bigint;
		let quotedAmountOut: string | undefined;
		let quoteSkipped: boolean;

		if (input.amountOutMinimum !== undefined) {
			// User-provided minimum — skip QuoterV2 entirely
			amountOutMin = parseUnits(input.amountOutMinimum, tokenOutInfo.decimals);
			quoteSkipped = true;
		} else {
			// Attempt QuoterV2 quote; fall back to 0 if pool doesn't exist
			quoteSkipped = false;
			try {
				const quoteResult = await publicClient.simulateContract({
					address: addresses.quoterV2,
					abi: QUOTER_V2_ABI,
					functionName: "quoteExactInputSingle",
					args: [
						{
							tokenIn: tokenInInfo.address,
							tokenOut: tokenOutInfo.address,
							amountIn: amountInWei,
							fee: feeTier,
							sqrtPriceLimitX96: 0n,
						},
					],
				});
				const rawOut = quoteResult.result[0];
				amountOutMin = (rawOut * BigInt(10000 - slippageBps)) / 10000n;
				quotedAmountOut = formatUnits(rawOut, tokenOutInfo.decimals);
			} catch {
				// No pool on testnet — proceed with 0 minimum
				amountOutMin = 0n;
				quoteSkipped = true;
			}
		}

		// Step 2: Approve tokenIn to SwapRouter
		let approveTxHash: string | undefined;
		try {
			const { request: approveRequest } = await publicClient.simulateContract({
				address: tokenInInfo.address,
				abi: erc20Abi,
				functionName: "approve",
				args: [addresses.swapRouter, amountInWei],
				account: walletClient.account,
			});
			approveTxHash = await walletClient.writeContract(approveRequest);
			// Wait for approval to be mined before executing the swap
			await publicClient.waitForTransactionReceipt({ hash: approveTxHash as `0x${string}` });
		} catch {
			// Native token or pre-approved — approve not required
		}

		// Step 3: Execute swap
		const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
		const { request: swapRequest } = await publicClient.simulateContract({
			address: addresses.swapRouter,
			abi: SWAP_ROUTER_ABI,
			functionName: "exactInputSingle",
			args: [
				{
					tokenIn: tokenInInfo.address,
					tokenOut: tokenOutInfo.address,
					fee: feeTier,
					recipient: agentAddress,
					deadline,
					amountIn: amountInWei,
					amountOutMinimum: amountOutMin,
					sqrtPriceLimitX96: 0n,
				},
			],
			account: walletClient.account,
		});
		const swapTxHash = await walletClient.writeContract(swapRequest);

		return {
			approveTxHash,
			swapTxHash,
			amountIn: input.amountIn,
			amountOutMinimum: formatUnits(amountOutMin, tokenOutInfo.decimals),
			quotedAmountOut,
			tokenIn: input.tokenIn,
			tokenOut: input.tokenOut,
			network,
			quoteSkipped,
			explorerUrls: {
				approve: approveTxHash ? getExplorerUrl(approveTxHash, network) : undefined,
				swap: getExplorerUrl(swapTxHash, network),
			},
		};
	},
});
