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
