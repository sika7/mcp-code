/**
 * テストデータ管理（簡素化版）
 * フィクスチャファイルとの連携用ヘルパー関数を提供
 */

import fs from "fs/promises";
import path from "path";

// =============================================================================
// ディレクトリ構造定義
// =============================================================================

export interface DirectoryStructure {
  [key: string]: string | DirectoryStructure;
}

// =============================================================================
// ディレクトリ構造作成
// =============================================================================

/**
 * テスト用のディレクトリ構造を作成する
 */
export async function createDirectoryStructure(
  basePath: string,
  structure: DirectoryStructure
): Promise<void> {
  for (const [name, content] of Object.entries(structure)) {
    const fullPath = path.join(basePath, name);
    
    if (typeof content === "string") {
      // ファイルの場合
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, "utf-8");
    } else {
      // ディレクトリの場合
      await fs.mkdir(fullPath, { recursive: true });
      await createDirectoryStructure(fullPath, content);
    }
  }
}

// =============================================================================
// 検証ヘルパー
// =============================================================================

/**
 * ファイルの内容が期待通りかを検証する
 */
export async function verifyFileContent(
  filePath: string,
  expectedContent: string
): Promise<boolean> {
  try {
    const actualContent = await fs.readFile(filePath, "utf-8");
    return actualContent === expectedContent;
  } catch {
    return false;
  }
}

/**
 * ディレクトリ構造が期待通りかを検証する
 */
export async function verifyDirectoryStructure(
  basePath: string,
  expectedStructure: DirectoryStructure
): Promise<boolean> {
  try {
    for (const [name, content] of Object.entries(expectedStructure)) {
      const fullPath = path.join(basePath, name);
      const stats = await fs.stat(fullPath);
      
      if (typeof content === "string") {
        // ファイルの検証
        if (!stats.isFile()) return false;
        const actualContent = await fs.readFile(fullPath, "utf-8");
        if (actualContent !== content) return false;
      } else {
        // ディレクトリの検証
        if (!stats.isDirectory()) return false;
        const isValid = await verifyDirectoryStructure(fullPath, content);
        if (!isValid) return false;
      }
    }
    
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// 基本的なテストディレクトリ構造パターン
// =============================================================================

export const BASIC_PROJECT_STRUCTURE: DirectoryStructure = {
  "package.json": '{\n  "name": "test-package",\n  "version": "1.0.0"\n}',
  "README.md": "# Test Project\n\nThis is a test project.",
  "src": {
    "index.ts": "export default function main() {\n  console.log('Hello');\n}",
    "utils": {
      "helper.ts": "export function helper() {\n  return 'helper';\n}",
    },
  },
  "tests": {
    "index.test.ts": "// Test file",
  },
};

export const COMPLEX_PROJECT_STRUCTURE: DirectoryStructure = {
  "package.json": '{\n  "name": "complex-project",\n  "version": "1.0.0"\n}',
  "tsconfig.json": '{\n  "compilerOptions": {\n    "target": "ES2020"\n  }\n}',
  ".gitignore": "node_modules/\ndist/\n*.log\n",
  "src": {
    "components": {
      "Button.tsx": "export function Button() { return <button />; }",
      "Input.tsx": "export function Input() { return <input />; }",
    },
    "utils": {
      "api.ts": "export async function fetchData() { /* api call */ }",
      "constants.ts": "export const API_URL = 'https://api.example.com';",
    },
    "index.ts": "export * from './components';",
  },
  "tests": {
    "components": {
      "Button.test.tsx": "// Button component tests",
    },
    "setup.ts": "// Test setup configuration",
  },
};

export const EXCLUDED_FILES_STRUCTURE: DirectoryStructure = {
  "public.txt": "This is a public file",
  "secret.pem": "-----BEGIN PRIVATE KEY-----\nSECRET_DATA\n-----END PRIVATE KEY-----",
  "config.key": "SECRET_API_KEY=abc123",
  ".env": "DATABASE_URL=secret://localhost",
  "logs": {
    "app.log": "2023-01-01 INFO: Application started",
    "error.log": "2023-01-01 ERROR: Something went wrong",
  },
  "node_modules": {
    "package": {
      "index.js": "module.exports = {};",
    },
  },
};
