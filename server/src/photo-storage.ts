export class PhotoStorageError extends Error {
  readonly operation: "upload" | "download" | "delete" | "configure";
  readonly status: number;

  constructor(operation: "upload" | "download" | "delete" | "configure", status: number) {
    super(`photo storage ${operation} failed (${status})`);
    this.name = "PhotoStorageError";
    this.operation = operation;
    this.status = status;
  }
}

export interface PhotoStorage {
  put(key: string, body: ArrayBuffer): Promise<void>;
  get(key: string): Promise<Response | null>;
  delete(keys: string[]): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
}

interface PhotoStorageEnv {
  APP_ORIGIN: string;
  SUPABASE_URL: string;
  SUPABASE_PHOTOS_BUCKET: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  PHOTO_STORAGE?: string;
}

const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

export class SupabasePhotoStorage implements PhotoStorage {
  private readonly baseUrl: string;
  private readonly serviceKey: string;
  private readonly bucket: string;
  private readonly fetcher: typeof fetch;

  constructor(projectUrl: string, serviceKey: string, bucket: string, fetcher: typeof fetch = fetch) {
    if (!projectUrl || !serviceKey || !bucket) throw new PhotoStorageError("configure", 500);
    this.baseUrl = projectUrl.replace(/\/+$/, "");
    this.serviceKey = serviceKey;
    this.bucket = bucket;
    this.fetcher = fetcher;
  }

  private headers() {
    return {
      apikey: this.serviceKey,
      Authorization: `Bearer ${this.serviceKey}`,
    };
  }

  private objectUrl(key: string) {
    return `${this.baseUrl}/storage/v1/object/${encodeURIComponent(this.bucket)}/${encodePath(key)}`;
  }

  async put(key: string, body: ArrayBuffer) {
    const response = await this.fetcher(this.objectUrl(key), {
      method: "POST",
      headers: {
        ...this.headers(),
        "Content-Type": "application/octet-stream",
        "x-upsert": "true",
      },
      body,
    });
    if (!response.ok) throw new PhotoStorageError("upload", response.status);
  }

  async get(key: string) {
    const response = await this.fetcher(this.objectUrl(key), { headers: this.headers() });
    if (response.status === 404) return null;
    if (!response.ok) throw new PhotoStorageError("download", response.status);
    return response;
  }

  async delete(keys: string[]) {
    const response = await this.fetcher(`${this.baseUrl}/storage/v1/object/${encodeURIComponent(this.bucket)}`, {
      method: "DELETE",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: keys }),
    });
    if (!response.ok) throw new PhotoStorageError("delete", response.status);
  }

  private async listFiles(prefix: string): Promise<string[]> {
    const files: string[] = [];
    for (let offset = 0; ; offset += 100) {
      const listed = await this.fetcher(`${this.baseUrl}/storage/v1/object/list/${encodeURIComponent(this.bucket)}`, {
        method: "POST",
        headers: { ...this.headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, limit: 100, offset, sortBy: { column: "name", order: "asc" } }),
      });
      if (!listed.ok) throw new PhotoStorageError("delete", listed.status);
      const entries = (await listed.json()) as { id?: string | null; name?: string }[];
      for (const entry of entries) {
        if (!entry.name) continue;
        const path = `${prefix}/${entry.name}`;
        if (entry.id) files.push(path);
        else files.push(...(await this.listFiles(path)));
      }
      if (entries.length < 100) return files;
    }
  }

  async deletePrefix(prefix: string) {
    const normalized = prefix.replace(/^\/+|\/+$/g, "");
    const keys = await this.listFiles(normalized);
    for (let index = 0; index < keys.length; index += 100) {
      await this.delete(keys.slice(index, index + 100));
    }
  }
}

const localPhotos = new Map<string, Uint8Array>();

const localPhotoStorage: PhotoStorage = {
  async put(key, body) {
    localPhotos.set(key, new Uint8Array(body).slice());
  },
  async get(key) {
    const body = localPhotos.get(key);
    return body ? new Response(body.slice(), { headers: { "Content-Type": "application/octet-stream" } }) : null;
  },
  async delete(keys) {
    for (const key of keys) localPhotos.delete(key);
  },
  async deletePrefix(prefix) {
    for (const key of localPhotos.keys()) {
      if (key.startsWith(`${prefix.replace(/\/+$/, "")}/`)) localPhotos.delete(key);
    }
  },
};

export function photoStorage(env: PhotoStorageEnv): PhotoStorage {
  if (env.PHOTO_STORAGE === "memory") {
    const hostname = new URL(env.APP_ORIGIN).hostname;
    if (hostname !== "localhost" && hostname !== "127.0.0.1") throw new PhotoStorageError("configure", 500);
    return localPhotoStorage;
  }
  if (env.PHOTO_STORAGE && env.PHOTO_STORAGE !== "supabase") throw new PhotoStorageError("configure", 500);
  return new SupabasePhotoStorage(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, env.SUPABASE_PHOTOS_BUCKET);
}
