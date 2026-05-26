"use client";

import {
	broadcastTransaction,
	connectMetaMask,
	getConnectedAddresses,
} from "@/lib/client-wallet";
import type { UnsignedTxPayload } from "@/lib/viem-clients";
import { useCallback, useEffect, useState } from "react";

export interface UseClientWallet {
	address: `0x${string}` | null;
	isConnected: boolean;
	isConnecting: boolean;
	connect: () => Promise<void>;
	disconnect: () => void;
	sendUnsignedTx: (unsignedTx: UnsignedTxPayload) => Promise<`0x${string}`>;
	error: string | null;
}

const STORAGE_KEY = "mantle_wallet_address";

export function useClientWallet(): UseClientWallet {
	const [address, setAddress] = useState<`0x${string}` | null>(null);
	const [isConnecting, setIsConnecting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Restore persisted address on mount
	useEffect(() => {
		const stored = localStorage.getItem(STORAGE_KEY) as `0x${string}` | null;
		if (stored) {
			// Verify it's still connected
			getConnectedAddresses()
				.then((accounts) => {
					if (accounts.includes(stored)) {
						setAddress(stored);
					} else {
						localStorage.removeItem(STORAGE_KEY);
					}
				})
				.catch(() => localStorage.removeItem(STORAGE_KEY));
		}
	}, []);

	// Listen for MetaMask account/chain changes
	useEffect(() => {
		if (!window.ethereum) return;

		const handleAccountsChanged = (accounts: unknown) => {
			const list = accounts as `0x${string}`[];
			if (list.length === 0) {
				setAddress(null);
				localStorage.removeItem(STORAGE_KEY);
			} else {
				setAddress(list[0]);
				localStorage.setItem(STORAGE_KEY, list[0]);
			}
		};

		window.ethereum.on("accountsChanged", handleAccountsChanged);
		return () => {
			window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
		};
	}, []);

	const connect = useCallback(async () => {
		setIsConnecting(true);
		setError(null);
		try {
			const accounts = await connectMetaMask();
			if (accounts.length > 0) {
				setAddress(accounts[0]);
				localStorage.setItem(STORAGE_KEY, accounts[0]);
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			setError(msg);
		} finally {
			setIsConnecting(false);
		}
	}, []);

	const disconnect = useCallback(() => {
		setAddress(null);
		localStorage.removeItem(STORAGE_KEY);
	}, []);

	const sendUnsignedTx = useCallback(
		async (unsignedTx: UnsignedTxPayload): Promise<`0x${string}`> => {
			if (!address) throw new Error("Wallet not connected");
			return broadcastTransaction(unsignedTx, address);
		},
		[address],
	);

	return {
		address,
		isConnected: !!address,
		isConnecting,
		connect,
		disconnect,
		sendUnsignedTx,
		error,
	};
}
