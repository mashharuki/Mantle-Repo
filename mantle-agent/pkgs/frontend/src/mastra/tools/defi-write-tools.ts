import {
	CHAIN_IDS,
	getPublicClient,
	type Network,
	type PendingSignatureOutput,
} from "@/lib/viem-clients";
import { createTool } from "@mastra/core/tools";
import { encodeFunctionData, erc20Abi, formatUnits, parseUnits } from "viem";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared: pending-signature output schema (unsigned tx for client-side signing)
// ---------------------------------------------------------------------------
const unsignedTxSchema = z.object({
	to: z.string(),
	data: z.string(),
	value: z.string(),
	gas: z.string().optional(),
	chainId: z.number(),
});

const pendingSignatureOutputSchema = z.object({
	type: z.literal("pending_signature"),
	description: z.string(),
	unsignedTx: unsignedTxSchema,
	simulationPassed: z.boolean(),
	estimatedFee: z.string(),
});

/** Estimate gas with a 20 % safety buffer. Falls back to undefined on error. */
async function estimateGasWithBuffer(
	network: Network,
	params: {
		account: `0x${string}`;
		to: `0x${string}`;
		data: `0x${string}`;
		value: bigint;
	},
): Promise<bigint | undefined> {
	try {
		const publicClient = getPublicClient(network);
		const estimated = await publicClient.estimateGas(params);
		return (estimated * 12n) / 10n;
	} catch {
		return undefined;
	}
}

/** Get a rough fee estimate string (MNT). */
async function getEstimatedFee(
	network: Network,
	gas: bigint | undefined,
): Promise<string> {
	if (!gas) return "unknown (wallet will estimate)";
	try {
		const publicClient = getPublicClient(network);
		const gasPrice = await publicClient.getGasPrice();
		return `~${formatUnits(gas * gasPrice, 18)} MNT`;
	} catch {
		return "unknown";
	}
}

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

// Agni SwapRouter ABI — SwapRouter02 (V2) format: NO deadline in struct
// Selector: exactInput    = 0xb858183f
// Selector: exactInputSingle = 0x04e45aaf
const SWAP_ROUTER_ABI = [
	{
		inputs: [
			{
				components: [
					{ name: "tokenIn", type: "address" },
					{ name: "tokenOut", type: "address" },
					{ name: "fee", type: "uint24" },
					{ name: "recipient", type: "address" },
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

/** Fallback gas limit used when estimation is skipped (testnet or no fromAddress). */
const DEFAULT_GAS_TRANSFER = 21_000n;
const DEFAULT_GAS_APPROVE = 100_000n;
const DEFAULT_GAS_SWAP = 500_000n;

export const sendNativeToken = createTool({
	id: "send-native-token",
	description:
		"Build an unsigned MNT native-token transfer transaction for the user to sign with their client wallet (MetaMask). " +
		"Returns a pending_signature object; do NOT attempt to sign or broadcast server-side.",
	inputSchema: z.object({
		to: z.string().describe("Recipient address (0x...)"),
		amount: z.string().describe("Amount in MNT (human-readable, e.g. '0.001')"),
		fromAddress: z
			.string()
			.optional()
			.describe("Sender address — the connected client wallet (0x...)"),
		network: networkSchema.describe("Mantle network"),
	}),
	outputSchema: pendingSignatureOutputSchema,
	execute: async (input): Promise<PendingSignatureOutput> => {
		const network = input.network ?? "testnet";
		const chainId = CHAIN_IDS[network];
		const value = parseUnits(input.amount, 18);

		let gasEstimate: bigint | undefined;
		if (input.fromAddress) {
			gasEstimate = await estimateGasWithBuffer(network, {
				account: input.fromAddress as `0x${string}`,
				to: input.to as `0x${string}`,
				data: "0x",
				value,
			});
		}
		gasEstimate = gasEstimate ?? DEFAULT_GAS_TRANSFER;

		return {
			type: "pending_signature",
			description: `Send ${input.amount} MNT to ${input.to}`,
			unsignedTx: {
				to: input.to,
				data: "0x",
				value: value.toString(),
				gas: gasEstimate.toString(),
				chainId,
			},
			simulationPassed: !!input.fromAddress,
			estimatedFee: await getEstimatedFee(network, gasEstimate),
		};
	},
});

export const approveERC20Token = createTool({
	id: "approve-erc20-token",
	description:
		"Build an unsigned ERC-20 approval transaction for the user to sign with their client wallet (MetaMask). " +
		"Returns a pending_signature object; do NOT attempt to sign or broadcast server-side.",
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
		fromAddress: z
			.string()
			.optional()
			.describe("Token holder address — the connected client wallet (0x...)"),
		network: networkSchema.describe("Mantle network"),
	}),
	outputSchema: pendingSignatureOutputSchema,
	execute: async (input): Promise<PendingSignatureOutput> => {
		const network = input.network ?? "testnet";
		const chainId = CHAIN_IDS[network];
		const decimals = input.decimals ?? 18;
		const amountWei = parseUnits(input.amount, decimals);
		const tokenAddress = input.tokenAddress as `0x${string}`;

		const calldata = encodeFunctionData({
			abi: erc20Abi,
			functionName: "approve",
			args: [input.spender as `0x${string}`, amountWei],
		});

		let gasEstimate: bigint | undefined;
		if (input.fromAddress) {
			gasEstimate = await estimateGasWithBuffer(network, {
				account: input.fromAddress as `0x${string}`,
				to: tokenAddress,
				data: calldata,
				value: 0n,
			});
		}
		gasEstimate = gasEstimate ?? DEFAULT_GAS_APPROVE;

		return {
			type: "pending_signature",
			description: `Approve ${input.amount} tokens (${input.tokenAddress.slice(0, 8)}…) for spender ${input.spender.slice(0, 8)}…`,
			unsignedTx: {
				to: input.tokenAddress,
				data: calldata,
				value: "0",
				gas: gasEstimate.toString(),
				chainId,
			},
			simulationPassed: !!input.fromAddress,
			estimatedFee: await getEstimatedFee(network, gasEstimate),
		};
	},
});

/**
 * @deprecated Use the 3-step flow (agniSwapQuote → agniSwapApprove → agniSwapExecute) instead.
 * This single-step tool no longer executes on-chain; it now returns an unsigned transaction
 * for the quote step only. Kept for backward compatibility.
 */
export const executeAgniSwap = createTool({
	id: "execute-agni-swap",
	description:
		"⚠️ DEPRECATED: Use agniSwapQuote → agniSwapApprove → agniSwapExecute instead. " +
		"This tool only returns a quote and is no longer able to execute swaps directly. " +
		"Redirect the user to the 3-step flow.",
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
	execute: async (_input) => {
		throw new Error(
			"[execute-agni-swap] Deprecated. Use the 3-step flow: agniSwapQuote → agniSwapApprove → agniSwapExecute.",
		);
	},
});

// ---------------------------------------------------------------------------
// Step-based swap tools (preferred over executeAgniSwap for better UX)
// Use these in sequence so the agent can report progress at each step:
//   1. agniSwapQuote  → get estimated output
//   2. agniSwapApprove → build unsigned approval tx for client signing
//   3. agniSwapExecute → build unsigned swap tx for client signing
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
		type QuoteSuccess = {
			feeTier: number;
			rawOut: bigint;
			isMultiHop: boolean;
		};
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

		// Fallback 1: try quoteExactInput with DIRECT 2-token path
		// Agni testnet QuoterV2 handles exactInput correctly but exactInputSingle may fail
		if (!best) {
			console.log(
				`[agni-swap-quote] quoteExactInputSingle failed — trying quoteExactInput with direct 2-token path`,
			);
			for (const tier of feeTiersToTry) {
				try {
					const directPath = encodeV3Path(
						[tokenInInfo.address, tokenOutInfo.address],
						[tier],
					);
					const result = await publicClient.simulateContract({
						address: addresses.quoterV2,
						abi: QUOTER_V2_ABI,
						functionName: "quoteExactInput",
						args: [directPath, amountInWei],
					});
					const rawOut = result.result[0];
					if (best === null || rawOut > best.rawOut) {
						best = { feeTier: tier, rawOut, isMultiHop: false };
					}
					console.log(
						`[agni-swap-quote] exactInput direct feeTier=${tier}: ${formatUnits(rawOut, tokenOutInfo.decimals)} ${input.tokenOut}`,
					);
				} catch {
					console.log(
						`[agni-swap-quote] exactInput direct feeTier=${tier}: no pool`,
					);
				}
			}
		}

		// Fallback 2: try quoteExactInput with 3-token path via WMNT (non-WMNT pairs only)
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
		"Step 2/3 of Agni Finance swap: Build an unsigned ERC-20 approval transaction for the Agni SwapRouter. " +
		"Returns a pending_signature object for the user to sign with their client wallet (MetaMask). " +
		"Call after agni-swap-quote. After the user signs and broadcasts, proceed to agni-swap-execute.",
	inputSchema: z.object({
		tokenIn: z.string().describe("Input token symbol (e.g. WMNT) or address"),
		amountIn: z
			.string()
			.describe(
				"Amount to approve in human-readable units (must match the swap amount)",
			),
		fromAddress: z
			.string()
			.optional()
			.describe("Token holder address — the connected client wallet (0x...)"),
		network: networkSchema.describe("Mantle network"),
	}),
	outputSchema: pendingSignatureOutputSchema,
	execute: async (input): Promise<PendingSignatureOutput> => {
		const network = input.network ?? "testnet";
		const chainId = CHAIN_IDS[network];
		const addresses = AGNI_ADDRESSES[network];

		const tokenInInfo = resolveToken(input.tokenIn, network);
		if (!tokenInInfo) throw new Error(`Unknown tokenIn: ${input.tokenIn}`);

		const amountInWei = parseUnits(input.amountIn, tokenInInfo.decimals);

		const calldata = encodeFunctionData({
			abi: erc20Abi,
			functionName: "approve",
			args: [addresses.swapRouter, amountInWei],
		});

		let gasEstimate: bigint | undefined;
		if (input.fromAddress) {
			gasEstimate = await estimateGasWithBuffer(network, {
				account: input.fromAddress as `0x${string}`,
				to: tokenInInfo.address,
				data: calldata,
				value: 0n,
			});
		}
		gasEstimate = gasEstimate ?? DEFAULT_GAS_APPROVE;

		console.log(
			`[agni-swap-approve] Step 2/3: Built unsigned approval for ${input.amountIn} ${input.tokenIn} → SwapRouter (network=${network})`,
		);

		return {
			type: "pending_signature",
			description: `Approve ${input.amountIn} ${input.tokenIn} for Agni SwapRouter`,
			unsignedTx: {
				to: tokenInInfo.address,
				data: calldata,
				value: "0",
				gas: gasEstimate.toString(),
				chainId,
			},
			simulationPassed: !!input.fromAddress,
			estimatedFee: await getEstimatedFee(network, gasEstimate),
		};
	},
});

export const agniSwapExecute = createTool({
	id: "agni-swap-execute",
	description:
		"Step 3/3 of Agni Finance swap: Build an unsigned swap transaction on Agni Finance. " +
		"Returns a pending_signature object for the user to sign with their client wallet (MetaMask). " +
		"Must be called after agni-swap-approve. fromAddress is required (swap tokens are sent to this address).",
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
			.describe(
				"Pool fee tier from quote step: 100, 500, 2500, or 10000 (default: 2500)",
			),
		isMultiHop: z
			.boolean()
			.optional()
			.describe(
				"Pass isMultiHop from the quote step. If true, routes through WMNT (exactInput). If omitted, auto-detects.",
			),
		fromAddress: z
			.string()
			.describe(
				"Connected client wallet address — used as swap recipient (0x...). REQUIRED.",
			),
		network: networkSchema.describe("Mantle network"),
	}),
	outputSchema: pendingSignatureOutputSchema,
	execute: async (input): Promise<PendingSignatureOutput> => {
		const network = input.network ?? "testnet";
		const chainId = CHAIN_IDS[network];
		const feeTier = input.feeTier ?? 2500;
		const addresses = AGNI_ADDRESSES[network];

		const tokenInInfo = resolveToken(input.tokenIn, network);
		const tokenOutInfo = resolveToken(input.tokenOut, network);
		if (!tokenInInfo) throw new Error(`Unknown tokenIn: ${input.tokenIn}`);
		if (!tokenOutInfo) throw new Error(`Unknown tokenOut: ${input.tokenOut}`);

		const recipient = input.fromAddress as `0x${string}`;
		const amountInWei = parseUnits(input.amountIn, tokenInInfo.decimals);
		const amountOutMin = parseUnits(
			input.amountOutMinimum,
			tokenOutInfo.decimals,
		);

		const useDirect =
			input.isMultiHop === true
				? false
				: input.isMultiHop === false
					? true
					: isDirectPool(tokenInInfo.address, tokenOutInfo.address, network);

		let calldata: `0x${string}`;
		if (useDirect) {
			const directPath = encodeV3Path(
				[tokenInInfo.address, tokenOutInfo.address],
				[feeTier],
			);
			calldata = encodeFunctionData({
				abi: SWAP_ROUTER_ABI,
				functionName: "exactInput",
				args: [
					{
						path: directPath,
						recipient,
						amountIn: amountInWei,
						amountOutMinimum: amountOutMin,
					},
				],
			});
		} else {
			const wmntAddr = KNOWN_TOKENS[network].WMNT!.address;
			const path = encodeV3Path(
				[tokenInInfo.address, wmntAddr, tokenOutInfo.address],
				[feeTier, feeTier],
			);
			calldata = encodeFunctionData({
				abi: SWAP_ROUTER_ABI,
				functionName: "exactInput",
				args: [
					{
						path,
						recipient,
						amountIn: amountInWei,
						amountOutMinimum: amountOutMin,
					},
				],
			});
		}

		let gasEstimate: bigint = DEFAULT_GAS_SWAP;
		if (network === "mainnet") {
			const est = await estimateGasWithBuffer(network, {
				account: recipient,
				to: addresses.swapRouter,
				data: calldata,
				value: 0n,
			});
			if (est) gasEstimate = est;
		}

		console.log(
			`[agni-swap-execute] Step 3/3: Built unsigned exactInput tx (${useDirect ? "direct" : "multi-hop"}) ` +
				`${input.amountIn} ${input.tokenIn} → ${input.tokenOut}, recipient=${recipient}, network=${network}`,
		);

		return {
			type: "pending_signature",
			description: `Swap ${input.amountIn} ${input.tokenIn} → ${input.tokenOut} on Agni Finance`,
			unsignedTx: {
				to: addresses.swapRouter,
				data: calldata,
				value: "0",
				gas: gasEstimate.toString(),
				chainId,
			},
			simulationPassed: false,
			estimatedFee: await getEstimatedFee(network, gasEstimate),
		};
	},
});
