import { existsSync, mkdirSync, statSync } from "fs";
import { Minimatch } from "minimatch";
import path, { join } from "path";

export function cwdPath(filePath: string[]) {
  return join(process.cwd(), ...filePath);
}

/**
 * 対象ファイルが除外対象にマッチするかをチェックする
 */
export const isExcluded = (filepath: string, patterns: string[]): boolean => {
  return patterns.some((pattern) => new Minimatch(pattern).match(filepath));
};

/**
 * パスをプロジェクトルート内に正規化する
 *
 * @param inputPath - 入力パス
 * @param projectRoot - プロジェクトルートディレクトリ
 * @returns 正規化されたパス
 */
export function normalizeToProjectRoot(
  inputPath: string,
  projectRoot: string,
): string {
  // プロジェクトルートを正規化
  const normalizedRoot = path.resolve(projectRoot);

  // 入力パスが空の場合はプロジェクトルートを返す
  if (!inputPath || inputPath.trim() === "") {
    return normalizedRoot;
  }

  // パスを正規化
  let normalizedPath = path.normalize(inputPath);

  // 相対パスの場合はプロジェクトルートと結合
  if (!path.isAbsolute(normalizedPath)) {
    normalizedPath = path.join(normalizedRoot, normalizedPath);
  }

  // 正規化されたパスを取得
  normalizedPath = path.resolve(normalizedPath);

  // パスがプロジェクトディレクトリの外にあるかチェック
  if (!normalizedPath.startsWith(normalizedRoot)) {
    // プロジェクト外のパスの場合はプロジェクトルートに丸める
    return normalizedRoot;
  }

  return normalizedPath;
}

/**
 * 入力されたパスを指定したプロジェクトディレクトリに丸め、正規化する関数
 *
 * @param inputPath - 入力されたパス（任意のパス形式）
 * @param projectRoot - プロジェクトルートディレクトリの絶対パス
 * @returns 正規化されたプロジェクト内のパス（絶対パス）
 */
export function resolveSafeProjectPath(
  inputPath: string,
  projectRoot: string,
): string {
  return normalizeToProjectRoot(inputPath, projectRoot);
}

/**
 * ファイルの拡張子が許可リストに含まれているかを確認する
 * 「許可されている拡張子か？」という問いに答える関数
 *
 * @param filePath - 確認するファイルパス
 * @param allowedExtensions - 許可された拡張子のリスト
 * @returns 拡張子が許可されていればtrue、そうでなければfalse
 */
export function isAllowedExtension(
  filePath: string,
  allowedExtensions: string[] | null,
): boolean {
  // 許可拡張子の指定がなければ常に許可
  if (!allowedExtensions || allowedExtensions.length === 0) {
    return true;
  }

  // ディレクトリの場合は常に許可
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    return true;
  }

  const ext = path.extname(filePath).toLowerCase();

  // 拡張子がない場合は許可
  if (!ext) {
    return true;
  }

  // 拡張子が許可リストにあるかチェック
  return allowedExtensions.includes(ext);
}

/**
 * パスのディレクトリ部分が存在しない場合、必要に応じて作成する
 *
 * @param filePath - ファイルまたはディレクトリのパス
 * @param createMissingDirectories - ディレクトリを作成するかどうか
 */
export function ensureDirectoryExists(
  filePath: string,
  createMissingDirectories: boolean = false,
): void {
  if (!createMissingDirectories) {
    return;
  }

  let dirToCreate: string;

  // パスがディレクトリかファイルかを判定
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    dirToCreate = filePath;
  } else {
    dirToCreate = path.dirname(filePath);
  }

  // ディレクトリが存在しない場合は作成
  if (!existsSync(dirToCreate)) {
    mkdirSync(dirToCreate, { recursive: true });
  }
}

