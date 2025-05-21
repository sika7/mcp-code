import { readTextFile, writeTextFile } from "./files.js";
import { createSystemLogger } from "./logs.js";

const log = createSystemLogger({});

/**
 * ファイルの特定行範囲を安全に編集する関数
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
  try {
    // ファイルの内容を読み込む
    const content = await readTextFile(filePath);
    
    // 改行コードを検出
    const eol = content.includes("\r\n") ? "\r\n" : "\n";
    const lines = content.split(eol);
    
    // 行番号のバリデーション
    if (startLine < 1 || startLine > lines.length + 1) {
      throw new Error(
        `Start line number out of range: ${startLine} (file has ${lines.length} lines)`
      );
    }
    
    if (endLine < startLine || endLine > lines.length) {
      throw new Error(
        `End line number out of range: ${endLine} (file has ${lines.length} lines)`
      );
    }
    
    // 新しい内容を改行で分割
    const newLines = newContent.split(/\r?\n/);
    
    // 指定範囲の行を置換
    lines.splice(startLine - 1, endLine - startLine + 1, ...newLines);
    
    // ファイルに書き戻す
    await writeTextFile(filePath, lines.join(eol));
    
    log({
      logLevel: "INFO",
      message: `Successfully edited lines ${startLine}-${endLine} in ${filePath}`,
    });
    
    return `Successfully edited lines ${startLine}-${endLine} in ${filePath}`;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log({
      logLevel: "ERROR",
      message: `Error editing lines: ${errorMsg}`,
    });
    throw new Error(`Failed to edit lines in ${filePath}: ${errorMsg}`);
  }
}

/**
 * ファイルの特定行を安全に削除する関数
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
  try {
    // ファイルの内容を読み込む
    const content = await readTextFile(filePath);
    
    // 改行コードを検出
    const eol = content.includes("\r\n") ? "\r\n" : "\n";
    const lines = content.split(eol);
    
    // 行番号のバリデーション
    if (startLine < 1 || startLine > lines.length) {
      throw new Error(
        `Start line number out of range: ${startLine} (file has ${lines.length} lines)`
      );
    }
    
    if (endLine < startLine || endLine > lines.length) {
      throw new Error(
        `End line number out of range: ${endLine} (file has ${lines.length} lines)`
      );
    }
    
    // 指定範囲の行を削除
    lines.splice(startLine - 1, endLine - startLine + 1);
    
    // ファイルに書き戻す
    await writeTextFile(filePath, lines.join(eol));
    
    const message = startLine === endLine
      ? `Successfully deleted line ${startLine} from ${filePath}`
      : `Successfully deleted lines ${startLine}-${endLine} from ${filePath}`;
    
    log({
      logLevel: "INFO",
      message: message,
    });
    
    return message;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log({
      logLevel: "ERROR",
      message: `Error deleting lines: ${errorMsg}`,
    });
    throw new Error(`Failed to delete lines in ${filePath}: ${errorMsg}`);
  }
}
