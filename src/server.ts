import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { createRequestErrorLogger, createSystemLogger } from "./logs.js";
import { runScript } from "./script.js";
import {
  deleteFile,
  listFiles,
  parseFileContent,
  readTextFile,
  writeTextFile,
} from "./files.js";
import {
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

  const isExcludedFiles = (filePath: string) => {
    if (globalExcludedFiles) {
      // globalなexcluded_filesが設定されてればチェック
      if (isExcluded(filePath, globalExcludedFiles)) return true;
    }

    if (currentProject.excluded_files) {
      // excluded_filesが設定されてればチェック
      if (isExcluded(filePath, currentProject.excluded_files)) return true;
    }

    return false;
  };

  server.tool(
    "file.list",
    "ファイル一覧を取得する. filter: regex",
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
        const result = await listFiles(safeFilePath, filter);
        // 許可されたファイルのみ表示
        const items = result.filter((item) => !isExcludedFiles(item));

        return await createMpcResponse(items.join("\n"), {}, finalRequestId);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        requestLog(500, errorMsg, currentProjectName, "-", finalRequestId);
        return createMpcErrorResponse(errorMsg, "500", finalRequestId);
      }
    },
  );

  server.tool(
    "file.reed",
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

  Object.keys(currentProject.scripts).map((name) => {
    server.tool(
      `script:${name}`,
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
