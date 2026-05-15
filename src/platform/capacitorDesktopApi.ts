import { Capacitor, registerPlugin } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { cacheImageDisplayUrl } from "./imageUrls";

const STATE_PATH = "state.json";
const IMAGES_DIR = "images";
const CLOUD_PATH = "Mnemo";
const WEBDAV_TIMEOUT = 15000;

const ALLOWED_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"]);
const ALLOWED_IMAGE_MIME = new Map<string, string>([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/jpg", ".jpg"],
  ["image/gif", ".gif"],
  ["image/webp", ".webp"],
  ["image/svg+xml", ".svg"],
  ["image/bmp", ".bmp"],
]);

interface MnemoWebDavPlugin {
  request(options: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    data?: string;
    dataIsBase64?: boolean;
    responseType?: "text" | "arraybuffer";
  }): Promise<{
    status: number;
    url: string;
    headers: Record<string, string>;
    data: string;
  }>;
}

const MnemoWebDav = registerPlugin<MnemoWebDavPlugin>("MnemoWebDav");

export function installCapacitorDesktopApi() {
  if (!Capacitor.isNativePlatform() || window.ebbinghausDesktop) return;

  window.ebbinghausDesktop = {
    platform: "android",
    controlWindow: () => undefined,
    setTitleBarTheme: () => undefined,
    setWindowPreferences: async () => ({ launchAtLogin: false }),
    setDirtyState: () => undefined,
    onConfirmClose: () => () => undefined,
    respondConfirmClose: () => undefined,
    exportMarkdown,
    saveImage,
    readImages,
    writeImages,
    pruneImages,
    getDataLocation: async () => "Android app data",
    readState,
    writeState,
    writeStateSync: () => ({ ok: false }),
    exportBackup,
    importBackup,
    cloudTestConnection,
    cloudFetchRemote,
    cloudUpload,
    cloudRestore,
  };
}

async function readState(): Promise<{ content: string | null }> {
  try {
    const result = await Filesystem.readFile({
      path: STATE_PATH,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    return { content: typeof result.data === "string" ? result.data : null };
  } catch {
    return { content: null };
  }
}

async function writeState(payload: { content: string; backup?: boolean }): Promise<{ ok: true }> {
  await Filesystem.writeFile({
    path: STATE_PATH,
    directory: Directory.Data,
    data: payload.content,
    encoding: Encoding.UTF8,
    recursive: true,
  });

  if (payload.backup) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await Filesystem.writeFile({
      path: `backups/state-${stamp}.json`,
      directory: Directory.Data,
      data: payload.content,
      encoding: Encoding.UTF8,
      recursive: true,
    }).catch(() => undefined);
  }

  return { ok: true };
}

async function exportBackup(payload: { defaultFileName: string; content: string }) {
  const path = `exports/${payload.defaultFileName}`;
  await Filesystem.writeFile({
    path,
    directory: Directory.Cache,
    data: payload.content,
    encoding: Encoding.UTF8,
    recursive: true,
  });
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
  await Share.share({
    title: "Mnemo backup",
    text: payload.defaultFileName,
    url: uri,
    dialogTitle: "Export Mnemo backup",
  });
  return { canceled: false as const, filePath: uri };
}

async function importBackup() {
  const content = await pickTextFile(".json,application/json");
  if (content === null) return { canceled: true as const };
  return { canceled: false as const, content };
}

async function exportMarkdown(payload: {
  defaultFileName: string;
  content: string;
  images?: Record<string, string>;
}) {
  const path = `exports/${payload.defaultFileName}`;
  await Filesystem.writeFile({
    path,
    directory: Directory.Cache,
    data: payload.content,
    encoding: Encoding.UTF8,
    recursive: true,
  });
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
  const sharedFiles = [uri];
  const assetsWritten = await writeExportAssets(payload.defaultFileName, payload.images ?? {}, sharedFiles);
  await Share.share({
    title: "Mnemo note",
    text: payload.defaultFileName,
    url: uri,
    files: sharedFiles,
    dialogTitle: "Export Markdown",
  });
  return { canceled: false as const, filePath: uri, assetsWritten };
}

async function saveImage(payload: { data: ArrayBuffer; mimeType: string; suggestedName?: string }) {
  const mime = (payload.mimeType || "").toLowerCase();
  const extFromMime = ALLOWED_IMAGE_MIME.get(mime);
  const suggestedExt = (payload.suggestedName ?? "").toLowerCase().match(/\.[a-z0-9]{2,5}$/)?.[0];
  const ext = extFromMime ?? (suggestedExt && ALLOWED_IMAGE_EXTENSIONS.has(suggestedExt) ? suggestedExt : null);
  if (!ext) return { error: "unsupported-image-type" };
  if (payload.data.byteLength === 0) return { error: "empty-image" };
  if (payload.data.byteLength > 20 * 1024 * 1024) return { error: "image-too-large" };

  const fileName = `${crypto.randomUUID().replace(/-/g, "")}${ext}`;
  const base64 = arrayBufferToBase64(payload.data);
  await Filesystem.writeFile({
    path: `${IMAGES_DIR}/${fileName}`,
    directory: Directory.Data,
    data: base64,
    recursive: true,
  });
  cacheImageDisplayUrl(fileName, `data:${mime || mimeTypeFromFileName(fileName)};base64,${base64}`);
  return { url: `mnemo-image://${fileName}`, fileName };
}

async function readImages(fileNames: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  if (!Array.isArray(fileNames)) return result;

  await Promise.all(
    fileNames.map(async (rawName) => {
      const fileName = String(rawName ?? "");
      if (!safeImageName(fileName)) return;
      try {
        const file = await Filesystem.readFile({
          path: `${IMAGES_DIR}/${fileName}`,
          directory: Directory.Data,
        });
        if (typeof file.data === "string") {
          result[fileName] = stripDataUrlPrefix(file.data);
          cacheImageDisplayUrl(fileName, `data:${mimeTypeFromFileName(fileName)};base64,${result[fileName]}`);
        }
      } catch {
        // Missing images should not block backups or note rendering.
      }
    }),
  );

  return result;
}

async function writeImages(bundle: Record<string, string>): Promise<{ written: number }> {
  if (!bundle || typeof bundle !== "object") return { written: 0 };
  let written = 0;

  for (const [fileName, base64] of Object.entries(bundle)) {
    if (!safeImageName(fileName) || typeof base64 !== "string") continue;
    if (base64.length > 40 * 1024 * 1024) continue;
    await Filesystem.writeFile({
      path: `${IMAGES_DIR}/${fileName}`,
      directory: Directory.Data,
      data: stripDataUrlPrefix(base64),
      recursive: true,
    });
    cacheImageDisplayUrl(fileName, `data:${mimeTypeFromFileName(fileName)};base64,${stripDataUrlPrefix(base64)}`);
    written += 1;
  }

  return { written };
}

async function pruneImages(keepNames: string[]): Promise<{ removed: number }> {
  const keep = new Set(Array.isArray(keepNames) ? keepNames.filter(safeImageName) : []);
  let removed = 0;
  let entries: { name: string; type: "file" | "directory" }[] = [];
  try {
    const result = await Filesystem.readdir({ path: IMAGES_DIR, directory: Directory.Data });
    entries = result.files.map((file) => ({
      name: file.name,
      type: file.type === "directory" ? "directory" : "file",
    }));
  } catch {
    return { removed: 0 };
  }

  await Promise.all(
    entries.map(async (entry) => {
      if (entry.type !== "file" || !safeImageName(entry.name) || keep.has(entry.name)) return;
      try {
        await Filesystem.deleteFile({ path: `${IMAGES_DIR}/${entry.name}`, directory: Directory.Data });
        removed += 1;
      } catch {
        // Best effort cleanup.
      }
    }),
  );

  return { removed };
}

async function cloudTestConnection(config: { url: string; username: string; password: string }) {
  try {
    const response = await nativeHttpRequest({
      url: stripTrailingSlash(config.url),
      method: "PROPFIND",
      headers: {
        Authorization: webdavAuth(config),
        Depth: "0",
      },
    });
    if (response.status >= 200 && response.status < 300) return { ok: true as const };
    if (response.status === 401) return { ok: false as const, error: "认证失败，请检查用户名和应用密码。" };
    return { ok: false as const, error: `服务器返回 ${response.status} ${response.statusText}` };
  } catch (error) {
    return { ok: false as const, error: `连接失败：${(error as Error).message}` };
  }
}

async function cloudFetchRemote(config: { url: string; username: string; password: string }) {
  const result = await webdavRequest(config, "/state.json");
  if (result.status === 404) return { ok: false as const, error: "云端暂无备份数据。", notFound: true };
  if (result.error) return { ok: false as const, error: result.error };
  try {
    const text = await result.response!.text();
    return { ok: true as const, data: JSON.parse(text) };
  } catch {
    return { ok: false as const, error: "云端数据格式无效。" };
  }
}

async function cloudUpload(payload: {
  url: string;
  username: string;
  password: string;
  content: string;
  images?: Record<string, string>;
}) {
  await webdavRequest(payload, "/", { method: "MKCOL" }).catch(() => undefined);
  await webdavRequest(payload, "/images/", { method: "MKCOL" }).catch(() => undefined);

  let result = await webdavRequest(payload, "/state.json", { method: "PUT", body: payload.content });
  if (result.error) return { ok: false as const, error: `上传数据失败：${result.error}` };

  for (const [name, base64] of Object.entries(payload.images ?? {})) {
    if (!safeImageName(name) || base64.length > 40 * 1024 * 1024) continue;
    result = await webdavRequest(payload, `/images/${name}`, {
      method: "PUT",
        body: stripDataUrlPrefix(base64),
        bodyIsBase64: true,
        headers: { "Content-Type": "application/octet-stream" },
      });
    if (result.error) console.warn(`Failed to upload image ${name}: ${result.error}`);
  }

  return { ok: true as const };
}

async function cloudRestore(config: { url: string; username: string; password: string }) {
  const stateResult = await webdavRequest(config, "/state.json");
  if (stateResult.error) return { ok: false as const, error: `下载数据失败：${stateResult.error}` };
  const content = await stateResult.response!.text();

  const images: Record<string, string> = {};
  const listResult = await webdavRequest(config, "/images/", { method: "PROPFIND", headers: { Depth: "1" } });
  if (listResult.response) {
    try {
      const listText = await listResult.response.text();
      const names = Array.from(listText.matchAll(/<D:href>[^<]*\/images\/([^<]+)<\/D:href>/gi))
        .map((match) => decodeURIComponent(match[1]))
        .filter(safeImageName);
      for (const name of names) {
        const imageResult = await webdavRequest(config, `/images/${name}`, { responseType: "arraybuffer" });
        if (!imageResult.response) continue;
        images[name] = await imageResult.response.arrayBuffer();
      }
    } catch {
      // Image restore is best effort.
    }
  }

  return { ok: true as const, content, images };
}

async function webdavRequest(
  config: { url: string; username: string; password: string },
  path: string,
  options: {
    method?: string;
    body?: string;
    bodyIsBase64?: boolean;
    headers?: Record<string, string>;
    responseType?: "text" | "arraybuffer";
  } = {},
) {
  try {
    const response = await nativeHttpRequest({
      url: `${stripTrailingSlash(config.url)}/${CLOUD_PATH}${path}`,
      method: options.method ?? "GET",
      headers: {
        Authorization: webdavAuth(config),
        ...(typeof options.body === "string" ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      data: options.body,
      dataIsBase64: options.bodyIsBase64,
      responseType: options.responseType,
    });

    if (response.status < 200 || response.status >= 300) {
      if (response.status === 404 || response.status === 409) return { status: 404 as const };
      return { status: response.status, error: `${response.status} ${response.statusText}` };
    }
    return { status: response.status, response };
  } catch (error) {
    return { status: 0, error: `网络错误：${(error as Error).message}` };
  }
}

async function nativeHttpRequest(options: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  data?: string;
  dataIsBase64?: boolean;
  responseType?: "text" | "arraybuffer";
}) {
  const response = await MnemoWebDav.request(options);
  return {
    status: response.status,
    statusText: "",
    async text() {
      return typeof response.data === "string" ? response.data : "";
    },
    async arrayBuffer() {
      return typeof response.data === "string" ? response.data : "";
    },
  };
}

function pickTextFile(accept: string): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    input.oncancel = () => {
      input.remove();
      resolve(null);
    };
    input.onchange = () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    };
    document.body.appendChild(input);
    input.click();
  });
}

async function writeExportAssets(
  defaultFileName: string,
  images: Record<string, string>,
  sharedFiles: string[],
) {
  let assetsWritten = 0;
  const baseName = defaultFileName.replace(/\.[^.]+$/, "");
  for (const [fileName, base64] of Object.entries(images)) {
    if (!safeImageName(fileName) || typeof base64 !== "string") continue;
    if (base64.length > 40 * 1024 * 1024) continue;
    const path = `exports/${baseName}-assets/${fileName}`;
    await Filesystem.writeFile({
      path,
      directory: Directory.Cache,
      data: stripDataUrlPrefix(base64),
      recursive: true,
    });
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
    sharedFiles.push(uri);
    assetsWritten += 1;
  }
  return assetsWritten;
}

function safeImageName(name: string) {
  return /^[0-9a-f]{16,64}\.[a-z0-9]{2,5}$/.test(name);
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function webdavAuth(config: { username: string; password: string }) {
  return `Basic ${btoa(unescape(encodeURIComponent(`${config.username}:${config.password}`)))}`;
}

function stripDataUrlPrefix(value: string) {
  return value.replace(/^data:[^;]+;base64,/, "");
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
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
