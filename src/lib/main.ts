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
import { runScript } from './script.js'
import {
  DirectoryGrepOptionsInput,
  fileGrep,
  GrepOptions,
  projectGrep,
} from './search.js'
import {
  convertToRelativePaths,
  isExcluded,
  resolveSafeProjectPath,
} from './util.js'

const log = createSystemLogger()

export function checkExcludedFiles(filePath: string, excludedPath: string[]) {
  // 除外ファイルをチェック
  if (isExcluded(filePath, excludedPath)) {
    throw new Error('指定されたパスはツールにより制限されています')
  }
}

export function isExcludedFiles(filePath: string, excludedPath: string[]) {
  // 除外ファイルをチェック
  if (isExcluded(filePath, excludedPath)) return true
  return false
}

export async function directoryTreeCore(
  path: string,
  exclude: string[],
  projectPath: string,
  excludedPath: string[],
) {
  // プロジェクトルートのパスに丸める
  const safeFilePath = resolveSafeProjectPath(path, projectPath)
  checkExcludedFiles(safeFilePath, excludedPath)

  const mergeExcluded = [...excludedPath, ...exclude]
  log({ logLevel: 'INFO', message: '除外パターン', data: mergeExcluded })
  const tree = await generateDirectoryTree(safeFilePath, {
    exclude: mergeExcluded,
  })
  // 相対パスにして返す。
  const result = convertToRelativePaths(tree, projectPath)

  return result
}

export async function createDirectoryCore(
  path: string,
  projectPath: string,
  excludedPath: string[],
) {
  // プロジェクトルートのパスに丸める
  const safeFilePath = resolveSafeProjectPath(path, projectPath)
  checkExcludedFiles(safeFilePath, excludedPath)

  const result = await createDirectory(safeFilePath)
  return result
}

export async function removeDirectoryCore(
  path: string,
  projectPath: string,
  excludedPath: string[],
) {
  // プロジェクトルートのパスに丸める
  const safeFilePath = resolveSafeProjectPath(path, projectPath)
  checkExcludedFiles(safeFilePath, excludedPath)

  const result = await removeDirectory(safeFilePath)
  return result
}

export async function listFilesCore(
  path: string,
  projectPath: string,
  excludedPath: string[],
  filter: string = '',
) {
  // プロジェクトルートのパスに丸める
  const safeFilePath = resolveSafeProjectPath(path, projectPath)
  checkExcludedFiles(safeFilePath, excludedPath)

  const files = await listFiles(safeFilePath, filter)
  // 許可されたファイルのみ表示
  const items = files.filter(item => !isExcludedFiles(item, excludedPath))

  // 相対パスにして返す。
  const result = convertToRelativePaths(items.join('\n'), projectPath)

  return result
}

export async function findInFileCore(
  path: string,
  pattern: string,
  projectPath: string,
  excludedPath: string[],
  options: GrepOptions = {},
) {
  // プロジェクトルートのパスに丸める
  const safeFilePath = resolveSafeProjectPath(path, projectPath)
  checkExcludedFiles(safeFilePath, excludedPath)

  const findResult = await fileGrep(safeFilePath, pattern, options)

  const text = JSON.stringify(findResult, null, 2)
  // 相対パスにして返す。
  const result = convertToRelativePaths(text, projectPath)

  return result
}

export async function projectGrepCore(
  pattern: string,
  projectPath: string,
  excludedPath: string[],
  options: DirectoryGrepOptionsInput = {},
) {
  // プロジェクトルートのパスに丸める
  const safeFilePath = resolveSafeProjectPath('/', projectPath)
  const findResult = await projectGrep(safeFilePath, pattern, options)

  // 除外指定ファイルは見えないようにする
  findResult.results = findResult.results.filter(
    item => !isExcludedFiles(item.filePath, excludedPath),
  )

  const text = JSON.stringify(findResult, null, 2)
  // 相対パスにして返す。
  const result = convertToRelativePaths(text, projectPath)

  return result
}

export async function readFileCore(
  path: string,
  projectPath: string,
  excludedPath: string[],
  options: ReadFileOptions = {},
) {
  // プロジェクトルートのパスに丸める
  const safeFilePath = resolveSafeProjectPath(path, projectPath)
  checkExcludedFiles(safeFilePath, excludedPath)

  const results = await readTextFileWithOptions(safeFilePath, options)

  return results
}

export async function writeFileCore(
  path: string,
  content: string,
  projectPath: string,
  excludedPath: string[],
) {
  // プロジェクトルートのパスに丸める
  const safeFilePath = resolveSafeProjectPath(path, projectPath)
  checkExcludedFiles(safeFilePath, excludedPath)

  const message = await writeTextFile(safeFilePath, content)
  // 相対パスにして返す。
  const result = convertToRelativePaths(message, projectPath)

  return result
}

export async function deleteFileCore(
  path: string,
  projectPath: string,
  excludedPath: string[],
) {
  // プロジェクトルートのパスに丸める
  const safeFilePath = resolveSafeProjectPath(path, projectPath)
  checkExcludedFiles(safeFilePath, excludedPath)

  const message = await deleteFile(safeFilePath)
  const result = convertToRelativePaths(message, projectPath)

  return result
}

export async function fileMoveOrRenameCore(
  srcPath: string,
  distPath: string,
  projectPath: string,
  excludedPath: string[],
) {
  // プロジェクトルートのパスに丸める
  const safeSrcPath = resolveSafeProjectPath(srcPath, projectPath)
  checkExcludedFiles(safeSrcPath, excludedPath)
  const safeDistPath = resolveSafeProjectPath(distPath, projectPath)
  checkExcludedFiles(safeDistPath, excludedPath)

  const message = await fileMoveOrRename(safeSrcPath, safeDistPath)
  const result = convertToRelativePaths(message, projectPath)
  return result
}

export async function mulchInsertLinesInFileCore(
  path: string,
  editlines: MulchInsertLines[],
  projectPath: string,
  excludedPath: string[],
  afterMode: boolean = false,
) {
  // プロジェクトルートのパスに丸める
  const safeFilePath = resolveSafeProjectPath(path, projectPath)
  checkExcludedFiles(safeFilePath, excludedPath)

  const message = await mulchInsertLines(safeFilePath, editlines, afterMode)
  const result = convertToRelativePaths(message, projectPath)

  return result
}

export async function mulchEditLinesInFileCore(
  path: string,
  editlines: MulchEditLines[],
  projectPath: string,
  excludedPath: string[],
  previewFlg: boolean = true,
) {
  // プロジェクトルートのパスに丸める
  const safeFilePath = resolveSafeProjectPath(path, projectPath)
  checkExcludedFiles(safeFilePath, excludedPath)

  const result = await mulchEditLines(safeFilePath, editlines, previewFlg)
  result.message = convertToRelativePaths(result.message, projectPath)

  return result
}

export async function mulchDeleteLinesInFileCore(
  path: string,
  editlines: MulchLines[],
  projectPath: string,
  excludedPath: string[],
): Promise<string> {
  // プロジェクトルートのパスに丸める
  const safeFilePath = resolveSafeProjectPath(path, projectPath)
  checkExcludedFiles(safeFilePath, excludedPath)

  const message = await mulchDeleteLines(safeFilePath, editlines)
  const result = convertToRelativePaths(message, projectPath)

  return result
}

export async function runScriptCore(
  name: string,
  scriptCmd: string,
  projectPath: string,
) {
  const result = await runScript(name, scriptCmd, projectPath)

  return result
}

/**
 * Core - 便利なラッパークラス
 * projectPathとexcludedPathを保持し、関数呼び出しを簡潔にします
 */
export class Core {
  private projectPath: string
  private excludedPath: string[]

  constructor(projectPath: string, excludedPath: string[]) {
    this.projectPath = projectPath
    this.excludedPath = excludedPath
  }

  async directoryTree(path: string, exclude: string[]) {
    return await directoryTreeCore(
      path,
      exclude,
      this.projectPath,
      this.excludedPath,
    )
  }

  async createDirectory(path: string) {
    return await createDirectoryCore(path, this.projectPath, this.excludedPath)
  }

  async removeDirectory(path: string) {
    return await removeDirectoryCore(path, this.projectPath, this.excludedPath)
  }

  async listFiles(path: string, filter: string = '') {
    return await listFilesCore(
      path,
      this.projectPath,
      this.excludedPath,
      filter,
    )
  }

  async findInFile(path: string, pattern: string, options: GrepOptions = {}) {
    return await findInFileCore(
      path,
      pattern,
      this.projectPath,
      this.excludedPath,
      options,
    )
  }

  async projectGrep(pattern: string, options: DirectoryGrepOptionsInput = {}) {
    return await projectGrepCore(
      pattern,
      this.projectPath,
      this.excludedPath,
      options,
    )
  }

  async readFile(path: string, options: ReadFileOptions = {}) {
    return await readFileCore(
      path,
      this.projectPath,
      this.excludedPath,
      options,
    )
  }

  async writeFile(path: string, content: string) {
    return await writeFileCore(
      path,
      content,
      this.projectPath,
      this.excludedPath,
    )
  }

  async deleteFile(path: string) {
    return await deleteFileCore(path, this.projectPath, this.excludedPath)
  }

  async fileMoveOrRename(srcPath: string, distPath: string) {
    return await fileMoveOrRenameCore(
      srcPath,
      distPath,
      this.projectPath,
      this.excludedPath,
    )
  }

  async mulchInsertLinesInFile(
    path: string,
    editlines: MulchInsertLines[],
    afterMode: boolean = false,
  ) {
    return await mulchInsertLinesInFileCore(
      path,
      editlines,
      this.projectPath,
      this.excludedPath,
      afterMode,
    )
  }

  async mulchEditLinesInFile(
    path: string,
    editlines: MulchEditLines[],
    previewFlg: boolean = true,
  ) {
    return await mulchEditLinesInFileCore(
      path,
      editlines,
      this.projectPath,
      this.excludedPath,
      previewFlg,
    )
  }

  async mulchDeleteLinesInFile(
    path: string,
    editlines: MulchLines[],
  ): Promise<string> {
    return await mulchDeleteLinesInFileCore(
      path,
      editlines,
      this.projectPath,
      this.excludedPath,
    )
  }

  async runScript(name: string, scriptCmd: string) {
    return await runScriptCore(name, scriptCmd, this.projectPath)
  }
}
