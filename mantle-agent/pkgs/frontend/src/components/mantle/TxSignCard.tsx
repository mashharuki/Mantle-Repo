"use client";

import { useClientWallet } from "@/hooks/useClientWallet";
import type { UnsignedTxPayload } from "@/lib/viem-clients";
import {
	MANTLE_BLUE,
	MANTLE_BORDER,
	MANTLE_BORDER_ACCENT,
	MANTLE_CARD_BG,
	MANTLE_GREEN,
	MANTLE_ORANGE,
	MANTLE_TEXT_MUTED,
	MANTLE_TEXT_PRIMARY,
	MANTLE_TEXT_SECONDARY,
} from "@/utils/constants";
import { useState } from "react";

interface TxSignCardProps {
	unsignedTx: UnsignedTxPayload;
	description: string;
	estimatedFee: string;
	simulationPassed: boolean;
	onComplete: (txHash: string) => void;
	onReject: () => void;
}

type CardState = "idle" | "signing" | "success" | "error";

export function TxSignCard({
	unsignedTx,
	description,
	estimatedFee,
	simulationPassed,
	onComplete,
	onReject,
}: TxSignCardProps) {
	const { isConnected, connect, sendUnsignedTx } = useClientWallet();
	const [state, setState] = useState<CardState>("idle");
	const [txHash, setTxHash] = useState<string | null>(null);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);

	const explorerBase =
		unsignedTx.chainId === 5000
			? "https://explorer.mantle.xyz/tx/"
			: "https://explorer.sepolia.mantle.xyz/tx/";

	const handleSign = async () => {
		if (!isConnected) {
			await connect();
			return;
		}
		setState("signing");
		setErrorMsg(null);
		try {
			const hash = await sendUnsignedTx(unsignedTx);
			setTxHash(hash);
			setState("success");
			onComplete(hash);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			// User rejected — treat as soft cancel, not error
			if (msg.includes("User rejected") || msg.includes("user rejected")) {
				setState("idle");
			} else {
				setErrorMsg(msg);
				setState("error");
			}
		}
	};

	return (
		<div
			className="my-2 rounded-xl border p-4 text-sm max-w-sm"
			style={{
				background: MANTLE_CARD_BG,
				borderColor:
					state === "success"
						? `${MANTLE_GREEN}40`
						: state === "error"
							? `${MANTLE_ORANGE}40`
							: MANTLE_BORDER_ACCENT,
			}}
		>
			{/* Header */}
			<div className="flex items-center gap-2 mb-3">
				<span className="text-base">🔑</span>
				<span className="font-semibold" style={{ color: MANTLE_TEXT_PRIMARY }}>
					Transaction to Sign
				</span>
				{simulationPassed && (
					<span
						className="ml-auto text-[10px] px-1.5 py-0.5 rounded font-mono"
						style={{
							background: `${MANTLE_GREEN}18`,
							color: MANTLE_GREEN,
						}}
					>
						simulated ✓
					</span>
				)}
			</div>

			{/* Description */}
			<p style={{ color: MANTLE_TEXT_SECONDARY }} className="mb-3 leading-snug">
				{description}
			</p>

			{/* Details */}
			<dl className="space-y-1 mb-4 text-[11px] font-mono">
				<div className="flex justify-between gap-2">
					<dt style={{ color: MANTLE_TEXT_MUTED }}>To</dt>
					<dd
						style={{ color: MANTLE_TEXT_SECONDARY }}
						className="truncate max-w-[200px]"
					>
						{unsignedTx.to.slice(0, 10)}…{unsignedTx.to.slice(-6)}
					</dd>
				</div>
				<div className="flex justify-between gap-2">
					<dt style={{ color: MANTLE_TEXT_MUTED }}>Chain</dt>
					<dd style={{ color: MANTLE_TEXT_SECONDARY }}>
						{unsignedTx.chainId === 5000 ? "Mantle Mainnet" : "Mantle Sepolia"}
					</dd>
				</div>
				<div className="flex justify-between gap-2">
					<dt style={{ color: MANTLE_TEXT_MUTED }}>Est. fee</dt>
					<dd style={{ color: MANTLE_TEXT_SECONDARY }}>{estimatedFee}</dd>
				</div>
			</dl>

			{/* State: success */}
			{state === "success" && txHash && (
				<div
					className="rounded-lg p-3 mb-3 text-[11px] font-mono break-all"
					style={{
						background: `${MANTLE_GREEN}10`,
						color: MANTLE_GREEN,
						border: `1px solid ${MANTLE_GREEN}30`,
					}}
				>
					✓ Sent:{" "}
					<a
						href={`${explorerBase}${txHash}`}
						target="_blank"
						rel="noopener noreferrer"
						className="underline underline-offset-2"
					>
						{txHash.slice(0, 12)}…{txHash.slice(-6)}
					</a>
				</div>
			)}

			{/* State: error */}
			{state === "error" && errorMsg && (
				<div
					className="rounded-lg p-3 mb-3 text-[11px] leading-snug"
					style={{
						background: `${MANTLE_ORANGE}10`,
						color: MANTLE_ORANGE,
						border: `1px solid ${MANTLE_ORANGE}30`,
					}}
				>
					✗ {errorMsg}
				</div>
			)}

			{/* Actions */}
			{state !== "success" && (
				<div className="flex gap-2">
					<button
						type="button"
						onClick={handleSign}
						disabled={state === "signing"}
						className="flex-1 rounded-lg py-2 text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
						style={{
							background: MANTLE_BLUE,
							color: "#080B12",
						}}
					>
						{!isConnected
							? "Connect & Sign"
							: state === "signing"
								? "Waiting for MetaMask…"
								: "Sign & Send"}
					</button>
					{state !== "signing" && (
						<button
							type="button"
							onClick={onReject}
							className="rounded-lg px-3 py-2 text-xs font-semibold border transition-opacity hover:opacity-70"
							style={{
								borderColor: MANTLE_BORDER,
								color: MANTLE_TEXT_MUTED,
							}}
						>
							Reject
						</button>
					)}
				</div>
			)}
		</div>
	);
}
