/**
 * ファイル操作モジュールのテスト
 */

import { existsSync, mkdirSync } from "fs";
import fs from "fs/promises";
import path from "path";

import {
  assertEqual,
  isMainModule,
  createTestEnvironment,
  runTestSuite,
} from "./test-utils";
import {
  readTextFile,
  writeTextFile,
  deleteFile,
  listFiles,
  fileMoveOrRename,
  mulchInsertLines,
  mulchEditLines,
  mulchDeleteLines,
} from "../src/files";


async function testReadTextFile() {
  // テスト環境のセットアップ
  const { testDir , createFile } = await createTestEnvironment("legacy");

  // テストファイルの作成
  const content = "これはテストファイルの内容です。\n2行目の内容です。";
  const filePath = await createFile("read-test.txt", content);

  // ファイルの読み込み
  const { eol, lines } = await readTextFile(filePath);

  // 検証
  assertEqual(lines.join(eol), content, "ファイルが正しく読み込まれること");

  // 存在しないファイル
  try {
    await readTextFile(path.join(testDir, "non-existent.txt"));
    throw new Error("エラーが発生しなかった");
  } catch (error) {
    const errorMessage = (error as Error).message;
    assertEqual(
      errorMessage.includes("File does not exist"),
      true,
      "存在しないファイルの読み込みでエラーが発生すること",
    );
  }
}

async function testWriteTextFile() {
  // テスト環境のセットアップ
  const { testDir } = await createTestEnvironment("legacy");
  const filePath = path.join(testDir, "write-test.txt");

  // ファイルの書き込み
  const content = "これは書き込みテストの内容です。";
  await writeTextFile(filePath, content);

  // 検証
  const readContent = await fs.readFile(filePath, "utf-8");
  assertEqual(readContent, content, "ファイルが正しく書き込まれること");

  // 追記モード
  const additionalContent = "\n追記された内容です。";
  await writeTextFile(filePath, additionalContent, true);

  // 検証
  const updatedContent = await fs.readFile(filePath, "utf-8");
  assertEqual(
    updatedContent,
    content + additionalContent,
    "ファイルに正しく追記されること",
  );

  // 存在しないディレクトリへの書き込み（自動作成）
  const nestedFilePath = path.join(testDir, "nested", "dir", "test.txt");
  await writeTextFile(nestedFilePath, content);

  // 検証
  const nestedContent = await fs.readFile(nestedFilePath, "utf-8");
  assertEqual(
    nestedContent,
    content,
    "存在しないディレクトリへの書き込みが成功すること",
  );
}

async function testDeleteFile() {
  // テスト環境のセットアップ
  const { testDir, createFile } = await createTestEnvironment("legacy");

  // テストファイルの作成
  const filePath = await createFile(
    "delete-test.txt",
    "delete test content",
  );

  // ファイルが存在することを確認
  assertEqual(existsSync(filePath), true, "削除前にファイルが存在すること");

  // ファイルの削除
  await deleteFile(filePath);

  // 検証
  assertEqual(existsSync(filePath), false, "ファイルが正しく削除されること");

  // 存在しないファイルの削除
  try {
    await deleteFile(path.join(testDir, "non-existent.txt"));
    throw new Error("エラーが発生しなかった");
  } catch (error) {
    const errorMessage = (error as Error).message;
    assertEqual(
      errorMessage.includes("File does not exist"),
      true,
      "存在しないファイルの削除でエラーが発生すること",
    );
  }
}

async function testListFiles() {
  // テスト環境のセットアップ
  const env = await createTestEnvironment("legacy");
  const testDir = env.testDir;

  console.log(`テストディレクトリ: ${testDir}`);

  try {
    // テストファイルの作成ー直接テストディレクトリに作成
    console.log("テストファイルを作成中...");
    
    const file1Path = path.join(testDir, "file1.txt");
    const file2Path = path.join(testDir, "file2.txt");
    const file3Path = path.join(testDir, "file3.js");
    
    await fs.writeFile(file1Path, "content 1", "utf-8");
    await fs.writeFile(file2Path, "content 2", "utf-8");
    await fs.writeFile(file3Path, 'console.log("test");', "utf-8");
    
    console.log("テストファイル作成完了");
    
    // ファイルが実際に作成されたか確認
    console.log(`file1.txt存在: ${existsSync(file1Path)}`);
    console.log(`file2.txt存在: ${existsSync(file2Path)}`);
    console.log(`file3.js存在: ${existsSync(file3Path)}`);

    // ファイル一覧の取得
    console.log("ファイル一覧を取得中...");
    const files = await listFiles(testDir);
    console.log(`取得されたファイル数: ${files.length}`);
    console.log(`ファイル一覧: ${JSON.stringify(files, null, 2)}`);

    // 検証
    assertEqual(files.length, 3, "正しいファイル数が返されること");

    // フィルター付きのファイル一覧
    console.log("フィルター付きファイル一覧を取得中...");
    const txtFiles = await listFiles(testDir, "\\.txt$");
    console.log(`フィルター後のファイル数: ${txtFiles.length}`);
    console.log(`フィルター後のファイル一覧: ${JSON.stringify(txtFiles, null, 2)}`);

    // 検証
    assertEqual(txtFiles.length, 2, "フィルターが正しく適用されること");
    assertEqual(
      txtFiles.every((f) => f.endsWith(".txt")),
      true,
      ".txtファイルのみが返されること",
    );

    // 存在しないディレクトリ
    console.log("存在しないディレクトリのテスト中...");
    try {
      await listFiles(path.join(testDir, "non-existent-dir"));
      throw new Error("エラーが発生しなかった");
    } catch (error) {
      const errorMessage = (error as Error).message;
      assertEqual(
        errorMessage.includes("Directory does not exist"),
        true,
        "存在しないディレクトリでエラーが発生すること",
      );
    }
    console.log("ファイル一覧取得テスト完了");
  } catch (error) {
    console.error("testListFiles内でエラーが発生:", error);
    throw error;
  }
}

async function testFileMoveOrRename() {
  // テスト環境のセットアップ
  const { testDir, createFile } = await createTestEnvironment("legacy");

  // === テスト1: ファイルのリネーム ===
  const originalFileName = "original-file.txt";
  const renamedFileName = "renamed-file.txt";
  const content = "これはファイル移動テストの内容です。\n2行目の内容です。";

  // テストファイルの作成
  const originalFilePath = await createFile(originalFileName, content);
  const renamedFilePath = path.join(testDir, renamedFileName);

  // ファイルのリネーム
  const renameMessage = await fileMoveOrRename(
    originalFilePath,
    renamedFilePath,
  );

  // 検証
  assertEqual(
    renameMessage.includes("移動完了"),
    true,
    "リネーム成功メッセージが返されること",
  );
  assertEqual(
    existsSync(originalFilePath),
    false,
    "元のファイルが存在しないこと",
  );
  assertEqual(
    existsSync(renamedFilePath),
    true,
    "リネーム後のファイルが存在すること",
  );

  // ファイル内容が保持されることを確認
  const renamedContent = await fs.readFile(renamedFilePath, "utf-8");
  assertEqual(renamedContent, content, "ファイル内容が保持されること");

  // === テスト2: 別ディレクトリへのファイル移動 ===
  const moveTestFile = "move-test.txt";
  const moveTestContent = "これは移動テスト用のファイルです。";
  const subDir = "subdirectory";
  const subDirPath = path.join(testDir, subDir);

  // サブディレクトリを作成
  await fs.mkdir(subDirPath, { recursive: true });

  // テストファイルの作成
  const moveTestFilePath = await createFile(moveTestFile, moveTestContent);
  const movedFilePath = path.join(subDirPath, "moved-file.txt");

  // ファイルの移動
  const moveMessage = await fileMoveOrRename(moveTestFilePath, movedFilePath);

  // 検証
  assertEqual(
    moveMessage.includes("移動完了"),
    true,
    "移動成功メッセージが返されること",
  );
  assertEqual(
    existsSync(moveTestFilePath),
    false,
    "元のファイルが存在しないこと",
  );
  assertEqual(
    existsSync(movedFilePath),
    true,
    "移動後のファイルが存在すること",
  );

  // ファイル内容が保持されることを確認
  const movedContent = await fs.readFile(movedFilePath, "utf-8");
  assertEqual(
    movedContent,
    moveTestContent,
    "移動後もファイル内容が保持されること",
  );

  // === テスト3: ディレクトリの移動 ===
  const sourceDirName = "source-directory";
  const targetDirName = "target-directory";
  const sourceDirPath = path.join(testDir, sourceDirName);
  const targetDirPath = path.join(testDir, targetDirName);

  // ソースディレクトリとファイルを作成
  await fs.mkdir(sourceDirPath, { recursive: true });
  const dirTestFilePath = path.join(sourceDirPath, "dir-test-file.txt");
  await fs.writeFile(dirTestFilePath, "ディレクトリ移動テスト用ファイル");

  // ディレクトリの移動
  const dirMoveMessage = await fileMoveOrRename(sourceDirPath, targetDirPath);

  // 検証
  assertEqual(
    dirMoveMessage.includes("移動完了"),
    true,
    "ディレクトリ移動成功メッセージが返されること",
  );
  assertEqual(
    existsSync(sourceDirPath),
    false,
    "元のディレクトリが存在しないこと",
  );
  assertEqual(
    existsSync(targetDirPath),
    true,
    "移動後のディレクトリが存在すること",
  );
  assertEqual(
    existsSync(path.join(targetDirPath, "dir-test-file.txt")),
    true,
    "ディレクトリ内のファイルも移動されること",
  );

  // === テスト4: 存在しないファイル/ディレクトリの移動（エラーケース） ===
  const nonExistentPath = path.join(testDir, "non-existent-file.txt");
  const targetPath = path.join(testDir, "target-file.txt");

  try {
    await fileMoveOrRename(nonExistentPath, targetPath);
    throw new Error("エラーが発生しなかった");
  } catch (error) {
    const errorMessage = (error as Error).message;
    assertEqual(
      errorMessage.includes("ENOENT") || errorMessage.includes("no such file"),
      true,
      "存在しないファイルの移動でエラーが発生すること",
    );
  }

  // === テスト5: 移動先が既に存在する場合（エラーケース） ===
  const existingFile1 = await createFile("existing1.txt", "content1");
  const existingFile2 = await createFile("existing2.txt", "content2");

  try {
    await fileMoveOrRename(existingFile1, existingFile2);
    throw new Error("エラーが発生しなかった");
  } catch (error) {
    const errorMessage = (error as Error).message;
    assertEqual(
      errorMessage.includes("すでにファイルまたはディレクトリが存在します"),
      true,
      "移動先が既に存在する場合にエラーが発生すること",
    );
  }

  // 両方のファイルがまだ存在することを確認（移動されていないことの確認）
  assertEqual(
    existsSync(existingFile1),
    true,
    "移動に失敗した場合、元のファイルが残存すること",
  );
  assertEqual(
    existsSync(existingFile2),
    true,
    "移動に失敗した場合、移動先のファイルが変更されないこと",
  );

  // === テスト6: ネストされたディレクトリへの移動（自動ディレクトリ作成） ===
  const nestedTestFile = await createFile(
    "nested-test.txt",
    "nested content",
  );
  const nestedTargetPath = path.join(
    testDir,
    "deep",
    "nested",
    "path",
    "nested-file.txt",
  );

  // ネストされたパスへの移動
  const nestedMoveMessage = await fileMoveOrRename(
    nestedTestFile,
    nestedTargetPath,
  );

  // 検証
  assertEqual(
    nestedMoveMessage.includes("移動完了"),
    true,
    "ネストされたディレクトリへの移動が成功すること",
  );
  assertEqual(
    existsSync(nestedTestFile),
    false,
    "元のファイルが存在しないこと",
  );
  assertEqual(
    existsSync(nestedTargetPath),
    true,
    "ネストされたパスにファイルが移動されること",
  );
  assertEqual(
    existsSync(path.dirname(nestedTargetPath)),
    true,
    "必要なディレクトリが自動作成されること",
  );
}

/**
 * mulchInsertLinesのテスト
 */
async function testMulchInsertLines() {
  const { createFile } = await createTestEnvironment('mulch-insert-lines');

  // === テスト1: 基本的な複数行挿入 ===
  const initialContent = "1行目\n2行目\n3行目\n4行目\n5行目";
  const filePath = await createFile('insert-test.txt', initialContent);

  // 複数行を異なる位置に挿入
  const insertData = [
    { lineNumber: 2, content: "挿入された新しい2行目" },
    { lineNumber: 4, content: "挿入された新しい4行目" }
  ];

  const message = await mulchInsertLines(filePath, insertData);

  // 結果を検証
  const { lines } = await readTextFile(filePath);
  assertEqual(
    lines.join('\n'),
    "1行目\n挿入された新しい2行目\n2行目\n3行目\n挿入された新しい4行目\n4行目\n5行目",
    "複数行が正しい位置に挿入されること"
  );
  assertEqual(
    message.includes("Successfully Insert lines"),
    true,
    "成功メッセージが返されること"
  );

  // === テスト2: afterModeでの挿入 ===
  const afterContent = "A行\nB行\nC行";
  const afterFilePath = await createFile('after-insert-test.txt', afterContent);

  const afterInsertData = [
    { lineNumber: 1, content: "A行の後に挿入" },
    { lineNumber: 2, content: "B行の後に挿入" }
  ];

  await mulchInsertLines(afterFilePath, afterInsertData, true);

  const { lines: afterLines } = await readTextFile(afterFilePath);
  assertEqual(
    afterLines.join('\n'),
    "A行\nA行の後に挿入\nB行\nB行の後に挿入\nC行",
    "afterModeで正しい位置に挿入されること"
  );

  // === テスト3: 複数行コンテンツの挿入 ===
  const multiLineContent = "行1\n行2\n行3";
  const multiFilePath = await createFile('multi-insert-test.txt', multiLineContent);

  const multiInsertData = [
    { lineNumber: 2, content: "複数行の\n挿入テスト\n内容" }
  ];

  await mulchInsertLines(multiFilePath, multiInsertData);

  const { lines: multiLines } = await readTextFile(multiFilePath);
  assertEqual(
    multiLines.join('\n'),
    "行1\n複数行の\n挿入テスト\n内容\n行2\n行3",
    "複数行のコンテンツが正しく挿入されること"
  );

  // === テスト4: 改行コードの保持 ===
  const windowsContent = "行1\r\n行2\r\n行3";
  const windowsFilePath = await createFile('windows-insert-test.txt', windowsContent);

  const windowsInsertData = [
    { lineNumber: 2, content: "Windows挿入テスト" }
  ];

  await mulchInsertLines(windowsFilePath, windowsInsertData);

  const windowsResult = await fs.readFile(windowsFilePath, 'utf-8');
  assertEqual(
    windowsResult.includes('\r\n'),
    true,
    "Windows改行コードが保持されること"
  );

  // === テスト5: エラーケース - 重複する行番号 ===
  const duplicateFilePath = await createFile('duplicate-test.txt', "テスト\n内容");
  const duplicateInsertData = [
    { lineNumber: 1, content: "重複1" },
    { lineNumber: 1, content: "重複2" }
  ];

  try {
    await mulchInsertLines(duplicateFilePath, duplicateInsertData);
    throw new Error("エラーが発生しなかった");
  } catch (error) {
    const errorMessage = (error as Error).message;
    assertEqual(
      errorMessage.includes("重複があります"),
      true,
      "重複する行番号でエラーが発生すること"
    );
  }

  // === テスト6: 境界値テスト - ファイル先頭と末尾 ===
  const boundaryContent = "最初\n最後";
  const boundaryFilePath = await createFile('boundary-test.txt', boundaryContent);

  const boundaryInsertData = [
    { lineNumber: 1, content: "先頭に挿入" },
    { lineNumber: 3, content: "末尾に挿入" }
  ];

  await mulchInsertLines(boundaryFilePath, boundaryInsertData);

  const { lines: boundaryLines } = await readTextFile(boundaryFilePath);
  assertEqual(
    boundaryLines.join('\n'),
    "先頭に挿入\n最初\n最後\n末尾に挿入",
    "ファイルの先頭と末尾への挿入が正しく動作すること"
  );
}

/**
 * mulchEditLinesのテスト
 */
async function testMulchEditLines() {
  const { createFile } = await createTestEnvironment('mulch-edit-lines');

  // === テスト1: 基本的な複数範囲編集 ===
  const initialContent = "1行目\n2行目\n3行目\n4行目\n5行目\n6行目";
  const filePath = await createFile('edit-test.txt', initialContent);

  const editData = [
    { startLine: 2, endLine: 2, content: "編集された2行目" },
    { startLine: 4, endLine: 5, content: "編集された4-5行目\n統合された内容" }
  ];

  const result = await mulchEditLines(filePath, editData, false);

  // 結果を検証
  const { lines } = await readTextFile(filePath);
  assertEqual(
    lines.join('\n'),
    "1行目\n編集された2行目\n3行目\n編集された4-5行目\n統合された内容\n6行目",
    "複数範囲が正しく編集されること"
  );
  assertEqual(
    result.message.includes("Successfully Edit lines"),
    true,
    "成功メッセージが返されること"
  );
  assertEqual(
    result.content.length > 0,
    true,
    "差分コンテンツが返されること"
  );

  // === テスト2: プレビューモード ===
  const previewContent = "A行\nB行\nC行\nD行";
  const previewFilePath = await createFile('preview-test.txt', previewContent);

  const previewEditData = [
    { startLine: 2, endLine: 3, content: "プレビュー編集\nテスト内容" }
  ];

  const previewResult = await mulchEditLines(previewFilePath, previewEditData, true);

  // プレビューモードでは元のファイルが変更されないことを確認
  const { lines: unchangedLines } = await readTextFile(previewFilePath);
  assertEqual(
    unchangedLines.join('\n'),
    previewContent,
    "プレビューモードではファイルが変更されないこと"
  );
  assertEqual(
    previewResult.message.includes("Preview Edit lines"),
    true,
    "プレビューメッセージが返されること"
  );
  assertEqual(
    previewResult.content.includes("テスト内容"),
    true,
    "差分にプレビュー内容が含まれること"
  );

  // === テスト3: 単一行の編集 ===
  const singleContent = "行1\n行2\n行3";
  const singleFilePath = await createFile('single-edit-test.txt', singleContent);

  const singleEditData = [
    { startLine: 2, endLine: 2, content: "変更された行2" }
  ];

  await mulchEditLines(singleFilePath, singleEditData, false);

  const { lines: singleLines } = await readTextFile(singleFilePath);
  assertEqual(
    singleLines.join('\n'),
    "行1\n変更された行2\n行3",
    "単一行の編集が正しく動作すること"
  );

  // === テスト4: エラーケース - 重複する範囲 ===
  const overlapFilePath = await createFile('overlap-test.txt', "1\n2\n3\n4\n5");
  const overlapEditData = [
    { startLine: 2, endLine: 3, content: "範囲1" },
    { startLine: 3, endLine: 4, content: "範囲2" }
  ];

  try {
    await mulchEditLines(overlapFilePath, overlapEditData, false);
    throw new Error("エラーが発生しなかった");
  } catch (error) {
    const errorMessage = (error as Error).message;
    assertEqual(
      errorMessage.includes("重複"),
      true,
      "重複する範囲でエラーが発生すること"
    );
  }

  // === テスト5: エラーケース - 無効な範囲 ===
  const invalidRangeFilePath = await createFile('invalid-range-test.txt', "1\n2\n3");
  const invalidEditData = [
    { startLine: 3, endLine: 2, content: "無効な範囲" }
  ];

  try {
    await mulchEditLines(invalidRangeFilePath, invalidEditData, false);
    throw new Error("エラーが発生しなかった");
  } catch (error) {
    const errorMessage = (error as Error).message;
    assertEqual(
      errorMessage.includes("小さくできません"),
      true,
      "無効な範囲指定でエラーが発生すること"
    );
  }

  // === テスト6: 改行コードの保持 ===
  const windowsEditContent = "行1\r\n行2\r\n行3";
  const windowsEditFilePath = await createFile('windows-edit-test.txt', windowsEditContent);

  const windowsEditData = [
    { startLine: 2, endLine: 2, content: "Windows編集テスト" }
  ];

  await mulchEditLines(windowsEditFilePath, windowsEditData, false);

  const windowsEditResult = await fs.readFile(windowsEditFilePath, 'utf-8');
  assertEqual(
    windowsEditResult.includes('\r\n'),
    true,
    "Windows改行コードが保持されること"
  );
}

/**
 * mulchDeleteLinesのテスト
 */
async function testMulchDeleteLines() {
  const { createFile } = await createTestEnvironment('mulch-delete-lines');

  // === テスト1: 基本的な複数範囲削除 ===
  const initialContent = "1行目\n2行目\n3行目\n4行目\n5行目\n6行目\n7行目";
  const filePath = await createFile('delete-test.txt', initialContent);

  const deleteData = [
    { startLine: 2, endLine: 2 },  // 2行目のみ削除
    { startLine: 4, endLine: 5 }   // 4-5行目を削除
  ];

  const message = await mulchDeleteLines(filePath, deleteData);

  // 結果を検証
  const { lines } = await readTextFile(filePath);
  assertEqual(
    lines.join('\n'),
    "1行目\n3行目\n6行目\n7行目",
    "複数範囲が正しく削除されること"
  );
  assertEqual(
    message.includes("Successfully Deleted lines"),
    true,
    "成功メッセージが返されること"
  );

  // === テスト2: 単一行の削除 ===
  const singleContent = "A行\nB行\nC行\nD行";
  const singleFilePath = await createFile('single-delete-test.txt', singleContent);

  const singleDeleteData = [
    { startLine: 2, endLine: 2 }
  ];

  await mulchDeleteLines(singleFilePath, singleDeleteData);

  const { lines: singleLines } = await readTextFile(singleFilePath);
  assertEqual(
    singleLines.join('\n'),
    "A行\nC行\nD行",
    "単一行の削除が正しく動作すること"
  );

  // === テスト3: ファイル全体の削除 ===
  const wholeContent = "全行1\n全行2\n全行3";
  const wholeFilePath = await createFile('whole-delete-test.txt', wholeContent);

  const wholeDeleteData = [
    { startLine: 1, endLine: 3 }
  ];

  await mulchDeleteLines(wholeFilePath, wholeDeleteData);

  const { lines: wholeLines } = await readTextFile(wholeFilePath);
  assertEqual(
    wholeLines.join(''),
    "",
    "ファイル全体の削除が正しく動作すること"
  );

  // === テスト4: 連続しない複数範囲の削除 ===
  const multiContent = "1\n2\n3\n4\n5\n6\n7\n8\n9\n10";
  const multiFilePath = await createFile('multi-delete-test.txt', multiContent);

  const multiDeleteData = [
    { startLine: 2, endLine: 3 },  // 2-3行目削除
    { startLine: 6, endLine: 7 },  // 6-7行目削除
    { startLine: 9, endLine: 9 }   // 9行目のみ削除
  ];

  await mulchDeleteLines(multiFilePath, multiDeleteData);

  const { lines: multiLines } = await readTextFile(multiFilePath);
  assertEqual(
    multiLines.join('\n'),
    "1\n4\n5\n8\n10",
    "連続しない複数範囲の削除が正しく動作すること"
  );

  // === テスト5: エラーケース - 重複する範囲 ===
  const overlapFilePath = await createFile('overlap-delete-test.txt', "1\n2\n3\n4\n5");
  const overlapDeleteData = [
    { startLine: 2, endLine: 3 },
    { startLine: 3, endLine: 4 }
  ];

  try {
    await mulchDeleteLines(overlapFilePath, overlapDeleteData);
    throw new Error("エラーが発生しなかった");
  } catch (error) {
    const errorMessage = (error as Error).message;
    assertEqual(
      errorMessage.includes("重複"),
      true,
      "重複する範囲でエラーが発生すること"
    );
  }

  // === テスト6: エラーケース - 無効な範囲 ===
  const invalidRangeFilePath = await createFile('invalid-range-delete-test.txt', "1\n2\n3");
  const invalidDeleteData = [
    { startLine: 3, endLine: 2 }
  ];

  try {
    await mulchDeleteLines(invalidRangeFilePath, invalidDeleteData);
    throw new Error("エラーが発生しなかった");
  } catch (error) {
    const errorMessage = (error as Error).message;
    assertEqual(
      errorMessage.includes("小さくできません"),
      true,
      "無効な範囲指定でエラーが発生すること"
    );
  }

  // === テスト7: 改行コードの保持 ===
  const windowsDeleteContent = "行1\r\n行2\r\n行3\r\n行4";
  const windowsDeleteFilePath = await createFile('windows-delete-test.txt', windowsDeleteContent);

  const windowsDeleteData = [
    { startLine: 2, endLine: 3 }
  ];

  await mulchDeleteLines(windowsDeleteFilePath, windowsDeleteData);

  const windowsDeleteResult = await fs.readFile(windowsDeleteFilePath, 'utf-8');
  assertEqual(
    windowsDeleteResult.includes('\r\n'),
    true,
    "Windows改行コードが保持されること"
  );

  // === テスト8: 境界値テスト - ファイルの先頭と末尾 ===
  const boundaryContent = "最初\n中間1\n中間2\n最後";
  const boundaryFilePath = await createFile('boundary-delete-test.txt', boundaryContent);

  const boundaryDeleteData = [
    { startLine: 1, endLine: 1 },  // 最初の行削除
    { startLine: 4, endLine: 4 }   // 最後の行削除（元の行番号で指定）
  ];

  await mulchDeleteLines(boundaryFilePath, boundaryDeleteData);

  const { lines: boundaryLines } = await readTextFile(boundaryFilePath);
  assertEqual(
    boundaryLines.join('\n'),
    "中間1\n中間2",
    "ファイルの先頭と末尾の削除が正しく動作すること"
  );
}

// メインのテスト実行関数
export async function runFilesTests() {
  await runTestSuite("Legacy Test Suite", [
    { name: "ファイル読み込みテスト", fn: testReadTextFile },
    { name: "ファイル書き込みテスト", fn: testWriteTextFile },
    { name: "ファイル削除テスト", fn: testDeleteFile },
    { name: "ファイル一覧取得テスト", fn: testListFiles },
    { name: "複数行挿入テスト", fn: testMulchInsertLines },
    { name: "複数行編集テスト", fn: testMulchEditLines },
    { name: "複数行削除テスト", fn: testMulchDeleteLines },
    { name: "ファイル移動・リネームテスト", fn: testFileMoveOrRename },
  ]);
}

// 単体で実行する場合
if (isMainModule(import.meta.url)) {
  runFilesTests().catch(console.error);
}
