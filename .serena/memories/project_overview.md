# Project Overview: Mantle-Repo

## Purpose
Mantle Network AI Skills Framework — a knowledge base and Claude Code skills system for Ethereum L2 (Mantle) development.

## Sub-projects
- **mantle-agent/**: Next.js 16 + Mastra framework AI agent application (TypeScript)
- **hardhat-sample/**: Hardhat 3 smart contract development sample for Mantle Network (TypeScript + ESM)
- **.claude/skills/**: Claude Code skills collection for Mantle-related tasks (12+ skills)

## Key Facts
- Gas token on Mantle: MNT (not ETH)
- Mantle distinguishes between inclusion (fast) and L1 settlement (final)
- Never execute state-changing transactions directly — always hand off to external signer
- Node.js runtime: >=22.13.0
