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
- [GitHub Mantle Agent SKILL](https://github.com/mantle-xyz/mantle-skills)
- [mantle-xyz/mantle-agent-scaffold](https://github.com/mantle-xyz/mantle-agent-scaffold)
- [MCPサーバーの設定](https://mantle-xyz.github.io/mantle-agent-scaffold/)
- [Mantle チュートリアル](https://mantlenetworkio.github.io/mantle-tutorial/)
- [Mantle 公式ドキュメント](https://docs.mantle.xyz/network/introduction/overview)
- [MantleScan](https://mantlescan.xyz/)
- [DeepWiki Mantle Skill](https://deepwiki.com/mantle-xyz/mantle-skills)
- [DeepWiki Mantle mantle-agent-scaffold](https://deepwiki.com/mantle-xyz/mantle-agent-scaffold?tab=readme-ov-file)
- [Testnet Agni Finance](https://testnet.agni.finance/swap?chain=mantleTestnet)
- [DeepWikiによるAgent SKILLの解説](https://deepwiki.com/search/_4f85863f-b448-4e68-9434-d8359422dc11)
- [DeepWikiによるAgent SKILLの解説2](https://deepwiki.com/search/_c3d846fa-32bd-4117-8d5f-62c82e51d159)