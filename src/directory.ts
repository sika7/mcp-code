import { promises as fs, rmSync } from "fs";
import { createSystemLogger } from "./logs";

const log = createSystemLogger({});

/**
 * 指定されたパスにディレクトリを作成する（存在しない場合のみ）
 * @param dirPath 作成したいディレクトリのパス
 */
export async function createDirectory(dirPath: string) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    log({
      logLevel: "INFO",
      message: `ディレクトリを作成しました: ${dirPath}`,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log({
      logLevel: "ERROR",
      message: `ディレクトリの作成に失敗しました: ${errorMsg}`,
    });
    throw error;
  }
  return `ディレクトリを作成しました: ${dirPath}`;
}

/**
 * 指定されたディレクトリを再帰的に削除する
 * @param dirPath 削除したいディレクトリのパス
 */
export async function removeDirectory(dirPath: string) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    log({
      logLevel: "INFO",
      message: `ディレクトリを削除しました: ${dirPath}`,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log({
      logLevel: "ERROR",
      message: `ディレクトリの削除に失敗しました: ${errorMsg}`,
    });
    throw error;
  }
  return `ディレクトリを削除しました: ${dirPath}`;
}

/**
 * 指定されたディレクトリを同期的に再帰削除する
 * @param dirPath 削除したいディレクトリのパス
 */
export function removeDirectorySync(dirPath: string): void {
  try {
    rmSync(dirPath, { recursive: true, force: true });
    console.log(`ディレクトリを削除しました: ${dirPath}`);
  } catch (err: any) {
    console.error(`ディレクトリの削除に失敗しました: ${err.message}`);
    throw err;
  }
}
