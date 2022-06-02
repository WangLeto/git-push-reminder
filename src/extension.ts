import * as vscode from "vscode";
import { getGitRemoteInfo } from "./git-remote/helper";
import { traceUnPushedCommit } from "./git-remote/trace-commits";
import { pickWorkspace } from "./workspace";

export async function activate(context: vscode.ExtensionContext) {
  const workspace = await pickWorkspace();
  if (workspace) {
    const remoteInfo = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: "Checking remote",
      },
      async () => await getGitRemoteInfo(workspace)
    );
    if (remoteInfo.state === "no_repo") {
      vscode.window.showInformationMessage("No remote repository found. ");
    } else if (remoteInfo.state === "fetch_error") {
      vscode.window.showErrorMessage(
        `Fetch remote error: ${remoteInfo.extra}.`
      );
    } else {
      traceUnPushedCommit(workspace);
    }
  }
}

// this method is called when your extension is deactivated
export function deactivate() {}
