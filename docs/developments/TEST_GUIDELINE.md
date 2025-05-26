---
title: 'mcp-code テスト作成のガイドライン'
author: 'sika7'
tags: ['mcp-code', 'テスト作成', 'ガイドライン']
date: 2025-05-26
audience: ['開発者', 'AIエージェント']
---

# テスト作成ガイドライン

## ファイル命名規則

- `{機能名}.test.ts`（例：`config.test.ts`, `files.test.ts`）
- 1ファイル = 1機能のテスト

## 必須インポート

```typescript
import {
  assertEqual,
  assertTrue,
  assertFalse,
  assertThrows,
  createTestEnvironment,
  runTestSuite,
  isMainModule,
} from './test-utils'
```

## 基本構造

```typescript
/**
 * {機能名}のテスト
 */

// テスト関数（async function test{機能名}()）
async function testBasicFunction() {
  // createTestEnvironment使用
  const { testDir, createFile, cleanup } =
    await createTestEnvironment('test-name')

  // テストロジック
  // アサーション関数使用
  assertEqual(actual, expected, 'メッセージ')
}

// メイン実行部
if (isMainModule(import.meta.url)) {
  await runTestSuite('機能名テスト', [{ name: 'テスト名', fn: testFunction }])
}
```

## アサーション関数

- `assertEqual(actual, expected, message)` - 値の等価比較
- `assertTrue(value, message)` - 真偽値チェック
- `assertFalse(value, message)` - 偽値チェック
- `assertThrows(fn, errorMessage?, message)` - 例外発生チェック
- `assertFileExists(path, message)` - ファイル存在チェック
- `assertContains(haystack, needle, message)` - 文字列包含チェック

## テスト環境

- `createTestEnvironment(testName)`で独立環境作成
- `createFile()`, `createConfig()`, `createDirectory()`でテストデータ作成
- 自動クリーンアップ対応

## 実行方法

個別実行：`node {テストファイル名}`
全体実行：`npm run test`
