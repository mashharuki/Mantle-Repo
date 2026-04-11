import { MANTLE_BLUE } from "@/utils/constants";
import { TerminalIcon } from "lucide-react";

/**
 * submitted 状態（送信後・最初のトークン到達前）に表示する
 * ローディングインジケーター。3つのドットがバウンスアニメーションする。
 */
export function MantleThinkingIndicator() {
	return (
		<div className="flex items-start gap-2.5">
			<div
				className="flex size-7 shrink-0 items-center justify-center rounded-md select-none"
				style={{
					background: `${MANTLE_BLUE}18`,
					border: `1px solid ${MANTLE_BLUE}28`,
					color: MANTLE_BLUE,
				}}
			>
				<TerminalIcon className="size-3.5" />
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
