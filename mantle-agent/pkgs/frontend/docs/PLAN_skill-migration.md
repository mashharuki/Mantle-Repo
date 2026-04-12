# Mastra: ツール直結から Workspace + Skills への移行実装計画

## 背景
現状の Mantle Agent は、Agent 定義に 16 個のツールを直接注入する構成です。
Mastra の Workspace 機能（skills パス指定）を使うことで、運用知識・手順・安全ガードを Skill として外部化し、Agent 本体を軽量化できます。

## 目的
- Agent の長大な instructions とツール直結依存を段階的に整理する
- Skill 駆動の応答品質を上げつつ、実行系は必要最小限のツールに限定する
- 既存 API 経路（chat route）を壊さずに移行する

## 結論（方針）
「ツールを完全廃止」ではなく、以下のハイブリッド構成を採用する。
- Skills: 判断ロジック、チェックリスト、説明テンプレート、ドメイン手順
- Tools: ライブデータ取得、外部照会、シミュレーションなどの実行処理

## スコープ
### 対象
- `src/mastra/index.ts`
- `src/mastra/agents/mantle-agent.ts`
- Skill 読み込み対象ディレクトリ（初期は既存 `.claude/skills` から一部選定）

### 非対象（初期フェーズ）
- 16 ツールの全廃
- API route の大幅変更
- UI 側メッセージ仕様変更

## 実装ステップ
1. 依存と API 前提確認（0.5 日）
- `@mastra/core` で Workspace/skills が利用可能かを再確認
- 実行環境から参照可能な skills パスを確定

2. Workspace を Mastra 初期化へ導入（0.5 日）
- `src/mastra/index.ts` に Workspace を追加
- `skills` 配列で対象ディレクトリを指定
- 必要に応じて filesystem/sandbox を同時設定

3. Agent を Skill 併用構成へ移行（1 日）
- `src/mastra/agents/mantle-agent.ts` の instructions を短文化
- 運用ルールを Skill 側へ移譲
- 既存ツールは互換維持のため一旦温存

4. ツール責務の再分類（1 日）
- 16 ツールを以下に分類
  - A: Skill に寄せられる（知識・手順中心）
  - B: ツール継続（実行・照会中心）
- A から順に削減候補を作成

5. 回帰検証（1 日）
- 代表シナリオで比較評価
  - ネットワーク基礎 QA
  - アドレス解決/検証
  - リスク評価 → シミュレーション
  - デプロイ準備
- 指標
  - 回答品質（正確性・一貫性）
  - ツール呼び出し妥当性
  - 失敗時の説明可能性

6. 段階リリース（0.5 日）
- ステージング先行反映
- 問題なければ本番へ段階反映

## 変更イメージ（最小差分）
- `src/mastra/index.ts`
  - `workspace` を Mastra インスタンスに追加
- `src/mastra/agents/mantle-agent.ts`
  - instructions を短縮し Skill 前提の運用に変更
  - tools は初期は維持（破壊的変更回避）

## リスクと対策
1. Skill 参照パス不整合
- 対策: 起動時に存在チェック、ログで明示

2. Skill だけでは実行系が不足
- 対策: 実行系ツールは当面残す

3. 回答品質の揺れ
- 対策: 代表シナリオの回帰テストを固定化

## 完了条件（Definition of Done）
- Workspace + skills 読み込みが有効化されている
- 既存 chat API 経路で応答できる
- 代表シナリオで重大回帰がない
- 移行後の運用方針（Skill と Tool の責務）が文書化済み

## 推奨実行順（最短）
1. Workspace 導入（index.ts）
2. Agent instructions 短文化（mantle-agent.ts）
3. 16 ツールの A/B 分類表作成
4. 3 Skill から段階有効化
5. 回帰テスト
