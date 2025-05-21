/**
 * テスト用のユーティリティ関数
 */

import fs from 'fs/promises';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

const TEST_DIR = path.join(process.cwd(), 'tests', 'temp');

/**
 * テスト用の一時ディレクトリを準備する
 */
export async function setupTestDirectory() {
  if (!existsSync(TEST_DIR)) {
    mkdirSync(TEST_DIR, { recursive: true });
  } else {
    // 一時ディレクトリをクリーンアップ
    const files = await fs.readdir(TEST_DIR);
    for (const file of files) {
      await fs.unlink(path.join(TEST_DIR, file));
    }
  }
  return TEST_DIR;
}

/**
 * テスト用のファイルを作成する
 * @param fileName ファイル名
 * @param content ファイルの内容
 * @returns ファイルの完全パス
 */
export async function createTestFile(fileName: string, content: string): Promise<string> {
  const filePath = path.join(TEST_DIR, fileName);
  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

/**
 * テスト用の設定ファイルを作成する
 * @param configName 設定ファイル名
 * @param configContent 設定内容
 * @returns 設定ファイルの完全パス
 */
export async function createTestConfig(configName: string, configContent: string): Promise<string> {
  const configDir = path.join(TEST_DIR, 'config');
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  
  const configPath = path.join(configDir, configName);
  await fs.writeFile(configPath, configContent, 'utf-8');
  return configPath;
}

/**
 * テスト結果を検証するためのアサーション関数
 * @param actual 実際の値
 * @param expected 期待値
 * @param message エラーメッセージ
 */
export function assertEqual(actual: any, expected: any, message?: string) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  
  if (actualStr !== expectedStr) {
    throw new Error(
      `${message || 'Assertion failed'}: expected ${expectedStr}, but got ${actualStr}`
    );
  }
  
  console.log(`✓ ${message || 'Assertion passed'}`);
}

/**
 * テスト関数を実行し、結果を報告する
 * @param testName テスト名
 * @param testFn テスト関数
 */
export async function runTest(testName: string, testFn: () => Promise<void>) {
  console.log(`\n--- 実行中: ${testName} ---`);
  try {
    await testFn();
    console.log(`✅ ${testName}: 成功`);
    return true;
  } catch (error) {
    console.error(`❌ ${testName}: 失敗`);
    console.error(error);
    return false;
  }
}

/**
 * 複数のテストを実行し、結果を集計する
 * @param tests テスト関数の配列
 */
export async function runTests(tests: Array<{ name: string, fn: () => Promise<void> }>) {
  console.log('=== テスト実行開始 ===');
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    const success = await runTest(test.name, test.fn);
    if (success) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log('\n=== テスト実行結果 ===');
  console.log(`総テスト数: ${passed + failed}`);
  console.log(`成功: ${passed}`);
  console.log(`失敗: ${failed}`);
  
  return { passed, failed };
}
