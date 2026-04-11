"use client";

import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
	Message,
	MessageActions,
	MessageAction,
	MessageContent,
	MessageResponse,
} from "@/components/ai-elements/message";
import {
	PromptInput,
	PromptInputBody,
	PromptInputFooter,
	PromptInputProvider,
	PromptInputSubmit,
	PromptInputTextarea,
	usePromptInputController,
	type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import {
	Tool,
	ToolContent,
	ToolHeader,
	ToolInput,
	ToolOutput,
} from "@/components/ai-elements/tool";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type ToolUIPart, type UIMessage } from "ai";
import { CopyIcon } from "lucide-react";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ─── Mantle brand colour ──────────────────────────────────────────────────────
const MANTLE_BLUE = "#6BE2FF";

// ─── Persistent thread ID ────────────────────────────────────────────────────
function useLocalStorageId(key: string): string {
	const [id, setId] = useState<string>("");
	useEffect(() => {
		let stored = localStorage.getItem(key);
		if (!stored) {
			stored = nanoid();
			localStorage.setItem(key, stored);
		}
		setId(stored);
	}, [key]);
	return id;
}

// ─── Suggestion list ──────────────────────────────────────────────────────────
const SUGGESTIONS = [
	"Mantle Network の基本を教えてください",
	"Merchant Moe のルーターアドレスは？",
	"Mantle の DeFi プロトコル一覧を見せて",
	"1 WMNT → USDC のスワップ見積もり",
	"スワップのリスク評価をしてください",
	"コントラクトデプロイのチェックリスト",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function prettifyToolName(raw: string): string {
	return raw
		.replace(/^tool-/, "")
		.replace(/([A-Z])/g, " $1")
		.replace(/[-_]/g, " ")
		.trim()
		.replace(/^./, (c) => c.toUpperCase());
}

function extractText(message: UIMessage): string {
	return message.parts
		.filter((p) => p.type === "text")
		.map((p) => (p as { type: "text"; text: string }).text)
		.join("\n");
}

// ─── Tool display ─────────────────────────────────────────────────────────────
function MantleToolDisplay({ part }: { part: ToolUIPart }) {
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

// ─── Single message ───────────────────────────────────────────────────────────
function MantleMessage({
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

// ─── Empty state ──────────────────────────────────────────────────────────────
function MantleEmptyState({
	onSuggestionClick,
}: {
	onSuggestionClick: (s: string) => void;
}) {
	return (
		<div className="flex h-full flex-col items-center justify-center gap-8 px-4 py-16 text-center">
			<div className="flex flex-col items-center gap-3">
				<div
					className="flex size-14 items-center justify-center rounded-2xl text-2xl font-bold"
					style={{
						background: `linear-gradient(135deg, ${MANTLE_BLUE}20, ${MANTLE_BLUE}08)`,
						border: `1px solid ${MANTLE_BLUE}30`,
						color: MANTLE_BLUE,
					}}
				>
					M
				</div>
				<div>
					<h1 className="text-xl font-semibold" style={{ color: MANTLE_BLUE }}>
						Mantle AI Agent
					</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						DeFi・コントラクト・ポートフォリオ分析・デバッグ
					</p>
				</div>
			</div>
			<div className="w-full max-w-xl">
				<p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
					試してみる
				</p>
				<Suggestions className="flex-wrap justify-center gap-2">
					{SUGGESTIONS.map((s) => (
						<Suggestion
							key={s}
							suggestion={s}
							onClick={onSuggestionClick}
							className="text-xs"
						/>
					))}
				</Suggestions>
			</div>
		</div>
	);
}

// ─── Prompt area (requires PromptInputController context) ─────────────────────
function MantlePromptArea({
	pendingSuggestion,
	onPendingSuggestionConsumed,
}: {
	pendingSuggestion: string | null;
	onPendingSuggestionConsumed: () => void;
}) {
	const controller = usePromptInputController();

	useEffect(() => {
		if (pendingSuggestion) {
			controller.textInput.setInput(pendingSuggestion);
			onPendingSuggestionConsumed();
		}
	}, [pendingSuggestion, controller, onPendingSuggestionConsumed]);

	return (
		<PromptInputBody>
			<PromptInputTextarea placeholder="Mantle について質問してください…" />
		</PromptInputBody>
	);
}

// ─── Status dot ───────────────────────────────────────────────────────────────
function StatusDot({ status }: { status: string }) {
	const isActive = status === "submitted" || status === "streaming";
	return (
		<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
			<div
				className={`size-2 rounded-full transition-colors ${isActive ? "animate-pulse" : ""}`}
				style={{ backgroundColor: isActive ? MANTLE_BLUE : "oklch(0.30 0 0)" }}
			/>
			{isActive ? (
				<span style={{ color: MANTLE_BLUE }}>応答中…</span>
			) : (
				<span>待機中</span>
			)}
		</div>
	);
}

// ─── Root page ────────────────────────────────────────────────────────────────
export default function Page() {
	const threadId = useLocalStorageId("mantle-thread-id");
	const threadIdRef = useRef(threadId);
	useEffect(() => {
		threadIdRef.current = threadId;
	}, [threadId]);

	const transport = useMemo(
		() =>
			new DefaultChatTransport({
				prepareSendMessagesRequest: ({ messages }) => ({
					body: {
						messages,
						memory: {
							thread: threadIdRef.current,
							resource: "user",
						},
					},
				}),
			}),
		[],
	);

	const { messages, sendMessage, stop, status } = useChat({ transport });

	const [pendingSuggestion, setPendingSuggestion] = useState<string | null>(
		null,
	);
	const clearPending = useCallback(() => setPendingSuggestion(null), []);

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

	const isStreaming = status === "streaming" || status === "submitted";

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
