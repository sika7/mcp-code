import { CallToolResult, TextContent } from "@modelcontextprotocol/sdk/types";

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

export function createMpcResponse(
  text: string | TextContent[],
  metadata?: Record<string, any>,
): CallToolResult {
  // Convert string to proper content format if needed
  const content: TextContent[] =
    typeof text === "string" ? [{ type: "text", text }] : text;

  // Create the response object
  const response: CallToolResult = {
    content,
    ...(metadata ? { metadata } : {}),
  };

  return response;
}

export function createMpcErrorResponse(
  text: string | TextContent[],
  errorCode?: string,
  metadata?: Record<string, any>,
): CallToolResult {
  // Convert string to proper content format if needed
  const content: TextContent[] =
    typeof text === "string" ? [{ type: "text", text }] : text;

  // Create the response object
  const response: CallToolResult = {
    content,
    isError: true,
    ...(errorCode && { errorCode }),
    ...(metadata ? { metadata } : {}),
  };

  return response;
}
