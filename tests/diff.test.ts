/**
 * Diffモジュールのテスト
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
} from '../src/diff'

/**
 * 基本的な行の変更テスト
 */
async function testBasicLineChange() {
  const { cleanup } = await createTestEnvironment('diff-basic')

  try {
    const oldLines = ['line1', 'line2', 'old line3', 'line4']
    const newLines = ['line1', 'line2', 'new line3', 'line4']
    const ranges = [{ start: 2, end: 2 }] // 3行目（0-based indexでは2）

    const result = diffLinesWithRanges(oldLines, newLines, ranges)

    // 結果の検証
    assertEqual(result.length, 5, '結果の行数が正しいこと')

    // 1行目: unchanged
    assertEqual(result[0].type, 'unchanged', '1行目は変更なし')
    assertEqual(result[0].line, 'line1', '1行目の内容')
    assertEqual(result[0].oldLineNum, 1, '1行目の旧行番号')
    assertEqual(result[0].newLineNum, 1, '1行目の新行番号')

    // 2行目: unchanged
    assertEqual(result[1].type, 'unchanged', '2行目は変更なし')
    assertEqual(result[1].line, 'line2', '2行目の内容')

    // 3行目: removed
    assertEqual(result[2].type, 'removed', '3行目は削除')
    assertEqual(result[2].line, 'old line3', '削除された行の内容')
    assertEqual(result[2].oldLineNum, 3, '削除された行の行番号')
    assertEqual(result[2].rangeIndex, 0, '削除された行のrangeIndex')

    // 4行目: added
    assertEqual(result[3].type, 'added', '3行目の位置に追加')
    assertEqual(result[3].line, 'new line3', '追加された行の内容')
    assertEqual(result[3].newLineNum, 3, '追加された行の行番号')
    assertEqual(result[3].rangeIndex, 0, '追加された行のrangeIndex')

    // 5行目: unchanged
    assertEqual(result[4].type, 'unchanged', '4行目は変更なし')
    assertEqual(result[4].line, 'line4', '4行目の内容')
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
      { start: 1, end: 1 },
      { start: 3, end: 3 },
    ] // 2行目と4行目

    const result = diffLinesWithRanges(oldLines, newLines, ranges)

    assertEqual(result.length, 7, '結果の行数が正しいこと')

    // 順序の検証
    assertEqual(result[0].type, 'unchanged', '1行目は変更なし')
    assertEqual(result[1].type, 'removed', '2行目削除')
    assertEqual(result[2].type, 'added', '2行目追加')
    assertEqual(result[3].type, 'unchanged', '3行目は変更なし')
    assertEqual(result[4].type, 'removed', '4行目削除')
    assertEqual(result[5].type, 'added', '4行目追加')
    assertEqual(result[6].type, 'unchanged', '5行目は変更なし')

    // rangeIndexの検証
    assertEqual(result[1].rangeIndex, 0, '最初の範囲')
    assertEqual(result[2].rangeIndex, 0, '最初の範囲')
    assertEqual(result[4].rangeIndex, 1, '2番目の範囲')
    assertEqual(result[5].rangeIndex, 1, '2番目の範囲')
  } finally {
    await cleanup()
  }
}

/**
 * 行数が変わる場合のテスト（1行→2行）
 */
async function testLineInsertion() {
  const { cleanup } = await createTestEnvironment('diff-insertion')

  try {
    const oldLines = ['line1', 'line2', 'line3']
    const newLines = ['line1', 'new line2a', 'new line2b', 'line3']
    const ranges = [{ start: 1, end: 1 }] // 2行目を変更

    const result = diffLinesWithRanges(oldLines, newLines, ranges)

    // この場合、現在の実装では問題があることを確認
    // 期待: ['line1', '-line2', '+new line2a', '+new line2b', 'line3']
    // しかし現在の実装では最後の'line3'が正しく処理されない可能性がある

    assertEqual(result[0].type, 'unchanged', '1行目は変更なし')
    assertEqual(result[1].type, 'removed', '元の2行目は削除')
    assertEqual(result[2].type, 'added', '新しい2行目追加')

    // 現在の実装の問題点を検出
    const hasLine3 = result.some(
      r => r.line === 'line3' && r.type === 'unchanged',
    )
    assertTrue(
      hasLine3,
      'line3が正しく処理されること（現在の実装では失敗する可能性）',
    )
  } finally {
    await cleanup()
  }
}

/**
 * 行数が変わる場合のテスト（2行→1行）
 */
async function testLineDeletion() {
  const { cleanup } = await createTestEnvironment('diff-deletion')
  
  try {
    const oldLines = ['line1', 'old line2a', 'old line2b', 'line3']
    const newLines = ['line1', 'new line2', 'line3']
    const ranges = [{ start: 1, end: 1 }] // 2行目のみを変更（'old line2a', 'old line2b' → 'new line2'）

    const result = diffLinesWithRanges(oldLines, newLines, ranges)

    assertEqual(result[0].type, 'unchanged', '1行目は変更なし')
    assertEqual(result[1].type, 'removed', '元の2行目削除')
    assertEqual(result[2].type, 'added', '新しい2行目追加')

    // 最後の行が正しく処理されることを確認
    const hasLine3 = result.some(
      r => r.line === 'line3' && r.type === 'unchanged',
    )
    assertTrue(hasLine3, 'line3が正しく処理されること')
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

// メインのテスト実行関数
export async function runDiffTests() {
  await runTestSuite('Diffテスト', [
    { name: '基本的な行の変更', fn: testBasicLineChange },
    { name: '複数範囲の変更', fn: testMultipleRangeChanges },
    { name: '行の挿入（1行→2行）', fn: testLineInsertion },
    { name: '行の削除（2行→1行）', fn: testLineDeletion },
    { name: 'allText関数', fn: testAllText },
    { name: 'changesOnly関数', fn: testChangesOnly },
    {
      name: 'changesWithLineNumbersAndSeparators関数',
      fn: testChangesWithLineNumbersAndSeparators,
    },
    { name: '空の範囲配列', fn: testEmptyRanges },
  ])
}

// 単体で実行する場合
if (isMainModule(import.meta.url)) {
  runDiffTests().catch(console.error);
}
