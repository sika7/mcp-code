import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config";
import { createRequestErrorLogger, createSystemLogger } from "./logs";
import { runScript } from "./script";

try {
  const config = loadConfig({});
  const requestLog = createRequestErrorLogger({ logFilePath: config.log_path });

  // MCP サーバーのインスタンスを作成
  const server = new McpServer({
    name: "mcp-code",
    version: "1.0.0",
  });

  // 加算ツールを追加
  server.tool(
    "add",
    "",
    { a: z.number(), b: z.number() },
    async ({ a, b }) => ({
      content: [{ type: "text", text: String(a + b) }],
    }),
  );

  server.tool(
    "run_script",
    {
      project: z.string(),
      name: z.string(),
      request_id: z.string(),
    },
    async ({ project, name, request_id }) => {
      const proj = config.projects?.[project];

      if (!proj) {
        const msg = `プロジェクトが存在しません: ${project}`;
        requestLog(404, msg, project, "-", request_id);
        throw new Error(msg);
      }

      const scriptCmd = proj.scripts?.[name];

      if (!scriptCmd) {
        const msg = `スクリプト '${name}' はプロジェクト '${project}' に定義されていません`;
        requestLog(403, msg, project, "-", request_id);
        throw new Error(msg);
      }

      requestLog(200, `スクリプト実行開始: ${name}`, project, "-", request_id);

      return runScript(name, scriptCmd, proj.src).catch((error) => {
        if (error instanceof Error) {
          requestLog(500, error.message, project, "-", request_id);
        }
        return error;
      });
    },
  );

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
