"use client";

import {
    MANTLE_BLUE,
    MANTLE_BORDER,
    MANTLE_BORDER_ACCENT,
    MANTLE_GREEN,
    MANTLE_SIDEBAR_BG,
    MANTLE_TEXT_MUTED,
    MANTLE_TEXT_PRIMARY,
    MANTLE_TEXT_SECONDARY
} from "@/utils/constants";
import {
    ActivityIcon,
    CodeIcon,
    DatabaseIcon,
    PlusIcon,
    ShieldCheckIcon,
    TerminalIcon,
    TrendingUpIcon,
    WalletIcon,
} from "lucide-react";

const CAPABILITIES = [
	{ icon: TrendingUpIcon, label: "DeFi Operator" },
	{ icon: CodeIcon, label: "Smart Contracts" },
	{ icon: WalletIcon, label: "Portfolio Analyst" },
	{ icon: ShieldCheckIcon, label: "Risk Evaluator" },
	{ icon: DatabaseIcon, label: "Data Indexer" },
	{ icon: ActivityIcon, label: "TX Simulator" },
];

export function MantleSidebar({
	sessionTitle,
	recentSessions,
	onNewSession,
}: {
	sessionTitle?: string;
	recentSessions?: string[];
	onNewSession: () => void;
}) {
	return (
		<aside
			className="flex h-full shrink-0 flex-col overflow-y-auto"
			style={{
				width: 260,
				background: MANTLE_SIDEBAR_BG,
				borderRight: `1px solid ${MANTLE_BORDER}`,
			}}
		>
			{/* Logo Row */}
			<div className="flex items-center gap-2.5 px-4 py-5">
				<div
					className="flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
					style={{
						background: `${MANTLE_BLUE}18`,
						border: `1px solid ${MANTLE_BLUE}30`,
						color: MANTLE_BLUE,
					}}
				>
					<TerminalIcon className="size-4" />
				</div>
				<div className="flex min-w-0 flex-1 flex-col gap-0.5">
					<span
						className="truncate text-sm font-bold"
						style={{ color: MANTLE_TEXT_PRIMARY }}
					>
						Mantle Agent
					</span>
					<span className="text-[9px]" style={{ color: MANTLE_BLUE }}>
						AI Command Center
					</span>
				</div>
				<button
					type="button"
					onClick={onNewSession}
					className="flex shrink-0 items-center justify-center rounded-md transition-colors"
					style={{
						width: 28,
						height: 28,
						background: MANTLE_BORDER_ACCENT,
						color: MANTLE_BLUE,
					}}
					title="New session"
				>
					<PlusIcon className="size-3.5" />
				</button>
			</div>

			{/* Divider */}
			<div style={{ height: 1, background: MANTLE_BORDER, margin: "0 16px" }} />

			{/* Network Card */}
			<div className="px-4 pt-3 pb-2">
				<p
					className="mb-2 text-[9px] font-semibold uppercase tracking-widest"
					style={{ color: MANTLE_TEXT_MUTED }}
				>
					Network
				</p>
				<div
					className="flex items-center gap-2.5 rounded-lg px-2.5 py-2"
					style={{
						background: "#0A1020",
						border: `1px solid ${MANTLE_BORDER_ACCENT}`,
					}}
				>
					<div
						className="size-1.5 shrink-0 rounded-full"
						style={{ background: MANTLE_GREEN }}
					/>
					<div className="flex min-w-0 flex-1 flex-col gap-0.5">
						<span
							className="text-[11px] font-semibold"
							style={{ color: MANTLE_TEXT_PRIMARY }}
						>
							Mantle Mainnet
						</span>
						<span className="text-[9px]" style={{ color: MANTLE_TEXT_MUTED }}>
							Chain ID: 5000
						</span>
					</div>
					<div
						className="rounded px-1.5 py-0.5 text-[8px] font-bold"
						style={{ background: `${MANTLE_GREEN}15`, color: MANTLE_GREEN }}
					>
						LIVE
					</div>
				</div>
			</div>

			{/* Capabilities */}
			<div className="px-4 pt-2 pb-2">
				<p
					className="mb-2 text-[9px] font-semibold uppercase tracking-widest"
					style={{ color: MANTLE_TEXT_MUTED }}
				>
					Capabilities
				</p>
				<div className="flex flex-col gap-1">
					{CAPABILITIES.map(({ icon: Icon, label }) => (
						<div
							key={label}
							className="flex items-center gap-2 rounded-md px-2 py-1.5"
							style={{ background: "#0F1A28" }}
						>
							<Icon className="size-3.5 shrink-0" style={{ color: MANTLE_BLUE }} />
							<span className="text-[11px]" style={{ color: MANTLE_TEXT_SECONDARY }}>
								{label}
							</span>
						</div>
					))}
				</div>
			</div>

			{/* Recent Sessions */}
			{recentSessions && recentSessions.length > 0 && (
				<>
					<div
						style={{ height: 1, background: MANTLE_BORDER, margin: "8px 16px" }}
					/>
					<div className="px-4 pb-4">
						<p
							className="mb-2 text-[9px] font-semibold uppercase tracking-widest"
							style={{ color: MANTLE_TEXT_MUTED }}
						>
							Recent Sessions
						</p>
						<div className="flex flex-col gap-1">
							{recentSessions.map((title, i) => (
								<div
									key={i}
									className="flex items-center gap-2 rounded-md px-2.5 py-1.5"
									style={{
										background: i === 0 ? `${MANTLE_BLUE}10` : "#0F1A28",
										border: i === 0 ? `1px solid ${MANTLE_BLUE}20` : "none",
									}}
								>
									<div
										className="size-1.5 shrink-0 rounded-full"
										style={{
											background: i === 0 ? MANTLE_BLUE : MANTLE_BORDER_ACCENT,
										}}
									/>
									<span
										className="truncate text-[10px]"
										style={{
											color: i === 0 ? MANTLE_BLUE : MANTLE_TEXT_MUTED,
										}}
									>
										{title}
									</span>
								</div>
							))}
						</div>
					</div>
				</>
			)}

			{/* Footer spacer */}
			<div className="flex-1" />

			{/* Bottom info */}
			<div
				className="px-4 py-3 text-[9px]"
				style={{
					color: MANTLE_TEXT_MUTED,
					borderTop: `1px solid ${MANTLE_BORDER}`,
				}}
			>
				Powered by Mastra + Claude
			</div>
		</aside>
	);
}
