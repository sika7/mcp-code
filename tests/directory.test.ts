/**
 * ディレクトリ操作モジュールのテスト
 */

import fs from 'fs/promises'
import path from 'path'

import {
  assertEqual,
  assertTrue,
  assertFileExists,
  assertFileNotExists,
  createTestEnvironment,
  runTestSuite,
  isMainModule,
} from './test-utils'
import { createDirectory, removeDirectory } from '../src/directory'

async function testCreateDirectory() {
  // テスト環境のセットアップ
  const { testDir, getTestPath } =
    await createTestEnvironment('directory-create')

  const testPath = getTestPath('test-create')

  // ディレクトリを作成
  const result = await createDirectory(testPath)
  console.log('✓', result)

  // ディレクトリが実際に作成されているか確認
  assertFileExists(testPath, 'ディレクトリが正しく作成されること')
  const stats = await fs.stat(testPath)
  assertTrue(stats.isDirectory(), '作成されたパスがディレクトリであること')
}

async function testCreateNestedDirectory() {
  // テスト環境のセットアップ
  const { testDir, getTestPath } =
    await createTestEnvironment('directory-nested')

  const nestedPath = getTestPath(path.join('nested', 'deep', 'directory'))

  // ネストしたディレクトリを作成
  const result = await createDirectory(nestedPath)
  console.log('✓', result)

  // ディレクトリが実際に作成されているか確認
  assertFileExists(nestedPath, 'ネストしたディレクトリが正しく作成されること')
  const stats = await fs.stat(nestedPath)
  assertTrue(
    stats.isDirectory(),
    '作成されたネストしたパスがディレクトリであること',
  )
}

async function testCreateExistingDirectory() {
  // テスト環境のセットアップ
  const { testDir, getTestPath } =
    await createTestEnvironment('directory-existing')

  const existingPath = getTestPath('existing')

  // 最初にディレクトリを作成
  await createDirectory(existingPath)

  // 同じディレクトリを再度作成（エラーにならないはず）
  const result = await createDirectory(existingPath)
  console.log('✓', result)

  // ディレクトリが存在することを確認
  assertFileExists(existingPath, '既存ディレクトリの再作成が正常に完了すること')
}

async function testRemoveDirectory() {
  // テスト環境のセットアップ
  const { testDir, getTestPath } =
    await createTestEnvironment('directory-remove')

  const deletePath = getTestPath('test-delete')

  // 削除用のディレクトリを作成
  await createDirectory(deletePath)
  assertFileExists(deletePath, '削除前にディレクトリが存在すること')

  // ディレクトリを削除
  const result = await removeDirectory(deletePath)
  console.log('✓', result)

  // ディレクトリが削除されているか確認
  assertFileNotExists(deletePath, 'ディレクトリが正しく削除されること')
}

async function testRemoveDirectoryWithContent() {
  // テスト環境のセットアップ
  const { testDir, getTestPath } = await createTestEnvironment(
    'directory-remove-content',
  )

  const contentPath = getTestPath('with-content')
  const subDirPath = path.join(contentPath, 'subdir')
  const file1Path = path.join(contentPath, 'file1.txt')
  const file2Path = path.join(subDirPath, 'file2.txt')

  // ディレクトリ構造を作成
  await createDirectory(subDirPath)
  await fs.writeFile(file1Path, '内容1')
  await fs.writeFile(file2Path, '内容2')

  // 作成されたことを確認
  assertFileExists(contentPath, '親ディレクトリが存在すること')
  assertFileExists(file1Path, 'ファイル1が存在すること')
  assertFileExists(file2Path, 'ファイル2が存在すること')

  // 内容があるディレクトリを削除
  const result = await removeDirectory(contentPath)
  console.log('✓', result)

  // ディレクトリが削除されているか確認
  assertFileNotExists(
    contentPath,
    '内容があるディレクトリが正しく削除されること',
  )
}

async function testRemoveNonExistentDirectory() {
  // テスト環境のセットアップ
  const { testDir, getTestPath } = await createTestEnvironment(
    'directory-remove-nonexistent',
  )

  const nonExistentPath = getTestPath('non-existent')

  // 存在しないディレクトリを削除（エラーにならないはず）
  const result = await removeDirectory(nonExistentPath)
  console.log('✓', result)

  // 削除後も存在しないことを確認
  assertFileNotExists(
    nonExistentPath,
    '存在しないディレクトリの削除が正常に完了すること',
  )
}

// メインのテスト実行関数
export async function runDirectoryTests() {
  await runTestSuite('ディレクトリ操作テスト', [
    { name: 'ディレクトリ作成テスト', fn: testCreateDirectory },
    { name: 'ネストしたディレクトリ作成テスト', fn: testCreateNestedDirectory },
    { name: '既存ディレクトリの再作成テスト', fn: testCreateExistingDirectory },
    { name: 'ディレクトリ削除テスト', fn: testRemoveDirectory },
    { name: '内容があるディレクトリの削除テスト', fn: testRemoveDirectoryWithContent },
    { name: '存在しないディレクトリの削除テスト', fn: testRemoveNonExistentDirectory },
  ])
}

// メイン実行部
if (isMainModule(import.meta.url)) {
  runDirectoryTests().catch(console.error)
}
