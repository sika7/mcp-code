import { readFileSync, existsSync } from "fs";
import { parse } from "yaml";
import { configSchema, Config } from "./schema.js";
import { createSystemLogger } from "./logs.js";
import { getConfigPath } from "./util.js";

const CONFIG_PATH = getConfigPath();

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

  if (!result.data.projects[result.data.current_project]) {
    throw new Error(
      `設定ファイルが無効です。プロジェクトが存在しません:${result.data.current_project}`,
    );
  }

  return parsed as Config;
}
