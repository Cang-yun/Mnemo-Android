import { collectImageReferences } from "../utils/imageRefs";

const IMAGE_SCHEME_PREFIX = "mnemo-image://";

const displayUrlCache = new Map<string, string>();

export function cacheImageDisplayUrl(fileName: string, displayUrl: string) {
  if (!fileName || !displayUrl) return;
  displayUrlCache.set(fileName, displayUrl);
}

export function resolveImageDisplayUrl(url: string) {
  if (!url.startsWith(IMAGE_SCHEME_PREFIX)) return url;
  const fileName = url.slice(IMAGE_SCHEME_PREFIX.length);
  return displayUrlCache.get(fileName) ?? url;
}

export async function hydrateImageDisplayCache(
  markdown: string,
  readImages?: (fileNames: string[]) => Promise<Record<string, string>>,
) {
  if (!readImages) return;
  const missing = collectImageReferences(markdown).filter((name) => !displayUrlCache.has(name));
  if (missing.length === 0) return;

  const images = await readImages(missing);
  for (const [fileName, base64] of Object.entries(images)) {
    const mimeType = mimeTypeFromFileName(fileName);
    cacheImageDisplayUrl(fileName, `data:${mimeType};base64,${base64}`);
  }
}

function mimeTypeFromFileName(fileName: string) {
  const ext = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "bmp") return "image/bmp";
  return "image/png";
}
