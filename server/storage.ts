import { createReadStream } from "node:fs";
import { access, realpath } from "node:fs/promises";
import path from "node:path";

export type PrivateFile = {
  stream: ReturnType<typeof createReadStream>;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
};

export interface StorageService {
  exists(storageKey: string): Promise<boolean>;
  download(storageKey: string, metadata: Omit<PrivateFile, "stream">): Promise<PrivateFile>;
}

function storageRoot(): string {
  return (process.env.PRIVATE_STORAGE_ROOT ?? "").trim();
}

export class DevelopmentFileStorage implements StorageService {
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  private resolve(storageKey: string) {
    const resolved = path.resolve(this.root, storageKey);
    if (resolved !== this.root && !resolved.startsWith(`${this.root}${path.sep}`)) {
      throw new Error("Invalid storage key");
    }
    return resolved;
  }

  // Resolves symlinks and re-checks containment: a symlink inside the root
  // pointing outside must never be served.
  private async resolveReal(storageKey: string) {
    const resolved = this.resolve(storageKey);
    const real = await realpath(resolved);
    if (real !== this.root && !real.startsWith(`${this.root}${path.sep}`)) {
      throw new Error("Invalid storage key");
    }
    return real;
  }

  async exists(storageKey: string) {
    try {
      await access(await this.resolveReal(storageKey));
      return true;
    } catch {
      return false;
    }
  }

  async download(storageKey: string, metadata: Omit<PrivateFile, "stream">) {
    const filePath = await this.resolveReal(storageKey);
    if (!(await this.exists(storageKey))) throw new Error("Digital asset is unavailable");
    return { ...metadata, stream: createReadStream(filePath) };
  }
}

class UnconfiguredPrivateStorage implements StorageService {
  async exists() {
    return false;
  }

  async download(_storageKey: string, _metadata: Omit<PrivateFile, "stream">): Promise<PrivateFile> {
    throw new Error("Private storage is not configured");
  }
}

/**
 * Lazily resolved private storage.
 *
 * ETAPE 10 fix: the previous implementation only enabled file storage when
 * `!isProduction`, which silently disabled ALL real downloads in production.
 * The private root is now honoured in every environment whenever
 * PRIVATE_STORAGE_ROOT is set. Resolution is lazy (per access, via
 * `process.env`) so tests can stub the variable after import and production
 * can rely on the runtime environment rather than import order.
 *
 * The root must be a directory that is never served by `express.static`.
 * Only `/api/download/:token` (paid order + valid grant required) may hand
 * out bytes from it.
 */
export const storage: StorageService = new Proxy(new UnconfiguredPrivateStorage(), {
  get(_target, prop, receiver) {
    const root = storageRoot();
    const delegate: StorageService = root
      ? new DevelopmentFileStorage(root)
      : new UnconfiguredPrivateStorage();
    const value = Reflect.get(delegate, prop, delegate);
    return typeof value === "function" ? value.bind(delegate) : value;
  },
});
