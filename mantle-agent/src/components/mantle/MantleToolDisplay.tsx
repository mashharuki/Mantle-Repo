import { MANTLE_BLUE } from "@/utils/constants";
import { prettifyToolName } from "@/utils/helpers";
import { ToolUIPart } from "ai";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "../ai-elements/tool";

export function MantleToolDisplay({ part }: { part: ToolUIPart }) {
	const hasOutput =
		part.state === "output-available" || part.state === "output-error";
	return (
		<Tool
			className="my-2 border-l-2 bg-card"
			style={{ borderLeftColor: `${MANTLE_BLUE}40` }}
		>
			<ToolHeader
				type={part.type as `tool-${string}`}
				state={part.state}
				title={prettifyToolName(part.type)}
			/>
			<ToolContent>
				<ToolInput input={part.input} />
				{hasOutput && (
					<ToolOutput output={part.output} errorText={part.errorText} />
				)}
			</ToolContent>
		</Tool>
	);
}