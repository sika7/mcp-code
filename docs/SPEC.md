---
title: "mcp-code 設計仕様"
author: "sika7"
tags: ["AST", "アーキテクチャ", "設計仕様"]
date: 2025-05-30
audience: ["開発者", "AIエージェント"]
---

# MCP API 設計仕様書

## 概要

- プログラミング用途に特化したAPI設計。
- MCPは **AIがAPIリクエストを通じてファイル操作を行う** ことを前提とした設計。
- shellスクリプトによるシステムの直接アクセスを排除し、安全なスクリプト実行レイヤーを提供。
- 除外ファイル設定 (`excluded_files`) はグローバルおよびプロジェクト別に設定可能。
- 実装言語 Rust

## ディレクトリ設計概要

```
/mcp-api/
├── Cargo.toml                  # プロジェクト設定ファイル
├── .env                        # 環境変数設定
├── /config/
│   ├── global.json             # グローバル設定ファイル
│   └── project1.json           # プロジェクト別設定ファイル
│
├── /logs/
│   ├── api.log                 # APIリクエストログ
│   └── error.log               # エラーログ
│
├── /src/
│   ├── main.rs                 # エントリーポイント
│   ├── config.rs               # 設定ファイルのパース
│   ├── logger.rs               # ログ出力
│   ├── routes/
│   │   ├── mod.rs              # ルーティングのエントリーポイント
│   │   ├── data.rs             # /api/data (GET, PUT)
│   │   └── files.rs            # /api/files (GET)
│   │
│   ├── controllers/
│   │   ├── data_controller.rs  # ファイル取得・保存ロジック
│   │   └── files_controller.rs # ファイル一覧取得ロジック
│   │
│   ├── middleware/
│   │   ├── auth.rs             # 認証ミドルウェア
│   │   └── rate_limit.rs       # レートリミットミドルウェア
│   │
│   └── utils/
│       ├── error_handler.rs    # エラーハンドリング
│       └── file_utils.rs       # ファイル操作ユーティリティ
│
└── /tests/
    └── api_tests.rs            # APIの統合テスト
```

設定ファイルを ~/.config/mcp-code/config.yaml で取り扱う

## 設定ファイル構造 (`config.yaml`)

```yaml
debug: true
log_path: "/path/to/global/logs"
excluded_files:
  - "**/*.pem"
  - "**/*.key"

rate_limit:
  global: 60
  projects:
    project1: 30
    project2: 100

projects:
  project1:
    src: "/path/to/project1/src"
    scripts:
      bild: "npm run build"
      test: "npm run test"
    excluded_files:
      - "**/.env"
      - "logs/**/*.log"
```

- `projects`: 各プロジェクトのディレクトリ構造を設定。
- `excluded_files`: 除外ファイル設定。グローバル設定とプロジェクト別設定の両方をサポート。
- `rate_limit`: グローバルおよびプロジェクト別のリクエストリミット設定をサポート。

### 除外ファイル設定

- `excluded_files` セクションにワイルドカード (`**`) を使用可能。
- プロジェクトごとに異なる設定が可能。

## MCPによるスクリプト操作

scriptsは設定ファイルにあるscriptsに記載したものだけ実行できる。

この設計によりsehellスクリプトでシステム操作を制限し安全性を高める。

※ テストファイルにスクリプトを仕込まれて実行される可能性あり。対策としては必ずファイルを確認してから実行すること。

## MCPによるファイル操作

1. 操作対象：
   • プロジェクト設定のパス配下のファイルのみが対象。
   • 除外ファイル（excluded_files）で指定されたファイル・ディレクトリは 操作不可。
2. 許可される操作一覧：
   • 取得 (GET)： 指定ファイルの内容を取得する。
   • 更新 (PUT)： 指定ファイルの内容を上書きまたは新規作成する。
   • 一覧取得 (LIST)： ディレクトリ内のファイル・ディレクトリ一覧を取得する。
   • 削除 (DELETE)： 指定ファイルを削除する。
   • コピー (COPY)： 指定ファイルを別のパスにコピーする。

- 除外ファイルへのアクセス試行時にはエラーを返却し、詳細をログに記録。

### ファイルの取得

リクエスト

```json
{
  "adapter": "file",
  "action": "get",
  "params": {
    "path": "output.txt"
  }
}
```

レスポンス

```json
{
  "status": "success",
  "data": "ファイルの内容"
}
```

### ファイルの更新

リクエスト

```json
{
  "adapter": "file",
  "action": "write",
  "params": {
    "path": "output.txt",
    "content": "Hello, MCP!"
  }
}
```

レスポンス

```json
{
  "status": "success",
  "data": "File written"
}
```

### ファイルの一覧の取得

リクエスト

```json
{
  "adapter": "file",
  "action": "list",
  "params": {
    "path": "src/",
    "recursive": true,
    "max_depth": 3,
    "sort": "name",
    "filter": { "excluded": false }
  }
}
```

- `recursive`: サブディレクトリを含めるか。
- `max_depth`: 再帰取得の深さ。
- `sort`: "name" | "size" | "last_modified"
- `filter`: `excluded`（除外ファイルの表示有無）

レスポンス

```json
{
  "status": "success",
  "files": [
    {
      "name": "main.py",
      "path": "src/main.py",
      "size": 123,
      "last_modified": "2025-05-23T12:00:00Z",
      "excluded": false
    },
    {
      "name": "config.json",
      "path": "src/config.json",
      "size": 456,
      "last_modified": "2025-05-23T11:00:00Z",
      "excluded": true
    }
  ]
}
```

## API設計

| エンドポイント | メソッド | 説明                |
| -------------- | -------- | ------------------- |
| `/mcp`         | `POST`   | MCPのエンドポイント |

## エラーログ出力

- MCPの全てのリクエストとエラーは `/logs/mcp.log` に記録。
- ログは JSON 形式で出力される。
- 他のプログラムとの連携を考えJSON

**ログ例：**

```json
{
  "timestamp": "2025-05-23T12:00:00Z",
  "status": 403,
  "message": "アクセスが許可されていないファイルです: .env",
  "project": "project1",
  "file": "/path/to/project1/.env",
  "request_id": "12345ABC"
}
```
