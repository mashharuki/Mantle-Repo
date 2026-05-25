import {
    getAgentAddress,
    getAgentWalletClient,
    getExplorerUrl,
    getPublicClient,
} from "@/lib/viem-clients";
import { createTool } from "@mastra/core/tools";
import { erc20Abi, formatUnits, parseUnits } from "viem";
import { z } from "zod";

type Network = "mainnet" | "testnet";

// Agni Finance contract addresses per network
const AGNI_ADDRESSES: Record<
	Network,
	{ swapRouter: `0x${string}`; quoterV2: `0x${string}` }
> = {
	mainnet: {
		swapRouter: "0x319B69888136b4290B9370Cef5c13B57AC4a1c4a",
		quoterV2: "0xc4aaDc921E1cdb66c5300Bc158a313292923C0cb",
	},
	testnet: {
		swapRouter: "0xb5Dc27be0a565A4A80440f41c74137001920CB22",
		quoterV2: "0x9Da17239a4170f50A5A2c11813BD0C601b5c9693",
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
	testnet: {
		// MNT is an alias for WMNT on testnet — Agni requires ERC-20 (WMNT), not native MNT
		MNT: {
			address: "0x67A1f4A939b477A6b7c5BF94D97E45dE87E608eF",
			decimals: 18,
		},
		WMNT: {
			address: "0x67A1f4A939b477A6b7c5BF94D97E45dE87E608eF",
			decimals: 18,
		},
		USDC: {
			address: "0xAcab8129E2cE587fD203FD770ec9ECAFA2C88080",
			decimals: 6,
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
	{
		inputs: [
			{ name: "path", type: "bytes" },
			{ name: "amountIn", type: "uint256" },
		],
		name: "quoteExactInput",
		outputs: [
			{ name: "amountOut", type: "uint256" },
			{ name: "sqrtPriceX96AfterList", type: "uint160[]" },
			{ name: "initializedTicksCrossedList", type: "uint32[]" },
			{ name: "gasEstimate", type: "uint256" },
		],
		stateMutability: "nonpayable",
		type: "function",
	},
] as const;

// Agni SwapRouter ABI (exactInputSingle + exactInput)
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
	{
		inputs: [
			{
				components: [
					{ name: "path", type: "bytes" },
					{ name: "recipient", type: "address" },
					{ name: "deadline", type: "uint256" },
					{ name: "amountIn", type: "uint256" },
					{ name: "amountOutMinimum", type: "uint256" },
				],
				name: "params",
				type: "tuple",
			},
		],
		name: "exactInput",
		outputs: [{ name: "amountOut", type: "uint256" }],
		stateMutability: "payable",
		type: "function",
	},
] as const;

/**
 * Encode a Uniswap V3 multi-hop path.
 * path = tokenIn (20B) + fee (3B) + token1 (20B) + fee (3B) + tokenOut (20B) + ...
 */
function encodeV3Path(tokens: string[], fees: number[]): `0x${string}` {
	let path = tokens[0].toLowerCase().slice(2);
	for (let i = 0; i < fees.length; i++) {
		path += fees[i].toString(16).padStart(6, "0");
		path += tokens[i + 1].toLowerCase().slice(2);
	}
	return `0x${path}` as `0x${string}`;
}

/**
 * Returns true if tokenIn or tokenOut is WMNT (i.e. a direct single-hop pool exists).
 * Non-WMNT pairs must route through WMNT as bridge (multi-hop).
 */
function isDirectPool(
	tokenInAddr: `0x${string}`,
	tokenOutAddr: `0x${string}`,
	network: Network,
): boolean {
	const wmntAddr = KNOWN_TOKENS[network].WMNT?.address.toLowerCase();
	if (!wmntAddr) return true; // fallback: assume direct
	return (
		tokenInAddr.toLowerCase() === wmntAddr ||
		tokenOutAddr.toLowerCase() === wmntAddr
	);
}

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

const networkSchema = z.enum(["mainnet", "testnet"]).default("testnet");

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
		const network = input.network ?? "testnet";
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
		const network = input.network ?? "testnet";
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
			.describe(
				"Slippage tolerance in bps applied to the QuoterV2 quote (ignored when amountOutMinimum is provided)",
			),
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
		const network = input.network ?? "testnet";
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
			// Wait for approval to be mined before executing the swap (60s timeout)
			await publicClient.waitForTransactionReceipt({
				hash: approveTxHash as `0x${string}`,
				timeout: 60_000,
			});
		} catch (err) {
			// Re-throw timeout/RPC errors so the tool fails fast instead of hanging
			if (
				err instanceof Error &&
				err.name !== "ContractFunctionExecutionError"
			) {
				throw err;
			}
			// ContractFunctionExecutionError = native token or pre-approved, safe to skip
		}

		// Step 3: Execute swap
		const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
		const useDirect = isDirectPool(tokenInInfo.address, tokenOutInfo.address, network);
		let swapTxHash: string;

		if (useDirect) {
			// Single-hop: one token is WMNT, direct pool exists
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
			swapTxHash = await walletClient.writeContract(swapRequest);
		} else {
			// Multi-hop: no direct pool → route through WMNT
			const wmntAddr = KNOWN_TOKENS[network].WMNT!.address;
			const path = encodeV3Path(
				[tokenInInfo.address, wmntAddr, tokenOutInfo.address],
				[feeTier, feeTier],
			);
			console.log(
				`[execute-agni-swap] Multi-hop path: ${input.tokenIn} → WMNT → ${input.tokenOut}`,
			);
			const { request: swapRequest } = await publicClient.simulateContract({
				address: addresses.swapRouter,
				abi: SWAP_ROUTER_ABI,
				functionName: "exactInput",
				args: [
					{
						path,
						recipient: agentAddress,
						deadline,
						amountIn: amountInWei,
						amountOutMinimum: amountOutMin,
					},
				],
				account: walletClient.account,
			});
			swapTxHash = await walletClient.writeContract(swapRequest);
		}
		console.log(`[execute-agni-swap] Swap tx sent: ${swapTxHash}`);
		console.log(
			`[execute-agni-swap] Explorer: ${getExplorerUrl(swapTxHash, network)}`,
		);

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
				approve: approveTxHash
					? getExplorerUrl(approveTxHash, network)
					: undefined,
				swap: getExplorerUrl(swapTxHash, network),
			},
		};
	},
});

// ---------------------------------------------------------------------------
// Step-based swap tools (preferred over executeAgniSwap for better UX)
// Use these in sequence so the agent can report progress at each step:
//   1. agniSwapQuote  → get estimated output
//   2. agniSwapApprove → send approve tx and wait for confirmation
//   3. agniSwapExecute → send the swap tx
// ---------------------------------------------------------------------------

const ALL_FEE_TIERS = [100, 500, 2500, 10000] as const;

export const agniSwapQuote = createTool({
	id: "agni-swap-quote",
	description:
		"Step 1/3 of Agni Finance swap: Get a price quote from QuoterV2. " +
		"Returns estimated output amount and amountOutMinimum with slippage applied. " +
		"If feeTier is omitted, all fee tiers (100/500/2500/10000) are tried and the best rate is returned. " +
		"Call this first, then agni-swap-approve, then agni-swap-execute.",
	inputSchema: z.object({
		tokenIn: z.string().describe("Input token symbol (e.g. WMNT) or address"),
		tokenOut: z.string().describe("Output token symbol (e.g. USDT) or address"),
		amountIn: z
			.string()
			.describe("Input amount in human-readable units (e.g. '0.01')"),
		feeTier: z
			.number()
			.int()
			.optional()
			.describe(
				"Pool fee tier: 100, 500, 2500, or 10000. Omit to auto-detect the best available pool.",
			),
		slippageBps: z
			.number()
			.int()
			.min(1)
			.max(1000)
			.default(50)
			.describe("Slippage tolerance in bps (default: 50 = 0.5%)"),
		network: networkSchema.describe("Mantle network"),
	}),
	outputSchema: z.object({
		quotedAmountOut: z.string(),
		amountOutMinimum: z.string(),
		tokenIn: z.string(),
		tokenOut: z.string(),
		amountIn: z.string(),
		feeTier: z.number(),
		network: z.string(),
		isMultiHop: z.boolean().default(false),
		triedFeeTiers: z.array(z.number()).optional(),
	}),
	execute: async (input) => {
		const network = input.network ?? "testnet";
		const slippageBps = input.slippageBps ?? 50;
		const addresses = AGNI_ADDRESSES[network];

		const tokenInInfo = resolveToken(input.tokenIn, network);
		const tokenOutInfo = resolveToken(input.tokenOut, network);
		if (!tokenInInfo) throw new Error(`Unknown tokenIn: ${input.tokenIn}`);
		if (!tokenOutInfo) throw new Error(`Unknown tokenOut: ${input.tokenOut}`);

		const publicClient = getPublicClient(network);
		const amountInWei = parseUnits(input.amountIn, tokenInInfo.decimals);

		// Determine which fee tiers to try
		const feeTiersToTry: number[] = input.feeTier
			? [input.feeTier]
			: [...ALL_FEE_TIERS];
		console.log(
			`[agni-swap-quote] Step 1/3: Querying QuoterV2 for ${input.amountIn} ${input.tokenIn} → ${input.tokenOut} (feeTiers=${feeTiersToTry.join(",")}, network=${network})`,
		);

		// Try all fee tiers in parallel; pick the one with the highest output
		type QuoteSuccess = { feeTier: number; rawOut: bigint; isMultiHop: boolean };
		const results = await Promise.allSettled(
			feeTiersToTry.map(async (tier): Promise<QuoteSuccess> => {
				const result = await publicClient.simulateContract({
					address: addresses.quoterV2,
					abi: QUOTER_V2_ABI,
					functionName: "quoteExactInputSingle",
					args: [
						{
							tokenIn: tokenInInfo.address,
							tokenOut: tokenOutInfo.address,
							amountIn: amountInWei,
							fee: tier,
							sqrtPriceLimitX96: 0n,
						},
					],
				});
				return { feeTier: tier, rawOut: result.result[0], isMultiHop: false };
			}),
		);

		// Log each result
		for (const r of results) {
			if (r.status === "fulfilled") {
				console.log(
					`[agni-swap-quote] feeTier=${r.value.feeTier}: ${formatUnits(r.value.rawOut, tokenOutInfo.decimals)} ${input.tokenOut}`,
				);
			} else {
				const tierIdx = results.indexOf(r);
				console.log(
					`[agni-swap-quote] feeTier=${feeTiersToTry[tierIdx]}: no pool (${r.reason instanceof Error ? r.reason.message.slice(0, 60) : "error"})`,
				);
			}
		}

		// Pick the best fulfilled result
		let best: QuoteSuccess | null = null;
		for (const r of results) {
			if (
				r.status === "fulfilled" &&
				(best === null || r.value.rawOut > best.rawOut)
			) {
				best = r.value;
			}
		}

		// If no direct pool found, fall back to multi-hop via WMNT
		if (!best) {
			const wmntAddr = KNOWN_TOKENS[network].WMNT?.address;
			if (
				wmntAddr &&
				tokenInInfo.address.toLowerCase() !== wmntAddr.toLowerCase() &&
				tokenOutInfo.address.toLowerCase() !== wmntAddr.toLowerCase()
			) {
				console.log(
					`[agni-swap-quote] No direct pool — trying multi-hop via WMNT: ${input.tokenIn} → WMNT → ${input.tokenOut}`,
				);
				for (const tier of feeTiersToTry) {
					try {
						const path = encodeV3Path(
							[tokenInInfo.address, wmntAddr, tokenOutInfo.address],
							[tier, tier],
						);
						const result = await publicClient.simulateContract({
							address: addresses.quoterV2,
							abi: QUOTER_V2_ABI,
							functionName: "quoteExactInput",
							args: [path, amountInWei],
						});
						const rawOut = result.result[0];
						if (best === null || rawOut > best.rawOut) {
							best = { feeTier: tier, rawOut, isMultiHop: true };
						}
						console.log(
							`[agni-swap-quote] multi-hop feeTier=${tier}: ${formatUnits(rawOut, tokenOutInfo.decimals)} ${input.tokenOut}`,
						);
					} catch {
						console.log(`[agni-swap-quote] multi-hop feeTier=${tier}: no pool`);
					}
				}
			}
		}

		if (!best) {
			const tried = feeTiersToTry.join(", ");
			throw new Error(
				`No Agni pool found for ${input.tokenIn}/${input.tokenOut} on ${network} (tried direct and multi-hop via WMNT, feeTiers: ${tried}). Check token symbols/addresses and ensure the pool is deployed.`,
			);
		}

		const amountOutMin = (best.rawOut * BigInt(10000 - slippageBps)) / 10000n;
		const quotedAmountOut = formatUnits(best.rawOut, tokenOutInfo.decimals);
		console.log(
			`[agni-swap-quote] Best: feeTier=${best.feeTier}, isMultiHop=${best.isMultiHop}, output=${quotedAmountOut} ${input.tokenOut} (amountOutMinimum=${formatUnits(amountOutMin, tokenOutInfo.decimals)})`,
		);

		return {
			quotedAmountOut,
			amountOutMinimum: formatUnits(amountOutMin, tokenOutInfo.decimals),
			tokenIn: input.tokenIn,
			tokenOut: input.tokenOut,
			amountIn: input.amountIn,
			feeTier: best.feeTier,
			isMultiHop: best.isMultiHop,
			network,
			triedFeeTiers: feeTiersToTry,
		};
	},
});

export const agniSwapApprove = createTool({
	id: "agni-swap-approve",
	description:
		"Step 2/3 of Agni Finance swap: Approve tokenIn for the Agni SwapRouter and wait for confirmation. " +
		"Must be called after agni-swap-quote and before agni-swap-execute. " +
		"Waits up to 90s for the approval tx to be mined.",
	inputSchema: z.object({
		tokenIn: z.string().describe("Input token symbol (e.g. WMNT) or address"),
		amountIn: z
			.string()
			.describe(
				"Amount to approve in human-readable units (must match the swap amount)",
			),
		network: networkSchema.describe("Mantle network"),
	}),
	outputSchema: z.object({
		approved: z.boolean(),
		approveTxHash: z.string().optional(),
		explorerUrl: z.string().optional(),
		skippedReason: z.string().optional(),
		network: z.string(),
	}),
	execute: async (input) => {
		const network = input.network ?? "testnet";
		const addresses = AGNI_ADDRESSES[network];

		const tokenInInfo = resolveToken(input.tokenIn, network);
		if (!tokenInInfo) throw new Error(`Unknown tokenIn: ${input.tokenIn}`);

		const publicClient = getPublicClient(network);
		const walletClient = getAgentWalletClient(network);
		const amountInWei = parseUnits(input.amountIn, tokenInInfo.decimals);

		console.log(
			`[agni-swap-approve] Step 2/3: Approving ${input.amountIn} ${input.tokenIn} for SwapRouter (network=${network})`,
		);

		try {
			const { request: approveRequest } = await publicClient.simulateContract({
				address: tokenInInfo.address,
				abi: erc20Abi,
				functionName: "approve",
				args: [addresses.swapRouter, amountInWei],
				account: walletClient.account,
			});
			const approveTxHash = await walletClient.writeContract(approveRequest);
			console.log(
				`[agni-swap-approve] Approval tx sent: ${approveTxHash} — waiting for confirmation...`,
			);
			await publicClient.waitForTransactionReceipt({
				hash: approveTxHash as `0x${string}`,
				timeout: 90_000,
			});
			console.log(`[agni-swap-approve] Approval confirmed: ${approveTxHash}`);
			return {
				approved: true,
				approveTxHash,
				explorerUrl: getExplorerUrl(approveTxHash, network),
				network,
			};
		} catch (err) {
			if (
				err instanceof Error &&
				err.name === "ContractFunctionExecutionError"
			) {
				// Native token or already approved — safe to proceed
				console.log(
					`[agni-swap-approve] Skipped: native token or already approved`,
				);
				return {
					approved: true,
					skippedReason: "native token or already approved",
					network,
				};
			}
			throw err;
		}
	},
});

export const agniSwapExecute = createTool({
	id: "agni-swap-execute",
	description:
		"Step 3/3 of Agni Finance swap: Execute the swap on Agni Finance. " +
		"Must be called after agni-swap-approve. " +
		"Pass amountOutMinimum and isMultiHop from the quote step.",
	inputSchema: z.object({
		tokenIn: z.string().describe("Input token symbol (e.g. WMNT) or address"),
		tokenOut: z.string().describe("Output token symbol (e.g. USDT) or address"),
		amountIn: z.string().describe("Input amount in human-readable units"),
		amountOutMinimum: z
			.string()
			.describe(
				"Minimum output amount from quote step (or '0' to skip slippage check)",
			),
		feeTier: z
			.number()
			.int()
			.default(2500)
			.describe("Pool fee tier from quote step: 100, 500, 2500, or 10000 (default: 2500)"),
		isMultiHop: z
			.boolean()
			.optional()
			.describe(
				"Pass isMultiHop from the quote step. If true, routes through WMNT (exactInput). If omitted, auto-detects.",
			),
		network: networkSchema.describe("Mantle network"),
	}),
	outputSchema: z.object({
		swapTxHash: z.string(),
		explorerUrl: z.string(),
		txStatus: z.enum(["success", "reverted"]),
		blockNumber: z.string(),
		tokenIn: z.string(),
		tokenOut: z.string(),
		amountIn: z.string(),
		amountOutMinimum: z.string(),
		network: z.string(),
	}),
	execute: async (input) => {
		const network = input.network ?? "testnet";
		const feeTier = input.feeTier ?? 2500;
		const addresses = AGNI_ADDRESSES[network];

		const tokenInInfo = resolveToken(input.tokenIn, network);
		const tokenOutInfo = resolveToken(input.tokenOut, network);
		if (!tokenInInfo) throw new Error(`Unknown tokenIn: ${input.tokenIn}`);
		if (!tokenOutInfo) throw new Error(`Unknown tokenOut: ${input.tokenOut}`);

		const publicClient = getPublicClient(network);
		const walletClient = getAgentWalletClient(network);
		const agentAddress = getAgentAddress();

		const amountInWei = parseUnits(input.amountIn, tokenInInfo.decimals);
		const amountOutMin = parseUnits(
			input.amountOutMinimum,
			tokenOutInfo.decimals,
		);
		const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

		let swapTxHash: string;
		// isMultiHop from quote step takes priority; fall back to address-based heuristic
		const useDirect =
			input.isMultiHop === true
				? false
				: input.isMultiHop === false
					? true
					: isDirectPool(tokenInInfo.address, tokenOutInfo.address, network);

		if (network === "testnet") {
			// Skip simulation on testnet — pools may not exist and simulateContract would hang/revert.
			// Also provide explicit gas to bypass eth_estimateGas which would also fail without a live pool.
			if (useDirect) {
				console.log(
					`[agni-swap-execute] Step 3/3: Sending exactInputSingle directly (testnet) ${input.amountIn} ${input.tokenIn} → ${input.tokenOut} (amountOutMin=${input.amountOutMinimum}, feeTier=${feeTier})`,
				);
				swapTxHash = await walletClient.writeContract({
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
					chain: walletClient.chain,
					gas: 500_000n,
				});
			} else {
				// Multi-hop: route through WMNT
				const wmntAddr = KNOWN_TOKENS[network].WMNT!.address;
				const path = encodeV3Path(
					[tokenInInfo.address, wmntAddr, tokenOutInfo.address],
					[feeTier, feeTier],
				);
				console.log(
					`[agni-swap-execute] Step 3/3: Sending exactInput (multi-hop via WMNT, testnet) ${input.amountIn} ${input.tokenIn} → WMNT → ${input.tokenOut} (amountOutMin=${input.amountOutMinimum})`,
				);
				swapTxHash = await walletClient.writeContract({
					address: addresses.swapRouter,
					abi: SWAP_ROUTER_ABI,
					functionName: "exactInput",
					args: [
						{
							path,
							recipient: agentAddress,
							deadline,
							amountIn: amountInWei,
							amountOutMinimum: amountOutMin,
						},
					],
					account: walletClient.account,
					chain: walletClient.chain,
					gas: 500_000n,
				});
			}
		} else {
			if (useDirect) {
				console.log(
					`[agni-swap-execute] Step 3/3: Simulating exactInputSingle ${input.amountIn} ${input.tokenIn} → ${input.tokenOut} (amountOutMin=${input.amountOutMinimum}, feeTier=${feeTier}, network=${network})`,
				);
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
				swapTxHash = await walletClient.writeContract(swapRequest);
			} else {
				// Multi-hop: route through WMNT
				const wmntAddr = KNOWN_TOKENS[network].WMNT!.address;
				const path = encodeV3Path(
					[tokenInInfo.address, wmntAddr, tokenOutInfo.address],
					[feeTier, feeTier],
				);
				console.log(
					`[agni-swap-execute] Step 3/3: Simulating exactInput (multi-hop via WMNT) ${input.amountIn} ${input.tokenIn} → WMNT → ${input.tokenOut} (amountOutMin=${input.amountOutMinimum}, network=${network})`,
				);
				const { request: swapRequest } = await publicClient.simulateContract({
					address: addresses.swapRouter,
					abi: SWAP_ROUTER_ABI,
					functionName: "exactInput",
					args: [
						{
							path,
							recipient: agentAddress,
							deadline,
							amountIn: amountInWei,
							amountOutMinimum: amountOutMin,
						},
					],
					account: walletClient.account,
				});
				swapTxHash = await walletClient.writeContract(swapRequest);
			}
		}
		console.log(`[agni-swap-execute] Swap tx sent: ${swapTxHash}`);
		console.log(
			`[agni-swap-execute] Explorer: ${getExplorerUrl(swapTxHash, network)}`,
		);
		console.log(`[agni-swap-execute] Waiting for receipt...`);

		const receipt = await publicClient.waitForTransactionReceipt({
			hash: swapTxHash as `0x${string}`,
			timeout: 90_000,
		});

		if (receipt.status === "reverted") {
			console.error(
				`[agni-swap-execute] REVERTED: ${swapTxHash} (block ${receipt.blockNumber})`,
			);
			throw new Error(
				`Swap transaction reverted on-chain. TX: ${swapTxHash} | Explorer: ${getExplorerUrl(swapTxHash, network)}`,
			);
		}

		console.log(
			`[agni-swap-execute] Confirmed in block ${receipt.blockNumber}: ${swapTxHash}`,
		);

		return {
			swapTxHash,
			explorerUrl: getExplorerUrl(swapTxHash, network),
			txStatus: receipt.status,
			blockNumber: receipt.blockNumber.toString(),
			tokenIn: input.tokenIn,
			tokenOut: input.tokenOut,
			amountIn: input.amountIn,
			amountOutMinimum: input.amountOutMinimum,
			network,
		};
	},
});
