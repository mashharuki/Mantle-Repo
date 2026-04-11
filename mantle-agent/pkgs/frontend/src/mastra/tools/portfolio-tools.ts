import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// Known tokens on Mantle mainnet (from official docs / token list)
const KNOWN_TOKENS_MAINNET = [
	{
		symbol: "WMNT",
		address: "0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8",
		decimals: 18,
	},
	{
		symbol: "USDT",
		address: "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE",
		decimals: 6,
	},
	{
		symbol: "USDC",
		address: "0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9",
		decimals: 6,
	},
	{
		symbol: "WETH",
		address: "0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111",
		decimals: 18,
	},
];

const KNOWN_TOKENS_TESTNET = [
	{
		symbol: "WMNT",
		address: "0x19f5557E23e9914A18239990f6C70D68FDF0deD5",
		decimals: 18,
	},
];

// Known DEX router addresses for allowance checks
const KNOWN_SPENDERS_MAINNET = [
	{
		address: "0xeaEE7EE68874218c3558b40063c42B82D3E7232a",
		label: "Merchant Moe Router",
	},
	{
		address: "0x013e138EF6008ae5FDFDE29700e3f2Bc61d21E3a",
		label: "Merchant Moe LB Router",
	},
	{
		address: "0x319B69888b0d11cEC22caA5034e25FfFBDc88421",
		label: "Agni Swap Router",
	},
	{
		address: "0x218bf598D1453383e2F4AA7b14fFB9BfB102D637",
		label: "Agni Position Manager",
	},
	{
		address: "0x458F293454fE0d67EC0655f3672301301DD51422",
		label: "Aave v3 Pool",
	},
];

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

function formatUnits(raw: bigint, decimals: number): string {
	const divisor = BigInt(10) ** BigInt(decimals);
	const whole = raw / divisor;
	const frac = raw % divisor;
	const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
	return fracStr.length > 0 ? `${whole}.${fracStr}` : `${whole}`;
}

function encodeBalanceOfCall(address: string): string {
	// balanceOf(address) selector = 0x70a08231
	const padded = address.toLowerCase().replace("0x", "").padStart(64, "0");
	return `0x70a08231${padded}`;
}

function encodeAllowanceCall(owner: string, spender: string): string {
	// allowance(address owner, address spender) selector = 0xdd62ed3e
	const paddedOwner = owner.toLowerCase().replace("0x", "").padStart(64, "0");
	const paddedSpender = spender
		.toLowerCase()
		.replace("0x", "")
		.padStart(64, "0");
	return `0xdd62ed3e${paddedOwner}${paddedSpender}`;
}

function classifyAllowanceRisk(
	raw: bigint,
	_symbol: string,
): "none" | "normal" | "broad" | "unlimited" {
	if (raw === 0n) return "none";
	// 2^255 threshold for unlimited
	if (raw >= 2n ** 255n) return "unlimited";
	// > 10^9 tokens (10 billion) considered broad
	if (raw >= 10n ** 9n * 10n ** 18n) return "broad";
	return "normal";
}

export const getWalletBalance = createTool({
	id: "get-wallet-balance",
	description:
		"Fetch the native MNT balance and major ERC-20 token balances for a wallet address on Mantle. Queries the Mantle RPC directly. Read-only.",
	inputSchema: z.object({
		address: z.string().describe("EVM wallet address (0x...)"),
		network: z
			.enum(["mainnet", "sepolia"])
			.default("mainnet")
			.describe("Mantle network to query"),
	}),
	outputSchema: z.object({
		address: z.string(),
		network: z.string(),
		mntBalance: z.object({
			raw: z.string(),
			normalized: z.string(),
			symbol: z.string(),
		}),
		tokens: z.array(
			z.object({
				symbol: z.string(),
				address: z.string(),
				raw: z.string(),
				normalized: z.string(),
				decimals: z.number(),
				error: z.string().optional(),
			}),
		),
		collectedAt: z.string(),
		rpcUrl: z.string(),
		errors: z.array(z.string()),
	}),
	execute: async (inputData) => {
		const address = inputData.address;
		const network = inputData.network ?? "mainnet";
		const rpcUrl = getRpcUrl(network);
		const tokens =
			network === "mainnet" ? KNOWN_TOKENS_MAINNET : KNOWN_TOKENS_TESTNET;
		const errors: string[] = [];
		const collectedAt = new Date().toISOString();

		// Fetch native MNT balance
		let mntRaw = 0n;
		try {
			const hexBal = (await rpcCall(rpcUrl, "eth_getBalance", [
				address,
				"latest",
			])) as string;
			mntRaw = BigInt(hexBal);
		} catch (e) {
			errors.push(
				`Failed to fetch MNT balance: ${e instanceof Error ? e.message : String(e)}`,
			);
		}

		// Fetch ERC-20 balances
		const tokenResults: Array<{
			symbol: string;
			address: string;
			raw: string;
			normalized: string;
			decimals: number;
			error?: string;
		}> = [];

		for (const token of tokens) {
			try {
				const data = encodeBalanceOfCall(address);
				const hex = (await rpcCall(rpcUrl, "eth_call", [
					{ to: token.address, data },
					"latest",
				])) as string;
				const raw = BigInt(hex === "0x" ? "0x0" : hex);
				tokenResults.push({
					symbol: token.symbol,
					address: token.address,
					raw: raw.toString(),
					normalized: formatUnits(raw, token.decimals),
					decimals: token.decimals,
				});
			} catch (e) {
				tokenResults.push({
					symbol: token.symbol,
					address: token.address,
					raw: "0",
					normalized: "0",
					decimals: token.decimals,
					error: e instanceof Error ? e.message : String(e),
				});
			}
		}

		return {
			address,
			network,
			mntBalance: {
				raw: mntRaw.toString(),
				normalized: formatUnits(mntRaw, 18),
				symbol: "MNT",
			},
			tokens: tokenResults,
			collectedAt,
			rpcUrl,
			errors,
		};
	},
});

export const getTokenAllowances = createTool({
	id: "get-token-allowances",
	description:
		"Fetch ERC-20 token allowances for a wallet address across major Mantle DeFi spenders (routers, pools). Returns risk classification (none/normal/broad/unlimited) for each allowance. Read-only.",
	inputSchema: z.object({
		address: z
			.string()
			.describe("Wallet address (owner) to check allowances for"),
		network: z
			.enum(["mainnet", "sepolia"])
			.default("mainnet")
			.describe("Mantle network to query"),
	}),
	outputSchema: z.object({
		owner: z.string(),
		network: z.string(),
		allowances: z.array(
			z.object({
				token: z.string(),
				tokenSymbol: z.string(),
				spender: z.string(),
				spenderLabel: z.string(),
				rawAllowance: z.string(),
				normalizedAllowance: z.string(),
				riskLevel: z.enum(["none", "normal", "broad", "unlimited"]),
			}),
		),
		collectedAt: z.string(),
		nonZeroCount: z.number(),
		highRiskCount: z.number(),
	}),
	execute: async (inputData) => {
		const address = inputData.address;
		const network = inputData.network ?? "mainnet";
		const rpcUrl = getRpcUrl(network);
		const tokens =
			network === "mainnet" ? KNOWN_TOKENS_MAINNET : KNOWN_TOKENS_TESTNET;
		const spenders = KNOWN_SPENDERS_MAINNET;
		const collectedAt = new Date().toISOString();

		const allowances: Array<{
			token: string;
			tokenSymbol: string;
			spender: string;
			spenderLabel: string;
			rawAllowance: string;
			normalizedAllowance: string;
			riskLevel: "none" | "normal" | "broad" | "unlimited";
		}> = [];

		for (const token of tokens) {
			for (const spender of spenders) {
				try {
					const data = encodeAllowanceCall(address, spender.address);
					const hex = (await rpcCall(rpcUrl, "eth_call", [
						{ to: token.address, data },
						"latest",
					])) as string;
					const raw = BigInt(hex === "0x" ? "0x0" : hex);
					if (raw === 0n) continue; // skip zero allowances for brevity
					allowances.push({
						token: token.address,
						tokenSymbol: token.symbol,
						spender: spender.address,
						spenderLabel: spender.label,
						rawAllowance: raw.toString(),
						normalizedAllowance: formatUnits(raw, token.decimals),
						riskLevel: classifyAllowanceRisk(raw, token.symbol),
					});
				} catch {
					// Skip on RPC error for this pair
				}
			}
		}

		const nonZeroCount = allowances.length;
		const highRiskCount = allowances.filter(
			(a) => a.riskLevel === "unlimited" || a.riskLevel === "broad",
		).length;

		return {
			owner: address,
			network,
			allowances,
			collectedAt,
			nonZeroCount,
			highRiskCount,
		};
	},
});
