import {
  createDirectory,
  generateDirectoryTree,
  removeDirectory,
} from './directory'
import { listFiles } from './files'
import { createSystemLogger } from './logs'
import {
  convertToRelativePaths,
  isExcluded,
  resolveSafeProjectPath,
} from './util'

const log = createSystemLogger()

export class Core {
  private projectPath: string
  private excludedPath: string[]

  constructor(projectPath: string, excludedPath: string[]) {
    this.projectPath = projectPath
    this.excludedPath = excludedPath
  }

  private checkExcludedFiles(filePath: string) {
    // 除外ファイルをチェック
    if (isExcluded(filePath, this.excludedPath)) {
      throw new Error('指定されたパスはツールにより制限されています')
    }
  }

  private isExcludedFiles(filePath: string) {
    // 除外ファイルをチェック
    if (isExcluded(filePath, this.excludedPath)) return true
    return false
  }

  async directoryTree(path: string, exclude: string[]) {
    // プロジェクトルートのパスに丸める
    const safeFilePath = resolveSafeProjectPath(path, this.projectPath)
    this.checkExcludedFiles(safeFilePath)

    const mergeExcluded = [...this.excludedPath, ...exclude]
    log({ logLevel: 'INFO', message: '除外パターン', data: mergeExcluded })
    const tree = await generateDirectoryTree(safeFilePath, {
      exclude: mergeExcluded,
    })
    // 相対パスにして返す。
    const result = convertToRelativePaths(tree, this.projectPath)

    return result
  }

  async createDirectory(path: string) {
    // プロジェクトルートのパスに丸める
    const safeFilePath = resolveSafeProjectPath(path, this.projectPath)
    this.checkExcludedFiles(safeFilePath)

    const result = await createDirectory(safeFilePath)
    return result
  }

  async removeDirectory(path: string) {
    // プロジェクトルートのパスに丸める
    const safeFilePath = resolveSafeProjectPath(path, this.projectPath)
    this.checkExcludedFiles(safeFilePath)

    const result = await removeDirectory(safeFilePath)
    return result
  }

  async listFiles(path: string, filter: string = "") {
    // プロジェクトルートのパスに丸める
    const safeFilePath = resolveSafeProjectPath(path, this.projectPath)
    this.checkExcludedFiles(safeFilePath)

    const files = await listFiles(safeFilePath, filter)
    // 許可されたファイルのみ表示
    const items = files.filter(item => !this.isExcludedFiles(item))

    // 相対パスにして返す。
    const result = convertToRelativePaths(items.join('\n'), this.projectPath)

    return result
  }
}
