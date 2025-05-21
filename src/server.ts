import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { createRequestErrorLogger, createSystemLogger } from "./logs.js";
import { runScript } from "./script.js";
import { parseFileContent, readTextFile } from "./files.js";
import { isExcluded, resolveSafeProjectPath } from "./util.js";
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

  server.tool("file.reed", { filePath: z.string() }, async ({ filePath }) => {
    // プロジェクトルートのパスに丸める
    const safeFilePath = resolveSafeProjectPath(filePath, currentProject.src);

    if (isExcludedFiles(safeFilePath)) {
      return createMpcErrorResponse(
        "指定されたファイルはツールにより制限されています",
        "PERMISSION_DENIED",
      );
    }

    const content = await readTextFile(safeFilePath);
    const lines = parseFileContent(content);

    return createMpcResponse(content, {
      lines: lines,
    });
  });

  Object.keys(currentProject.scripts).map((name) => {
    server.tool(
      `script:${name}`,
      {
        request_id: z.string(),
      },
      async ({ request_id }) => {
        const scriptCmd = currentProject.scripts[name];

        requestLog(
          200,
          `スクリプト実行開始: ${name}`,
          currentProjectName,
          "-",
          request_id,
        );

        const result = (await runScript(
          name,
          scriptCmd,
          currentProject.src,
        ).catch((error) => {
          if (error instanceof Error) {
            requestLog(500, error.message, currentProjectName, "-", request_id);
          }
          return error;
        })) as string;

        requestLog(
          200,
          `スクリプト実行開始: ${result}`,
          currentProjectName,
          "-",
          request_id,
        );

        return createMpcResponse(result);
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
