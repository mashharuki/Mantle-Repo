import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mantle, mantleSepoliaTestnet } from "viem/chains";

type Network = "mainnet" | "testnet";

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

export function getAgentWalletClient(network: Network = "mainnet") {
	const pk = process.env.AGENT_PRIVATE_KEY;
	if (!pk) throw new Error("AGENT_PRIVATE_KEY environment variable is not set");
	const privateKey = pk.startsWith("0x")
		? (pk as `0x${string}`)
		: (`0x${pk}` as `0x${string}`);
	const account = privateKeyToAccount(privateKey);
	const chain = network === "testnet" ? mantleSepoliaTestnet : mantle;
	return createWalletClient({
		account,
		chain,
		transport: http(getRpcUrl(network), { timeout: RPC_TIMEOUT_MS }),
	});
}

export function getAgentAddress(): `0x${string}` {
	const pk = process.env.AGENT_PRIVATE_KEY;
	if (!pk) throw new Error("AGENT_PRIVATE_KEY environment variable is not set");
	const privateKey = pk.startsWith("0x")
		? (pk as `0x${string}`)
		: (`0x${pk}` as `0x${string}`);
	return privateKeyToAccount(privateKey).address;
}

export function getExplorerUrl(txHash: string, network: Network): string {
	if (network === "testnet") {
		return `https://explorer.sepolia.mantle.xyz/tx/${txHash}`;
	}
	return `https://explorer.mantle.xyz/tx/${txHash}`;
}
