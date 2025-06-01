import { promises as fs, rmSync } from 'fs'
import path from 'path'

import { minimatch } from 'minimatch'

import { createSystemLogger } from './logs.js'

const log = createSystemLogger()

/**
 * 指定されたパスにディレクトリを作成する（存在しない場合のみ）
 * @param dirPath 作成したいディレクトリのパス
 */
export async function createDirectory(dirPath: string) {
  try {
    await fs.mkdir(dirPath, { recursive: true })
    log({
      logLevel: 'INFO',
      message: `ディレクトリを作成しました: ${dirPath}`,
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log({
      logLevel: 'ERROR',
      message: `ディレクトリの作成に失敗しました: ${errorMsg}`,
    })
    throw error
  }
  return `ディレクトリを作成しました: ${dirPath}`
}

/**
 * 指定されたディレクトリを再帰的に削除する
 * @param dirPath 削除したいディレクトリのパス
 */
export async function removeDirectory(dirPath: string) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true })
    log({
      logLevel: 'INFO',
      message: `ディレクトリを削除しました: ${dirPath}`,
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log({
      logLevel: 'ERROR',
      message: `ディレクトリの削除に失敗しました: ${errorMsg}`,
    })
    throw error
  }
  return `ディレクトリを削除しました: ${dirPath}`
}

/**
 * 指定されたディレクトリを同期的に再帰削除する
 * @param dirPath 削除したいディレクトリのパス
 */
export function removeDirectorySync(dirPath: string): void {
  try {
    rmSync(dirPath, { recursive: true, force: true })
    log({
      logLevel: 'INFO',
      message: `ディレクトリを削除しました: ${dirPath}`,
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log({
      logLevel: 'ERROR',
      message: `ディレクトリの削除に失敗しました: ${errorMsg}`,
    })
    throw error
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
