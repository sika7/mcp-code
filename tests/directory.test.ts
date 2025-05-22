/**
 * ディレクトリ操作テスト
 */

import { promises as fs } from "fs";
import { join } from "path";

import { createDirectory, removeDirectory } from "../src/directory";

// テスト用ディレクトリのベースパス
const testBaseDir = "/tmp/mcp-code-directory-test";

export async function runDirectoryTests() {
  console.log("=== ディレクトリ操作モジュールテスト 開始 ===");
  console.log("=== テスト実行開始 ===");

  let totalTests = 0;
  let passedTests = 0;

  async function test(name: string, testFn: () => Promise<void>): Promise<void> {
    console.log(`\n--- 実行中: ${name} ---`);
    totalTests++;
    try {
      await testFn();
      console.log(`✅ ${name}: 成功`);
      passedTests++;
    } catch (error) {
      console.error(`❌ ${name}: 失敗`);
      console.error("エラー:", error);
    }
  }

  // テスト前の準備
  try {
    await fs.rm(testBaseDir, { recursive: true, force: true });
  } catch (error) {
    // ディレクトリが存在しない場合は無視
  }

  await test("ディレクトリ作成テスト", async () => {
    const testDir = join(testBaseDir, "test-create");
    
    // ディレクトリを作成
    const result = await createDirectory(testDir);
    console.log("✓", result);
    
    // ディレクトリが実際に作成されているか確認
    const stats = await fs.stat(testDir);
    if (!stats.isDirectory()) {
      throw new Error("ディレクトリが作成されていません");
    }
    console.log("✓ ディレクトリが正しく作成されました");
  });

  await test("ネストしたディレクトリ作成テスト", async () => {
    const nestedDir = join(testBaseDir, "nested", "deep", "directory");
    
    // ネストしたディレクトリを作成
    const result = await createDirectory(nestedDir);
    console.log("✓", result);
    
    // ディレクトリが実際に作成されているか確認
    const stats = await fs.stat(nestedDir);
    if (!stats.isDirectory()) {
      throw new Error("ネストしたディレクトリが作成されていません");
    }
    console.log("✓ ネストしたディレクトリが正しく作成されました");
  });

  await test("既存ディレクトリの再作成テスト", async () => {
    const existingDir = join(testBaseDir, "existing");
    
    // 最初にディレクトリを作成
    await createDirectory(existingDir);
    
    // 同じディレクトリを再度作成（エラーにならないはず）
    const result = await createDirectory(existingDir);
    console.log("✓", result);
    console.log("✓ 既存ディレクトリの再作成が正常に完了しました");
  });

  await test("ディレクトリ削除テスト", async () => {
    const deleteDir = join(testBaseDir, "test-delete");
    
    // 削除用のディレクトリを作成
    await createDirectory(deleteDir);
    
    // ディレクトリを削除
    const result = await removeDirectory(deleteDir);
    console.log("✓", result);
    
    // ディレクトリが削除されているか確認
    try {
      await fs.stat(deleteDir);
      throw new Error("ディレクトリが削除されていません");
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        throw error;
      }
      console.log("✓ ディレクトリが正しく削除されました");
    }
  });

  await test("内容があるディレクトリの削除テスト", async () => {
    const contentDir = join(testBaseDir, "with-content");
    const subDir = join(contentDir, "subdir");
    const file1 = join(contentDir, "file1.txt");
    const file2 = join(subDir, "file2.txt");
    
    // ディレクトリ構造を作成
    await createDirectory(subDir);
    await fs.writeFile(file1, "内容1");
    await fs.writeFile(file2, "内容2");
    
    // 内容があるディレクトリを削除
    const result = await removeDirectory(contentDir);
    console.log("✓", result);
    
    // ディレクトリが削除されているか確認
    try {
      await fs.stat(contentDir);
      throw new Error("ディレクトリが削除されていません");
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        throw error;
      }
      console.log("✓ 内容があるディレクトリが正しく削除されました");
    }
  });

  await test("存在しないディレクトリの削除テスト", async () => {
    const nonExistentDir = join(testBaseDir, "non-existent");
    
    // 存在しないディレクトリを削除（エラーにならないはず）
    const result = await removeDirectory(nonExistentDir);
    console.log("✓", result);
    console.log("✓ 存在しないディレクトリの削除が正常に完了しました");
  });

  // テスト後のクリーンアップ
  try {
    await fs.rm(testBaseDir, { recursive: true, force: true });
  } catch (error) {
    // エラーは無視
  }

  console.log("\n=== テスト実行結果 ===");
  console.log(`総テスト数: ${totalTests}`);
  console.log(`成功: ${passedTests}`);
  console.log(`失敗: ${totalTests - passedTests}`);

  if (passedTests === totalTests) {
    console.log("=== ディレクトリ操作モジュールテスト 完了 ✅ ===");
    return true;
  } else {
    console.log("=== ディレクトリ操作モジュールテスト 失敗 ❌ ===");
    return false;
  }
}
