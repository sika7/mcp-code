/**
 * mcp-code テスト実行ファイル
 * 
 * 全テストを一括実行するためのエントリーポイント
 */

import { runConfigTests } from './config.test';
import { runFilesTests } from './files.test';
import { runSafeEditTests } from './safe-edit.test';
import { runUtilTests } from './util.test';
import { runScriptTests } from './script.test';

// テストのグループ化
type TestGroup = {
  name: string;
  runFn: () => Promise<void>;
};

// 全テストグループ
const testGroups: TestGroup[] = [
  { name: '設定モジュールテスト', runFn: runConfigTests },
  { name: 'ファイル操作モジュールテスト', runFn: runFilesTests },
  { name: '安全なファイル編集モジュールテスト', runFn: runSafeEditTests },
  { name: 'ユーティリティモジュールテスト', runFn: runUtilTests },
  { name: 'スクリプト実行モジュールテスト', runFn: runScriptTests },
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
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('テスト実行中に予期しないエラーが発生しました:', error);
    process.exit(1);
  });
}
