import { readFileSync, existsSync } from 'fs'

import { z } from 'zod'
import { parse } from 'yaml'

import { createSystemLogger } from './lib/logs.js'
import { getConfigPath } from './lib/util.js'

const CONFIG_PATH = getConfigPath()
const configSchema = z.object({
  log_path: z.string().optional(),
  excluded_files: z.array(z.string()).default([]),
  current_project: z.string(),
  projects: z.record(
    z
      .object({
        src: z.string(),
        scripts: z.record(z.string()).default({}),
        excluded_files: z.array(z.string()).default([]),
      })
      .required(),
  ),
})

type Config = z.infer<typeof configSchema>

export function loadConfig({ configPath = CONFIG_PATH }): Config {
  if (!existsSync(configPath)) {
    throw new Error(`設定ファイルが見つかりません: ${configPath}`)
  }

  const raw = readFileSync(configPath, 'utf-8')
  const parsed = parse(raw)

  const result = configSchema.safeParse(parsed)
  if (!result.success) {
    const log = createSystemLogger()
    log({
      logLevel: 'ERROR',
      message: '設定ファイルのスキーマ検証エラー:',
      data: result.error.format(),
    })
    throw new Error('設定ファイルが無効です。')
  }

  if (!result.data.projects[result.data.current_project]) {
    throw new Error(
      `設定ファイルが無効です。プロジェクトが存在しません:${result.data.current_project}`,
    )
  }

  return parsed as Config
}
