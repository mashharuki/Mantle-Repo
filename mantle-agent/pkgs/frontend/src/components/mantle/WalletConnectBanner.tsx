"use client";

import { useClientWallet } from "@/hooks/useClientWallet";
import {
    MANTLE_BLUE,
    MANTLE_TEXT_MUTED,
    MANTLE_TEXT_SECONDARY
} from "@/utils/constants";
import { useState } from "react";

/**
 * Soft banner prompting the user to connect their MetaMask wallet.
 * Disappears automatically once the wallet is connected.
 * Can be dismissed manually via the ✕ button.
 */
export function WalletConnectBanner() {
	const { isConnected, isConnecting, connect, error } = useClientWallet();
	const [dismissed, setDismissed] = useState(false);

	// Auto-hide when connected or manually dismissed
	if (isConnected || dismissed) return null;

	return (
		<div
			className="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
			style={{
				background: `${MANTLE_BLUE}08`,
				borderColor: `${MANTLE_BLUE}30`,
			}}
		>
			{/* Icon */}
			<span className="mt-0.5 shrink-0 text-base">🦊</span>

			{/* Body */}
			<div className="min-w-0 flex-1">
				<p className="font-semibold mb-0.5" style={{ color: MANTLE_BLUE }}>
					ウォレットを接続してください
				</p>
				<p className="text-xs leading-relaxed" style={{ color: MANTLE_TEXT_SECONDARY }}>
					トランザクションを送信するには MetaMask の接続が必要です。読み取り専用の操作は接続なしでも利用できます。
				</p>
				{error && (
					<p className="mt-1 text-xs" style={{ color: "#FF6B6B" }}>
						{error}
					</p>
				)}
				<button
					type="button"
					onClick={connect}
					disabled={isConnecting}
					className="mt-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
					style={{
						background: MANTLE_BLUE,
						color: "#080B12",
					}}
				>
					{isConnecting ? "接続中…" : "Connect Wallet"}
				</button>
			</div>

			{/* Dismiss */}
			<button
				type="button"
				onClick={() => setDismissed(true)}
				className="shrink-0 rounded px-1 py-0.5 text-[11px] transition-opacity hover:opacity-70"
				style={{ color: MANTLE_TEXT_MUTED }}
				aria-label="Close"
			>
				✕
			</button>
		</div>
	);
}
