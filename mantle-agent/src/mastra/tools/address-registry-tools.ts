import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// Registry data inlined to avoid cross-bundle import issues
const REGISTRY_UPDATED_AT = "2026-03-08T04:00:14Z";

interface RegistryContract {
	key: string;
	label: string;
	environment: "mainnet" | "testnet";
	category: string;
	address: string;
	status: string;
	is_official: boolean;
	aliases: string[];
	protocol_id: string;
	contract_role: string;
	supports: string[];
	source: { url: string; retrieved_at: string };
	notes?: string;
}

const REGISTRY_CONTRACTS: RegistryContract[] = [
	{
		key: "MERCHANT_MOE_ROUTER",
		label: "Merchant Moe Router",
		environment: "mainnet",
		category: "defi",
		address: "0xeaEE7EE68874218c3558b40063c42B82D3E7232a",
		status: "active",
		is_official: true,
		aliases: ["MoeRouter", "merchant_moe_router"],
		protocol_id: "merchant_moe",
		contract_role: "router",
		supports: ["swap", "add_liquidity", "remove_liquidity"],
		source: {
			url: "https://docs.merchantmoe.com/resources/contracts",
			retrieved_at: "2026-03-08T04:00:14Z",
		},
		notes:
			"Curated Tier 1 DEX default on Mantle for classic AMM swap and LP flows.",
	},
	{
		key: "MERCHANT_MOE_LB_ROUTER",
		label: "Merchant Moe LB Router",
		environment: "mainnet",
		category: "defi",
		address: "0x013e138EF6008ae5FDFDE29700e3f2Bc61d21E3a",
		status: "active",
		is_official: true,
		aliases: ["LBRouter", "merchant_moe_lb_router"],
		protocol_id: "merchant_moe",
		contract_role: "router",
		supports: ["swap", "add_liquidity", "remove_liquidity"],
		source: {
			url: "https://docs.merchantmoe.com/resources/contracts",
			retrieved_at: "2026-03-08T04:00:14Z",
		},
		notes:
			"Curated Tier 1 DEX default on Mantle for Liquidity Book route planning.",
	},
	{
		key: "MERCHANT_MOE_LB_QUOTER",
		label: "Merchant Moe LB Quoter",
		environment: "mainnet",
		category: "defi",
		address: "0x501b8AFd35df20f531fF45F6f695793AC3316c85",
		status: "active",
		is_official: true,
		aliases: ["LBQuoter", "merchant_moe_lb_quoter", "merchant_moe_quoter"],
		protocol_id: "merchant_moe",
		contract_role: "quoter",
		supports: ["quote"],
		source: {
			url: "https://docs.merchantmoe.com/resources/contracts",
			retrieved_at: "2026-03-08T04:00:14Z",
		},
		notes: "Verified quoting helper for Merchant Moe Liquidity Book routes.",
	},
	{
		key: "AGNI_ROUTER",
		label: "Agni Swap Router",
		environment: "mainnet",
		category: "defi",
		address: "0x319B69888b0d11cEC22caA5034e25FfFBDc88421",
		status: "active",
		is_official: true,
		aliases: ["SwapRouter", "agni_router", "agni_swap_router"],
		protocol_id: "agni",
		contract_role: "router",
		supports: ["swap"],
		source: {
			url: "https://agni.finance/_next/static/chunks/pages/_app-9e7d79d3ffa0011c.js",
			retrieved_at: "2026-03-08T04:00:14Z",
		},
		notes:
			"Curated Tier 1 DEX default on Mantle from the official AGNI mainnet app config.",
	},
	{
		key: "AGNI_POSITION_MANAGER",
		label: "Agni Nonfungible Position Manager",
		environment: "mainnet",
		category: "defi",
		address: "0x218bf598D1453383e2F4AA7b14fFB9BfB102D637",
		status: "active",
		is_official: true,
		aliases: ["NonfungiblePositionManager", "agni_position_manager"],
		protocol_id: "agni",
		contract_role: "position_manager",
		supports: ["add_liquidity", "remove_liquidity", "position_management"],
		source: {
			url: "https://agni.finance/_next/static/chunks/pages/_app-9e7d79d3ffa0011c.js",
			retrieved_at: "2026-03-08T04:00:14Z",
		},
		notes:
			"Official AGNI v3-style position manager from the mainnet app address config.",
	},
	{
		key: "AGNI_QUOTER",
		label: "Agni Quoter V2",
		environment: "mainnet",
		category: "defi",
		address: "0xc4aaDc921E1cdb66c5300Bc158a313292923C0cb",
		status: "active",
		is_official: true,
		aliases: ["QuoterV2", "agni_quoter", "agni_quoter_v2"],
		protocol_id: "agni",
		contract_role: "quoter",
		supports: ["quote"],
		source: {
			url: "https://agni.finance/_next/static/chunks/pages/_app-9e7d79d3ffa0011c.js",
			retrieved_at: "2026-03-08T04:00:14Z",
		},
		notes: "Official AGNI QuoterV2 from the mainnet app address config.",
	},
	{
		key: "AAVE_V3_POOL",
		label: "Aave v3 Pool",
		environment: "mainnet",
		category: "defi",
		address: "0x458F293454fE0d67EC0655f3672301301DD51422",
		status: "active",
		is_official: true,
		aliases: ["Pool", "aave_v3_pool"],
		protocol_id: "aave_v3",
		contract_role: "pool",
		supports: ["supply", "withdraw", "borrow", "repay"],
		source: {
			url: "https://github.com/bgd-labs/aave-address-book/blob/main/src/AaveV3Mantle.sol",
			retrieved_at: "2026-03-08T04:00:14Z",
		},
		notes: "Curated Tier 1 lending default on Mantle.",
	},
	{
		key: "AAVE_V3_POOL_ADDRESSES_PROVIDER",
		label: "Aave v3 Pool Addresses Provider",
		environment: "mainnet",
		category: "defi",
		address: "0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f",
		status: "active",
		is_official: true,
		aliases: ["PoolAddressesProvider", "aave_v3_pool_addresses_provider"],
		protocol_id: "aave_v3",
		contract_role: "pool_addresses_provider",
		supports: ["lookup"],
		source: {
			url: "https://github.com/bgd-labs/aave-address-book/blob/main/src/AaveV3Mantle.sol",
			retrieved_at: "2026-03-08T04:00:14Z",
		},
		notes: "Official Aave v3 Mantle pool registry entry.",
	},
];

/** Lookup a contract entry in the registry by key, alias, or label */
export function lookupInRegistry(
	query: string,
	network: "mainnet" | "testnet",
	category: string,
): RegistryContract | null {
	const q = query.toLowerCase().trim();
	const envMap = { mainnet: "mainnet", testnet: "testnet" } as const;
	const env = envMap[network];

	const candidates = REGISTRY_CONTRACTS.filter(
		(c) =>
			c.environment === env && (category === "any" || c.category === category),
	);

	// Exact key match
	const byKey = candidates.find((c) => c.key.toLowerCase() === q);
	if (byKey) return byKey;

	// Alias match
	const byAlias = candidates.find((c) =>
		c.aliases.some((a) => a.toLowerCase() === q),
	);
	if (byAlias) return byAlias;

	// Label substring match
	const byLabel = candidates.find((c) => c.label.toLowerCase().includes(q));
	if (byLabel) return byLabel;

	// Protocol + role: e.g. "merchant_moe router"
	const parts = q.split(/\s+/);
	if (parts.length >= 2) {
		const byProtoRole = candidates.find(
			(c) =>
				parts.some((p) => c.protocol_id.toLowerCase().includes(p)) &&
				parts.some((p) => c.contract_role.toLowerCase().includes(p)),
		);
		if (byProtoRole) return byProtoRole;
	}

	// Single term protocol match
	const byProto = candidates.find((c) =>
		c.protocol_id.toLowerCase().includes(q),
	);
	if (byProto) return byProto;

	return null;
}

/** Basic EVM address format validation */
export function validateEVMAddress(address: string): {
	isValidFormat: boolean;
	isMixedCase: boolean;
} {
	const isValidFormat = /^0x[0-9a-fA-F]{40}$/.test(address);
	const hexPart = address.slice(2);
	const isMixedCase =
		hexPart !== hexPart.toLowerCase() && hexPart !== hexPart.toUpperCase();
	return { isValidFormat, isMixedCase };
}

export const resolveContractAddress = createTool({
	id: "resolve-contract-address",
	description:
		"Look up a verified Mantle protocol contract address by name, key, alias, or protocol. Returns address, role, source URL, and confidence from the registry snapshot (2026-03-08). Never guesses addresses.",
	inputSchema: z.object({
		query: z
			.string()
			.describe(
				"Contract key, label, alias, or protocol name (e.g. 'Merchant Moe Router', 'AGNI_QUOTER', 'aave pool')",
			),
		network: z
			.enum(["mainnet", "testnet"])
			.default("mainnet")
			.describe("Mantle network environment"),
		category: z
			.enum(["system", "token", "bridge", "defi", "any"])
			.default("any")
			.describe("Contract category filter"),
	}),
	outputSchema: z.object({
		found: z.boolean(),
		address: z.string().optional(),
		label: z.string().optional(),
		protocol: z.string().optional(),
		role: z.string().optional(),
		status: z.string().optional(),
		supports: z.array(z.string()).optional(),
		confidence: z.enum(["high", "medium", "low"]),
		sourceUrl: z.string().optional(),
		retrievedAt: z.string().optional(),
		registryUpdatedAt: z.string(),
		notes: z.string().optional(),
	}),
	execute: async (inputData) => {
		const query = inputData.query;
		const network = inputData.network ?? "mainnet";
		const category = inputData.category ?? "any";
		const envKey = network === "mainnet" ? "mainnet" : "testnet";
		const result = lookupInRegistry(query, envKey, category);

		if (!result) {
			return {
				found: false,
				confidence: "low" as const,
				registryUpdatedAt: REGISTRY_UPDATED_AT,
				notes: `No verified entry found for "${query}" on ${network}. Do not guess. Check official Mantle docs or specify a different query.`,
			};
		}

		// Assess freshness: if retrieved_at > 30 days from now, confidence drops
		const retrievedMs = new Date(result.source.retrieved_at).getTime();
		const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
		const confidence: "high" | "medium" | "low" =
			Date.now() - retrievedMs < thirtyDaysMs ? "high" : "medium";

		return {
			found: true,
			address: result.address,
			label: result.label,
			protocol: result.protocol_id,
			role: result.contract_role,
			status: result.status,
			supports: result.supports,
			confidence,
			sourceUrl: result.source.url,
			retrievedAt: result.source.retrieved_at,
			registryUpdatedAt: REGISTRY_UPDATED_AT,
			notes: result.notes,
		};
	},
});

export const validateAddress = createTool({
	id: "validate-address",
	description:
		"Validate an EVM address format and check it against the Mantle registry. Returns pass/warn/fail verdict with known label if found.",
	inputSchema: z.object({
		address: z.string().describe("EVM wallet or contract address to validate"),
		network: z
			.enum(["mainnet", "testnet"])
			.default("mainnet")
			.describe("Network context for registry lookup"),
	}),
	outputSchema: z.object({
		isValid: z.boolean(),
		isChecksum: z.boolean(),
		knownLabel: z.string().optional(),
		protocol: z.string().optional(),
		category: z.string().optional(),
		role: z.string().optional(),
		isZeroAddress: z.boolean(),
		verdict: z.enum(["pass", "warn", "fail"]),
		reason: z.string(),
	}),
	execute: async (inputData) => {
		const address = inputData.address;
		const network = inputData.network ?? "mainnet";

		const isZeroAddress =
			address === "0x0000000000000000000000000000000000000000";

		const { isValidFormat, isMixedCase } = validateEVMAddress(address);

		if (!isValidFormat) {
			return {
				isValid: false,
				isChecksum: false,
				isZeroAddress: false,
				verdict: "fail" as const,
				reason: "Address does not match EVM format (0x + 40 hex characters).",
			};
		}

		if (isZeroAddress) {
			return {
				isValid: true,
				isChecksum: false,
				isZeroAddress: true,
				verdict: "fail" as const,
				reason: "Zero address is not a valid target.",
			};
		}

		// Registry lookup
		const envKey = network === "mainnet" ? "mainnet" : "testnet";
		const knownContract = REGISTRY_CONTRACTS.find(
			(c) =>
				c.address.toLowerCase() === address.toLowerCase() &&
				c.environment === envKey,
		);

		if (knownContract) {
			return {
				isValid: true,
				isChecksum: isMixedCase,
				knownLabel: knownContract.label,
				protocol: knownContract.protocol_id,
				category: knownContract.category,
				role: knownContract.contract_role,
				isZeroAddress: false,
				verdict: "pass" as const,
				reason: `Address is a known verified contract: ${knownContract.label} (${knownContract.protocol_id}).`,
			};
		}

		return {
			isValid: true,
			isChecksum: isMixedCase,
			isZeroAddress: false,
			verdict: "warn" as const,
			reason:
				"Address format is valid but not found in the registry. Verify against official Mantle documentation before use.",
		};
	},
});

// Re-export registry for use by other tools
export { REGISTRY_CONTRACTS, REGISTRY_UPDATED_AT };
export type { RegistryContract };
