import { Minimatch } from "minimatch";

/**
 * 対象ファイルが除外対象にマッチするかをチェックする
 */
export const isExcluded = (filepath: string, patterns: string[]): boolean => {
  return patterns.some(pattern => new Minimatch(pattern).match(filepath));
};
