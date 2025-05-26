type DiffResult = {
  line: string
  type: 'unchanged' | 'added' | 'removed'
  oldLineNum?: number
  newLineNum?: number
  rangeIndex?: number
}

type DiffRange = {
  start: number
  end: number
}

// ranges は 昇順に並んでいる前提
export function diffLinesWithRanges(
  oldLines: string[],
  newLines: string[],
  ranges: DiffRange[],
): DiffResult[] {
  const result: DiffResult[] = []

  let currentLine = 0

  ranges.forEach((range, rangeIndex) => {
    // unchanged
    while (currentLine < range.start) {
      result.push({
        line: newLines[currentLine],
        type: 'unchanged',
        oldLineNum: currentLine + 1,
        newLineNum: currentLine + 1,
      })
      currentLine++
    }

    const oldDiff = oldLines.slice(range.start, range.end + 1)
    const newDiff = newLines.slice(range.start, range.end + 1)

    for (let i = 0; i < oldDiff.length; i++) {
      result.push({
        line: oldDiff[i],
        type: 'removed',
        oldLineNum: range.start + i + 1,
        rangeIndex,
      })
    }
    for (let i = 0; i < newDiff.length; i++) {
      result.push({
        line: newDiff[i],
        type: 'added',
        newLineNum: range.start + i + 1,
        rangeIndex,
      })
    }

    currentLine = range.end + 1
  })

  while (currentLine < newLines.length) {
    result.push({
      line: newLines[currentLine],
      type: 'unchanged',
      oldLineNum: currentLine + 1,
      newLineNum: currentLine + 1,
    })
    currentLine++
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
