import type { Track } from '../types';
import { generateId } from './timeUtils';

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
  blobUrl: string;
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
    const blob = new Blob([data]);
    const blobUrl = URL.createObjectURL(blob);
    const name = path.split(/[/\\]/).pop()?.replace(/\.[^/.]+$/, '') || 'Unknown';
    results.push({ name, path, blobUrl });
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
        const blob = new Blob([data]);
        const blobUrl = URL.createObjectURL(blob);
        const name = entry.name.replace(/\.[^/.]+$/, '');
        results.push({ name, path: fullPath, blobUrl });
      } catch { /* skip unreadable files */ }
    }
  }

  return results;
}

export async function readFileAsBlobUrl(path: string): Promise<string | null> {
  const mods = await getTauriModules();
  if (!mods) return null;
  try {
    const data = await mods.fs.readFile(path);
    const blob = new Blob([data]);
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export function filesToTracks(files: LocalFileResult[]): Track[] {
  return files.map(f => ({
    id: generateId(),
    name: f.name,
    url: f.blobUrl,
    filePath: f.path,
    sourceFileName: f.path.split(/[/\\]/).pop() || f.name,
    duration: 0,
  }));
}
