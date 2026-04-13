import { execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export class MarkitdownNotInstalledError extends Error {
  constructor() {
    super('markitdown executable not found');
    this.name = 'MarkitdownNotInstalledError';
  }
}

const CONVERTIBLE_EXTENSIONS = [
  '.pdf', '.docx', '.pptx', '.xlsx',
  '.html', '.htm',
  '.csv', '.json', '.xml',
  '.epub',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.bmp',
  '.wav', '.mp3', '.m4a',
  '.zip',
  '.txt', '.rst', '.rtf',
] as const;

const MARKDOWN_EXTENSIONS = ['.md', '.markdown'] as const;

export type ConvertibleExtension = typeof CONVERTIBLE_EXTENSIONS[number];

export const isMarkdownFile = (filePath: string): boolean => {
  const ext = path.extname(filePath).toLowerCase();
  return (MARKDOWN_EXTENSIONS as readonly string[]).includes(ext);
};

export const isConvertibleFile = (filePath: string): boolean => {
  const ext = path.extname(filePath).toLowerCase();
  return (CONVERTIBLE_EXTENSIONS as readonly string[]).includes(ext);
};

export const isSupportedFile = (filePath: string): boolean => {
  return isMarkdownFile(filePath) || isConvertibleFile(filePath);
};

export const ALL_SUPPORTED_EXTENSIONS = [
  ...MARKDOWN_EXTENSIONS,
  ...CONVERTIBLE_EXTENSIONS,
] as const;

const resolveOnPath = (): string | null => {
  try {
    const found = execFileSync('/usr/bin/which', ['markitdown'], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${process.env.PATH ?? ''}:/usr/local/bin:/opt/homebrew/bin` },
    }).trim();
    return found && fs.existsSync(found) ? found : null;
  } catch {
    return null;
  }
};

const getMarkitdownPath = (): string | null => {
  const candidates: string[] = [];
  if (app.isPackaged) {
    candidates.push(path.join(process.resourcesPath, '.venv', 'bin', 'markitdown'));
  } else {
    const appPath = app.getAppPath();
    candidates.push(
      path.join(appPath, '.venv', 'bin', 'markitdown'),
      path.join(appPath, '..', '..', '.venv', 'bin', 'markitdown'),
      path.join(process.cwd(), '.venv', 'bin', 'markitdown'),
    );
  }
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return resolveOnPath();
};

export const convertToMarkdown = (filePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const markitdownBin = getMarkitdownPath();
    if (!markitdownBin) {
      reject(new MarkitdownNotInstalledError());
      return;
    }
    const resolvedPath = path.resolve(filePath);

    execFile(markitdownBin, [resolvedPath], { timeout: 30000, maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`markitdown conversion failed: ${error.message}`));
        return;
      }
      if (stderr) {
        console.warn('[markitdown] stderr:', stderr);
      }
      resolve(stdout);
    });
  });
};

export const getFileDialogFilters = (): Electron.FileFilter[] => [
  { name: 'All Supported', extensions: ['md', 'markdown', 'pdf', 'docx', 'pptx', 'xlsx', 'html', 'htm', 'csv', 'json', 'xml', 'epub', 'txt', 'rst', 'rtf', 'zip'] },
  { name: 'Markdown', extensions: ['md', 'markdown'] },
  { name: 'Documents', extensions: ['pdf', 'docx', 'pptx', 'xlsx', 'epub', 'rtf'] },
  { name: 'Web & Data', extensions: ['html', 'htm', 'csv', 'json', 'xml'] },
  { name: 'All Files', extensions: ['*'] },
];
