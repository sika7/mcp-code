/**
 * mcp-code テスト実行ファイル
 * 
 * 全テストを一括実行するためのエントリーポイント
 */

import { runConfigTests } from './config.test.js';
import { runDiffTests } from './diff.test.js';
import { runDirectoryTests } from './directory.test.js';
import { runFilesTests } from './files.test.js';
import { runLogsTests } from './logs.test.js';
import { runScriptTests } from './script.test.js';
import { runSearchTests } from './search.test.js';
import { isMainModule } from './test-utils.js';
import { runUtilTests } from './util.test.js';

// テストのグループ化
type TestGroup = {
  name: string;
  runFn: () => Promise<void>;
};

// 全テストグループ
const testGroups: TestGroup[] = [
  { name: '設定モジュールテスト', runFn: runConfigTests },
  { name: '差分計算モジュールテスト', runFn: runDiffTests },
  { name: 'ファイル操作モジュールテスト', runFn: runFilesTests },
  { name: 'ユーティリティモジュールテスト', runFn: runUtilTests },
  { name: 'スクリプト実行モジュールテスト', runFn: runScriptTests },
  { name: 'ディレクトリ操作モジュールテスト', runFn: runDirectoryTests },
  { name: 'ログ機能モジュールテスト', runFn: runLogsTests },
  { name: '検索機能モジュールテスト', runFn: runSearchTests },
];

/**
 * 全テストを実行する
 */
async function runAllTests() {
  console.log('=== MCP-Code テスト開始 ===');
  console.log(`全テストグループ数: ${testGroups.length}\n`);
  
  let passedGroups = 0;
  
  for (const group of testGroups) {
    console.log(`\n=== ${group.name} 開始 ===`);
    try {
      await group.runFn();
      console.log(`=== ${group.name} 完了 ✅ ===`);
      passedGroups++;
    } catch (error) {
      console.error(`=== ${group.name} 失敗 ❌ ===`);
      console.error(error);
    }
  }
  
  console.log('\n=== MCP-Code テスト結果サマリー ===');
  console.log(`テストグループ: ${passedGroups}/${testGroups.length} 成功`);
  
  if (passedGroups === testGroups.length) {
    console.log('全テスト成功! 🎉');
    process.exit(0);
  } else {
    console.error('一部のテストが失敗しました 😢');
    process.exit(1);
  }
}

// 直接実行された場合は全テストを実行
if (isMainModule(import.meta.url)) {
  runAllTests().catch(error => {
    console.error('テスト実行中に予期しないエラーが発生しました:', error);
    process.exit(1);
  });
}
