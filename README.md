# MCP-Code

MCP-Codeは、プログラミング用途に特化したAPIフレームワークで、AIがAPIリクエストを通じてファイル操作を行うための安全なインターフェイスを提供します。

## 主な機能

### ファイル操作

- **ファイル読み取り**: ファイルの内容を取得
- **ファイル書き込み**: 新規ファイルの作成や既存ファイルの上書き
- **行編集**: 特定の行や範囲を編集
- **行挿入**: 指定位置に新しい行を挿入
- **行削除**: 指定行や範囲を削除
- **ファイル削除**: ファイルの削除
- **ディレクトリツリー**: プロジェクト構造のツリー表示（除外パターン指定可能）
- **ファイル一覧**: 指定ディレクトリのファイル一覧を取得（正規表現フィルタリング可能）
- **ファイル移動/リネーム**: ファイルの移動とリネーム機能
- **ファイル検索**: 内容やファイル名での検索（grepのような）

### スクリプト実行

- 設定ファイルで定義されたスクリプトのみを実行可能
- シェルアクセスを制限することで安全性を確保

### セキュリティ機能

- グローバルおよびプロジェクト別の除外ファイル設定
- パスの正規化によるディレクトリトラバーサル攻撃の防止
- プロジェクトルート外へのアクセス制限

### データフォーマット対応

- JSON, YAML, XML, CSV, TOML などの様々なデータ形式を自動解析

### ロギング

- システムログの出力（`~/.local/state/mcp-code/logs/system/mcp-system-{YYYY-MM-DD}.log`）
- リクエストログの出力（`~/.local/state/mcp-code/logs/request/mcp-request-{YYYY-MM-DD}.log`）
- 日付ごとのログファイル管理
- 古いログファイルの自動クリーンアップ（デフォルト30日）

## 設定ファイル

MCP-Codeは `~/.config/mcp-code/config.yaml` に設定ファイルを配置します。

```yaml
log_path: '/path/to/logs'
excluded_files:
  - '**/*.pem'
  - '**/*.key'

current_project: 'project1'
projects:
  project1:
    src: '/path/to/project1/src'
    scripts:
      build: 'npm run build'
      test: 'npm run test'
    excluded_files:
      - '**/.env'
      - 'logs/**/*.log'
```

## セキュリティ上の注意事項

### スクリプト実行時の留意点

このツールはファイルアクセスを厳格に制限していますが、**設定されたスクリプト自体のセキュリティは保証していません**。

そのため使用に当たってはscriptの実行時に必ずファイルを確認してから実行してください。

具体的にはAIがファイルを編集した後、以下の点にご注意ください。

- **スクリプト実行前の確認**: `npm run test`等を実行する前に、package.jsonやテストファイルの内容を必ず確認
- **安全なスクリプトの推奨**: フォーマッター（`prettier`）、リンター（`eslint`）、型チェック（`tsc`）など、読み取り専用に近い操作を推奨
- **危険なスクリプトの避用**: ファイル削除、外部通信、システム変更を行うスクリプトは慎重に検討

もしくは設定ファイルの scripts を設定しないことで、スクリプト自体が登録されないように出来ます。

### 推奨セキュリティプラクティス

このツールでは以下の使い方を推奨しています。

1. **段階的確認**: AI編集→内容確認→スクリプト実行の順序を徹底
2. **最小権限原則**: 必要最小限のスクリプトのみを設定に含める
3. **定期的な監査**: ログファイルを定期的に確認し、意図しない操作がないかチェック

## ログパス

ログファイルは以下のパスに保存されます：

- システムログとリクエストログ: `~/.local/state/mcp-code/logs/mcp-{YYYY-MM-DD}.log`
- ログファイルは日付ごとに作成され、30日経過したファイルは自動的に削除されます

## 使い方

### インストール

```bash
# または、ソースからインストール
git clone https://github.com/your-username/mcp-code.git
cd mcp-code
npm install
npm run build
```

claude desktopなど

```json
{
  "mcpServers": {
    "mcp_code": {
      "command": "node",
      "args": ["/your/path/to/directory/mcp-code/dist/server.js"],
      "env": {}
    }
  }
}
```

### コマンドライン

```bash
# ビルド
npm run build

# 開発モード（インスペクターを使用）
npx @modelcontextprotocol/inspector npx tsx src/server.ts
```

### テスト実行

```bash
# 全テストを実行
npm test

# 特定のモジュールのテストのみを実行
npm run test:config    # 設定モジュールのテスト
npm run test:files     # ファイル操作モジュールのテスト
npm run test:safe-edit # 安全なファイル編集モジュールのテスト
npm run test:util      # ユーティリティモジュールのテスト
npm run test:script    # スクリプト実行モジュールのテスト
```

### プログラムからの利用

MCP-Codeは、Model Context Protocol (MCP) SDKを使用してLLM（大規模言語モデル）と連携するよう設計されています。以下のようなツールが用意されています：

- directoryTree: プロジェクトのファイルをツリー表示
- fileList: 指定ディレクトリのファイル一覧を取得
- fileReed: 指定ファイルの内容を取得
- fileWrite: 指定ファイルに書き込み
- fileDelete: 指定ファイルを削除
- fileInsertLine: 指定ファイルの指定行に追記
- fileEditLines: 指定ファイルの指定行を編集
- fileDeleteLines: 指定ファイルの特定行を削除
- script\_[name]: 設定ファイルで定義されたスクリプトを実行

## 技術スタック

- TypeScript
- Model Context Protocol SDK
- Node.js
- JavaScript/ECMAScript

## セキュリティ考慮事項

- 除外ファイル設定による機密ファイルの保護
- スクリプト実行の制限による安全性確保
- パス正規化による脆弱性対策

## テスト

プロジェクトには以下のモジュール別テストが含まれています：

- **設定モジュールテスト**: 設定ファイルの読み込みと検証
- **ファイル操作モジュールテスト**: ファイルの読み書き、一覧取得、ツリー表示
- **安全なファイル編集モジュールテスト**: 行編集と行削除の安全な実装
- **ユーティリティモジュールテスト**: パス操作、除外パターン、リクエストID生成
- **スクリプト実行モジュールテスト**: 外部コマンド実行とエラーハンドリング

各テストは独立して実行でき、特定の機能を集中的にテストすることができます。

## コントリビューション

プロジェクトへの貢献に興味がある方は、[CONTRIBUTING.md](CONTRIBUTING.md)をご覧ください。

## ライセンス

MCP-CodeはApache License 2.0の下で提供されています。詳細については[LICENSE](LICENSE)ファイルを参照してください。

### ライセンスの特徴

- 特許権の明示的な付与条項を含みます
- コードの修正や貢献に関する明確なルールを提供します
- 企業環境での使用に適しています

### 主要な依存ライブラリ

- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk): MIT ライセンス
- その他の依存ライブラリもMITまたはISC（MIT互換）ライセンスですが、Apache License 2.0はこれらと互換性があります。

## 今後追加する機能(予定)

### ファイル操作系

- **ファイルコピー** - `fileCopy` でファイルやディレクトリの複製
- **シンボリックリンク作成** - `createSymlink` でリンク作成

### コード解析系

- **構文チェック** - TypeScript/JavaScript/Python等の構文エラーチェック
- **依存関係解析** - import/requireの関係を可視化
- **TODO/FIXME抽出** - コメント内のTODOを一覧化
- **コード統計** - 行数、関数数、複雑度などの計測

### Git統合

- **Git操作** - `gitStatus`, `gitDiff`, `gitCommit`, `gitBranch` など
- **変更差分表示** - ファイルの変更点をより詳細に表示

### 開発支援

- **パッケージ管理** - `npm install`的な依存関係インストール
- **ログ監視** - リアルタイムでログファイル監視
- **プロセス管理** - 実行中のプロセス管理や停止

### ユーティリティ

- **ファイル比較** - 2つのファイルの差分表示
- **アーカイブ操作** - zip/tar等の作成・展開
- **ファイル権限変更** - chmod相当の機能
- **ディスク使用量** - フォルダサイズの計算
