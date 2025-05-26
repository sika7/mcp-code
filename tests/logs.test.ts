/**
 * ログ機能モジュールのテスト
 */

import { existsSync, readFileSync } from "fs";

import { assertEqual, runTests, isMainModule, createTestEnvironment } from './test-utils';
import { createSystemLogger, createRequestErrorLogger } from '../src/logs';

async function testCreateSystemLogger() {
  // テスト環境のセットアップ
  const env = await createTestEnvironment("legacy");
  const testDir = env.testDir;
  const logFilePath = `${testDir}/system-test.log`;

  // システムロガーの作成
  const logger = createSystemLogger({ logFilePath });

  // 基本的なログ出力テスト
  logger({
    logLevel: "INFO",
    message: "テストメッセージ",
  });

  // ファイルが作成されているか確認
  assertEqual(existsSync(logFilePath), true, "ログファイルが作成されること");

  // ログファイルの内容を確認
  const logContent = readFileSync(logFilePath, "utf-8");
  const logLines = logContent.trim().split("\n");
  
  assertEqual(logLines.length, 1, "1行のログが記録されること");

  // JSONパースのテスト
  const logEntry = JSON.parse(logLines[0]);
  assertEqual(logEntry.level, "INFO", "ログレベルが正しく記録されること");
  assertEqual(logEntry.message, "テストメッセージ", "メッセージが正しく記録されること");
  assertEqual(typeof logEntry.timestamp, "string", "タイムスタンプが文字列で記録されること");

  // 複数のログレベルのテスト
  logger({ logLevel: "DEBUG", message: "デバッグメッセージ" });
  logger({ logLevel: "WARNING", message: "警告メッセージ" });
  logger({ logLevel: "ERROR", message: "エラーメッセージ" });

  const updatedContent = readFileSync(logFilePath, "utf-8");
  const updatedLines = updatedContent.trim().split("\n");
  assertEqual(updatedLines.length, 4, "4行のログが記録されること");

  // データ付きログのテスト
  logger({
    logLevel: "INFO",
    message: "データ付きメッセージ",
    data: { key: "value", number: 42 },
  });

  const finalContent = readFileSync(logFilePath, "utf-8");
  const finalLines = finalContent.trim().split("\n");
  const lastLog = JSON.parse(finalLines[finalLines.length - 1]);
  
  assertEqual(lastLog.data.key, "value", "データオブジェクトが正しく記録されること");
  assertEqual(lastLog.data.number, 42, "データ内の数値が正しく記録されること");
}

async function testCreateRequestErrorLogger() {
  // テスト環境のセットアップ
  const env = await createTestEnvironment("legacy");
  const testDir = env.testDir;
  const logFilePath = `${testDir}/request-error-test.log`;

  // リクエストエラーロガーの作成
  const requestLogger = createRequestErrorLogger({ logFilePath });

  // 基本的なリクエストログ出力テスト
  requestLogger(
    404,
    "ファイルが見つかりません",
    "test_project",
    "/test/file.txt",
    "req-123"
  );

  // ファイルが作成されているか確認
  assertEqual(existsSync(logFilePath), true, "リクエストログファイルが作成されること");

  // ログファイルの内容を確認
  const logContent = readFileSync(logFilePath, "utf-8");
  const logLines = logContent.trim().split("\n");
  
  assertEqual(logLines.length, 1, "1行のリクエストログが記録されること");

  // JSONパースのテスト
  const logEntry = JSON.parse(logLines[0]);
  assertEqual(logEntry.status, 404, "ステータスコードが正しく記録されること");
  assertEqual(logEntry.message, "ファイルが見つかりません", "メッセージが正しく記録されること");
  assertEqual(logEntry.project, "test_project", "プロジェクト名が正しく記録されること");
  assertEqual(logEntry.file, "/test/file.txt", "ファイルパスが正しく記録されること");
  assertEqual(logEntry.request_id, "req-123", "リクエストIDが正しく記録されること");
  assertEqual(typeof logEntry.timestamp, "string", "タイムスタンプが文字列で記録されること");

  // 複数のステータスコードのテスト
  requestLogger(200, "成功", "test_project", "/success.txt", "req-200");
  requestLogger(500, "内部エラー", "test_project", "/error.txt", "req-500");
  requestLogger(403, "アクセス拒否", "test_project", "/forbidden.txt", "req-403");

  const updatedContent = readFileSync(logFilePath, "utf-8");
  const updatedLines = updatedContent.trim().split("\n");
  assertEqual(updatedLines.length, 4, "4行のリクエストログが記録されること");

  // 各ログエントリのステータスコードを確認
  const entries = updatedLines.map(line => JSON.parse(line));
  assertEqual(entries[1].status, 200, "200ステータスが正しく記録されること");
  assertEqual(entries[2].status, 500, "500ステータスが正しく記録されること");
  assertEqual(entries[3].status, 403, "403ステータスが正しく記録されること");
}

async function testLoggerWithDefaultPath() {
  // デフォルトパスでのロガー作成テスト
  const systemLogger = createSystemLogger({});
  const requestLogger = createRequestErrorLogger({});

  // ロガー関数が正常に作成されることを確認
  assertEqual(typeof systemLogger, "function", "システムロガーが関数として作成されること");
  assertEqual(typeof requestLogger, "function", "リクエストロガーが関数として作成されること");
}

async function testLogTimestampFormat() {
  // タイムスタンプ形式のテスト
  const env = await createTestEnvironment("legacy");
  const testDir = env.testDir;
  const logFilePath = `${testDir}/timestamp-test.log`;
  const logger = createSystemLogger({ logFilePath });

  const beforeTime = new Date();
  logger({ logLevel: "INFO", message: "タイムスタンプテスト" });
  const afterTime = new Date();

  const logContent = readFileSync(logFilePath, "utf-8");
  const logEntry = JSON.parse(logContent.trim());
  
  const logTime = new Date(logEntry.timestamp);
  
  // ログのタイムスタンプが前後の時間内にあることを確認
  assertEqual(
    logTime >= beforeTime && logTime <= afterTime,
    true,
    "タイムスタンプが適切な時間範囲内にあること"
  );

  // ISO 8601形式かどうかを確認
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  assertEqual(
    isoRegex.test(logEntry.timestamp),
    true,
    "タイムスタンプがISO 8601形式であること"
  );
}

// メインのテスト実行関数
export async function runLogsTests() {
  await runTests([
    { name: 'システムロガー作成テスト', fn: testCreateSystemLogger },
    { name: 'リクエストエラーロガー作成テスト', fn: testCreateRequestErrorLogger },
    { name: 'デフォルトパスロガーテスト', fn: testLoggerWithDefaultPath },
    { name: 'ログタイムスタンプ形式テスト', fn: testLogTimestampFormat },
  ]);
}

// 単体で実行する場合
if (isMainModule(import.meta.url)) {
  runLogsTests().catch(console.error);
}
