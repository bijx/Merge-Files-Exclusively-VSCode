import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import ignore from 'ignore';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    'extension.mergeFilesRecursively',
    async (uri: vscode.Uri) => {
      const selectedRoot = uri.fsPath;
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
      const workspaceRoot = workspaceFolder
        ? workspaceFolder.uri.fsPath
        : selectedRoot;

      const config = vscode.workspace.getConfiguration('mergeFilesRecursively');
      const excludeIgnored = config.get<boolean>('excludeGitIgnored', true);
      const ignoreLocks = config.get<boolean>('ignorePackageLock', true);

      let igWorkspace: ReturnType<typeof ignore> | null = null;
      let igSelected: ReturnType<typeof ignore> | null = null;

      if (excludeIgnored) {
        const wsGitignore = path.join(workspaceRoot, '.gitignore');
        if (fs.existsSync(wsGitignore)) {
          igWorkspace = ignore();
          igWorkspace.add(fs.readFileSync(wsGitignore, 'utf8'));
        }

        const selGitignore = path.join(selectedRoot, '.gitignore');
        if (fs.existsSync(selGitignore)) {
          igSelected = ignore();
          igSelected.add(fs.readFileSync(selGitignore, 'utf8'));
        }
      }

      const outputPath = path.join(selectedRoot, 'output.txt');
      const stream = fs.createWriteStream(outputPath, { flags: 'w' });

      async function walk(dir: string) {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const e of entries) {
          const full = path.join(dir, e.name);
          const relToSelected = path.relative(selectedRoot, full);
          const relToWorkspace = path.relative(workspaceRoot, full);

          // Skip any path with hidden segments
          if (relToSelected.split(path.sep).some(seg => seg.startsWith('.'))) {
            continue;
          }

          // Skip output file itself
          if (relToSelected === 'output.txt') {
            continue;
          }

          // Skip lock files if enabled
          if (
            ignoreLocks &&
            ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'].includes(e.name)
          ) {
            continue;
          }

          // Skip if git-ignored
          if (
            excludeIgnored &&
            ((igWorkspace && igWorkspace.ignores(relToWorkspace)) ||
             (igSelected && igSelected.ignores(relToSelected)))
          ) {
            continue;
          }

          if (e.isDirectory()) {
            await walk(full);
          } else if (e.isFile()) {
            stream.write(`// ${relToSelected}\n`);
            const content = await fs.promises.readFile(full, 'utf8');
            stream.write(content + '\n');
          }
        }
      }

      try {
        await walk(selectedRoot);
        stream.end();
        vscode.window.showInformationMessage(`Merged into ${outputPath}`);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Error: ${err.message}`);
      }
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
