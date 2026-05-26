import { getExplorerUrl, getPublicClient } from "@/lib/viem-clients";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const networkSchema = z.enum(["mainnet", "testnet"]).default("testnet");

export const waitForTxReceipt = createTool({
	id: "wait-for-tx-receipt",
	description:
		"Wait for a transaction to be confirmed on-chain after the user has signed and broadcast it via their client wallet (MetaMask). " +
		"Call this after the user confirms a pending_signature transaction. " +
		"Returns the receipt status, block number, gas used, and an explorer link.",
	inputSchema: z.object({
		txHash: z.string().describe("Transaction hash to wait for (0x...)"),
		network: networkSchema.describe(
			"Mantle network the transaction was sent on",
		),
	}),
	outputSchema: z.object({
		txStatus: z.enum(["success", "reverted"]),
		blockNumber: z.string(),
		gasUsed: z.string(),
		explorerUrl: z.string(),
		network: z.string(),
	}),
	execute: async (input) => {
		const network = input.network ?? "testnet";
		const publicClient = getPublicClient(network);
		const receipt = await publicClient.waitForTransactionReceipt({
			hash: input.txHash as `0x${string}`,
			timeout: 120_000,
		});
		return {
			txStatus: receipt.status,
			blockNumber: receipt.blockNumber.toString(),
			gasUsed: receipt.gasUsed.toString(),
			explorerUrl: getExplorerUrl(input.txHash, network),
			network,
		};
	},
});
