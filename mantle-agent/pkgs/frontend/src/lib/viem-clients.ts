import { createPublicClient, http } from "viem";
import { mantle, mantleSepoliaTestnet } from "viem/chains";

export type Network = "mainnet" | "testnet";

export const CHAIN_IDS: Record<Network, number> = {
	mainnet: 5000,
	testnet: 5003,
};

function getRpcUrl(network: Network): string {
	if (network === "testnet") {
		return process.env.MANTLE_RPC_TESTNET ?? "https://rpc.sepolia.mantle.xyz";
	}
	return process.env.MANTLE_RPC_MAINNET ?? "https://rpc.mantle.xyz";
}

const RPC_TIMEOUT_MS = 30_000;

export function getPublicClient(network: Network = "mainnet") {
	const chain = network === "testnet" ? mantleSepoliaTestnet : mantle;
	return createPublicClient({
		chain,
		transport: http(getRpcUrl(network), { timeout: RPC_TIMEOUT_MS }),
	});
}

export function getExplorerUrl(txHash: string, network: Network): string {
	if (network === "testnet") {
		return `https://explorer.sepolia.mantle.xyz/tx/${txHash}`;
	}
	return `https://explorer.mantle.xyz/tx/${txHash}`;
}

/** Unsigned transaction payload returned by write tools for client-side signing. */
export type UnsignedTxPayload = {
	to: string;
	data: string;
	value: string;
	gas?: string;
	chainId: number;
};

/** Standard output schema shape for tools that return an unsigned transaction. */
export type PendingSignatureOutput = {
	type: "pending_signature";
	description: string;
	unsignedTx: UnsignedTxPayload;
	simulationPassed: boolean;
	estimatedFee: string;
};
