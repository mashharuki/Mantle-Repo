import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const CONTRACT_TEMPLATES: Record<
	string,
	{
		templateName: string;
		description: string;
		openZeppelinBase: string;
		keyConsiderations: string[];
		mantleSpecificNotes: string[];
		recommendedSolidityVersion: string;
	}
> = {
	erc20: {
		templateName: "ERC-20 Token",
		description:
			"Standard fungible token contract with optional minting, burning, and access control.",
		openZeppelinBase: "@openzeppelin/contracts/token/ERC20/ERC20.sol",
		keyConsiderations: [
			"Decide on fixed vs. mintable supply",
			"Add AccessControl or Ownable for minting rights",
			"Consider ERC20Permit for gasless approvals",
			"Implement ERC20Burnable if burn is needed",
		],
		mantleSpecificNotes: [
			"Gas is paid in MNT — wallet setup must use MNT, not ETH",
			"Use chain ID 5000 (mainnet) or 5003 (Sepolia testnet)",
			"Verify token appears on https://token-list.mantle.xyz after deployment",
		],
		recommendedSolidityVersion: "^0.8.23",
	},
	erc721: {
		templateName: "ERC-721 NFT",
		description:
			"Non-fungible token with URI storage and optional enumerable extension.",
		openZeppelinBase:
			"@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol",
		keyConsiderations: [
			"Decide on metadata storage (on-chain URI vs IPFS vs centralized)",
			"Add ERC721Enumerable if enumeration is needed (higher gas)",
			"Implement royalty support via ERC2981",
			"Consider access control for minting",
		],
		mantleSpecificNotes: [
			"Gas is paid in MNT",
			"IPFS metadata is recommended for decentralized storage",
			"Verify Mantle NFT marketplaces support your contract interface",
		],
		recommendedSolidityVersion: "^0.8.23",
	},
	proxy_upgradeable: {
		templateName: "Transparent Proxy (Upgradeable)",
		description:
			"Upgradeable contract pattern using OpenZeppelin's TransparentUpgradeableProxy.",
		openZeppelinBase:
			"@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol",
		keyConsiderations: [
			"Use initializer instead of constructor",
			"Avoid storage collisions — never reorder storage variables",
			"Implement ProxyAdmin for upgrade access control",
			"Run OpenZeppelin upgrade safety checks before each upgrade",
			"Store implementation address in EIP-1967 slot",
		],
		mantleSpecificNotes: [
			"Deployer must pay MNT gas for both proxy and implementation deployment",
			"Hand off ProxyAdmin ownership to a multisig before mainnet launch",
			"Use Hardhat Ignition modules for deterministic upgrade tracking",
		],
		recommendedSolidityVersion: "^0.8.23",
	},
	access_control: {
		templateName: "Access Control Module",
		description: "Role-based access control using OpenZeppelin AccessControl.",
		openZeppelinBase: "@openzeppelin/contracts/access/AccessControl.sol",
		keyConsiderations: [
			"Define roles as bytes32 constants (keccak256 of role name)",
			"Assign DEFAULT_ADMIN_ROLE to a multisig, not an EOA",
			"Use AccessControlEnumerable if role enumeration is needed",
			"Implement role transfer via two-step pattern for critical roles",
		],
		mantleSpecificNotes: [
			"On mainnet, use a Gnosis Safe or similar multisig for admin roles",
			"Include Mantle-specific addresses (bridge, L2 contracts) as role holders only after verification",
		],
		recommendedSolidityVersion: "^0.8.23",
	},
	vault: {
		templateName: "Asset Vault / Escrow",
		description:
			"Contract that holds and manages ERC-20 or native token assets on behalf of users.",
		openZeppelinBase: "@openzeppelin/contracts/security/ReentrancyGuard.sol",
		keyConsiderations: [
			"Use ReentrancyGuard on all withdrawal functions",
			"Implement CEI (Checks-Effects-Interactions) pattern strictly",
			"Audit all token transfer paths including fee-on-transfer tokens",
			"Add emergency pause mechanism",
			"Consider upgradeability for future parameter adjustments",
		],
		mantleSpecificNotes: [
			"Native token on Mantle is MNT — use msg.value for native deposits",
			"WMNT (0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8) is the wrapped version",
			"Verify contract with Mantlescan after deployment for transparency",
		],
		recommendedSolidityVersion: "^0.8.23",
	},
	bridge_receiver: {
		templateName: "L1→L2 Bridge Message Receiver",
		description:
			"Contract that receives and processes messages from the Mantle L1 bridge.",
		openZeppelinBase: "@openzeppelin/contracts/access/Ownable.sol",
		keyConsiderations: [
			"Only accept calls from the official Mantle L2 CrossDomainMessenger",
			"Implement message replay protection (nonce or message hash tracking)",
			"Handle cross-domain reentrancy carefully",
			"Validate msg.sender against the official messenger address",
		],
		mantleSpecificNotes: [
			"Official L2 messenger address: verify at https://docs.mantle.xyz/network/system-information/off-chain-system/key-l2-contract-address",
			"L1 messenger address: verify at https://docs.mantle.xyz/network/system-information/on-chain-system/key-l1-contract-address",
			"Test extensively on Sepolia testnet (chain ID 5003) before mainnet (5000)",
		],
		recommendedSolidityVersion: "^0.8.23",
	},
};

export const getContractTemplate = createTool({
	id: "get-contract-template",
	description:
		"Get contract architecture template metadata for common Mantle smart contract patterns. Returns OpenZeppelin base contracts, key design considerations, and Mantle-specific notes. No code generation — provides structural guidance only.",
	inputSchema: z.object({
		contractType: z
			.enum([
				"erc20",
				"erc721",
				"proxy_upgradeable",
				"access_control",
				"vault",
				"bridge_receiver",
			])
			.describe("Type of contract to get template for"),
		features: z
			.array(z.string())
			.optional()
			.describe(
				"Optional list of features to include (e.g. 'mintable', 'burnable', 'pausable')",
			),
	}),
	outputSchema: z.object({
		templateName: z.string(),
		description: z.string(),
		openZeppelinBase: z.string(),
		keyConsiderations: z.array(z.string()),
		mantleSpecificNotes: z.array(z.string()),
		recommendedSolidityVersion: z.string(),
		featureNotes: z.array(z.string()).optional(),
		nextSteps: z.array(z.string()),
	}),
	execute: async (inputData) => {
		const contractType = inputData.contractType;
		const features = inputData.features ?? [];
		const template = CONTRACT_TEMPLATES[contractType];

		const featureNotes = features.map((f) => {
			const fLower = f.toLowerCase();
			if (fLower === "mintable")
				return "Add ERC20/721Mintable or custom mint function with access control";
			if (fLower === "burnable")
				return "Add ERC20Burnable or ERC721Burnable extension";
			if (fLower === "pausable")
				return "Add Pausable extension with emergency pause modifier on state-changing functions";
			if (fLower === "snapshot")
				return "Add ERC20Snapshot for historical balance queries (useful for governance)";
			if (fLower === "permit")
				return "Add ERC20Permit for gasless approvals via signature";
			if (fLower === "votes")
				return "Add ERC20Votes for governance voting power tracking";
			return `Feature "${f}" — review OpenZeppelin extensions for compatible implementations`;
		});

		const nextSteps = [
			"Use validateContractArchitecture tool to review your specific configuration",
			"Implement using the OpenZeppelin Contracts Wizard: https://wizard.openzeppelin.com/",
			"Run Slither or similar static analysis before audit",
			"Test on Mantle Sepolia (chain ID 5003) before mainnet deployment",
			"After deployment, run getDeploymentChecklist tool to verify readiness",
		];

		return {
			...template,
			featureNotes: featureNotes.length > 0 ? featureNotes : undefined,
			nextSteps,
		};
	},
});

export const validateContractArchitecture = createTool({
	id: "validate-contract-architecture",
	description:
		"Review a smart contract specification against the Mantle development checklist. Returns a pass/needs_review/blocked verdict with itemized checklist results and specific recommendations.",
	inputSchema: z.object({
		contractName: z.string().describe("Name of the contract being reviewed"),
		contractType: z
			.string()
			.describe("Type/purpose of the contract (e.g. token, vault, bridge)"),
		targetEnvironment: z
			.enum(["mainnet", "testnet"])
			.describe("Deployment target environment"),
		isUpgradeable: z
			.boolean()
			.describe("Whether the contract uses an upgradeable proxy pattern"),
		holdsAssets: z
			.boolean()
			.describe("Whether the contract holds user funds or tokens"),
		externalDependencies: z
			.array(z.string())
			.optional()
			.describe("List of external contract addresses or protocol dependencies"),
		accessControlModel: z
			.string()
			.optional()
			.describe(
				"Access control model (e.g. 'Ownable', 'AccessControl with multisig', 'no-auth')",
			),
		solidityVersion: z
			.string()
			.optional()
			.describe("Solidity compiler version being used"),
		hasAudit: z
			.boolean()
			.optional()
			.describe("Whether a security audit has been performed"),
	}),
	outputSchema: z.object({
		overallResult: z.enum(["ready", "needs_review", "blocked"]),
		checklistItems: z.array(
			z.object({
				category: z.string(),
				check: z.string(),
				status: z.enum(["pass", "warn", "fail", "needs_input"]),
				detail: z.string(),
			}),
		),
		blockers: z.array(z.string()),
		warnings: z.array(z.string()),
		recommendations: z.array(z.string()),
	}),
	execute: async (inputData) => {
		const {
			contractName,
			contractType,
			targetEnvironment,
			isUpgradeable,
			holdsAssets,
			externalDependencies,
			accessControlModel,
			solidityVersion,
			hasAudit,
		} = inputData;

		type Status = "pass" | "warn" | "fail" | "needs_input";
		const items: Array<{
			category: string;
			check: string;
			status: Status;
			detail: string;
		}> = [];

		// Environment check
		items.push({
			category: "Environment",
			check: "Target network configured",
			status: "pass",
			detail: `Target: ${targetEnvironment} (chain ID ${targetEnvironment === "mainnet" ? 5000 : 5003}).`,
		});

		// Solidity version
		if (!solidityVersion) {
			items.push({
				category: "Compilation",
				check: "Solidity version",
				status: "needs_input",
				detail:
					"Solidity version not specified. Recommended: v0.8.23 or below per Mantle docs (snapshot 2026-03-08).",
			});
		} else {
			const versionNum = parseFloat(
				solidityVersion.replace("^", "").replace("~", "").replace(">=", ""),
			);
			if (versionNum > 0.823) {
				items.push({
					category: "Compilation",
					check: "Solidity version",
					status: "warn",
					detail: `Solidity ${solidityVersion} — Mantle docs recommend v0.8.23 or below (snapshot 2026-03-08). Live-verify compatibility.`,
				});
			} else {
				items.push({
					category: "Compilation",
					check: "Solidity version",
					status: "pass",
					detail: `Solidity ${solidityVersion} is within recommended range.`,
				});
			}
		}

		// Gas token
		items.push({
			category: "Mantle-Specific",
			check: "Gas token awareness",
			status: "warn",
			detail:
				"Verify all gas-related logic uses MNT, not ETH. Deployer wallet must hold MNT for gas fees.",
		});

		// Access control
		if (!accessControlModel) {
			items.push({
				category: "Security",
				check: "Access control",
				status: "needs_input",
				detail:
					"No access control model specified. Define who can call admin functions (recommend Ownable or AccessControl with multisig).",
			});
		} else if (
			accessControlModel.toLowerCase().includes("no-auth") ||
			accessControlModel.toLowerCase().includes("none")
		) {
			items.push({
				category: "Security",
				check: "Access control",
				status: "fail",
				detail:
					"No access control detected. All state-changing functions accessible to anyone — this is a critical security risk.",
			});
		} else if (
			accessControlModel.toLowerCase().includes("multisig") ||
			accessControlModel.toLowerCase().includes("gnosis")
		) {
			items.push({
				category: "Security",
				check: "Access control",
				status: "pass",
				detail: `Access control: ${accessControlModel}. Multisig is recommended for production.`,
			});
		} else if (
			accessControlModel.toLowerCase().includes("eoa") ||
			accessControlModel.toLowerCase().includes("deployer")
		) {
			items.push({
				category: "Security",
				check: "Access control",
				status: "warn",
				detail: `Access control: ${accessControlModel}. Single EOA admin is risky. Migrate to multisig before mainnet.`,
			});
		} else {
			items.push({
				category: "Security",
				check: "Access control",
				status: "pass",
				detail: `Access control model: ${accessControlModel}.`,
			});
		}

		// Upgradeability
		if (isUpgradeable) {
			items.push({
				category: "Upgradeability",
				check: "Proxy pattern checks",
				status: "warn",
				detail:
					"Upgradeable proxy in use. Ensure: (1) no constructors (use initializers), (2) storage layout preserved across upgrades, (3) ProxyAdmin controlled by multisig.",
			});
		} else {
			items.push({
				category: "Upgradeability",
				check: "Immutable contract",
				status: "pass",
				detail: "Non-upgradeable contract. Simpler security model.",
			});
		}

		// Asset holding
		if (holdsAssets) {
			items.push({
				category: "Security",
				check: "Asset holding contract security",
				status: "warn",
				detail: `${contractName} holds user assets. Required: (1) ReentrancyGuard, (2) CEI pattern, (3) emergency pause, (4) security audit.`,
			});
			if (!hasAudit) {
				items.push({
					category: "Security",
					check: "Audit status",
					status: "fail",
					detail:
						"Contract holds assets but no audit has been performed. A security audit is mandatory before mainnet deployment.",
				});
			} else {
				items.push({
					category: "Security",
					check: "Audit status",
					status: "pass",
					detail: "Audit performed.",
				});
			}
		}

		// External dependencies
		if (externalDependencies && externalDependencies.length > 0) {
			items.push({
				category: "Dependencies",
				check: "External contract dependencies",
				status: "warn",
				detail: `${externalDependencies.length} external dependency/dependencies: ${externalDependencies.join(", ")}. Verify each against the Mantle address registry before deployment. Use resolveContractAddress tool.`,
			});
		}

		// Mainnet additional check
		if (targetEnvironment === "mainnet" && !hasAudit && holdsAssets) {
			items.push({
				category: "Mainnet Readiness",
				check: "Pre-mainnet audit",
				status: "fail",
				detail:
					"Cannot deploy asset-holding contract to mainnet without audit. Complete testnet deployment and audit first.",
			});
		}

		const failItems = items.filter((i) => i.status === "fail");
		const warnItems = items.filter((i) => i.status === "warn");
		const needsInputItems = items.filter((i) => i.status === "needs_input");

		let overallResult: "ready" | "needs_review" | "blocked";
		if (failItems.length > 0) {
			overallResult = "blocked";
		} else if (warnItems.length > 0 || needsInputItems.length > 0) {
			overallResult = "needs_review";
		} else {
			overallResult = "ready";
		}

		const recommendations: string[] = [
			"Run `getContractTemplate` for architecture guidance specific to your contract type",
			"Use OpenZeppelin Contracts Wizard for audited base implementations",
			`Test on Mantle ${targetEnvironment === "mainnet" ? "Sepolia testnet first, then " : ""}mainnet`,
			"Run Slither static analysis: `slither . --filter-paths=node_modules`",
		];

		if (
			contractType.includes("defi") ||
			contractType.includes("swap") ||
			contractType.includes("vault")
		) {
			recommendations.push(
				"Consider Mantle-specific DeFi security review (MEV, sandwich protection)",
			);
		}

		return {
			overallResult,
			checklistItems: items,
			blockers: failItems.map((i) => i.detail),
			warnings: warnItems.map((i) => i.detail),
			recommendations,
		};
	},
});
