// ライブラリのメインエクスポート
export { Core } from './lib/main.js'

// 型定義もエクスポート
export type {
  ReadFileOptions,
  MulchEditLines,
  MulchInsertLines,
  MulchLines,
} from './lib/files.js'

export type { DirectoryGrepOptionsInput, GrepOptions } from './lib/search.js'

// ユーティリティ関数も必要に応じてエクスポート
export {
  convertToRelativePaths,
  isExcluded,
  resolveSafeProjectPath,
} from './lib/util.js'

// ログシステムもエクスポート
export { createSystemLogger } from './lib/logs.js'
