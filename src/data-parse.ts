import { XMLParser } from 'fast-xml-parser'
import yaml from 'js-yaml'
import Papa from 'papaparse'
import toml from 'toml'

/**
 * パーサーを使用してファイル形式を判定する関数
 * @param fileContent ファイルの内容
 * @param fileName オプションのファイル名
 * @returns 判定されたMIMEタイプとパース済みデータのオブジェクト、または判定できない場合はnull
 */
export async function detectFileTypeWithParser(
  fileContent: string,
  fileName?: string,
): Promise<{ mimeType: string; parsedData: any }> {
  if (!fileContent || fileContent.trim() === '') {
    throw new Error('ファイルの内容がありません')
  }

  // ファイル名から拡張子を取得（ヒントとして使用）
  const extension = fileName ? fileName.split('.').pop()?.toLowerCase() : null

  // パースの試行順序を最適化（拡張子に基づく）
  const parsingOrder = determineParsingOrder(extension)

  // 各パーサーを順番に試行
  for (const format of parsingOrder) {
    try {
      switch (format) {
        case 'json':
          const jsonData = JSON.parse(fileContent)
          return { mimeType: 'application/json', parsedData: jsonData }

        case 'yaml':
          const yamlData = yaml.load(fileContent)
          return { mimeType: 'application/yaml', parsedData: yamlData }

        case 'xml':
          const parser = new XMLParser()
          const xmlData = parser.parse(fileContent)
          return { mimeType: 'application/xml', parsedData: xmlData }

        case 'csv':
          // CSVパーサーが必要
          const csvData = Papa.parse(fileContent, { header: true })
          if (
            csvData.errors.length === 0 ||
            csvData.errors[0].code === 'TooFewFields'
          ) {
            return { mimeType: 'text/csv', parsedData: csvData.data }
          }
          break

        case 'toml':
          const tomlData = toml.parse(fileContent)
          return { mimeType: 'application/toml', parsedData: tomlData }
      }
    } catch (e) {
      // このフォーマットでのパースに失敗、次を試す
      continue
    }
  }

  // すべてのパーサーが失敗した場合はプレーンテキストとして扱う
  return { mimeType: 'text/plain', parsedData: fileContent }
}

/**
 * 拡張子に基づいてパース試行順序を決定する関数
 */
function determineParsingOrder(extension: string | null | undefined): string[] {
  // デフォルトの順序（最も一般的なフォーマットから）
  const defaultOrder = ['json', 'yaml', 'xml', 'csv', 'toml']

  if (!extension) return defaultOrder

  // 拡張子に基づいて順序を最適化
  switch (extension) {
    case 'json':
      return ['json', ...defaultOrder.filter(fmt => fmt !== 'json')]
    case 'yaml':
    case 'yml':
      return ['yaml', ...defaultOrder.filter(fmt => fmt !== 'yaml')]
    case 'xml':
    case 'svg':
      return ['xml', ...defaultOrder.filter(fmt => fmt !== 'xml')]
    case 'csv':
      return ['csv', ...defaultOrder.filter(fmt => fmt !== 'csv')]
    case 'toml':
      return ['toml', ...defaultOrder.filter(fmt => fmt !== 'toml')]
    default:
      return defaultOrder
  }
}
