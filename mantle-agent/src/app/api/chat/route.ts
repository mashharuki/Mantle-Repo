import { handleChatStream } from "@mastra/ai-sdk";
import { createUIMessageStreamResponse } from "ai";
import { mastra } from "@/mastra";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
	const params = await req.json();
	const stream = await handleChatStream({
		mastra,
		agentId: "mantleAgent",
		params,
		version: "v6",
	});
	return createUIMessageStreamResponse({ stream });
}
