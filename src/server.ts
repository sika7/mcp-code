/**
 * Copyright 2025 MCP-Code Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

import { loadConfig } from './config.js'
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
  mulchEditLines,
  mulchInsertLines,
  readTextFileWithOptions,
  writeTextFile,
} from './files.js'
import { createRequestErrorLogger, createSystemLogger } from './logs.js'
import {
  arrayToTextContent,
  createMpcErrorResponse,
  createMpcResponse,
} from './mpc.js'
import { runScript } from './core/script.js'
import {
  DirectoryGrepOptionsSchema,
  fileGrep,
  FileGrepArgs,
  FileGrepOptionsSchema,
  projectGrep,
  ProjectGrepArgs,
} from './serch.js'
import {
  convertToRelativePaths,
  generateRequestId,
  isExcluded,
  resolveSafeProjectPath,
} from './util.js'

try {
  const config = loadConfig({})
  const requestLog = createRequestErrorLogger(config.log_path)

  const currentProjectName = config.current_project
  const currentProject = config.projects[currentProjectName]

  // MCP サーバーのインスタンスを作成
  const server = new McpServer({
    name: 'mcp-code',
    version: '1.0.0',
  })

  const globalExcludedFiles = config.excluded_files

  let allExcludedFiles: string[] = []
  if (globalExcludedFiles) {
    // globalなexcluded_filesが設定されてればマージ
    allExcludedFiles = [...globalExcludedFiles]
  }

  if (currentProject.excluded_files) {
    // excluded_filesが設定されてればマージ
    allExcludedFiles = [...allExcludedFiles, ...currentProject.excluded_files]
  }

  const isExcludedFiles = (filePath: string) => {
    // 除外ファイルをチェック
    if (isExcluded(filePath, allExcludedFiles)) return true

    return false
  }

  server.tool(
    'directoryTree',
    'プロジェクトのファイルをツリー表示する.',
    {
      path: z
        .string()
        .min(1)
        .default('/')
        .describe('表示したいディレクトリパスを指定'),
      exclude: z.string().default('').describe('glob風のパターン'),
      requestId: z.string().optional().describe('リクエストID'),
    },
    async ({ path, exclude, requestId }) => {
      const finalRequestId = requestId || generateRequestId()

      // プロジェクトルートのパスに丸める
      const safeFilePath = resolveSafeProjectPath(path, currentProject.src)

      if (isExcludedFiles(safeFilePath)) {
        return createMpcErrorResponse(
          '指定されたパスはツールにより制限されています',
          'PERMISSION_DENIED',
        )
      }

      try {
        const mergeExcluded = [...allExcludedFiles, ...exclude.split(',')]
        const log = createSystemLogger()
        log({ logLevel: 'INFO', message: '除外パターン', data: mergeExcluded })
        const tree = await generateDirectoryTree(safeFilePath, {
          exclude: mergeExcluded,
        })
        // 相対パスにして返す。
        const result = convertToRelativePaths(tree, currentProject.src)
        return await createMpcResponse(result, {}, finalRequestId)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        requestLog(500, errorMsg, currentProjectName, '-', finalRequestId)
        return createMpcErrorResponse(errorMsg, '500', finalRequestId)
      }
    },
  )

  server.tool(
    'createDirectory',
    'ディレクトリを作成する.',
    {
      filePath: z.string().min(1).describe('作成したいディレクトリパスを指定'),
      requestId: z.string().optional().describe('リクエストID'),
    },
    async ({ filePath, requestId }) => {
      const finalRequestId = requestId || generateRequestId()

      // プロジェクトルートのパスに丸める
      const safeFilePath = resolveSafeProjectPath(filePath, currentProject.src)

      if (isExcludedFiles(safeFilePath)) {
        return createMpcErrorResponse(
          '指定されたファイルはツールにより制限されています',
          'PERMISSION_DENIED',
        )
      }

      try {
        const result = await createDirectory(safeFilePath)
        return await createMpcResponse(result)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        requestLog(500, errorMsg, currentProjectName, '-', finalRequestId)
        return createMpcErrorResponse(errorMsg, '500', finalRequestId)
      }
    },
  )

  server.tool(
    'removeDirectory',
    'ディレクトリを削除する.',
    {
      filePath: z.string().min(1).describe('削除したいディレクトリパスを指定'),
      requestId: z.string().optional().describe('リクエストID'),
    },
    async ({ filePath, requestId }) => {
      const finalRequestId = requestId || generateRequestId()

      // プロジェクトルートのパスに丸める
      const safeFilePath = resolveSafeProjectPath(filePath, currentProject.src)

      if (isExcludedFiles(safeFilePath)) {
        return createMpcErrorResponse(
          '指定されたファイルはツールにより制限されています',
          'PERMISSION_DENIED',
        )
      }

      try {
        const result = await removeDirectory(safeFilePath)
        return await createMpcResponse(result)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        requestLog(500, errorMsg, currentProjectName, '-', finalRequestId)
        return createMpcErrorResponse(errorMsg, '500', finalRequestId)
      }
    },
  )

  server.tool(
    'fileList',
    '指定ディレクトリのファイル一覧を取得する.',
    {
      path: z
        .string()
        .min(1)
        .default('/')
        .describe('表示したいディレクトリパスを指定'),
      filter: z.string().optional().describe('regex'),
      requestId: z.string().optional().describe('リクエストID'),
    },
    async ({ path, filter, requestId }) => {
      const finalRequestId = requestId || generateRequestId()

      // プロジェクトルートのパスに丸める
      const safeFilePath = resolveSafeProjectPath(path, currentProject.src)

      if (isExcludedFiles(safeFilePath)) {
        return createMpcErrorResponse(
          '指定されたファイルはツールにより制限されています',
          'PERMISSION_DENIED',
        )
      }

      try {
        const files = await listFiles(safeFilePath, filter)
        // 許可されたファイルのみ表示
        const items = files.filter(item => !isExcludedFiles(item))

        // 相対パスにして返す。
        const result = convertToRelativePaths(
          items.join('\n'),
          currentProject.src,
        )
        return await createMpcResponse(result, {}, finalRequestId)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        requestLog(500, errorMsg, currentProjectName, '-', finalRequestId)
        return createMpcErrorResponse(errorMsg, '500', finalRequestId)
      }
    },
  )

  server.tool(
    'findInFile',
    'ファイルから探す. Grep',
    {
      filePath: z.string().min(1).describe('検索対象のファイルパスを指定'),
      pattern: z
        .string()
        .min(1)
        .describe('検索する文字列または正規表現パターン'),
      options: FileGrepOptionsSchema.optional().describe('検索オプション'),
      requestId: z.string().optional().describe('リクエストID'),
    },
    async (arg: FileGrepArgs) => {
      const finalRequestId = arg.requestId || generateRequestId()

      // プロジェクトルートのパスに丸める
      const safeFilePath = resolveSafeProjectPath(
        arg.filePath,
        currentProject.src,
      )

      if (isExcludedFiles(safeFilePath)) {
        return createMpcErrorResponse(
          '指定されたファイルはツールにより制限されています',
          'PERMISSION_DENIED',
        )
      }

      try {
        const findResult = await fileGrep(
          safeFilePath,
          arg.pattern,
          arg.options,
        )

        const text = JSON.stringify(findResult, null, 2)
        // 相対パスにして返す。
        const result = convertToRelativePaths(text, currentProject.src)

        return await createMpcResponse(result, {}, finalRequestId)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        requestLog(500, errorMsg, currentProjectName, '-', finalRequestId)
        return createMpcErrorResponse(errorMsg, '500', finalRequestId)
      }
    },
  )

  server.tool(
    'projectGrep',
    'プロジェクトから探す. Grep',
    {
      pattern: z
        .string()
        .min(1)
        .describe('検索する文字列または正規表現パターン'),
      options: DirectoryGrepOptionsSchema.optional().describe('検索オプション'),
      requestId: z.string().optional().describe('リクエストID'),
    },
    async (arg: ProjectGrepArgs) => {
      const finalRequestId = arg.requestId || generateRequestId()

      try {
        // プロジェクトルートのパスに丸める
        const safeFilePath = resolveSafeProjectPath('/', currentProject.src)
        const findResult = await projectGrep(
          safeFilePath,
          arg.pattern,
          arg.options,
        )

        // 除外指定ファイルは見えないようにする
        findResult.results = findResult.results.filter(
          item => !isExcludedFiles(item.filePath),
        )

        const text = JSON.stringify(findResult, null, 2)
        // 相対パスにして返す。
        const result = convertToRelativePaths(text, currentProject.src)

        return await createMpcResponse(result, {}, finalRequestId)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        requestLog(500, errorMsg, currentProjectName, '-', finalRequestId)
        return createMpcErrorResponse(errorMsg, '500', finalRequestId)
      }
    },
  )

  server.tool(
    'fileReed',
    '指定ファイルの内容を返す.',
    {
      filePath: z.string().min(1).describe('読み込みたいファイルのパスを指定'),
      showLineNumbers: z.boolean().default(true).describe('行番号を表示する'),
      startLine: z.number().default(1).describe('表示開始行（1ベース）'),
      endLine: z.number().optional().describe('表示終了行（1ベース）'),
      maxLines: z.number().optional().describe('最大表示行数'),
      requestId: z
        .string()
        .default(generateRequestId())
        .describe('リクエストID'),
    },
    async ({
      filePath,
      showLineNumbers,
      startLine,
      endLine,
      maxLines,
      requestId,
    }) => {
      const finalRequestId = requestId || generateRequestId()

      // プロジェクトルートのパスに丸める
      const safeFilePath = resolveSafeProjectPath(filePath, currentProject.src)

      if (isExcludedFiles(safeFilePath)) {
        return createMpcErrorResponse(
          '指定されたファイルはツールにより制限されています',
          'PERMISSION_DENIED',
        )
      }

      try {
        const { content, metadata } = await readTextFileWithOptions(
          safeFilePath,
          { showLineNumbers, startLine, endLine, maxLines },
        )

        return await createMpcResponse(
          content,
          {
            ...metadata,
          },
          finalRequestId,
        )
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        return createMpcErrorResponse(errorMsg, '500', finalRequestId)
      }
    },
  )

  server.tool(
    'fileWrite',
    '指定ファイルに書き込む.',
    {
      filePath: z
        .string()
        .min(1)
        .describe('書き込みしたいファイルのパスを指定'),
      content: z.string().describe('ファイルの内容'),
      requestId: z.string().optional().describe('リクエストID'),
    },
    async ({ filePath, content, requestId }) => {
      const finalRequestId = requestId || generateRequestId()

      // プロジェクトルートのパスに丸める
      const safeFilePath = resolveSafeProjectPath(filePath, currentProject.src)

      if (isExcludedFiles(safeFilePath)) {
        return createMpcErrorResponse(
          '指定されたファイルはツールにより制限されています',
          'PERMISSION_DENIED',
        )
      }

      try {
        const message = await writeTextFile(safeFilePath, content)
        // 相対パスにして返す。
        const result = convertToRelativePaths(message, currentProject.src)
        return await createMpcResponse(result)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        requestLog(500, errorMsg, currentProjectName, '-', finalRequestId)
        return createMpcErrorResponse(errorMsg, '500', finalRequestId)
      }
    },
  )

  server.tool(
    'fileDelete',
    '指定ファイルを削除.',
    {
      filePath: z.string().min(1).describe('削除したいファイルのパスを指定'),
      requestId: z.string().optional().describe('リクエストID'),
    },
    async ({ filePath, requestId }) => {
      // リクエストIDがない場合はランダムなIDを生成
      const finalRequestId = requestId || generateRequestId()

      // プロジェクトルートのパスに丸める
      const safeFilePath = resolveSafeProjectPath(filePath, currentProject.src)

      if (isExcludedFiles(safeFilePath)) {
        return createMpcErrorResponse(
          '指定されたファイルはツールにより制限されています',
          'PERMISSION_DENIED',
        )
      }

      try {
        const message = await deleteFile(safeFilePath)
        const result = convertToRelativePaths(message, currentProject.src)
        return await createMpcResponse(result)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        requestLog(500, errorMsg, currentProjectName, '-', finalRequestId)
        return createMpcErrorResponse(errorMsg, '500', finalRequestId)
      }
    },
  )

  server.tool(
    'fileMoveOrRename',
    '指定ファイルをコピー.',
    {
      srcPath: z.string().min(1).describe('コピーしたいファイルのパスを指定'),
      distPath: z.string().min(1).describe('コピー先のパスを指定'),
      requestId: z.string().optional().describe('リクエストID'),
    },
    async ({ srcPath, distPath, requestId }) => {
      // リクエストIDがない場合はランダムなIDを生成
      const finalRequestId = requestId || generateRequestId()

      // プロジェクトルートのパスに丸める
      const safeSrcPath = resolveSafeProjectPath(srcPath, currentProject.src)
      const safeDistPath = resolveSafeProjectPath(distPath, currentProject.src)

      if (isExcludedFiles(safeSrcPath) || isExcludedFiles(safeDistPath)) {
        return createMpcErrorResponse(
          '指定されたファイルはツールにより制限されています',
          'PERMISSION_DENIED',
        )
      }

      try {
        const message = await fileMoveOrRename(safeSrcPath, safeDistPath)
        const result = convertToRelativePaths(message, currentProject.src)
        return await createMpcResponse(result)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        requestLog(500, errorMsg, currentProjectName, '-', finalRequestId)
        return createMpcErrorResponse(errorMsg, '500', finalRequestId)
      }
    },
  )

  server.tool(
    'insertLinesInFile',
    '指定ファイルの指定行に複数追記する. ',
    {
      filePath: z.string().min(1).describe('編集したいファイルのパスを指定'),
      editlines: z.array(
        z.object({
          lineNumber: z
            .number()
            .min(1)
            .default(1)
            .describe('編集したい行番号(1ベース)'),
          content: z.string().describe('追記する内容'),
        }),
      ),
      afterMode: z.boolean().default(false).describe('指定行より後に追加'),
      requestId: z
        .string()
        .default(generateRequestId())
        .describe('リクエストID'),
    },
    async ({ filePath, editlines, afterMode, requestId }) => {
      const finalRequestId = requestId || generateRequestId()

      // プロジェクトルートのパスに丸める
      const safeFilePath = resolveSafeProjectPath(filePath, currentProject.src)

      if (isExcludedFiles(safeFilePath)) {
        return createMpcErrorResponse(
          '指定されたファイルはツールにより制限されています',
          'PERMISSION_DENIED',
        )
      }

      try {
        const message = await mulchInsertLines(
          safeFilePath,
          editlines,
          afterMode,
        )
        const result = convertToRelativePaths(message, currentProject.src)
        return await createMpcResponse(
          `${result} もう一度このツールを同じファイルに使用する場合は行番号がずれているため再度ファイルを読み込み直してください。`,
        )
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        requestLog(500, errorMsg, currentProjectName, '-', finalRequestId)
        return createMpcErrorResponse(errorMsg, '500', finalRequestId)
      }
    },
  )

  server.tool(
    'editLinesInFile',
    '指定ファイルの指定行を複数編集する. startLine = endLineで一行のみ編集.',
    {
      filePath: z.string().min(1).describe('編集したいファイルのパスを指定'),
      editlines: z.array(
        z.object({
          startLine: z
            .number()
            .min(1)
            .default(1)
            .describe('編集したい行番号(1ベース)'),
          endLine: z
            .number()
            .min(1)
            .default(1)
            .describe('編集したい行番号(1ベース)'),
          content: z.string().describe('編集する内容.'),
        }),
      ),
      preview: z
        .boolean()
        .default(true)
        .describe('プレビュー表示する？プレビュー表示は保存されません。'),
      requestId: z
        .string()
        .default(generateRequestId())
        .describe('リクエストID'),
    },
    async ({ filePath, editlines, preview, requestId }) => {
      const finalRequestId = requestId || generateRequestId()

      // プロジェクトルートのパスに丸める
      const safeFilePath = resolveSafeProjectPath(filePath, currentProject.src)

      if (isExcludedFiles(safeFilePath)) {
        return createMpcErrorResponse(
          '指定されたファイルはツールにより制限されています',
          'PERMISSION_DENIED',
        )
      }

      try {
        const { message, content } = await mulchEditLines(
          safeFilePath,
          editlines,
          preview,
        )
        const result = convertToRelativePaths(message, currentProject.src)
        const msg = preview
          ? '保存するには preview: false で再度、実行してください'
          : 'もう一度このツールを同じファイルに使用する場合は行番号がずれているため再度ファイルを読み込み直してください。'
        const textContent = arrayToTextContent([`${result} ${msg}`, content])
        return await createMpcResponse(textContent, {}, finalRequestId)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        requestLog(500, errorMsg, currentProjectName, '-', finalRequestId)
        return createMpcErrorResponse(errorMsg, '500', finalRequestId)
      }
    },
  )

  server.tool(
    'deleteLinesInFile',
    '指定ファイルの特定行を複数削除する.',
    {
      filePath: z.string().min(1).describe('編集したいファイルのパスを指定'),
      editlines: z.array(
        z.object({
          startLine: z
            .number()
            .min(1)
            .default(1)
            .describe('削除したい行番号(1ベース)'),
          endLine: z
            .number()
            .min(1)
            .default(1)
            .describe('削除したい行番号(1ベース)'),
        }),
      ),
      requestId: z
        .string()
        .default(generateRequestId())
        .describe('リクエストID'),
    },
    async ({ filePath, editlines, requestId }) => {
      const finalRequestId = requestId || generateRequestId()

      // プロジェクトルートのパスに丸める
      const safeFilePath = resolveSafeProjectPath(filePath, currentProject.src)

      if (isExcludedFiles(safeFilePath)) {
        return createMpcErrorResponse(
          '指定されたファイルはツールにより制限されています',
          'PERMISSION_DENIED',
        )
      }

      try {
        const message = await mulchDeleteLines(safeFilePath, editlines)
        const result = convertToRelativePaths(message, currentProject.src)
        return await createMpcResponse(
          `${result} もう一度このツールを同じファイルに使用する場合は行番号がずれているため再度ファイルを読み込み直してください。`,
        )
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        requestLog(500, errorMsg, currentProjectName, '-', finalRequestId)
        return createMpcErrorResponse(errorMsg, '500', finalRequestId)
      }
    },
  )
  if (currentProject.scripts) {
    Object.keys(currentProject.scripts).map(name => {
      const scriptCmd = currentProject.scripts[name]
      server.tool(
        `script_${name}`,
        `ユーザー指定のスクリプト. ${scriptCmd}`,
        {
          requestId: z.string().optional().describe('リクエストID'),
        },
        async ({ requestId }) => {
          // リクエストIDがない場合はランダムなIDを生成
          const finalRequestId = requestId || generateRequestId()

          requestLog(
            200,
            `スクリプト実行開始: ${name}`,
            currentProjectName,
            '-',
            finalRequestId,
          )

          try {
            const result = await runScript(name, scriptCmd, currentProject.src)

            return await createMpcResponse(result)
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : String(error)
            requestLog(500, errorMsg, currentProjectName, '-', finalRequestId)
            return createMpcErrorResponse(errorMsg, '500', finalRequestId)
          }
        },
      )
    })
  }

  // STDIO トランスポートでサーバーを開始
  const transport = new StdioServerTransport()
  await server.connect(transport)
} catch (error) {
  if (error instanceof Error) {
    const errorLog = createSystemLogger()
    errorLog({
      logLevel: 'ERROR',
      message: error.message,
      data: error.stack,
    })
  }
}
