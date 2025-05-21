import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { createRequestErrorLogger, createSystemLogger } from "./logs.js";
import { runScript } from "./script.js";
import {
  deleteFile,
  deleteLines,
  editLines,
  generateDirectoryTree,
  insertLine,
  listFiles,
  parseFileContent,
  readTextFile,
  writeTextFile,
} from "./files.js";
import {
  convertToRelativePaths,
  generateRequestId,
  isExcluded,
  resolveSafeProjectPath,
} from "./util.js";
import { createMpcErrorResponse, createMpcResponse } from "./mpc.js";

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
    "directory.tree",
    "プロジェクトのファイルをツリー表示する. exclude: glob風のパターン",
    {
      path: z.string(),
      exclude: z.array(z.string()).optional(),
      requestId: z.string(),
    },
    async ({ path, exclude = [], requestId }) => {
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
        const mergeExcluded = [...allExcludedFiles, ...exclude];
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
    "file.list",
    "指定ディレクトリのファイル一覧を取得する. filter: regex",
    { path: z.string(), filter: z.string().optional(), requestId: z.string() },
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
    "file.reed",
    "指定ファイルの内容を返す.",
    { filePath: z.string(), requestId: z.string() },
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
    "file.write",
    "指定ファイルに書き込む.",
    { filePath: z.string(), content: z.string(), requestId: z.string() },
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
        return await createMpcResponse(message);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        requestLog(500, errorMsg, currentProjectName, "-", finalRequestId);
        return createMpcErrorResponse(errorMsg, "500", finalRequestId);
      }
    },
  );

  server.tool(
    "file.delete",
    "指定ファイルを削除.",
    {
      filePath: z.string(),
      requestId: z.string(),
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
    "file.insertLine",
    "指定ファイルの指定行に追記する. ",
    {
      filePath: z.string(),
      lineNumber: z.number(),
      content: z.string(),
      requestId: z.string(),
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
    "file.editLines",
    "指定ファイルの指定行を編集する. startLine = endLineで一行のみ編集.",
    {
      filePath: z.string(),
      startLine: z.number(),
      endLine: z.number(),
      content: z.string(),
      requestId: z.string(),
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
        const message = await editLines(
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
    "file.deleteLines",
    "指定ファイルの特定行を削除する.",
    {
      filePath: z.string(),
      startLine: z.number(),
      endLine: z.number(),
      requestId: z.string(),
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
        const message = await deleteLines(safeFilePath, startLine, endLine);
        return await createMpcResponse(message);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        requestLog(500, errorMsg, currentProjectName, "-", finalRequestId);
        return createMpcErrorResponse(errorMsg, "500", finalRequestId);
      }
    },
  );

  Object.keys(currentProject.scripts).map((name) => {
    server.tool(
      `script:${name}`,
      `ユーザー指定のスクリプト. npm run buildなど.`
      {
        requestId: z.string(),
      },
      async ({ requestId }) => {
        // リクエストIDがない場合はランダムなIDを生成
        const finalRequestId = requestId || generateRequestId();

        const scriptCmd = currentProject.scripts[name];

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
