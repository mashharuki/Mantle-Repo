import { MANTLE_BLUE } from "@/utils/constants";
import { prettifyToolName } from "@/utils/helpers";
import { ToolUIPart } from "ai";
import { Loader2 } from "lucide-react";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "../ai-elements/tool";

export function MantleToolDisplay({ part }: { part: ToolUIPart }) {
	const hasOutput =
		part.state === "output-available" || part.state === "output-error";
	const isRunning = !hasOutput && part.state !== "approval-requested" && part.state !== "approval-responded";
	return (
		<Tool
			className="my-2 border-l-2 bg-card"
			style={{ borderLeftColor: `${MANTLE_BLUE}40` }}
		>
			<div className="flex items-center gap-2">
				<ToolHeader
					type={part.type as `tool-${string}`}
					state={part.state}
					title={prettifyToolName(part.type)}
				/>
				{isRunning && (
					<Loader2
						className="size-3.5 animate-spin shrink-0"
						style={{ color: MANTLE_BLUE }}
					/>
				)}
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