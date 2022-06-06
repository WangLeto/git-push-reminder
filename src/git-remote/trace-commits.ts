import * as vscode from "vscode";
import fs = require("fs");
import path = require("path");
import {
  findOutGitFolder,
  statusbarMessageHandler,
  updateRemote,
} from "./helper";
import { runCommand } from "./run-command";
import { debounce } from "../utils";

export const traceUnPushedCommit = async (
  workspace: vscode.WorkspaceFolder
) => {
  const workspacePath = workspace.uri.path;
  // first scan
  doScan(workspacePath, "initial");
  const gitFolder = path.resolve(await findOutGitFolder(workspace), ".git");
  fs.watch(gitFolder, (_, name) => {
    if (name !== "HEAD") {
      return;
    }
    scanByChangeDebounced(workspacePath);
  });
  fs.watch(path.resolve(gitFolder, "refs/heads"), () => {
    scanByChangeDebounced(workspacePath);
  });
};

const scanByChangeDebounced = debounce(
  (workspacePath: string) => doScan(workspacePath, "head file change"),
  300
);

const scan = async (workspace: string, source: string) => {
  console.log(`scanning for un-pushed commits by: ${source}`);
  await syncRemoteWithProgress(workspace);
  const branchInfo = await getBranchInfo(workspace);
  if (branchInfo.state !== "ok") {
    handleBranchState(branchInfo, workspace);
    return;
  }
  const unPushed = await getUnPushedCommits(workspace);
  if (!unPushed) {
    const dispose = vscode.window.setStatusBarMessage(
      "[GitReminder]: 👌 All pushed"
    );
    statusbarMessageHandler.set(dispose);
  } else {
    const dispose = vscode.window.setStatusBarMessage(
      `[GitReminder]: 🧐 ${unPushed} commit${unPushed > 1 ? "s" : ""} to push`
    );
    statusbarMessageHandler.set(dispose);
    if (unPushed >= 2) {
      await showMessageAdvicePushing(unPushed, workspace, branchInfo);
    }
  }
};

const syncRemoteWithProgress = async (workspace: string) => {
  statusbarMessageHandler.dispose();
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      cancellable: false,
      title: "Sync remote",
    },
    async (progress) => {
      progress.report({ message: "Sync remote origin...", increment: 20 });
      const res = await updateRemote(workspace);
      progress.report({
        message: res.ok ? "Updated" : res.err.message,
        increment: 100,
      });
    }
  );
};

const getUnPushedCommits = async (folder: string): Promise<number> => {
  // https://stackoverflow.com/a/2016954/7526989
  const res = await runCommand("git log @{u}..HEAD --oneline | wc -l", folder);
  if (res.ok) {
    return +res.res;
  }
  return 0;
};

const checkHasUpstreamBranch = async (workspace: string) => {
  const res = await runCommand("git log @{u}..HEAD", workspace);
  return res.ok;
};

type BranchState = "ok" | "no_upstream" | "detached_head";
type BranchInfo = {
  state: BranchState;
  branch: string;
};

const getBranchInfo = async (workspace: string) => {
  const hasUpstream = await checkHasUpstreamBranch(workspace);
  const res = await runCommand("git branch --show-current", workspace);
  const branch = res.ok ? res.res : "";
  if (!branch) {
    return { state: "detached_head" as const, branch };
  }
  if (!hasUpstream) {
    return { state: "no_upstream" as const, branch };
  }
  return { state: "ok" as const, branch };
};

const handleBranchState = (info: BranchInfo, workspace: string) => {
  const { state, branch } = info;
  switch (state) {
    case "no_upstream":
      const disposeNoUpstream = vscode.window.setStatusBarMessage(
        `[GitReminder]: 🫢 no upstream for <${branch}>`
      );
      statusbarMessageHandler.set(disposeNoUpstream);
      notifyNoUpstreamAndPush(branch, workspace);
      return;
    case "detached_head":
      const disposeDetached = vscode.window.setStatusBarMessage(
        "[GitReminder]: 🤷‍♂️ Detached head"
      );
      statusbarMessageHandler.set(disposeDetached);
      return;
    default:
      return;
  }
};

const doScan = async (workspace: string, source: string) => {
  return scan(workspace, source).catch((e) => {
    console.error(`fail to scan, from ${source}`, e);
  });
};

const pushBranchWithProgress = async (
  branch: string,
  workspace: string,
  setUpstream: boolean
) => {
  statusbarMessageHandler.dispose();
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      cancellable: false,
      title: `Push branch <${branch}>`,
    },
    async (progress) => {
      progress.report({ message: "Pushing...", increment: 20 });
      await runCommand(
        `git push ${setUpstream ? "-u" : ""} origin ${branch}`,
        workspace
      );
      progress.report({ message: "Pushed", increment: 100 });
    }
  );
};

const notifyNoUpstreamAndPush = async (branch: string, workspace: string) => {
  const selection = await vscode.window.showInformationMessage(
    `[GitReminder]: On branch <${branch}>, no upstream found. `,
    "push it now"
  );
  if (!selection) {
    return;
  }
  await pushBranchWithProgress(branch, workspace, true);
  doScan(workspace, "pushed branch");
};

const showMessageAdvicePushing = async (
  unPushed: number,
  workspace: string,
  branchInfo: BranchInfo
) => {
  const { branch } = branchInfo;
  const selection = await vscode.window.showInformationMessage(
    `[GitReminder]: You have ${unPushed} commits to push on branch <${branch}>. `,
    "push it now"
  );
  if (!selection) {
    return;
  }
  await pushBranchWithProgress(branch, workspace, false);
  doScan(workspace, "pushed branch");
};
