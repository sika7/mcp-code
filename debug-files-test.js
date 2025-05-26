import { promises as fs } from 'fs';
import path from 'path';
import { listFiles } from './src/files.js';

async function setupSimpleTestDir() {
  const testDir = '/tmp/debug-test-' + Date.now();
  await fs.mkdir(testDir, { recursive: true });
  
  // テストファイルの作成
  await fs.writeFile(path.join(testDir, 'file1.txt'), 'content 1');
  await fs.writeFile(path.join(testDir, 'file2.txt'), 'content 2');
  await fs.writeFile(path.join(testDir, 'file3.js'), 'console.log("test");');
  
  return testDir;
}

async function testListFiles() {
  console.log('=== デバッグ用ファイル一覧取得テスト開始 ===');
  
  try {
    console.log('1. テストディレクトリ作成中...');
    const testDir = await setupSimpleTestDir();
    console.log('   テストディレクトリ:', testDir);
    
    console.log('2. ディレクトリ内容確認中...');
    const dirContents = await fs.readdir(testDir);
    console.log('   ディレクトリ内容:', dirContents);
    
    console.log('3. listFiles関数実行中...');
    const files = await listFiles(testDir);
    console.log('   取得されたファイル:', files);
    console.log('   ファイル数:', files.length);
    
    console.log('4. フィルター付きlistFiles実行中...');
    const txtFiles = await listFiles(testDir, '\\.txt$');
    console.log('   txtファイル:', txtFiles);
    console.log('   txtファイル数:', txtFiles.length);
    
    console.log('5. テスト結果検証中...');
    if (files.length !== 3) {
      throw new Error(`期待されるファイル数: 3, 実際: ${files.length}`);
    }
    
    if (txtFiles.length !== 2) {
      throw new Error(`期待されるtxtファイル数: 2, 実際: ${txtFiles.length}`);
    }
    
    console.log('✅ 全てのテストが成功しました');
    
    // クリーンアップ
    await fs.rm(testDir, { recursive: true, force: true });
    
  } catch (error) {
    console.error('❌ テストでエラーが発生しました:', error);
    throw error;
  }
}

// テスト実行
testListFiles().then(() => {
  console.log('=== デバッグテスト完了 ===');
}).catch(error => {
  console.error('=== デバッグテストで例外発生 ===');
  console.error(error);
  process.exit(1);
});
