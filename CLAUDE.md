# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a **Mantle Network AI Skills Framework** — a knowledge base and Claude Code skills system for Ethereum L2 (Mantle) development. It is not a traditional application codebase; the primary content lives in `.claude/skills/`.

If a `mantle-agent-scaffold` subdirectory is present, it contains an MCP server:

```bash
npm i
npm run build
```

## Skills System Architecture

All skills live under `.claude/skills/<skill-name>/` with a common structure:

```
SKILL.md              # Trigger conditions, workflow steps, constraints
references/           # Detailed reference docs the skill reads during execution
agents/openai.yaml    # Optional OpenAI-compatible agent definition
```

**Rule**: When a skill matches the task, read its `SKILL.md` first and follow the workflow exactly — do not improvise.

### Available Skills

| Skill | When to Use |
|-------|-------------|
| `mantle-network-primer` | Mantle fundamentals, MNT gas, chain setup, finality |
| `mantle-smart-contract-developer` | Contract architecture, access control, upgradeability |
| `mantle-smart-contract-deployer` | Deployment readiness, signer handoff, explorer verification |
| `mantle-defi-operator` | DeFi discovery, venue comparison, swap/liquidity SOPs |
| `mantle-portfolio-analyst` | Wallet balances, token holdings, allowance exposure |
| `mantle-risk-evaluator` | Pre-execution slippage, liquidity, allowance-scope checks |
| `mantle-tx-simulator` | Pre-signing simulation, state-diff review, revert analysis |
| `mantle-readonly-debugger` | RPC failures, quote reverts, balance inconsistencies |
| `mantle-data-indexer` | Historical metrics, event backfills, protocol analytics |
| `mantle-address-registry-navigator` | Verified contract/token address lookup, anti-phishing |
| `hardhat3-dev` | Hardhat 3 setup, Solidity/TS testing, Ignition deployment |
| `skill-creator` | Creating or improving skills in this framework |

## Key Technical Context

- **Gas token**: MNT (not ETH) — must account for this in all gas/fee calculations
- **Settlement vs. inclusion**: Mantle distinguishes inclusion (fast) from L1 settlement (final) — use the right finality guarantee for the use case
- **RPC**: Mantle has Mantle-specific RPC quirks; use `mantle-readonly-debugger` when RPC behavior is inconsistent
- **Hardhat 3** requires Node.js v22+, uses ESM modules, and `configVariable()` for secrets (no `.env` files hardcoded in config)
- **Deployment**: Always hand off to an external signer — never execute state-changing transactions directly

## Rules

- Always proactively use the appropriate skill before starting a Mantle-related task
- Mention which skill is being used and why (one line) before proceeding
- Skills and subagents can be combined: pass skill knowledge to a subagent for execution
- For small tasks with no matching skill, proceed with the normal flow
