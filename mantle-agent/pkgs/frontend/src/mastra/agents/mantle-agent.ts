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
import { queryHistoricalData } from "../tools/data-indexer-tool";
import { debugRpcError } from "../tools/debugger-tool";
import {
	getDeFiVenues,
	getSwapQuote,
	getLiquidityPools,
} from "../tools/defi-tools";
import {
	sendNativeToken,
	approveERC20Token,
	executeAgniSwap,
} from "../tools/defi-write-tools";
import { getMantleNetworkInfo } from "../tools/network-primer-tool";
import { getWalletBalance, getTokenAllowances } from "../tools/portfolio-tools";
import { evaluateTransactionRisk } from "../tools/risk-evaluator-tool";
import { simulateTransaction } from "../tools/tx-simulator-tool";
import {
	getCounterState,
	counterIncrement,
	counterIncrementBy,
	counterReset,
} from "../tools/counter-tools";

const SYSTEM_PROMPT = `You are the Mantle Network AI Agent — a specialized assistant for developers, traders, and power users building on Mantle, an Ethereum L2 network.

Use workspace-loaded Mantle skills as the primary source of domain procedures and safety checklists.

## Critical constraints

1. Mantle gas token is MNT (not ETH).
2. Mainnet chain ID is 5000 and Sepolia testnet chain ID is 5003.
3. Distinguish inclusion from L1 settlement finality.
4. When write operations are requested (send, swap, increment Counter), use the agent wallet tools — but always confirm the intent with the user before executing irreversible transactions.
5. Default network for write operations is Sepolia testnet for safety.

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
  - Mainnet (chainId 5000): SwapRouter 0x319B6988..., QuoterV2 0xc4aaDc92...

## Tool policy

- Use tools when live data, simulation, or external lookups are required.
- Prefer registry/tool outputs over memory for addresses and time-sensitive values.
- Before simulation, run risk evaluation first.
- Before executing swaps, explain the route and estimated output to the user.

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
	model: "google/gemini-3.1-flash-lite-preview",
	tools: {
		getMantleNetworkInfo,
		getWalletBalance,
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
