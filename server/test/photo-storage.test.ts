import assert from "node:assert/strict";
import { test } from "node:test";
import { PhotoStorageError, SupabasePhotoStorage } from "../src/photo-storage";

const KEY = "secret";
const BUCKET = "opendomus-photos";

test("Supabase sube bytes opacos con upsert y credenciales solo en headers", async () => {
  const body = new Uint8Array([1, 2, 3]).buffer;
  let request: { input: string | URL | Request; init?: RequestInit } | undefined;
  const storage = new SupabasePhotoStorage("https://project.supabase.co/", KEY, BUCKET, async (input, init) => {
    request = { input, init };
    return new Response("{}", { status: 200 });
  });

  await storage.put("households/a photo/thumb", body);

  assert.equal(request?.input, "https://project.supabase.co/storage/v1/object/opendomus-photos/households/a%20photo/thumb");
  assert.equal(request?.init?.method, "POST");
  assert.equal(new Headers(request?.init?.headers).get("authorization"), `Bearer ${KEY}`);
  assert.equal(new Headers(request?.init?.headers).get("x-upsert"), "true");
  assert.equal(request?.init?.body, body);
  assert.ok(!String(request?.input).includes(KEY));
});

test("Supabase descarga bytes y trata un objeto ausente como not-found", async () => {
  const responses = [
    new Response(new Uint8Array([7, 8, 9]), { status: 200 }),
    new Response("missing", { status: 404 }),
  ];
  const storage = new SupabasePhotoStorage("https://project.supabase.co", KEY, BUCKET, async () => responses.shift()!);

  const found = await storage.get("households/a/full");
  assert.deepEqual(new Uint8Array(await found!.arrayBuffer()), new Uint8Array([7, 8, 9]));
  assert.equal(await storage.get("households/a/missing"), null);
});

test("Supabase borra ambas variantes en una sola operación", async () => {
  let request: RequestInit | undefined;
  const storage = new SupabasePhotoStorage("https://project.supabase.co", KEY, BUCKET, async (_input, init) => {
    request = init;
    return new Response("[]", { status: 200 });
  });
  const keys = ["households/a/full", "households/a/thumb"];

  await storage.delete(keys);

  assert.equal(request?.method, "DELETE");
  assert.deepEqual(JSON.parse(String(request?.body)), { prefixes: keys });
});

test("Supabase lista y borra por prefijo hasta dejar la casa vacía", async () => {
  const calls: { url: string; method: string; body?: string }[] = [];
  const responses = [
    new Response(JSON.stringify([{ id: null, name: "a" }]), { status: 200 }),
    new Response(JSON.stringify([{ id: "full-id", name: "full" }, { id: "thumb-id", name: "thumb" }]), { status: 200 }),
    new Response("[]", { status: 200 }),
  ];
  const storage = new SupabasePhotoStorage("https://project.supabase.co", KEY, BUCKET, async (input, init) => {
    calls.push({ url: String(input), method: init?.method ?? "GET", body: typeof init?.body === "string" ? init.body : undefined });
    return responses.shift()!;
  });

  await storage.deletePrefix("households/home/photos");

  assert.match(calls[0].url, /\/object\/list\/opendomus-photos$/);
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(JSON.parse(calls[1].body!), {
    prefix: "households/home/photos/a",
    limit: 100,
    offset: 0,
    sortBy: { column: "name", order: "asc" },
  });
  assert.deepEqual(JSON.parse(calls[2].body!), {
    prefixes: ["households/home/photos/a/full", "households/home/photos/a/thumb"],
  });
  assert.equal(calls[2].method, "DELETE");
});

test("Supabase propaga límites y fallos sin aparentar éxito", async () => {
  const storage = new SupabasePhotoStorage("https://project.supabase.co", KEY, BUCKET, async () => new Response("quota", { status: 429 }));

  await assert.rejects(() => storage.put("households/a/full", new ArrayBuffer(32)), (error: unknown) => {
    assert.ok(error instanceof PhotoStorageError);
    assert.equal(error.operation, "upload");
    assert.equal(error.status, 429);
    return true;
  });
});
