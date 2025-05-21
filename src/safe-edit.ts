import { readTextFile, writeTextFile, deleteLines, editLines } from "./files.js";
import { createSystemLogger } from "./logs.js";

const log = createSystemLogger({});

/**
 * ファイルの特定行範囲を安全に編集する関数
 * files.tsのeditLinesを使用して行編集を実行
 * @param filePath 編集するファイルのパス
 * @param startLine 編集開始行 (1-indexed)
 * @param endLine 編集終了行 (1-indexed)
 * @param newContent 置き換える新しい内容
 * @returns 成功メッセージ
 */
export async function safeEditLines(
  filePath: string,
  startLine: number,
  endLine: number,
  newContent: string
): Promise<string> {
  // files.tsのeditLinesを使用（より堅牢なエラーハンドリング付き）
  return await editLines(filePath, startLine, endLine, newContent);
}

/**
 * ファイルの特定行を安全に削除する関数
 * files.tsのdeleteLinesを使用して行削除を実行
 * @param filePath 編集するファイルのパス
 * @param startLine 削除開始行 (1-indexed)
 * @param endLine 削除終了行 (1-indexed)
 * @returns 成功メッセージ
 */
export async function safeDeleteLines(
  filePath: string,
  startLine: number,
  endLine: number
): Promise<string> {
  // files.tsのdeleteLinesを使用（より堅牢なエラーハンドリング付き）
  return await deleteLines(filePath, startLine, endLine);
}
