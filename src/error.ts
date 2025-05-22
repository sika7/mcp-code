/**
 * 許可されていない拡張子を使用した場合にスローされるエラー
 */
export class InvalidExtensionError extends Error {
  constructor(filePath: string, allowedExtensions: string[]) {
    super(
      `ファイル「${filePath}」は許可されていない拡張子です。許可されている拡張子: ${allowedExtensions.join(', ')}`,
    )
    this.name = 'InvalidExtensionError'
  }
}
