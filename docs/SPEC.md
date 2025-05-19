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
- MCPは **AIが内部的にAPIリクエストを通じてファイル取得・保存を行う** ことを前提とした設計。
- ファイルシステムの直接アクセスを排除し、安全な抽象化レイヤーを提供。
- 除外ファイル設定 (`excluded_files`) はグローバルおよびプロジェクト別に設定可能。

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

設定ファイルを ~/.config/mcp-code/config.json で取り扱う

## 設定ファイル構造 (`config.json`)

```json
{
  "debug": true,
  "log_path": "/path/to/global/logs",
  "excluded_files": ["**/*.pem", "**/*.key"],
  "rate_limit": {
    "global": 60,
    "projects": {
      "project1": 30,
      "project2": 100
    }
  },
  "projects": {
    "project1": {
      "src": "/path/to/project1/src",
      "config": "/path/to/project1/config",
      "logs": "/path/to/project1/logs",
      "excluded_files": ["**/.env", "logs/**/*.log"]
    }
  }
}
```

- `projects`: 各プロジェクトのディレクトリ構造を設定。
- `excluded_files`: 除外ファイル設定。グローバル設定とプロジェクト別設定の両方をサポート。
- `rate_limit`: グローバルおよびプロジェクト別のリクエストリミット設定をサポート。

## ファイル操作

1. 操作対象：
   • プロジェクト設定のパス配下のファイルのみが対象。
   • 除外ファイル（excluded_files）で指定されたファイル・ディレクトリは 操作不可。
2. 許可される操作一覧：
   • 取得 (GET)： 指定ファイルの内容を取得する。
   • 更新 (PUT)： 指定ファイルの内容を上書きまたは新規作成する。
   • 一覧取得 (LIST)： ディレクトリ内のファイル・ディレクトリ一覧を取得する。
   • 削除 (DELETE)： 指定ファイルを削除する。
   • コピー (COPY)： 指定ファイルを別のパスにコピーする。

## API設計一覧

| エンドポイント | メソッド | 説明             | 制約事項                                   |
| -------------- | -------- | ---------------- | ------------------------------------------ |
| `/files`       | `GET`    | ファイル取得     | 除外ファイルは取得不可                     |
| `/files`       | `PUT`    | ファイル更新     | 除外ファイルには書き込み不可               |
| `/files`       | `DELETE` | ファイル削除     | 除外ファイルは削除不可                     |
| `/files/copy`  | `POST`   | ファイルコピー   | コピー元およびコピー先が除外対象でないこと |
| `/files/list`  | `GET`    | ファイル一覧取得 | 除外ファイルは一覧に含まれない             |

### 1. `/api/data`

- メソッド：GET, PUT
- リクエスト形式：

  - `GET`:

    ```json
    {
      "project": "project1",
      "path": "src/main.py"
    }
    ```

  - `PUT`:

    ```json
    {
      "project": "project1",
      "path": "src/main.py",
      "content": "print('Hello, AI')"
    }
    ```

### 2. `/api/files`

- メソッド：GET

- 説明：ファイル一覧を取得

- リクエスト形式：

  ```json
  {
    "project": "project1",
    "path": "src/",
    "recursive": true,
    "max_depth": 3,
    "sort": "name",
    "filter": { "excluded": false }
  }
  ```

- `recursive`: サブディレクトリを含めるか。

- `max_depth`: 再帰取得の深さ。

- `sort`: "name" | "size" | "last_modified"

- `filter`: `excluded`（除外ファイルの表示有無）

**レスポンス例：**

```json
{
  "status": 200,
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

**エラーコード:**

- `400 Bad Request`: 無効なリクエスト形式
- `401 Unauthorized`: 認証エラー（APIキーが無効）
- `403 Forbidden`: 除外ファイルへのアクセス試行
- `404 Not Found`: ファイルが存在しない
- `422 Unprocessable Entity`: ファイル構造エラー
- `429 Too Many Requests`: リクエスト制限超過
- `500 Internal Server Error`: ファイルの読み取り/書き込みエラー

## 除外ファイル設定

- `excluded_files` セクションにワイルドカード (`**`) を使用可能。
- プロジェクトごとに異なる設定が可能。

**例：**

```json
"excluded_files": [
  "**/.env",
  "**/*.pem",
  "logs/**/*.log"
]
```

**プロジェクトごとの設定例：**

```json
"projects": {
  "project1": {
    "excluded_files": ["**/.env", "logs/**/*.log"]
  }
}
```

- 除外ファイルへのアクセス試行時には **403エラー** を返却し、詳細をログに記録。

## エラーログ出力

- MCPの全てのリクエストとエラーは `/logs/mcp.log` に記録。
- ログは JSON 形式で出力される。

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
