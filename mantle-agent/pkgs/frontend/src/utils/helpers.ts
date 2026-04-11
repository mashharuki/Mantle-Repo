import { UIMessage } from "ai";

export function prettifyToolName(raw: string): string {
	return raw
		.replace(/^tool-/, "")
		.replace(/([A-Z])/g, " $1")
		.replace(/[-_]/g, " ")
		.trim()
		.replace(/^./, (c) => c.toUpperCase());
}

export function extractText(message: UIMessage): string {
	return message.parts
		.filter((p) => p.type === "text")
		.map((p) => (p as { type: "text"; text: string }).text)
		.join("\n");
}