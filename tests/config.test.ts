/**
 * 設定モジュールのテスト
 */

import { setupTestDirectory, createTestConfig, assertEqual, runTests } from './test-utils';
import { loadConfig } from '../src/config';
import { jest } from '@jest/globals';

// configスクリプトのgetConfigPath関数をモック化するための準備
jest.mock('../src/util', () => {
  const original = jest.requireActual('../src/util');
  return {
    ...original,
    getConfigPath: jest.fn(),
  };
});

import { getConfigPath } from '../src/util';

async function testLoadValidConfig() {
  // テスト環境のセットアップ
  const testDir = await setupTestDirectory();
  
  // 有効な設定ファイルを作成
  const validConfig = `
log_path: "${testDir}/logs"
excluded_files:
  - "**/*.pem"
  - "**/*.key"

current_project: "test_project"
projects:
  test_project:
    src: "${testDir}/src"
    scripts:
      build: "npm run build"
      test: "npm run test"
    excluded_files:
      - "**/.env"
      - "logs/**/*.log"
  `;
  
  const configPath = await createTestConfig('valid-config.yaml', validConfig);
  
  // getConfigPathのモック実装を設定
  (getConfigPath as jest.Mock).mockReturnValue(configPath);
  
  // 設定を読み込む
  const config = loadConfig({});
  
  // 設定が正しく読み込まれたことを検証
  assertEqual(config.current_project, "test_project", "正しいプロジェクト名が設定されていること");
  assertEqual(config.excluded_files, ["**/*.pem", "**/*.key"], "除外ファイルが正しく設定されていること");
  assertEqual(config.projects.test_project.scripts.build, "npm run build", "ビルドスクリプトが正しく設定されていること");
  assertEqual(config.projects.test_project.scripts.test, "npm run test", "テストスクリプトが正しく設定されていること");
}

async function testInvalidConfig() {
  // テスト環境のセットアップ
  const testDir = await setupTestDirectory();
  
  // 無効な設定ファイル（必須項目が欠けている）
  const invalidConfig = `
log_path: "${testDir}/logs"
excluded_files:
  - "**/*.pem"
  - "**/*.key"

# current_projectがない
projects:
  test_project:
    src: "${testDir}/src"
  `;
  
  const configPath = await createTestConfig('invalid-config.yaml', invalidConfig);
  
  // getConfigPathのモック実装を設定
  (getConfigPath as jest.Mock).mockReturnValue(configPath);
  
  // エラーが発生することを検証
  try {
    loadConfig({});
    throw new Error("エラーが発生しなかった");
  } catch (error) {
    const errorMessage = (error as Error).message;
    assertEqual(
      errorMessage.includes("設定ファイルが無効です"), 
      true, 
      "無効な設定ファイルに対してエラーが発生すること"
    );
  }
}

async function testNonExistentConfig() {
  // 存在しない設定ファイルのパスを設定
  const nonExistentPath = '/path/to/non-existent-config.yaml';
  
  // getConfigPathのモック実装を設定
  (getConfigPath as jest.Mock).mockReturnValue(nonExistentPath);
  
  // エラーが発生することを検証
  try {
    loadConfig({});
    throw new Error("エラーが発生しなかった");
  } catch (error) {
    const errorMessage = (error as Error).message;
    assertEqual(
      errorMessage.includes("設定ファイルが見つかりません"), 
      true, 
      "存在しない設定ファイルに対してエラーが発生すること"
    );
  }
}

// メインのテスト実行関数
export async function runConfigTests() {
  await runTests([
    { name: '有効な設定ファイルの読み込みテスト', fn: testLoadValidConfig },
    { name: '無効な設定ファイルの読み込みテスト', fn: testInvalidConfig },
    { name: '存在しない設定ファイルの読み込みテスト', fn: testNonExistentConfig },
  ]);
}

// 単体で実行する場合
if (require.main === module) {
  runConfigTests().catch(console.error);
}
