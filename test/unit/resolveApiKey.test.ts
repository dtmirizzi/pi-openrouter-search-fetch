import * as fs from "node:fs";
import * as os from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveApiKey } from "../../src/helpers";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

vi.mock("node:os", () => ({
  homedir: vi.fn(),
}));

describe("resolveApiKey", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.OPENROUTER_API_KEY;
  });

  it("returns env var OPENROUTER_API_KEY when set", async () => {
    process.env.OPENROUTER_API_KEY = "sk-env-test";
    const ctx = { modelRegistry: { getApiKeyForProvider: vi.fn() } };
    const key = await resolveApiKey(ctx);
    expect(key).toBe("sk-env-test");
  });

  it("falls back to model registry when env var not set", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const ctx = {
      modelRegistry: {
        getApiKeyForProvider: vi.fn(async (provider: string) => {
          if (provider === "openrouter") return "sk-registry-auto";
          return undefined;
        }),
      },
    };
    const key = await resolveApiKey(ctx);
    expect(key).toBe("sk-registry-auto");
  });

  it("returns undefined when registry returns nothing", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const ctx = { modelRegistry: { getApiKeyForProvider: vi.fn(async () => undefined) } };
    const key = await resolveApiKey(ctx);
    expect(key).toBeUndefined();
  });

  it("falls back to models.json when registry returns nothing", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const ctx = { modelRegistry: { getApiKeyForProvider: vi.fn(async () => undefined) } };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ providers: { openrouter: { apiKey: "sk-file-key" } } }),
    );
    vi.mocked(os.homedir).mockReturnValue("/home/testuser");
    const key = await resolveApiKey(ctx);
    expect(key).toBe("sk-file-key");
  });

  it("returns undefined when models.json does not exist", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const ctx = { modelRegistry: { getApiKeyForProvider: vi.fn(async () => undefined) } };
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const key = await resolveApiKey(ctx);
    expect(key).toBeUndefined();
  });

  it("returns undefined when models.json has no openrouter section", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const ctx = { modelRegistry: { getApiKeyForProvider: vi.fn(async () => undefined) } };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ providers: { anthropic: { apiKey: "sk-anthro" } } }));
    const key = await resolveApiKey(ctx);
    expect(key).toBeUndefined();
  });

  it("returns undefined when models.json has empty apiKey", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const ctx = { modelRegistry: { getApiKeyForProvider: vi.fn(async () => undefined) } };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ providers: { openrouter: { apiKey: "" } } }));
    const key = await resolveApiKey(ctx);
    expect(key).toBeUndefined();
  });

  it("returns undefined when all sources fail", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const ctx = { modelRegistry: { getApiKeyForProvider: vi.fn(async () => undefined) } };
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const key = await resolveApiKey(ctx);
    expect(key).toBeUndefined();
  });
});
