# Code Style and Conventions

## TypeScript (mantle-agent root + pkgs/frontend)
- **Linter/Formatter**: Biome (NOT ESLint/Prettier)
- Strict TypeScript (tsconfig.json with strict settings)
- Named exports preferred
- Zod for schema validation (tool inputs/outputs)
- No `.env` files committed — use `.env.example` as template
- ESM modules (`"type": "module"` in package.json for mantle-agent-scaffold)

## TypeScript (pkgs/cdk)
- CommonJS TypeScript (not ESM)
- AWS CDK v2 pattern: extends cdk.Stack, use Construct
- Secrets from SSM Parameter Store (not .env in Lambda)
- dotenv used for local dev only

## TypeScript (hardhat-sample)
- ESM modules (`"type": "module"` in package.json)
- Hardhat 3 requires `configVariable()` for secrets — no hardcoded `.env` in config
- viem for EVM interaction

## Mastra Conventions (pkgs/frontend/src/mastra/)
- Agents: `src/mastra/agents/`
- Tools: `src/mastra/tools/`
- Models: `src/mastra/models/`
- Skills: `src/mastra/skills/`
- Entry point: `src/mastra/index.ts`
- Workspace config: `src/mastra/workspace.ts`
- Register everything in `src/mastra/index.ts`
- Tools must have Zod schemas for inputs and outputs
- Never hardcode API keys — always use environment variables

## Skills Conventions
- Each skill lives in `.claude/skills/<skill-name>/`
- SKILL.md defines trigger conditions, workflow steps, constraints
- `references/` contains detailed reference docs
- `agents/openai.yaml` for optional OpenAI-compatible agent definitions

## mantle-agent-scaffold
- Tests live in `tests/` (unit) and `e2e/` (end-to-end)
- Uses Vitest (not Jest)
- Skills as git submodule under `skills/`
