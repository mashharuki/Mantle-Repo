import { mastra } from "@/mastra";
import { handleChatStream } from "@mastra/ai-sdk";
import { createUIMessageStreamResponse } from "ai";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
	try {
		const params = await req.json();
		const { userWalletAddress, ...rest } = params;

		// Inject client wallet address as additional system context so the agent
		// can pass it automatically as `fromAddress` in write-tool calls.
		const enrichedParams = userWalletAddress
			? {
					...rest,
					resourceId: rest.resourceId ?? "user",
					threadId: rest.threadId ?? rest.memory?.thread,
					runtimeContext: {
						...(rest.runtimeContext ?? {}),
						userWalletAddress,
					},
				}
			: rest;

		const stream = await handleChatStream({
			mastra,
			agentId: "mantleAgent",
			params: enrichedParams,
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
