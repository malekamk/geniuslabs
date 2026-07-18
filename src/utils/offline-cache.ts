// Offline caching for material files (PDFs, worksheets, exam papers) using the
// SDK 54 expo-file-system File/Directory API (sync property access, async only
// for network calls) — not the legacy FileSystem.documentDirectory API.
import { Directory, File, Paths } from 'expo-file-system';

const CACHE_DIR = new Directory(Paths.cache, 'materials');

function extensionOf(remoteUrl: string): string {
  const match = /\.([a-zA-Z0-9]{1,6})(?:[?#]|$)/.exec(remoteUrl);
  return match ? `.${match[1]}` : '';
}

function cachedFile(materialId: string, remoteUrl: string): File {
  if (!CACHE_DIR.exists) CACHE_DIR.create({ intermediates: true, idempotent: true });
  return new File(CACHE_DIR, `${materialId}${extensionOf(remoteUrl)}`);
}

export async function getCachedMaterialUri(materialId: string, remoteUrl: string): Promise<string> {
  const file = cachedFile(materialId, remoteUrl);
  if (file.exists) return file.uri;
  const downloaded = await File.downloadFileAsync(remoteUrl, file, { idempotent: true });
  return downloaded.uri;
}

export async function isMaterialCached(materialId: string): Promise<boolean> {
  if (!CACHE_DIR.exists) return false;
  return CACHE_DIR.list().some(entry => entry instanceof File && entry.name.startsWith(materialId));
}

export async function clearMaterialCache(materialId: string): Promise<void> {
  if (!CACHE_DIR.exists) return;
  for (const entry of CACHE_DIR.list()) {
    if (entry instanceof File && entry.name.startsWith(materialId)) entry.delete();
  }
}
