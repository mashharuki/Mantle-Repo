import { MANTLE_BLUE } from "@/utils/constants";

/**
 * submitted 状態（送信後・最初のトークン到達前）に表示する
 * ローディングインジケーター。3つのドットがバウンスアニメーションする。
 */
export function MantleThinkingIndicator() {
	return (
		<div className="flex items-start gap-3">
			<div
				className="flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold select-none"
				style={{
					background: `linear-gradient(135deg, ${MANTLE_BLUE}20, ${MANTLE_BLUE}08)`,
					border: `1px solid ${MANTLE_BLUE}30`,
					color: MANTLE_BLUE,
				}}
			>
				M
			</div>
			<div
				className="flex items-center gap-1.5 rounded-2xl px-4 py-3"
				style={{
					background: `${MANTLE_BLUE}08`,
					border: `1px solid ${MANTLE_BLUE}18`,
				}}
			>
				{[0, 1, 2].map((i) => (
					<span
						key={i}
						className="block size-1.5 rounded-full animate-bounce"
						style={{
							backgroundColor: MANTLE_BLUE,
							opacity: 0.7,
							animationDelay: `${i * 150}ms`,
						}}
					/>
				))}
			</div>
		</div>
	);
}
