import { existsSync, mkdirSync, statSync } from 'fs'
import * as os from 'os'
import path, { join } from 'path'

import { Minimatch } from 'minimatch'

// export function cwdPath(filePath: string[]) {
//   return join(process.cwd(), ...filePath);
// }

export function getHomePath(filePath: string[]): string {
  const homeDir = os.homedir()
  return join(homeDir, ...filePath)
}

export function getConfigPath(): string {
  return getHomePath(['.config', 'mcp-code', 'config.yaml'])
}

export function getLogPath(filePath: string[]): string {
  return getHomePath(['.local', 'state', 'mcp-code', ...filePath])
}
/**
 * 対象ファイルが除外対象にマッチするかをチェックする
 */
export const isExcluded = (filepath: string, patterns: string[]): boolean => {
  return patterns.some(pattern => new Minimatch(pattern).match(filepath))
}

/**
 * ランダムなリクエストIDを生成する関数
 * @returns UUID形式のリクエストID
 */
export function generateRequestId(): string {
  // シンプルなUUID v4生成実装例
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * パスをプロジェクトルート内に正規化する
 *
 * @param inputPath - 入力パス
 * @param projectRoot - プロジェクトルートディレクトリ
 * @returns 正規化されたパス
 */
export function normalizeToProjectRoot(
  inputPath: string,
  projectRoot: string,
): string {
  // プロジェクトルートを正規化
  const normalizedRoot = path.resolve(projectRoot)

  // 入力パスが空の場合はプロジェクトルートを返す
  if (!inputPath || inputPath.trim() === '') {
    return normalizedRoot
  }

  // パスを正規化
  let normalizedPath = path.normalize(inputPath)

  // 相対パスの場合はプロジェクトルートと結合
  if (!path.isAbsolute(normalizedPath)) {
    normalizedPath = path.join(normalizedRoot, normalizedPath)
  }

  // 正規化されたパスを取得
  normalizedPath = path.resolve(normalizedPath)

  // パスがプロジェクトディレクトリの外にあるかチェック
  if (!normalizedPath.startsWith(normalizedRoot)) {
    // プロジェクト外のパスの場合はプロジェクトルートに丸める
    return normalizedRoot
  }

  return normalizedPath
}

/**
 * 入力されたパスを指定したプロジェクトディレクトリに丸め、正規化する関数
 *
 * @param inputPath - 入力されたパス（任意のパス形式）
 * @param projectRoot - プロジェクトルートディレクトリの絶対パス
 * @returns 正規化されたプロジェクト内のパス（絶対パス）
 */
export function resolveSafeProjectPath(
  inputPath: string,
  projectRoot: string,
): string {
  return normalizeToProjectRoot(inputPath, projectRoot)
}

/**
 * ファイルの拡張子が許可リストに含まれているかを確認する
 * 「許可されている拡張子か？」という問いに答える関数
 *
 * @param filePath - 確認するファイルパス
 * @param allowedExtensions - 許可された拡張子のリスト
 * @returns 拡張子が許可されていればtrue、そうでなければfalse
 */
export function isAllowedExtension(
  filePath: string,
  allowedExtensions: string[] | null,
): boolean {
  // 許可拡張子の指定がなければ常に許可
  if (!allowedExtensions || allowedExtensions.length === 0) {
    return true
  }

  // ディレクトリの場合は常に許可
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    return true
  }

  const ext = path.extname(filePath).toLowerCase()

  // 拡張子がない場合は許可
  if (!ext) {
    return true
  }

  // 拡張子が許可リストにあるかチェック
  return allowedExtensions.includes(ext)
}

/**
 * パスのディレクトリ部分が存在しない場合、必要に応じて作成する
 *
 * @param filePath - ファイルまたはディレクトリのパス
 * @param createMissingDirectories - ディレクトリを作成するかどうか
 */
export function ensureDirectoryExists(
  filePath: string,
  createMissingDirectories: boolean = false,
): void {
  if (!createMissingDirectories) {
    return
  }

  let dirToCreate: string

  // パスがディレクトリかファイルかを判定
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    dirToCreate = filePath
  } else {
    dirToCreate = path.dirname(filePath)
  }

  // ディレクトリが存在しない場合は作成
  if (!existsSync(dirToCreate)) {
    mkdirSync(dirToCreate, { recursive: true })
  }
}

/**
 * プロジェクトルートのパスを正規化する
 *
 * @param projectRoot プロジェクトルートのパス
 * @param pathSeparator パス区切り文字
 * @returns 正規化されたルートパス
 */
function normalizeRootPath(projectRoot: string, pathSeparator: string): string {
  return projectRoot.endsWith(pathSeparator)
    ? projectRoot
    : `${projectRoot}${pathSeparator}`
}

/**
 * 現在のシステムに適したパス検出用の正規表現を取得する
 *
 * @returns パスを検出するための正規表現
 */
function getPathDetectionPattern(): RegExp {
  return process.platform === 'win32'
    ? /([A-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*)/gi // Windows パス
    : /(\/(?:[^\/\0:*?"<>|\r\n]+\/)*[^\/\0:*?"<>|\r\n]*)/g // Unix パス
}

/**
 * 絶対パスから相対パスへの変換処理
 *
 * @param absolutePath 絶対パス
 * @param normalizedRoot 正規化されたルートパス
 * @returns 変換された相対パス
 */
function convertPathToRelative(
  absolutePath: string,
  normalizedRoot: string,
): string {
  // パスが有効かチェック
  if (!absolutePath || absolutePath.length < normalizedRoot.length) {
    return absolutePath
  }

  // パスがプロジェクトルートで始まるかチェック
  if (absolutePath.startsWith(normalizedRoot)) {
    // プロジェクトルートからの相対パスに変換
    const relativePath = absolutePath.substring(normalizedRoot.length)

    return relativePath
  }

  return absolutePath
}

/**
 * システムの絶対パスからプロジェクトルートを引いて相対パスを取得する関数
 *
 * @param text 絶対パスを含むテキスト
 * @param projectRoot プロジェクトルートの絶対パス
 * @param pathSeparator パス区切り文字
 * @returns 相対パスに変換されたテキスト
 */
export function convertToRelativePaths(
  text: string,
  projectRoot: string,
  pathSeparator?: string,
): string {
  // パス区切り文字（デフォルト: /, \）
  pathSeparator = pathSeparator ?? (process.platform === 'win32' ? '\\' : '/')

  // プロジェクトルートのパスを正規化
  const normalizedRoot = normalizeRootPath(projectRoot, pathSeparator)

  // パスを検出するための正規表現パターンを取得
  const pathPattern = getPathDetectionPattern()

  // テキスト内のパスを検出して変換
  const resultText = text.replace(pathPattern, match => {
    return convertPathToRelative(match, normalizedRoot)
  })

  return resultText
}
