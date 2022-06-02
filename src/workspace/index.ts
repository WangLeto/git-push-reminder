import * as vscode from "vscode";

type WorkspaceChoice = {
  name: string;
  path: string;
};

const getWorkspace = () => vscode.workspace.workspaceFolders;
const getWorkspaceFolders = () =>
  (getWorkspace() || []).map((space) => ({
    name: space.name,
    path: space.uri.path,
    raw: space,
  }));

const quickPickWorkspace = async (spaces: WorkspaceChoice[]) => {
  const quickPick = vscode.window.createQuickPick();
  quickPick.title = "Select a workspace for GitReminder to watch";
  quickPick.items = spaces.map((space) => ({
    label: space.name,
    detail: space.path,
  }));
  return new Promise<string | null>((resolve) => {
    quickPick.onDidChangeSelection((e) => {
      if (e[0]) {
        const path = e[0].detail;
        resolve(path || null);
        quickPick.dispose();
      }
    });
    quickPick.onDidHide(() => {
      quickPick.dispose();
      resolve(null);
    });
    quickPick.show();
  });
};

export const pickWorkspace =
  async (): Promise<vscode.WorkspaceFolder | null> => {
    const spaceFolders = getWorkspaceFolders();
    if (spaceFolders.length === 0) {
      return null;
    }
    if (spaceFolders.length === 1) {
      return spaceFolders[0].raw;
    }
    const path = await quickPickWorkspace(spaceFolders);
    return spaceFolders.find((space) => space.path === path)?.raw || null;
  };
