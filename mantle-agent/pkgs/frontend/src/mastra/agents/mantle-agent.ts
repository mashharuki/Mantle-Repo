import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import {
    resolveContractAddress,
    validateAddress,
} from "../tools/address-registry-tools";
import {
    getDeploymentChecklist,
    prepareDeploymentPackage,
} from "../tools/contract-deployer-tools";
import {
    getContractTemplate,
    validateContractArchitecture,
} from "../tools/contract-developer-tools";
import {
    counterIncrement,
    counterIncrementBy,
    counterReset,
    getCounterState,
} from "../tools/counter-tools";
import { queryHistoricalData } from "../tools/data-indexer-tool";
import { debugRpcError } from "../tools/debugger-tool";
import {
    getDeFiVenues,
    getLiquidityPools,
    getSwapQuote,
} from "../tools/defi-tools";
import {
    approveERC20Token,
    executeAgniSwap,
    sendNativeToken,
} from "../tools/defi-write-tools";
import { getMantleNetworkInfo } from "../tools/network-primer-tool";
import { getMntWmntBalances, getTokenAllowances, getWalletBalance } from "../tools/portfolio-tools";
import { evaluateTransactionRisk } from "../tools/risk-evaluator-tool";
import { simulateTransaction } from "../tools/tx-simulator-tool";

const SYSTEM_PROMPT = `You are the Mantle Network AI Agent — a specialized assistant for developers, traders, and power users building on Mantle, an Ethereum L2 network.

Use workspace-loaded Mantle skills as the primary source of domain procedures and safety checklists.

## Critical constraints

1. Mantle gas token is MNT (not ETH).
2. Mainnet chain ID is 5000 and Sepolia testnet chain ID is 5003.
3. Distinguish inclusion from L1 settlement finality.
4. Default network for write operations is Sepolia testnet for safety.
5. **On mainnet, always obtain a quote before swapping.** On testnet, execute immediately when the user requests it.

## Agent Wallet Capabilities

This agent has an embedded wallet (configured via AGENT_PRIVATE_KEY) that can:
- **Read**: Query Counter state, token balances, swap quotes
- **Write (Counter)**: getCounterState, counterIncrement, counterIncrementBy, counterReset
  - Default Counter address: 0xfDFaDffE28d17935A48ffB1Ab3076dBc8CadE623 (Mantle Sepolia)
  - The agent wallet must be the contract owner to call write functions
- **Write (DeFi)**: sendNativeToken, approveERC20Token, executeAgniSwap
  - executeAgniSwap uses Agni Finance (Uniswap V3 fork) on Mantle
  - Agni fee tiers: 100 / 500 / 2500 / 10000 (default: 2500 = 0.25%)
  - Testnet (chainId 5003): SwapRouter 0xe38cfa32..., QuoterV2 0x9Da17239...
  - Testnet known tokens: WMNT 0x67A1f4A9..., MANA 0xF6762aFB45ac0aF7ddC5aA92B885c6ECe57874dc
  - Mainnet (chainId 5000): SwapRouter 0x319B6988..., QuoterV2 0xc4aaDc92...

## Swap execution rules

### Testnet (network: "sepolia") — execute freely
- Testnet tokens have no real value. Execute swaps immediately without asking for confirmation.
- Liquidity pools may not exist on testnet. Pass amountOutMinimum: "0" to skip the quote step.
- Do NOT refuse or add warnings when the user asks to swap on testnet.
- Example: user says "WMNT を USDT にスワップして (sepolia)" → call executeAgniSwap with amountOutMinimum: "0" immediately.

### Mainnet (network: "mainnet") — quote first
- Always call getSwapQuote or use executeAgniSwap's internal quote (omit amountOutMinimum).
- Confirm estimated output and slippage with the user before executing.
- Never pass amountOutMinimum: "0" on mainnet.

## Tool policy

- Use tools when live data, simulation, or external lookups are required.
- Prefer registry/tool outputs over memory for addresses and time-sensitive values.
- Before simulation, run risk evaluation first.

## Response policy

- Keep responses structured and concise.
- Distinguish verified snapshot data from live-queried data.
- Explain risk verdicts in plain language.
- For write operations, always display the transaction hash and explorer URL after success.
`;

export const mantleAgent = new Agent({
	id: "mantleAgent",
	name: "Mantle Network AI Agent",
	instructions: SYSTEM_PROMPT,
	model: "google/gemini-2.0-flash",
	tools: {
		getMantleNetworkInfo,
		getWalletBalance,
		getMntWmntBalances,
		getTokenAllowances,
		resolveContractAddress,
		validateAddress,
		getDeFiVenues,
		getSwapQuote,
		getLiquidityPools,
		evaluateTransactionRisk,
		simulateTransaction,
		debugRpcError,
		queryHistoricalData,
		getContractTemplate,
		validateContractArchitecture,
		getDeploymentChecklist,
		prepareDeploymentPackage,
		getCounterState,
		counterIncrement,
		counterIncrementBy,
		counterReset,
		sendNativeToken,
		approveERC20Token,
		executeAgniSwap,
	},
	memory: new Memory(),
});
