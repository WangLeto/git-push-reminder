import * as vscode from "vscode";
import { checkGitRepo, getGitRemote } from "../git-remote/helper";

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

    const spaces = await getSpacesWithRepo(spaceFolders);
    console.log(
      "filter by repo",
      spaces.map((x) => x.path)
    );
    if (spaces.length === 0) {
      return null;
    }
    if (spaces.length === 1) {
      return spaces[0].raw;
    }
    const path = await quickPickWorkspace(spaces);
    return spaceFolders.find((space) => space.path === path)?.raw || null;
  };

const getSpacesWithRepo = async (
  spaces: ReturnType<typeof getWorkspaceFolders>
) => {
  const ifWithRepo = spaces.map(async (space) => {
    return {
      ...space,
      withRepo: await checkGitRepo(space.raw),
    };
  });

  const spacesWithRepo = (await Promise.all(ifWithRepo)).filter((space) => {
    return space.withRepo;
  });
  const withRemote = spacesWithRepo.map(async (space) => {
    const remote = await getGitRemote(space.raw);
    return {
      ...space,
      remote,
    };
  });
  const res = (await Promise.all(withRemote)).filter((space) => {
    return space.remote;
  });
  const remoteSet = new Set<string>();
  return res.filter((space) => {
    if (!space.remote) {
      return false;
    }
    if (remoteSet.has(space.remote)) {
      return false;
    }
    remoteSet.add(space.remote);
    return true;
  });
};
