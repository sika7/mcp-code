type DiffResult = {
  line: string
  type: 'unchanged' | 'added' | 'removed'
  oldLineNum?: number
  newLineNum?: number
  rangeIndex?: number
}

export type DiffRange = {
  start: number
  end: number
}

/**
 * 修正されたdiff実装
 *
 * 設計方針：
 * - range は oldLines の行番号を基準とする（0-based）
 * - 各rangeで指定された oldLines の行範囲を削除対象とする
 * - 対応する newLines の同じ位置の行を追加対象とする
 * - 行数の変化に正しく対応する
 *
 * 例：
 * oldLines = ['A', 'B', 'C', 'D']
 * newLines = ['A', 'X', 'Y', 'Z', 'D']
 * ranges = [{ start: 1, end: 2 }]
 * → oldLines[1:3] ('B', 'C') を削除し、newLines[1:4] ('X', 'Y', 'Z') を追加
 */
export function diffLinesWithRanges(
  oldLines: string[],
  newLines: string[],
  ranges: DiffRange[],
): DiffResult[] {
  if (ranges.length === 0) {
    // rangeが空の場合は全て unchanged
    return oldLines.map((line, i) => ({
      line,
      type: 'unchanged' as const,
      oldLineNum: i + 1,
      newLineNum: i + 1,
    }))
  }

  const result: DiffResult[] = []
  const sortedRanges = [...ranges].sort((a, b) => a.start - b.start)

  let oldIndex = 0
  let newIndex = 0

  for (let rangeIndex = 0; rangeIndex < sortedRanges.length; rangeIndex++) {
    const range = sortedRanges[rangeIndex]

    // range開始前の unchanged 行を処理
    while (oldIndex < range.start) {
      result.push({
        line: oldLines[oldIndex],
        type: 'unchanged',
        oldLineNum: oldIndex + 1,
        newLineNum: newIndex + 1,
      })
      oldIndex++
      newIndex++
    }

    // 削除する行数を計算
    const oldRangeLength = range.end - range.start + 1

    // 新しいファイルで対応する範囲を計算
    // 基本的な仮定: 変更範囲の開始位置は同じ、終了位置は動的に決定
    const newRangeStart = newIndex

    // 次のunchanged部分を見つけて、新しい範囲の長さを決定
    let newRangeLength = 0
    const nextOldIndex = range.end + 1

    if (nextOldIndex < oldLines.length) {
      // 次のunchanged行を見つける
      const nextUnchangedLine = oldLines[nextOldIndex]

      // newLinesで同じ行を探す
      let foundIndex = -1
      for (let i = newIndex; i < newLines.length; i++) {
        if (newLines[i] === nextUnchangedLine) {
          foundIndex = i
          break
        }
      }

      if (foundIndex !== -1) {
        newRangeLength = foundIndex - newIndex
      } else {
        // 見つからない場合は残り全部
        newRangeLength = newLines.length - newIndex
      }
    } else {
      // oldLinesの最後の範囲の場合
      newRangeLength = newLines.length - newIndex
    }

    // 削除される行を記録
    for (let i = 0; i < oldRangeLength; i++) {
      if (oldIndex + i < oldLines.length) {
        result.push({
          line: oldLines[oldIndex + i],
          type: 'removed',
          oldLineNum: oldIndex + i + 1,
          rangeIndex,
        })
      }
    }

    // 追加される行を記録
    for (let i = 0; i < newRangeLength; i++) {
      if (newIndex + i < newLines.length) {
        result.push({
          line: newLines[newIndex + i],
          type: 'added',
          newLineNum: newIndex + i + 1,
          rangeIndex,
        })
      }
    }

    oldIndex += oldRangeLength
    newIndex += newRangeLength
  }

  // 残りの unchanged 行を処理
  while (oldIndex < oldLines.length && newIndex < newLines.length) {
    result.push({
      line: oldLines[oldIndex],
      type: 'unchanged',
      oldLineNum: oldIndex + 1,
      newLineNum: newIndex + 1,
    })
    oldIndex++
    newIndex++
  }

  // 残りの行（どちらかのファイルが長い場合）
  while (oldIndex < oldLines.length) {
    result.push({
      line: oldLines[oldIndex],
      type: 'removed',
      oldLineNum: oldIndex + 1,
    })
    oldIndex++
  }

  while (newIndex < newLines.length) {
    result.push({
      line: newLines[newIndex],
      type: 'added',
      newLineNum: newIndex + 1,
    })
    newIndex++
  }

  return result
}

export function allText(diffs: DiffResult[]) {
  const result: string[] = []
  diffs.forEach(d => {
    const symbol = d.type === 'unchanged' ? ' ' : d.type === 'added' ? '+' : '-'
    const lineNum = d.type === 'added' ? d.newLineNum : d.oldLineNum
    result.push(`${symbol} ${String(lineNum).padStart(3)} | ${d.line}`)
  })
  return result
}

export function changesOnly(diffs: DiffResult[]) {
  const result: string[] = []
  diffs.forEach(d => {
    if (d.type !== 'unchanged') {
      const symbol = d.type === 'added' ? '+' : '-'
      result.push(`${symbol} ${d.line}`)
    }
  })
  return result
}

export function changesWithLineNumbersAndSeparators(
  diffs: DiffResult[],
  ranges: DiffRange[],
) {
  let currentRangeIndex: number | undefined = undefined
  const result: string[] = []

  for (const d of diffs) {
    if (d.type === 'unchanged') continue

    // 範囲が変わったら区切り線を入れる
    if (d.rangeIndex !== currentRangeIndex) {
      currentRangeIndex = d.rangeIndex!
      const range = ranges[currentRangeIndex]
      result.push(`\n--- 差分 (${range.start + 1}〜${range.end + 1}行目) ---`)
    }

    const symbol = d.type === 'added' ? '+' : '-'
    const lineNum = d.type === 'added' ? d.newLineNum : d.oldLineNum
    result.push(`${symbol} ${String(lineNum).padStart(3)} | ${d.line}`)
  }

  return result
}
