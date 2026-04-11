# Task Completion Checklist

## After modifying mantle-agent code
1. `cd mantle-agent && npm run build` — verify TypeScript compiles
2. `npm run lint` — check for lint errors
3. Ensure new agents/tools/workflows are registered in `src/mastra/index.ts`

## After modifying hardhat-sample contracts
1. `cd hardhat-sample && npm run build` — compile contracts
2. `npm run test` — run all tests (Solidity + TypeScript)

## General rules
- Never commit `.env` files
- Never hardcode secrets
- Load the `mastra` skill before any Mastra-related work
- Use appropriate Mantle skill before any Mantle-related task
- Always use external signer for state-changing transactions on Mantle
