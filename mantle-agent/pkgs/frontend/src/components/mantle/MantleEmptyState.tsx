import {
  MANTLE_BLUE,
  MANTLE_BORDER,
  MANTLE_CARD_BG,
  MANTLE_GREEN,
  MANTLE_ORANGE,
  MANTLE_TEXT_MUTED,
  MANTLE_TEXT_PRIMARY,
  MANTLE_TEXT_SECONDARY,
  SUGGESTIONS,
} from "@/utils/constants";
import {
  ArrowLeftRightIcon,
  BookOpenIcon,
  CodeIcon,
  MapPinIcon,
  ShieldCheckIcon,
  TerminalIcon,
  TrendingUpIcon,
} from "lucide-react";

const SUGGESTION_CARDS = [
	{ icon: BookOpenIcon, label: SUGGESTIONS[0], color: MANTLE_BLUE },
	{ icon: MapPinIcon, label: SUGGESTIONS[1], color: MANTLE_BLUE },
	{ icon: TrendingUpIcon, label: SUGGESTIONS[2], color: MANTLE_ORANGE },
	{ icon: ArrowLeftRightIcon, label: SUGGESTIONS[3], color: MANTLE_GREEN },
	{ icon: ShieldCheckIcon, label: SUGGESTIONS[4], color: MANTLE_ORANGE },
	{ icon: CodeIcon, label: SUGGESTIONS[5], color: MANTLE_BLUE },
] as const;

export function MantleEmptyState({
	onSuggestionClick,
}: {
	onSuggestionClick: (s: string) => void;
}) {
	return (
		<div className="flex h-full flex-col items-center justify-center gap-6 px-4 py-16 text-center">
			{/* Hero icon with glow */}
			<div className="relative flex flex-col items-center gap-4">
				<div
					className="absolute -inset-16 rounded-full"
					style={{
						background: `radial-gradient(circle, ${MANTLE_BLUE}12 0%, transparent 70%)`,
					}}
					aria-hidden="true"
				/>
				<div
					className="relative flex size-16 items-center justify-center rounded-2xl"
					style={{
						background: `${MANTLE_BLUE}12`,
						border: `1px solid ${MANTLE_BLUE}35`,
						boxShadow: `0 0 28px ${MANTLE_BLUE}18`,
					}}
				>
					<TerminalIcon className="size-7" style={{ color: MANTLE_BLUE }} />
				</div>
				<div>
					<h1
						className="text-xl font-bold tracking-tight"
						style={{ color: MANTLE_TEXT_PRIMARY }}
					>
						Mantle AI Agent
					</h1>
					<p className="mt-1 text-sm" style={{ color: MANTLE_TEXT_MUTED }}>
						DeFi · Contracts · Portfolio · Risk · Analytics
					</p>
				</div>
			</div>
			{/* Divider */}
			<div className="flex w-full max-w-xl items-center gap-3">
				<div className="h-px flex-1" style={{ background: MANTLE_BORDER }} />
				<span
					className="text-[10px] uppercase tracking-widest"
					style={{ color: MANTLE_TEXT_MUTED }}
				>
					試してみる
				</span>
				<div className="h-px flex-1" style={{ background: MANTLE_BORDER }} />
			</div>
			{/* 2×3 suggestion grid */}
			<div className="grid w-full max-w-xl grid-cols-2 gap-2">
				{SUGGESTION_CARDS.map(({ icon: Icon, label, color }) => (
					<button
						key={label}
						type="button"
						onClick={() => onSuggestionClick(label)}
						className="flex items-start gap-3 rounded-xl px-3 py-3 text-left transition-all hover:brightness-110 active:scale-[0.98]"
						style={{
							background: MANTLE_CARD_BG,
							border: `1px solid ${MANTLE_BORDER}`,
						}}
					>
						<div
							className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md"
							style={{
								background: `${color}14`,
								border: `1px solid ${color}28`,
							}}
						>
							<Icon className="size-3.5" style={{ color }} />
						</div>
						<span
							className="text-xs leading-relaxed"
							style={{ color: MANTLE_TEXT_SECONDARY }}
						>
							{label}
						</span>
					</button>
				))}
			</div>
		</div>
	);
}