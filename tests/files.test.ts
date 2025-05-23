/**
 * ファイル操作モジュールのテスト
 */

import { existsSync, mkdirSync } from "fs";
import fs from "fs/promises";
import path from "path";

import {
  setupTestDirectory,
  createTestFile,
  assertEqual,
  runTests,
  isMainModule,
} from "./test-utils";
import {
  readTextFile,
  writeTextFile,
  deleteFile,
  listFiles,
  editLines,
  deleteLines,
  generateDirectoryTree,
  parseFileContent,
  fileMoveOrRename,
} from "../src/files";

async function testReadTextFile() {
  // テスト環境のセットアップ
  const testDir = await setupTestDirectory();

  // テストファイルの作成
  const content = "これはテストファイルの内容です。\n2行目の内容です。";
  const filePath = await createTestFile("read-test.txt", content);

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
  const testDir = await setupTestDirectory();
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
  const testDir = await setupTestDirectory();

  // テストファイルの作成
  const filePath = await createTestFile(
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
  const testDir = await setupTestDirectory();

  // テストファイルの作成
  await createTestFile("file1.txt", "content 1");
  await createTestFile("file2.txt", "content 2");
  await createTestFile("file3.js", 'console.log("test");');

  // ファイル一覧の取得
  const files = await listFiles(testDir);

  // 検証
  assertEqual(files.length, 3, "正しいファイル数が返されること");

  // フィルター付きのファイル一覧
  const txtFiles = await listFiles(testDir, "\\.txt$");

  // 検証
  assertEqual(txtFiles.length, 2, "フィルターが正しく適用されること");
  assertEqual(
    txtFiles.every((f) => f.endsWith(".txt")),
    true,
    ".txtファイルのみが返されること",
  );

  // 存在しないディレクトリ
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
}

async function testParseFileContent() {
  // テスト内容の準備
  const content = "1行目\n2行目\n3行目\n4行目";

  // ファイル内容の解析
  const result = parseFileContent(content);

  // 検証
  assertEqual(result.lineCount, 4, "行数が正しく解析されること");
  assertEqual(result.firstLine, "1行目", "最初の行が正しく解析されること");
  assertEqual(result.lastLine, "4行目", "最後の行が正しく解析されること");
}

async function testSafeEditLines() {
  // テスト環境のセットアップ
  const testDir = await setupTestDirectory();

  // テストファイル（Unix改行）の作成
  const unixContent = "1行目\n2行目\n3行目\n4行目\n5行目";
  const unixFilePath = await createTestFile(
    "unix-line-endings.txt",
    unixContent,
  );

  // テストファイル（Windows改行）の作成
  const windowsContent = "1行目\r\n2行目\r\n3行目\r\n4行目\r\n5行目";
  const windowsFilePath = await createTestFile(
    "windows-line-endings.txt",
    windowsContent,
  );

  // Unix改行ファイルの編集
  await editLines(unixFilePath, 2, 3, "編集された2行目\n編集された3行目");

  // 検証
  const editedUnixContent = await fs.readFile(unixFilePath, "utf-8");
  assertEqual(
    editedUnixContent,
    "1行目\n編集された2行目\n編集された3行目\n4行目\n5行目",
    "Unix改行ファイルが正しく編集されること",
  );

  // Windows改行ファイルの編集
  await editLines(windowsFilePath, 2, 3, "編集された2行目\r\n編集された3行目");

  // 検証
  const editedWindowsContent = await fs.readFile(windowsFilePath, "utf-8");
  assertEqual(
    editedWindowsContent,
    "1行目\r\n編集された2行目\r\n編集された3行目\r\n4行目\r\n5行目",
    "Windows改行ファイルが正しく編集されること",
  );

  // 異なる改行コードを持つ内容での編集（自動変換されるべき）
  await editLines(windowsFilePath, 4, 4, "異なる改行コード\nの内容");

  // 検証
  const mixedContent = await fs.readFile(windowsFilePath, "utf-8");
  assertEqual(
    mixedContent.includes("\r\n異なる改行コード\r\n"),
    true,
    "異なる改行コードが正しく変換されること",
  );

  // 範囲外の行を編集しようとした場合
  try {
    await editLines(unixFilePath, 10, 15, "範囲外の行");
    throw new Error("エラーが発生しなかった");
  } catch (error) {
    const errorMessage = (error as Error).message;
    assertEqual(
      errorMessage.includes("line number out of range"),
      true,
      "範囲外の行編集でエラーが発生すること",
    );
  }

  // 開始行が終了行より大きい場合
  try {
    await editLines(unixFilePath, 4, 2, "無効な範囲");
    throw new Error("エラーが発生しなかった");
  } catch (error) {
    const errorMessage = (error as Error).message;
    assertEqual(
      errorMessage.includes("End line number out of range"),
      true,
      "無効な範囲指定でエラーが発生すること",
    );
  }
}

async function testSafeDeleteLines() {
  // テスト環境のセットアップ
  const testDir = await setupTestDirectory();

  // テストファイル（Unix改行）の作成
  const unixContent = "1行目\n2行目\n3行目\n4行目\n5行目";
  const unixFilePath = await createTestFile("unix-delete.txt", unixContent);

  // テストファイル（Windows改行）の作成
  const windowsContent = "1行目\r\n2行目\r\n3行目\r\n4行目\r\n5行目";
  const windowsFilePath = await createTestFile(
    "windows-delete.txt",
    windowsContent,
  );

  // Unix改行ファイルの単一行削除
  await deleteLines(unixFilePath, 2, 2);

  // 検証
  const editedUnixContent = await fs.readFile(unixFilePath, "utf-8");
  assertEqual(
    editedUnixContent,
    "1行目\n3行目\n4行目\n5行目",
    "Unix改行ファイルから単一行が正しく削除されること",
  );

  // Windows改行ファイルの複数行削除
  await deleteLines(windowsFilePath, 2, 4);

  // 検証
  const editedWindowsContent = await fs.readFile(windowsFilePath, "utf-8");
  assertEqual(
    editedWindowsContent,
    "1行目\r\n5行目",
    "Windows改行ファイルから複数行が正しく削除されること",
  );

  // 範囲外の行を削除しようとした場合
  try {
    await deleteLines(unixFilePath, 10, 15);
    throw new Error("エラーが発生しなかった");
  } catch (error) {
    const errorMessage = (error as Error).message;
    assertEqual(
      errorMessage.includes("line number out of range"),
      true,
      "範囲外の行削除でエラーが発生すること",
    );
  }

  // 開始行が終了行より大きい場合
  try {
    await deleteLines(unixFilePath, 4, 2);
    throw new Error("エラーが発生しなかった");
  } catch (error) {
    const errorMessage = (error as Error).message;
    assertEqual(
      errorMessage.includes("End line number out of range"),
      true,
      "無効な範囲指定でエラーが発生すること",
    );
  }
}

async function testGenerateDirectoryTree() {
  // テスト環境のセットアップ
  const testDir = await setupTestDirectory();

  // テストディレクトリ構造の作成
  const subDir1 = path.join(testDir, "dir1");
  const subDir2 = path.join(testDir, "dir2");
  const subSubDir = path.join(subDir1, "subdir");

  mkdirSync(subDir1, { recursive: true });
  mkdirSync(subDir2, { recursive: true });
  mkdirSync(subSubDir, { recursive: true });

  // テストファイルの作成
  await fs.writeFile(path.join(testDir, "root.txt"), "root content");
  await fs.writeFile(path.join(subDir1, "file1.txt"), "file1 content");
  await fs.writeFile(path.join(subDir2, "file2.txt"), "file2 content");
  await fs.writeFile(path.join(subDir2, "file2.log"), "log content");
  await fs.writeFile(path.join(subSubDir, "deep.txt"), "deep content");

  // ディレクトリツリーの生成
  const tree = await generateDirectoryTree(testDir);

  // 検証
  assertEqual(
    tree.includes("root.txt"),
    true,
    "ルートファイルがツリーに含まれること",
  );
  assertEqual(
    tree.includes("dir1"),
    true,
    "サブディレクトリがツリーに含まれること",
  );
  assertEqual(
    tree.includes("subdir"),
    true,
    "ネストされたディレクトリがツリーに含まれること",
  );

  // 除外パターンを適用したツリー
  const excludedTree = await generateDirectoryTree(testDir, {
    exclude: ["**/*.log", "dir1/**"],
  });

  // 検証
  assertEqual(
    excludedTree.includes("file2.log"),
    false,
    "除外パターンが適用されていること",
  );
  assertEqual(
    excludedTree.includes("deep.txt"),
    false,
    "ネストされた除外が適用されていること",
  );
}

async function testFileMoveOrRename() {
  // テスト環境のセットアップ
  const testDir = await setupTestDirectory();

  // === テスト1: ファイルのリネーム ===
  const originalFileName = "original-file.txt";
  const renamedFileName = "renamed-file.txt";
  const content = "これはファイル移動テストの内容です。\n2行目の内容です。";

  // テストファイルの作成
  const originalFilePath = await createTestFile(originalFileName, content);
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
  const moveTestFilePath = await createTestFile(moveTestFile, moveTestContent);
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
  const existingFile1 = await createTestFile("existing1.txt", "content1");
  const existingFile2 = await createTestFile("existing2.txt", "content2");

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
  const nestedTestFile = await createTestFile(
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

// メインのテスト実行関数
export async function runFilesTests() {
  await runTests([
    { name: "ファイル読み込みテスト", fn: testReadTextFile },
    { name: "ファイル書き込みテスト", fn: testWriteTextFile },
    { name: "ファイル削除テスト", fn: testDeleteFile },
    { name: "ファイル一覧取得テスト", fn: testListFiles },
    { name: "ファイル内容解析テスト", fn: testParseFileContent },
    { name: "安全な行編集テスト", fn: testSafeEditLines },
    { name: "安全な行削除テスト", fn: testSafeDeleteLines },

    { name: "ディレクトリツリー生成テスト", fn: testGenerateDirectoryTree },
    { name: "ファイル移動・リネームテスト", fn: testFileMoveOrRename },
  ]);
}

// 単体で実行する場合
if (isMainModule(import.meta.url)) {
  runFilesTests().catch(console.error);
}
