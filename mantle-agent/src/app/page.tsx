"use client";

import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
	PromptInput,
	PromptInputFooter,
	PromptInputProvider,
	PromptInputSubmit,
	type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { MantleEmptyState } from "@/components/mantle/MantleEmptyState";
import { MantleMessage } from "@/components/mantle/MantleMessage";
import { MantlePromptArea } from "@/components/mantle/MantlePromptArea";
import { MantleSidebar } from "@/components/mantle/MantleSidebar";
import { MantleThinkingIndicator } from "@/components/mantle/MantleThinkingIndicator";
import { MantleTopBar } from "@/components/mantle/MantleTopBar";
import { useLocalStorageId } from "@/hooks/useLocalStorageId";
import { MANTLE_BLUE, MANTLE_BORDER, MANTLE_DARK_BG } from "@/utils/constants";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useMemo, useState } from "react";

export default function Page() {
	const threadId = useLocalStorageId("mantle-thread-id");

	const [transport] = useState(
		() =>
			new DefaultChatTransport({
				prepareSendMessagesRequest: ({ messages }) => ({
					body: {
						messages,
						memory: {
							thread: threadId,
							resource: "user",
						},
					},
				}),
			}),
	);

	const { messages, sendMessage, stop, status } = useChat({ transport });

	const [pendingSuggestion, setPendingSuggestion] = useState<string | null>(null);
	const clearPending = useCallback(() => setPendingSuggestion(null), []);
	const isStreaming = status === "streaming" || status === "submitted";

	// セッションタイトル = 最初のユーザーメッセージ（先頭30文字）
	const sessionTitle = useMemo(() => {
		const first = messages.find((m) => m.role === "user");
		if (!first) return "";
		const text = first.parts
			.filter((p) => p.type === "text")
			.map((p) => p.text)
			.join("")
			.trim();
		return text.length > 30 ? `${text.slice(0, 30)}…` : text;
	}, [messages]);

	const handleSubmit = useCallback(
		(message: PromptInputMessage) => {
			const text = message.text.trim();
			if (!text) return;
			sendMessage({ text });
		},
		[sendMessage],
	);

	const handleSuggestionClick = useCallback((s: string) => {
		setPendingSuggestion(s);
	}, []);

	const handleNewSession = useCallback(() => {
		window.location.reload();
	}, []);

	return (
		<div
			className="flex h-screen overflow-hidden"
			style={{ background: MANTLE_DARK_BG }}
		>
			{/* Left Sidebar */}
			<MantleSidebar
				sessionTitle={sessionTitle || undefined}
				recentSessions={sessionTitle ? [sessionTitle] : undefined}
				onNewSession={handleNewSession}
			/>

			{/* Main area */}
			<div
				className="flex min-w-0 flex-1 flex-col overflow-hidden"
			>
				{/* Top bar */}
				<MantleTopBar sessionTitle={sessionTitle} status={status} />

				{/* Conversation */}
				<Conversation className="flex-1">
					<ConversationContent className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
						{messages.length === 0 ? (
							<MantleEmptyState onSuggestionClick={handleSuggestionClick} />
						) : (
							messages.map((message, index) => (
								<MantleMessage
									key={message.id}
									message={message}
									isStreaming={isStreaming && index === messages.length - 1}
								/>
							))
						)}
						{status === "submitted" && <MantleThinkingIndicator />}
					</ConversationContent>
					<ConversationScrollButton />
				</Conversation>

				{/* Input area */}
				<div
					className="shrink-0 px-4 py-3"
					style={{ borderTop: `1px solid ${MANTLE_BORDER}` }}
				>
					<div className="mx-auto max-w-3xl">
						<PromptInputProvider>
							<PromptInput onSubmit={handleSubmit}>
								<MantlePromptArea
									pendingSuggestion={pendingSuggestion}
									onPendingSuggestionConsumed={clearPending}
								/>
								<PromptInputFooter>
									<div className="flex-1" />
									<PromptInputSubmit
										status={status}
										onStop={stop}
										style={{ backgroundColor: MANTLE_BLUE, color: "#080B12" }}
									/>
								</PromptInputFooter>
							</PromptInput>
						</PromptInputProvider>
					</div>
				</div>
			</div>
		</div>
	);
}
