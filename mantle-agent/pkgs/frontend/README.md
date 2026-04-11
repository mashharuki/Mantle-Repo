# Mantle Network AI Agent

Mantle Network に特化した AI エージェントアプリケーション。  
自然言語チャットを通じて、ネットワーク情報の取得・ウォレット残高照会・DeFi スワップ見積・リスク評価・トランザクション模擬実行など、Mantle エコシステムのあらゆる操作を支援します。

---

## 概要

| 項目 | 内容 |
|---|---|
| 対象チェーン | Mantle Mainnet (Chain ID: 5000) / Sepolia Testnet (Chain ID: 5003) |
| ガストークン | MNT |
| AI モデル | Google Gemini 3.1 Flash Lite Preview（Mastra モデルルーター経由） |
| アーキテクチャ | Next.js 16 App Router + Mastra Agent Framework |
| 読み取り専用原則 | 状態変更トランザクションは一切実行しない（外部署名者へのハンドオフのみ） |

---

## 技術スタック

| 層 | 技術 |
|---|---|
| フロントエンド | Next.js 16 (App Router), React, Tailwind CSS v4 |
| AI フレームワーク | Mastra (`@mastra/core`, `@mastra/memory`, `@mastra/ai-sdk`) |
| AI SDK | AI SDK v6 (`ai`, `@ai-sdk/react`) |
| UI コンポーネント | shadcn/ui + AI Elements (`src/components/ai-elements/`) |
| 型チェック | TypeScript 5 (target ES2022) |
| フォーマッター | Biome |
| メモリ永続化 | `@mastra/memory` (LibSQL) + `localStorage` スレッド ID |

---

## 機能一覧

### スキル① — ネットワーク基礎情報

| ツール | 説明 |
|---|---|
| `getMantleNetworkInfo` | チェーン ID・RPC・ガストークン・L1/L2 コントラクト情報を返す（静的データ、スナップショット日 2026-03-08） |

### スキル② — ポートフォリオ分析

| ツール | 説明 |
|---|---|
| `getWalletBalance` | MNT ネイティブ残高 + WMNT/USDT/USDC/WETH の `balanceOf` Multicall |
| `getTokenAllowances` | 主要 DEX ルーターへの `allowance` 照会。`>= 2^255` → unlimited と判定 |

### スキル③ — アドレスレジストリ

| ツール | 説明 |
|---|---|
| `resolveContractAddress` | Merchant Moe・Agni・Aave v3 等 8 契約を name / alias / label で検索 |
| `validateAddress` | EIP-55 チェックサム検証 + レジストリ照合 → pass / warn / fail 判定 |

### スキル④ — DeFi オペレーション

| ツール | 説明 |
|---|---|
| `getDeFiVenues` | Merchant Moe・Agni・Aave v3 のティア情報を返す（静的） |
| `getSwapQuote` | Agni QuoterV2 へ `eth_call` でスワップ見積もりを取得 |
| `getLiquidityPools` | レジストリのプール・ポジションマネージャーエントリ一覧 |

### スキル⑤ — リスク評価

| ツール | 説明 |
|---|---|
| `evaluateTransactionRisk` | 入力完全性・スリッページ・アドレス安全性・アローワンス・ガス・デッドラインの 6 項目チェック。fail 有り → block / warn 有り → warn / 全 pass → pass |

### スキル⑥ — トランザクション模擬実行

| ツール | 説明 |
|---|---|
| `simulateTransaction` | Tenderly API 優先、フォールバックは `eth_estimateGas` + `eth_call`。WYSIWYS サマリーを生成。実トランザクションは絶対送信しない |

### スキル⑦ — RPC デバッガー

| ツール | 説明 |
|---|---|
| `debugRpcError` | rate limit・revert・nonce・gas・insufficient funds・contract not found のパターンマッチング診断 |

### スキル⑧ — データインデクサー

| ツール | 説明 |
|---|---|
| `queryHistoricalData` | wallet_swaps・pool_volume・wallet_activity・top_pools の GraphQL/SQL テンプレート生成。endpoint 指定時のみ実際の fetch を実行 |

### スキル⑨ — コントラクト開発

| ツール | 説明 |
|---|---|
| `getContractTemplate` | ERC-20・ERC-721・ERC-1155・ガバナンス・ステーキング・マルチシグの 6 テンプレートメタデータ |
| `validateContractArchitecture` | アクセス制御・アップグレーダビリティ・ガス最適化・セキュリティのチェックリスト評価 |

### スキル⑩ — コントラクトデプロイ

| ツール | 説明 |
|---|---|
| `getDeploymentChecklist` | デプロイ前全チェックリスト（コンパイル・監査・テスト・ガス・マルチシグ等） |
| `prepareDeploymentPackage` | 未署名デプロイパッケージ生成（`nextStep` は常に「外部署名者でブロードキャスト」） |

---

## 機能ごとの処理シーケンス図

### ① ネットワーク情報取得

```mermaid
sequenceDiagram
    actor User
    participant UI as Next.js UI
    participant API as /api/chat
    participant Agent as Mantle Agent
    participant Tool as getMantleNetworkInfo

    User->>UI: "Mantle とは？" 入力
    UI->>API: POST /api/chat (messages, memory.thread)
    API->>Agent: handleChatStream()
    Agent->>Tool: topic="basics"
    Tool-->>Agent: 静的 JSON（chainId, rpc, gasToken, contracts）
    Agent-->>API: ストリーミングテキスト生成
    API-->>UI: UI Message Stream
    UI-->>User: 回答表示（スナップショット日付付き）
```

### ② ウォレット残高照会

```mermaid
sequenceDiagram
    actor User
    participant UI as Next.js UI
    participant API as /api/chat
    participant Agent as Mantle Agent
    participant Tool as getWalletBalance
    participant RPC as Mantle RPC

    User->>UI: "0xABC...の残高は？" 入力
    UI->>API: POST /api/chat
    API->>Agent: handleChatStream()
    Agent->>Tool: address="0xABC..."
    Tool->>RPC: eth_getBalance (MNT)
    Tool->>RPC: eth_call × 4 (WMNT/USDT/USDC/WETH balanceOf)
    RPC-->>Tool: 残高データ
    Tool-->>Agent: { native, tokens[] }
    Agent-->>UI: ストリーミング回答
    UI-->>User: トークン残高一覧表示
```

### ③ アドレス解決・検証

```mermaid
sequenceDiagram
    actor User
    participant UI as Next.js UI
    participant API as /api/chat
    participant Agent as Mantle Agent
    participant Resolve as resolveContractAddress
    participant Validate as validateAddress
    participant Registry as インラインレジストリ定数

    User->>UI: "Merchant Moe のアドレスは？" 入力
    UI->>API: POST /api/chat
    API->>Agent: handleChatStream()
    Agent->>Resolve: name="merchant-moe"
    Resolve->>Registry: name/alias/label 検索
    Registry-->>Resolve: { address, verified, source }
    Resolve-->>Agent: 検証済みアドレス
    Agent->>Validate: address=<取得したアドレス>
    Validate->>Registry: EIP-55 + レジストリ照合
    Registry-->>Validate: pass / warn / fail
    Validate-->>Agent: 検証結果
    Agent-->>UI: ストリーミング回答
    UI-->>User: アドレス + 検証ステータス表示
```

### ④ DeFi スワップ見積もり

```mermaid
sequenceDiagram
    actor User
    participant UI as Next.js UI
    participant API as /api/chat
    participant Agent as Mantle Agent
    participant Venues as getDeFiVenues
    participant Quote as getSwapQuote
    participant QuoterV2 as Agni QuoterV2 (RPC)

    User->>UI: "1 WMNT → USDC の見積もり" 入力
    UI->>API: POST /api/chat
    API->>Agent: handleChatStream()
    Agent->>Venues: (ベニュー一覧確認)
    Venues-->>Agent: [Merchant Moe, Agni, Aave v3]
    Agent->>Quote: tokenIn=WMNT, tokenOut=USDC, amountIn=1e18
    Quote->>QuoterV2: eth_call quoteExactInputSingle
    QuoterV2-->>Quote: amountOut, sqrtPriceX96After, gasEstimate
    Quote-->>Agent: { amountOut, priceImpact, gasEstimate }
    Agent-->>UI: ストリーミング回答
    UI-->>User: 見積もり金額・価格影響・ガス費用表示
```

### ⑤ リスク評価

```mermaid
sequenceDiagram
    actor User
    participant UI as Next.js UI
    participant API as /api/chat
    participant Agent as Mantle Agent
    participant Risk as evaluateTransactionRisk

    User->>UI: "このスワップのリスクを評価して" 入力
    UI->>API: POST /api/chat
    API->>Agent: handleChatStream()
    Agent->>Risk: { tokenIn, tokenOut, amountIn, slippage, deadline, ... }
    Note over Risk: 6 項目チェック<br/>① 入力完全性<br/>② スリッページ<br/>③ アドレス安全性<br/>④ アローワンス<br/>⑤ ガス<br/>⑥ デッドライン
    Risk-->>Agent: { result: pass|warn|block, checks[] }
    Agent-->>UI: ストリーミング回答
    UI-->>User: 判定結果 + 各チェック詳細表示
```

### ⑥ トランザクション模擬実行

```mermaid
sequenceDiagram
    actor User
    participant UI as Next.js UI
    participant API as /api/chat
    participant Agent as Mantle Agent
    participant Sim as simulateTransaction
    participant Tenderly as Tenderly API
    participant RPC as Mantle RPC

    User->>UI: "このトランザクションを模擬実行して" 入力
    UI->>API: POST /api/chat
    API->>Agent: handleChatStream()
    Agent->>Sim: { to, data, value, from }
    alt Tenderly 設定済み
        Sim->>Tenderly: POST /simulate
        Tenderly-->>Sim: state_diff, gas_used, status
    else フォールバック
        Sim->>RPC: eth_estimateGas
        Sim->>RPC: eth_call
        RPC-->>Sim: gasUsed / returnData
    end
    Sim-->>Agent: WYSIWYS サマリー（実行なし）
    Agent-->>UI: ストリーミング回答
    UI-->>User: 状態変化サマリー + ガス見積もり表示
```

### ⑦ RPC エラー診断

```mermaid
sequenceDiagram
    actor User
    participant UI as Next.js UI
    participant API as /api/chat
    participant Agent as Mantle Agent
    participant Debug as debugRpcError

    User->>UI: "rate limit exceeded エラーが出る" 入力
    UI->>API: POST /api/chat
    API->>Agent: handleChatStream()
    Agent->>Debug: errorMessage="rate limit exceeded"
    Note over Debug: パターンマッチング<br/>rate_limit / revert / nonce<br/>gas / insufficient_funds<br/>contract_not_found
    Debug-->>Agent: { category, cause, nextActions[] }
    Agent-->>UI: ストリーミング回答
    UI-->>User: 診断結果 + 推奨アクション表示
```

### ⑧ 過去データクエリ生成

```mermaid
sequenceDiagram
    actor User
    participant UI as Next.js UI
    participant API as /api/chat
    participant Agent as Mantle Agent
    participant Indexer as queryHistoricalData
    participant Endpoint as GraphQL/SQL Endpoint

    User->>UI: "過去 7 日の WMNT/USDC 出来高を調べて" 入力
    UI->>API: POST /api/chat
    API->>Agent: handleChatStream()
    Agent->>Indexer: queryType="pool_volume", days=7
    alt endpoint 指定なし
        Indexer-->>Agent: GraphQL/SQL テンプレート文字列
    else endpoint 指定あり
        Indexer->>Endpoint: fetch(query)
        Endpoint-->>Indexer: 取得データ
        Indexer-->>Agent: 取得データ
    end
    Agent-->>UI: ストリーミング回答
    UI-->>User: クエリ or データ表示
```

### ⑨ コントラクト設計・検証

```mermaid
sequenceDiagram
    actor User
    participant UI as Next.js UI
    participant API as /api/chat
    participant Agent as Mantle Agent
    participant Template as getContractTemplate
    participant Validate as validateContractArchitecture

    User->>UI: "ERC-20 コントラクトのテンプレートと設計チェックをして" 入力
    UI->>API: POST /api/chat
    API->>Agent: handleChatStream()
    Agent->>Template: type="erc20"
    Template-->>Agent: テンプレートメタデータ（依存・特徴・注意点）
    Agent->>Validate: { accessControl, upgradeability, gasOptimization, ... }
    Note over Validate: 4 カテゴリチェック<br/>① アクセス制御<br/>② アップグレーダビリティ<br/>③ ガス最適化<br/>④ セキュリティ
    Validate-->>Agent: { passed[], warned[], failed[] }
    Agent-->>UI: ストリーミング回答
    UI-->>User: テンプレート情報 + 設計チェック結果表示
```

### ⑩ デプロイ前チェック・パッケージ生成

```mermaid
sequenceDiagram
    actor User
    participant UI as Next.js UI
    participant API as /api/chat
    participant Agent as Mantle Agent
    participant Checklist as getDeploymentChecklist
    participant Package as prepareDeploymentPackage
    participant Signer as 外部署名者

    User->>UI: "コントラクトのデプロイ準備をして" 入力
    UI->>API: POST /api/chat
    API->>Agent: handleChatStream()
    Agent->>Checklist: { contractType, network }
    Checklist-->>Agent: チェックリスト（コンパイル・監査・テスト・ガス・マルチシグ等）
    Agent->>Package: { bytecode, abi, constructorArgs, network }
    Package-->>Agent: 未署名デプロイパッケージ
    Agent-->>UI: ストリーミング回答
    UI-->>User: チェックリスト + パッケージ表示
    Note over UI,Signer: nextStep: 外部署名者でブロードキャスト
    UI-->>Signer: ハンドオフ（エージェントは送信しない）
```

### メモリ永続化フロー

```mermaid
sequenceDiagram
    actor User
    participant Browser as ブラウザ
    participant LS as localStorage
    participant UI as Next.js UI
    participant API as /api/chat
    participant Agent as Mantle Agent
    participant Memory as Mastra Memory (LibSQL)

    Browser->>LS: threadId 取得
    alt threadId なし
        LS-->>Browser: null
        Browser->>LS: nanoid() で新規生成・保存
    end
    User->>UI: メッセージ送信
    UI->>API: POST { messages, memory: { thread: threadId, resource: "user" } }
    API->>Agent: handleChatStream(params)
    Agent->>Memory: 過去の会話を threadId で検索
    Memory-->>Agent: 過去コンテキスト
    Agent-->>API: ストリーミング回答
    API-->>UI: UI Message Stream
    Agent->>Memory: 新しいメッセージを保存
    Note over Browser,Memory: ページリフレッシュ後も同じ threadId で継続
```

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

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
