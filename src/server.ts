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

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { createRequestErrorLogger, createSystemLogger } from "./logs.js";
import { runScript } from "./script.js";
import {
  deleteFile,
  fileMoveOrRename,
  generateDirectoryTree,
  insertLine,
  listFiles,
  parseFileContent,
  readTextFile,
  writeTextFile,
} from "./files.js";
import { safeEditLines, safeDeleteLines } from "./safe-edit.js";
import {
  convertToRelativePaths,
  generateRequestId,
  isExcluded,
  resolveSafeProjectPath,
} from "./util.js";
import { createMpcErrorResponse, createMpcResponse } from "./mpc.js";
import { createDirectory, removeDirectory } from "./directory.js";

try {
  const config = loadConfig({});
  const requestLog = createRequestErrorLogger({ logFilePath: config.log_path });

  const currentProjectName = config.current_project;
  const currentProject = config.projects[currentProjectName];

  // MCP サーバーのインスタンスを作成
  const server = new McpServer({
    name: "mcp-code",
    version: "1.0.0",
  });

  const globalExcludedFiles = config.excluded_files;

  let allExcludedFiles: string[] = [];
  if (globalExcludedFiles) {
    // globalなexcluded_filesが設定されてればマージ
    allExcludedFiles = [...globalExcludedFiles];
  }

  if (currentProject.excluded_files) {
    // excluded_filesが設定されてればマージ
    allExcludedFiles = [...allExcludedFiles, ...currentProject.excluded_files];
  }

  const isExcludedFiles = (filePath: string) => {
    // 除外ファイルをチェック
    if (isExcluded(filePath, allExcludedFiles)) return true;

    return false;
  };

  server.tool(
    "directoryTree",
    "プロジェクトのファイルをツリー表示する. exclude: glob風のパターン",
    {
      path: z.string(),
      exclude: z.string(),
      requestId: z.string().optional(),
    },
    async ({ path, exclude, requestId }) => {
      const finalRequestId = requestId || generateRequestId();

      // プロジェクトルートのパスに丸める
      const safeFilePath = resolveSafeProjectPath(path, currentProject.src);

      if (isExcludedFiles(safeFilePath)) {
        return createMpcErrorResponse(
          "指定されたパスはツールにより制限されています",
          "PERMISSION_DENIED",
        );
      }

      try {
        const mergeExcluded = [...allExcludedFiles, ...exclude.split(",")];
        const log = createSystemLogger({});
        log({ logLevel: "INFO", message: "除外パターン", data: mergeExcluded });
        const tree = await generateDirectoryTree(safeFilePath, {
          exclude: mergeExcluded,
        });
        // 相対パスにして返す。
        const result = convertToRelativePaths(tree, currentProject.src);
        return await createMpcResponse(result, {}, finalRequestId);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        requestLog(500, errorMsg, currentProjectName, "-", finalRequestId);
        return createMpcErrorResponse(errorMsg, "500", finalRequestId);
      }
    },
  );

  server.tool(
    "createDirectory",
    "ディレクトリを作成する.",
    {
      filePath: z.string(),
      requestId: z.string().optional(),
    },
    async ({ filePath, requestId }) => {
      const finalRequestId = requestId || generateRequestId();

      // プロジェクトルートのパスに丸める
      const safeFilePath = resolveSafeProjectPath(filePath, currentProject.src);

      if (isExcludedFiles(safeFilePath)) {
        return createMpcErrorResponse(
          "指定されたファイルはツールにより制限されています",
          "PERMISSION_DENIED",
        );
      }

      try {
        const result = await createDirectory(safeFilePath);
        return await createMpcResponse(result);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        requestLog(500, errorMsg, currentProjectName, "-", finalRequestId);
        return createMpcErrorResponse(errorMsg, "500", finalRequestId);
      }
    },
  );

  server.tool(
    "removeDirectory",
    "ディレクトリを削除する.",
    {
      filePath: z.string(),
      requestId: z.string().optional(),
    },
    async ({ filePath, requestId }) => {
      const finalRequestId = requestId || generateRequestId();

      // プロジェクトルートのパスに丸める
      const safeFilePath = resolveSafeProjectPath(filePath, currentProject.src);

      if (isExcludedFiles(safeFilePath)) {
        return createMpcErrorResponse(
          "指定されたファイルはツールにより制限されています",
          "PERMISSION_DENIED",
        );
      }

      try {
        const result = await removeDirectory(safeFilePath);
        return await createMpcResponse(result);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        requestLog(500, errorMsg, currentProjectName, "-", finalRequestId);
        return createMpcErrorResponse(errorMsg, "500", finalRequestId);
      }
    },
  );

  server.tool(
    "fileList",
    "指定ディレクトリのファイル一覧を取得する. filter: regex",
    {
      path: z.string(),
      filter: z.string().optional(),
      requestId: z.string().optional(),
    },
    async ({ path, filter, requestId }) => {
      const finalRequestId = requestId || generateRequestId();

      // プロジェクトルートのパスに丸める
      const safeFilePath = resolveSafeProjectPath(path, currentProject.src);

      if (isExcludedFiles(safeFilePath)) {
        return createMpcErrorResponse(
          "指定されたファイルはツールにより制限されています",
          "PERMISSION_DENIED",
        );
      }

      try {
        const files = await listFiles(safeFilePath, filter);
        // 許可されたファイルのみ表示
        const items = files.filter((item) => !isExcludedFiles(item));

        // 相対パスにして返す。
        const result = convertToRelativePaths(
          items.join("\n"),
          currentProject.src,
        );
        return await createMpcResponse(result, {}, finalRequestId);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        requestLog(500, errorMsg, currentProjectName, "-", finalRequestId);
        return createMpcErrorResponse(errorMsg, "500", finalRequestId);
      }
    },
  );

  server.tool(
    "fileReed",
    "指定ファイルの内容を返す.",
    { filePath: z.string(), requestId: z.string().optional() },
    async ({ filePath, requestId }) => {
      const finalRequestId = requestId || generateRequestId();

      // プロジェクトルートのパスに丸める
      const safeFilePath = resolveSafeProjectPath(filePath, currentProject.src);

      if (isExcludedFiles(safeFilePath)) {
        return createMpcErrorResponse(
          "指定されたファイルはツールにより制限されています",
          "PERMISSION_DENIED",
        );
      }

      try {
        const content = await readTextFile(safeFilePath);
        const lines = parseFileContent(content);

        return await createMpcResponse(
          content,
          {
            lines: lines,
          },
          finalRequestId,
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return createMpcErrorResponse(errorMsg, "500", finalRequestId);
      }
    },
  );

  server.tool(
    "fileWrite",
    "指定ファイルに書き込む.",
    {
      filePath: z.string(),
      content: z.string(),
      requestId: z.string().optional(),
    },
    async ({ filePath, content, requestId }) => {
      const finalRequestId = requestId || generateRequestId();

      // プロジェクトルートのパスに丸める
      const safeFilePath = resolveSafeProjectPath(filePath, currentProject.src);

      if (isExcludedFiles(safeFilePath)) {
        return createMpcErrorResponse(
          "指定されたファイルはツールにより制限されています",
          "PERMISSION_DENIED",
        );
      }

      try {
        const message = await writeTextFile(safeFilePath, content);
        // 相対パスにして返す。
        const result = convertToRelativePaths(message, currentProject.src);
        return await createMpcResponse(result);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        requestLog(500, errorMsg, currentProjectName, "-", finalRequestId);
        return createMpcErrorResponse(errorMsg, "500", finalRequestId);
      }
    },
  );

  server.tool(
    "fileDelete",
    "指定ファイルを削除.",
    {
      filePath: z.string(),
      requestId: z.string().optional(),
    },
    async ({ filePath, requestId }) => {
      // リクエストIDがない場合はランダムなIDを生成
      const finalRequestId = requestId || generateRequestId();

      // プロジェクトルートのパスに丸める
      const safeFilePath = resolveSafeProjectPath(filePath, currentProject.src);

      if (isExcludedFiles(safeFilePath)) {
        return createMpcErrorResponse(
          "指定されたファイルはツールにより制限されています",
          "PERMISSION_DENIED",
        );
      }

      try {
        const message = await deleteFile(safeFilePath);
        return await createMpcResponse(message);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        requestLog(500, errorMsg, currentProjectName, "-", finalRequestId);
        return createMpcErrorResponse(errorMsg, "500", finalRequestId);
      }
    },
  );

  server.tool(
    "fileMoveOrRename",
    "指定ファイルをコピー.",
    {
      srcPath: z.string(),
      distPath: z.string(),
      requestId: z.string().optional(),
    },
    async ({ srcPath, distPath, requestId }) => {
      // リクエストIDがない場合はランダムなIDを生成
      const finalRequestId = requestId || generateRequestId();

      // プロジェクトルートのパスに丸める
      const safeSrcPath = resolveSafeProjectPath(srcPath, currentProject.src);
      const safeDistPath = resolveSafeProjectPath(distPath, currentProject.src);

      if (isExcludedFiles(safeSrcPath) || isExcludedFiles(safeDistPath)) {
        return createMpcErrorResponse(
          "指定されたファイルはツールにより制限されています",
          "PERMISSION_DENIED",
        );
      }

      try {
        const message = await fileMoveOrRename(safeSrcPath, safeDistPath);
        return await createMpcResponse(message);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        requestLog(500, errorMsg, currentProjectName, "-", finalRequestId);
        return createMpcErrorResponse(errorMsg, "500", finalRequestId);
      }
    },
  );

  server.tool(
    "fileInsertLine",
    "指定ファイルの指定行に追記する. 行番号指定のため複数回同じファイルに使用する際は逆順で編集しないとズレる",
    {
      filePath: z.string(),
      lineNumber: z.number(),
      content: z.string(),
      requestId: z.string().optional(),
    },
    async ({ filePath, lineNumber, content, requestId }) => {
      const finalRequestId = requestId || generateRequestId();

      // プロジェクトルートのパスに丸める
      const safeFilePath = resolveSafeProjectPath(filePath, currentProject.src);

      if (isExcludedFiles(safeFilePath)) {
        return createMpcErrorResponse(
          "指定されたファイルはツールにより制限されています",
          "PERMISSION_DENIED",
        );
      }

      try {
        const message = await insertLine(safeFilePath, lineNumber, content);
        return await createMpcResponse(message);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        requestLog(500, errorMsg, currentProjectName, "-", finalRequestId);
        return createMpcErrorResponse(errorMsg, "500", finalRequestId);
      }
    },
  );

  server.tool(
    "fileEditLines",
    "指定ファイルの指定行を編集する. startLine = endLineで一行のみ編集.行番号指定のため複数回同じファイルに使用する際は逆順で編集しないとズレる",
    {
      filePath: z.string(),
      startLine: z.number(),
      endLine: z.number(),
      content: z.string(),
      requestId: z.string().optional(),
    },
    async ({ filePath, startLine, endLine, content, requestId }) => {
      const finalRequestId = requestId || generateRequestId();

      // プロジェクトルートのパスに丸める
      const safeFilePath = resolveSafeProjectPath(filePath, currentProject.src);

      if (isExcludedFiles(safeFilePath)) {
        return createMpcErrorResponse(
          "指定されたファイルはツールにより制限されています",
          "PERMISSION_DENIED",
        );
      }

      try {
        // バグがある元のeditLines関数の代わりに、安全なsafeEditLines関数を使用
        const message = await safeEditLines(
          safeFilePath,
          startLine,
          endLine,
          content,
        );
        return await createMpcResponse(message);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        requestLog(500, errorMsg, currentProjectName, "-", finalRequestId);
        return createMpcErrorResponse(errorMsg, "500", finalRequestId);
      }
    },
  );

  server.tool(
    "fileDeleteLines",
    "指定ファイルの特定行を削除する.行番号指定のため複数回同じファイルに使用する際は逆順で編集しないとズレる",
    {
      filePath: z.string(),
      startLine: z.number(),
      endLine: z.number(),
      requestId: z.string().optional(),
    },
    async ({ filePath, startLine, endLine, requestId }) => {
      const finalRequestId = requestId || generateRequestId();

      // プロジェクトルートのパスに丸める
      const safeFilePath = resolveSafeProjectPath(filePath, currentProject.src);

      if (isExcludedFiles(safeFilePath)) {
        return createMpcErrorResponse(
          "指定されたファイルはツールにより制限されています",
          "PERMISSION_DENIED",
        );
      }

      try {
        // バグがある元のdeleteLines関数の代わりに、安全なsafeDeleteLines関数を使用
        const message = await safeDeleteLines(safeFilePath, startLine, endLine);
        return await createMpcResponse(message);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        requestLog(500, errorMsg, currentProjectName, "-", finalRequestId);
        return createMpcErrorResponse(errorMsg, "500", finalRequestId);
      }
    },
  );

  Object.keys(currentProject.scripts).map((name) => {
    const scriptCmd = currentProject.scripts[name];
    server.tool(
      `script_${name}`,
      `ユーザー指定のスクリプト. ${scriptCmd}`,
      {
        requestId: z.string().optional(),
      },
      async ({ requestId }) => {
        // リクエストIDがない場合はランダムなIDを生成
        const finalRequestId = requestId || generateRequestId();

        requestLog(
          200,
          `スクリプト実行開始: ${name}`,
          currentProjectName,
          "-",
          finalRequestId,
        );

        try {
          const result = await runScript(name, scriptCmd, currentProject.src);

          return await createMpcResponse(result);
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          requestLog(500, errorMsg, currentProjectName, "-", finalRequestId);
          return createMpcErrorResponse(errorMsg, "500", finalRequestId);
        }
      },
    );
  });

  // STDIO トランスポートでサーバーを開始
  const transport = new StdioServerTransport();
  await server.connect(transport);
} catch (error) {
  if (error instanceof Error) {
    const errorLog = createSystemLogger({});
    errorLog({
      logLevel: "ERROR",
      message: error.message,
      data: error.stack,
    });
  }
}
