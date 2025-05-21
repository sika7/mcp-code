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

- システムログとリクエストログの出力（`~/.local/state/mcp-code/logs/mcp-{YYYY-MM-DD}.log`）
- 日付ごとのログファイル管理
- 古いログファイルの自動クリーンアップ（デフォルト30日）

## 設定ファイル

MCP-Codeは `~/.config/mcp-code/config.yaml` に設定ファイルを配置します。

```yaml
log_path: "/path/to/logs"
excluded_files:
  - "**/*.pem"
  - "**/*.key"

current_project: "project1"
projects:
  project1:
    src: "/path/to/project1/src"
    scripts:
      build: "npm run build"
      test: "npm run test"
    excluded_files:
      - "**/.env"
      - "logs/**/*.log"
```

## ログパス

ログファイルは以下のパスに保存されます：

- システムログとリクエストログ: `~/.local/state/mcp-code/logs/mcp-{YYYY-MM-DD}.log`
- ログファイルは日付ごとに作成され、30日経過したファイルは自動的に削除されます

## 使い方

### インストール

```bash
# npmからインストール
npm install mcp-code

# または、ソースからインストール
git clone https://github.com/your-username/mcp-code.git
cd mcp-code
npm install
npm run build
```

### コマンドライン

```bash
# ビルド
npm run build

# 開発モード（インスペクターを使用）
npx @modelcontextprotocol/inspector npx tsx src/server.ts
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
- script_[name]: 設定ファイルで定義されたスクリプトを実行

## 技術スタック

- TypeScript
- Model Context Protocol SDK
- Node.js
- JavaScript/ECMAScript

## セキュリティ考慮事項

- 除外ファイル設定による機密ファイルの保護
- スクリプト実行の制限による安全性確保
- パス正規化による脆弱性対策

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