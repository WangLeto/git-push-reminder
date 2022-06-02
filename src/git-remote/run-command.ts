const util = require("util");
const exec = util.promisify(require("child_process").exec);

export type CommandRes = { ok: true; res: string } | { ok: false; err: Error };

export async function runCommand(
  _command: string,
  cwd: string
): Promise<CommandRes> {
  return new Promise<{ ok: true; res: string } | { ok: false; err: Error }>(
    function (resolve) {
      const command = `cd ${cwd} && ${_command}`;
      exec(command, (error: Error, stdout: string) => {
        if (error) {
          console.log("error: " + error.message + "\ncommand: " + _command);
          resolve({ ok: false, err: error });
          return;
        }

        resolve({
          ok: true,
          res: stdout.trim(),
        });
      });
    }
  );
}
