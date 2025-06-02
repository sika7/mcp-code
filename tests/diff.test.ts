/**
 * Diffモジュールのテスト - 正しい理想値に基づくテスト
 */

import {
  assertEqual,
  assertTrue,
  assertFalse,
  createTestEnvironment,
  runTestSuite,
  isMainModule,
} from './test-utils'
import {
  diffLinesWithRanges,
  allText,
  changesOnly,
  changesWithLineNumbersAndSeparators,
} from '../src/lib/diff'

/**
 * 基本的な行の変更テスト（1行→1行）
 */
async function testBasicLineChange() {
  const { cleanup } = await createTestEnvironment('diff-basic')

  try {
    const oldLines = ['line1', 'line2', 'old line3', 'line4']
    const newLines = ['line1', 'line2', 'new line3', 'line4']
    const ranges = [{ start: 2, end: 2 }] // 3行目（0-based indexでは2）を変更

    const result = diffLinesWithRanges(oldLines, newLines, ranges)

    // 期待される結果:
    // - line1 (unchanged)
    // - line2 (unchanged)  
    // - old line3 (removed)
    // + new line3 (added)
    // - line4 (unchanged)

    assertEqual(result.length, 5, '結果の行数が正しいこと')

    // 1行目: unchanged
    assertEqual(result[0].type, 'unchanged', '1行目は変更なし')
    assertEqual(result[0].line, 'line1', '1行目の内容')
    assertEqual(result[0].oldLineNum, 1, '1行目の旧行番号')
    assertEqual(result[0].newLineNum, 1, '1行目の新行番号')

    // 2行目: unchanged
    assertEqual(result[1].type, 'unchanged', '2行目は変更なし')
    assertEqual(result[1].line, 'line2', '2行目の内容')
    assertEqual(result[1].oldLineNum, 2, '2行目の旧行番号')
    assertEqual(result[1].newLineNum, 2, '2行目の新行番号')

    // 3行目: removed
    assertEqual(result[2].type, 'removed', '3行目は削除')
    assertEqual(result[2].line, 'old line3', '削除された行の内容')
    assertEqual(result[2].oldLineNum, 3, '削除された行の行番号')
    assertEqual(result[2].rangeIndex, 0, '削除された行のrangeIndex')

    // 4行目: added (3行目の位置)
    assertEqual(result[3].type, 'added', '3行目の位置に追加')
    assertEqual(result[3].line, 'new line3', '追加された行の内容')
    assertEqual(result[3].newLineNum, 3, '追加された行の行番号')
    assertEqual(result[3].rangeIndex, 0, '追加された行のrangeIndex')

    // 5行目: unchanged
    assertEqual(result[4].type, 'unchanged', '4行目は変更なし')
    assertEqual(result[4].line, 'line4', '4行目の内容')
    assertEqual(result[4].oldLineNum, 4, '4行目の旧行番号')
    assertEqual(result[4].newLineNum, 4, '4行目の新行番号')
  } finally {
    await cleanup()
  }
}

/**
 * 行の挿入テスト（1行→2行）
 */
async function testLineInsertion() {
  const { cleanup } = await createTestEnvironment('diff-insertion')

  try {
    const oldLines = ['line1', 'line2', 'line3']
    const newLines = ['line1', 'new line2a', 'new line2b', 'line3']
    const ranges = [{ start: 1, end: 1 }] // oldLines[1] ('line2') を変更

    const result = diffLinesWithRanges(oldLines, newLines, ranges)

    // 期待される結果:
    // - line1 (unchanged)
    // - line2 (removed)
    // + new line2a (added)
    // + new line2b (added)
    // - line3 (unchanged)

    assertEqual(result.length, 5, '結果の行数が正しいこと')

    assertEqual(result[0].type, 'unchanged', '1行目は変更なし')
    assertEqual(result[0].line, 'line1', '1行目の内容')

    assertEqual(result[1].type, 'removed', '元の2行目は削除')
    assertEqual(result[1].line, 'line2', '削除された行の内容')
    assertEqual(result[1].oldLineNum, 2, '削除された行の行番号')

    assertEqual(result[2].type, 'added', '新しい2行目a追加')
    assertEqual(result[2].line, 'new line2a', '追加された行aの内容')
    assertEqual(result[2].newLineNum, 2, '追加された行aの行番号')

    assertEqual(result[3].type, 'added', '新しい2行目b追加')
    assertEqual(result[3].line, 'new line2b', '追加された行bの内容')
    assertEqual(result[3].newLineNum, 3, '追加された行bの行番号')

    assertEqual(result[4].type, 'unchanged', '3行目は変更なし')
    assertEqual(result[4].line, 'line3', '3行目の内容')
    assertEqual(result[4].oldLineNum, 3, '3行目の旧行番号')
    assertEqual(result[4].newLineNum, 4, '3行目の新行番号（位置がずれる）')
  } finally {
    await cleanup()
  }
}

/**
 * 行の削除テスト（2行→1行）
 */
async function testLineDeletion() {
  const { cleanup } = await createTestEnvironment('diff-deletion')
  
  try {
    const oldLines = ['line1', 'old line2a', 'old line2b', 'line4']
    const newLines = ['line1', 'new line2', 'line4']
    const ranges = [{ start: 1, end: 2 }] // oldLines[1:3] ('old line2a', 'old line2b') を変更

    const result = diffLinesWithRanges(oldLines, newLines, ranges)

    // 期待される結果:
    // - line1 (unchanged)
    // - old line2a (removed)
    // - old line2b (removed)
    // + new line2 (added)
    // - line4 (unchanged)

    assertEqual(result.length, 5, '結果の行数が正しいこと')

    assertEqual(result[0].type, 'unchanged', '1行目は変更なし')
    assertEqual(result[0].line, 'line1', '1行目の内容')

    assertEqual(result[1].type, 'removed', '元の2行目a削除')
    assertEqual(result[1].line, 'old line2a', '削除された行aの内容')
    assertEqual(result[1].oldLineNum, 2, '削除された行aの行番号')

    assertEqual(result[2].type, 'removed', '元の2行目b削除')
    assertEqual(result[2].line, 'old line2b', '削除された行bの内容')
    assertEqual(result[2].oldLineNum, 3, '削除された行bの行番号')

    assertEqual(result[3].type, 'added', '新しい2行目追加')
    assertEqual(result[3].line, 'new line2', '追加された行の内容')
    assertEqual(result[3].newLineNum, 2, '追加された行の行番号')

    assertEqual(result[4].type, 'unchanged', '4行目は変更なし')
    assertEqual(result[4].line, 'line4', '4行目の内容')
    assertEqual(result[4].oldLineNum, 4, '4行目の旧行番号')
    assertEqual(result[4].newLineNum, 3, '4行目の新行番号（位置がずれる）')
  } finally {
    await cleanup()
  }
}

/**
 * 複数範囲の変更テスト
 */
async function testMultipleRangeChanges() {
  const { cleanup } = await createTestEnvironment('diff-multiple')

  try {
    const oldLines = ['line1', 'old line2', 'line3', 'old line4', 'line5']
    const newLines = ['line1', 'new line2', 'line3', 'new line4', 'line5']
    const ranges = [
      { start: 1, end: 1 }, // oldLines[1] ('old line2') を変更
      { start: 3, end: 3 }, // oldLines[3] ('old line4') を変更
    ]

    const result = diffLinesWithRanges(oldLines, newLines, ranges)

    // 期待される結果:
    // - line1 (unchanged)
    // - old line2 (removed, range 0)
    // + new line2 (added, range 0)
    // - line3 (unchanged)
    // - old line4 (removed, range 1)
    // + new line4 (added, range 1)
    // - line5 (unchanged)

    assertEqual(result.length, 7, '結果の行数が正しいこと')

    assertEqual(result[0].type, 'unchanged', '1行目は変更なし')
    assertEqual(result[1].type, 'removed', '2行目削除')
    assertEqual(result[1].rangeIndex, 0, '最初の範囲')
    assertEqual(result[2].type, 'added', '2行目追加')
    assertEqual(result[2].rangeIndex, 0, '最初の範囲')
    assertEqual(result[3].type, 'unchanged', '3行目は変更なし')
    assertEqual(result[4].type, 'removed', '4行目削除')
    assertEqual(result[4].rangeIndex, 1, '2番目の範囲')
    assertEqual(result[5].type, 'added', '4行目追加')
    assertEqual(result[5].rangeIndex, 1, '2番目の範囲')
    assertEqual(result[6].type, 'unchanged', '5行目は変更なし')
  } finally {
    await cleanup()
  }
}

/**
 * 空の範囲配列のテスト
 */
async function testEmptyRanges() {
  const { cleanup } = await createTestEnvironment('diff-empty')

  try {
    const oldLines = ['line1', 'line2', 'line3']
    const newLines = ['line1', 'line2', 'line3']
    const ranges: any[] = []

    const result = diffLinesWithRanges(oldLines, newLines, ranges)

    assertEqual(result.length, 3, '全行が変更なし')
    assertTrue(
      result.every(r => r.type === 'unchanged'),
      '全て unchanged',
    )
  } finally {
    await cleanup()
  }
}

/**
 * allText関数のテスト
 */
async function testAllText() {
  const { cleanup } = await createTestEnvironment('diff-alltext')

  try {
    const oldLines = ['line1', 'old line2']
    const newLines = ['line1', 'new line2']
    const ranges = [{ start: 1, end: 1 }]

    const result = diffLinesWithRanges(oldLines, newLines, ranges)
    const formatted = allText(result)

    assertEqual(formatted.length, 3, 'フォーマット後の行数')
    assertTrue(formatted[0].includes('  1 | line1'), '1行目のフォーマット')
    assertTrue(formatted[1].includes('-   2 | old line2'), '削除行のフォーマット')
    assertTrue(formatted[2].includes('+   2 | new line2'), '追加行のフォーマット')
  } finally {
    await cleanup()
  }
}

/**
 * changesOnly関数のテスト
 */
async function testChangesOnly() {
  const { cleanup } = await createTestEnvironment('diff-changesonly')

  try {
    const oldLines = ['line1', 'old line2', 'line3']
    const newLines = ['line1', 'new line2', 'line3']
    const ranges = [{ start: 1, end: 1 }]

    const result = diffLinesWithRanges(oldLines, newLines, ranges)
    const changes = changesOnly(result)

    assertEqual(changes.length, 2, '変更行のみ2行')
    assertEqual(changes[0], '- old line2', '削除行')
    assertEqual(changes[1], '+ new line2', '追加行')
  } finally {
    await cleanup()
  }
}

/**
 * changesWithLineNumbersAndSeparators関数のテスト
 */
async function testChangesWithLineNumbersAndSeparators() {
  const { cleanup } = await createTestEnvironment('diff-separators')

  try {
    const oldLines = ['line1', 'old line2', 'line3', 'old line4']
    const newLines = ['line1', 'new line2', 'line3', 'new line4']
    const ranges = [
      { start: 1, end: 1 },
      { start: 3, end: 3 },
    ]

    const result = diffLinesWithRanges(oldLines, newLines, ranges)
    const formatted = changesWithLineNumbersAndSeparators(result, ranges)

    // 区切り線が含まれることを確認
    const hasSeparator1 = formatted.some(line => line.includes('2〜2行目'))
    const hasSeparator2 = formatted.some(line => line.includes('4〜4行目'))
    assertTrue(hasSeparator1, '最初の範囲の区切り線')
    assertTrue(hasSeparator2, '2番目の範囲の区切り線')
  } finally {
    await cleanup()
  }
}

/**
 * エッジケース：ファイル末尾の変更
 */
async function testEndOfFileChange() {
  const { cleanup } = await createTestEnvironment('diff-eof')

  try {
    const oldLines = ['line1', 'line2', 'old line3']
    const newLines = ['line1', 'line2', 'new line3a', 'new line3b']
    const ranges = [{ start: 2, end: 2 }] // 最後の行を変更

    const result = diffLinesWithRanges(oldLines, newLines, ranges)

    // 期待される結果:
    // - line1 (unchanged)
    // - line2 (unchanged)
    // - old line3 (removed)
    // + new line3a (added)
    // + new line3b (added)

    assertEqual(result.length, 5, '結果の行数が正しいこと')
    assertEqual(result[0].type, 'unchanged', '1行目は変更なし')
    assertEqual(result[1].type, 'unchanged', '2行目は変更なし')
    assertEqual(result[2].type, 'removed', '3行目は削除')
    assertEqual(result[3].type, 'added', '新しい3行目a追加')
    assertEqual(result[4].type, 'added', '新しい3行目b追加')
  } finally {
    await cleanup()
  }
}

// メインのテスト実行関数
export async function runDiffTests() {
  await runTestSuite('Diffテスト（修正版）', [
    { name: '基本的な行の変更（1行→1行）', fn: testBasicLineChange },
    { name: '行の挿入（1行→2行）', fn: testLineInsertion },
    { name: '行の削除（2行→1行）', fn: testLineDeletion },
    { name: '複数範囲の変更', fn: testMultipleRangeChanges },
    { name: '空の範囲配列', fn: testEmptyRanges },
    { name: 'allText関数', fn: testAllText },
    { name: 'changesOnly関数', fn: testChangesOnly },
    { name: 'changesWithLineNumbersAndSeparators関数', fn: testChangesWithLineNumbersAndSeparators },
    { name: 'ファイル末尾の変更', fn: testEndOfFileChange },
  ])
}

// 単体で実行する場合
if (isMainModule(import.meta.url)) {
  runDiffTests().catch(console.error);
}
