import { Disposable, WorkspaceFolder } from "vscode";
import { sleep } from "../utils";
import { CommandRes, runCommand } from "./run-command";

export type RemoteState = "ok" | "no_repo" | "fetch_error";

export const checkGitRepo = async (workspace: WorkspaceFolder) => {
  const path = workspace.uri.path;
  const res = await runCommand("git status", path);
  return res.ok;
};

export const getGitRemote = async (workspace: WorkspaceFolder) => {
  const path = workspace.uri.path;
  const remoteRes = await runCommand("git remote -v", path);
  return remoteRes.ok ? remoteRes.res : null;
};

export const getGitRemoteInfo = async (
  workspace: WorkspaceFolder
): Promise<{ state: RemoteState; extra?: string }> => {
  const updateRes = await updateRemote(workspace);
  if (!updateRes.ok) {
    return { state: "fetch_error", extra: updateRes.err.message };
  }
  return { state: "ok" };
};

export const updateRemote = async (workspace: WorkspaceFolder | string) => {
  const path = typeof workspace === "string" ? workspace : workspace.uri.path;
  const timeout = sleep(6000).then(() => {
    const res: CommandRes = {
      err: new Error("timeout"),
      ok: false,
    };
    return res;
  });
  const res = await Promise.race([
    runCommand("git remote update origin --prune", path),
    timeout,
  ]);
  return res;
};

export const findOutGitFolder = async (
  workspace: WorkspaceFolder
): Promise<string> => {
  const res = await runCommand(
    "git rev-parse --show-toplevel",
    workspace.uri.path
  );
  if (!res.ok) {
    return workspace.uri.path;
  }
  return res.res;
};

class StatusBarMessageHandler {
  private handler: Disposable | undefined;
  set(disposable: Disposable) {
    this.handler = disposable;
  }
  dispose() {
    if (this.handler) {
      this.handler.dispose();
    }
  }
}

export const statusbarMessageHandler = new StatusBarMessageHandler();
