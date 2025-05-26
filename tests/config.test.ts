/**
 * 設定モジュールのテスト（シンプル版）
 */

import { assertEqual, isMainModule, createTestEnvironment, runTestSuite } from './test-utils';
import { loadConfig } from '../src/config';

async function testLoadValidConfig() {
  // テスト環境のセットアップ
  const { testDir, createConfig } = await createTestEnvironment("legacy");
  
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
  
  const configPath = await createConfig('valid-config.yaml', validConfig);
  
  // 設定を読み込む（直接パスを渡す）
  const config = loadConfig({ configPath });
  
  // 設定が正しく読み込まれたことを検証
  assertEqual(config.current_project, "test_project", "正しいプロジェクト名が設定されていること");
  assertEqual(config.excluded_files, ["**/*.pem", "**/*.key"], "除外ファイルが正しく設定されていること");
  assertEqual(config.projects.test_project.scripts.build, "npm run build", "ビルドスクリプトが正しく設定されていること");
  assertEqual(config.projects.test_project.scripts.test, "npm run test", "テストスクリプトが正しく設定されていること");
}

async function testInvalidConfig() {
  // テスト環境のセットアップ
  const { testDir, createConfig } = await createTestEnvironment("legacy");
  
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
  
  const configPath = await createConfig('invalid-config.yaml', invalidConfig);
  
  // エラーが発生することを検証
  try {
    loadConfig({ configPath });
    throw new Error("エラーが発生しなかった");
  } catch (error) {
    const errorMessage = (error as Error).message;
    assertEqual(
      errorMessage.includes("設定ファイルが無効です") || 
      errorMessage.includes("設定ファイルのスキーマ検証エラー"), 
      true, 
      "無効な設定ファイルに対してエラーが発生すること"
    );
  }
}

async function testNonExistentConfig() {
  // 存在しない設定ファイルのパス
  const nonExistentPath = '/path/to/non-existent-config.yaml';
  
  // エラーが発生することを検証
  try {
    loadConfig({ configPath: nonExistentPath });
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
  await runTestSuite("Legacy Test Suite", [
    { name: '有効な設定ファイルの読み込みテスト', fn: testLoadValidConfig },
    { name: '無効な設定ファイルの読み込みテスト', fn: testInvalidConfig },
    { name: '存在しない設定ファイルの読み込みテスト', fn: testNonExistentConfig },
  ]);
}

// 単体で実行する場合
if (isMainModule(import.meta.url)) {
  runConfigTests().catch(console.error);
}
