# Mantle Network × Hardhat 3 チュートリアル

Mantle Network上でスマートコントラクトを開発するための、Hardhat 3を使ったサンプルプロジェクトです。

## 前提条件

- Node.js v22以上
- pnpm（推奨）または npm

## セットアップ

```bash
# 依存パッケージのインストール
npm install

# 環境変数の設定
cp .env.example .env
# .env を編集してRPC URLと秘密鍵を設定
```

## コマンド一覧

```bash
# コントラクトのビルド（コンパイル）
npm run build
# または: npx hardhat build

# 全テスト実行
npm test

# Solidityテストのみ（Foundry互換）
npm run test:solidity

# TypeScriptテストのみ（Viem + node:test）
npm run test:ts

# ローカルノード起動
npm run node

# ローカル環境にデプロイ
npm run deploy:local

# Mantle Sepoliaテストネットにデプロイ
npm run deploy:mantle-sepolia
```

## プロジェクト構造

```
hardhat-sample/
├── hardhat.config.ts           # Hardhat 3設定（ESM、Mantle対応）
├── contracts/
│   ├── Counter.sol             # サンプルコントラクト
│   └── Counter.t.sol           # Solidityテスト（Foundry互換）
├── test/
│   └── Counter.ts              # TypeScriptテスト（Viem + node:test）
├── ignition/modules/
│   └── Counter.ts              # Hardhat Ignitionデプロイモジュール
├── .env.example                # 環境変数テンプレート
└── README.md
```

## Mantle Network 情報

| ネットワーク | Chain ID | RPC URL | エクスプローラー |
|------------|----------|---------|----------------|
| Mantle Mainnet | 5000 | https://rpc.mantle.xyz | https://explorer.mantle.xyz |
| Mantle Sepolia | 5003 | https://rpc.sepolia.mantle.xyz | https://explorer.sepolia.mantle.xyz |

> **重要**: MantleのガストークンはMNTです（ETHではありません）。
> デプロイ前に十分なMNTをウォレットに用意してください。
> テスト用MNTは [Mantle Faucet](https://faucet.sepolia.mantle.xyz) で取得できます。

## Hardhat 3のポイント（v2との違い）

| 項目 | Hardhat 2 | Hardhat 3 |
|------|-----------|-----------|
| モジュール形式 | CommonJS | ESM（必須） |
| プラグイン登録 | `import "@plugin"` | `plugins: [plugin]` |
| ビルド | `npx hardhat compile` | `npx hardhat build` |
| ネットワーク接続 | `hre.ethers` | `const { viem } = await network.connect()` |
| 初期化 | `npx hardhat init` | `npx hardhat --init` |

## テスト手法

### Solidityテスト（`Counter.t.sol`）
Foundry互換のインラインテスト。チートコード（`vm.prank`, `vm.expectRevert`等）が使えます。

```solidity
function test_Inc() public {
    counter.inc();
    assertEq(counter.x(), 1);
}

// ファズテスト（パラメータを持つと自動的にファズテストになる）
function testFuzz_IncBy(uint128 amount) public {
    vm.assume(amount > 0);
    counter.incBy(amount);
    assertEq(counter.x(), amount);
}
```

### TypeScriptテスト（`test/Counter.ts`）
Viem + node:testを使ったTypeScriptテスト。型安全なコントラクト操作ができます。

```typescript
const { viem, networkHelpers } = await network.connect();
const counter = await viem.deployContract("Counter");
await counter.write.inc();
assert.equal(await counter.read.x(), 1n);
```
