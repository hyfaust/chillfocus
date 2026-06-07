export async function openExternalUrl(url: string): Promise<void> {
  try {
    if ((window as any).__TAURI_INTERNALS__) {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
