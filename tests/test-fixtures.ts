/**
 * テストフィクスチャ管理
 * ファイルベースのテストデータを読み込み・処理するユーティリティ
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// フィクスチャディレクトリのパス
const FIXTURES_DIR = path.join(__dirname, "fixtures");

// =============================================================================
// フィクスチャファイル読み込み
// =============================================================================

/**
 * フィクスチャファイルを読み込む
 * @param fileName フィクスチャファイル名
 * @returns ファイルの内容
 */
export async function loadFixture(fileName: string): Promise<string> {
  const filePath = path.join(FIXTURES_DIR, fileName);
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    throw new Error(`Failed to load fixture file: ${fileName}. Error: ${error}`);
  }
}

/**
 * テンプレート変数を置換してフィクスチャを読み込む
 * @param fileName フィクスチャファイル名
 * @param variables 置換する変数のマップ
 * @returns 変数が置換されたファイルの内容
 */
export async function loadFixtureWithVariables(
  fileName: string,
  variables: Record<string, string>
): Promise<string> {
  let content = await loadFixture(fileName);
  
  // テンプレート変数を置換
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    content = content.replaceAll(placeholder, value);
  }
  
  return content;
}

/**
 * 設定フィクスチャを読み込む（TEST_DIR変数を自動置換）
 * @param configName 設定フィクスチャファイル名
 * @param testDir テストディレクトリのパス
 * @returns 置換済みの設定内容
 */
export async function loadConfigFixture(
  configName: string,
  testDir: string
): Promise<string> {
  return loadFixtureWithVariables(configName, { TEST_DIR: testDir });
}

// =============================================================================
// よく使用するフィクスチャのヘルパー関数
// =============================================================================

/**
 * 有効な設定ファイルの内容を取得
 */
export async function getValidConfig(testDir: string): Promise<string> {
  return loadConfigFixture("config-valid.yaml", testDir);
}

/**
 * 最小限の設定ファイルの内容を取得
 */
export async function getMinimalConfig(testDir: string): Promise<string> {
  return loadConfigFixture("config-minimal.yaml", testDir);
}

/**
 * 複数プロジェクトの設定ファイルの内容を取得
 */
export async function getMultiProjectConfig(testDir: string): Promise<string> {
  return loadConfigFixture("config-multi-project.yaml", testDir);
}

/**
 * 無効な設定ファイル（current_project欠如）の内容を取得
 */
export async function getInvalidConfigMissingCurrentProject(testDir: string): Promise<string> {
  return loadConfigFixture("config-missing-current-project.yaml", testDir);
}

/**
 * 無効な設定ファイル（存在しないプロジェクト）の内容を取得
 */
export async function getInvalidConfigNonExistentProject(testDir: string): Promise<string> {
  return loadConfigFixture("config-non-existent-project.yaml", testDir);
}

/**
 * シンプルなテキストファイルの内容を取得
 */
export async function getSimpleTextContent(): Promise<string> {
  return loadFixture("simple-text.txt");
}

/**
 * 複数行テキストファイルの内容を取得
 */
export async function getMultiLineTextContent(): Promise<string> {
  return loadFixture("multi-line-text.txt");
}

/**
 * 成功するテストスクリプトの内容を取得
 */
export async function getSuccessScriptContent(): Promise<string> {
  return loadFixture("test-script-success.js");
}

/**
 * 失敗するテストスクリプトの内容を取得
 */
export async function getErrorScriptContent(): Promise<string> {
  return loadFixture("test-script-error.js");
}

// =============================================================================
// フィクスチャファイルのコピー機能
// =============================================================================

/**
 * フィクスチャファイルを指定した場所にコピーする
 * @param fixtureFileName フィクスチャファイル名
 * @param destinationPath コピー先のパス
 * @param variables 置換する変数（オプション）
 */
export async function copyFixture(
  fixtureFileName: string,
  destinationPath: string,
  variables?: Record<string, string>
): Promise<void> {
  let content: string;
  
  if (variables) {
    content = await loadFixtureWithVariables(fixtureFileName, variables);
  } else {
    content = await loadFixture(fixtureFileName);
  }
  
  // 親ディレクトリを作成
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  
  // ファイルをコピー
  await fs.writeFile(destinationPath, content, "utf-8");
}

/**
 * 実行可能なスクリプトファイルをコピーする
 * @param fixtureFileName フィクスチャファイル名
 * @param destinationPath コピー先のパス
 * @param variables 置換する変数（オプション）
 */
export async function copyExecutableFixture(
  fixtureFileName: string,
  destinationPath: string,
  variables?: Record<string, string>
): Promise<void> {
  await copyFixture(fixtureFileName, destinationPath, variables);
  
  // 実行権限を付与（Unix系システムの場合）
  if (process.platform !== "win32") {
    await fs.chmod(destinationPath, 0o755);
  }
}

// =============================================================================
// フィクスチャの存在確認
// =============================================================================

/**
 * フィクスチャファイルが存在するかチェック
 * @param fileName フィクスチャファイル名
 * @returns ファイルが存在する場合true
 */
export async function fixtureExists(fileName: string): Promise<boolean> {
  const filePath = path.join(FIXTURES_DIR, fileName);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 利用可能なフィクスチャファイルの一覧を取得
 * @returns フィクスチャファイル名の配列
 */
export async function listFixtures(): Promise<string[]> {
  try {
    const files = await fs.readdir(FIXTURES_DIR, { recursive: true });
    return files.filter(file => typeof file === 'string') as string[];
  } catch (error) {
    throw new Error(`Failed to list fixtures: ${error}`);
  }
}
