# Task Completion Checklist

## After modifying mantle-agent/pkgs/frontend (Mastra/Next.js)
1. `cd mantle-agent/pkgs/frontend && bun run build` — verify TypeScript/Next.js compiles
2. `cd mantle-agent && bun run lint` — check Biome lint errors
3. Ensure new agents/tools/workflows/models/skills are registered in `src/mastra/index.ts`

## After modifying mantle-agent/pkgs/cdk (CDK stack)
1. `cd mantle-agent/pkgs/cdk && bun run build` — compile TypeScript
2. `bun run synth` — validate CDK synth output
3. `bun run test` — run Jest tests

## After modifying mantle-agent-scaffold packages
1. `cd mantle-agent-scaffold && npm run build` — build core then cli/mcp
2. `npm run typecheck` — TypeScript type check
3. `npm run test` — run unit tests with vitest

## After modifying hardhat-sample contracts
1. `cd hardhat-sample && npm run build` — compile contracts
2. `npm run test` — run all tests (Solidity + TypeScript)

## General rules
- Never commit `.env` files
- Never hardcode secrets
- Use Biome for mantle-agent (not ESLint/Prettier)
- Use Vitest for mantle-agent-scaffold (not Jest, except pkgs/cdk uses Jest)
- Load the `mastra` skill before any Mastra-related work
- Use appropriate Mantle skill before any Mantle-related task
- Always use external signer for state-changing transactions on Mantle
- CDK deployments: always run `synth` before `deploy`
