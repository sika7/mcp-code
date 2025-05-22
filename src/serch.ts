import * as fs from "fs";
import * as readline from "readline";
import { createSystemLogger } from "./logs.js";
import { z } from "zod";

// 型定義
interface GrepOptions {
  regex?: boolean;
  caseSensitive?: boolean;
  flags?: string;
  maxResults?: number;
  context?: number;
}

interface NormalizedGrepOptions {
  regex: boolean;
  caseSensitive: boolean;
  flags: string;
  maxResults: number;
  context: number;
}

interface MatchResult {
  found: boolean;
  position: number;
}

interface ContextResult {
  beforeContext: string[];
  afterContext: string[];
}

interface GrepMatch {
  lineNumber: number;
  content: string;
  matchPosition: number;
  beforeContext?: string[];
  afterContext?: string[];
}

interface GrepResult {
  filename: string;
  fileSize: number;
  totalLines: number;
  matches: GrepMatch[];
  matchCount: number;
  truncated: boolean;
}

interface StreamGrepResult {
  filename: string;
  fileSize: number;
  matches: GrepMatch[];
  matchCount: number;
  truncated: boolean;
  totalLinesProcessed: number;
}

interface FileContent {
  content: string;
  size: number;
  lines: string[];
}

type MatcherFunction = (line: string) => MatchResult;

// 設定関連の純粋関数
export function normalizeOptions(
  options: GrepOptions = {},
): NormalizedGrepOptions {
  return {
    regex: options.regex ?? false,
    caseSensitive: options.caseSensitive ?? false,
    flags: options.flags ?? "i",
    maxResults: options.maxResults ?? 100,
    context: Math.max(0, Math.min(10, options.context ?? 0)),
  };
}

export function shouldUseStreamProcessing(
  fileSize: number,
  threshold: number = 50 * 1024 * 1024,
): boolean {
  return fileSize > threshold;
}

// マッチング関連の純粋関数
export function createMatcher(
  pattern: string,
  options: NormalizedGrepOptions,
): MatcherFunction {
  if (options.regex) {
    const regex = new RegExp(pattern, options.flags);
    return (line: string): MatchResult => {
      const match = line.match(regex);
      return {
        found: match !== null,
        position: match?.index ?? -1,
      };
    };
  } else {
    const searchPattern = options.caseSensitive
      ? pattern
      : pattern.toLowerCase();
    return (line: string): MatchResult => {
      const searchLine = options.caseSensitive ? line : line.toLowerCase();
      const position = searchLine.indexOf(searchPattern);
      return {
        found: position !== -1,
        position,
      };
    };
  }
}

export function findMatches(
  line: string,
  matcher: MatcherFunction,
): MatchResult {
  return matcher(line);
}

// コンテキスト処理の純粋関数
export function extractContext(
  lines: string[],
  targetIndex: number,
  contextSize: number,
): ContextResult {
  if (contextSize === 0) {
    return { beforeContext: [], afterContext: [] };
  }

  const startIndex = Math.max(0, targetIndex - contextSize);
  const endIndex = Math.min(lines.length - 1, targetIndex + contextSize);

  const beforeContext = lines
    .slice(startIndex, targetIndex)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const afterContext = lines
    .slice(targetIndex + 1, endIndex + 1)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return { beforeContext, afterContext };
}

// 結果整形の純粋関数
export function formatGrepMatch(
  lineNumber: number,
  line: string,
  matchResult: MatchResult,
  context?: ContextResult,
): GrepMatch {
  const match: GrepMatch = {
    lineNumber,
    content: line.trim(),
    matchPosition: matchResult.position,
  };

  if (context) {
    match.beforeContext = context.beforeContext;
    match.afterContext = context.afterContext;
  }

  return match;
}

// ファイル処理関数
export function validateFilePath(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const stats = fs.statSync(filePath);
  if (stats.isDirectory()) {
    throw new Error(`Path is a directory: ${filePath}`);
  }
}

export function getFileStats(filePath: string): fs.Stats {
  return fs.statSync(filePath);
}

export function readFileSync(filePath: string): FileContent {
  const stats = getFileStats(filePath);
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");

  return {
    content,
    size: stats.size,
    lines,
  };
}

export async function* readFileStream(
  filePath: string,
): AsyncIterable<{ line: string; lineNumber: number }> {
  const fileStream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let lineNumber = 0;

  try {
    for await (const line of rl) {
      lineNumber++;
      yield { line, lineNumber };
    }
  } finally {
    rl.close();
    fileStream.destroy();
  }
}

// メイン処理関数
export function processLinesSync(
  lines: string[],
  pattern: string,
  options: NormalizedGrepOptions,
): { matches: GrepMatch[]; truncated: boolean } {
  const matcher = createMatcher(pattern, options);
  const results: GrepMatch[] = [];
  let truncated = false;

  for (
    let i = 0;
    i < lines.length && results.length < options.maxResults;
    i++
  ) {
    const line = lines[i];
    const matchResult = findMatches(line, matcher);

    if (matchResult.found) {
      const context =
        options.context > 0
          ? extractContext(lines, i, options.context)
          : undefined;

      const grepMatch = formatGrepMatch(i + 1, line, matchResult, context);
      results.push(grepMatch);
    }
  }

  // 残りの行にマッチがあるかチェック
  if (results.length >= options.maxResults) {
    for (let i = results.length; i < lines.length; i++) {
      const matchResult = findMatches(lines[i], matcher);
      if (matchResult.found) {
        truncated = true;
        break;
      }
    }
  }

  return { matches: results, truncated };
}

export async function processLinesStream(
  filePath: string,
  pattern: string,
  options: NormalizedGrepOptions,
): Promise<{
  matches: GrepMatch[];
  truncated: boolean;
  totalLinesProcessed: number;
}> {
  const matcher = createMatcher(pattern, options);
  const results: GrepMatch[] = [];
  const lineBuffer: string[] = [];

  let totalLinesProcessed = 0;
  let matchCount = 0;
  let truncated = false;

  try {
    for await (const { line, lineNumber } of readFileStream(filePath)) {
      totalLinesProcessed++;

      // コンテキスト用のバッファ管理
      if (options.context > 0) {
        lineBuffer.push(line);
        if (lineBuffer.length > options.context * 2 + 1) {
          lineBuffer.shift();
        }
      }

      // 最大結果数に達している場合はスキップ
      if (results.length >= options.maxResults) {
        const matchResult = findMatches(line, matcher);
        if (matchResult.found) {
          truncated = true;
        }
        continue;
      }

      const matchResult = findMatches(line, matcher);

      if (matchResult.found) {
        matchCount++;

        let context: ContextResult | undefined;
        if (options.context > 0 && lineBuffer.length > 0) {
          const centerIndex = Math.floor(lineBuffer.length / 2);
          context = {
            beforeContext: lineBuffer.slice(0, centerIndex),
            afterContext: lineBuffer.slice(centerIndex + 1),
          };
        }

        const grepMatch = formatGrepMatch(
          lineNumber,
          line,
          matchResult,
          context,
        );
        results.push(grepMatch);
      }
    }
  } catch (error) {
    throw new Error(`Stream processing error: ${(error as Error).message}`);
  }

  return { matches: results, truncated, totalLinesProcessed };
}

// 統合関数
export async function fileGrep(
  filePath: string,
  pattern: string,
  options: GrepOptions = {},
): Promise<GrepResult | StreamGrepResult> {
  try {
    validateFilePath(filePath);
    const stats = getFileStats(filePath);
    const normalizedOptions = normalizeOptions(options);

    if (shouldUseStreamProcessing(stats.size)) {
      const log = createSystemLogger({});
      log({
        logLevel: "ERROR",
        message: `Large file detected (${Math.round(stats.size / 1024 / 1024)}MB), using stream processing`,
      });

      const { matches, truncated, totalLinesProcessed } =
        await processLinesStream(filePath, pattern, {
          ...normalizedOptions,
          maxResults: normalizedOptions.maxResults || 1000,
        });

      return {
        filename: filePath,
        fileSize: stats.size,
        matches,
        matchCount: matches.length,
        truncated,
        totalLinesProcessed,
      };
    } else {
      const fileContent = readFileSync(filePath);
      const { matches, truncated } = processLinesSync(
        fileContent.lines,
        pattern,
        normalizedOptions,
      );

      return {
        filename: filePath,
        fileSize: fileContent.size,
        totalLines: fileContent.lines.length,
        matches,
        matchCount: matches.length,
        truncated,
      };
    }
  } catch (error) {
    throw new Error(`Grep error: ${(error as Error).message}`);
  }
}

// Zodスキーマ定義
export const FileGrepOptionsSchema = z
  .object({
    regex: z.boolean().default(false).describe("正規表現として検索するか"),

    caseSensitive: z
      .boolean()
      .default(false)
      .describe("大文字小文字を区別するか"),

    flags: z
      .string()
      .default("i")
      .describe("正規表現のフラグ（regex=trueの場合）例: 'gi'"),

    maxResults: z
      .number()
      .int()
      .min(1)
      .max(10000)
      .default(100)
      .describe("最大結果数（通常ファイル: 100, 大容量ファイル: 1000）"),

    context: z
      .number()
      .int()
      .min(0)
      .max(10)
      .default(0)
      .describe("マッチした行の前後何行を含めるか"),
  })
  .strict();

export const FileGrepArgsSchema = z
  .object({
    filePath: z.string().min(1).describe("検索対象のファイルパス"),

    pattern: z.string().min(1).describe("検索する文字列または正規表現パターン"),

    options: FileGrepOptionsSchema.optional().describe("検索オプション"),

    requestId: z.string().optional().describe("リクエストID"),
  })
  .strict();

// 型定義（Zodから自動生成）
export type FileGrepOptions = z.infer<typeof FileGrepOptionsSchema>;
export type FileGrepArgs = z.infer<typeof FileGrepArgsSchema>;
