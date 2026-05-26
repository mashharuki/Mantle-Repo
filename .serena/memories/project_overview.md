# Project Overview: Mantle-Repo

## Purpose
Mantle Network AI Skills Framework — a knowledge base and Claude Code skills system for Ethereum L2 (Mantle) development.

## Sub-projects
- **mantle-agent/**: Bun monorepo with two packages:
  - `pkgs/frontend/`: Next.js 16 + Mastra framework AI agent (TypeScript, deployed on AWS Lambda)
  - `pkgs/cdk/`: AWS CDK v2 stack for deploying frontend to AWS Lambda Web Adaptor
- **mantle-agent-scaffold/**: Monorepo for Mantle L2 tooling (npm + vitest):
  - `packages/core/`: Core library
  - `packages/cli/`: CLI package
  - `packages/mcp/`: MCP server package
  - `skills/`: Git submodule for skills
  - `tests/` + `e2e/`: Test suites
- **hardhat-sample/**: Hardhat 3 smart contract development sample for Mantle Network (TypeScript + ESM)
- **.claude/skills/**: Claude Code skills collection (20+ skills)

## Key Facts
- Gas token on Mantle: MNT (not ETH)
- Mantle distinguishes between inclusion (fast) and L1 settlement (final)
- Never execute state-changing transactions directly — always hand off to external signer
- Node.js runtime: >=22.13.0 (mantle-agent-scaffold requires >=20.0.0)
- mantle-agent uses Amazon Bedrock as AI provider
