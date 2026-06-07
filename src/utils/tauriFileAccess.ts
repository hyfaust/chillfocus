let tauriDialog: typeof import('@tauri-apps/plugin-dialog') | null = null;
let tauriFs: typeof import('@tauri-apps/plugin-fs') | null = null;

async function getTauriModules() {
  if (tauriDialog && tauriFs) return { dialog: tauriDialog, fs: tauriFs };
  try {
    tauriDialog = await import('@tauri-apps/plugin-dialog');
    tauriFs = await import('@tauri-apps/plugin-fs');
    return { dialog: tauriDialog, fs: tauriFs };
  } catch {
    return null;
  }
}

export async function isTauri(): Promise<boolean> {
  return !!(window as any).__TAURI__ || !!(await getTauriModules());
}

export interface LocalFileResult {
  name: string;
  path: string;
  file: File;
}

export async function selectAudioFiles(): Promise<LocalFileResult[]> {
  const mods = await getTauriModules();
  if (!mods) return [];

  const selected = await mods.dialog.open({
    multiple: true,
    filters: [{
      name: 'Audio',
      extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus', 'webm', 'weba'],
    }],
  });

  if (!selected) return [];

  const paths = Array.isArray(selected) ? selected : [selected];
  const results: LocalFileResult[] = [];

  for (const path of paths) {
    const data = await mods.fs.readFile(path);
    const fileName = path.split(/[/\\]/).pop() || 'Unknown';
    const file = new File([data], fileName);
    results.push({ name: fileName, path, file });
  }

  return results;
}

export async function selectAudioDirectory(): Promise<LocalFileResult[]> {
  const mods = await getTauriModules();
  if (!mods) return [];

  const dir = await mods.dialog.open({ directory: true });
  if (!dir || typeof dir !== 'string') return [];

  const entries = await mods.fs.readDir(dir as string);
  const audioExts = /\.(mp3|wav|ogg|flac|aac|m4a|opus|webm|weba)$/i;
  const results: LocalFileResult[] = [];

  for (const entry of entries) {
    if (entry.isFile && audioExts.test(entry.name)) {
      const fullPath = `${dir}\\${entry.name}`;
      try {
        const data = await mods.fs.readFile(fullPath);
        const file = new File([data], entry.name);
        results.push({ name: entry.name, path: fullPath, file });
      } catch { /* skip unreadable files */ }
    }
  }

  return results;
}

export async function readFileAsBlobUrl(path: string): Promise<string | null> {
  const mods = await getTauriModules();
  if (!mods) return null;
  try {
    console.log('[Tauri] Reading file from disk:', path);
    const data = await mods.fs.readFile(path);
    console.log('[Tauri] Read', data.byteLength, 'bytes');
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    console.log('[Tauri] Created blob URL:', url.substring(0, 50));
    return url;
  } catch (err) {
    console.error('[Tauri] Failed to read file:', path, err);
    return null;
  }
}

export function filesToFileArray(results: LocalFileResult[]): File[] {
  return results.map(r => r.file);
}

export function filesToFilePaths(results: LocalFileResult[]): string[] {
  return results.map(r => r.path);
}
