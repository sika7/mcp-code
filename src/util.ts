import { Minimatch } from "minimatch";
import { join } from "path";

export function cwdPath(filePath: string[]) {
  return join(process.cwd(), ...filePath);
}

/**
 * 対象ファイルが除外対象にマッチするかをチェックする
 */
export const isExcluded = (filepath: string, patterns: string[]): boolean => {
  return patterns.some((pattern) => new Minimatch(pattern).match(filepath));
};
