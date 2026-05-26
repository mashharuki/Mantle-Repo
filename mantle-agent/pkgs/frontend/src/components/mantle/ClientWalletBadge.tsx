"use client";

import { useClientWallet } from "@/hooks/useClientWallet";
import { MANTLE_BLUE, MANTLE_BORDER, MANTLE_GREEN } from "@/utils/constants";

export function ClientWalletBadge() {
	const { address, isConnected, isConnecting, connect, disconnect, error } =
		useClientWallet();

	if (!isConnected) {
		return (
			<button
				type="button"
				onClick={connect}
				disabled={isConnecting}
				className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
				style={{
					background: `${MANTLE_BLUE}10`,
					borderColor: MANTLE_BORDER,
					color: MANTLE_BLUE,
				}}
				title={error ?? "Connect MetaMask"}
			>
				<span
					className="size-1.5 rounded-full shrink-0 opacity-40"
					style={{ background: MANTLE_BLUE }}
				/>
				{isConnecting ? "Connecting…" : "Connect Wallet"}
			</button>
		);
	}

	const shortAddr = address
		? `${address.slice(0, 6)}…${address.slice(-4)}`
		: "";

	return (
		<div className="flex items-center gap-1">
			<div
				className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold font-mono"
				style={{
					background: `${MANTLE_GREEN}0D`,
					borderColor: MANTLE_BORDER,
					color: MANTLE_GREEN,
				}}
				title={`Connected: ${address}`}
			>
				<span
					className="size-1.5 rounded-full shrink-0"
					style={{ background: MANTLE_GREEN }}
				/>
				{shortAddr}
			</div>
			<button
				type="button"
				onClick={disconnect}
				className="rounded px-1.5 py-1 text-[10px] opacity-40 hover:opacity-70 transition-opacity"
				style={{ color: MANTLE_BLUE }}
				title="Disconnect"
			>
				✕
			</button>
		</div>
	);
}
