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
        const msg = `スクリプトエラー (${name}): ${errorOutput}`
        reject(msg)
      }
    })

    child.on('error', error => {
      reject(`スクリプト実行エラー (${name}): ${error.message}`)
    })
  })

  return result
}
