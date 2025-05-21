import { CallToolResult, TextContent } from "@modelcontextprotocol/sdk/types";
import { createSystemLogger } from "./logs.js";
import { detectFileTypeWithParser } from "./data-parse.js";

// 共通のエラーコード定義
export enum MCPErrorCode {
  // 一般的なエラー
  INVALID_PARAMS = "invalid_params",
  TOOL_NOT_FOUND = "tool_not_found",
  EXECUTION_TIMEOUT = "execution_timeout",
  INTERNAL_ERROR = "internal_error",

  // ファイル操作関連エラー
  FILE_NOT_FOUND = "file_not_found",
  PERMISSION_DENIED = "permission_denied",
  FILE_ALREADY_EXISTS = "file_already_exists",
  INVALID_PATH = "invalid_path",

  // その他の操作関連エラー
  NETWORK_ERROR = "network_error",
  API_ERROR = "api_error",
  DATABASE_ERROR = "database_error",
}

export async function createMpcResponse(
  text: string | TextContent[],
  metadata?: Record<string, any>,
  requestId?: string,
  fileContent?: string | null,
): Promise<CallToolResult> {
  // Convert string to proper content format if needed
  const content: TextContent[] =
    typeof text === "string" ? [{ type: "text", text }] : text;

  const finalMetadata = {
    request_id: requestId,
    ...(metadata || {}),
  };

  let structuredContent = {};

  if (fileContent) {
    try {
      const result = await detectFileTypeWithParser(fileContent);
      structuredContent = {
        type: result.mimeType,
        json: result.parsedData,
      };
    } catch (e) {
      const log = createSystemLogger({});
      log({ logLevel: "ERROR", message: "パースに失敗しました。" });
    }
  }

  // Create the response object
  const response: CallToolResult = {
    content,
    metadata: finalMetadata,
    structuredContent,
  };

  return response;
}

export function createMpcErrorResponse(
  text: string | TextContent[],
  errorCode?: string,
  requestId?: string,
  metadata?: Record<string, any>,
): CallToolResult {
  // Convert string to proper content format if needed
  const content: TextContent[] =
    typeof text === "string" ? [{ type: "text", text }] : text;

  const finalMetadata = {
    request_id: requestId,
    ...(metadata || {}),
  };

  // Create the response object
  const response: CallToolResult = {
    content,
    metadata: finalMetadata,
    isError: true,
    ...(errorCode && { errorCode }),
  };

  return response;
}
