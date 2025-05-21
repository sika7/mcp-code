import fs from "fs/promises";
import path from "path";
import { createSystemLogger } from "./logs.js";
import { existsSync } from "fs";

const log = createSystemLogger({});

/**
 * テキストファイルを読み込む
 * @param filePath 読み込むファイルのパス
 * @returns ファイルの内容
 */
export async function readTextFile(filePath: string): Promise<string> {
  try {
    // ファイルが存在するか確認
    await fs.access(filePath);

    log({
      logLevel: "INFO",
      message: `Reading file: ${filePath}`,
    });
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log({
      logLevel: "ERROR",
      message: `Error reading file: ${errorMsg}`,
    });
    throw new Error(`Failed to read file at ${filePath}: ${errorMsg}`);
  }
}

/**
 * テキストファイルに書き込む
 * @param filePath 書き込み先ファイルパス
 * @param content 書き込む内容
 * @param append 追記モードかどうか (デフォルト: false)
 * @returns 成功メッセージ
 */
export async function writeTextFile(
  filePath: string,
  content: string,
  append: boolean = false,
): Promise<string> {
  try {
    // ディレクトリが存在しない場合は作成
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true }).catch(() => {});

    // ファイルに書き込み
    const flag = append ? "a" : "w";
    await fs.writeFile(filePath, content, { flag });

    const action = append ? "appended to" : "written to";
    log({
      logLevel: "INFO",
      message: `Successfully ${action} ${filePath}`,
    });
    return `Successfully ${action} ${filePath}`;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log({
      logLevel: "ERROR",
      message: `Error writing file: ${errorMsg}`,
    });
    throw new Error(`Failed to write to ${filePath}: ${errorMsg}`);
  }
}

/**
 * ファイルを削除する
 * @param filePath 削除するファイルのパス
 * @returns 成功メッセージ
 */
export async function deleteFile(filePath: string): Promise<string> {
  try {
    // ファイルが存在するか確認
    if (!existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    await fs.unlink(filePath);
    log({
      logLevel: "INFO",
      message: `File deleted: ${filePath}`,
    });
    return `Successfully deleted ${filePath}`;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log({
      logLevel: "ERROR",
      message: `Error deleting file: ${errorMsg}`,
    });
    throw new Error(`Failed to delete ${filePath}: ${errorMsg}`);
  }
}

/**
 * ディレクトリ内のファイル一覧を取得
 * @param dirPath ディレクトリパス
 * @param filter ファイル名フィルター (オプション)
 * @returns ファイル一覧
 */
export async function listFiles(
  dirPath: string,
  filter?: string,
): Promise<string[]> {
  try {
    // ディレクトリが存在するか確認
    if (!existsSync(dirPath)) {
      throw new Error(`Directory does not exist: ${dirPath}`);
    }

    const files = await fs.readdir(dirPath);

    // フィルターが指定されている場合は適用
    let filteredFiles = files;
    if (filter) {
      const regex = new RegExp(filter);
      filteredFiles = files.filter((file) => regex.test(file));
    }

    log({
      logLevel: "ERROR",
      message: `Found ${filteredFiles.length} files in ${dirPath}`,
    });

    // ファイルパスを完全なものに変換
    return filteredFiles.map((file) => path.join(dirPath, file));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log({
      logLevel: "ERROR",
      message: `Error listing files: ${errorMsg}`,
    });
    throw new Error(`Failed to list files in ${dirPath}: ${errorMsg}`);
  }
}

/**
 * 特定の行を編集する
 * @param filePath 編集するファイルのパス
 * @param lineNumber 編集する行番号 (1ベース)
 * @param newContent 新しい行の内容
 * @returns 成功メッセージ
 */
export async function editLine(
  filePath: string,
  lineNumber: number,
  newContent: string,
): Promise<string> {
  try {
    // ファイルの内容を読み込む
    const content = await readTextFile(filePath);
    const lines = content.split("\n");

    // 行番号のバリデーション
    if (lineNumber < 1 || lineNumber > lines.length) {
      throw new Error(
        `Line number out of range: ${lineNumber} (file has ${lines.length} lines)`,
      );
    }

    // 指定行を更新
    lines[lineNumber - 1] = newContent;

    // ファイルに書き戻す
    await writeTextFile(filePath, lines.join("\n"));

    log({
      logLevel: "ERROR",
      message: `Successfully edited line ${lineNumber} in ${filePath}`,
    });
    return `Successfully edited line ${lineNumber} in ${filePath}`;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log({
      logLevel: "ERROR",
      message: `Error editing line: ${errorMsg}`,
    });
    throw new Error(`Failed to edit line in ${filePath}: ${errorMsg}`);
  }
}

/**
 * 特定の行を挿入する
 * @param filePath 編集するファイルのパス
 * @param lineNumber 挿入位置の行番号 (1ベース)
 * @param content 挿入する内容
 * @returns 成功メッセージ
 */
export async function insertLine(
  filePath: string,
  lineNumber: number,
  content: string,
): Promise<string> {
  try {
    // ファイルの内容を読み込む
    const fileContent = await readTextFile(filePath);
    const lines = fileContent.split("\n");

    // 行番号のバリデーション (ファイルの末尾への追加も許可)
    if (lineNumber < 1 || lineNumber > lines.length + 1) {
      throw new Error(
        `Line number out of range: ${lineNumber} (file has ${lines.length} lines)`,
      );
    }

    // 指定位置に行を挿入
    lines.splice(lineNumber - 1, 0, content);

    // ファイルに書き戻す
    await writeTextFile(filePath, lines.join("\n"));
    log({
      logLevel: "INFO",
      message: `Successfully inserted line at position ${lineNumber} in ${filePath}`,
    });
    return `Successfully inserted line at position ${lineNumber} in ${filePath}`;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log({
      logLevel: "ERROR",
      message: `Error inserting line: ${errorMsg}`,
    });
    throw new Error(`Failed to insert line in ${filePath}: ${errorMsg}`);
  }
}

/**
 * 特定の行を削除する
 * @param filePath 編集するファイルのパス
 * @param startLine 削除する行番号 (1ベース)
 * @param endLine 削除する行番号 (1ベース)
 * @returns 成功メッセージ
 */
export async function deleteLines(
  filePath: string,
  startLine: number,
  endLine: number,
) {
  try {
    // ファイルの内容を読み込む
    const content = await readTextFile(filePath);
    const lines = content.split("\n");

    // 行番号のバリデーション
    if (startLine < 1 || startLine > lines.length) {
      throw new Error(
        `Start line number out of range: ${startLine} (file has ${lines.length} lines)`,
      );
    }

    if (endLine < startLine || endLine > lines.length) {
      throw new Error(
        `End line number out of range: ${endLine} must be between ${startLine} and ${lines.length}`,
      );
    }

    // 指定範囲の行を削除（第2引数は削除する要素数）
    const linesToDelete = endLine - startLine + 1;
    lines.splice(startLine - 1, linesToDelete);

    // ファイルに書き戻す
    await writeTextFile(filePath, lines.join("\n"));

    const message =
      startLine === endLine
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

/**
 * テキストファイルの内容を解析する関数（例）
 * @param content - ファイルの内容
 * @returns 解析結果
 */
export function parseFileContent(content: string) {
  // ファイルの種類に応じた解析処理を実装
  // この例ではシンプルに行数をカウント
  const lines = content.split("\n");
  return {
    lineCount: lines.length,
    firstLine: lines[0],
    lastLine: lines[lines.length - 1],
  };
}
