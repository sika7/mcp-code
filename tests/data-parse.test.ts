/**
 * データパースモジュールのテスト
 */

import {
  assertEqual,
  assertTrue,
  assertFalse,
  assertThrows,
  createTestEnvironment,
  runTestSuite,
  isMainModule,
} from './test-utils';
import { detectFileTypeWithParser } from '../src/data-parse';

async function testValidJsonParsing() {
  const { cleanup } = await createTestEnvironment('json-parsing');
  
  try {
    const jsonContent = '{"name": "test", "value": 123, "nested": {"key": "value"}}';
    const result = await detectFileTypeWithParser(jsonContent, 'test.json');
    
    assertEqual(result.mimeType, 'application/json', 'JSONのMIMEタイプが正しく判定されること');
    assertEqual(result.parsedData.name, 'test', 'JSONの値が正しくパースされること');
    assertEqual(result.parsedData.value, 123, 'JSON数値が正しくパースされること');
    assertEqual(result.parsedData.nested.key, 'value', 'ネストしたJSONが正しくパースされること');
  } finally {
    await cleanup();
  }
}

async function testValidYamlParsing() {
  const { cleanup } = await createTestEnvironment('yaml-parsing');
  
  try {
    const yamlContent = `
name: test
value: 123
nested:
  key: value
  array:
    - item1
    - item2
`;
    const result = await detectFileTypeWithParser(yamlContent, 'test.yaml');
    
    assertEqual(result.mimeType, 'application/yaml', 'YAMLのMIMEタイプが正しく判定されること');
    assertEqual(result.parsedData.name, 'test', 'YAMLの値が正しくパースされること');
    assertEqual(result.parsedData.value, 123, 'YAML数値が正しくパースされること');
    assertEqual(result.parsedData.nested.key, 'value', 'ネストしたYAMLが正しくパースされること');
    assertEqual(result.parsedData.nested.array.length, 2, 'YAML配列が正しくパースされること');
  } finally {
    await cleanup();
  }
}

async function testValidXmlParsing() {
  const { cleanup } = await createTestEnvironment('xml-parsing');
  
  try {
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <name>test</name>
  <value>123</value>
  <nested>
    <key>value</key>
  </nested>
</root>`;
    const result = await detectFileTypeWithParser(xmlContent, 'test.xml');
    
    assertEqual(result.mimeType, 'application/xml', 'XMLのMIMEタイプが正しく判定されること');
    assertEqual(result.parsedData.root.n, 'test', 'XMLの値が正しくパースされること');
    assertEqual(result.parsedData.root.value, '123', 'XML値が正しくパースされること');
    assertEqual(result.parsedData.root.nested.key, 'value', 'ネストしたXMLが正しくパースされること');
  } finally {
    await cleanup();
  }
}

async function testValidCsvParsing() {
  const { cleanup } = await createTestEnvironment('csv-parsing');
  
  try {
    const csvContent = `name,age,city
Alice,25,Tokyo
Bob,30,Osaka
Charlie,35,Kyoto`;
    const result = await detectFileTypeWithParser(csvContent, 'test.csv');
    
    assertEqual(result.mimeType, 'text/csv', 'CSVのMIMEタイプが正しく判定されること');
    assertEqual(result.parsedData.length, 3, 'CSV行数が正しく判定されること');
    assertEqual(result.parsedData[0].name, 'Alice', 'CSVの最初の行が正しくパースされること');
    assertEqual(result.parsedData[1].age, '30', 'CSVの数値が正しくパースされること');
    assertEqual(result.parsedData[2].city, 'Kyoto', 'CSVの最後の行が正しくパースされること');
  } finally {
    await cleanup();
  }
}

async function testValidTomlParsing() {
  const { cleanup } = await createTestEnvironment('toml-parsing');
  
  try {
    const tomlContent = `
name = "test"
value = 123

[nested]
key = "value"
array = ["item1", "item2"]
`;
    const result = await detectFileTypeWithParser(tomlContent, 'test.toml');
    
    assertEqual(result.mimeType, 'application/toml', 'TOMLのMIMEタイプが正しく判定されること');
    assertEqual(result.parsedData.name, 'test', 'TOMLの値が正しくパースされること');
    assertEqual(result.parsedData.value, 123, 'TOML数値が正しくパースされること');
    assertEqual(result.parsedData.nested.key, 'value', 'ネストしたTOMLが正しくパースされること');
    assertEqual(result.parsedData.nested.array.length, 2, 'TOML配列が正しくパースされること');
  } finally {
    await cleanup();
  }
}

async function testFileExtensionOptimization() {
  const { cleanup } = await createTestEnvironment('extension-optimization');
  
  try {
    // JSON拡張子でJSONコンテンツ
    const jsonContent = '{"test": "json"}';
    const jsonResult = await detectFileTypeWithParser(jsonContent, 'data.json');
    assertEqual(jsonResult.mimeType, 'application/json', 'JSON拡張子でJSONが優先パースされること');
    
    // YAML拡張子でYAMLコンテンツ
    const yamlContent = 'test: yaml';
    const yamlResult = await detectFileTypeWithParser(yamlContent, 'data.yml');
    assertEqual(yamlResult.mimeType, 'application/yaml', 'YAML拡張子でYAMLが優先パースされること');
    
    // 拡張子なしでもパースできること
    const noExtResult = await detectFileTypeWithParser(jsonContent);
    assertEqual(noExtResult.mimeType, 'application/json', '拡張子なしでもJSONがパースされること');
  } finally {
    await cleanup();
  }
}

async function testPlainTextFallback() {
  const { cleanup } = await createTestEnvironment('plaintext-fallback');
  
  try {
    const plainTextContent = 'This is just plain text content that cannot be parsed as structured data.';
    const result = await detectFileTypeWithParser(plainTextContent, 'readme.txt');
    
    assertEqual(result.mimeType, 'text/plain', 'パースできないコンテンツはプレーンテキストとして判定されること');
    assertEqual(result.parsedData, plainTextContent, 'プレーンテキストの内容がそのまま返されること');
  } finally {
    await cleanup();
  }
}

async function testInvalidJson() {
  const { cleanup } = await createTestEnvironment('invalid-json');
  
  try {
    const invalidJsonContent = '{"invalid": json, "missing": quotes}';
    const result = await detectFileTypeWithParser(invalidJsonContent, 'invalid.json');
    
    // 無効なJSONはプレーンテキストとして扱われる
    assertEqual(result.mimeType, 'text/plain', '無効なJSONはプレーンテキストとして扱われること');
    assertEqual(result.parsedData, invalidJsonContent, '無効なJSONの内容がそのまま返されること');
  } finally {
    await cleanup();
  }
}

async function testEmptyContent() {
  const { cleanup } = await createTestEnvironment('empty-content');
  
  try {
    await assertThrows(
      async () => await detectFileTypeWithParser('', 'empty.json'),
      'ファイルの内容がありません',
      '空の内容でエラーが発生すること'
    );
    
    await assertThrows(
      async () => await detectFileTypeWithParser('   ', 'whitespace.json'),
      'ファイルの内容がありません',
      '空白のみの内容でエラーが発生すること'
    );
  } finally {
    await cleanup();
  }
}

async function testNullContent() {
  const { cleanup } = await createTestEnvironment('null-content');
  
  try {
    await assertThrows(
      async () => await detectFileTypeWithParser(null as any),
      'ファイルの内容がありません',
      'nullの内容でエラーが発生すること'
    );
    
    await assertThrows(
      async () => await detectFileTypeWithParser(undefined as any),
      'ファイルの内容がありません',
      'undefinedの内容でエラーが発生すること'
    );
  } finally {
    await cleanup();
  }
}

async function testComplexCsvWithErrors() {
  const { cleanup } = await createTestEnvironment('complex-csv');
  
  try {
    // TooFewFieldsエラーがあるCSVでも正常にパースされること
    const csvWithMissingFields = `name,age,city
Alice,25,Tokyo
Bob,30
Charlie,35,Kyoto`;
    const result = await detectFileTypeWithParser(csvWithMissingFields, 'incomplete.csv');
    
    assertEqual(result.mimeType, 'text/csv', 'フィールド不足のCSVでもCSVとして判定されること');
    assertEqual(result.parsedData.length, 3, 'フィールド不足でも行数は正しく判定されること');
    assertEqual(result.parsedData[1].name, 'Bob', 'フィールド不足の行でも解析可能な部分は正しくパースされること');
  } finally {
    await cleanup();
  }
}

async function testSvgAsXml() {
  const { cleanup } = await createTestEnvironment('svg-xml');
  
  try {
    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <circle cx="50" cy="50" r="40" fill="red"/>
</svg>`;
    const result = await detectFileTypeWithParser(svgContent, 'image.svg');
    
    assertEqual(result.mimeType, 'application/xml', 'SVGファイルがXMLとして判定されること');
    assertTrue(result.parsedData.svg, 'SVGがXMLとして正しくパースされること');
  } finally {
    await cleanup();
  }
}

async function testYmlExtension() {
  const { cleanup } = await createTestEnvironment('yml-extension');
  
  try {
    const yamlContent = 'name: test\nvalue: 123';
    const result = await detectFileTypeWithParser(yamlContent, 'config.yml');
    
    assertEqual(result.mimeType, 'application/yaml', '.yml拡張子でYAMLとして判定されること');
    assertEqual(result.parsedData.name, 'test', '.yml拡張子のファイルが正しくパースされること');
  } finally {
    await cleanup();
  }
}

async function testNestedJsonStructure() {
  const { cleanup } = await createTestEnvironment('nested-json');
  
  try {
    const complexJsonContent = `{
  "user": {
    "profile": {
      "name": "Alice",
      "preferences": {
        "theme": "dark",
        "language": "ja"
      }
    },
    "activities": [
      {"type": "login", "timestamp": "2025-01-01T00:00:00Z"},
      {"type": "purchase", "timestamp": "2025-01-02T12:30:00Z"}
    ]
  }
}`;
    const result = await detectFileTypeWithParser(complexJsonContent, 'complex.json');
    
    assertEqual(result.mimeType, 'application/json', '複雑なJSONが正しく判定されること');
    assertEqual(result.parsedData.user.profile.name, 'Alice', '深いネスト構造が正しくパースされること');
    assertEqual(result.parsedData.user.activities.length, 2, '配列が正しくパースされること');
    assertEqual(result.parsedData.user.profile.preferences.theme, 'dark', '複数レベルのネストが正しくパースされること');
  } finally {
    await cleanup();
  }
}

// メインのテスト実行関数
export async function runDataParseTests() {
  await runTestSuite('データパースモジュール', [
    { name: '有効なJSONのパース', fn: testValidJsonParsing },
    { name: '有効なYAMLのパース', fn: testValidYamlParsing },
    { name: '有効なXMLのパース', fn: testValidXmlParsing },
    { name: '有効なCSVのパース', fn: testValidCsvParsing },
    { name: '有効なTOMLのパース', fn: testValidTomlParsing },
    { name: 'ファイル拡張子による最適化', fn: testFileExtensionOptimization },
    { name: 'プレーンテキストフォールバック', fn: testPlainTextFallback },
    { name: '無効なJSON処理', fn: testInvalidJson },
    { name: '空のコンテンツエラー処理', fn: testEmptyContent },
    { name: 'null/undefinedコンテンツエラー処理', fn: testNullContent },
    { name: 'エラーありCSVの処理', fn: testComplexCsvWithErrors },
    { name: 'SVGのXML判定', fn: testSvgAsXml },
    { name: '.yml拡張子の処理', fn: testYmlExtension },
    { name: '複雑なJSON構造のパース', fn: testNestedJsonStructure },
  ])
}

// メイン実行部
if (isMainModule(import.meta.url)) {
  runDataParseTests().catch(console.error)
}
