import { createTool } from "@mastra/core/tools";
import { z } from "zod";

function getRpcUrl(network: string): string {
	if (network === "sepolia") {
		return process.env.MANTLE_RPC_TESTNET ?? "https://rpc.sepolia.mantle.xyz";
	}
	return process.env.MANTLE_RPC_MAINNET ?? "https://rpc.mantle.xyz";
}

async function simulateViaEthCall(
	rpcUrl: string,
	from: string,
	to: string,
	data: string,
	value: string,
	blockTag: string,
): Promise<{ success: boolean; gasEstimate?: string; revertReason?: string }> {
	// First try eth_estimateGas to detect reverts
	const gasRes = await fetch(rpcUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "eth_estimateGas",
			params: [{ from, to, data, value }],
		}),
	});
	const gasJson = (await gasRes.json()) as {
		result?: string;
		error?: { message: string; data?: string };
	};

	if (gasJson.error) {
		const revertReason = gasJson.error.data
			? `0x${gasJson.error.data}` // raw revert data
			: gasJson.error.message;
		return { success: false, revertReason };
	}

	// Then try eth_call to confirm
	const callRes = await fetch(rpcUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 2,
			method: "eth_call",
			params: [{ from, to, data, value }, blockTag],
		}),
	});
	const callJson = (await callRes.json()) as {
		result?: string;
		error?: { message: string };
	};

	if (callJson.error) {
		return { success: false, revertReason: callJson.error.message };
	}

	return {
		success: true,
		gasEstimate: gasJson.result
			? String(parseInt(gasJson.result, 16))
			: undefined,
	};
}

async function simulateViaTenderly(
	from: string,
	to: string,
	data: string,
	value: string,
	network: string,
): Promise<{
	success: boolean;
	gasEstimate?: string;
	revertReason?: string;
	stateDiff?: string;
}> {
	const key = process.env.TENDERLY_ACCESS_KEY;
	const account = process.env.TENDERLY_ACCOUNT;
	const project = process.env.TENDERLY_PROJECT;

	if (!key || !account || !project)
		throw new Error("Tenderly credentials not configured");

	const chainId = network === "sepolia" ? 5003 : 5000;
	const res = await fetch(
		`https://api.tenderly.co/api/v1/account/${account}/project/${project}/simulate`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Access-Key": key,
			},
			body: JSON.stringify({
				network_id: chainId.toString(),
				from,
				to,
				input: data,
				value: parseInt(value, 16) || 0,
				save: false,
			}),
		},
	);
	const json = (await res.json()) as {
		transaction?: {
			status: boolean;
			gas_used?: number;
			error_message?: string;
		};
	};

	if (!json.transaction) throw new Error("Tenderly returned empty response");

	return {
		success: json.transaction.status,
		gasEstimate: json.transaction.gas_used?.toString(),
		revertReason: json.transaction.status
			? undefined
			: json.transaction.error_message,
		stateDiff: "Available in Tenderly dashboard",
	};
}

function buildWysiwys(params: {
	success: boolean;
	from: string;
	to: string;
	value: string;
	gasEstimate?: string;
	revertReason?: string;
}): string {
	if (!params.success) {
		return [
			"Simulation failed before execution.",
			`- Likely failure point: call to ${params.to}`,
			`- Observed error: ${params.revertReason ?? "unknown revert"}`,
			"- Action: do_not_execute until issue is resolved.",
		].join("\n");
	}

	const valueWei = BigInt(
		params.value === "0x0" || !params.value ? "0" : params.value,
	);
	const valueMnt =
		valueWei > 0n ? `${(Number(valueWei) / 1e18).toFixed(6)} MNT` : "0 MNT";
	const gasMnt = params.gasEstimate
		? `~${((parseInt(params.gasEstimate) * 0.02) / 1e9).toFixed(6)} MNT (estimate at 0.02 Gwei)`
		: "unknown";

	return [
		"If this transaction is broadcast:",
		`- You will call: ${params.to}`,
		`- You will spend (value): ${valueMnt}`,
		`- You will receive at least: [depends on slippage/execution — review output tokens]`,
		`- Estimated network fee: ${gasMnt}`,
		"- Additional approval change: none (unless this is an approve call)",
		"",
		"Note: This is a simulation estimate, not a guarantee. Actual execution may differ.",
	].join("\n");
}

export const simulateTransaction = createTool({
	id: "simulate-transaction",
	description:
		"Simulate a Mantle transaction before signing. Uses Tenderly if configured, otherwise falls back to eth_call/eth_estimateGas. Returns success/revert status, gas estimate, and a WYSIWYS (What You See Is What You Sign) plain-language summary. Never broadcasts a real transaction.",
	inputSchema: z.object({
		from: z.string().describe("Sender address"),
		to: z.string().describe("Target contract address"),
		data: z.string().default("0x").describe("Hex-encoded calldata"),
		value: z
			.string()
			.default("0x0")
			.describe("ETH value in hex (e.g. 0x0 or 0xde0b6b3a7640000 for 1 MNT)"),
		network: z
			.enum(["mainnet", "sepolia"])
			.default("mainnet")
			.describe("Mantle network"),
		blockTag: z.string().default("latest").describe("Block tag for simulation"),
	}),
	outputSchema: z.object({
		status: z.enum(["success", "revert", "inconclusive"]),
		gasEstimate: z.string().optional(),
		revertReason: z.string().optional(),
		wysiwys: z.string(),
		backend: z.string(),
		simulatedAt: z.string(),
		doNotExecuteReason: z.string().optional(),
	}),
	execute: async (inputData) => {
		const from = inputData.from;
		const to = inputData.to;
		const data = inputData.data ?? "0x";
		const value = inputData.value ?? "0x0";
		const network = inputData.network ?? "mainnet";
		const blockTag = inputData.blockTag ?? "latest";
		const simulatedAt = new Date().toISOString();

		// Try Tenderly first
		if (
			process.env.TENDERLY_ACCESS_KEY &&
			process.env.TENDERLY_ACCOUNT &&
			process.env.TENDERLY_PROJECT
		) {
			try {
				const result = await simulateViaTenderly(
					from,
					to,
					data,
					value,
					network,
				);
				const wysiwys = buildWysiwys({
					success: result.success,
					from,
					to,
					value,
					gasEstimate: result.gasEstimate,
					revertReason: result.revertReason,
				});
				return {
					status: (result.success ? "success" : "revert") as
						| "success"
						| "revert",
					gasEstimate: result.gasEstimate,
					revertReason: result.revertReason,
					wysiwys,
					backend: "Tenderly Simulation API",
					simulatedAt,
				};
			} catch {
				// Fall through to eth_call
			}
		}

		// Fallback: eth_call + eth_estimateGas
		try {
			const rpcUrl = getRpcUrl(network);
			const result = await simulateViaEthCall(
				rpcUrl,
				from,
				to,
				data,
				value,
				blockTag,
			);
			const wysiwys = buildWysiwys({
				success: result.success,
				from,
				to,
				value,
				gasEstimate: result.gasEstimate,
				revertReason: result.revertReason,
			});
			return {
				status: result.success ? ("success" as const) : ("revert" as const),
				gasEstimate: result.gasEstimate,
				revertReason: result.revertReason,
				wysiwys,
				backend: "Mantle RPC eth_call (basic simulation)",
				simulatedAt,
				doNotExecuteReason: result.success
					? undefined
					: "Simulation reverted. Investigate before broadcasting.",
			};
		} catch (e) {
			return {
				status: "inconclusive" as const,
				wysiwys:
					"Simulation failed to complete. Do not execute until the cause is investigated.",
				backend: "Mantle RPC (failed)",
				simulatedAt,
				doNotExecuteReason: `Simulation could not be completed: ${e instanceof Error ? e.message : String(e)}`,
			};
		}
	},
});
