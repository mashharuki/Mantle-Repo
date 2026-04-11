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
	type PromptInputMessage
} from "@/components/ai-elements/prompt-input";
import { MantleEmptyState } from "@/components/mantle/MantleEmptyState";
import { MantleMessage } from "@/components/mantle/MantleMessage";
import { MantlePromptArea } from "@/components/mantle/MantlePromptArea";
import { StatusDot } from "@/components/mantle/StatusDot";
import { useLocalStorageId } from "@/hooks/useLocalStorageId";
import { MANTLE_BLUE } from "@/utils/constants";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useState } from "react";

/**
 * Page コンポーネント
 * @returns 
 */
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

	// MantleEmptyState で提案がクリックされたときに、どの提案がクリックされたかを保存する state
	const [pendingSuggestion, setPendingSuggestion] = useState<string | null>(
		null,
	);

	// MantleEmptyState で提案がクリックされたときに pendingSuggestion に保存する
	const clearPending = useCallback(() => setPendingSuggestion(null), []);

	// ステータスが "streaming" または "submitted" のときはストリーミング中とみなす
	const isStreaming = status === "streaming" || status === "submitted";

	/**
	 * PromptInput の onSubmit ハンドラー
	 * - 空白のみの入力は無視
	 * - 送信前にトリムする
	 * - 送信後は PromptInput 内で自動的に入力がクリアされる
	 */
	const handleSubmit = useCallback(
		(message: PromptInputMessage) => {
			const text = message.text.trim();
			if (!text) return;
			sendMessage({ text });
		},
		[sendMessage],
	);

	/**
	 * MantleEmptyState の提案をクリックしたときのハンドラー
	 * - クリックされた提案を pendingSuggestion として保存
	 * - MantlePromptArea に渡して表示させる
	 * - ユーザーが送信するか、入力を変更するなどして提案が消費されたら pendingSuggestion をクリアする
	 */
	const handleSuggestionClick = useCallback((s: string) => {
		setPendingSuggestion(s);
	}, []);

	return (
		<div className="flex h-screen flex-col overflow-hidden bg-background">
			{/* Header */}
			<header
				className="flex shrink-0 items-center gap-3 border-b px-5 py-3"
				style={{ borderBottomColor: `${MANTLE_BLUE}20` }}
			>
				<div
					className="flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
					style={{
						background: `linear-gradient(135deg, ${MANTLE_BLUE}20, ${MANTLE_BLUE}08)`,
						border: `1px solid ${MANTLE_BLUE}30`,
						color: MANTLE_BLUE,
					}}
				>
					M
				</div>
				<div className="flex-1 min-w-0">
					<span
						className="text-sm font-semibold"
						style={{ color: MANTLE_BLUE }}
					>
						Mantle AI Agent
					</span>
					<span className="ml-2 text-xs text-muted-foreground">
						Mainnet · Sepolia · DeFi · Contracts
					</span>
				</div>
				<StatusDot status={status} />
			</header>

			{/* Conversation */}
			<Conversation className="flex-1">
				<ConversationContent className="space-y-4 px-4 py-6 max-w-3xl mx-auto w-full">
					{messages.length === 0 ? (
						<MantleEmptyState onSuggestionClick={handleSuggestionClick} />
					) : (
						messages.map((message) => (
							<MantleMessage
								key={message.id}
								message={message}
								isStreaming={isStreaming}
							/>
						))
					)}
				</ConversationContent>
				<ConversationScrollButton />
			</Conversation>

			{/* Input */}
			<div
				className="shrink-0 border-t px-4 py-3"
				style={{ borderTopColor: `${MANTLE_BLUE}20` }}
			>
				<div className="max-w-3xl mx-auto">
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
									style={{ backgroundColor: MANTLE_BLUE, color: "#000" }}
								/>
							</PromptInputFooter>
						</PromptInput>
					</PromptInputProvider>
				</div>
			</div>
		</div>
	);
}
