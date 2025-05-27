---
title: 'MCP-Code のツールガイド'
author: 'sika7'
tags: ['MCP-Code', 'ツールガイド']
date: 2025-05-30
audience: ['AIエージェント']
---

# MCP-Code AIツール使用ガイド

このガイドはAIエージェントがMCP-Codeツールを効果的に使用するためのベストプラクティスとよくある問題の解決方法をまとめています。

## 🎯 基本原則

### 1. 行番号指定のツールを使用する際の重要ルール

**⚠️ 重要**: 行編集・挿入・削除ツールは実行後にファイルの行番号が変わります。連続して同じファイルに操作を行う場合は、必ず最新のファイル内容を再読み込みしてください。

### 2. 複数行操作は一度にまとめて実行

複数の行を編集する場合は、個別に何度も実行せず、1回のツール呼び出しで複数行をまとめて処理してください。これによりエラーを防ぎ、効率的な操作が可能になります。

## 🛠️ 利用可能なツール

### ファイル探索・表示系

| ツール          | 用途                         | 主要パラメータ                                                    |
| --------------- | ---------------------------- | ----------------------------------------------------------------- |
| `directoryTree` | プロジェクト構造のツリー表示 | `path`, `exclude`                                                 |
| `fileList`      | ディレクトリ内のファイル一覧 | `path`, `filter`                                                  |
| `fileReed`      | ファイル内容の読み取り       | `filePath`, `startLine`, `endLine`, `maxLines`, `showLineNumbers` |

### 検索系

| ツール        | 用途                       | 主要パラメータ                   |
| ------------- | -------------------------- | -------------------------------- |
| `findInFile`  | 単一ファイル内検索（grep） | `filePath`, `pattern`, `options` |
| `projectGrep` | プロジェクト全体検索       | `pattern`, `options`             |

### ファイル編集系

| ツール              | 用途                   | 主要パラメータ                       | 注意点         |
| ------------------- | ---------------------- | ------------------------------------ | -------------- |
| `fileWrite`         | ファイル作成・上書き   | `filePath`, `content`                | -              |
| `editLinesInFile`   | 行の編集・置換         | `filePath`, `editlines`, `preview`   | 行番号変更あり |
| `insertLinesInFile` | 行の挿入               | `filePath`, `editlines`, `afterMode` | 行番号変更あり |
| `deleteLinesInFile` | 行の削除               | `filePath`, `editlines`              | 行番号変更あり |
| `fileDelete`        | ファイル削除           | `filePath`                           | -              |
| `fileMoveOrRename`  | ファイル移動・リネーム | `srcPath`, `distPath`                | -              |

### ディレクトリ操作系

| ツール            | 用途             | 主要パラメータ |
| ----------------- | ---------------- | -------------- |
| `createDirectory` | ディレクトリ作成 | `filePath`     |
| `removeDirectory` | ディレクトリ削除 | `filePath`     |

### スクリプト実行系

| ツール     | 用途                     | 説明                                           |
| ---------- | ------------------------ | ---------------------------------------------- |
| `script_*` | 設定されたスクリプト実行 | 設定ファイルで定義されたスクリプトのみ実行可能 |

## 📋 ベストプラクティス

### 1. ファイル編集の基本フロー

```
1. findInFile で対象箇所を検索
2. fileReed で現在の行番号を確認
3. editLinesInFile で編集実行
4. 続けて編集する場合は再度 fileReed で最新状態を確認
```

**例：関数名を変更する場合**

```javascript
// ❌ 悪い例：個別に何度も実行
editLinesInFile(file, [{ startLine: 10, endLine: 10, content: 'new line 10' }])
editLinesInFile(file, [{ startLine: 15, endLine: 15, content: 'new line 15' }]) // 行番号がずれてエラー

// ✅ 良い例：一度にまとめて実行
editLinesInFile(file, [
  { startLine: 10, endLine: 10, content: 'new line 10' },
  { startLine: 15, endLine: 15, content: 'new line 15' },
])
```

### 2. プレビュー機能の活用

`editLinesInFile` はデフォルトで `preview: true` になっています。

```javascript
// プレビューで確認
editLinesInFile(file, editlines, { preview: true })
// 問題なければ実際に保存
editLinesInFile(file, editlines, { preview: false })
```

### 3. 検索から編集までの効率的なワークフロー

```javascript
// 1. プロジェクト全体から対象を検索
projectGrep('target_function')

// 2. 特定ファイル内の詳細を確認
findInFile('src/example.ts', 'target_function')

// 3. ファイルの該当部分を読み取り
fileReed('src/example.ts', { startLine: 45, endLine: 55 })

// 4. 複数行を一度に編集
editLinesInFile(
  'src/example.ts',
  [
    { startLine: 47, endLine: 47, content: '  // Updated function' },
    {
      startLine: 48,
      endLine: 50,
      content:
        "  const newImplementation = () => {\n    return 'updated';\n  }",
    },
  ],
  { preview: false },
)
```

## ⚠️ よくある問題と解決方法

### 問題1: 行番号がずれるエラー

**原因**: 前回の編集で行数が変わったのに、古い行番号を使用している

**解決方法**:

```javascript
// ❌ 間違い
editLinesInFile(file, [{ startLine: 10, endLine: 10, content: 'line1' }])
editLinesInFile(file, [{ startLine: 15, endLine: 15, content: 'line2' }]) // エラー発生

// ✅ 正解1: まとめて実行
editLinesInFile(file, [
  { startLine: 10, endLine: 10, content: 'line1' },
  { startLine: 15, endLine: 15, content: 'line2' },
])

// ✅ 正解2: 再読み込みしてから実行
editLinesInFile(file, [{ startLine: 10, endLine: 10, content: 'line1' }])
fileReed(file) // 最新の状態を確認
editLinesInFile(file, [{ startLine: 15, endLine: 15, content: 'line2' }])
```

### 問題2: 重複する行範囲の指定

**原因**: 編集対象の行範囲が重複している

**解決方法**:

```javascript
// ❌ 間違い：行範囲が重複
editLinesInFile(file, [
  { startLine: 10, endLine: 15, content: 'block1' },
  { startLine: 12, endLine: 18, content: 'block2' }, // 10-15と12-18が重複
])

// ✅ 正解：重複しない範囲を指定
editLinesInFile(file, [
  { startLine: 10, endLine: 11, content: 'block1' },
  { startLine: 16, endLine: 18, content: 'block2' },
])
```

### 問題3: 無効な行範囲

**原因**: endLine が startLine より小さい

**解決方法**:

```javascript
// ❌ 間違い
editLinesInFile(file, [{ startLine: 15, endLine: 10, content: 'content' }])

// ✅ 正解
editLinesInFile(file, [{ startLine: 10, endLine: 15, content: 'content' }])
```

## 🔍 効率的な検索とファイル操作

### 段階的な検索アプローチ

1. **広範囲検索**: `projectGrep` でプロジェクト全体から候補を絞り込み
2. **詳細検索**: `findInFile` で特定ファイル内の正確な位置を特定
3. **内容確認**: `fileReed` で編集対象の現在の状態を確認
4. **編集実行**: 適切なツールで変更を実行

### ファイル操作の権限

- 設定ファイル（`~/.config/mcp-code/config.yaml`）で除外されたファイルは操作不可
- プロジェクトルート外のファイルへのアクセスは制限
- セキュリティのため、機密ファイル（.pem, .keyなど）は自動的に除外

## 📝 パラメータ詳細

### editLinesInFile

```javascript
{
  filePath: string,           // 編集対象ファイルパス
  editlines: [                // 編集内容の配列
    {
      startLine: number,      // 開始行（1ベース）
      endLine: number,        // 終了行（1ベース）
      content: string         // 置換する内容
    }
  ],
  preview: boolean = true     // プレビューモード
}
```

### insertLinesInFile

```javascript
{
  filePath: string,           // 編集対象ファイルパス
  editlines: [                // 挿入内容の配列
    {
      lineNumber: number,     // 挿入位置（1ベース）
      content: string         // 挿入する内容
    }
  ],
  afterMode: boolean = false  // true: 指定行の後に挿入, false: 指定行の前に挿入
}
```

### deleteLinesInFile

```javascript
{
  filePath: string,           // 編集対象ファイルパス
  editlines: [                // 削除範囲の配列
    {
      startLine: number,      // 削除開始行（1ベース）
      endLine: number         // 削除終了行（1ベース）
    }
  ]
}
```

## 🚀 高度な使用例

### 複雑なリファクタリング例

```javascript
// 1. 対象クラスを検索
projectGrep('class UserService')

// 2. 詳細な位置を特定
findInFile('src/services/user.ts', 'class UserService')

// 3. クラス全体を確認
fileReed('src/services/user.ts', { startLine: 10, endLine: 50 })

// 4. メソッドを一括で更新
editLinesInFile(
  'src/services/user.ts',
  [
    {
      startLine: 15,
      endLine: 20,
      content:
        '  async getUser(id: string): Promise<User> {\n    return this.repository.findById(id);\n  }',
    },
    {
      startLine: 25,
      endLine: 30,
      content:
        '  async updateUser(id: string, data: UserData): Promise<User> {\n    return this.repository.update(id, data);\n  }',
    },
    {
      startLine: 35,
      endLine: 40,
      content:
        '  async deleteUser(id: string): Promise<void> {\n    await this.repository.delete(id);\n  }',
    },
  ],
  { preview: false },
)
```

---

このガイドに従うことで、MCP-Codeツールを安全かつ効率的に使用できます。特に行番号の管理と複数行操作のまとめ実行を意識することで、エラーを防ぎスムーズな開発が可能になります。
