import { createTool } from "@mastra/core/tools";
import { z } from "zod";

interface ErrorPattern {
	name: string;
	patterns: string[];
	likelyCauses: string[];
	nextSteps: string[];
	severity: "low" | "medium" | "high";
}

const ERROR_PATTERNS: ErrorPattern[] = [
	{
		name: "RPC Rate Limit",
		patterns: ["429", "rate limit", "too many requests", "request limit"],
		likelyCauses: [
			"Public RPC endpoint is rate-limited",
			"Too many concurrent requests from a single IP",
			"Burst of requests exceeding provider quota",
		],
		nextSteps: [
			"Retry with exponential backoff (wait 2s, 4s, 8s)",
			"Switch to a dedicated provider endpoint",
			"Reduce request frequency or batch size",
			"Check https://docs.mantle.xyz/network/for-developers/resources-and-tooling/node-endpoints-and-providers for alternative providers",
		],
		severity: "medium",
	},
	{
		name: "RPC Connectivity / Timeout",
		patterns: [
			"timeout",
			"connection reset",
			"econnrefused",
			"etimedout",
			"network error",
			"503",
			"502",
			"bad gateway",
		],
		likelyCauses: [
			"RPC provider is temporarily unavailable",
			"Network connectivity issue",
			"Endpoint URL is incorrect",
		],
		nextSteps: [
			"Verify the RPC URL is correct (mainnet: https://rpc.mantle.xyz, testnet: https://rpc.sepolia.mantle.xyz)",
			"Test connectivity with a simple eth_blockNumber call",
			"Switch to an alternative provider from the Mantle docs",
		],
		severity: "medium",
	},
	{
		name: "Contract Revert / Call Exception",
		patterns: [
			"execution reverted",
			"call_exception",
			"revert",
			"invalid opcode",
			"out of gas",
		],
		likelyCauses: [
			"Wrong contract address or ABI mismatch",
			"Invalid function parameters or state preconditions not met",
			"Insufficient token balance or allowance for the operation",
			"Contract paused or access-controlled function",
		],
		nextSteps: [
			"Verify the contract address against the registry (use resolveContractAddress tool)",
			"Decode the revert data if available (e.g. 0x08c379a0 prefix = Error(string))",
			"Dry-run with a minimal input to isolate the failing parameter",
			"Check if the contract requires a prior approval (allowance) call",
		],
		severity: "high",
	},
	{
		name: "Quote / Liquidity Failure",
		patterns: [
			"path not found",
			"amount out equals zero",
			"insufficient liquidity",
			"no route",
			"quote failed",
			"zero output",
		],
		likelyCauses: [
			"Insufficient liquidity for the token pair at the requested size",
			"Unsupported route or token pair not listed on the DEX",
			"Wrong token decimals or amount scaling",
			"Token pair is on a different fee tier",
		],
		nextSteps: [
			"Validate token decimals and ensure amountIn is correctly scaled",
			"Try a smaller input amount to confirm liquidity exists",
			"Try an alternate protocol (e.g. switch from Agni to Merchant Moe)",
			"Check if both tokens are on the same network (mainnet vs testnet)",
		],
		severity: "medium",
	},
	{
		name: "Balance Inconsistency",
		patterns: [
			"balance mismatch",
			"unexpected balance",
			"stale balance",
			"nonce too low",
			"nonce contention",
		],
		likelyCauses: [
			"Pending transactions not yet confirmed",
			"Stale block tag used in query (try 'latest')",
			"Nonce contention from concurrent transaction submissions",
			"Indexer lag behind chain head",
		],
		nextSteps: [
			"Query with explicit 'latest' block tag",
			"Compare eth_getBalance result at 'latest' vs 'pending'",
			"Check pending transactions for the wallet address",
			"Wait 1-2 blocks and re-query",
		],
		severity: "low",
	},
	{
		name: "Invalid Parameters",
		patterns: [
			"invalid params",
			"invalid address",
			"invalid hex",
			"cannot read",
			"missing parameter",
			"-32602",
			"-32600",
		],
		likelyCauses: [
			"Malformed address (not EIP-55 checksummed or wrong length)",
			"Missing required JSON-RPC parameter",
			"Invalid hex encoding in calldata",
		],
		nextSteps: [
			"Validate address format: must be 0x + 40 hex characters",
			"Ensure all hex strings start with 0x",
			"Check JSON-RPC method documentation for required parameter structure",
		],
		severity: "medium",
	},
];

export const debugRpcError = createTool({
	id: "debug-rpc-error",
	description:
		"Diagnose RPC and blockchain errors using pattern matching against known error signatures. Returns root-cause hypothesis, confidence level, and actionable next steps. Read-only — no network calls are made.",
	inputSchema: z.object({
		errorText: z
			.string()
			.describe("Raw error message, stack trace, or JSON-RPC error response"),
		method: z
			.string()
			.optional()
			.describe(
				"RPC method that failed (e.g. eth_call, eth_getLogs, eth_estimateGas)",
			),
		endpoint: z.string().optional().describe("RPC endpoint URL that was used"),
		network: z
			.enum(["mainnet", "sepolia", "unknown"])
			.default("unknown")
			.describe("Mantle network context"),
	}),
	outputSchema: z.object({
		matched: z.boolean(),
		errorCategory: z.string(),
		diagnosis: z.string(),
		rootCause: z.string(),
		confidence: z.enum(["high", "medium", "low"]),
		severity: z.enum(["low", "medium", "high"]),
		nextSteps: z.array(z.string()),
		escalationItems: z.array(z.string()).optional(),
		mantleSpecificNote: z.string().optional(),
	}),
	execute: async (inputData) => {
		const errorText = inputData.errorText;
		const method = inputData.method;
		const network = inputData.network ?? "unknown";
		const lowerError = errorText.toLowerCase();

		// Find matching pattern
		let bestMatch: ErrorPattern | null = null;
		let matchScore = 0;

		for (const pattern of ERROR_PATTERNS) {
			const score = pattern.patterns.filter((p) =>
				lowerError.includes(p),
			).length;
			if (score > matchScore) {
				matchScore = score;
				bestMatch = pattern;
			}
		}

		if (!bestMatch) {
			return {
				matched: false,
				errorCategory: "Unknown",
				diagnosis:
					"Error pattern not recognized in the known error signature map.",
				rootCause:
					"Unable to determine root cause from the provided error text.",
				confidence: "low" as const,
				severity: "medium" as const,
				nextSteps: [
					"Copy the full error text and search the Mantle documentation",
					"Check the JSON-RPC error code (if present) against the Ethereum RPC spec",
					`Try isolating the issue with a minimal reproduction${method ? ` using ${method}` : ""}`,
					"Consider opening an issue in the Mantle Discord/forum with the full error context",
				],
				escalationItems: [
					"Full error text with stack trace",
					"RPC method and parameters used",
					"Network and block number at time of failure",
				],
			};
		}

		const confidence: "high" | "medium" | "low" =
			matchScore >= 2 ? "high" : matchScore === 1 ? "medium" : "low";

		const mantleNote =
			network !== "unknown" && bestMatch.name === "RPC Rate Limit"
				? `On Mantle ${network}, the public RPC (${network === "mainnet" ? "https://rpc.mantle.xyz" : "https://rpc.sepolia.mantle.xyz"}) has rate limits. For production use, configure MANTLE_RPC_${network.toUpperCase()} env var with a dedicated provider.`
				: bestMatch.name === "Contract Revert / Call Exception" &&
						method === "eth_estimateGas"
					? "eth_estimateGas reverts indicate the transaction would fail on-chain. The gas estimate cannot be provided for failing transactions."
					: undefined;

		return {
			matched: true,
			errorCategory: bestMatch.name,
			diagnosis: `Error matches pattern: ${bestMatch.name}. Error text: "${errorText.slice(0, 200)}${errorText.length > 200 ? "..." : ""}"`,
			rootCause: bestMatch.likelyCauses[0],
			confidence,
			severity: bestMatch.severity,
			nextSteps: bestMatch.nextSteps,
			escalationItems: [
				"Full error text with all context",
				`RPC method: ${method ?? "not specified"}`,
				`Endpoint: ${inputData.endpoint ?? "not specified"}`,
				`Network: ${network}`,
			],
			mantleSpecificNote: mantleNote,
		};
	},
});
