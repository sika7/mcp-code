import { spawn } from 'child_process'

export async function runScript(
  name: string,
  scriptCmd: string,
  projectPath: string,
  shell = false,
): Promise<string> {
  // &&、||、;、|などのシェル演算子が含まれている場合はシェルを使用
  const needsShell = shell || /[;&|]|&&|\|\|/.test(scriptCmd)

  let command: string
  let args: string[]

  if (needsShell) {
    // シェルを使用する場合
    command = process.platform === 'win32' ? 'cmd' : '/bin/sh'
    args = process.platform === 'win32' ? ['/c', scriptCmd] : ['-c', scriptCmd]
  } else {
    // 直接実行する場合
    const parts = scriptCmd.split(' ')
    command = parts[0]
    args = parts.slice(1)
  }

  const child = spawn(command, args, {
    cwd: projectPath,
    shell: false, // 明示的にfalseに設定（上でシェルコマンドを構築済み）
  })

  const result = await new Promise<string>((resolve, reject) => {
    let output = ''
    let errorOutput = ''

    child.stdout?.on('data', data => {
      output += data.toString()
    })

    child.stderr?.on('data', data => {
      errorOutput += data.toString()
    })

    child.on('close', code => {
      if (code === 0) {
        resolve(output)
      } else {
        // エラー情報をより詳細に構築
        const errorDetails = []

        // 実行したコマンド情報
        errorDetails.push(`コマンド: ${scriptCmd}`)
        errorDetails.push(`終了コード: ${code}`)

        // stdoutに出力がある場合は追加（エラー情報が含まれることがある）
        if (output.trim()) {
          errorDetails.push(`標準出力:\n${output.trim()}`)
        }

        // stderrに出力がある場合は追加
        if (errorOutput.trim()) {
          errorDetails.push(`エラー出力:\n${errorOutput.trim()}`)
        }

        // どちらも空の場合はコマンドが見つからないなどの可能性
        if (!output.trim() && !errorOutput.trim()) {
          errorDetails.push(
            '出力がありません。コマンドが見つからない可能性があります。',
          )
        }

        const msg = `スクリプトエラー (${name}):\n${errorDetails.join('\n\n')}`
        reject(msg)
      }
    })

    child.on('error', error => {
      const errorDetails = [
        `コマンド: ${scriptCmd}`,
        `プロセスエラー: ${error.message}`,
      ]
      reject(`スクリプト実行エラー (${name}):\n${errorDetails.join('\n\n')}`)
    })
  })

  return result
}
