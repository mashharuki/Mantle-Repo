# Code Style and Conventions

## TypeScript (mantle-agent)
- Strict TypeScript (tsconfig.json with strict settings)
- Named exports preferred
- Zod v4 for schema validation (tool inputs/outputs)
- Path aliases via tsconfig.json
- ESLint config in eslint.config.mjs (flat config format, ESLint 9)
- No `.env` files committed — use `.env.example` as template

## TypeScript (hardhat-sample)
- ESM modules (`"type": "module"` in package.json)
- Hardhat 3 requires `configVariable()` for secrets — no hardcoded `.env` in config
- viem for EVM interaction

## Mastra Conventions
- All Mastra code lives in `src/mastra/`
- Agents: `src/mastra/agents/`
- Tools: `src/mastra/tools/`
- Workflows: `src/mastra/workflows/`
- Register everything in `src/mastra/index.ts`
- Tools must have Zod schemas for inputs and outputs
- Never hardcode API keys — always use environment variables

## Skills Conventions
- Each skill lives in `.claude/skills/<skill-name>/`
- SKILL.md defines trigger conditions, workflow steps, constraints
- `references/` contains detailed reference docs
- `agents/openai.yaml` for optional OpenAI-compatible agent definitions
