import { extractText } from "@/utils/helpers";
import { ToolUIPart, UIMessage } from "ai";
import { CopyIcon } from "lucide-react";
import { useCallback } from "react";
import { Message, MessageAction, MessageActions, MessageContent, MessageResponse } from "../ai-elements/message";
import { MantleToolDisplay } from "./MantleToolDisplay";

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

	return (
		<Message from={message.role}>
			<MessageContent>
				{message.parts.map((part, i) => {
					if (part.type === "text") {
						return (
							<MessageResponse
								key={i}
								isAnimating={isStreaming && message.role === "assistant"}
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
			{message.role === "assistant" && (
				<MessageActions>
					<MessageAction label="Copy" tooltip="Copy" onClick={handleCopy}>
						<CopyIcon className="size-3.5" />
					</MessageAction>
				</MessageActions>
			)}
		</Message>
	);
}