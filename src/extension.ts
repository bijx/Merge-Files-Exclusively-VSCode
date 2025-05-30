import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import ignore from 'ignore';

const MEDIA_EXTENSIONS = [
  // Image formats
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.tif', '.webp', '.svg', '.ico', '.heic', '.heif', 
  '.raw', '.cr2', '.nef', '.arw', '.dng', '.psd', '.ai', '.eps', '.pdf', '.xcf',
  
  // Video formats
  '.mp4', '.mov', '.avi', '.wmv', '.flv', '.webm', '.mkv', '.m4v', '.mpg', '.mpeg', '.3gp',
  '.mts', '.m2ts', '.vob', '.ogv', '.rm', '.rmvb', '.asf', '.m2v', '.divx',
  
  // Audio formats
  '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma', '.aiff', '.alac', '.mid', '.midi', 
  '.amr', '.ape', '.opus', '.ac3', '.dts', '.ra', '.voc'
];

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
      const excludeMediaFiles = config.get<boolean>('excludeMediaFiles', true);
      const customExcludedExtensionsString = config.get<string>('customExcludedExtensions', '');
      const maxLineLength = config.get<number>('maxLineLength', -1);
      
      // Parse custom excluded extensions
      const customExcludedExtensions = customExcludedExtensionsString
        .split(',')
        .map(ext => ext.trim())
        .filter(ext => ext.length > 0)
        .map(ext => ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`);

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
      
      // Track if we've written any files
      let hasProcessedFiles = false;

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

          // Skip media files if enabled
          if (
            excludeMediaFiles &&
            MEDIA_EXTENSIONS.some(ext => e.name.toLowerCase().endsWith(ext))
          ) {
            continue;
          }

          // Skip files with custom excluded extensions
          if (
            customExcludedExtensions.length > 0 &&
            customExcludedExtensions.some(ext => e.name.toLowerCase().endsWith(ext))
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
            try {
              // Check file line count if max line length is set
              if (maxLineLength >= 0) {
                // Read file content
                const content = await fs.promises.readFile(full, 'utf8');
                // Count lines (adding 1 because split on newlines gives array length of lines + 1)
                const lineCount = content.split('\n').length;
                
                // Skip file if it exceeds the max line length
                if (lineCount > maxLineLength) {
                  continue;
                }
                
                // Write file to output
                stream.write(`// ${relToSelected}\n`);
                stream.write(content + '\n');
                hasProcessedFiles = true;
              } else {
                // No line limit, just read and write the file
                stream.write(`// ${relToSelected}\n`);
                const content = await fs.promises.readFile(full, 'utf8');
                stream.write(content + '\n');
                hasProcessedFiles = true;
              }
            } catch (err) {
              console.error(`Error processing file ${full}: ${err}`);
              // Skip this file but continue with others
            }
          }
        }
      }

      try {
        await walk(selectedRoot);
        
        // If no files were processed, write a helpful message
        if (!hasProcessedFiles) {
          stream.write("// If your output file is empty, try checking the extension settings to include specific file types\n");
        }
        
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
