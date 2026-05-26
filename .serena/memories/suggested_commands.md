# Suggested Commands

## mantle-agent (root — Bun monorepo)
```bash
cd mantle-agent
bun run lint          # Biome lint (whole repo)
bun run lint:fix      # Biome lint with auto-fix
bun run format        # Biome format with write
```

## mantle-agent / pkgs/frontend (Next.js + Mastra)
```bash
cd mantle-agent/pkgs/frontend
bun run dev           # Start Next.js dev server (also serves Mastra Studio at localhost:4111)
bun run build         # Production build
bun run start         # Start production server
bun run lint          # ESLint (frontend-specific)
```

## mantle-agent / pkgs/cdk (AWS CDK stack)
```bash
cd mantle-agent/pkgs/cdk
bun run build         # Compile TypeScript
bun run synth         # CDK synth (show CloudFormation template)
bun run diff          # CDK diff
bun run deploy        # Deploy all stacks (--require-approval never)
bun run destroy       # Destroy all stacks
bun run test          # Jest tests
```

## mantle-agent-scaffold (npm monorepo — Mantle L2 tooling)
```bash
cd mantle-agent-scaffold
npm run build         # Build core → cli + mcp
npm run typecheck     # TypeScript type check all packages
npm run test          # Build + vitest run (unit tests)
npm run test:e2e      # End-to-end tests
npm run start         # Start MCP server (packages/mcp)
npm run skills:init   # Initialize skills git submodule
npm run skills:sync   # Sync skills submodule to remote
npm run docs:dev      # Start docs dev server
npm run docs:build    # Build docs site
```

## hardhat-sample (Hardhat 3 + Mantle)
```bash
cd hardhat-sample
npm run build                    # Compile contracts
npm run test                     # Run all tests
npm run test:solidity            # Solidity tests only
npm run test:ts                  # TypeScript tests only
npm run node                     # Start local Hardhat node
npm run deploy:local             # Deploy Counter contract locally
npm run deploy:mantle-sepolia    # Deploy to Mantle Sepolia testnet
```
