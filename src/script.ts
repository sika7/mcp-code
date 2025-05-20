import { spawn } from "child_process";

export async function runScript(
  name: string,
  scriptCmd: string,
  projectPath: string,
  shell = false,
) {
  const [command, ...args] = scriptCmd.split(" ");
  const child = spawn(command, args, {
    cwd: projectPath,
    shell, // 安全性向上：シェルを通さず直接実行
  });

  const result = await new Promise((resolve, reject) => {
    let output = "";
    let errorOutput = "";

    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        const msg = `スクリプトエラー (${name}): ${errorOutput}`;
        reject(msg);
      }
    });
  });

  return {
    content: [{ type: "text", text: `✅ 実行完了\n${result}` }],
  };
}
