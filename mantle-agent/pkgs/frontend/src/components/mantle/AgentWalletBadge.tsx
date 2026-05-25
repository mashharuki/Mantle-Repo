"use client";

import { MANTLE_BLUE, MANTLE_BORDER } from "@/utils/constants";
import { useEffect, useState } from "react";

interface AgentWalletInfo {
	configured: boolean;
	address?: string;
	balanceMNT?: string;
	network?: string;
}

export function AgentWalletBadge({
	network = "testnet",
}: {
	network?: "mainnet" | "testnet";
}) {
	const [info, setInfo] = useState<AgentWalletInfo | null>(null);

	useEffect(() => {
		fetch(`/api/agent-wallet?network=${network}`)
			.then((r) => r.json())
			.then((data: AgentWalletInfo) => setInfo(data))
			.catch(() => setInfo(null));
	}, [network]);

	if (!info?.configured || !info.address) return null;

	const shortAddr = `${info.address.slice(0, 6)}…${info.address.slice(-4)}`;
	const balance = info.balanceMNT
		? `${Number.parseFloat(info.balanceMNT).toFixed(4)} MNT`
		: "—";

	return (
		<div
			className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold font-mono"
			style={{
				background: `${MANTLE_BLUE}08`,
				borderColor: `${MANTLE_BORDER}`,
				color: MANTLE_BLUE,
			}}
			title={`Agent wallet: ${info.address}\nBalance: ${info.balanceMNT} MNT`}
		>
			<span
				className="size-1.5 rounded-full shrink-0"
				style={{ background: MANTLE_BLUE }}
			/>
			{shortAddr} · {balance}
		</div>
	);
}
