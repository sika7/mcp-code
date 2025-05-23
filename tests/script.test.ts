/**
 * スクリプト実行モジュールのテスト
 */

import { existsSync, writeFileSync, mkdirSync } from "fs";
import fs from "fs/promises";
import path from "path";

import {
  setupTestDirectory,
  assertEqual,
  runTests,
  isMainModule,
} from "./test-utils";
import { runScript } from "../src/script";

async function testRunScript() {
  // テスト環境のセットアップ
  const testDir = await setupTestDirectory();

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
}

// メインのテスト実行関数
export async function runScriptTests() {
  await runTests([{ name: "スクリプト実行テスト", fn: testRunScript }]);
}

// 単体で実行する場合
if (isMainModule(import.meta.url)) {
  runScriptTests().catch(console.error);
}
