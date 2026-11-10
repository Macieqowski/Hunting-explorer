// App only: tiles of saved offline areas live as files in the app's own storage
// (files/tiles/ on the phone), not in the WebView's database, which Android may clear
// when the phone runs out of space. The database keeps only the file name.
// A tile's file name comes from its URL, so storing the same tile again overwrites it.

import { Capacitor } from '@capacitor/core';

const DIR = 'tiles';
let base: Promise<string> | null = null;

async function fs() {
  return import('@capacitor/filesystem');
}

/** A 53-bit hash of the tile URL (cyrb53), as hex. */
export function tileFileName(url: string, mime = 'image/png'): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < url.length; i++) {
    const c = url.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
  return `${hash}.${/jpe?g/.test(mime) ? 'jpg' : 'png'}`;
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Writes a tile and returns its file name. */
export async function writeTileFile(url: string, blob: Blob): Promise<string> {
  const { Filesystem, Directory } = await fs();
  const name = tileFileName(url, blob.type);
  await Filesystem.writeFile({ path: `${DIR}/${name}`, data: await toBase64(blob), directory: Directory.Data, recursive: true });
  return name;
}

/** Reads a tile through the app's local web server (no base64 round trip). */
export async function readTileFile(name: string): Promise<Blob> {
  if (!base)
    base = fs()
      .then(({ Filesystem, Directory }) => Filesystem.getUri({ path: DIR, directory: Directory.Data }))
      .then((r) => Capacitor.convertFileSrc(r.uri).replace(/\/?$/, '/'));
  base.catch(() => (base = null));
  const res = await fetch((await base) + name);
  if (!res.ok) throw new Error(`tile file ${res.status}`);
  return res.blob();
}

export async function deleteTileFiles(names: string[]): Promise<void> {
  if (!names.length) return;
  const { Filesystem, Directory } = await fs();
  for (const name of names) await Filesystem.deleteFile({ path: `${DIR}/${name}`, directory: Directory.Data }).catch(() => {});
}
