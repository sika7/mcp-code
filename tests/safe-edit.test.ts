/**
 * 安全なファイル編集モジュールのテスト
 */

import { setupTestDirectory, createTestFile, assertEqual, runTests } from './test-utils';
import { safeEditLines, safeDeleteLines } from '../src/safe-edit';
import fs from 'fs/promises';
import path from 'path';

async function testSafeEditLines() {
  // テスト環境のセットアップ
  const testDir = await setupTestDirectory();
  
  // テストファイル（Unix改行）の作成
  const unixContent = "1行目\n2行目\n3行目\n4行目\n5行目";
  const unixFilePath = await createTestFile('unix-line-endings.txt', unixContent);
  
  // テストファイル（Windows改行）の作成
  const windowsContent = "1行目\r\n2行目\r\n3行目\r\n4行目\r\n5行目";
  const windowsFilePath = await createTestFile('windows-line-endings.txt', windowsContent);
  
  // Unix改行ファイルの編集
  await safeEditLines(unixFilePath, 2, 3, "編集された2行目\n編集された3行目");
  
  // 検証
  const editedUnixContent = await fs.readFile(unixFilePath, 'utf-8');
  assertEqual(
    editedUnixContent,
    "1行目\n編集された2行目\n編集された3行目\n4行目\n5行目",
    "Unix改行ファイルが正しく編集されること"
  );
  
  // Windows改行ファイルの編集
  await safeEditLines(windowsFilePath, 2, 3, "編集された2行目\r\n編集された3行目");
  
  // 検証
  const editedWindowsContent = await fs.readFile(windowsFilePath, 'utf-8');
  assertEqual(
    editedWindowsContent,
    "1行目\r\n編集された2行目\r\n編集された3行目\r\n4行目\r\n5行目",
    "Windows改行ファイルが正しく編集されること"
  );
  
  // 異なる改行コードを持つ内容での編集（自動変換されるべき）
  await safeEditLines(windowsFilePath, 4, 4, "異なる改行コード\nの内容");
  
  // 検証
  const mixedContent = await fs.readFile(windowsFilePath, 'utf-8');
  assertEqual(
    mixedContent.includes("\r\n異なる改行コード\r\n"),
    true,
    "異なる改行コードが正しく変換されること"
  );
  
  // 範囲外の行を編集しようとした場合
  try {
    await safeEditLines(unixFilePath, 10, 15, "範囲外の行");
    throw new Error("エラーが発生しなかった");
  } catch (error) {
    const errorMessage = (error as Error).message;
    assertEqual(
      errorMessage.includes("line number out of range"),
      true,
      "範囲外の行編集でエラーが発生すること"
    );
  }
  
  // 開始行が終了行より大きい場合
  try {
    await safeEditLines(unixFilePath, 4, 2, "無効な範囲");
    throw new Error("エラーが発生しなかった");
  } catch (error) {
    const errorMessage = (error as Error).message;
    assertEqual(
      errorMessage.includes("End line number out of range"),
      true,
      "無効な範囲指定でエラーが発生すること"
    );
  }
}

async function testSafeDeleteLines() {
  // テスト環境のセットアップ
  const testDir = await setupTestDirectory();
  
  // テストファイル（Unix改行）の作成
  const unixContent = "1行目\n2行目\n3行目\n4行目\n5行目";
  const unixFilePath = await createTestFile('unix-delete.txt', unixContent);
  
  // テストファイル（Windows改行）の作成
  const windowsContent = "1行目\r\n2行目\r\n3行目\r\n4行目\r\n5行目";
  const windowsFilePath = await createTestFile('windows-delete.txt', windowsContent);
  
  // Unix改行ファイルの単一行削除
  await safeDeleteLines(unixFilePath, 2, 2);
  
  // 検証
  const editedUnixContent = await fs.readFile(unixFilePath, 'utf-8');
  assertEqual(
    editedUnixContent,
    "1行目\n3行目\n4行目\n5行目",
    "Unix改行ファイルから単一行が正しく削除されること"
  );
  
  // Windows改行ファイルの複数行削除
  await safeDeleteLines(windowsFilePath, 2, 4);
  
  // 検証
  const editedWindowsContent = await fs.readFile(windowsFilePath, 'utf-8');
  assertEqual(
    editedWindowsContent,
    "1行目\r\n5行目",
    "Windows改行ファイルから複数行が正しく削除されること"
  );
  
  // 範囲外の行を削除しようとした場合
  try {
    await safeDeleteLines(unixFilePath, 10, 15);
    throw new Error("エラーが発生しなかった");
  } catch (error) {
    const errorMessage = (error as Error).message;
    assertEqual(
      errorMessage.includes("line number out of range"),
      true,
      "範囲外の行削除でエラーが発生すること"
    );
  }
  
  // 開始行が終了行より大きい場合
  try {
    await safeDeleteLines(unixFilePath, 4, 2);
    throw new Error("エラーが発生しなかった");
  } catch (error) {
    const errorMessage = (error as Error).message;
    assertEqual(
      errorMessage.includes("End line number out of range"),
      true,
      "無効な範囲指定でエラーが発生すること"
    );
  }
}

// メインのテスト実行関数
export async function runSafeEditTests() {
  await runTests([
    { name: '安全な行編集テスト', fn: testSafeEditLines },
    { name: '安全な行削除テスト', fn: testSafeDeleteLines },
  ]);
}

// 単体で実行する場合
if (require.main === module) {
  runSafeEditTests().catch(console.error);
}
