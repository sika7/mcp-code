/**
 * スクリプト実行モジュールのテスト
 */

import { existsSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

import {
  assertEqual,
  isMainModule,
  createTestEnvironment,
  runTestSuite,
} from "./test-utils";
import { runScript } from "../src/lib/script";

async function testRunScript() {
  // テスト環境のセットアップ
  const env = await createTestEnvironment("legacy");
  const testDir = env.testDir;

  // テスト用のスクリプトファイル作成
  const scriptDir = path.join(testDir, "scripts");
  if (!existsSync(scriptDir)) {
    mkdirSync(scriptDir, { recursive: true });
  }

  const testScriptPath = path.join(scriptDir, "test-script.js");
  writeFileSync(
    testScriptPath,
    `#!/usr/bin/env node
    console.log("スクリプトが実行されました");
    process.exit(0);`,
    { mode: 0o755 },
  );

  const errorScriptPath = path.join(scriptDir, "error-script.js");
  writeFileSync(
    errorScriptPath,
    `#!/usr/bin/env node
    console.error("エラーが発生しました");
    process.exit(1);`,
    { mode: 0o755 },
  );

  // 成功するスクリプトのテスト
  try {
    const result = await runScript("test", `node ${testScriptPath}`, testDir);

    assertEqual(
      result.includes("スクリプトが実行されました"),
      true,
      "スクリプトが正常に実行され、出力が取得されること",
    );
  } catch (error) {
    throw new Error(`スクリプト実行に失敗: ${error}`);
  }

  // 失敗するスクリプトのテスト
  try {
    await runScript("error", `node ${errorScriptPath}`, testDir);
    throw new Error("エラーが発生しなかった");
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    assertEqual(
      errorMsg.includes("スクリプトエラー") &&
        errorMsg.includes("エラーが発生しました"),
      true,
      "スクリプトエラー時に適切なエラーメッセージが返されること",
    );
  }

  // 存在しないコマンドのテスト
  try {
    await runScript("invalid", "non-existent-command", testDir, true);
    throw new Error("エラーが発生しなかった");
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    assertEqual(
      errorMsg.includes("スクリプトエラー"),
      true,
      "存在しないコマンドを実行しようとした場合にエラーが発生すること",
    );
  }

  // &&を含むコマンドのテスト
  try {
    const result = await runScript(
      "compound",
      `echo "first" && echo "second"`,
      testDir
    );
    
    assertEqual(
      result.includes("first") && result.includes("second"),
      true,
      "&&を含むコマンドが正常に実行されること"
    );
  } catch (error) {
    throw new Error(`&&を含むコマンドの実行に失敗: ${error}`);
  }

  // 複数のシェル演算子を含むコマンドのテスト 
  try {
    const result = await runScript(
      "complex",
      `echo "start" && echo "middle" || echo "fallback"`,
      testDir
    );
    
    assertEqual(
      result.includes("start") && result.includes("middle"),
      true,
      "複数のシェル演算子を含むコマンドが正常に実行されること"
    );
  } catch (error) {
    throw new Error(`複数のシェル演算子を含むコマンドの実行に失敗: ${error}`);
  }

  // 環境変数を含む複雑なコマンドのテスト（修正版）
  try {
    const result = await runScript(
      "env-test",
      `echo "start" && export NODE_ENV=test && echo "NODE_ENV is $NODE_ENV" && echo "end"`,
      testDir
    );
    
    assertEqual(
      result.includes("start") && result.includes("NODE_ENV is test") && result.includes("end"),
      true,
      "環境変数を含む複雑なコマンドが正常に実行されること"
    );
  } catch (error) {
    throw new Error(`環境変数を含むコマンドの実行に失敗: ${error}`);
  }

  // TypeScriptエラーのシミュレーションテスト（&&の前でエラー）
  try {
    await runScript(
      "tsc-error-simulation",
      `echo "Starting TypeScript compilation..." && echo "Error: Cannot find module 'nonexistent'" >&2 && exit 1`,
      testDir
    );
    throw new Error("エラーが発生しなかった");
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    assertEqual(
      errorMsg.includes("コマンド:") && 
      errorMsg.includes("終了コード:") &&
      errorMsg.includes("標準出力:") &&
      errorMsg.includes("エラー出力:"),
      true,
      "&&の前でエラー時に詳細なエラー情報が取得できること"
    );
    console.log("エラー詳細:", errorMsg); // デバッグ用
  }

  // 実際のビルドコマンドのシミュレーションテスト（修正版）
  try {
    const result = await runScript(
      "build-simulation",
      `echo "TypeScript compilation..." && export NODE_ENV=production && echo "Building with NODE_ENV=$NODE_ENV" && echo "Build complete!"`,
      testDir
    );
    
    assertEqual(
      result.includes("TypeScript compilation...") && 
      result.includes("Building with NODE_ENV=production") && 
      result.includes("Build complete!"),
      true,
      "実際のビルドコマンドのシミュレーションが正常に実行されること"
    );
  } catch (error) {
    throw new Error(`ビルドコマンドのシミュレーションに失敗: ${error}`);
  }
}

// メインのテスト実行関数
export async function runScriptTests() {
  await runTestSuite("Legacy Test Suite", [{ name: "スクリプト実行テスト", fn: testRunScript }]);
}

// 単体で実行する場合
if (isMainModule(import.meta.url)) {
  runScriptTests().catch(console.error);
}
