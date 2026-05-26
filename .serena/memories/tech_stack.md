# Tech Stack

## mantle-agent (Bun monorepo root)
- **Package manager**: Bun
- **Linter/Formatter**: Biome 2.x (@biomejs/biome ^2.4.11)
- **Language**: TypeScript 5

## mantle-agent / pkgs/frontend (Next.js app)
- **Framework**: Next.js 16.2.3, React 19.2.4
- **AI**: Mastra (@mastra/core ^1.24.1, mastra ^1.5.0)
- **AI Provider**: Amazon Bedrock (@ai-sdk/amazon-bedrock ^4.0.108) + AWS credential providers
- **Storage**: LibSQLStore (SQLite via @mastra/libsql), DuckDBStore (@mastra/duckdb, observability)
- **Observability**: @mastra/observability with PinoLogger (@mastra/loggers)
- **Styling**: TailwindCSS v4
- **Language**: TypeScript 5
- **Other UI**: Radix UI, shadcn, cmdk, motion, @xyflow/react, embla-carousel-react
- **Streaming**: streamdown (with @streamdown/cjk, code, math, mermaid plugins)

## mantle-agent / pkgs/cdk (AWS CDK stack)
- **Framework**: AWS CDK v2 (aws-cdk 2.1100.1, aws-cdk-lib 2.232.1)
- **Language**: TypeScript 5.9.3
- **Testing**: Jest + ts-jest
- **Deployment target**: AWS Lambda Web Adaptor
- **Secrets**: SSM Parameter Store
- **Required env vars**: GOOGLE_GENERATIVE_AI_API_KEY, LIBSQL_URL, LIBSQL_AUTH_TOKEN
- **Optional env vars**: TENDERLY_ACCESS_KEY, TENDERLY_ACCOUNT, TENDERLY_PROJECT

## mantle-agent-scaffold (npm monorepo)
- **Package manager**: npm
- **Testing**: Vitest 3.x
- **Language**: TypeScript 5.9.3
- **AI providers (dev)**: @ai-sdk/anthropic, @ai-sdk/openai
- **packages/core**: Core Mantle L2 library
- **packages/cli**: CLI for Mantle tools
- **packages/mcp**: MCP server package

## hardhat-sample
- **Framework**: Hardhat 3 (ESM modules)
- **Language**: TypeScript, Solidity
- **Testing**: Hardhat test (supports both Solidity and Node.js/TypeScript tests)
- **Deployment**: Hardhat Ignition
- **EVM interaction**: viem v2
- **Network**: Mantle Sepolia testnet + local node

## Skills System
- 20+ skills under .claude/skills/
- Pure Markdown-based reference docs
- SKILL.md files define trigger conditions and workflow steps
- Some skills include OpenAI-compatible agent definitions (openai.yaml)
- New skills added: ai-elements, ai-sdk, marp-presen-review, marp-slides, next-best-practices, presen-coach, skill-creator
