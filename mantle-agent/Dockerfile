# ── ビルドステージ（Bun）──
# oven/bun は Debian ベース（glibc）のため DuckDB ネイティブモジュールとの互換性あり
# ただし next build のワーカープロセスは Node.js で実行させるため
# NEXT_BUILD_WORKER_FORCE_NODE=1 を設定（LWA 経由の本番起動も node で行う）
# バージョンをピン留めして bun.lockb の互換性を保つ
FROM oven/bun:1.1.4-slim AS builder
WORKDIR /app

# frontend だけの依存関係をインストール
# bun.lockb はモノレポルートにあるため一緒にコピーする
COPY bun.lockb ./bun.lockb
COPY pkgs/frontend/package.json ./package.json
RUN bun install

# ソースをコピーしてビルド
COPY pkgs/frontend .
ENV NEXT_TELEMETRY_DISABLED=1
# next build の内部ワーカーを Node.js に強制して DuckDB クラッシュを回避
ENV NEXT_BUILD_WORKER_FORCE_NODE=1
RUN bun run build

# ── 実行ステージ（Node.js + Lambda Web Adapter） ──
FROM node:22-slim AS runner

# Lambda Web Adapter バイナリをコピー
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 \
  /lambda-adapter /opt/extensions/lambda-adapter

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV AWS_LAMBDA_EXEC_WRAPPER=/opt/extensions/lambda-adapter
ENV AWS_LWA_READINESS_CHECK_PATH=/api/health
ENV AWS_LWA_INVOKE_MODE=response_stream

# standalone ビルド成果物のみコピー
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
