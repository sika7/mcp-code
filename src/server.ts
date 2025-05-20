import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { createRequestErrorLogger, createSystemLogger } from "./logs.js";
import { runScript } from "./script.js";

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

  // 加算ツールを追加
  server.tool(
    "add",
    "",
    { a: z.number(), b: z.number() },
    async ({ a, b }) => ({
      content: [{ type: "text", text: String(a + b) }],
    }),
  );

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

        const result = await runScript(
          name,
          scriptCmd,
          currentProject.src,
        ).catch((error) => {
          if (error instanceof Error) {
            requestLog(500, error.message, currentProjectName, "-", request_id);
          }
          return error;
        });

        requestLog(
          200,
          `スクリプト実行開始: ${result}`,
          currentProjectName,
          "-",
          request_id,
        );

        return result;
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
