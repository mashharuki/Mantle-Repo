import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { validateEVMAddress, lookupInRegistry } from "./address-registry-tools";

type CheckResult = "pass" | "warn" | "fail";

interface RiskCheck {
	name: string;
	result: CheckResult;
	detail: string;
}

function runInputCompletenessCheck(input: {
	operationType: string;
	fromAddress: string;
	toAddress: string;
	tokenIn?: string;
	amountIn?: string;
}): RiskCheck {
	const missing: string[] = [];
	if (!input.fromAddress) missing.push("fromAddress");
	if (!input.toAddress) missing.push("toAddress");
	if (["swap", "approve"].includes(input.operationType) && !input.tokenIn)
		missing.push("tokenIn");
	if (
		["swap", "supply", "borrow", "transfer"].includes(input.operationType) &&
		!input.amountIn
	)
		missing.push("amountIn");

	if (missing.length > 0) {
		return {
			name: "Input Completeness",
			result: "fail",
			detail: `Missing required fields: ${missing.join(", ")}.`,
		};
	}
	return {
		name: "Input Completeness",
		result: "pass",
		detail: "All required fields present.",
	};
}

function runSlippageCheck(slippageBps?: number): RiskCheck {
	if (slippageBps === undefined) {
		return {
			name: "Slippage Check",
			result: "warn",
			detail:
				"No slippage cap provided. Using default tolerance. Consider setting an explicit slippage cap (<= 100 bps / 1%).",
		};
	}
	if (slippageBps > 100) {
		return {
			name: "Slippage Check",
			result: "fail",
			detail: `Slippage ${slippageBps} bps (${(slippageBps / 100).toFixed(2)}%) exceeds the 1% fail threshold.`,
		};
	}
	if (slippageBps > 50) {
		return {
			name: "Slippage Check",
			result: "warn",
			detail: `Slippage ${slippageBps} bps (${(slippageBps / 100).toFixed(2)}%) exceeds the 0.5% warn threshold.`,
		};
	}
	return {
		name: "Slippage Check",
		result: "pass",
		detail: `Slippage ${slippageBps} bps is within acceptable range.`,
	};
}

function runAddressSafetyCheck(
	fromAddress: string,
	toAddress: string,
	network: "mainnet" | "sepolia",
): RiskCheck {
	const issues: string[] = [];

	const { isValidFormat: fromValid } = validateEVMAddress(fromAddress);
	if (!fromValid)
		issues.push(`fromAddress "${fromAddress}" has invalid format`);

	const { isValidFormat: toValid } = validateEVMAddress(toAddress);
	if (!toValid) {
		issues.push(`toAddress "${toAddress}" has invalid format`);
	} else {
		const envKey = network === "mainnet" ? "mainnet" : "testnet";
		const knownContract = lookupInRegistry(toAddress, envKey, "any");
		if (!knownContract) {
			issues.push(
				`toAddress "${toAddress}" is not in the verified registry — verify before proceeding`,
			);
			return {
				name: "Address Safety Check",
				result: "warn",
				detail: issues.join("; "),
			};
		}
	}

	if (issues.length > 0) {
		return {
			name: "Address Safety Check",
			result: "fail",
			detail: issues.join("; "),
		};
	}
	return {
		name: "Address Safety Check",
		result: "pass",
		detail:
			"Both addresses have valid format. Target contract found in registry.",
	};
}

function runAllowanceCheck(operationType: string): RiskCheck {
	if (operationType === "approve") {
		return {
			name: "Allowance Scope Check",
			result: "warn",
			detail:
				"Approval operation detected. Verify the approval amount is limited to the intended transaction amount. Unlimited approvals (max uint256) expand attack surface.",
		};
	}
	return {
		name: "Allowance Scope Check",
		result: "pass",
		detail: "No approval scope concerns for this operation type.",
	};
}

function runGasCheck(estimatedGas?: string): RiskCheck {
	if (!estimatedGas) {
		return {
			name: "Gas Sanity Check",
			result: "warn",
			detail:
				"No gas estimate provided. Obtain an estimate via simulation before signing.",
		};
	}
	const gas = parseInt(estimatedGas, 10);
	if (gas > 5_000_000) {
		return {
			name: "Gas Sanity Check",
			result: "warn",
			detail: `Gas estimate ${gas.toLocaleString()} is unusually high. Verify the transaction data is correct.`,
		};
	}
	if (gas < 21_000) {
		return {
			name: "Gas Sanity Check",
			result: "fail",
			detail: `Gas estimate ${gas} is below the minimum (21,000). Invalid transaction.`,
		};
	}
	return {
		name: "Gas Sanity Check",
		result: "pass",
		detail: `Gas estimate ${gas.toLocaleString()} appears reasonable.`,
	};
}

function runDeadlineCheck(deadlineMinutes?: number): RiskCheck {
	if (deadlineMinutes === undefined) {
		return {
			name: "Deadline Check",
			result: "warn",
			detail:
				"No deadline specified. Consider setting a transaction deadline (recommended: 20 minutes) to prevent stale execution.",
		};
	}
	if (deadlineMinutes > 60) {
		return {
			name: "Deadline Check",
			result: "fail",
			detail: `Deadline of ${deadlineMinutes} minutes exceeds the 60-minute fail threshold. Use a shorter deadline.`,
		};
	}
	if (deadlineMinutes > 20) {
		return {
			name: "Deadline Check",
			result: "warn",
			detail: `Deadline of ${deadlineMinutes} minutes exceeds the 20-minute warn threshold.`,
		};
	}
	return {
		name: "Deadline Check",
		result: "pass",
		detail: `Deadline ${deadlineMinutes} minutes is within acceptable range.`,
	};
}

export const evaluateTransactionRisk = createTool({
	id: "evaluate-transaction-risk",
	description:
		"Run a pre-execution risk checklist for a Mantle transaction. Evaluates input completeness, slippage, address safety, allowance scope, gas, and deadline. Returns a pass/warn/block verdict with details for each check.",
	inputSchema: z.object({
		operationType: z
			.enum(["swap", "approve", "supply", "withdraw", "borrow", "transfer"])
			.describe("Type of DeFi operation"),
		network: z
			.enum(["mainnet", "sepolia"])
			.default("mainnet")
			.describe("Mantle network environment"),
		fromAddress: z.string().describe("Sender wallet address"),
		toAddress: z.string().describe("Target contract or recipient address"),
		tokenIn: z.string().optional().describe("Input token address or symbol"),
		tokenOut: z.string().optional().describe("Output token address or symbol"),
		amountIn: z
			.string()
			.optional()
			.describe("Amount of input token in human-readable units"),
		slippageBps: z
			.number()
			.optional()
			.describe("Maximum acceptable slippage in basis points (e.g. 50 = 0.5%)"),
		deadlineMinutes: z
			.number()
			.optional()
			.describe("Transaction deadline in minutes from now"),
		estimatedGas: z
			.string()
			.optional()
			.describe("Estimated gas units for the transaction"),
	}),
	outputSchema: z.object({
		verdict: z.enum(["pass", "warn", "block"]),
		confidence: z.enum(["high", "medium", "low"]),
		checks: z.array(
			z.object({
				name: z.string(),
				result: z.enum(["pass", "warn", "fail"]),
				detail: z.string(),
			}),
		),
		summary: z.string(),
		blockers: z.array(z.string()),
		warnings: z.array(z.string()),
	}),
	execute: async (inputData) => {
		const network = (inputData.network ?? "mainnet") as "mainnet" | "sepolia";

		const checks: RiskCheck[] = [
			runInputCompletenessCheck({
				operationType: inputData.operationType,
				fromAddress: inputData.fromAddress,
				toAddress: inputData.toAddress,
				tokenIn: inputData.tokenIn,
				amountIn: inputData.amountIn,
			}),
			runSlippageCheck(inputData.slippageBps),
			runAddressSafetyCheck(
				inputData.fromAddress,
				inputData.toAddress,
				network,
			),
			runAllowanceCheck(inputData.operationType),
			runGasCheck(inputData.estimatedGas),
			runDeadlineCheck(inputData.deadlineMinutes),
		];

		const failChecks = checks.filter((c) => c.result === "fail");
		const warnChecks = checks.filter((c) => c.result === "warn");

		let verdict: "pass" | "warn" | "block";
		if (failChecks.length > 0) {
			verdict = "block";
		} else if (warnChecks.length > 0) {
			verdict = "warn";
		} else {
			verdict = "pass";
		}

		const confidence: "high" | "medium" | "low" =
			inputData.estimatedGas && inputData.slippageBps !== undefined
				? "high"
				: inputData.estimatedGas || inputData.slippageBps !== undefined
					? "medium"
					: "low";

		const blockers = failChecks.map((c) => c.detail);
		const warnings = warnChecks.map((c) => c.detail);

		const summaryMap = {
			block: `⛔ BLOCKED — ${failChecks.length} critical issue(s) must be resolved before proceeding.`,
			warn: `⚠️ WARNING — ${warnChecks.length} concern(s) require acknowledgement before signing.`,
			pass: "✅ PASS — All risk checks passed. Proceed with caution; this is not a guarantee of execution success.",
		};

		return {
			verdict,
			confidence,
			checks,
			summary: summaryMap[verdict],
			blockers,
			warnings,
		};
	},
});
