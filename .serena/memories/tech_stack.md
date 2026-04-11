# Tech Stack

## mantle-agent
- **Framework**: Next.js 16, React 19
- **AI**: Mastra (@mastra/core ^1.24.1, mastra ^1.5.0)
- **Storage**: LibSQLStore (SQLite), DuckDBStore (observability)
- **Observability**: @mastra/observability with PinoLogger
- **Styling**: TailwindCSS v4
- **Language**: TypeScript 5
- **Package manager**: npm (bun.lockb also present)
- **Linter**: ESLint 9

## hardhat-sample
- **Framework**: Hardhat 3 (ESM modules)
- **Language**: TypeScript, Solidity
- **Testing**: Hardhat test (supports both Solidity and Node.js/TypeScript tests)
- **Deployment**: Hardhat Ignition
- **EVM interaction**: viem v2
- **Network**: Mantle Sepolia testnet + local node

## Skills System
- Pure Markdown-based reference docs
- SKILL.md files define trigger conditions and workflow steps
- Some skills include OpenAI-compatible agent definitions (openai.yaml)
