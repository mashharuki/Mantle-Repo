import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Counter デプロイモジュール（Hardhat Ignition）
 *
 * 使い方:
 *   # ローカル（シミュレーション）
 *   npx hardhat ignition deploy ignition/modules/Counter.ts
 *
 *   # Mantle Sepolia Testnet
 *   npx hardhat ignition deploy ignition/modules/Counter.ts --network mantleSepolia
 *
 *   # Mantle Mainnet（本番環境）
 *   npx hardhat ignition deploy ignition/modules/Counter.ts --network mantleMainnet
 *
 * 注意: Mantleのガストークンはガス代としてMNT（ETHではない）が必要。
 * デプロイ前にウォレットに十分なMNTがあることを確認してください。
 */
const CounterModule = buildModule("CounterModule", (m) => {
  // Counterコントラクトをデプロイ
  const counter = m.contract("Counter");

  // デプロイ後に初期値を5に設定（オプション）
  // m.call(counter, "incBy", [5n]);

  return { counter };
});

export default CounterModule;
