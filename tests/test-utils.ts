/**
 * 統一されたテストユーティリティ
 * 保守性向上のため、テスト関連の機能を一元化
 */

import { existsSync, mkdirSync, rmSync } from "fs";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

// =============================================================================
// 型定義
// =============================================================================

export interface TestEnvironment {
  readonly testDir: string;
  readonly cleanup: () => Promise<void>;
  createFile: (fileName: string, content: string) => Promise<string>;
  createConfig: (configName: string, configContent: string) => Promise<string>;
  createDirectory: (dirName: string) => Promise<string>;
  getTestPath: (relativePath: string) => string;
}

export interface TestResult {
  passed: number;
  failed: number;
  total: number;
  success: boolean;
}

export interface AssertionError extends Error {
  actual: any;
  expected: any;
  operator: string;
}

// =============================================================================
// テスト環境管理
// =============================================================================

/**
 * 独立したテスト環境を作成する
 * @param testSuiteName テストスイート名（一意性確保のため）
 * @returns TestEnvironment インスタンス
 */
export async function createTestEnvironment(testSuiteName: string): Promise<TestEnvironment> {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(7);
  const testDir = path.join(os.tmpdir(), `mcp-code-test-${testSuiteName}-${timestamp}-${randomSuffix}`);

  // テストディレクトリの作成
  await fs.mkdir(testDir, { recursive: true });

  const cleanup = async () => {
    try {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn(`Warning: Failed to cleanup test directory ${testDir}:`, error);
    }
  };

  const createFile = async (fileName: string, content: string): Promise<string> => {
    const filePath = path.join(testDir, fileName);
    const dirPath = path.dirname(filePath);
    
    // 必要に応じて親ディレクトリを作成
    if (!existsSync(dirPath)) {
      await fs.mkdir(dirPath, { recursive: true });
    }
    
    await fs.writeFile(filePath, content, "utf-8");
    return filePath;
  };

  const createConfig = async (configName: string, configContent: string): Promise<string> => {
    const configDir = path.join(testDir, "config");
    await fs.mkdir(configDir, { recursive: true });
    
    const configPath = path.join(configDir, configName);
    await fs.writeFile(configPath, configContent, "utf-8");
    return configPath;
  };

  const createDirectory = async (dirName: string): Promise<string> => {
    const dirPath = path.join(testDir, dirName);
    await fs.mkdir(dirPath, { recursive: true });
    return dirPath;
  };

  const getTestPath = (relativePath: string): string => {
    return path.join(testDir, relativePath);
  };

  return {
    testDir,
    cleanup,
    createFile,
    createConfig,
    createDirectory,
    getTestPath,
  };
}

// =============================================================================
// 拡張アサーション関数
// =============================================================================

/**
 * 基本的な等価比較アサーション
 */
export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);

  if (actualStr !== expectedStr) {
    const error = new Error(
      `${message || "Assertion failed"}: expected ${expectedStr}, but got ${actualStr}`
    ) as AssertionError;
    error.actual = actual;
    error.expected = expected;
    error.operator = "equal";
    throw error;
  }

  console.log(`✓ ${message || "Assertion passed"}`);
}

/**
 * 真偽値アサーション
 */
export function assertTrue(value: any, message?: string): void {
  if (!value) {
    const error = new Error(
      `${message || "Expected truthy value"}, but got ${JSON.stringify(value)}`
    ) as AssertionError;
    error.actual = value;
    error.expected = true;
    error.operator = "true";
    throw error;
  }
  
  console.log(`✓ ${message || "True assertion passed"}`);
}

/**
 * 偽値アサーション
 */
export function assertFalse(value: any, message?: string): void {
  if (value) {
    const error = new Error(
      `${message || "Expected falsy value"}, but got ${JSON.stringify(value)}`
    ) as AssertionError;
    error.actual = value;
    error.expected = false;
    error.operator = "false";
    throw error;
  }
  
  console.log(`✓ ${message || "False assertion passed"}`);
}

/**
 * 文字列包含アサーション
 */
export function assertContains(haystack: string, needle: string, message?: string): void {
  if (!haystack.includes(needle)) {
    const error = new Error(
      `${message || "String should contain substring"}: "${haystack}" should contain "${needle}"`
    ) as AssertionError;
    error.actual = haystack;
    error.expected = `string containing "${needle}"`;
    error.operator = "contains";
    throw error;
  }
  
  console.log(`✓ ${message || "Contains assertion passed"}`);
}

/**
 * 例外発生アサーション
 */
export async function assertThrows(
  fn: () => Promise<void> | void,
  expectedErrorMessage?: string,
  message?: string
): Promise<void> {
  try {
    await fn();
    const error = new Error(
      `${message || "Expected function to throw an error"}, but it didn't`
    ) as AssertionError;
    error.actual = "no error";
    error.expected = "error to be thrown";
    error.operator = "throws";
    throw error;
  } catch (error) {
    if (expectedErrorMessage) {
      const errorMessage = (error as Error).message;
      if (!errorMessage.includes(expectedErrorMessage)) {
        const assertionError = new Error(
          `${message || "Expected specific error message"}: expected error containing "${expectedErrorMessage}", but got "${errorMessage}"`
        ) as AssertionError;
        assertionError.actual = errorMessage;
        assertionError.expected = `error containing "${expectedErrorMessage}"`;
        assertionError.operator = "throws";
        throw assertionError;
      }
    }
    
    console.log(`✓ ${message || "Throws assertion passed"}`);
  }
}

/**
 * ファイル存在アサーション
 */
export function assertFileExists(filePath: string, message?: string): void {
  if (!existsSync(filePath)) {
    const error = new Error(
      `${message || "Expected file to exist"}: ${filePath}`
    ) as AssertionError;
    error.actual = "file does not exist";
    error.expected = "file exists";
    error.operator = "fileExists";
    throw error;
  }
  
  console.log(`✓ ${message || "File exists assertion passed"}`);
}

/**
 * ファイル非存在アサーション
 */
export function assertFileNotExists(filePath: string, message?: string): void {
  if (existsSync(filePath)) {
    const error = new Error(
      `${message || "Expected file not to exist"}: ${filePath}`
    ) as AssertionError;
    error.actual = "file exists";
    error.expected = "file does not exist";
    error.operator = "fileNotExists";
    throw error;
  }
  
  console.log(`✓ ${message || "File not exists assertion passed"}`);
}

/**
 * 配列長アサーション
 */
export function assertArrayLength<T>(array: T[], expectedLength: number, message?: string): void {
  if (array.length !== expectedLength) {
    const error = new Error(
      `${message || "Array length mismatch"}: expected length ${expectedLength}, but got ${array.length}`
    ) as AssertionError;
    error.actual = array.length;
    error.expected = expectedLength;
    error.operator = "arrayLength";
    throw error;
  }
  
  console.log(`✓ ${message || "Array length assertion passed"}`);
}

// =============================================================================
// テスト実行フレームワーク
// =============================================================================

/**
 * 単一テストの実行
 */
export async function runTest(
  testName: string, 
  testFn: () => Promise<void>,
  verbose: boolean = true
): Promise<boolean> {
  if (verbose) {
    console.log(`\n--- 実行中: ${testName} ---`);
  }
  
  try {
    await testFn();
    if (verbose) {
      console.log(`✅ ${testName}: 成功`);
    }
    return true;
  } catch (error) {
    if (verbose) {
      console.error(`❌ ${testName}: 失敗`);
      console.error(error);
    }
    return false;
  }
}

/**
 * テストスイートの実行
 */
export async function runTestSuite(
  suiteName: string,
  tests: Array<{ name: string; fn: () => Promise<void> }>,
  verbose: boolean = true
): Promise<TestResult> {
  if (verbose) {
    console.log(`\n=== ${suiteName} テスト実行開始 ===`);
  }
  
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const success = await runTest(test.name, test.fn, verbose);
    if (success) {
      passed++;
    } else {
      failed++;
    }
  }

  const total = passed + failed;
  const success = failed === 0;

  if (verbose) {
    console.log(`\n=== ${suiteName} テスト実行結果 ===`);
    console.log(`総テスト数: ${total}`);
    console.log(`成功: ${passed}`);
    console.log(`失敗: ${failed}`);
    
    if (success) {
      console.log(`✅ ${suiteName}: 全テスト成功`);
    } else {
      console.log(`❌ ${suiteName}: ${failed}件のテストが失敗`);
    }
  }

  return { passed, failed, total, success };
}

// =============================================================================
// ユーティリティ関数
// =============================================================================

/**
 * ESモジュールでメインモジュールかどうかを判断
 */
export function isMainModule(moduleUrl: string): boolean {
  return process.argv[1] === fileURLToPath(moduleUrl);
}

/**
 * テスト用のランダムな文字列を生成
 */
export function generateRandomString(length: number = 8): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * テスト用の遅延関数
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// 後方互換性のための旧API
// =============================================================================

/**
 * @deprecated createTestEnvironment を使用してください
 */
export async function setupTestDirectory(): Promise<string> {
  console.warn("setupTestDirectory is deprecated. Use createTestEnvironment instead.");
  const env = await createTestEnvironment("legacy");
  return env.testDir;
}

/**
 * @deprecated TestEnvironment.createFile を使用してください
 */
export async function createTestFile(fileName: string, content: string): Promise<string> {
  console.warn("createTestFile is deprecated. Use TestEnvironment.createFile instead.");
  const env = await createTestEnvironment("legacy");
  return env.createFile(fileName, content);
}

/**
 * @deprecated TestEnvironment.createConfig を使用してください
 */
export async function createTestConfig(configName: string, configContent: string): Promise<string> {
  console.warn("createTestConfig is deprecated. Use TestEnvironment.createConfig instead.");
  const env = await createTestEnvironment("legacy");
  return env.createConfig(configName, configContent);
}

/**
 * @deprecated runTestSuite を使用してください
 */
export async function runTests(
  tests: Array<{ name: string; fn: () => Promise<void> }>
): Promise<{ passed: number; failed: number }> {
  console.warn("runTests is deprecated. Use runTestSuite instead.");
  const result = await runTestSuite("Legacy Test Suite", tests);
  return { passed: result.passed, failed: result.failed };
}
