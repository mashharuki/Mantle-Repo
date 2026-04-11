import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { REGISTRY_CONTRACTS } from "./address-registry-tools";

function getRpcUrl(network: string): string {
	if (network === "sepolia") {
		return process.env.MANTLE_RPC_TESTNET ?? "https://rpc.sepolia.mantle.xyz";
	}
	return process.env.MANTLE_RPC_MAINNET ?? "https://rpc.mantle.xyz";
}

async function rpcCall(
	rpcUrl: string,
	method: string,
	params: unknown[],
): Promise<unknown> {
	const res = await fetch(rpcUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
	});
	const json = (await res.json()) as {
		result?: unknown;
		error?: { message: string };
	};
	if (json.error) throw new Error(json.error.message);
	return json.result;
}

// Known token info for quote resolution
const KNOWN_TOKENS: Record<
	string,
	{ address: string; decimals: number; symbol: string }
> = {
	MNT: {
		address: "0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8",
		decimals: 18,
		symbol: "MNT",
	},
	WMNT: {
		address: "0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8",
		decimals: 18,
		symbol: "WMNT",
	},
	USDT: {
		address: "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE",
		decimals: 6,
		symbol: "USDT",
	},
	USDC: {
		address: "0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9",
		decimals: 6,
		symbol: "USDC",
	},
	WETH: {
		address: "0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111",
		decimals: 18,
		symbol: "WETH",
	},
};

function resolveToken(
	symbolOrAddress: string,
): { address: string; decimals: number; symbol: string } | null {
	const upper = symbolOrAddress.toUpperCase();
	if (KNOWN_TOKENS[upper]) return KNOWN_TOKENS[upper];
	// Try as address
	if (/^0x[0-9a-fA-F]{40}$/.test(symbolOrAddress)) {
		const found = Object.values(KNOWN_TOKENS).find(
			(t) => t.address.toLowerCase() === symbolOrAddress.toLowerCase(),
		);
		return (
			found ?? { address: symbolOrAddress, decimals: 18, symbol: "UNKNOWN" }
		);
	}
	return null;
}

// ABI encode quoteExactInputSingle for Agni QuoterV2 (Uniswap v3 style)
// Function selector for quoteExactInputSingle((address,address,uint256,uint24,uint160)): 0xc6a5026a
function encodeAgniQuoteCall(
	tokenIn: string,
	tokenOut: string,
	amountIn: bigint,
	fee = 500, // 0.05% default
): string {
	const selector = "c6a5026a";
	const pad = (hex: string) => hex.padStart(64, "0");
	const addrIn = pad(tokenIn.toLowerCase().slice(2));
	const addrOut = pad(tokenOut.toLowerCase().slice(2));
	const amt = pad(amountIn.toString(16));
	const feeHex = pad(fee.toString(16));
	const sqrtLimit = pad("0");
	return `0x${selector}${addrIn}${addrOut}${amt}${feeHex}${sqrtLimit}`;
}

export const getDeFiVenues = createTool({
	id: "get-defi-venues",
	description:
		"List verified DeFi protocols available on Mantle Network. Returns Tier 1 venues for swap, liquidity, and lending operations with their registry addresses. Data from registry snapshot 2026-03-08.",
	inputSchema: z.object({
		category: z
			.enum(["swap", "liquidity", "lending", "all"])
			.default("all")
			.describe("Filter by DeFi operation type"),
	}),
	outputSchema: z.object({
		venues: z.array(
			z.object({
				protocol: z.string(),
				tier: z.number(),
				supportedOps: z.array(z.string()),
				routerAddress: z.string().optional(),
				quoterAddress: z.string().optional(),
				positionManagerAddress: z.string().optional(),
				poolAddress: z.string().optional(),
				sourceUrl: z.string(),
				notes: z.string().optional(),
			}),
		),
		snapshotDate: z.string(),
		totalVenues: z.number(),
	}),
	execute: async (inputData) => {
		const category = inputData.category ?? "all";

		const protocolMap: Record<
			string,
			{
				tier: number;
				supportedOps: string[];
				sourceUrl: string;
				notes: string;
			}
		> = {
			merchant_moe: {
				tier: 1,
				supportedOps: ["swap", "add_liquidity", "remove_liquidity"],
				sourceUrl: "https://docs.merchantmoe.com/resources/contracts",
				notes:
					"Tier 1 DEX — classic AMM + Liquidity Book routing. Preferred for swaps.",
			},
			agni: {
				tier: 1,
				supportedOps: [
					"swap",
					"add_liquidity",
					"remove_liquidity",
					"position_management",
				],
				sourceUrl: "https://agni.finance",
				notes:
					"Tier 1 DEX — concentrated liquidity (v3-style). Preferred for LP positions.",
			},
			aave_v3: {
				tier: 1,
				supportedOps: ["supply", "withdraw", "borrow", "repay"],
				sourceUrl:
					"https://github.com/bgd-labs/aave-address-book/blob/main/src/AaveV3Mantle.sol",
				notes: "Tier 1 lending protocol on Mantle.",
			},
		};

		const opsFilter: Record<string, string[]> = {
			swap: ["swap"],
			liquidity: ["add_liquidity", "remove_liquidity", "position_management"],
			lending: ["supply", "withdraw", "borrow", "repay"],
			all: [],
		};

		const venues = Object.entries(protocolMap)
			.filter(([, info]) => {
				if (category === "all") return true;
				return info.supportedOps.some((op) =>
					opsFilter[category]?.includes(op),
				);
			})
			.map(([protocolId, info]) => {
				const contracts = REGISTRY_CONTRACTS.filter(
					(c) => c.protocol_id === protocolId,
				);
				const router = contracts.find((c) => c.contract_role === "router");
				const quoter = contracts.find((c) => c.contract_role === "quoter");
				const posManager = contracts.find(
					(c) => c.contract_role === "position_manager",
				);
				const pool = contracts.find((c) => c.contract_role === "pool");

				return {
					protocol: protocolId,
					tier: info.tier,
					supportedOps: info.supportedOps,
					routerAddress: router?.address,
					quoterAddress: quoter?.address,
					positionManagerAddress: posManager?.address,
					poolAddress: pool?.address,
					sourceUrl: info.sourceUrl,
					notes: info.notes,
				};
			});

		return {
			venues,
			snapshotDate: "2026-03-08",
			totalVenues: venues.length,
		};
	},
});

export const getSwapQuote = createTool({
	id: "get-swap-quote",
	description:
		"Get a swap quote for a token pair on Mantle. Attempts live quote from Agni QuoterV2 via eth_call, with fallback information. Resolves token symbols to addresses automatically.",
	inputSchema: z.object({
		tokenIn: z
			.string()
			.describe("Input token symbol (e.g. WMNT, USDT) or address"),
		tokenOut: z
			.string()
			.describe("Output token symbol (e.g. USDC, WETH) or address"),
		amountIn: z
			.string()
			.describe("Amount in human-readable units (e.g. '1.5' for 1.5 WMNT)"),
		network: z
			.enum(["mainnet", "sepolia"])
			.default("mainnet")
			.describe("Mantle network"),
		protocol: z
			.enum(["agni", "merchant_moe", "auto"])
			.default("auto")
			.describe("Preferred protocol for quoting"),
	}),
	outputSchema: z.object({
		tokenIn: z.object({
			symbol: z.string(),
			address: z.string(),
			decimals: z.number(),
			amountIn: z.string(),
		}),
		tokenOut: z.object({
			symbol: z.string(),
			address: z.string(),
			decimals: z.number(),
			amountOutEstimate: z.string().optional(),
		}),
		protocol: z.string(),
		quoterAddress: z.string(),
		quoteStatus: z.enum(["success", "partial", "unavailable"]),
		note: z.string(),
		snapshotDate: z.string(),
	}),
	execute: async (inputData) => {
		const tokenInId = inputData.tokenIn;
		const tokenOutId = inputData.tokenOut;
		const amountInStr = inputData.amountIn;
		const network = inputData.network ?? "mainnet";
		const protocol = inputData.protocol ?? "auto";

		const tokenInInfo = resolveToken(tokenInId);
		const tokenOutInfo = resolveToken(tokenOutId);

		const agniQuoter = REGISTRY_CONTRACTS.find((c) => c.key === "AGNI_QUOTER");
		const quoterAddress =
			agniQuoter?.address ?? "0xc4aaDc921E1cdb66c5300Bc158a313292923C0cb";
		const usedProtocol = protocol === "merchant_moe" ? "merchant_moe" : "agni";

		if (!tokenInInfo) {
			return {
				tokenIn: {
					symbol: tokenInId,
					address: "unknown",
					decimals: 18,
					amountIn: amountInStr,
				},
				tokenOut: {
					symbol: tokenOutId,
					address: tokenOutInfo?.address ?? "unknown",
					decimals: tokenOutInfo?.decimals ?? 18,
				},
				protocol: usedProtocol,
				quoterAddress,
				quoteStatus: "unavailable" as const,
				note: `Token "${tokenInId}" not found in registry. Provide a known symbol (WMNT, USDT, USDC, WETH) or full address.`,
				snapshotDate: "2026-03-08",
			};
		}
		if (!tokenOutInfo) {
			return {
				tokenIn: {
					symbol: tokenInInfo.symbol,
					address: tokenInInfo.address,
					decimals: tokenInInfo.decimals,
					amountIn: amountInStr,
				},
				tokenOut: { symbol: tokenOutId, address: "unknown", decimals: 18 },
				protocol: usedProtocol,
				quoterAddress,
				quoteStatus: "unavailable" as const,
				note: `Token "${tokenOutId}" not found in registry. Provide a known symbol (WMNT, USDT, USDC, WETH) or full address.`,
				snapshotDate: "2026-03-08",
			};
		}

		// Parse amount
		const amountInParsed = (() => {
			try {
				const [whole, frac = ""] = amountInStr.split(".");
				const fracPadded = frac
					.padEnd(tokenInInfo.decimals, "0")
					.slice(0, tokenInInfo.decimals);
				return (
					BigInt(whole) * BigInt(10) ** BigInt(tokenInInfo.decimals) +
					BigInt(fracPadded || "0")
				);
			} catch {
				return BigInt(0);
			}
		})();

		if (network !== "mainnet") {
			return {
				tokenIn: {
					symbol: tokenInInfo.symbol,
					address: tokenInInfo.address,
					decimals: tokenInInfo.decimals,
					amountIn: amountInStr,
				},
				tokenOut: {
					symbol: tokenOutInfo.symbol,
					address: tokenOutInfo.address,
					decimals: tokenOutInfo.decimals,
				},
				protocol: usedProtocol,
				quoterAddress,
				quoteStatus: "unavailable" as const,
				note: "Live quotes are only available on mainnet. On Sepolia, use the official Agni or Merchant Moe testnet frontends.",
				snapshotDate: "2026-03-08",
			};
		}

		// Attempt live quote from Agni QuoterV2
		try {
			const rpcUrl = getRpcUrl(network);
			const calldata = encodeAgniQuoteCall(
				tokenInInfo.address,
				tokenOutInfo.address,
				amountInParsed,
			);
			const result = (await rpcCall(rpcUrl, "eth_call", [
				{ to: quoterAddress, data: calldata },
				"latest",
			])) as string;

			// The first 32 bytes = amountOut (uint256)
			const amountOutHex = result.slice(0, 66);
			const amountOut = BigInt(amountOutHex);

			const formatUnits = (raw: bigint, dec: number) => {
				const d = BigInt(10) ** BigInt(dec);
				const w = raw / d;
				const f = (raw % d).toString().padStart(dec, "0").replace(/0+$/, "");
				return f.length > 0 ? `${w}.${f}` : `${w}`;
			};

			return {
				tokenIn: {
					symbol: tokenInInfo.symbol,
					address: tokenInInfo.address,
					decimals: tokenInInfo.decimals,
					amountIn: amountInStr,
				},
				tokenOut: {
					symbol: tokenOutInfo.symbol,
					address: tokenOutInfo.address,
					decimals: tokenOutInfo.decimals,
					amountOutEstimate: formatUnits(amountOut, tokenOutInfo.decimals),
				},
				protocol: "agni",
				quoterAddress,
				quoteStatus: "success" as const,
				note: "Live quote from Agni QuoterV2 (fee tier 0.05%). Actual execution price may differ due to price impact and slippage.",
				snapshotDate: "2026-03-08",
			};
		} catch (e) {
			return {
				tokenIn: {
					symbol: tokenInInfo.symbol,
					address: tokenInInfo.address,
					decimals: tokenInInfo.decimals,
					amountIn: amountInStr,
				},
				tokenOut: {
					symbol: tokenOutInfo.symbol,
					address: tokenOutInfo.address,
					decimals: tokenOutInfo.decimals,
				},
				protocol: usedProtocol,
				quoterAddress,
				quoteStatus: "partial" as const,
				note: `Live quote unavailable: ${e instanceof Error ? e.message : String(e)}. Use the Agni or Merchant Moe frontend to get an accurate quote. Quoter address: ${quoterAddress}`,
				snapshotDate: "2026-03-08",
			};
		}
	},
});

export const getLiquidityPools = createTool({
	id: "get-liquidity-pools",
	description:
		"List verified liquidity pool and position manager contracts for Mantle DeFi protocols. Returns addresses from the registry snapshot (2026-03-08). No live RPC call.",
	inputSchema: z.object({
		protocol: z
			.enum(["merchant_moe", "agni", "aave_v3", "all"])
			.default("all")
			.describe("Protocol to filter by"),
		network: z
			.enum(["mainnet", "testnet"])
			.default("mainnet")
			.describe("Network environment"),
	}),
	outputSchema: z.object({
		protocol: z.string(),
		pools: z.array(
			z.object({
				label: z.string(),
				address: z.string(),
				role: z.string(),
				supports: z.array(z.string()),
				sourceUrl: z.string(),
			}),
		),
		snapshotDate: z.string(),
	}),
	execute: async (inputData) => {
		const protocol = inputData.protocol ?? "all";
		const network = inputData.network ?? "mainnet";
		const env = network === "mainnet" ? "mainnet" : "testnet";

		const filtered = REGISTRY_CONTRACTS.filter((c) => {
			const matchEnv = c.environment === env;
			const matchProto = protocol === "all" || c.protocol_id === protocol;
			const isPoolRole = [
				"router",
				"pool",
				"position_manager",
				"quoter",
				"pool_addresses_provider",
			].includes(c.contract_role);
			return matchEnv && matchProto && isPoolRole;
		});

		return {
			protocol,
			pools: filtered.map((c) => ({
				label: c.label,
				address: c.address,
				role: c.contract_role,
				supports: c.supports,
				sourceUrl: c.source.url,
			})),
			snapshotDate: "2026-03-08",
		};
	},
});
