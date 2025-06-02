/**
 * ログ機能モジュールのテスト
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";

import { assertEqual, isMainModule, createTestEnvironment, runTestSuite } from './test-utils';
import { createSystemLogger, createRequestErrorLogger, deleteOldLogs } from '../src/lib/logs';

async function testCreateSystemLogger() {
  // テスト環境のセットアップ
  const env = await createTestEnvironment("legacy");
  const testDir = env.testDir;
  const logFilePath = `${testDir}/system-test.log`;

  // システムロガーの作成
  const logger = createSystemLogger(logFilePath);

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
  const requestLogger = createRequestErrorLogger(logFilePath);

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
  const systemLogger = createSystemLogger();
  const requestLogger = createRequestErrorLogger();

  // ロガー関数が正常に作成されることを確認
  assertEqual(typeof systemLogger, "function", "システムロガーが関数として作成されること");
  assertEqual(typeof requestLogger, "function", "リクエストロガーが関数として作成されること");
}

async function testLogTimestampFormat() {
  // タイムスタンプ形式のテスト
  const env = await createTestEnvironment("legacy");
  const testDir = env.testDir;
  const logFilePath = `${testDir}/timestamp-test.log`;
  const logger = createSystemLogger(logFilePath);

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

async function testDeleteOldLogs() {
  // テスト環境のセットアップ
  const env = await createTestEnvironment("legacy");
  const testDir = env.testDir;
  const logsDir = join(testDir, "test-logs");
  
  // ログディレクトリを作成
  mkdirSync(logsDir, { recursive: true });
  
  // 現在の日付を取得
  const now = new Date();
  
  // テスト用のログファイルを作成
  // 1. 新しいログファイル（5日前）
  const recentDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const recentFile = `mcp-system-${recentDate.toISOString().slice(0, 10)}.log`;
  writeFileSync(join(logsDir, recentFile), "recent log content");
  
  // 2. 古いログファイル（35日前）- 削除対象
  const oldDate = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);
  const oldFile = `mcp-request-${oldDate.toISOString().slice(0, 10)}.log`;
  writeFileSync(join(logsDir, oldFile), "old log content");
  
  // 3. とても古いログファイル（50日前）- 削除対象
  const veryOldDate = new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000);
  const veryOldFile = `mcp-system-${veryOldDate.toISOString().slice(0, 10)}.log`;
  writeFileSync(join(logsDir, veryOldFile), "very old log content");
  
  // 4. パターンにマッチしないファイル（削除されない）
  const nonLogFile = "not-a-log-file.txt";
  writeFileSync(join(logsDir, nonLogFile), "not a log file");
  
  // 5. 不正な日付形式のファイル（削除されない）
  const invalidDateFile = "mcp-system-invalid-date.log";
  writeFileSync(join(logsDir, invalidDateFile), "invalid date format");
  
  // 削除前の状態を確認
  const filesBefore = readdirSync(logsDir);
  assertEqual(filesBefore.length, 5, "5つのファイルが存在すること");
  assertEqual(existsSync(join(logsDir, recentFile)), true, "新しいログファイルが存在すること");
  assertEqual(existsSync(join(logsDir, oldFile)), true, "古いログファイルが存在すること");
  assertEqual(existsSync(join(logsDir, veryOldFile)), true, "とても古いログファイルが存在すること");
  assertEqual(existsSync(join(logsDir, nonLogFile)), true, "非ログファイルが存在すること");
  assertEqual(existsSync(join(logsDir, invalidDateFile)), true, "不正な日付形式のファイルが存在すること");
  
  // deleteOldLogsを実行
  deleteOldLogs(logsDir);
  
  // 削除後の状態を確認
  const filesAfter = readdirSync(logsDir);
  
  // 期待される結果:
  // - recentFile: 残る（5日前なので30日以内）
  // - oldFile: 削除される（35日前なので30日以上）
  // - veryOldFile: 削除される（50日前なので30日以上）
  // - nonLogFile: 残る（ログファイルのパターンにマッチしない）
  // - invalidDateFile: 残る（日付形式が不正）
  
  assertEqual(filesAfter.length, 3, "3つのファイルが残ること");
  assertEqual(existsSync(join(logsDir, recentFile)), true, "新しいログファイルは残ること");
  assertEqual(existsSync(join(logsDir, oldFile)), false, "古いログファイルは削除されること");
  assertEqual(existsSync(join(logsDir, veryOldFile)), false, "とても古いログファイルは削除されること");
  assertEqual(existsSync(join(logsDir, nonLogFile)), true, "非ログファイルは残ること");
  assertEqual(existsSync(join(logsDir, invalidDateFile)), true, "不正な日付形式のファイルは残ること");
  
  // 残ったファイルの内容も確認
  const recentContent = readFileSync(join(logsDir, recentFile), "utf-8");
  assertEqual(recentContent, "recent log content", "新しいログファイルの内容が保持されること");
  
  const nonLogContent = readFileSync(join(logsDir, nonLogFile), "utf-8");
  assertEqual(nonLogContent, "not a log file", "非ログファイルの内容が保持されること");
  
  const invalidDateContent = readFileSync(join(logsDir, invalidDateFile), "utf-8");
  assertEqual(invalidDateContent, "invalid date format", "不正な日付形式のファイルの内容が保持されること");
}

async function testDeleteOldLogsEmptyDirectory() {
  // 空のディレクトリでのテスト
  const env = await createTestEnvironment("legacy");
  const testDir = env.testDir;
  const emptyLogsDir = join(testDir, "empty-logs");
  
  mkdirSync(emptyLogsDir, { recursive: true });
  
  // 空のディレクトリに対してdeleteOldLogsを実行
  // エラーが発生しないことを確認
  deleteOldLogs(emptyLogsDir);
  
  // ディレクトリが依然として存在し、空であることを確認
  assertEqual(existsSync(emptyLogsDir), true, "空のディレクトリが残ること");
  const files = readdirSync(emptyLogsDir);
  assertEqual(files.length, 0, "ディレクトリが空のままであること");
}

async function testDeleteOldLogsBoundaryDate() {
  // 境界値テスト（ちょうど30日前）
  const env = await createTestEnvironment("legacy");
  const testDir = env.testDir;
  const logsDir = join(testDir, "boundary-logs");
  
  mkdirSync(logsDir, { recursive: true });
  
  const now = new Date();
  
  // ちょうど30日前のファイル（削除される）
  const boundaryDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const boundaryFile = `mcp-system-${boundaryDate.toISOString().slice(0, 10)}.log`;
  writeFileSync(join(logsDir, boundaryFile), "boundary log content");
  
  // 29日前のファイル（残る）
  const withinLimitDate = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
  const withinLimitFile = `mcp-request-${withinLimitDate.toISOString().slice(0, 10)}.log`;
  writeFileSync(join(logsDir, withinLimitFile), "within limit log content");
  
  deleteOldLogs(logsDir);
  
  // 30日前のファイルは削除され、29日前のファイルは残ることを確認
  assertEqual(existsSync(join(logsDir, boundaryFile)), false, "ちょうど30日前のファイルは削除されること");
  assertEqual(existsSync(join(logsDir, withinLimitFile)), true, "29日前のファイルは残ること");
}

async function testDateConsistency() {
  // 日付と時刻の一貫性をテスト
  const env = await createTestEnvironment("date-consistency");
  const testDir = env.testDir;
  const logsDir = join(testDir, "consistency-logs");
  
  mkdirSync(logsDir, { recursive: true });
  
  // 現在の日付でログファイルを作成
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayDate = `${year}-${month}-${day}`;
  
  const todayFile = `mcp-system-${todayDate}.log`;
  writeFileSync(join(logsDir, todayFile), "today's log content");
  
  // 明日の日付でログファイルを作成（テスト用）
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowYear = tomorrow.getFullYear();
  const tomorrowMonth = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const tomorrowDay = String(tomorrow.getDate()).padStart(2, '0');
  const tomorrowDate = `${tomorrowYear}-${tomorrowMonth}-${tomorrowDay}`;
  
  const tomorrowFile = `mcp-request-${tomorrowDate}.log`;
  writeFileSync(join(logsDir, tomorrowFile), "tomorrow's log content");
  
  // 31日前の古いファイルを作成（削除対象）
  const oldDate = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
  const oldYear = oldDate.getFullYear();
  const oldMonth = String(oldDate.getMonth() + 1).padStart(2, '0');
  const oldDay = String(oldDate.getDate()).padStart(2, '0');
  const oldDateStr = `${oldYear}-${oldMonth}-${oldDay}`;
  
  const oldFile = `mcp-system-${oldDateStr}.log`;
  writeFileSync(join(logsDir, oldFile), "old log content");
  
  // 削除前の状態を確認
  const filesBefore = readdirSync(logsDir);
  assertEqual(filesBefore.length, 3, "作成した3つのファイルが存在すること");
  assertEqual(existsSync(join(logsDir, todayFile)), true, "今日のファイルが存在すること");
  assertEqual(existsSync(join(logsDir, tomorrowFile)), true, "明日のファイルが存在すること");
  assertEqual(existsSync(join(logsDir, oldFile)), true, "古いファイルが存在すること");
  
  // deleteOldLogsを実行
  deleteOldLogs(logsDir);
  
  // 削除後の状態を確認
  const filesAfter = readdirSync(logsDir);
  
  // 期待される結果:
  // - 今日のファイル: 残る
  // - 明日のファイル: 残る（将来の日付でも問題なし）
  // - 古いファイル: 削除される（31日前なので30日以上）
  
  assertEqual(filesAfter.length, 2, "2つのファイルが残ること");
  assertEqual(existsSync(join(logsDir, todayFile)), true, "今日のファイルは残ること");
  assertEqual(existsSync(join(logsDir, tomorrowFile)), true, "明日のファイルは残ること");
  assertEqual(existsSync(join(logsDir, oldFile)), false, "古いファイルは削除されること");
  
  // ファイル内容も確認
  const todayContent = readFileSync(join(logsDir, todayFile), "utf-8");
  assertEqual(todayContent, "today's log content", "今日のファイル内容が保持されること");
  
  const tomorrowContent = readFileSync(join(logsDir, tomorrowFile), "utf-8");
  assertEqual(tomorrowContent, "tomorrow's log content", "明日のファイル内容が保持されること");
}

// メインのテスト実行関数
export async function runLogsTests() {
  await runTestSuite("Logs Test Suite", [
    { name: 'システムロガー作成テスト', fn: testCreateSystemLogger },
    { name: 'リクエストエラーロガー作成テスト', fn: testCreateRequestErrorLogger },
    { name: 'デフォルトパスロガーテスト', fn: testLoggerWithDefaultPath },
    { name: 'ログタイムスタンプ形式テスト', fn: testLogTimestampFormat },
    { name: '古いログ削除テスト', fn: testDeleteOldLogs },
    { name: '空ディレクトリでの古いログ削除テスト', fn: testDeleteOldLogsEmptyDirectory },
    { name: '境界値での古いログ削除テスト', fn: testDeleteOldLogsBoundaryDate },
    { name: '日付一貫性テスト', fn: testDateConsistency },
  ]);
}

// 単体で実行する場合
if (isMainModule(import.meta.url)) {
  runLogsTests().catch(console.error);
}
