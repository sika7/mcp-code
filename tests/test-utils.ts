/**
 * テスト用のユーティリティ関数
 */

import fs from 'fs/promises';
import path from 'path';
import { existsSync, mkdirSync, rmdirSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import os from 'os';

// ESモジュールでメインモジュールかどうかを判断する方法
export function isMainModule(moduleUrl: string) {
  return process.argv[1] === fileURLToPath(moduleUrl);
}

// システムの一時ディレクトリ内にテスト用ディレクトリを作成
const TEST_DIR = path.join(os.tmpdir(), 'mcp-code-test-' + Date.now());

/**
 * テスト用の一時ディレクトリを準備する
 */
export async function setupTestDirectory() {
  // 既存のディレクトリが存在していたら削除（再帰的に）
  try {
    if (existsSync(TEST_DIR)) {
      // 再帰的にディレクトリとその中のファイルを削除する関数
      const removeDir = async (dirPath: string) => {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            await removeDir(fullPath);
          } else {
            try {
              await fs.unlink(fullPath);
            } catch (err) {
              console.warn(`Warning: Failed to delete file ${fullPath}`, err);
            }
          }
        }
        
        try {
          await fs.rmdir(dirPath);
        } catch (err) {
          console.warn(`Warning: Failed to delete directory ${dirPath}`, err);
        }
      };
      
      await removeDir(TEST_DIR);
    }
  } catch (err) {
    console.warn(`Warning during cleanup: ${err}`);
  }
  
  // 新しいディレクトリを作成
  try {
    mkdirSync(TEST_DIR, { recursive: true });
  } catch (err) {
    console.warn(`Warning: Could not create test directory: ${err}`);
    throw new Error(`Failed to create test directory: ${err}`);
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
  
  // ディレクトリが存在しない場合は作成
  const dirPath = path.dirname(filePath);
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
  
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

// テスト終了時にクリーンアップ
process.on('exit', () => {
  try {
    if (existsSync(TEST_DIR)) {
      // 同期的にクリーンアップ（終了処理なので非同期は使えない）
      const removeSync = (dirPath: string) => {
        if (existsSync(dirPath)) {
          const entries = fs.readdirSync(dirPath, { withFileTypes: true });
          
          for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
              removeSync(fullPath);
            } else {
              try {
                unlinkSync(fullPath);
              } catch (err) {
                // エラーを無視（クリーンアップが完全にできないこともある）
              }
            }
          }
          
          try {
            rmdirSync(dirPath);
          } catch (err) {
            // エラーを無視
          }
        }
      };
      
      removeSync(TEST_DIR);
    }
  } catch (err) {
    // 終了時処理なのでエラーは無視
  }
});
