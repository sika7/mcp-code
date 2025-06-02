/**
 * 検索モジュールのテスト
 */

import { mkdirSync } from "fs";
import fs from "fs/promises";
import path from "path";

import {
  createTestEnvironment,
  assertEqual,
  isMainModule,
  runTestSuite,
} from "./test-utils";
import {
  normalizeOptions,
  normalizeDirectoryOptions,
  shouldUseStreamProcessing,
  shouldIncludeFile,
  createMatcher,
  findMatches,
  extractContext,
  formatGrepMatch,
  processLinesSync,
  fileGrep,
  directoryGrep,
  projectGrep,
  FileGrepOptionsSchema,
  DirectoryGrepOptionsSchema,
} from "../src/lib/search";

async function testNormalizeOptions() {
  // デフォルトオプションのテスト
  const defaultOptions = normalizeOptions();
  
  assertEqual(defaultOptions.regex, false, "デフォルトでregexはfalse");
  assertEqual(defaultOptions.caseSensitive, false, "デフォルトでcaseSensitiveはfalse");
  assertEqual(defaultOptions.flags, "i", "デフォルトフラグは'i'");
  assertEqual(defaultOptions.maxResults, 100, "デフォルトmaxResultsは100");
  assertEqual(defaultOptions.context, 0, "デフォルトcontextは0");
  
  // カスタムオプションのテスト
  const customOptions = normalizeOptions({
    regex: true,
    caseSensitive: true,
    flags: "gm",
    maxResults: 50,
    context: 3,
  });
  
  assertEqual(customOptions.regex, true, "カスタムregexオプションが反映される");
  assertEqual(customOptions.caseSensitive, true, "カスタムcaseSensitiveオプションが反映される");
  assertEqual(customOptions.flags, "gm", "カスタムflagsオプションが反映される");
  assertEqual(customOptions.maxResults, 50, "カスタムmaxResultsオプションが反映される");
  assertEqual(customOptions.context, 3, "カスタムcontextオプションが反映される");
  
  // 境界値テスト（contextの制限）
  const boundaryOptions = normalizeOptions({
    context: 15, // 10を超える値
  });
  assertEqual(boundaryOptions.context, 10, "contextは最大10に制限される");
  
  const negativeOptions = normalizeOptions({
    context: -5, // 負の値
  });
  assertEqual(negativeOptions.context, 0, "負のcontextは0になる");
}

async function testNormalizeDirectoryOptions() {
  // デフォルトオプションのテスト
  const defaultOptions = normalizeDirectoryOptions();
  
  assertEqual(defaultOptions.fileTypes, [], "デフォルトfileTypesは空配列");
  assertEqual(defaultOptions.recursive, true, "デフォルトrecursiveはtrue");
  assertEqual(defaultOptions.includeHidden, false, "デフォルトincludeHiddenはfalse");
  assertEqual(defaultOptions.maxFileSize, 10 * 1024 * 1024, "デフォルトmaxFileSizeは10MB");
  
  // excludeパターンの確認
  const expectedExcludes = ['node_modules', 'dist', '.git', '.next', 'build', 'coverage'];
  assertEqual(
    JSON.stringify(defaultOptions.exclude),
    JSON.stringify(expectedExcludes),
    "デフォルトexcludeパターンが正しい"
  );
  
  // カスタムオプションのテスト
  const customOptions = normalizeDirectoryOptions({
    fileTypes: ['.ts', '.js'],
    recursive: false,
    exclude: ['custom'],
    includeHidden: true,
    maxFileSize: 5 * 1024 * 1024,
  });
  
  assertEqual(
    JSON.stringify(customOptions.fileTypes),
    JSON.stringify(['.ts', '.js']),
    "カスタムfileTypesが反映される"
  );
  assertEqual(customOptions.recursive, false, "カスタムrecursiveが反映される");
  assertEqual(customOptions.includeHidden, true, "カスタムincludeHiddenが反映される");
  assertEqual(customOptions.maxFileSize, 5 * 1024 * 1024, "カスタムmaxFileSizeが反映される");
}

async function testShouldUseStreamProcessing() {
  // デフォルトしきい値（50MB）のテスト
  assertEqual(
    shouldUseStreamProcessing(10 * 1024 * 1024),
    false,
    "10MBファイルはストリーム処理を使用しない"
  );
  
  assertEqual(
    shouldUseStreamProcessing(100 * 1024 * 1024),
    true,
    "100MBファイルはストリーム処理を使用する"
  );
  
  // カスタムしきい値のテスト
  assertEqual(
    shouldUseStreamProcessing(30 * 1024 * 1024, 20 * 1024 * 1024),
    true,
    "カスタムしきい値でストリーム処理を使用する"
  );
  
  assertEqual(
    shouldUseStreamProcessing(10 * 1024 * 1024, 20 * 1024 * 1024),
    false,
    "カスタムしきい値以下はストリーム処理を使用しない"
  );
}

async function testShouldIncludeFile() {
  const baseOptions = normalizeDirectoryOptions();
  
  // 隠しファイルのテスト
  assertEqual(
    shouldIncludeFile("/path/to/.hidden", ".hidden", baseOptions),
    false,
    "隠しファイルは除外される"
  );
  
  const includeHiddenOptions = normalizeDirectoryOptions({ includeHidden: true });
  assertEqual(
    shouldIncludeFile("/path/to/.hidden", ".hidden", includeHiddenOptions),
    true,
    "includeHidden=trueの場合、隠しファイルが含まれる"
  );
  
  // 除外パターンのテスト
  assertEqual(
    shouldIncludeFile("/path/to/node_modules/file.js", "file.js", baseOptions),
    false,
    "node_modulesは除外される"
  );
  
  // ファイルタイプフィルターのテスト
  const typeFilterOptions = normalizeDirectoryOptions({ fileTypes: ['.ts', '.js'] });
  assertEqual(
    shouldIncludeFile("/path/to/file.ts", "file.ts", typeFilterOptions),
    true,
    ".tsファイルは含まれる"
  );
  
  assertEqual(
    shouldIncludeFile("/path/to/file.py", "file.py", typeFilterOptions),
    false,
    ".pyファイルは除外される"
  );
  
  // デフォルトテキストファイルのテスト
  assertEqual(
    shouldIncludeFile("/path/to/file.txt", "file.txt", baseOptions),
    true,
    ".txtファイルはデフォルトで含まれる"
  );
  
  assertEqual(
    shouldIncludeFile("/path/to/file.jpg", "file.jpg", baseOptions),
    false,
    ".jpgファイルはデフォルトで除外される"
  );
}

async function testCreateMatcher() {
  // 通常の文字列検索
  const normalOptions = normalizeOptions({ caseSensitive: false });
  const normalMatcher = createMatcher("test", normalOptions);
  
  let result = normalMatcher("This is a test line");
  assertEqual(result.found, true, "通常検索でマッチが見つかる");
  assertEqual(result.position, 10, "正しい位置でマッチする");
  
  result = normalMatcher("This is a TEST line");
  assertEqual(result.found, true, "大文字小文字を区別せずマッチする");
  
  // 大文字小文字を区別する検索
  const caseSensitiveOptions = normalizeOptions({ caseSensitive: true });
  const caseSensitiveMatcher = createMatcher("Test", caseSensitiveOptions);
  
  result = caseSensitiveMatcher("This is a Test line");
  assertEqual(result.found, true, "大文字小文字を区別してマッチする");
  
  result = caseSensitiveMatcher("This is a test line");
  assertEqual(result.found, false, "大文字小文字が異なる場合マッチしない");
  
  // 正規表現検索
  const regexOptions = normalizeOptions({ regex: true, flags: "i" });
  const regexMatcher = createMatcher("\\d+", regexOptions);
  
  result = regexMatcher("There are 123 items");
  assertEqual(result.found, true, "正規表現でマッチが見つかる");
  assertEqual(result.position, 10, "正規表現の正しい位置でマッチする");
  
  result = regexMatcher("There are no numbers");
  assertEqual(result.found, false, "正規表現にマッチしない場合");
}

async function testExtractContext() {
  const lines = [
    "line 1",
    "line 2", 
    "line 3 - target",
    "line 4",
    "line 5"
  ];
  
  // コンテキストサイズ0
  let context = extractContext(lines, 2, 0);
  assertEqual(context.beforeContext.length, 0, "コンテキスト0の場合、前の行は空");
  assertEqual(context.afterContext.length, 0, "コンテキスト0の場合、後の行は空");
  
  // コンテキストサイズ1
  context = extractContext(lines, 2, 1);
  assertEqual(context.beforeContext.length, 1, "コンテキスト1の場合、前の行が1行");
  assertEqual(context.afterContext.length, 1, "コンテキスト1の場合、後の行が1行");
  assertEqual(context.beforeContext[0], "line 2", "前のコンテキストが正しい");
  assertEqual(context.afterContext[0], "line 4", "後のコンテキストが正しい");
  
  // 境界でのコンテキスト（最初の行）
  context = extractContext(lines, 0, 2);
  assertEqual(context.beforeContext.length, 0, "最初の行では前のコンテキストは空");
  assertEqual(context.afterContext.length, 2, "最初の行でも後のコンテキストは取得");
  
  // 境界でのコンテキスト（最後の行）
  context = extractContext(lines, 4, 2);
  assertEqual(context.beforeContext.length, 2, "最後の行でも前のコンテキストは取得");
  assertEqual(context.afterContext.length, 0, "最後の行では後のコンテキストは空");
}

async function testFormatGrepMatch() {
  const matchResult = { found: true, position: 5 };
  const context = {
    beforeContext: ["previous line"],
    afterContext: ["next line"]
  };
  
  // コンテキストありのフォーマット
  let formatted = formatGrepMatch(10, "This is a test line", matchResult, context);
  assertEqual(formatted.lineNumber, 10, "行番号が正しく設定される");
  assertEqual(formatted.content, "This is a test line", "内容が正しく設定される");
  assertEqual(formatted.matchPosition, 5, "マッチ位置が正しく設定される");
  assertEqual(formatted.beforeContext?.[0], "previous line", "前のコンテキストが設定される");
  assertEqual(formatted.afterContext?.[0], "next line", "後のコンテキストが設定される");
  
  // コンテキストなしのフォーマット
  formatted = formatGrepMatch(5, "Simple line", matchResult);
  assertEqual(formatted.lineNumber, 5, "行番号が正しく設定される");
  assertEqual(formatted.beforeContext, undefined, "コンテキストなしの場合beforeContextはundefined");
  assertEqual(formatted.afterContext, undefined, "コンテキストなしの場合afterContextはundefined");
}

async function testProcessLinesSync() {
  const lines = [
    "This is line 1",
    "This contains test word",
    "Another line here",
    "Test again in this line",
    "Final line"
  ];
  
  const options = normalizeOptions({ maxResults: 10 });
  
  // 通常の検索
  let result = processLinesSync(lines, "test", options);
  assertEqual(result.matches.length, 2, "2つのマッチが見つかる");
  assertEqual(result.matches[0].lineNumber, 2, "最初のマッチは2行目");
  assertEqual(result.matches[1].lineNumber, 4, "2番目のマッチは4行目");
  assertEqual(result.truncated, false, "結果は切り詰められていない");
  
  // 結果制限のテスト
  const limitedOptions = normalizeOptions({ maxResults: 1 });
  result = processLinesSync(lines, "test", limitedOptions);
  assertEqual(result.matches.length, 1, "制限により1つのマッチのみ");
  assertEqual(result.truncated, true, "結果が切り詰められている");
  
  // マッチなしのケース
  result = processLinesSync(lines, "nonexistent", options);
  assertEqual(result.matches.length, 0, "マッチが見つからない");
  assertEqual(result.truncated, false, "マッチなしでは切り詰めフラグはfalse");
}

async function testFileGrep() {
  // テスト環境のセットアップ
  const { testDir , createFile } = await createTestEnvironment("legacy");
  
  // テストファイルの作成
  const testContent = `Line 1: Introduction
Line 2: This is a test file
Line 3: Contains multiple test cases
Line 4: Normal content here
Line 5: Another test example
Line 6: Final line`;
  
  const testFilePath = await createFile("grep-test.txt", testContent);
  
  // 基本的な検索
  let result = await fileGrep(testFilePath, "test");
  assertEqual(result.matchCount, 3, "3つのマッチが見つかる");
  assertEqual(result.matches[0].lineNumber, 2, "最初のマッチは2行目");
  assertEqual(result.matches[1].lineNumber, 3, "2番目のマッチは3行目");
  assertEqual(result.matches[2].lineNumber, 5, "3番目のマッチは5行目");
  
  // コンテキスト付き検索
  result = await fileGrep(testFilePath, "test", { context: 1 });
  assertEqual(result.matches[0].beforeContext?.length, 1, "前のコンテキストが含まれる");
  assertEqual(result.matches[0].afterContext?.length, 1, "後のコンテキストが含まれる");
  
  // 大文字小文字を区別する検索
  result = await fileGrep(testFilePath, "Test", { caseSensitive: true });
  assertEqual(result.matchCount, 0, "大文字小文字を区別する場合マッチしない");
  
  // 正規表現検索
  result = await fileGrep(testFilePath, "Line \\d+:", { regex: true });
  assertEqual(result.matchCount, 6, "正規表現ですべての行がマッチ");
  
  // 存在しないファイルのテスト
  try {
    await fileGrep(path.join(testDir, "nonexistent.txt"), "test");
    throw new Error("エラーが発生しなかった");
  } catch (error) {
    assertEqual(
      (error as Error).message.includes("Grep error"),
      true,
      "存在しないファイルでエラーが発生"
    );
  }
}

async function testDirectoryGrep() {
  // テスト環境のセットアップ
  const { testDir , createFile } = await createTestEnvironment("legacy");
  
  // テストファイル構造の作成
  await createFile("file1.txt", "This is test content in file1\nAnother line here");
  await createFile("file2.js", "console.log('test');\nfunction test() {}");
  await createFile("file3.md", "# Test Document\nThis is a test markdown file");
  
  // サブディレクトリとファイル
  const subDir = path.join(testDir, "subdir");
  mkdirSync(subDir, { recursive: true });
  await fs.writeFile(
    path.join(subDir, "nested.txt"), 
    "Nested file with test content"
  );
  
  // 基本的なディレクトリ検索
  let result = await directoryGrep(testDir, "test");
  assertEqual(result.filesWithMatches >= 3, true, "複数ファイルでマッチが見つかる");
  assertEqual(result.totalMatches >= 4, true, "複数のマッチが見つかる");
  
  // ファイルタイプフィルター
  result = await directoryGrep(testDir, "test", { fileTypes: ['.txt'] });
  assertEqual(
    result.results.every(r => r.filePath.endsWith('.txt')),
    true,
    ".txtファイルのみが検索される"
  );
  
  // 再帰検索の無効化
  result = await directoryGrep(testDir, "test", { recursive: false });
  assertEqual(
    result.results.every(r => !r.filePath.includes('subdir')),
    true,
    "非再帰検索ではサブディレクトリが除外される"
  );
  
  // 存在しないディレクトリのテスト
  try {
    await directoryGrep(path.join(testDir, "nonexistent"), "test");
    throw new Error("エラーが発生しなかった");
  } catch (error) {
    assertEqual(
      (error as Error).message.includes("Directory grep error"),
      true,
      "存在しないディレクトリでエラーが発生"
    );
  }
}

async function testProjectGrep() {
  // テスト環境のセットアップ
  const { testDir , createFile } = await createTestEnvironment("legacy");
  
  // プロジェクト構造の作成
  await createFile("src/main.ts", "const test = 'Hello World';\nconsole.log(test);");
  await createFile("src/utils.ts", "export function testUtil() { return 'test'; }");
  await createFile("README.md", "# Test Project\nThis is a test project");
  
  // 除外されるべきディレクトリ
  const nodeModulesDir = path.join(testDir, "node_modules");
  mkdirSync(nodeModulesDir, { recursive: true });
  await fs.writeFile(
    path.join(nodeModulesDir, "package.json"),
    '{"name": "test-package"}'
  );
  
  // プロジェクト検索
  const result = await projectGrep(testDir, "test");
  
  assertEqual(result.filesWithMatches >= 3, true, "複数のプロジェクトファイルでマッチ");
  assertEqual(
    result.results.every(r => !r.filePath.includes('node_modules')),
    true,
    "node_modulesは除外される"
  );
  assertEqual(result.searchPattern, "test", "検索パターンが記録される");
}

async function testZodSchemas() {
  // FileGrepOptionsSchemaのテスト
  const validFileOptions = {
    regex: true,
    caseSensitive: false,
    flags: "gi",
    maxResults: 50,
    context: 2
  };
  
  const fileParseResult = FileGrepOptionsSchema.safeParse(validFileOptions);
  assertEqual(fileParseResult.success, true, "有効なファイル検索オプションがパースできる");
  
  // DirectoryGrepOptionsSchemaのテスト
  const validDirOptions = {
    ...validFileOptions,
    fileTypes: ['.ts', '.js'],
    recursive: true,
    exclude: ['dist'],
    includeHidden: false,
    maxFileSize: 1024 * 1024
  };
  
  const dirParseResult = DirectoryGrepOptionsSchema.safeParse(validDirOptions);
  assertEqual(dirParseResult.success, true, "有効なディレクトリ検索オプションがパースできる");
  
  // 無効なオプションのテスト
  const invalidOptions = {
    maxResults: -1, // 無効な値
    context: 20     // 範囲外
  };
  
  const invalidParseResult = FileGrepOptionsSchema.safeParse(invalidOptions);
  assertEqual(invalidParseResult.success, false, "無効なオプションはパースエラーになる");
}

// メインのテスト実行関数
export async function runSearchTests() {
  await runTestSuite("Legacy Test Suite", [
    { name: "オプション正規化テスト", fn: testNormalizeOptions },
    { name: "ディレクトリオプション正規化テスト", fn: testNormalizeDirectoryOptions },
    { name: "ストリーム処理判定テスト", fn: testShouldUseStreamProcessing },
    { name: "ファイル包含判定テスト", fn: testShouldIncludeFile },
    { name: "マッチャー作成テスト", fn: testCreateMatcher },
    { name: "コンテキスト抽出テスト", fn: testExtractContext },
    { name: "Grepマッチフォーマットテスト", fn: testFormatGrepMatch },
    { name: "行同期処理テスト", fn: testProcessLinesSync },
    { name: "ファイル検索テスト", fn: testFileGrep },
    { name: "ディレクトリ検索テスト", fn: testDirectoryGrep },
    { name: "プロジェクト検索テスト", fn: testProjectGrep },
    { name: "Zodスキーマテスト", fn: testZodSchemas },
  ]);
}

// 単体で実行する場合
if (isMainModule(import.meta.url)) {
  runSearchTests().catch(console.error);
}
