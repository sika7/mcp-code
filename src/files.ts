import { existsSync } from 'fs'
import fs from 'fs/promises'
import path from 'path'

import { minimatch } from 'minimatch'

import { createSystemLogger } from './logs.js'
import { allText, diffLinesWithRanges, DiffRange } from './diff.js'

const log = createSystemLogger()

// ファイル読み込みオプションの型定義
interface ReadFileOptions {
  showLineNumbers?: boolean
  startLine?: number // 表示開始行（1ベース）
  endLine?: number // 表示終了行（1ベース）
  maxLines?: number // 最大表示行数
}

// 行の範囲を計算
function calculateLineRange(
  totalLines: number,
  options: ReadFileOptions,
): { startLine: number; endLine: number; maxLines: number } {
  const startLine = Math.max(1, options.startLine || 1)
  const maxLines = options.maxLines || totalLines

  const userEndLine = options.endLine || totalLines
  const maxEndLine = startLine + maxLines - 1

  // endLineがmaxLinesの制限を超える場合は丸める
  const endLine = Math.min(totalLines, maxEndLine, userEndLine)

  return { startLine, endLine, maxLines }
}

// 指定範囲の行を抽出
function extractDisplayLines(
  lines: string[],
  startLine: number,
  endLine: number,
): string[] {
  return lines.slice(startLine - 1, endLine)
}

// 行番号付きでフォーマット
function formatContent(
  lines: string[],
  startLine: number,
  showLineNumbers: boolean,
): string {
  if (!showLineNumbers) return lines.join('\n')

  const lineNumberWidth = String(startLine + lines.length - 1).length
  return lines
    .map((line, index) => {
      const lineNum = startLine + index
      const paddedNum = String(lineNum).padStart(lineNumberWidth, ' ')
      return `${paddedNum}: ${line}`
    })
    .join('\n')
}

// メイン関数
export async function readTextFileWithOptions(
  filePath: string,
  options: ReadFileOptions = {},
): Promise<{
  content: string
  metadata: {
    totalLines: number
    displayedLines: number
    startLine: number
    endLine: number
    truncated: boolean
  }
}> {
  try {
    const { lines } = await readTextFile(filePath)
    log({ logLevel: 'INFO', message: `Reading file: ${filePath}` })

    const totalLines = lines.length

    const { startLine, endLine } = calculateLineRange(totalLines, options)
    const displayLines = extractDisplayLines(lines, startLine, endLine)
    const truncated = endLine < totalLines || startLine > 1
    const content = formatContent(
      displayLines,
      startLine,
      !!options.showLineNumbers,
    )

    return {
      content,
      metadata: {
        totalLines,
        displayedLines: displayLines.length,
        startLine,
        endLine,
        truncated,
      },
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log({
      logLevel: 'ERROR',
      message: `Error reading file: ${errorMsg}`,
    })
    throw new Error(`Failed to read file at ${filePath}: ${errorMsg}`)
  }
}

interface TextLineContents {
  eol: string
  lines: string[]
}

/**
 * テキストファイルを読み込む
 * @param filePath 読み込むファイルのパス
 * @returns ファイルの内容
 */
export async function readTextFile(
  filePath: string,
): Promise<TextLineContents> {
  try {
    // ファイルが存在するか確認
    await fs.access(filePath, fs.constants.F_OK | fs.constants.W_OK)

    log({
      logLevel: 'INFO',
      message: `Reading file: ${filePath}`,
    })
    const content = await fs.readFile(filePath, 'utf-8')

    // 元のファイルの改行コードを検出
    const eol = content.includes('\r\n') ? '\r\n' : '\n'
    const lines = content.split(eol)
    return { eol: eol, lines: lines }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log({
      logLevel: 'ERROR',
      message: `Error reading file: ${errorMsg}`,
    })
    if (error instanceof Error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`File does not exist: ${filePath}`)
      }
      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        throw new Error(`Permission denied: ${filePath}`)
      }
    }
    throw new Error(`Failed to read file at ${filePath}: ${errorMsg}`)
  }
}

/**
 * テキストファイルに書き込む
 * @param filePath 書き込み先ファイルパス
 * @param content 書き込む内容
 * @param append 追記モードかどうか (デフォルト: false)
 * @returns 成功メッセージ
 */
export async function writeTextFile(
  filePath: string,
  content: string,
  append: boolean = false,
): Promise<string> {
  try {
    // ディレクトリが存在しない場合は作成
    const dir = path.dirname(filePath)
    await fs.mkdir(dir, { recursive: true }).catch(() => {})

    // ファイルに書き込み
    const flag = append ? 'a' : 'w'
    await fs.writeFile(filePath, content, { flag })

    const action = append ? 'appended to' : 'written to'
    log({
      logLevel: 'INFO',
      message: `Successfully ${action} ${filePath}`,
    })
    return `Successfully ${action} ${filePath}`
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log({
      logLevel: 'ERROR',
      message: `Error writing file: ${errorMsg}`,
    })
    throw new Error(`Failed to write to ${filePath}: ${errorMsg}`)
  }
}

/**
 * ファイルを削除する
 * @param filePath 削除するファイルのパス
 * @returns 成功メッセージ
 */
export async function deleteFile(filePath: string): Promise<string> {
  try {
    // ファイルが存在するか確認
    if (!existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`)
    }

    await fs.unlink(filePath)
    log({
      logLevel: 'INFO',
      message: `File deleted: ${filePath}`,
    })
    return `Successfully deleted ${filePath}`
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log({
      logLevel: 'ERROR',
      message: `Error deleting file: ${errorMsg}`,
    })
    throw new Error(`Failed to delete ${filePath}: ${errorMsg}`)
  }
}

/**
 * ディレクトリ内のファイル一覧を取得
 * @param dirPath ディレクトリパス
 * @param filter ファイル名フィルター (オプション)
 * @returns ファイル一覧
 */
export async function listFiles(
  dirPath: string,
  filter?: string,
): Promise<string[]> {
  try {
    // ディレクトリが存在するか確認
    if (!existsSync(dirPath)) {
      throw new Error(`Directory does not exist: ${dirPath}`)
    }

    const files = await fs.readdir(dirPath)

    // フィルターが指定されている場合は適用
    let filteredFiles = files
    if (filter) {
      const regex = new RegExp(filter)
      filteredFiles = files.filter(file => regex.test(file))
    }

    log({
      logLevel: 'INFO',
      message: `Found ${filteredFiles.length} files in ${dirPath}`,
    })

    // ファイルパスを完全なものに変換
    return filteredFiles.map(file => path.join(dirPath, file))
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log({
      logLevel: 'ERROR',
      message: `Error listing files: ${errorMsg}`,
    })
    throw new Error(`Failed to list files in ${dirPath}: ${errorMsg}`)
  }
}

/**
 * ファイルまたはディレクトリを非同期で移動またはリネームする関数
 * @param srcPath 移動元のパス
 * @param destPath 移動先のパス
 * @throws 移動先にすでにファイル・ディレクトリが存在する場合はエラー
 */
export async function fileMoveOrRename(
  srcPath: string,
  destPath: string,
): Promise<string> {
  try {
    // 移動元が存在するかチェック
    await fs.access(srcPath) // 存在しなければ例外が出る

    // 移動先にすでにファイルまたはディレクトリが存在するか確認
    // existsSyncを使ってシンプルにチェック
    if (existsSync(destPath)) {
      throw new Error(
        `移動先にすでにファイルまたはディレクトリが存在します: ${destPath}`,
      )
    }

    // 移動先ディレクトリの作成（なければ）
    const destDir = path.dirname(destPath)
    await fs.mkdir(destDir, { recursive: true })

    // リネーム（= 移動）処理
    await fs.rename(srcPath, destPath)

    const msg = `移動完了: ${srcPath} → ${destPath}`
    log({ logLevel: 'INFO', message: msg })
    return msg
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log({
      logLevel: 'ERROR',
      message: `ファイル/ディレクトリの移動に失敗しました: ${errorMsg}`,
    })
    throw error
  }
}

/**
 * 特定の行を編集する
 * @param filePath 編集するファイルのパス
 * @param startLineNumber 編集開始行番号 (1ベース)
 * @param endLineNumber 編集終了行番号 (1ベース)
 * @param newContent 新しい行の内容
 * @returns 成功メッセージ
 */
export async function editLines(
  filePath: string,
  startLine: number,
  endLine: number,
  newContent: string,
): Promise<string> {
  try {
    // ファイルの内容を読み込む
    const { eol, lines } = await readTextFile(filePath)

    // 行番号のバリデーション
    validateLineNumber(startLine, lines.length, true)

    // 範囲のバリデーション
    validateLineRange(startLine, endLine, lines.length)

    // 新しい内容を改行で分割
    const newLines = newContent.split(/\r?\n/)

    // 指定範囲の行を置換
    const result = replaceRange(lines, startLine, endLine, newLines)

    // ファイルに書き戻す
    await writeTextFile(filePath, result.join(eol))

    const message = `Successfully edited lines ${startLine}-${endLine} in ${filePath}`
    log({
      logLevel: 'INFO',
      message: message,
    })
    return message
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log({
      logLevel: 'ERROR',
      message: `Error editing lines: ${errorMsg}`,
    })
    throw new Error(`Failed to edit lines in ${filePath}: ${errorMsg}`)
  }
}

/**
 * 特定の行を挿入する
 * @param filePath 編集するファイルのパス
 * @param lineNumber 挿入位置の行番号 (1ベース)
 * @param content 挿入する内容
 * @returns 成功メッセージ
 */
export async function insertLine(
  filePath: string,
  lineNumber: number,
  content: string,
): Promise<string> {
  try {
    // ファイルの内容を読み込む
    const { eol, lines } = await readTextFile(filePath)

    // 行番号のバリデーション (ファイルの末尾への追加も許可)
    validateLineNumber(lineNumber, lines.length, true)

    // 指定位置に行を挿入
    const newLines = insertLinesAt(lines, content.split(/\r?\n/), lineNumber)

    // ファイルに書き戻す (元の改行コードを維持)
    await writeTextFile(filePath, newLines.join(eol))

    const message = `Successfully inserted line at position ${lineNumber} in ${filePath}`
    log({
      logLevel: 'INFO',
      message: message,
    })
    return message
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log({
      logLevel: 'ERROR',
      message: `Error inserting line: ${errorMsg}`,
    })
    throw new Error(`Failed to insert line in ${filePath}: ${errorMsg}`)
  }
}

/**
 * 行番号が有効範囲内かチェックする
 * @param line チェック対象の行番号（1ベース）
 * @param totalLines ファイルの行数
 * @param allowAppend 最終行の次（追記）を許容するか（デフォルト: false）
 * @returns エラーがあれば文字列、なければ undefined
 */
function validateLineNumber(
  line: number | undefined,
  totalLines: number,
  allowAppend = false,
): string | undefined {
  if (typeof line !== 'number') return // 未定義ならスキップ

  const max = allowAppend ? totalLines + 1 : totalLines

  if (line < 1 || line > max) {
    return `行番号が範囲外です: ${line}（ファイルは ${totalLines} 行、許容範囲: 1 ～ ${max}）`
  }

  return
}

function validateLineRange(
  startLine: number,
  endLine: number,
  totalLine: number,
) {
  if (endLine < startLine || endLine > totalLine) {
    throw new Error(
      `End line number out of range: ${endLine} (file has ${totalLine} lines)`,
    )
  }
}

function insertLinesAt(
  lines: string[],
  insert: string[],
  line: number,
  afterMode: boolean = false,
) {
  const index = afterMode ? line : line - 1 // 1ベース → 0ベース補正
  return [...lines.slice(0, index), ...insert, ...lines.slice(index)]
}

function replaceRange<T>(
  array: T[],
  startLine: number,
  end: number,
  replacement: T[],
): T[] {
  const start = startLine - 1
  return [...array.slice(0, start), ...replacement, ...array.slice(end)]
}

function deleteLinesInRanges(
  lines: string[],
  startLine: number,
  endLine: number,
) {
  // 指定範囲の行を削除
  // 1ベース → 0ベースに補正
  const startIdx = startLine - 1
  const endIdx = endLine - 1
  return lines.filter((_, i) => i < startIdx || i > endIdx)
}

/**
 * 特定の行を削除する
 * @param filePath 編集するファイルのパス
 * @param startLine 削除開始行番号 (1ベース)
 * @param endLine 削除終了行番号 (1ベース)
 * @returns 成功メッセージ
 */
export async function deleteLines(
  filePath: string,
  startLine: number,
  endLine: number,
) {
  try {
    // ファイルの内容を読み込む
    const { eol, lines } = await readTextFile(filePath)

    // 行番号のバリデーション
    validateLineNumber(startLine, lines.length)

    // 範囲のバリデーション
    validateLineRange(startLine, endLine, lines.length)

    // 指定範囲の行を削除
    const newLines = deleteLinesInRanges(lines, startLine, endLine)

    // ファイルに書き戻す (元の改行コードを維持)
    await writeTextFile(filePath, newLines.join(eol))

    const message =
      startLine === endLine
        ? `Successfully deleted line ${startLine} from ${filePath}`
        : `Successfully deleted lines ${startLine}-${endLine} from ${filePath}`

    log({
      logLevel: 'INFO',
      message: message,
    })
    return message
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log({
      logLevel: 'ERROR',
      message: `Error deleting lines: ${errorMsg}`,
    })
    throw new Error(`Failed to delete lines in ${filePath}: ${errorMsg}`)
  }
}

interface MulchLines {
  startLine: number // 表示開始行（1ベース）
  endLine: number // 表示終了行（1ベース）
}

interface MulchLinesData {
  start: number // 表示開始行（1ベース）
  end: number // 表示終了行（1ベース）
  index: number //
}

function mulchLineToData(lines: MulchLines[]) {
  const newLines = lines.map((r, idx) => ({
    start: r.startLine,
    end: r.endLine,
    index: idx,
  }))
  return newLines as MulchLinesData[]
}

function validateLineRanges(lines: MulchLines[]) {
  const index = lines.findIndex(item => item.endLine < item.startLine)
  // スタートよりエンドが小さい項目があるか
  if (index !== -1) {
    const startLine = lines[index].startLine
    const endLine = lines[index].endLine
    throw Error(
      `項目 ${index + 1}: endLine (${endLine}) は startLine (${startLine}) より小さくできません`,
    )
  }
}

function validateNonOverlappingRanges(lines: MulchLinesData[]) {
  for (let i = 1; i < lines.length; i++) {
    const prev = lines[i - 1]
    const curr = lines[i]

    // 重複とは「現在のstartが前のend以下」の場合
    if (curr.start <= prev.end) {
      const msg = `項目 ${prev.index + 1}（${prev.start}-${prev.end}）と項目 ${curr.index + 1}（${curr.start}-${curr.end}）の行範囲が重複しています`
      throw new Error(msg)
    }
  }
}

function hasDuplicates(
  lines: MulchLinesData[] | MulchInsertLinesData[],
): boolean {
  const array = lines.map(i => i.start)
  return new Set(array).size !== array.length
}

// スタート順にソートする
function sortByStartLine<T>(lines: MulchLinesData[] | MulchInsertLinesData[]) {
  return lines.sort((a, b) => a.start - b.start) as T
}

// 降順にソートする
function sortByStartLineDescending<T>(
  lines: MulchLinesData[] | MulchInsertLinesData[],
) {
  return lines.sort((a, b) => b.start - a.start) as T
}

interface MulchInsertLines {
  lineNumber: number // 表示開始行（1ベース）
  content: string
}

interface MulchInsertLinesData {
  start: number // 表示開始行（1ベース）
  content: string
  index: number //
}

function mulchInsertLineToData(lines: MulchInsertLines[]) {
  const newLines = lines.map((r, idx) => ({
    start: r.lineNumber,
    content: r.content,
    index: idx,
  }))
  return newLines as MulchInsertLinesData[]
}

export async function mulchInsertLines(
  filePath: string,
  editlines: MulchInsertLines[],
  afterMode: boolean = false,
) {
  // データ型を変更
  let linesData = mulchInsertLineToData(editlines)

  // 重複をチェック
  if (hasDuplicates(linesData)) {
    throw new Error('インサート行に重複があります。')
  }

  // 後ろから処理するため降順にソート
  linesData = sortByStartLineDescending<MulchInsertLinesData[]>(linesData)

  // ファイルの内容を読み込む
  const { eol, lines } = await readTextFile(filePath)

  const insertLinesMsg: string[] = []
  let editLines: string[] = [...lines]

  // 処理
  linesData.map(item => {
    // 指定位置に行を挿入
    editLines = insertLinesAt(
      editLines,
      item.content.split(/\r?\n/),
      item.start,
      afterMode,
    )
    insertLinesMsg.push(`[${item.start}]`)
  })

  // ファイルに書き戻す (元の改行コードを維持)
  await writeTextFile(filePath, editLines.join(eol))

  const message = `Successfully Insert lines: ${insertLinesMsg.join(' ')} in ${filePath}`
  log({
    logLevel: 'INFO',
    message: message,
  })
  return message
}

interface MulchEditLines {
  startLine: number // 表示開始行（1ベース）
  endLine: number // 表示終了行（1ベース）
  content: string
}

interface MulchEditLinesData {
  start: number // 表示開始行（1ベース）
  end: number // 表示開始行（1ベース）
  content: string
  index: number //
}

function mulchEditLineToData(lines: MulchEditLines[]) {
  const newLines = lines.map((r, idx) => ({
    start: r.startLine,
    end: r.endLine,
    content: r.content,
    index: idx,
  }))
  return newLines as MulchEditLinesData[]
}

export async function mulchEditLines(
  filePath: string,
  editlines: MulchEditLines[],
  previewFlg: boolean = true,
) {
  validateLineRanges(editlines)

  // データ型を変更
  let linesData = mulchEditLineToData(editlines)

  // ソート
  linesData = sortByStartLine<MulchEditLinesData[]>(linesData)

  // 範囲の重複チェック
  validateNonOverlappingRanges(linesData)

  // 差分表示ようにデータを作成
  const diffRanges: DiffRange[] = linesData.map(item => {
    return {
      start: item.start,
      end: item.end,
    }
  })

  // 後ろから処理するため降順にソート
  linesData = sortByStartLineDescending(linesData)

  // ファイルの内容を読み込む
  const { eol, lines } = await readTextFile(filePath)

  const editLinesMsg: string[] = []
  let editLines: string[] = [...lines]

  // 処理
  linesData.map(item => {
    editLines = replaceRange(
      editLines,
      item.start,
      item.end,
      item.content.split(/\r?\n/),
    )
    editLinesMsg.push(`[${item.start}-${item.end}]`)
  })

  const diffData = diffLinesWithRanges(lines, editLines, diffRanges)
  const diff = allText(diffData)

  // プレビュー表示だったら保存しない
  if (!previewFlg) {
    // ファイルに書き戻す (元の改行コードを維持)
    await writeTextFile(filePath, editLines.join(eol))
  }

  const status = previewFlg ? 'Preview' : 'Successfully'
  const message = `${status} Edit lines: ${editLinesMsg.join(' ')} in ${filePath}`
  log({
    logLevel: 'INFO',
    message: message,
  })
  return {
    message,
    content: diff.join(eol),
  }
}

export async function mulchDeleteLines(
  filePath: string,
  editlines: MulchLines[],
) {
  validateLineRanges(editlines)

  // データ型を変更
  let linesData = mulchLineToData(editlines)

  // ソート
  linesData = sortByStartLine<MulchLinesData[]>(linesData)

  // 範囲の重複チェック
  validateNonOverlappingRanges(linesData)

  // 後ろから処理するため降順にソート
  linesData = sortByStartLineDescending(linesData)

  // ファイルの内容を読み込む
  const { eol, lines } = await readTextFile(filePath)

  const deleteLinesMsg: string[] = []
  let editLines: string[] = [...lines]

  // 処理
  linesData.map(item => {
    editLines = deleteLinesInRanges(editLines, item.start, item.end)
    deleteLinesMsg.push(`[${item.start}-${item.end}]`)
  })

  // ファイルに書き戻す (元の改行コードを維持)
  await writeTextFile(filePath, editLines.join(eol))

  const message = `Successfully Deleted lines: ${deleteLinesMsg.join(' ')} in ${filePath}`
  log({
    logLevel: 'INFO',
    message: message,
  })
  return message
}

/**
 * テキストファイルの内容を解析する関数（例）
 * @param content - ファイルの内容
 * @returns 解析結果
 */
export function parseFileContent(content: string) {
  // ファイルの種類に応じた解析処理を実装
  // この例ではシンプルに行数をカウント
  const lines = content.split('\n')
  return {
    lineCount: lines.length,
    firstLine: lines[0],
    lastLine: lines[lines.length - 1],
  }
}

interface TreeOptions {
  maxDepth?: number // 最大深さ制限
  exclude?: string[] // 除外パターン (glob風のパターン)
  currentDepth?: number // 内部使用: 現在の深さ
}

/**
 * ディレクトリツリーを生成する関数
 * @param dirPath 対象ディレクトリのパス
 * @param options 設定オプション
 * @param indent インデント文字列（内部使用）
 * @returns ツリー表示用の文字列
 */

export async function generateDirectoryTree(
  dirPath: string,
  options: TreeOptions = {},
  indent: string = '',
  rootPath?: string, // 内部処理用
): Promise<string> {
  const currentDepth = options.currentDepth || 1
  const maxDepth = options.maxDepth || Number.POSITIVE_INFINITY
  const exclude = options.exclude || []

  // 最初の呼び出し時にrootPathを設定
  const root = rootPath || dirPath

  if (currentDepth > maxDepth) {
    return `${indent}... (最大深さ制限に達しました)\n`
  }

  let result = ''

  try {
    const items = await fs.readdir(dirPath)

    // 除外パターンに一致しないアイテムのみをフィルタリング
    const filteredItems = items.filter(item => {
      const itemFullPath = path.join(dirPath, item)

      // 常に正規化された相対パスを使用
      // path.relativeがエラーを投げる可能性がある場合は代替手段を使用
      let relativePath
      try {
        relativePath = path.relative(root, itemFullPath)
        // Windows環境では一貫性のためにパス区切り文字を統一
        relativePath = relativePath.split(path.sep).join('/')
      } catch (e) {
        // 異なるドライブの場合など、相対パスが計算できない場合
        // 代替として、アイテム名だけを使用
        relativePath = item
      }

      // 各除外パターンについてチェック
      return !exclude.some(pattern => {
        // パス区切り文字を正規化
        const normalizedPattern = pattern.split(path.sep).join('/')

        // ディレクトリパターン（末尾が/）の特別処理
        if (normalizedPattern.endsWith('/')) {
          // 完全一致、またはディレクトリ内のパスかどうか
          return (
            relativePath === normalizedPattern.slice(0, -1) ||
            relativePath.startsWith(normalizedPattern) ||
            minimatch(relativePath, normalizedPattern + '**', {
              nocase: process.platform === 'win32',
            })
          )
        }

        // 通常のminimatchパターン
        return minimatch(relativePath, normalizedPattern, {
          nocase: process.platform === 'win32',
        })
      })
    })

    // アイテムの処理（以前と同じ）
    for (let i = 0; i < filteredItems.length; i++) {
      const item = filteredItems[i]
      const itemPath = path.join(dirPath, item)
      const isLast = i === filteredItems.length - 1

      try {
        const stats = await fs.stat(itemPath)
        const connector = isLast ? '└── ' : '├── '

        result += `${indent}${connector}${item}\n`

        if (stats.isDirectory()) {
          const childIndent = indent + (isLast ? '    ' : '│   ')
          const childOptions: TreeOptions = {
            ...options,
            currentDepth: currentDepth + 1,
          }
          result += await generateDirectoryTree(
            itemPath,
            childOptions,
            childIndent,
            root, // ルートパスを引き継ぐ
          )
        }
      } catch (err) {
        result += `${indent}${isLast ? '└── ' : '├── '}${item} [アクセスエラー]\n`
      }
    }
  } catch (err) {
    return `${indent}[ディレクトリの読み取りエラー: ${(err as Error).message}]\n`
  }

  return result
}
