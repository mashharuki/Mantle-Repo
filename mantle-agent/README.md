# mantle-agent

Mantle Network AI エージェント — Next.js + Mastra フレームワークで構築されたチャット UI。

## 構成

```
pkgs/
├── frontend/   # Next.js 16 + Mastra AI エージェント
└── cdk/        # AWS CDK インフラ（Lambda + CloudFront）
```

## ローカル開発

```bash
bun install
bun run --filter frontend dev
```

---

## AWS デプロイ

### 前提条件

- AWS CLI（設定済み）
- [Turso CLI](https://docs.turso.tech/cli/installation)
- Docker

### 1. Turso のセットアップ（LibSQL リモート DB）

Mastra のチャット履歴・メモリは [Turso](https://turso.tech) のリモート SQLite DB に保存されます。

```bash
# Turso CLI インストール（未導入の場合）
curl -sSfL https://get.tur.so/install.sh | bash

# ログイン
turso auth login

# DB 作成
turso db create mantle-agent

# 接続 URL を確認
turso db show mantle-agent --url
# → libsql://mantle-agent-<username>.turso.io

# 認証トークン発行
turso db tokens create mantle-agent
# → eyJ... （次の手順で使用）
```

### 2. SSM Parameter Store にシークレットを登録

```bash
# Turso
aws ssm put-parameter \
  --name "/mantle-agent/LIBSQL_URL" \
  --value "libsql://mantle-agent-<username>.turso.io" \
  --type SecureString

aws ssm put-parameter \
  --name "/mantle-agent/LIBSQL_AUTH_TOKEN" \
  --value "eyJ..." \
  --type SecureString

# Google Gemini API キー
aws ssm put-parameter \
  --name "/mantle-agent/GOOGLE_GENERATIVE_AI_API_KEY" \
  --value "AIza..." \
  --type SecureString

# Tenderly（トランザクションシミュレーション）
aws ssm put-parameter \
  --name "/mantle-agent/TENDERLY_ACCESS_KEY" \
  --value "..." \
  --type SecureString

aws ssm put-parameter \
  --name "/mantle-agent/TENDERLY_ACCOUNT" \
  --value "..." \
  --type SecureString

aws ssm put-parameter \
  --name "/mantle-agent/TENDERLY_PROJECT" \
  --value "..." \
  --type SecureString
```

### 3. CDK Bootstrap（初回のみ）

```bash
cd pkgs/cdk
npx cdk bootstrap
```

### 4. デプロイ

```bash
# フロントエンドをビルド（静的アセット生成）
bun run --filter frontend build

# CDK デプロイ（Docker ビルド & AWS リソース作成）
cd pkgs/cdk
npx cdk deploy
```

デプロイ完了後、CloudFront の URL が出力されます:

```
Outputs:
MantleAgentStack.AppUrl = https://xxxx.cloudfront.net
```

### 5. 動作確認

```bash
CF_URL="https://xxxx.cloudfront.net"

# ヘルスチェック
curl "$CF_URL/api/health"
# → {"status":"ok"}
```
