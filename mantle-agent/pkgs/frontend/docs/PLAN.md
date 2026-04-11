# mantle-agent AWS デプロイ実装計画

## モノレポ構成（現状）

```
mantle-agent/
├── package.json          ← Bun workspaces: ["pkgs/*"]
├── bun.lockb
└── pkgs/
    ├── frontend/         ← Next.js 16 + Mastra アプリ
    └── cdk/              ← CDK プロジェクト（空スタック → ここを実装）
```

## アーキテクチャ

**Lambda Web Adapter + CDK TypeScript**

```
CloudFront
  ├── /_next/static/*  → S3 Bucket（静的アセット・長期キャッシュ）
  └── /*               → Lambda Function URL（SSR + /api/chat ストリーミング）
                              ↓
                    Lambda (Docker, arm64, 2048MB, 120s)
                      ├── Lambda Web Adapter v0.9.1
                      ├── Next.js 16 standalone
                      └── Mastra Agent
                            ├── LibSQL → Turso (env var)
                            └── DuckDB → in-memory
                              ↓
                    SSM Parameter Store (SecureString)
                      - GOOGLE_GENERATIVE_AI_API_KEY
                      - LIBSQL_URL / LIBSQL_AUTH_TOKEN
                      - MANTLE_RPC_MAINNET / TESTNET
                      - TENDERLY_ACCESS_KEY / ACCOUNT / PROJECT
```

### Amplify Gen2 ではなく Lambda Web Adapter を選ぶ理由

| 観点 | Lambda Web Adapter + CDK | Amplify Gen2 |
|------|--------------------------|--------------|
| DuckDB ネイティブ依存 | ✅ Docker で arch 一致保証 | ⚠️ 動作保証なし |
| 60 秒ストリーミング | ✅ Function URL で解決 | ⚠️ デフォルト設定と競合リスク |
| IaC 完全制御 | ✅ CDK TypeScript | ⚠️ Amplify ラッパー制約あり |
| 既存 `pkgs/cdk/` との親和性 | ✅ そのまま実装追加 | ❌ 別途 amplify/ 構成が必要 |

---

## 変更ファイル一覧

| ファイル | 種別 | 変更内容 |
|---------|------|---------|
| `pkgs/frontend/next.config.ts` | 変更 | `output: "standalone"` 追加 |
| `pkgs/frontend/Dockerfile` | 新規 | LWA + Node 22 + standalone |
| `pkgs/frontend/src/app/api/health/route.ts` | 新規 | LWA ヘルスチェック用エンドポイント |
| `pkgs/frontend/src/mastra/index.ts` | 変更 | LibSQL → env var（Turso）、DuckDB → in-memory |
| `pkgs/cdk/lib/cdk-stack.ts` | 変更 | Lambda + Function URL + CloudFront + S3 実装 |
| `pkgs/cdk/bin/cdk.ts` | 変更 | account/region 設定 |

---

## 実装詳細

### 1. `pkgs/frontend/next.config.ts`

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",  // ← 追加
  serverExternalPackages: [
    "@duckdb/node-api",
    "@duckdb/node-bindings",
    "@mastra/duckdb",
    "@libsql/client",
    "better-sqlite3",
  ],
};

export default nextConfig;
```

### 2. `pkgs/frontend/Dockerfile`

```dockerfile
# ── ビルドステージ ──
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── 実行ステージ（Lambda Web Adapter 組み込み） ──
FROM node:22-alpine AS runner

COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 \
  /lambda-adapter /opt/extensions/lambda-adapter

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV AWS_LAMBDA_EXEC_WRAPPER=/opt/extensions/lambda-adapter
ENV AWS_LWA_READINESS_CHECK_PATH=/api/health
ENV AWS_LWA_INVOKE_MODE=response_stream

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

### 3. `pkgs/frontend/src/app/api/health/route.ts`

```typescript
export async function GET() {
  return Response.json({ status: "ok" });
}
```

### 4. `pkgs/frontend/src/mastra/index.ts` — DB 設定変更箇所

```typescript
// 変更前
default: new LibSQLStore({ id: "mastra-storage", url: "file:./mastra.db" }),
domains: {
  observability: await new DuckDBStore().getStore("observability"),
},

// 変更後
default: new LibSQLStore({
  id: "mastra-storage",
  url: process.env.LIBSQL_URL ?? "file:./mastra.db",
  authToken: process.env.LIBSQL_AUTH_TOKEN,
}),
domains: {
  observability: await new DuckDBStore({ url: ":memory:" }).getStore("observability"),
},
```

### 5. `pkgs/cdk/lib/cdk-stack.ts`

```typescript
import * as cdk from "aws-cdk-lib/core";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import * as path from "path";

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const getParam = (name: string) =>
      ssm.StringParameter.valueForStringParameter(this, `/mantle-agent/${name}`);

    const frontendDir = path.join(__dirname, "../../frontend");

    // Lambda Function（Docker イメージ）
    const fn = new lambda.DockerImageFunction(this, "NextjsFunction", {
      functionName: "mantle-agent",
      code: lambda.DockerImageCode.fromImageAsset(frontendDir),
      architecture: lambda.Architecture.ARM_64,
      memorySize: 2048,
      timeout: cdk.Duration.seconds(120),
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        GOOGLE_GENERATIVE_AI_API_KEY: getParam("GOOGLE_GENERATIVE_AI_API_KEY"),
        LIBSQL_URL:                   getParam("LIBSQL_URL"),
        LIBSQL_AUTH_TOKEN:            getParam("LIBSQL_AUTH_TOKEN"),
        TENDERLY_ACCESS_KEY:          getParam("TENDERLY_ACCESS_KEY"),
        TENDERLY_ACCOUNT:             getParam("TENDERLY_ACCOUNT"),
        TENDERLY_PROJECT:             getParam("TENDERLY_PROJECT"),
        MANTLE_RPC_MAINNET: "https://rpc.mantle.xyz",
        MANTLE_RPC_TESTNET: "https://rpc.sepolia.mantle.xyz",
      },
    });

    // Lambda Function URL（ストリーミング）
    const fnUrl = fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
      cors: {
        allowedOrigins: ["*"],
        allowedHeaders: ["content-type", "authorization"],
        allowedMethods: [lambda.HttpMethod.ALL],
      },
    });

    // S3 バケット（静的アセット）
    const staticBucket = new s3.Bucket(this, "StaticAssetsBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: "mantle-agent",
      defaultBehavior: {
        origin: new origins.FunctionUrlOrigin(fnUrl),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
      additionalBehaviors: {
        "/_next/static/*": {
          origin: origins.S3BucketOrigin.withOriginAccessControl(staticBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
    });

    // 静的アセットを S3 にデプロイ
    new s3deploy.BucketDeployment(this, "StaticAssetsDeployment", {
      sources: [s3deploy.Source.asset(path.join(frontendDir, ".next/static"))],
      destinationBucket: staticBucket,
      destinationKeyPrefix: "_next/static",
      distribution,
      distributionPaths: ["/_next/static/*"],
    });

    new cdk.CfnOutput(this, "AppUrl", {
      value: `https://${distribution.distributionDomainName}`,
      description: "mantle-agent URL",
    });
  }
}
```

### 6. `pkgs/cdk/bin/cdk.ts`

```typescript
#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { CdkStack } from "../lib/cdk-stack";

const app = new cdk.App();
new CdkStack(app, "MantleAgentStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "ap-northeast-1",
  },
  stackName: "mantle-agent",
});
```

---

## 事前準備（手動・初回のみ）

```bash
# 1. Turso で LibSQL リモート DB 作成
turso db create mantle-agent
turso db tokens create mantle-agent

# 2. SSM Parameter Store にシークレットを登録
aws ssm put-parameter --name "/mantle-agent/GOOGLE_GENERATIVE_AI_API_KEY" \
  --value "AIza..." --type SecureString
aws ssm put-parameter --name "/mantle-agent/LIBSQL_URL" \
  --value "libsql://mantle-agent-xxx.turso.io" --type SecureString
aws ssm put-parameter --name "/mantle-agent/LIBSQL_AUTH_TOKEN" \
  --value "eyJ..." --type SecureString
aws ssm put-parameter --name "/mantle-agent/TENDERLY_ACCESS_KEY" \
  --value "..." --type SecureString
aws ssm put-parameter --name "/mantle-agent/TENDERLY_ACCOUNT" \
  --value "..." --type SecureString
aws ssm put-parameter --name "/mantle-agent/TENDERLY_PROJECT" \
  --value "..." --type SecureString

# 3. CDK Bootstrap（アカウント・リージョンごとに初回のみ）
cd pkgs/cdk
npx cdk bootstrap
```

---

## デプロイ手順

```bash
# Step 1: フロントエンドをビルド（静的アセット生成のため必要）
cd pkgs/frontend
npm run build

# Step 2: CDK デプロイ（Docker ビルド & Lambda 更新を自動実行）
cd ../cdk
npx cdk diff    # 変更内容の確認
npx cdk deploy  # デプロイ実行
```

Bun のフィルタースクリプト経由（ルートから）:

```bash
bun run --filter cdk synth
bun run --filter cdk deploy
```

---

## 動作確認

```bash
CF_URL="https://xxxx.cloudfront.net"

# ヘルスチェック
curl "$CF_URL/api/health"
# → {"status":"ok"}

# チャット（ストリーミング）
curl -X POST "$CF_URL/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Mantle networkとは？"}]}'
```

---

## コスト試算（月次・東京リージョン）

| 項目 | 試算 |
|------|------|
| Lambda（2048MB × 60s × 1,000 req/月） | ~$2–5 |
| CloudFront | ~$1–3 |
| Turso（無料枠: 500DB, 9GB） | $0 |
| S3 / ECR | ~$0.1 |
| SSM Parameter Store | $0 |
| **合計（低負荷）** | **~$3–8/月** |
