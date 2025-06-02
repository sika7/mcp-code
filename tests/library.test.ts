/**
 * ライブラリとしての機能テスト（改良版）
 * mcp-codeライブラリのCoreクラスと公開APIの動作を検証
 */

import {
  assertEqual,
  assertTrue,
  assertFalse,
  assertThrows,
  createTestEnvironment,
  runTestSuite,
  isMainModule,
  assertFileExists,
  assertContains,
} from './test-utils.js'
import {
  Core,
  convertToRelativePaths,
  isExcluded,
  resolveSafeProjectPath,
  createSystemLogger,
} from '../src/index.js'

// =============================================================================
// Coreクラスのインスタンス化テスト
// =============================================================================

async function testCoreBasicInstantiation() {
  const { testDir, cleanup } = await createTestEnvironment('core-basic')
  
  try {
    const core = new Core(testDir, [])
    assertTrue(
      core instanceof Core,
      'Coreクラスのインスタンスが正しく作成されること',
    )
  } finally {
    await cleanup()
  }
}

async function testCoreInstantiationWithExcludes() {
  const { testDir, cleanup } = await createTestEnvironment('core-excludes')
  
  try {
    const excludedPaths = ['**/*.log', '**/.env', 'node_modules/**']
    const core = new Core(testDir, excludedPaths)
    assertTrue(
      core instanceof Core,
      '除外パスを指定したCoreクラスのインスタンスが正しく作成されること',
    )
  } finally {
    await cleanup()
  }
}

async function testCoreInstantiationWithEmptyExcludes() {
  const { testDir, cleanup } = await createTestEnvironment('core-empty-excludes')
  
  try {
    const core = new Core(testDir, [])
    assertTrue(
      core instanceof Core,
      '空の除外パスでCoreクラスのインスタンスが正しく作成されること',
    )
  } finally {
    await cleanup()
  }
}

// =============================================================================
// ディレクトリツリー機能のテスト
// =============================================================================

async function testDirectoryTreeBasic() {
  const { testDir, createFile, createDirectory, cleanup } =
    await createTestEnvironment('directory-tree-basic')
  
  try {
    await createDirectory('src')
    await createFile('package.json', '{"name": "test-project"}')
    
    const core = new Core(testDir, [])
    const tree = await core.directoryTree('/', [])
    
    assertTrue(typeof tree === 'string', 'ディレクトリツリーが文字列として返されること')
    assertContains(tree, 'src', 'srcディレクトリが含まれること')
    assertContains(tree, 'package.json', 'package.jsonが含まれること')
  } finally {
    await cleanup()
  }
}

async function testDirectoryTreeWithExcludes() {
  const { testDir, createFile, createDirectory, cleanup } =
    await createTestEnvironment('directory-tree-excludes')
  
  try {
    await createDirectory('src')
    await createDirectory('node_modules')
    await createFile('package.json', '{"name": "test-project"}')
    await createFile('app.log', 'log content')
    
    const core = new Core(testDir, ['**/*.log', 'node_modules/**'])
    const tree = await core.directoryTree('/', [])
    
    assertContains(tree, 'src', 'srcディレクトリが含まれること')
    assertContains(tree, 'package.json', 'package.jsonが含まれること')
    assertTrue(!tree.includes('app.log'), 'ログファイルが除外されること')
    assertTrue(!tree.includes('node_modules'), 'node_modulesが除外されること')
  } finally {
    await cleanup()
  }
}

async function testDirectoryTreeEmpty() {
  const { testDir, cleanup } = await createTestEnvironment('directory-tree-empty')
  
  try {
    const core = new Core(testDir, [])
    const tree = await core.directoryTree('/', [])
    
    assertTrue(typeof tree === 'string', '空ディレクトリでも文字列が返されること')
  } finally {
    await cleanup()
  }
}

// =============================================================================
// ファイル読み書き機能のテスト
// =============================================================================

async function testFileWriteBasic() {
  const { testDir, cleanup } = await createTestEnvironment('file-write-basic')
  
  try {
    const core = new Core(testDir, [])
    const testContent = 'Hello, mcp-code library!'
    const fileName = 'test.txt'
    
    const writeResult = await core.writeFile(fileName, testContent)
    assertTrue(typeof writeResult === 'string', '書き込み結果が文字列で返されること')
    assertContains(writeResult, fileName, '書き込み結果にファイル名が含まれること')
  } finally {
    await cleanup()
  }
}

async function testFileReadBasic() {
  const { testDir, createFile, cleanup } = await createTestEnvironment('file-read-basic')
  
  try {
    const core = new Core(testDir, [])
    const testContent = 'Hello, mcp-code library!'
    const fileName = 'test.txt'
    
    await createFile(fileName, testContent)
    
    const readResult = await core.readFile(fileName)
    assertTrue(typeof readResult === 'object', '読み込み結果がオブジェクトで返されること')
    assertEqual(readResult.content, testContent, 'ファイル内容が正しく読み込まれること')
    assertTrue(typeof readResult.metadata === 'object', 'メタデータがオブジェクトで返されること')
  } finally {
    await cleanup()
  }
}

async function testFileReadWithOptions() {
  const { testDir, createFile, cleanup } = await createTestEnvironment('file-read-options')
  
  try {
    const core = new Core(testDir, [])
    const testContent = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5'
    const fileName = 'multiline.txt'
    
    await createFile(fileName, testContent)
    
    const readResult = await core.readFile(fileName, { startLine: 2, endLine: 4 })
    assertContains(readResult.content, 'Line 2', '指定開始行の内容が含まれること')
    assertContains(readResult.content, 'Line 4', '指定終了行の内容が含まれること')
    assertTrue(!readResult.content.includes('Line 1'), '範囲外の行が含まれないこと')
    assertTrue(!readResult.content.includes('Line 5'), '範囲外の行が含まれないこと')
  } finally {
    await cleanup()
  }
}

async function testFileReadNonExistent() {
  const { testDir, cleanup } = await createTestEnvironment('file-read-nonexistent')
  
  try {
    const core = new Core(testDir, [])
    
    await assertThrows(
      () => core.readFile('nonexistent.txt'),
      undefined,
      '存在しないファイルの読み取りでエラーが発生すること',
    )
  } finally {
    await cleanup()
  }
}

// =============================================================================
// 検索機能のテスト
// =============================================================================

async function testFileSearchBasic() {
  const { testDir, createFile, cleanup } = await createTestEnvironment('file-search-basic')
  
  try {
    await createFile('test1.js', 'const message = "Hello World";\nconsole.log(message);')
    
    const core = new Core(testDir, [])
    const fileSearchResult = await core.findInFile('test1.js', 'Hello')
    
    assertContains(fileSearchResult, 'Hello', 'ファイル内検索で対象文字列が見つかること')
  } finally {
    await cleanup()
  }
}

async function testProjectSearchBasic() {
  const { testDir, createFile, cleanup } = await createTestEnvironment('project-search-basic')
  
  try {
    await createFile('test1.js', 'const message = "Hello World";')
    await createFile('readme.md', '# Project\nThis is a test project with Hello World example.')
    
    const core = new Core(testDir, [])
    const projectSearchResult = await core.projectGrep('Hello')
    
    assertContains(projectSearchResult, 'test1.js', 'プロジェクト検索でファイル名が含まれること')
    assertContains(projectSearchResult, 'readme.md', 'プロジェクト検索で複数ファイルが見つかること')
  } finally {
    await cleanup()
  }
}

async function testSearchWithOptions() {
  const { testDir, createFile, cleanup } = await createTestEnvironment('search-options')
  
  try {
    await createFile('test.js', 'const hello = "HELLO";\nconst world = "world";')
    
    const core = new Core(testDir, [])
    
    // 大文字小文字を区別しない検索（デフォルト）
    const caseInsensitiveResult = await core.findInFile('test.js', 'hello')
    assertContains(caseInsensitiveResult, 'HELLO', '大文字小文字を区別しない検索が動作すること')
    
    // 大文字小文字を区別する検索
    const caseSensitiveResult = await core.findInFile('test.js', 'hello', { caseSensitive: true })
    assertTrue(!caseSensitiveResult.includes('HELLO'), '大文字小文字を区別する検索が動作すること')
  } finally {
    await cleanup()
  }
}

// =============================================================================
// 除外ファイル機能のテスト
// =============================================================================

async function testExcludedFileRead() {
  const { testDir, createFile, cleanup } = await createTestEnvironment('excluded-file-read')
  
  try {
    await createFile('secret.env', 'SECRET_KEY=abc123')
    await createFile('app.log', 'INFO: Application started')
    
    const excludedPaths = ['**/*.env', '**/*.log']
    const core = new Core(testDir, excludedPaths)
    
    await assertThrows(
      () => core.readFile('secret.env'),
      '指定されたパスはツールにより制限されています',
      '除外ファイルの読み取りが制限されること',
    )
    
    await assertThrows(
      () => core.readFile('app.log'),
      '指定されたパスはツールにより制限されています',
      'ログファイルの読み取りが制限されること',
    )
  } finally {
    await cleanup()
  }
}

async function testExcludedFileWrite() {
  const { testDir, cleanup } = await createTestEnvironment('excluded-file-write')
  
  try {
    const excludedPaths = ['**/*.env']
    const core = new Core(testDir, excludedPaths)
    
    await assertThrows(
      () => core.writeFile('secret.env', 'SECRET_KEY=test'),
      '指定されたパスはツールにより制限されています',
      '除外ファイルの書き込みが制限されること',
    )
  } finally {
    await cleanup()
  }
}

async function testNonExcludedFileAccess() {
  const { testDir, createFile, cleanup } = await createTestEnvironment('non-excluded-file')
  
  try {
    await createFile('config.js', 'module.exports = { port: 3000 };')
    
    const excludedPaths = ['**/*.env', '**/*.log']
    const core = new Core(testDir, excludedPaths)
    
    const configContent = await core.readFile('config.js')
    assertContains(configContent.content, 'port: 3000', '通常ファイルは読み取り可能であること')
  } finally {
    await cleanup()
  }
}

// =============================================================================
// ファイル編集機能のテスト
// =============================================================================

async function testLineInsertion() {
  const { testDir, createFile, cleanup } = await createTestEnvironment('line-insertion')
  
  try {
    const originalContent = 'line 1\nline 2\nline 3\nline 4'
    await createFile('edit-test.txt', originalContent)
    
    const core = new Core(testDir, [])
    const insertResult = await core.mulchInsertLinesInFile('edit-test.txt', [
      { lineNumber: 2, content: 'inserted line' },
    ])
    
    assertContains(insertResult, 'edit-test.txt', '行挿入結果にファイル名が含まれること')
  } finally {
    await cleanup()
  }
}

async function testLineEditing() {
  const { testDir, createFile, cleanup } = await createTestEnvironment('line-editing')
  
  try {
    const originalContent = 'line 1\nline 2\nline 3\nline 4'
    await createFile('edit-test.txt', originalContent)
    
    const core = new Core(testDir, [])
    const editResult = await core.mulchEditLinesInFile(
      'edit-test.txt',
      [{ startLine: 1, endLine: 1, content: 'modified line 1' }],
      false,
    )
    
    assertContains(editResult.message, 'edit-test.txt', '行編集結果にファイル名が含まれること')
  } finally {
    await cleanup()
  }
}

async function testLineDeletion() {
  const { testDir, createFile, cleanup } = await createTestEnvironment('line-deletion')
  
  try {
    const originalContent = 'line 1\nline 2\nline 3\nline 4'
    await createFile('edit-test.txt', originalContent)
    
    const core = new Core(testDir, [])
    const deleteResult = await core.mulchDeleteLinesInFile('edit-test.txt', [
      { startLine: 3, endLine: 3 },
    ])
    
    assertContains(deleteResult, 'edit-test.txt', '行削除結果にファイル名が含まれること')
  } finally {
    await cleanup()
  }
}

// =============================================================================
// ディレクトリ操作機能のテスト
// =============================================================================

async function testDirectoryCreation() {
  const { testDir, cleanup } = await createTestEnvironment('directory-creation')
  
  try {
    const core = new Core(testDir, [])
    const createResult = await core.createDirectory('new-folder')
    
    assertContains(createResult, 'new-folder', 'ディレクトリ作成結果にフォルダ名が含まれること')
  } finally {
    await cleanup()
  }
}

async function testDirectoryRemoval() {
  const { testDir, createDirectory, cleanup } = await createTestEnvironment('directory-removal')
  
  try {
    await createDirectory('temp-folder')
    
    const core = new Core(testDir, [])
    const removeResult = await core.removeDirectory('temp-folder')
    
    assertContains(removeResult, 'temp-folder', 'ディレクトリ削除結果にフォルダ名が含まれること')
  } finally {
    await cleanup()
  }
}

// =============================================================================
// ユーティリティ関数のテスト
// =============================================================================

async function testConvertToRelativePaths() {
  const { testDir, cleanup } = await createTestEnvironment('convert-relative-paths')
  
  try {
    const absolutePath = `${testDir}/src/components/Button.tsx`
    const relativePath = convertToRelativePaths(absolutePath, testDir)
    
    assertEqual(relativePath, 'src/components/Button.tsx', '絶対パスが相対パスに正しく変換されること')
  } finally {
    await cleanup()
  }
}

async function testIsExcludedFunction() {
  const { cleanup } = await createTestEnvironment('is-excluded')
  
  try {
    const excludePatterns = ['**/*.log', '**/.env', 'node_modules/**']
    
    assertTrue(isExcluded('app.log', excludePatterns), '.logファイルが除外されること')
    assertTrue(isExcluded('.env', excludePatterns), '.envファイルが除外されること')
    assertTrue(isExcluded('node_modules/package/index.js', excludePatterns), 'node_modulesが除外されること')
    assertFalse(isExcluded('src/index.ts', excludePatterns), '通常ファイルは除外されないこと')
  } finally {
    await cleanup()
  }
}

async function testResolveSafeProjectPath() {
  const { testDir, cleanup } = await createTestEnvironment('resolve-safe-path')
  
  try {
    const safePath = resolveSafeProjectPath('./src/index.ts', testDir)
    
    assertContains(safePath, testDir, 'セーフパスにプロジェクトルートが含まれること')
    assertContains(safePath, 'src/index.ts', 'セーフパスに相対パスが含まれること')
  } finally {
    await cleanup()
  }
}

// =============================================================================
// ログシステムのテスト
// =============================================================================

async function testLogSystemCreation() {
  const { cleanup } = await createTestEnvironment('log-system-creation')
  
  try {
    const logger = createSystemLogger()
    assertTrue(typeof logger === 'function', 'ログシステムが関数として作成されること')
  } finally {
    await cleanup()
  }
}

async function testLogSystemExecution() {
  const { cleanup } = await createTestEnvironment('log-system-execution')
  
  try {
    const logger = createSystemLogger()
    
    // ログ関数が例外なく実行されること
    logger({ logLevel: 'INFO', message: 'テストログメッセージ' })
    logger({ logLevel: 'ERROR', message: 'エラーテストメッセージ', data: { test: true } })
    
    assertTrue(true, 'ログ関数が正常に実行されること')
  } finally {
    await cleanup()
  }
}

// =============================================================================
// スクリプト実行機能のテスト
// =============================================================================

async function testScriptExecutionBasic() {
  const { testDir, createFile, cleanup } = await createTestEnvironment('script-execution-basic')
  
  try {
    await createFile(
      'package.json',
      JSON.stringify({
        name: 'test-project',
        scripts: { echo: 'echo "Hello from script"' },
      }, null, 2),
    )
    
    const core = new Core(testDir, [])
    const result = await core.runScript('test-echo', 'echo "test message"')
    
    assertContains(result, 'test message', 'スクリプト実行結果にメッセージが含まれること')
  } finally {
    await cleanup()
  }
}

// =============================================================================
// エラーハンドリングのテスト
// =============================================================================

async function testErrorHandlingNonExistentFile() {
  const { testDir, cleanup } = await createTestEnvironment('error-nonexistent')
  
  try {
    const core = new Core(testDir, [])
    
    await assertThrows(
      () => core.readFile('nonexistent.txt'),
      undefined,
      '存在しないファイルの読み取りでエラーが発生すること',
    )
  } finally {
    await cleanup()
  }
}

async function testErrorHandlingRestrictedFile() {
  const { testDir, cleanup } = await createTestEnvironment('error-restricted')
  
  try {
    const core = new Core(testDir, ['**/*.restricted'])
    
    await assertThrows(
      () => core.readFile('secret.restricted'),
      '指定されたパスはツールにより制限されています',
      '制限されたファイルアクセスで適切なエラーが発生すること',
    )
  } finally {
    await cleanup()
  }
}

// =============================================================================
// パッケージとしてのエクスポート検証
// =============================================================================

async function testPackageExports() {
  const { cleanup } = await createTestEnvironment('package-exports')
  
  try {
    // 主要なエクスポートが正しく定義されていること
    assertTrue(typeof Core === 'function', 'Coreクラスがエクスポートされていること')
    assertTrue(typeof convertToRelativePaths === 'function', 'convertToRelativePathsがエクスポートされていること')
    assertTrue(typeof isExcluded === 'function', 'isExcludedがエクスポートされていること')
    assertTrue(typeof resolveSafeProjectPath === 'function', 'resolveSafeProjectPathがエクスポートされていること')
    assertTrue(typeof createSystemLogger === 'function', 'createSystemLoggerがエクスポートされていること')
  } finally {
    await cleanup()
  }
}

// =============================================================================
// テスト実行
// =============================================================================

export async function runLibraryTests() {
  await runTestSuite('ライブラリ機能テスト', [
    // Coreクラスのインスタンス化
    { name: 'Coreクラス基本インスタンス化', fn: testCoreBasicInstantiation },
    { name: 'Coreクラス除外パス付きインスタンス化', fn: testCoreInstantiationWithExcludes },
    { name: 'Coreクラス空除外パスインスタンス化', fn: testCoreInstantiationWithEmptyExcludes },
    
    // ディレクトリツリー機能
    { name: 'ディレクトリツリー基本機能', fn: testDirectoryTreeBasic },
    { name: 'ディレクトリツリー除外機能', fn: testDirectoryTreeWithExcludes },
    { name: 'ディレクトリツリー空ディレクトリ', fn: testDirectoryTreeEmpty },
    
    // ファイル読み書き機能
    { name: 'ファイル書き込み基本機能', fn: testFileWriteBasic },
    { name: 'ファイル読み込み基本機能', fn: testFileReadBasic },
    { name: 'ファイル読み込みオプション付き', fn: testFileReadWithOptions },
    { name: 'ファイル読み込み存在しないファイル', fn: testFileReadNonExistent },
    
    // 検索機能
    { name: 'ファイル内検索基本機能', fn: testFileSearchBasic },
    { name: 'プロジェクト検索基本機能', fn: testProjectSearchBasic },
    { name: '検索オプション機能', fn: testSearchWithOptions },
    
    // 除外ファイル機能
    { name: '除外ファイル読み取り制限', fn: testExcludedFileRead },
    { name: '除外ファイル書き込み制限', fn: testExcludedFileWrite },
    { name: '非除外ファイルアクセス', fn: testNonExcludedFileAccess },
    
    // ファイル編集機能
    { name: '行挿入機能', fn: testLineInsertion },
    { name: '行編集機能', fn: testLineEditing },
    { name: '行削除機能', fn: testLineDeletion },
    
    // ディレクトリ操作機能
    { name: 'ディレクトリ作成機能', fn: testDirectoryCreation },
    { name: 'ディレクトリ削除機能', fn: testDirectoryRemoval },
    
    // ユーティリティ関数
    { name: '相対パス変換機能', fn: testConvertToRelativePaths },
    { name: '除外判定機能', fn: testIsExcludedFunction },
    { name: 'セーフパス解決機能', fn: testResolveSafeProjectPath },
    
    // ログシステム
    { name: 'ログシステム作成', fn: testLogSystemCreation },
    { name: 'ログシステム実行', fn: testLogSystemExecution },
    
    // スクリプト実行
    { name: 'スクリプト実行基本機能', fn: testScriptExecutionBasic },
    
    // エラーハンドリング
    { name: 'エラーハンドリング存在しないファイル', fn: testErrorHandlingNonExistentFile },
    { name: 'エラーハンドリング制限ファイル', fn: testErrorHandlingRestrictedFile },
    
    // パッケージ検証
    { name: 'パッケージエクスポート検証', fn: testPackageExports },
  ])
}

if (isMainModule(import.meta.url)) {
  await runLibraryTests()
}
