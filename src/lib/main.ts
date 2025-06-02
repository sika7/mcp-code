import {
  createDirectory,
  generateDirectoryTree,
  removeDirectory,
} from './directory.js'
import {
  deleteFile,
  fileMoveOrRename,
  listFiles,
  mulchDeleteLines,
  MulchEditLines,
  mulchEditLines,
  MulchInsertLines,
  mulchInsertLines,
  MulchLines,
  ReadFileOptions,
  readTextFileWithOptions,
  writeTextFile,
} from './files.js'
import { createSystemLogger } from './logs.js'
import {
  DirectoryGrepOptionsInput,
  fileGrep,
  GrepOptions,
  projectGrep,
} from './serch.js'
import {
  convertToRelativePaths,
  isExcluded,
  resolveSafeProjectPath,
} from './util.js'

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

  async listFiles(path: string, filter: string = '') {
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

  async findInFile(path: string, pattern: string, options: GrepOptions = {}) {
    // プロジェクトルートのパスに丸める
    const safeFilePath = resolveSafeProjectPath(path, this.projectPath)
    this.checkExcludedFiles(safeFilePath)

    const findResult = await fileGrep(safeFilePath, pattern, options)

    const text = JSON.stringify(findResult, null, 2)
    // 相対パスにして返す。
    const result = convertToRelativePaths(text, this.projectPath)

    return result
  }

  async projectGrep(pattern: string, options: DirectoryGrepOptionsInput = {}) {
    // プロジェクトルートのパスに丸める
    const safeFilePath = resolveSafeProjectPath('/', this.projectPath)
    const findResult = await projectGrep(safeFilePath, pattern, options)

    // 除外指定ファイルは見えないようにする
    findResult.results = findResult.results.filter(
      item => !this.isExcludedFiles(item.filePath),
    )

    const text = JSON.stringify(findResult, null, 2)
    // 相対パスにして返す。
    const result = convertToRelativePaths(text, this.projectPath)

    return result
  }

  async readFile(path: string, options: ReadFileOptions = {}) {
    // プロジェクトルートのパスに丸める
    const safeFilePath = resolveSafeProjectPath(path, this.projectPath)
    this.checkExcludedFiles(safeFilePath)

    const results = await readTextFileWithOptions(safeFilePath, options)

    return results
  }

  async writeFile(path: string, content: string) {
    // プロジェクトルートのパスに丸める
    const safeFilePath = resolveSafeProjectPath(path, this.projectPath)
    this.checkExcludedFiles(safeFilePath)

    const message = await writeTextFile(safeFilePath, content)
    // 相対パスにして返す。
    const result = convertToRelativePaths(message, this.projectPath)

    return result
  }

  async deleteFile(path: string) {
    // プロジェクトルートのパスに丸める
    const safeFilePath = resolveSafeProjectPath(path, this.projectPath)
    this.checkExcludedFiles(safeFilePath)

    const message = await deleteFile(safeFilePath)
    const result = convertToRelativePaths(message, this.projectPath)

    return result
  }

  async fileMoveOrRename(srcPath: string, distPath: string) {
    // プロジェクトルートのパスに丸める
    const safeSrcPath = resolveSafeProjectPath(srcPath, this.projectPath)
    this.checkExcludedFiles(safeSrcPath)
    const safeDistPath = resolveSafeProjectPath(distPath, this.projectPath)
    this.checkExcludedFiles(safeDistPath)

    const message = await fileMoveOrRename(safeSrcPath, safeDistPath)
    const result = convertToRelativePaths(message, this.projectPath)
    return result
  }

  async mulchInsertLinesInFile(
    path: string,
    editlines: MulchInsertLines[],
    afterMode: boolean = false,
  ) {
    // プロジェクトルートのパスに丸める
    const safeFilePath = resolveSafeProjectPath(path, this.projectPath)
    this.checkExcludedFiles(safeFilePath)

    const message = await mulchInsertLines(safeFilePath, editlines, afterMode)
    const result = convertToRelativePaths(message, this.projectPath)

    return result
  }

  async mulchEditLinesInFile(
    path: string,
    editlines: MulchEditLines[],
    previewFlg: boolean = true,
  ) {
    // プロジェクトルートのパスに丸める
    const safeFilePath = resolveSafeProjectPath(path, this.projectPath)
    this.checkExcludedFiles(safeFilePath)

    const result = await mulchEditLines(safeFilePath, editlines, previewFlg)
    result.message = convertToRelativePaths(result.message, this.projectPath)

    return result
  }

  async mulchDeleteLinesInFile(path: string, editlines: MulchLines[]) {
    // プロジェクトルートのパスに丸める
    const safeFilePath = resolveSafeProjectPath(path, this.projectPath)
    this.checkExcludedFiles(safeFilePath)

    const message = await mulchDeleteLines(safeFilePath, editlines)
    const result = convertToRelativePaths(message, this.projectPath)

    return result
  }
}
