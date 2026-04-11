import { MANTLE_BLUE } from "@/utils/constants";

export function StatusDot({ status }: { status: string }) {
	const isActive = status === "submitted" || status === "streaming";
	return (
		<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
			<div
				className={`size-2 rounded-full transition-colors ${isActive ? "animate-pulse" : ""}`}
				style={{ backgroundColor: isActive ? MANTLE_BLUE : "oklch(0.30 0 0)" }}
			/>
			{isActive ? (
				<span style={{ color: MANTLE_BLUE }}>応答中…</span>
			) : (
				<span>待機中</span>
			)}
		</div>
	);
}