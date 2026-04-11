import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const NETWORK_CONFIG = {
	mainnet: {
		chainId: 5000,
		rpcUrl: process.env.MANTLE_RPC_MAINNET ?? "https://rpc.mantle.xyz",
		explorerUrl: "https://mantlescan.xyz/",
		explorerApiUrl: "https://api.mantlescan.xyz/api",
		gasToken: "MNT",
	},
	testnet: {
		chainId: 5003,
		rpcUrl: process.env.MANTLE_RPC_TESTNET ?? "https://rpc.sepolia.mantle.xyz",
		explorerUrl: "https://sepolia.mantlescan.xyz/",
		explorerApiUrl: "https://api-sepolia.mantlescan.xyz/api",
		gasToken: "MNT",
	},
};

export const getDeploymentChecklist = createTool({
	id: "get-deployment-checklist",
	description:
		"Run a pre-deployment checklist for a Mantle smart contract. Validates environment, compiler version, deployer address format, and constructor argument completeness. Returns itemized pass/fail/needs_input results and blockers.",
	inputSchema: z.object({
		contractName: z.string().describe("Name of the contract to deploy"),
		targetEnvironment: z
			.enum(["mainnet", "testnet"])
			.describe(
				"Deployment target (mainnet = chain 5000, testnet = chain 5003)",
			),
		deployerAddress: z
			.string()
			.optional()
			.describe("Deployer wallet address (EVM format)"),
		compilerVersion: z
			.string()
			.optional()
			.describe("Solidity compiler version (e.g. 0.8.23)"),
		constructorArgs: z
			.array(z.unknown())
			.optional()
			.describe("Constructor arguments array"),
		bytecodeAvailable: z
			.boolean()
			.optional()
			.describe("Whether the contract bytecode/artifact is available"),
		testnetDeploymentConfirmed: z
			.boolean()
			.optional()
			.describe(
				"Whether testnet deployment was successfully completed (required for mainnet)",
			),
	}),
	outputSchema: z.object({
		contractName: z.string(),
		targetEnvironment: z.string(),
		chainId: z.number(),
		allPassed: z.boolean(),
		items: z.array(
			z.object({
				category: z.string(),
				check: z.string(),
				status: z.enum(["pass", "fail", "needs_input", "warn"]),
				detail: z.string(),
			}),
		),
		blockers: z.array(z.string()),
		warnings: z.array(z.string()),
		nextStep: z.string(),
	}),
	execute: async (inputData) => {
		const {
			contractName,
			targetEnvironment,
			deployerAddress,
			compilerVersion,
			constructorArgs,
			bytecodeAvailable,
			testnetDeploymentConfirmed,
		} = inputData;

		const netConfig = NETWORK_CONFIG[targetEnvironment];
		type Status = "pass" | "fail" | "needs_input" | "warn";
		const items: Array<{
			category: string;
			check: string;
			status: Status;
			detail: string;
		}> = [];

		// 1. Environment confirmation
		items.push({
			category: "Environment",
			check: "Chain ID confirmation",
			status: "pass",
			detail: `Deploying to ${targetEnvironment} (chain ID ${netConfig.chainId}). RPC: ${netConfig.rpcUrl}`,
		});

		// 2. Testnet first rule
		if (targetEnvironment === "mainnet") {
			if (testnetDeploymentConfirmed === true) {
				items.push({
					category: "Process",
					check: "Testnet deployment",
					status: "pass",
					detail: "Testnet deployment confirmed before mainnet.",
				});
			} else if (testnetDeploymentConfirmed === false) {
				items.push({
					category: "Process",
					check: "Testnet deployment",
					status: "fail",
					detail:
						"Mainnet deployment requires successful testnet deployment first. Deploy and test on Mantle Sepolia (chain ID 5003).",
				});
			} else {
				items.push({
					category: "Process",
					check: "Testnet deployment",
					status: "needs_input",
					detail:
						"Confirm: has this contract been deployed and tested on Mantle Sepolia testnet?",
				});
			}
		} else {
			items.push({
				category: "Process",
				check: "Testnet deployment",
				status: "pass",
				detail: "Deploying to testnet — this IS the testnet deployment step.",
			});
		}

		// 3. Deployer address
		if (!deployerAddress) {
			items.push({
				category: "Signer",
				check: "Deployer address",
				status: "needs_input",
				detail:
					"Deployer address not provided. Supply the address of the wallet that will pay MNT gas.",
			});
		} else if (!/^0x[0-9a-fA-F]{40}$/.test(deployerAddress)) {
			items.push({
				category: "Signer",
				check: "Deployer address",
				status: "fail",
				detail: `Invalid deployer address format: "${deployerAddress}". Must be 0x + 40 hex characters.`,
			});
		} else {
			items.push({
				category: "Signer",
				check: "Deployer address",
				status: "pass",
				detail: `Deployer address format valid: ${deployerAddress}`,
			});
		}

		// 4. Compiler version
		if (!compilerVersion) {
			items.push({
				category: "Compilation",
				check: "Compiler version",
				status: "needs_input",
				detail:
					"Compiler version not specified. Recommended: 0.8.23 (from Mantle docs snapshot 2026-03-08).",
			});
		} else {
			const verNum = parseFloat(
				compilerVersion.replace("^", "").replace("~", "").replace("v", ""),
			);
			if (verNum > 0.823) {
				items.push({
					category: "Compilation",
					check: "Compiler version",
					status: "warn",
					detail: `Compiler ${compilerVersion} — Mantle recommends v0.8.23 or below. Verify compatibility.`,
				});
			} else {
				items.push({
					category: "Compilation",
					check: "Compiler version",
					status: "pass",
					detail: `Compiler version ${compilerVersion} is within recommended range.`,
				});
			}
		}

		// 5. Bytecode
		if (bytecodeAvailable === false) {
			items.push({
				category: "Artifacts",
				check: "Contract bytecode",
				status: "fail",
				detail:
					"Contract bytecode not available. Run `hardhat build` or `forge build` to compile the contract.",
			});
		} else if (bytecodeAvailable === true) {
			items.push({
				category: "Artifacts",
				check: "Contract bytecode",
				status: "pass",
				detail: "Contract bytecode available.",
			});
		} else {
			items.push({
				category: "Artifacts",
				check: "Contract bytecode",
				status: "needs_input",
				detail:
					"Confirm the contract has been compiled and bytecode artifact is available.",
			});
		}

		// 6. Constructor args
		if (constructorArgs === undefined || constructorArgs === null) {
			items.push({
				category: "Parameters",
				check: "Constructor arguments",
				status: "needs_input",
				detail:
					"Constructor arguments not provided. If the contract has no constructor, pass an empty array.",
			});
		} else {
			items.push({
				category: "Parameters",
				check: "Constructor arguments",
				status: "pass",
				detail: `Constructor arguments provided: ${JSON.stringify(constructorArgs)}`,
			});
		}

		// 7. Gas token reminder
		items.push({
			category: "Mantle-Specific",
			check: "Gas token",
			status: "warn",
			detail: `Gas is paid in MNT on Mantle. Ensure the deployer address (${deployerAddress ?? "TBD"}) has sufficient MNT balance before broadcasting.`,
		});

		// 8. Verification plan
		items.push({
			category: "Post-Deploy",
			check: "Explorer verification",
			status: "warn",
			detail: `Plan to verify the contract on ${netConfig.explorerUrl} after deployment. Use the Hardhat verify plugin or manual submission.`,
		});

		const failItems = items.filter((i) => i.status === "fail");
		const warnItems = items.filter((i) => i.status === "warn");
		const allPassed = failItems.length === 0;

		const nextStep =
			failItems.length > 0
				? `Resolve ${failItems.length} blocker(s) before proceeding.`
				: "All critical checks passed. Use prepareDeploymentPackage to create the deployment handoff for your external signer.";

		return {
			contractName,
			targetEnvironment,
			chainId: netConfig.chainId,
			allPassed,
			items,
			blockers: failItems.map((i) => i.detail),
			warnings: warnItems.map((i) => i.detail),
			nextStep,
		};
	},
});

export const prepareDeploymentPackage = createTool({
	id: "prepare-deployment-package",
	description:
		"Prepare an unsigned deployment handoff package for a Mantle contract. Creates a structured package with all deployment parameters for an external signer. Never executes a transaction — always hands off to a human signer.",
	inputSchema: z.object({
		contractName: z.string().describe("Contract name"),
		targetEnvironment: z
			.enum(["mainnet", "testnet"])
			.describe("Target network"),
		deployerAddress: z.string().describe("Deployer wallet address"),
		constructorArgs: z
			.array(z.unknown())
			.default([])
			.describe("Constructor arguments"),
		estimatedGasUnits: z
			.number()
			.optional()
			.describe("Estimated gas units from compilation or simulation"),
		compilerVersion: z
			.string()
			.default("0.8.23")
			.describe("Solidity compiler version"),
		optimizerEnabled: z
			.boolean()
			.default(true)
			.describe("Whether the optimizer was enabled during compilation"),
		optimizerRuns: z.number().default(200).describe("Optimizer runs setting"),
	}),
	outputSchema: z.object({
		packageReady: z.boolean(),
		contractName: z.string(),
		handoffSummary: z.string(),
		deploymentParams: z.object({
			chainId: z.number(),
			rpcUrl: z.string(),
			explorerUrl: z.string(),
			contractName: z.string(),
			constructorArgs: z.array(z.unknown()),
			compilerVersion: z.string(),
			optimizerEnabled: z.boolean(),
			optimizerRuns: z.number(),
			deployerAddress: z.string(),
			estimatedGasMnt: z.string().optional(),
		}),
		verificationPlan: z.object({
			explorerUrl: z.string(),
			verifyCommand: z.string(),
			requiredArtifacts: z.array(z.string()),
		}),
		nextStep: z.string(),
		warnings: z.array(z.string()),
		criticalReminders: z.array(z.string()),
	}),
	execute: async (inputData) => {
		const {
			contractName,
			targetEnvironment,
			deployerAddress,
			constructorArgs,
			estimatedGasUnits,
			compilerVersion,
			optimizerEnabled,
			optimizerRuns,
		} = inputData;

		const env = targetEnvironment;
		const netConfig = NETWORK_CONFIG[env];
		const warnings: string[] = [];

		// Validate deployer address format
		if (!/^0x[0-9a-fA-F]{40}$/.test(deployerAddress)) {
			return {
				packageReady: false,
				contractName,
				handoffSummary: `Invalid deployer address: "${deployerAddress}"`,
				deploymentParams: {
					chainId: netConfig.chainId,
					rpcUrl: netConfig.rpcUrl,
					explorerUrl: netConfig.explorerUrl,
					contractName,
					constructorArgs: constructorArgs ?? [],
					compilerVersion: compilerVersion ?? "0.8.23",
					optimizerEnabled: optimizerEnabled ?? true,
					optimizerRuns: optimizerRuns ?? 200,
					deployerAddress,
				},
				verificationPlan: {
					explorerUrl: netConfig.explorerUrl,
					verifyCommand: `npx hardhat verify --network ${env} <CONTRACT_ADDRESS> ${(constructorArgs ?? []).join(" ")}`,
					requiredArtifacts: [
						"Contract ABI",
						"Bytecode",
						"Constructor arguments",
						"Compiler settings",
					],
				},
				nextStep:
					"Fix the deployer address format before creating the package.",
				warnings: [`Invalid deployer address format: ${deployerAddress}`],
				criticalReminders: [],
			};
		}

		// Estimate gas cost in MNT (approximate at 0.02 Gwei gas price)
		let estimatedGasMnt: string | undefined;
		if (estimatedGasUnits) {
			const gasCostWei = BigInt(estimatedGasUnits) * BigInt(20_000_000); // 0.02 Gwei = 20e6 wei
			estimatedGasMnt = `~${(Number(gasCostWei) / 1e18).toFixed(6)} MNT`;
		} else {
			warnings.push(
				"No gas estimate provided. Obtain an estimate before deployment.",
			);
		}

		if (!estimatedGasMnt)
			warnings.push("Unable to estimate deployment cost without gas units.");

		const verifyCommand = `npx hardhat verify --network ${env === "mainnet" ? "mantle" : "mantleSepolia"} <CONTRACT_ADDRESS>${(constructorArgs ?? []).length > 0 ? ` ${(constructorArgs ?? []).map((a) => JSON.stringify(a)).join(" ")}` : ""}`;

		const handoffSummary = [
			`Contract: ${contractName}`,
			`Network: Mantle ${env === "mainnet" ? "Mainnet" : "Sepolia"} (chain ID ${netConfig.chainId})`,
			`Deployer: ${deployerAddress}`,
			`Compiler: Solidity ${compilerVersion ?? "0.8.23"} (optimizer: ${optimizerEnabled ? `enabled, ${optimizerRuns} runs` : "disabled"})`,
			`Constructor args: ${JSON.stringify(constructorArgs ?? [])}`,
			estimatedGasMnt
				? `Estimated gas cost: ${estimatedGasMnt}`
				: "Gas cost: not estimated",
		].join("\n");

		return {
			packageReady: true,
			contractName,
			handoffSummary,
			deploymentParams: {
				chainId: netConfig.chainId,
				rpcUrl: netConfig.rpcUrl,
				explorerUrl: netConfig.explorerUrl,
				contractName,
				constructorArgs: constructorArgs ?? [],
				compilerVersion: compilerVersion ?? "0.8.23",
				optimizerEnabled: optimizerEnabled ?? true,
				optimizerRuns: optimizerRuns ?? 200,
				deployerAddress,
				estimatedGasMnt,
			},
			verificationPlan: {
				explorerUrl: netConfig.explorerUrl,
				verifyCommand,
				requiredArtifacts: [
					"Contract ABI (from build artifacts)",
					"Contract bytecode hash",
					"Constructor arguments (ABI-encoded)",
					"Compiler version and settings",
				],
			},
			nextStep:
				"⚠️ This agent NEVER broadcasts transactions. Hand off this package to your external signer (hardware wallet, multisig, or CI/CD pipeline). After deployment, record the contract address and run source verification on the explorer.",
			warnings,
			criticalReminders: [
				"Verify the deployer wallet has sufficient MNT balance for gas before signing",
				"Confirm chain ID in your wallet matches the target (mainnet: 5000, testnet: 5003)",
				"Do NOT reuse a deployment nonce — verify the nonce is current",
				"After deployment, verify the source code on Mantlescan for transparency",
			],
		};
	},
});
