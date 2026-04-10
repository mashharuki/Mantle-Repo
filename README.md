# Mantle-Repo

This is Mantle repo

## 概要

イーサリアムL2 Mantleについての開発手法をまとめたリポジトリです。

## GitSubModuleのセットアップ

```bash
git submodule update --init --recursive
```

## MCPサーバーの起動方法

`mantle-agent-scaffold`配下で以下のコマンドを順番に実行する

```bash
pnpm i
```

ビルド

```bash
pnpm run skills:init
pnpm run build
```

## MCPクライアントの設定例

```json
{
  "mcpServers": {
    "mantle": {
      "type": "stdio",
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "MANTLE_MCP_TRANSPORT": "stdio",
        "MANTLE_RPC_URL": "https://rpc.mantle.xyz",
        "MANTLE_SEPOLIA_RPC_URL": "https://rpc.sepolia.mantle.xyz"
      }
    }
  }
}
```

## 参考文献
- [mantle-xyz/mantle-agent-scaffold](https://github.com/mantle-xyz/mantle-agent-scaffold)
- [MCPサーバーの設定](https://mantle-xyz.github.io/mantle-agent-scaffold/)
- [Mantle チュートリアル](https://mantlenetworkio.github.io/mantle-tutorial/)
- [Mantle 公式ドキュメント](https://docs.mantle.xyz/network/introduction/overview)
- [MantleScan](https://mantlescan.xyz/)
