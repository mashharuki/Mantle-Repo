# Mantle Network AI Agent — 実装計画書

## 概要

Mantle Network に特化した AI エージェントアプリケーション。  
Next.js 16 + Mastra フレームワークを基盤に、Mantle の全 10 スキル領域をカバーする 16 個のツールを実装し、チャット UI から自然言語でアクセスできる。

---

## 技術スタック

| 層 | 技術 |
|---|---|
| フロントエンド | Next.js 16 (App Router), React, Tailwind CSS v4 |
| AI フレームワーク | Mastra (`@mastra/core`, `@mastra/memory`, `@mastra/ai-sdk`) |
| AI SDK | AI SDK v6 (`ai`, `@ai-sdk/react`) |
| UI コンポーネント | shadcn/ui + AI Elements (`src/components/ai-elements/`) |
| 型チェック / フォーマット | TypeScript 5 (target ES2022), Biome |
| モデル | `google/gemini-2.5-pro`（Mastra モデルルーター経由） |
| メモリ永続化 | `@mastra/memory` (LibSQL ベース) + `localStorage` スレッド ID |

---

## ファイル構成

```
mantle-agent/
├── src/
│   ├── mastra/
│   │   ├── index.ts                        Mastra インスタンス初期化・エージェント登録
│   │   ├── agents/
│   │   │   └── mantle-agent.ts             Mantle エージェント定義（16 ツール束縛）
│   │   └── tools/
│   │       ├── network-primer-tool.ts      スキル①: チェーン基礎情報
│   │       ├── portfolio-tools.ts          スキル②: 残高・アローワンス
│   │       ├── address-registry-tools.ts   スキル③: アドレス解決・検証
│   │       ├── defi-tools.ts               スキル④: DeFi ベニュー・スワップ見積
│   │       ├── risk-evaluator-tool.ts      スキル⑤: 事前リスクチェック
│   │       ├── tx-simulator-tool.ts        スキル⑥: トランザクション模擬実行
│   │       ├── debugger-tool.ts            スキル⑦: RPC エラー診断
│   │       ├── data-indexer-tool.ts        スキル⑧: 過去データクエリ生成
│   │       ├── contract-developer-tools.ts スキル⑨: コントラクト設計検証
│   │       └── contract-deployer-tools.ts  スキル⑩: デプロイ前チェックリスト
│   ├── app/
│   │   ├── layout.tsx                      dark モード固定 + メタデータ
│   │   ├── page.tsx                        チャット UI（メインページ）
│   │   ├── globals.css                     Mantle ブランドカラー CSS 変数
│   │   └── api/
│   │       └── chat/
│   │           └── route.ts                AI SDK v6 ストリーミング API ルート
│   └── components/
│       └── ai-elements/                    AI チャット UI コンポーネント群
├── next.config.ts                          DuckDB native bindings 除外設定
├── tsconfig.json                           target: ES2022（BigInt 対応）
└── PLAN.md                                 本ファイル
```

---

## エージェント定義

### `mantle-agent.ts`

```typescript
export const mantleAgent = new Agent({
  id: "mantleAgent",
  name: "Mantle Network AI Agent",
  model: "google/gemini-2.5-pro",
  memory: new Memory(),
  tools: { /* 16 ツール全て */ },
  instructions: SYSTEM_PROMPT,
});
```

**システムプロンプト構成**:
1. **Identity** — Mantle L2 専門エージェント
2. **Mantle 絶対ルール** — ガストークンは MNT / チェーン ID 5000・5003 / スナップショット日明示
3. **Read-only 原則** — 状態変更トランザクションは絶対実行しない
4. **ツール活用指針** — DeFi → `getDeFiVenues` 先行、リスク評価 → 模擬実行の順
5. **ドメイン別動作** — 各スキルで使うツールの呼び出し順序を明示

---

## ツール一覧（16 個）

### スキル①: ネットワーク基礎情報

| ツール | 説明 |
|---|---|
| `getMantleNetworkInfo` | チェーン ID・RPC・ガストークン・L1/L2 コントラクト情報を静的データで返す。スナップショット日 2026-03-08 を常に明示 |

**入力**: `topic: enum(basics | mainnet | testnet | differences | contracts)`  
**特徴**: ネットワーク呼び出しなし、完全静的

---

### スキル②: ポートフォリオ分析

| ツール | 説明 |
|---|---|
| `getWalletBalance` | `eth_getBalance` + WMNT/USDT/USDC/WETH の `balanceOf` multicall |
| `getTokenAllowances` | 主要 DEX ルーターへの `allowance` 照会。`>= 2^255` → unlimited 判定 |

**RPC**: `MANTLE_RPC_MAINNET` 環境変数（デフォルト `https://rpc.mantle.xyz`）

---

### スキル③: アドレスレジストリ

| ツール | 説明 |
|---|---|
| `resolveContractAddress` | registry の 8 契約（Merchant Moe・Agni・Aave v3）を name/alias/label で検索 |
| `validateAddress` | EIP-55 チェックサム検証 + registry 照合 → pass / warn / fail 判定 |

**データソース**: TypeScript 定数としてインライン化（webpack バンドル問題を回避）

---

### スキル④: DeFi オペレーション

| ツール | 説明 |
|---|---|
| `getDeFiVenues` | Merchant Moe・Agni・Aave v3 のティア情報を返す（静的） |
| `getSwapQuote` | Agni QuoterV2 `eth_call` でスワップ見積もり取得 |
| `getLiquidityPools` | registry のプール・ポジションマネージャーエントリ一覧 |

---

### スキル⑤: リスク評価

| ツール | 説明 |
|---|---|
| `evaluateTransactionRisk` | 入力完全性・スリッページ・アドレス安全性・アローワンス・ガス・デッドライン の 6 項目チェック。any fail → block / any warn → warn / all pass → pass |

---

### スキル⑥: トランザクション模擬実行

| ツール | 説明 |
|---|---|
| `simulateTransaction` | Tenderly API 優先、フォールバックは `eth_estimateGas` + `eth_call`。WYSIWYS サマリーを生成。**実トランザクションは絶対送信しない** |

---

### スキル⑦: デバッガー

| ツール | 説明 |
|---|---|
| `debugRpcError` | エラーパターンマッチング（rate limit・revert・nonce・gas・insufficient funds・contract not found）。ネットワーク呼び出しなし |

---

### スキル⑧: データインデクサー

| ツール | 説明 |
|---|---|
| `queryHistoricalData` | wallet_swaps・pool_volume・wallet_activity・top_pools の GraphQL/SQL テンプレート生成。endpoint 指定時のみ実際の fetch を実行 |

---

### スキル⑨: コントラクト開発

| ツール | 説明 |
|---|---|
| `getContractTemplate` | ERC-20・ERC-721・ERC-1155・ガバナンス・ステーキング・マルチシグ の 6 テンプレートメタデータ |
| `validateContractArchitecture` | アクセス制御・アップグレーダビリティ・ガス最適化・セキュリティチェックリスト評価 |

---

### スキル⑩: コントラクトデプロイ

| ツール | 説明 |
|---|---|
| `getDeploymentChecklist` | デプロイ前全チェックリスト（コンパイル・監査・テスト・ガス・マルチシグ等） |
| `prepareDeploymentPackage` | 未署名デプロイパッケージ生成。`nextStep` は常に「外部署名者でブロードキャスト」 |

---

## API ルート

```typescript
// src/app/api/chat/route.ts
import { handleChatStream } from "@mastra/ai-sdk";
import { createUIMessageStreamResponse } from "ai";

export const runtime = "nodejs";  // LibSQL は Edge 非対応
export const maxDuration = 60;

export async function POST(req: Request) {
  const params = await req.json();
  const stream = await handleChatStream({
    mastra,
    agentId: "mantleAgent",
    params,
    version: "v6",  // AI SDK v6 ストリーム形式
  });
  return createUIMessageStreamResponse({ stream });
}
```

**ポイント**: `@mastra/ai-sdk` の `handleChatStream` を使い、AI SDK v6 形式でストリーミング。`params` に含まれる `memory.thread` / `memory.resource` がそのまま Mastra メモリへ渡る。

---

## UI 構成

### ページレイアウト

```
<div h-screen flex-col>
  <header>                        Mantle ロゴ + StatusDot（応答中/待機中）
  <Conversation flex-1>           スクロール可能な会話エリア
    <MantleEmptyState />           初期状態: 6 つのサジェストチップ
    {messages.map(MantleMessage)}  メッセージ一覧
    <ConversationScrollButton />
  <footer>                        PromptInput（入力エリア）
```

### `useChat` 設定（AI SDK v6）

```typescript
const transport = useMemo(() => new DefaultChatTransport({
  prepareSendMessagesRequest: ({ messages }) => ({
    body: {
      messages,
      memory: {
        thread: threadIdRef.current,  // localStorage から永続化
        resource: "user",
      },
    },
  }),
}), []);

const { messages, sendMessage, stop, status } = useChat({ transport });
```

### メモリ永続化フロー

```
ブラウザ起動
  → localStorage から threadId 取得（なければ nanoid で生成・保存）
  → useRef で最新値を追跡
  → sendMessage 時に memory.thread として API へ送信
  → Mastra Memory が LibSQL に会話履歴を保存
  → ページリフレッシュ後も同じ threadId で継続
```

### `MantleMessage` コンポーネント

- `part.type === "text"` → `MessageResponse`（ストリーミング時アニメーション）
- `part.type.startsWith("tool-")` → `MantleToolDisplay`（左ボーダー `#6BE2FF` のツールパネル）

---

## ブランドデザイン

| 要素 | 値 |
|---|---|
| プライマリカラー | `#6BE2FF`（Mantle Blue） |
| 背景 | `oklch(0.10 0 0)`（深いダーク） |
| カード | `oklch(0.14 0.005 250)` |
| ボーダー | `oklch(0.22 0.01 250 / 80%)` |
| テーマ | ダークモード固定（`<html class="dark">`） |

---

## 環境変数

```env
# 必須
GOOGLE_GENERATIVE_AI_API_KEY=

# 任意（デフォルト値あり）
MANTLE_RPC_MAINNET=https://rpc.mantle.xyz
MANTLE_RPC_TESTNET=https://rpc.sepolia.mantle.xyz

# 任意（Tenderly 模擬実行を有効化）
TENDERLY_ACCESS_KEY=
TENDERLY_ACCOUNT=
TENDERLY_PROJECT=

# 任意（Mastra Cloud 監視）
MASTRA_CLOUD_ACCESS_TOKEN=
```

---

## ビルド・起動手順

```bash
# 依存関係インストール
npm install

# 開発サーバー起動（Next.js + Mastra Studio）
npm run dev        # http://localhost:3000
# Mastra Studio:  http://localhost:4111

# 本番ビルド確認
npm run build

# コードフォーマット
bunx biome format --write .
```

---

## 実装上の重要決定事項

| 課題 | 決定 |
|---|---|
| DuckDB native bindings のバンドルエラー | `next.config.ts` で `serverExternalPackages` に `@duckdb/*` を追加 |
| Zod `.default()` フィールドの型問題 | `inputData.field ?? "default"` でフォールバック（デストラクチャリングを避ける） |
| AI SDK v6 `useChat` API 変更 | `api`/`body` オプション廃止 → `DefaultChatTransport` + `prepareSendMessagesRequest` |
| `append` の廃止 | `sendMessage({ text })` に変更 |
| Mastra `threadId`/`resourceId` 廃止 | `memory: { thread, resource }` に変更（`handleChatStream` が自動処理） |
| BigInt リテラル (`0n`) のコンパイルエラー | `tsconfig.json` の `target` を `ES2017` → `ES2022` に変更 |
| PromptInputController の API 変更 | `controller.setTextInput(v)` → `controller.textInput.setInput(v)` |
| `schema-display.tsx` の型エラー | `children as string \| undefined` キャストを追加 |

---

## 検証シナリオ

| # | 入力例 | 期待ツール | 期待結果 |
|---|---|---|---|
| 1 | "Mantle とは？" | `getMantleNetworkInfo` | chain ID 5000、ガストークン MNT |
| 2 | "0xDead...の残高は？" | `getWalletBalance` | MNT + ERC-20 トークン一覧 |
| 3 | "Merchant Moe のルーターアドレスは？" | `resolveContractAddress` | 検証済みアドレス + ソース URL |
| 4 | "1 WMNT → USDC の見積もり" | `getDeFiVenues` → `getSwapQuote` | 2 ステップで見積もり金額 |
| 5 | "スワップのリスクを評価して" | `evaluateTransactionRisk` | pass / warn / block 判定 |
| 6 | "rate limit exceeded エラーを診断" | `debugRpcError` | 診断 + 次のアクション |
| 7 | ページリフレッシュ後に続きの質問 | — | Memory が threadId で継続 |
| 8 | ツール呼び出し時の UI | — | `#6BE2FF` 左ボーダー付きパネル |
