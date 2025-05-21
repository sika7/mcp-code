import fs from "fs/promises";
import path from "path";
import { createSystemLogger } from "./logs.js";
import { existsSync, readdirSync, statSync } from "fs";

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
export async function editLines(
  filePath: string,
  startLineNumber: number,
  endLineNumber: number,
  newContent: string | string[],
): Promise<string> {
  try {
    // ファイルの内容を読み込む
    const content = await readTextFile(filePath);
    const lines = content.split("\n");

    // 行番号のバリデーション
    if (startLineNumber < 1 || startLineNumber > lines.length) {
      throw new Error(
        `Start line number out of range: ${startLineNumber} (file has ${lines.length} lines)`,
      );
    }

    if (endLineNumber < startLineNumber || endLineNumber > lines.length) {
      throw new Error(
        `End line number out of range: ${endLineNumber} (file has ${lines.length} lines)`,
      );
    }

    // 置換する行数
    const numLinesToReplace = endLineNumber - startLineNumber + 1;

    // 新しい内容を準備
    let newLines: string[];
    if (Array.isArray(newContent)) {
      newLines = newContent;
    } else {
      newLines = newContent.split("\n");
    }

    // 指定範囲の行を更新
    lines.splice(startLineNumber - 1, numLinesToReplace, ...newLines);

    // ファイルに書き戻す
    await writeTextFile(filePath, lines.join("\n"));

    log({
      logLevel: "INFO",
      message: `Successfully edited lines ${startLineNumber}-${endLineNumber} in ${filePath}`,
    });
    return `Successfully edited lines ${startLineNumber}-${endLineNumber} in ${filePath}`;
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

interface TreeOptions {
  maxDepth?: number; // 最大深さ制限
  exclude?: string[]; // 除外パターン (glob風のパターン)
  currentDepth?: number; // 内部使用: 現在の深さ
}

/**
 * ディレクトリツリーを生成する関数
 * @param dirPath 対象ディレクトリのパス
 * @param options 設定オプション
 * @param indent インデント文字列（内部使用）
 * @returns ツリー表示用の文字列
 */
export async function generateDirectoryTree(
  dirPath: string,
  options: TreeOptions = {},
  indent: string = "",
): Promise<string> {
  const currentDepth = options.currentDepth || 1;
  const maxDepth = options.maxDepth || Number.POSITIVE_INFINITY;
  const exclude = options.exclude || [];

  if (currentDepth > maxDepth) {
    return `${indent}... (最大深さ制限に達しました)\n`;
  }

  let result = "";

  try {
    const items = await fs.readdir(dirPath);

    // 除外パターンに一致しないアイテムのみをフィルタリング
    const filteredItems = items.filter((item) => {
      return !exclude.some((pattern) => {
        if (pattern.startsWith("*") && pattern.endsWith("*")) {
          const middle = pattern.slice(1, -1);
          return item.includes(middle);
        } else if (pattern.startsWith("*")) {
          const suffix = pattern.slice(1);
          return item.endsWith(suffix);
        } else if (pattern.endsWith("*")) {
          const prefix = pattern.slice(0, -1);
          return item.startsWith(prefix);
        }
        return item === pattern;
      });
    });

    // すべてのアイテムの処理を順番に実行
    for (let i = 0; i < filteredItems.length; i++) {
      const item = filteredItems[i];
      const itemPath = path.join(dirPath, item);
      const isLast = i === filteredItems.length - 1;

      try {
        const stats = await fs.stat(itemPath);
        const connector = isLast ? "└── " : "├── ";

        result += `${indent}${connector}${item}\n`;

        if (stats.isDirectory()) {
          const childIndent = indent + (isLast ? "    " : "│   ");
          const childOptions: TreeOptions = {
            ...options,
            currentDepth: currentDepth + 1,
          };
          result += await generateDirectoryTree(
            itemPath,
            childOptions,
            childIndent,
          );
        }
      } catch (err) {
        result += `${indent}${isLast ? "└── " : "├── "}${item} [アクセスエラー]\n`;
      }
    }
  } catch (err) {
    return `${indent}[ディレクトリの読み取りエラー: ${(err as Error).message}]\n`;
  }

  return result;
}
