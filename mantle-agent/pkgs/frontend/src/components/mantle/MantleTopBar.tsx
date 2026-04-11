"use client";

import {
    MANTLE_BLUE,
    MANTLE_BORDER,
    MANTLE_GREEN,
    MANTLE_ORANGE,
    MANTLE_SIDEBAR_BG,
    MANTLE_TEXT_MUTED,
    MANTLE_TEXT_PRIMARY
} from "@/utils/constants";
import { ZapIcon } from "lucide-react";

export function MantleTopBar({
	sessionTitle,
	status,
}: {
	sessionTitle: string;
	status: string;
}) {
	const isActive = status === "streaming" || status === "submitted";

	return (
		<header
			className="flex h-14 shrink-0 items-center gap-3 px-5"
			style={{
				background: MANTLE_SIDEBAR_BG,
				borderBottom: `1px solid ${MANTLE_BORDER}`,
			}}
		>
			{/* Breadcrumb */}
			<div className="flex min-w-0 flex-1 items-center gap-1.5">
				<span
					className="text-sm"
					style={{ color: MANTLE_TEXT_MUTED, fontVariantLigatures: "none" }}
				>
					Mantle
				</span>
				<span className="text-sm" style={{ color: MANTLE_BORDER }}>
					/
				</span>
				<span
					className="truncate text-sm font-semibold"
					style={{ color: MANTLE_TEXT_PRIMARY }}
				>
					{sessionTitle || "New Session"}
				</span>
			</div>

			{/* Badges */}
			<div className="flex shrink-0 items-center gap-2">
				{/* Gas badge */}
				<div
					className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold"
					style={{
						background: `${MANTLE_ORANGE}10`,
						borderColor: `${MANTLE_ORANGE}30`,
						color: MANTLE_ORANGE,
					}}
				>
					<ZapIcon className="size-3" />
					Gas: MNT
				</div>

				{/* Status badge */}
				{isActive ? (
					<div
						className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold"
						style={{
							background: `${MANTLE_BLUE}12`,
							borderColor: `${MANTLE_BLUE}35`,
							color: MANTLE_BLUE,
						}}
					>
						<span
							className="size-1.5 rounded-full"
							style={{ background: MANTLE_BLUE }}
						/>
						Processing...
					</div>
				) : (
					<div
						className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold"
						style={{
							background: `${MANTLE_GREEN}10`,
							borderColor: `${MANTLE_GREEN}30`,
							color: MANTLE_GREEN,
						}}
					>
						<span
							className="size-1.5 rounded-full"
							style={{ background: MANTLE_GREEN }}
						/>
						Ready
					</div>
				)}
			</div>
		</header>
	);
}
