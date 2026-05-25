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

function toUserFriendlyError(err: Error): { title: string; detail: string } {
	const msg = err.message ?? "";
	if (
		msg.includes("RESOURCE_EXHAUSTED") ||
		msg.includes("prepayment credits") ||
		msg.includes("429")
	) {
		return {
			title: "APIクレジット不足",
			detail:
				"Google AI Studio の利用クレジットが不足しています。https://ai.studio/projects でプランを確認してください。",
		};
	}
	if (
		msg.includes("503") ||
		msg.includes("SERVICE_UNAVAILABLE") ||
		msg.includes("overloaded")
	) {
		return {
			title: "AIサービスが混雑中",
			detail:
				"現在 AI サービスが一時的に過負荷状態です。しばらく待ってから再度お試しください。",
		};
	}
	if (
		msg.includes("401") ||
		msg.includes("UNAUTHENTICATED") ||
		msg.includes("API key")
	) {
		return {
			title: "認証エラー",
			detail:
				"AIサービスの認証に失敗しました。APIキーが正しく設定されているか確認してください。",
		};
	}
	if (msg.includes("timeout") || msg.includes("DEADLINE_EXCEEDED")) {
		return {
			title: "タイムアウト",
			detail:
				"応答の取得中にタイムアウトが発生しました。しばらく待ってから再度お試しください。",
		};
	}
	if (
		msg.includes("fetch") ||
		msg.includes("network") ||
		msg.includes("Failed to fetch")
	) {
		return {
			title: "ネットワークエラー",
			detail:
				"サーバーへの接続に失敗しました。ネットワーク接続を確認してください。",
		};
	}
	return {
		title: "エラーが発生しました",
		detail:
			"予期しないエラーが発生しました。ページを再読み込みして再度お試しください。",
	};
}

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

	const { messages, sendMessage, stop, status, error } = useChat({ transport });

	const [pendingSuggestion, setPendingSuggestion] = useState<string | null>(
		null,
	);
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
			<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
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
						{error &&
							(() => {
								const { title, detail } = toUserFriendlyError(error);
								return (
									<div
										className="rounded-lg border px-4 py-3 text-sm"
										style={{
											background: "rgba(255, 59, 48, 0.08)",
											borderColor: "rgba(255, 59, 48, 0.35)",
											color: "#FF6B6B",
										}}
									>
										<p className="font-semibold mb-1">⚠ {title}</p>
										<p style={{ color: "#FFAAAA" }}>{detail}</p>
									</div>
								);
							})()}
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
