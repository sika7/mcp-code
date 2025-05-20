import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { parse } from "yaml";
import { configSchema, Config } from "./schema";
import { createSystemLogger } from "./logs";

const CONFIG_PATH = join(homedir(), ".config", "mcp-code", "config.yaml");

export function loadConfig({ configPath = CONFIG_PATH }): Config {
  if (!existsSync(configPath)) {
    throw new Error(`設定ファイルが見つかりません: ${configPath}`);
  }

  const raw = readFileSync(configPath, "utf-8");
  const parsed = parse(raw);

  const result = configSchema.safeParse(parsed);
  if (!result.success) {
    const log = createSystemLogger({});
    log({
      logLevel: "ERROR",
      message: "設定ファイルのスキーマ検証エラー:",
      data: result.error.format(),
    });
    throw new Error("設定ファイルが無効です。");
  }

  return parsed as Config;
}
