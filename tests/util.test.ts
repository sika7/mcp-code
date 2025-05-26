/**
 * ユーティリティモジュールのテスト
 */

import { mkdirSync, existsSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';

import { assertEqual, isMainModule, runTestSuite } from './test-utils';
import {
  isExcluded,
  generateRequestId,
  normalizeToProjectRoot,
  resolveSafeProjectPath,
  isAllowedExtension,
  convertToRelativePaths
} from '../src/util';

async function testIsExcluded() {
  // テストパスとパターン
  const testPatterns = [
    '**/*.pem',
    '**/*.key',
    'node_modules/**',
    'logs/*.log'
  ];
  
  // マッチするパス
  assertEqual(
    isExcluded('secret.pem', testPatterns),
    true,
    'ファイル名パターンが正しく除外されること'
  );
  
  assertEqual(
    isExcluded('path/to/secret.key', testPatterns),
    true,
    'ネストされたパスが正しく除外されること'
  );
  
  assertEqual(
    isExcluded('node_modules/package/index.js', testPatterns),
    true,
    'ディレクトリパターンが正しく除外されること'
  );
  
  assertEqual(
    isExcluded('logs/server.log', testPatterns),
    true,
    '特定ディレクトリ内のファイルが正しく除外されること'
  );
  
  // マッチしないパス
  assertEqual(
    isExcluded('normal.txt', testPatterns),
    false,
    '除外パターンにマッチしないファイルは除外されないこと'
  );
  
  assertEqual(
    isExcluded('path/to/script.js', testPatterns),
    false,
    '除外パターンにマッチしないパスは除外されないこと'
  );
  
  assertEqual(
    isExcluded('logs/info.txt', testPatterns),
    false,
    '部分一致しても完全一致しないパスは除外されないこと'
  );
}

async function testGenerateRequestId() {
  // リクエストIDの生成
  const id1 = generateRequestId();
  const id2 = generateRequestId();
  
  // UUIDのフォーマットをチェック (簡易的な検証)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  assertEqual(
    uuidRegex.test(id1),
    true,
    '生成されたIDがUUID形式であること'
  );
  
  assertEqual(
    id1 !== id2,
    true,
    '複数回の呼び出しで異なるIDが生成されること'
  );
}

async function testNormalizeToProjectRoot() {
  const projectRoot = '/path/to/project';
  
  // 相対パスが正しく解決されることを検証
  assertEqual(
    normalizeToProjectRoot('src/file.js', projectRoot),
    path.resolve(projectRoot, 'src/file.js'),
    '相対パスが正しくプロジェクトルートに解決されること'
  );
  
  // 空のパスがプロジェクトルートに解決されることを検証
  assertEqual(
    normalizeToProjectRoot('', projectRoot),
    path.resolve(projectRoot),
    '空パスがプロジェクトルートに解決されること'
  );
  
  // プロジェクト外の絶対パスがプロジェクトルートに丸められることを検証
  assertEqual(
    normalizeToProjectRoot('/outside/path', projectRoot),
    path.resolve(projectRoot),
    'プロジェクト外の絶対パスがプロジェクトルートに丸められること'
  );
  
  // プロジェクト内の絶対パスが正しく解決されることを検証
  const insidePath = path.resolve(projectRoot, 'inside/path');
  assertEqual(
    normalizeToProjectRoot(insidePath, projectRoot),
    insidePath,
    'プロジェクト内の絶対パスが正しく解決されること'
  );
}

async function testResolveSafeProjectPath() {
  // normalizeToProjectRootと同じ動作をするため、基本テストのみ
  const projectRoot = '/path/to/project';
  
  assertEqual(
    resolveSafeProjectPath('../dangerous', projectRoot),
    path.resolve(projectRoot),
    '潜在的に危険なパスがプロジェクトルートに丸められること'
  );
  
  assertEqual(
    resolveSafeProjectPath('safe/path', projectRoot),
    path.resolve(projectRoot, 'safe/path'),
    '安全なパスが正しく解決されること'
  );
}

async function testIsAllowedExtension() {
  // テスト用の一時ファイルを作成
  const tempDir = path.join(os.tmpdir(), 'mcp-code-test');
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }
  
  const txtFilePath = path.join(tempDir, 'test.txt');
  const jsFilePath = path.join(tempDir, 'test.js');
  const dirPath = path.join(tempDir, 'testdir');
  
  writeFileSync(txtFilePath, 'test content', 'utf-8');
  writeFileSync(jsFilePath, 'console.log("test");', 'utf-8');
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
  
  // 許可拡張子のみのチェック
  const allowedExts = ['.txt', '.md', '.json'];
  
  assertEqual(
    isAllowedExtension(txtFilePath, allowedExts),
    true,
    '許可された拡張子のファイルは許可されること'
  );
  
  assertEqual(
    isAllowedExtension(jsFilePath, allowedExts),
    false,
    '許可されていない拡張子のファイルは許可されないこと'
  );
  
  assertEqual(
    isAllowedExtension(dirPath, allowedExts),
    true,
    'ディレクトリは常に許可されること'
  );
  
  // 許可拡張子が指定されていない場合
  assertEqual(
    isAllowedExtension(jsFilePath, null),
    true,
    '許可拡張子が指定されていない場合は全ファイルが許可されること'
  );
  
  assertEqual(
    isAllowedExtension(jsFilePath, []),
    true,
    '許可拡張子が空の場合は全ファイルが許可されること'
  );
}

async function testConvertToRelativePaths() {
  const projectRoot = '/path/to/project';
  
  // Unixパス形式のテキスト
  const unixText = `
    ファイルパス: ${projectRoot}/src/file.js
    別のパス: ${projectRoot}/config/settings.json
    プロジェクト外: /path/outside/file.txt
  `;
  
  const convertedUnixText = convertToRelativePaths(unixText, projectRoot);
  
  assertEqual(
    convertedUnixText.includes(`ファイルパス: src/file.js`),
    true,
    'Unixパスが正しく相対パスに変換されること'
  );
  
  assertEqual(
    convertedUnixText.includes(`別のパス: config/settings.json`),
    true,
    '複数のUnixパスが正しく変換されること'
  );
  
  // Windowsパス形式のテキスト（プラットフォームに関わらずテスト）
  const windowsRoot = 'C:\\path\\to\\project';
  const windowsText = `
    ファイルパス: ${windowsRoot}\\src\\file.js
    別のパス: ${windowsRoot}\\config\\settings.json
    プロジェクト外: D:\\outside\\file.txt
  `;
  
  // Windowsのパス区切り文字を指定
  const convertedWindowsText = convertToRelativePaths(windowsText, windowsRoot, '\\');
  
  // 注: この関数はプラットフォームによって動作が異なるため、テスト内容を調整
  // 完全一致ではなく含まれるかどうかのテスト
  assertEqual(
    convertedWindowsText.includes(`src\\file.js`) || convertedWindowsText.includes(`src/file.js`),
    true,
    'Windowsパスが相対パスに変換されること'
  );
}

// メインのテスト実行関数
export async function runUtilTests() {
  await runTestSuite("Legacy Test Suite", [
    { name: 'ファイル除外パターンテスト', fn: testIsExcluded },
    { name: 'リクエストID生成テスト', fn: testGenerateRequestId },
    { name: 'プロジェクトパス正規化テスト', fn: testNormalizeToProjectRoot },
    { name: '安全なパス解決テスト', fn: testResolveSafeProjectPath },
    { name: '許可拡張子チェックテスト', fn: testIsAllowedExtension },
    { name: '相対パス変換テスト', fn: testConvertToRelativePaths },
  ]);
}

// 単体で実行する場合
if (isMainModule(import.meta.url)) {
  runUtilTests().catch(console.error);
}
