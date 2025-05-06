# Merge Files Recursively

A simple Visual Studio Code extension that adds a **right-click folder action** to recursively merge all files inside that folder and its subfolders into a single `output.txt`. Useful for passing as context to LLMs for debugging, packaging, or reviewing multiple source files at once.

Optimized for JS/TS projects, but works well with anything.

---

## Settings

| Setting                                 | Default | Description |
|----------------------------------------|---------|-------------|
| `mergeFilesRecursively.excludeGitIgnored` | `true`  | Exclude files ignored by `.gitignore` files (both workspace and target folder) |
| `mergeFilesRecursively.ignorePackageLock` | `true`  | Exclude lock files like `package-lock.json`, `yarn.lock`, etc. |
| `mergeFilesRecursively.excludeMediaFiles` | `true`  | Exclude media files (images, videos, audio) when merging. |

You can configure these under **Settings → Extensions → Merge Files Recursively**.

---

## How to Use

1. **Right-click** on any folder in the Explorer sidebar.
2. Select **"Merge files recursively"**
3. A file named `output.txt` will be created inside that folder, containing all merged content.

---

## Notes

- Only visible when right-clicking on folders (not files).
- Output file is always named `output.txt` and will overwrite any existing file with that name in the selected folder.
- Supports large folders, respects `.gitignore` intelligently.

---

## License

MIT — Free to use and modify.
