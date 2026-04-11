import { MANTLE_BLUE, MANTLE_GREEN } from "@/utils/constants";
import { prettifyToolName } from "@/utils/helpers";
import { ToolUIPart } from "ai";
import { Loader2 } from "lucide-react";
import {
	Tool,
	ToolContent,
	ToolInput,
	ToolOutput,
} from "../ai-elements/tool";

function StatusBadge({ state }: { state: ToolUIPart["state"] }) {
	const isDone = state === "output-available";
	const isError = state === "output-error";

	if (isError) {
		return (
			<span
				className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
				style={{
					background: "#FF4D6415",
					color: "#FF4D64",
					border: "1px solid #FF4D6430",
				}}
			>
				ERROR
			</span>
		);
	}
	if (isDone) {
		return (
			<span
				className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
				style={{
					background: `${MANTLE_GREEN}15`,
					color: MANTLE_GREEN,
					border: `1px solid ${MANTLE_GREEN}30`,
				}}
			>
				DONE
			</span>
		);
	}
	return (
		<span
			className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
			style={{
				background: `${MANTLE_BLUE}15`,
				color: MANTLE_BLUE,
				border: `1px solid ${MANTLE_BLUE}25`,
			}}
		>
			<Loader2 className="size-2.5 animate-spin" />
			RUNNING
		</span>
	);
}

export function MantleToolDisplay({ part }: { part: ToolUIPart }) {
	const hasOutput =
		part.state === "output-available" || part.state === "output-error";
	return (
		<Tool
			className="my-2 overflow-hidden"
			style={{
				borderRadius: 8,
				background: "#080F1A",
				border: `1px solid ${MANTLE_BLUE}20`,
				borderLeft: `3px solid ${MANTLE_BLUE}55`,
			}}
		>
			<div
				className="flex items-center gap-2 px-3 py-2"
				style={{ borderBottom: `1px solid ${MANTLE_BLUE}18` }}
			>
				<span
					className="text-[9px] font-bold uppercase tracking-widest"
					style={{ color: MANTLE_BLUE, opacity: 0.6 }}
				>
					Tool Call
				</span>
				<span
					className="text-xs font-semibold"
					style={{ color: "#C8D8E8" }}
				>
					{prettifyToolName(part.type)}
				</span>
				<div className="flex-1" />
				<StatusBadge state={part.state} />
			</div>
			<ToolContent>
				<ToolInput input={part.input} />
				{hasOutput && (
					<ToolOutput output={part.output} errorText={part.errorText} />
				)}
			</ToolContent>
		</Tool>
	);
}