/**
 * ファイル操作モジュールのテスト
 */

import { setupTestDirectory, createTestFile, assertEqual, runTests } from './test-utils';
import { 
  readTextFile, 
  writeTextFile, 
  deleteFile, 
  listFiles, 
  generateDirectoryTree,
  parseFileContent
} from '../src/files';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';

async function testReadTextFile() {
  // テスト環境のセットアップ
  const testDir = await setupTestDirectory();
  
  // テストファイルの作成
  const content = 'これはテストファイルの内容です。\n2行目の内容です。';
  const filePath = await createTestFile('read-test.txt', content);
  
  // ファイルの読み込み
  const readContent = await readTextFile(filePath);
  
  // 検証
  assertEqual(readContent, content, 'ファイルが正しく読み込まれること');
  
  // 存在しないファイル
  try {
    await readTextFile(path.join(testDir, 'non-existent.txt'));
    throw new Error('エラーが発生しなかった');
  } catch (error) {
    const errorMessage = (error as Error).message;
    assertEqual(
      errorMessage.includes('Failed to read file'), 
      true, 
      '存在しないファイルの読み込みでエラーが発生すること'
    );
  }
}

async function testWriteTextFile() {
  // テスト環境のセットアップ
  const testDir = await setupTestDirectory();
  const filePath = path.join(testDir, 'write-test.txt');
  
  // ファイルの書き込み
  const content = 'これは書き込みテストの内容です。';
  await writeTextFile(filePath, content);
  
  // 検証
  const readContent = await fs.readFile(filePath, 'utf-8');
  assertEqual(readContent, content, 'ファイルが正しく書き込まれること');
  
  // 追記モード
  const additionalContent = '\n追記された内容です。';
  await writeTextFile(filePath, additionalContent, true);
  
  // 検証
  const updatedContent = await fs.readFile(filePath, 'utf-8');
  assertEqual(updatedContent, content + additionalContent, 'ファイルに正しく追記されること');
  
  // 存在しないディレクトリへの書き込み（自動作成）
  const nestedFilePath = path.join(testDir, 'nested', 'dir', 'test.txt');
  await writeTextFile(nestedFilePath, content);
  
  // 検証
  const nestedContent = await fs.readFile(nestedFilePath, 'utf-8');
  assertEqual(nestedContent, content, '存在しないディレクトリへの書き込みが成功すること');
}

async function testDeleteFile() {
  // テスト環境のセットアップ
  const testDir = await setupTestDirectory();
  
  // テストファイルの作成
  const filePath = await createTestFile('delete-test.txt', 'delete test content');
  
  // ファイルが存在することを確認
  assertEqual(existsSync(filePath), true, '削除前にファイルが存在すること');
  
  // ファイルの削除
  await deleteFile(filePath);
  
  // 検証
  assertEqual(existsSync(filePath), false, 'ファイルが正しく削除されること');
  
  // 存在しないファイルの削除
  try {
    await deleteFile(path.join(testDir, 'non-existent.txt'));
    throw new Error('エラーが発生しなかった');
  } catch (error) {
    const errorMessage = (error as Error).message;
    assertEqual(
      errorMessage.includes('File does not exist'), 
      true, 
      '存在しないファイルの削除でエラーが発生すること'
    );
  }
}

async function testListFiles() {
  // テスト環境のセットアップ
  const testDir = await setupTestDirectory();
  
  // テストファイルの作成
  await createTestFile('file1.txt', 'content 1');
  await createTestFile('file2.txt', 'content 2');
  await createTestFile('file3.js', 'console.log("test");');
  
  // ファイル一覧の取得
  const files = await listFiles(testDir);
  
  // 検証
  assertEqual(files.length, 3, '正しいファイル数が返されること');
  
  // フィルター付きのファイル一覧
  const txtFiles = await listFiles(testDir, '\\.txt$');
  
  // 検証
  assertEqual(txtFiles.length, 2, 'フィルターが正しく適用されること');
  assertEqual(
    txtFiles.every(f => f.endsWith('.txt')), 
    true, 
    '.txtファイルのみが返されること'
  );
  
  // 存在しないディレクトリ
  try {
    await listFiles(path.join(testDir, 'non-existent-dir'));
    throw new Error('エラーが発生しなかった');
  } catch (error) {
    const errorMessage = (error as Error).message;
    assertEqual(
      errorMessage.includes('Directory does not exist'), 
      true, 
      '存在しないディレクトリでエラーが発生すること'
    );
  }
}

async function testParseFileContent() {
  // テスト内容の準備
  const content = '1行目\n2行目\n3行目\n4行目';
  
  // ファイル内容の解析
  const result = parseFileContent(content);
  
  // 検証
  assertEqual(result.lineCount, 4, '行数が正しく解析されること');
  assertEqual(result.firstLine, '1行目', '最初の行が正しく解析されること');
  assertEqual(result.lastLine, '4行目', '最後の行が正しく解析されること');
}

async function testGenerateDirectoryTree() {
  // テスト環境のセットアップ
  const testDir = await setupTestDirectory();
  
  // テストディレクトリ構造の作成
  const subDir1 = path.join(testDir, 'dir1');
  const subDir2 = path.join(testDir, 'dir2');
  const subSubDir = path.join(subDir1, 'subdir');
  
  mkdirSync(subDir1, { recursive: true });
  mkdirSync(subDir2, { recursive: true });
  mkdirSync(subSubDir, { recursive: true });
  
  // テストファイルの作成
  await fs.writeFile(path.join(testDir, 'root.txt'), 'root content');
  await fs.writeFile(path.join(subDir1, 'file1.txt'), 'file1 content');
  await fs.writeFile(path.join(subDir2, 'file2.txt'), 'file2 content');
  await fs.writeFile(path.join(subDir2, 'file2.log'), 'log content');
  await fs.writeFile(path.join(subSubDir, 'deep.txt'), 'deep content');
  
  // ディレクトリツリーの生成
  const tree = await generateDirectoryTree(testDir);
  
  // 検証
  assertEqual(tree.includes('root.txt'), true, 'ルートファイルがツリーに含まれること');
  assertEqual(tree.includes('dir1'), true, 'サブディレクトリがツリーに含まれること');
  assertEqual(tree.includes('subdir'), true, 'ネストされたディレクトリがツリーに含まれること');
  
  // 除外パターンを適用したツリー
  const excludedTree = await generateDirectoryTree(testDir, {
    exclude: ['**/*.log', 'dir1/**']
  });
  
  // 検証
  assertEqual(excludedTree.includes('file2.log'), false, '除外パターンが適用されていること');
  assertEqual(excludedTree.includes('deep.txt'), false, 'ネストされた除外が適用されていること');
}

// メインのテスト実行関数
export async function runFilesTests() {
  await runTests([
    { name: 'ファイル読み込みテスト', fn: testReadTextFile },
    { name: 'ファイル書き込みテスト', fn: testWriteTextFile },
    { name: 'ファイル削除テスト', fn: testDeleteFile },
    { name: 'ファイル一覧取得テスト', fn: testListFiles },
    { name: 'ファイル内容解析テスト', fn: testParseFileContent },
    { name: 'ディレクトリツリー生成テスト', fn: testGenerateDirectoryTree },
  ]);
}

// 単体で実行する場合
if (require.main === module) {
  runFilesTests().catch(console.error);
}
