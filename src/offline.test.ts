import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
const worker = readFileSync(
  new URL("../public/sw.js", import.meta.url),
  "utf8",
);
function setup() {
  const events: Record<string, (event: any) => void> = {};
  const matches: { request: unknown; options: unknown }[] = [];
  const writes: unknown[] = [];
  const deleted: string[] = [];
  let precache: string[] = [];
  const cache = {
    addAll: async (urls: string[]) => {
      precache = urls;
    },
    put: async (request: unknown) => {
      writes.push(request);
    },
  };
  const cached = { body: "cached-app" };
  const env = {
    URL,
    fetch: async () => {
      throw Error("Offline");
    },
    self: {
      location: { origin: "https://mildraw.example" },
      clients: { claim: async () => {} },
      skipWaiting: () => {},
      addEventListener: (name: string, handler: (event: any) => void) => {
        events[name] = handler;
      },
    },
    caches: {
      open: async () => cache,
      keys: async () => ["other-app-cache", "mildraw-old", "mildraw-shell-v1"],
      delete: async (key: string) => {
        deleted.push(key);
      },
      match: async (request: unknown, options: unknown) => {
        matches.push({ request, options });
        return cached;
      },
    },
  };
  runInNewContext(worker, env);
  return {
    events,
    matches,
    writes,
    deleted,
    cached,
    getPrecache: () => precache,
  };
}
describe("offline service worker", () => {
  it("installs the shell before reporting completion", async () => {
    const s = setup();
    let done: Promise<unknown> | undefined;
    s.events.install({
      waitUntil: (p: Promise<unknown>) => {
        done = p;
      },
    });
    await done;
    expect(s.getPrecache()).toEqual([
      "/",
      "/favicon.svg",
      "/manifest.webmanifest",
    ]);
  });
  it("falls back to cached HTML when the host is offline, ignoring CORS Vary headers", async () => {
    const s = setup();
    let response: Promise<unknown> | undefined;
    s.events.fetch({
      request: {
        url: "https://mildraw.example/",
        method: "GET",
        mode: "navigate",
      },
      respondWith: (p: Promise<unknown>) => {
        response = p;
      },
    });
    expect(await response).toBe(s.cached);
    expect(s.matches[0]).toEqual({
      request: "/",
      options: { ignoreVary: true },
    });
  });
  it("loads cached assets on a first offline reopening", async () => {
    const s = setup();
    const request = {
      url: "https://mildraw.example/assets/app.js",
      method: "GET",
      mode: "cors",
    };
    let response: Promise<unknown> | undefined;
    s.events.fetch({
      request,
      respondWith: (p: Promise<unknown>) => {
        response = p;
      },
    });
    expect(await response).toBe(s.cached);
    expect(s.matches[0].options).toEqual({ ignoreVary: true });
  });
  it("does not intercept or cache external map provider requests", () => {
    const s = setup();
    let intercepted = false;
    s.events.fetch({
      request: {
        url: "https://tiles.openfreemap.org/some-tile",
        method: "GET",
      },
      respondWith: () => {
        intercepted = true;
      },
    });
    expect(intercepted).toBe(false);
    expect(s.matches).toHaveLength(0);
  });
  it("removes only old MILDraw caches, preserving unrelated apps", async () => {
    const s = setup();
    let done: Promise<unknown> | undefined;
    s.events.activate({
      waitUntil: (p: Promise<unknown>) => {
        done = p;
      },
    });
    await done;
    expect(s.deleted).toEqual(["mildraw-old"]);
  });
});
