/**
 * ライブラリとしての機能テスト
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

/**
 * Coreクラスの基本インスタンス化テスト
 */
async function testCoreInstantiation() {
  const { testDir, cleanup } = await createTestEnvironment('core-instantiation')

  try {
    // 基本的なインスタンス化
    const core = new Core(testDir, [])
    assertTrue(
      core instanceof Core,
      'Coreクラスのインスタンスが正しく作成されること',
    )

    // 除外パスを指定したインスタンス化
    const excludedPaths = ['**/*.log', '**/.env']
    const coreWithExcludes = new Core(testDir, excludedPaths)
    assertTrue(
      coreWithExcludes instanceof Core,
      '除外パスを指定したCoreクラスのインスタンスが正しく作成されること',
    )
  } finally {
    await cleanup()
  }
}

/**
 * ディレクトリツリー機能のテスト
 */
async function testDirectoryTreeFunction() {
  const { testDir, createFile, createDirectory, cleanup } =
    await createTestEnvironment('directory-tree')

  try {
    // テスト用のディレクトリ構造を作成
    await createDirectory('src')
    await createFile('package.json', '{"name": "test-project"}')

    const core = new Core(testDir, [])

    // ディレクトリツリーを取得
    const tree = await core.directoryTree('/', [])

    // 基本的な検証：文字列が返されることとsrcディレクトリが含まれること
    assertTrue(
      typeof tree === 'string',
      'ディレクトリツリーが文字列として返されること',
    )
    assertContains(tree, 'src', 'srcディレクトリが含まれること')
    assertContains(tree, 'package.json', 'package.jsonが含まれること')
  } finally {
    await cleanup()
  }
}

/**
 * ファイル読み書き機能のテスト
 */
async function testFileReadWriteFunction() {
  const { testDir, createFile, cleanup } =
    await createTestEnvironment('file-read-write')

  try {
    const core = new Core(testDir, [])
    const testContent = 'Hello, mcp-code library!'
    const fileName = 'test.txt'

    // ファイル書き込み
    const writeResult = await core.writeFile(fileName, testContent)
    assertTrue(
      typeof writeResult === 'string',
      '書き込み結果が文字列で返されること',
    )
    assertContains(
      writeResult,
      fileName,
      '書き込み結果にファイル名が含まれること',
    )

    // ファイル読み込み
    const readResult = await core.readFile(fileName)
    assertTrue(
      typeof readResult === 'object',
      '読み込み結果がオブジェクトで返されること',
    )
    assertEqual(
      readResult.content,
      testContent,
      'ファイル内容が正しく読み込まれること',
    )
    assertTrue(
      typeof readResult.metadata === 'object',
      'メタデータがオブジェクトで返されること',
    )
  } finally {
    await cleanup()
  }
}

/**
 * 検索機能のテスト
 */
async function testSearchFunction() {
  const { testDir, createFile, cleanup } = await createTestEnvironment('search')

  try {
    // 検索対象のファイルを作成
    await createFile(
      'test1.js',
      'const message = "Hello World";\nconsole.log(message);',
    )
    await createFile(
      'test2.ts',
      'interface User {\n  name: string;\n  age: number;\n}',
    )
    await createFile(
      'readme.md',
      '# Project\nThis is a test project with Hello World example.',
    )

    const core = new Core(testDir, [])

    // ファイル内検索
    const fileSearchResult = await core.findInFile('test1.js', 'Hello')
    assertContains(
      fileSearchResult,
      'Hello',
      'ファイル内検索で対象文字列が見つかること',
    )

    // プロジェクト全体検索
    const projectSearchResult = await core.projectGrep('Hello')
    assertContains(
      projectSearchResult,
      'test1.js',
      'プロジェクト検索でファイル名が含まれること',
    )
    assertContains(
      projectSearchResult,
      'readme.md',
      'プロジェクト検索で複数ファイルが見つかること',
    )
  } finally {
    await cleanup()
  }
}

/**
 * 除外ファイル機能のテスト
 */
async function testExcludedFilesFunction() {
  const { testDir, createFile, cleanup } =
    await createTestEnvironment('excluded-files')

  try {
    // 除外対象と通常ファイルを作成
    await createFile('secret.env', 'SECRET_KEY=abc123')
    await createFile('app.log', 'INFO: Application started')
    await createFile('config.js', 'module.exports = { port: 3000 };')

    const excludedPaths = ['**/*.env', '**/*.log']
    const core = new Core(testDir, excludedPaths)

    // 除外ファイルへのアクセスは拒否されること
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

    // 通常ファイルはアクセス可能
    const configContent = await core.readFile('config.js')
    assertContains(
      configContent.content,
      'port: 3000',
      '通常ファイルは読み取り可能であること',
    )
  } finally {
    await cleanup()
  }
}

/**
 * ファイル編集機能のテスト
 */
async function testFileEditFunction() {
  const { testDir, createFile, cleanup } =
    await createTestEnvironment('file-edit')

  try {
    const originalContent = 'line 1\nline 2\nline 3\nline 4'
    await createFile('edit-test.txt', originalContent)

    const core = new Core(testDir, [])

    // 行挿入テスト
    const insertResult = await core.mulchInsertLinesInFile('edit-test.txt', [
      { lineNumber: 2, content: 'inserted line' },
    ])
    assertContains(
      insertResult,
      'edit-test.txt',
      '行挿入結果にファイル名が含まれること',
    )

    // 行編集テスト
    const editResult = await core.mulchEditLinesInFile(
      'edit-test.txt',
      [{ startLine: 1, endLine: 1, content: 'modified line 1' }],
      false,
    )
    assertContains(
      editResult.message,
      'edit-test.txt',
      '行編集結果にファイル名が含まれること',
    )

    // 行削除テスト
    const deleteResult = await core.mulchDeleteLinesInFile('edit-test.txt', [
      { startLine: 3, endLine: 3 },
    ])
    assertContains(
      deleteResult,
      'edit-test.txt',
      '行削除結果にファイル名が含まれること',
    )
  } finally {
    await cleanup()
  }
}

/**
 * ディレクトリ操作機能のテスト
 */
async function testDirectoryOperationsFunction() {
  const { testDir, cleanup } = await createTestEnvironment(
    'directory-operations',
  )

  try {
    const core = new Core(testDir, [])

    // ディレクトリ作成
    const createResult = await core.createDirectory('new-folder')
    assertContains(
      createResult,
      'new-folder',
      'ディレクトリ作成結果にフォルダ名が含まれること',
    )

    // ディレクトリ削除
    const removeResult = await core.removeDirectory('new-folder')
    assertContains(
      removeResult,
      'new-folder',
      'ディレクトリ削除結果にフォルダ名が含まれること',
    )
  } finally {
    await cleanup()
  }
}

/**
 * ユーティリティ関数のテスト
 */
async function testUtilityFunctions() {
  const { testDir, cleanup } = await createTestEnvironment('utility-functions')

  try {
    // convertToRelativePaths のテスト
    const absolutePath = `${testDir}/src/components/Button.tsx`
    const relativePath = convertToRelativePaths(absolutePath, testDir)
    assertEqual(
      relativePath,
      'src/components/Button.tsx',
      '絶対パスが相対パスに正しく変換されること',
    )

    // isExcluded のテスト
    const excludePatterns = ['**/*.log', '**/.env', 'node_modules/**']
    assertTrue(
      isExcluded('app.log', excludePatterns),
      '.logファイルが除外されること',
    )
    assertTrue(
      isExcluded('.env', excludePatterns),
      '.envファイルが除外されること',
    )
    assertTrue(
      isExcluded('node_modules/package/index.js', excludePatterns),
      'node_modulesが除外されること',
    )
    assertFalse(
      isExcluded('src/index.ts', excludePatterns),
      '通常ファイルは除外されないこと',
    )

    // resolveSafeProjectPath のテスト
    const safePath = resolveSafeProjectPath('./src/index.ts', testDir)
    assertContains(
      safePath,
      testDir,
      'セーフパスにプロジェクトルートが含まれること',
    )
    assertContains(
      safePath,
      'src/index.ts',
      'セーフパスに相対パスが含まれること',
    )
  } finally {
    await cleanup()
  }
}

/**
 * ログシステムのテスト
 */
async function testLogSystemFunction() {
  const { cleanup } = await createTestEnvironment('log-system')

  try {
    // ログシステムが正しく作成されること
    const logger = createSystemLogger()
    assertTrue(
      typeof logger === 'function',
      'ログシステムが関数として作成されること',
    )

    // ログ関数が例外なく実行されること
    logger({ logLevel: 'INFO', message: 'テストログメッセージ' })
    logger({
      logLevel: 'ERROR',
      message: 'エラーテストメッセージ',
      data: { test: true },
    })

    // ログ関数呼び出しで例外が発生しないことを確認
    assertTrue(true, 'ログ関数が正常に実行されること')
  } finally {
    await cleanup()
  }
}

/**
 * スクリプト実行機能のテスト
 */
async function testScriptExecutionFunction() {
  const { testDir, createFile, cleanup } =
    await createTestEnvironment('script-execution')

  try {
    // package.jsonを作成
    await createFile(
      'package.json',
      JSON.stringify(
        {
          name: 'test-project',
          scripts: {
            echo: 'echo "Hello from script"',
          },
        },
        null,
        2,
      ),
    )

    const core = new Core(testDir, [])

    // シンプルなechoコマンドのテスト
    const result = await core.runScript('test-echo', 'echo "test message"')
    assertContains(
      result,
      'test message',
      'スクリプト実行結果にメッセージが含まれること',
    )
  } finally {
    await cleanup()
  }
}

/**
 * エラーハンドリングのテスト
 */
async function testErrorHandling() {
  const { testDir, cleanup } = await createTestEnvironment('error-handling')

  try {
    const core = new Core(testDir, ['**/*.restricted'])

    // 存在しないファイルの読み取り
    await assertThrows(
      () => core.readFile('nonexistent.txt'),
      undefined, // エラーメッセージは実装による
      '存在しないファイルの読み取りでエラーが発生すること',
    )

    // 制限されたファイルへのアクセス
    await assertThrows(
      () => core.readFile('secret.restricted'),
      '指定されたパスはツールにより制限されています',
      '制限されたファイルアクセスで適切なエラーが発生すること',
    )
  } finally {
    await cleanup()
  }
}

/**
 * ライブラリテストを実行
 */
export async function runLibraryTests() {
  await runTestSuite('ライブラリ機能テスト', [
    { name: 'Coreクラスのインスタンス化', fn: testCoreInstantiation },
    { name: 'ディレクトリツリー機能', fn: testDirectoryTreeFunction },
    { name: 'ファイル読み書き機能', fn: testFileReadWriteFunction },
    { name: '検索機能', fn: testSearchFunction },
    { name: '除外ファイル機能', fn: testExcludedFilesFunction },
    { name: 'ファイル編集機能', fn: testFileEditFunction },
    { name: 'ディレクトリ操作機能', fn: testDirectoryOperationsFunction },
    { name: 'ユーティリティ関数', fn: testUtilityFunctions },
    { name: 'ログシステム機能', fn: testLogSystemFunction },
    { name: 'スクリプト実行機能', fn: testScriptExecutionFunction },
    { name: 'エラーハンドリング', fn: testErrorHandling },
  ])
}

// 直接実行された場合はライブラリテストを実行
if (isMainModule(import.meta.url)) {
  await runLibraryTests()
}
