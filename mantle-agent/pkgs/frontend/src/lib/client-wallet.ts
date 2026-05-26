"use client";

import type { UnsignedTxPayload } from "./viem-clients";

declare global {
	interface Window {
		ethereum?: {
			request: (args: {
				method: string;
				params?: unknown[];
			}) => Promise<unknown>;
			on: (event: string, handler: (...args: unknown[]) => void) => void;
			removeListener: (
				event: string,
				handler: (...args: unknown[]) => void,
			) => void;
		};
	}
}

/** Request MetaMask account access. Returns connected addresses. */
export async function connectMetaMask(): Promise<`0x${string}`[]> {
	if (!window.ethereum) {
		throw new Error(
			"MetaMask is not installed. Please install it from https://metamask.io",
		);
	}
	const accounts = (await window.ethereum.request({
		method: "eth_requestAccounts",
	})) as `0x${string}`[];
	return accounts;
}

/** Return already-connected addresses without prompting. */
export async function getConnectedAddresses(): Promise<`0x${string}`[]> {
	if (!window.ethereum) return [];
	const accounts = (await window.ethereum.request({
		method: "eth_accounts",
	})) as `0x${string}`[];
	return accounts;
}

/** Switch MetaMask to the given Mantle chain. */
export async function switchToMantleChain(chainId: number): Promise<void> {
	if (!window.ethereum) throw new Error("MetaMask not available");
	const hexChainId = `0x${chainId.toString(16)}`;
	try {
		await window.ethereum.request({
			method: "wallet_switchEthereumChain",
			params: [{ chainId: hexChainId }],
		});
	} catch (err: unknown) {
		// 4902 = chain not added yet
		if (
			typeof err === "object" &&
			err !== null &&
			"code" in err &&
			(err as { code: number }).code === 4902
		) {
			const isMainnet = chainId === 5000;
			await window.ethereum.request({
				method: "wallet_addEthereumChain",
				params: [
					{
						chainId: hexChainId,
						chainName: isMainnet ? "Mantle" : "Mantle Sepolia Testnet",
						nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
						rpcUrls: isMainnet
							? ["https://rpc.mantle.xyz"]
							: ["https://rpc.sepolia.mantle.xyz"],
						blockExplorerUrls: isMainnet
							? ["https://explorer.mantle.xyz"]
							: ["https://explorer.sepolia.mantle.xyz"],
					},
				],
			});
		} else {
			throw err;
		}
	}
}

/**
 * Send an unsigned transaction via MetaMask.
 * MetaMask will fill in nonce, gasPrice, and prompt the user to sign.
 * Returns the transaction hash.
 */
export async function broadcastTransaction(
	unsignedTx: UnsignedTxPayload,
	fromAddress: `0x${string}`,
): Promise<`0x${string}`> {
	if (!window.ethereum) throw new Error("MetaMask not available");

	// Ensure we're on the correct chain
	await switchToMantleChain(unsignedTx.chainId);

	const txParams: Record<string, string> = {
		from: fromAddress,
		to: unsignedTx.to,
		data: unsignedTx.data,
		value: `0x${BigInt(unsignedTx.value).toString(16)}`,
		chainId: `0x${unsignedTx.chainId.toString(16)}`,
	};
	if (unsignedTx.gas) {
		txParams.gas = `0x${BigInt(unsignedTx.gas).toString(16)}`;
	}

	const txHash = (await window.ethereum.request({
		method: "eth_sendTransaction",
		params: [txParams],
	})) as `0x${string}`;

	return txHash;
}
