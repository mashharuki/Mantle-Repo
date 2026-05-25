import { mastra } from "@/mastra";
import { handleChatStream } from "@mastra/ai-sdk";
import { createUIMessageStreamResponse } from "ai";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
	try {
		const params = await req.json();
		const stream = await handleChatStream({
			mastra,
			agentId: "mantleAgent",
			params,
			version: "v6",
		});
		return createUIMessageStreamResponse({ stream });
	} catch (err) {
		console.error("[chat/route] Error:", err);
		const message =
			err instanceof Error ? err.message : "An unexpected error occurred";
		return new Response(JSON.stringify({ error: message }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
