import { MANTLE_BLUE } from "@/utils/constants";
import { extractText } from "@/utils/helpers";
import { ToolUIPart, UIMessage } from "ai";
import { CopyIcon, TerminalIcon } from "lucide-react";
import { useCallback } from "react";
import {
	Message,
	MessageAction,
	MessageActions,
	MessageContent,
	MessageResponse,
} from "../ai-elements/message";
import { MantleToolDisplay } from "./MantleToolDisplay";

function TerminalAvatar() {
	return (
		<div
			className="flex size-7 shrink-0 items-center justify-center rounded-md"
			style={{
				background: `${MANTLE_BLUE}18`,
				border: `1px solid ${MANTLE_BLUE}28`,
				color: MANTLE_BLUE,
			}}
		>
			<TerminalIcon className="size-3.5" />
		</div>
	);
}

export function MantleMessage({
	message,
	isStreaming,
}: {
	message: UIMessage;
	isStreaming: boolean;
}) {
	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(extractText(message));
		} catch {
			// ignore
		}
	}, [message]);

	if (message.role === "assistant") {
		return (
			<div className="flex items-start gap-2.5">
				<TerminalAvatar />
				<Message from={message.role}>
					<MessageContent>
						{message.parts.map((part, i) => {
							if (part.type === "text") {
								return (
									<MessageResponse
										key={i}
										isAnimating={isStreaming}
									>
										{part.text}
									</MessageResponse>
								);
							}
							if (part.type.startsWith("tool-")) {
								return <MantleToolDisplay key={i} part={part as ToolUIPart} />;
							}
							return null;
						})}
					</MessageContent>
					<MessageActions>
						<MessageAction label="Copy" tooltip="Copy" onClick={handleCopy}>
							<CopyIcon className="size-3.5" />
						</MessageAction>
					</MessageActions>
				</Message>
			</div>
		);
	}

	return (
		<Message from={message.role}>
			<MessageContent>
				{message.parts.map((part, i) => {
					if (part.type === "text") {
						return (
							<MessageResponse key={i} isAnimating={false}>
								{part.text}
							</MessageResponse>
						);
					}
					return null;
				})}
			</MessageContent>
		</Message>
	);
}