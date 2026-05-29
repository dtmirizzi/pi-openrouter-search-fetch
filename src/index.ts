/**
 * pi-openrouter-search-fetch
 *
 * Adds OpenRouter's `openrouter:web_search` and `openrouter:web_fetch` server
 * tools to Pi. Each tool is independently toggleable via its own command:
 *
 *   /web-search   — toggle search on/off, set default search engine
 *   /web-fetch    — toggle fetch on/off, set default fetch engine & limits
 *   /web-tools    — unified settings for both
 *
 * Search and fetch are intentionally separate:
 * - web_search: run a query, get results + AI-synthesized answer
 * - web_fetch:  fetch a specific URL, get raw page content
 *
 * See:
 *   https://openrouter.ai/docs/guides/features/server-tools/web-search
 *   https://openrouter.ai/docs/guides/features/server-tools/web-fetch
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  truncateHead,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  getSettingsListTheme,
} from "@earendil-works/pi-coding-agent";
import { Container, type SettingItem, SettingsList } from "@earendil-works/pi-tui";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const OPENROUTER_API = "https://openrouter.ai/api/v1";
const STATE_ENTRY = "pi-openrouter-search-fetch-config";

// ── Tool constants ───────────────────────────────────────────────────────────

const SEARCH_SRV = "openrouter:web_search";
const FETCH_SRV  = "openrouter:web_fetch";
const SEARCH_TOOL = "web_search";
const FETCH_TOOL  = "web_fetch";

// ── Persistent state (independently toggleable per tool) ─────────────────────

interface ExtensionState {
  searchEnabled: boolean;
  searchEngine: string;
  fetchEnabled: boolean;
  fetchEngine: string;
}

const DEFAULT_STATE: ExtensionState = {
  searchEnabled: true,
  searchEngine: "auto",
  fetchEnabled: true,
  fetchEngine: "auto",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveApiKey(ctx: {
  modelRegistry: { find: (provider: string, id?: string) => { apiKey?: string } | undefined };
}): string | undefined {
  const envKey = process.env["OPENROUTER_API_KEY"];
  if (envKey) return envKey;

  try {
    for (const id of ["auto", undefined]) {
      const m = ctx.modelRegistry.find("openrouter", id as string | undefined);
      if (m?.apiKey) return m.apiKey;
    }
  } catch {
    /* ok */
  }

  try {
    const modelsPath = join(homedir(), ".pi", "agent", "models.json");
    if (existsSync(modelsPath)) {
      const config = JSON.parse(readFileSync(modelsPath, "utf8")) as Record<string, unknown>;
      const providers = config["providers"] as Record<string, unknown> | undefined;
      const openrouter = providers?.["openrouter"] as Record<string, unknown> | undefined;
      const key = openrouter?.["apiKey"];
      if (typeof key === "string" && key.length > 0) return key;
    }
  } catch {
    /* ok */
  }

  return undefined;
}

function isActiveModelOpenRouter(ctx: { model?: { provider?: string } }): boolean {
  return ctx.model?.provider === "openrouter";
}

function persistState(pi: ExtensionAPI, state: ExtensionState) {
  pi.appendEntry<ExtensionState>(STATE_ENTRY, state);
}

function restoreState(ctx: ExtensionContext): ExtensionState {
  const branch = ctx.sessionManager.getBranch();
  for (let i = branch.length - 1; i >= 0; i--) {
    const entry = branch[i];
    if (entry.type === "custom" && entry.customType === STATE_ENTRY) {
      const data = entry.data as ExtensionState | undefined;
      if (data) return { ...DEFAULT_STATE, ...data };
    }
  }
  return { ...DEFAULT_STATE };
}

/** Enable or disable a single tool by name in the active set. */
function setToolActive(pi: ExtensionAPI, name: string, enabled: boolean) {
  const active = pi.getActiveTools();
  if (enabled) {
    if (!active.includes(name)) {
      pi.setActiveTools([...active, name]);
    }
  } else {
    pi.setActiveTools(active.filter((t) => t !== name));
  }
}

/** Build the status line label from the current state. */
function statusLabel(state: ExtensionState): string {
  const s = state.searchEnabled ? `search:on(${state.searchEngine})` : "search:off";
  const f = state.fetchEnabled ? `fetch:on(${state.fetchEngine})` : "fetch:off";
  return `${s} ${f}`;
}

// ── OpenRouter API helper ────────────────────────────────────────────────────

async function callOpenRouterTool(
  apiKey: string,
  serverTool: string,
  toolParams: Record<string, unknown>,
  messages: Array<{ role: string; content: string }>,
  signal?: AbortSignal,
): Promise<{ ok: boolean; status: number; data?: Record<string, unknown>; error?: string }> {
  const toolDef: Record<string, unknown> = { type: serverTool };
  if (Object.keys(toolParams).length > 0) toolDef["parameters"] = toolParams;

  try {
    const res = await fetch(`${OPENROUTER_API}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openrouter/auto",
        messages,
        tools: [toolDef],
        max_tokens: 4096,
      }),
      signal,
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, status: res.status, error: text };
    }

    const data = (await res.json()) as Record<string, unknown>;
    return { ok: true, status: 200, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, error: msg };
  }
}

/** Extract content/text from an OpenRouter tool response. */
function extractResponse(
  data: Record<string, unknown>,
): { content?: string; toolCalls?: string } {
  const choice = (data["choices"] as Array<Record<string, unknown>>)?.[0];
  const msg = choice?.["message"] as Record<string, unknown> | undefined;

  const content = msg?.["content"] as string | null | undefined;
  if (content) return { content };

  const calls = msg?.["tool_calls"] as Array<Record<string, unknown>> | undefined;
  if (calls?.length) {
    const parts: string[] = [];
    for (const c of calls) {
      const fn = c["function"] as Record<string, unknown> | undefined;
      if (fn?.["arguments"]) parts.push(fn["arguments"] as string);
    }
    if (parts.length) return { toolCalls: parts.join("\n\n---\n\n") };
  }

  return {};
}

// ── Settings UI builder ─────────────────────────────────────────────────────

function openSettings(
  ctx: ExtensionContext,
  title: string,
  items: SettingItem[],
  onChange: (id: string, newValue: string) => void,
) {
  return ctx.ui.custom(
    (_tui, theme, _kb, done) => {
      const container = new Container();
      container.addChild(
        new (class {
          render() {
            return [
              theme.fg("accent", theme.bold(title)),
              theme.fg("dim", "─".repeat(40)),
            ];
          }
          invalidate() {}
        })(),
      );

      const settingsList = new SettingsList(
        items,
        Math.min(items.length + 4, 14),
        getSettingsListTheme(),
        (id, newValue) => {
          onChange(id, newValue);
        },
        () => done(undefined),
      );

      container.addChild(settingsList);

      const hint = new (class {
        render() {
          return [
            "",
            theme.fg("dim", "↑↓ navigate  ·  ←→ toggle  ·  Esc close"),
          ];
        }
        invalidate() {}
      })();
      container.addChild(hint);

      return {
        render(width: number) {
          return container.render(width);
        },
        invalidate() {
          container.invalidate();
        },
        handleInput(data: string) {
          settingsList.handleInput?.(data);
          _tui.requestRender();
        },
      };
    },
    { overlay: true },
  );
}

// ── Extension ────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  let state: ExtensionState = { ...DEFAULT_STATE };

  // ── Persistence ──────────────────────────────────────────────────────────

  function applyState(ctx: ExtensionContext) {
    setToolActive(pi, SEARCH_TOOL, state.searchEnabled);
    setToolActive(pi, FETCH_TOOL, state.fetchEnabled);
    ctx.ui.setStatus("web-tools", statusLabel(state));
  }

  pi.on("session_start", async (_event, ctx) => {
    state = restoreState(ctx);
    applyState(ctx);
  });

  pi.on("session_tree", async (_event, ctx) => {
    state = restoreState(ctx);
    applyState(ctx);
  });

  // ── /web-search command ──────────────────────────────────────────────────

  pi.registerCommand("web-search", {
    description: "Toggle web_search tool and configure default search engine",
    handler: async (_args, ctx) => {
      const items: SettingItem[] = [
        { id: "s-enabled", label: "Web Search", currentValue: state.searchEnabled ? "on" : "off", values: ["on", "off"] },
        { id: "s-engine",  label: "Search Engine",  currentValue: state.searchEngine, values: ["auto", "native", "exa", "firecrawl", "parallel"] },
      ];

      await openSettings(ctx, "OpenRouter Web Search", items, (id, val) => {
        if (id === "s-enabled") state.searchEnabled = val === "on";
        else if (id === "s-engine") state.searchEngine = val;
        persistState(pi, state);
        applyState(ctx);
      });
    },
  });

  // ── /web-fetch command ────────────────────────────────────────────────────

  pi.registerCommand("web-fetch", {
    description: "Toggle web_fetch tool and configure default fetch engine",
    handler: async (_args, ctx) => {
      const items: SettingItem[] = [
        { id: "f-enabled", label: "Web Fetch", currentValue: state.fetchEnabled ? "on" : "off", values: ["on", "off"] },
        { id: "f-engine",  label: "Fetch Engine",  currentValue: state.fetchEngine,  values: ["auto", "native", "exa", "openrouter", "firecrawl", "parallel"] },
      ];

      await openSettings(ctx, "OpenRouter Web Fetch", items, (id, val) => {
        if (id === "f-enabled") state.fetchEnabled = val === "on";
        else if (id === "f-engine") state.fetchEngine = val;
        persistState(pi, state);
        applyState(ctx);
      });
    },
  });

  // ── /web-tools (combined) ─────────────────────────────────────────────────

  pi.registerCommand("web-tools", {
    description: "Configure both web_search and web_fetch tools",
    handler: async (_args, ctx) => {
      const items: SettingItem[] = [
        { id: "s-enabled", label: "Web Search",     currentValue: state.searchEnabled ? "on" : "off", values: ["on", "off"] },
        { id: "s-engine",  label: "Search Engine",  currentValue: state.searchEngine, values: ["auto", "native", "exa", "firecrawl", "parallel"] },
        { id: "f-enabled", label: "Web Fetch",      currentValue: state.fetchEnabled ? "on" : "off", values: ["on", "off"] },
        { id: "f-engine",  label: "Fetch Engine",   currentValue: state.fetchEngine,  values: ["auto", "native", "exa", "openrouter", "firecrawl", "parallel"] },
      ];

      await openSettings(ctx, "OpenRouter Web Tools", items, (id, val) => {
        if (id === "s-enabled") state.searchEnabled = val === "on";
        else if (id === "s-engine") state.searchEngine = val;
        else if (id === "f-enabled") state.fetchEnabled = val === "on";
        else if (id === "f-engine") state.fetchEngine = val;
        persistState(pi, state);
        applyState(ctx);
      });
    },
  });

  // ── web_search tool ───────────────────────────────────────────────────────

  pi.registerTool({
    name: SEARCH_TOOL,
    label: "Web Search",
    description:
      "Search the web for real-time information via OpenRouter. " +
      "Use when you need current events, recent data, facts you're unsure about, " +
      "or anything that has changed recently. " +
      "Only functional with OpenRouter models.",
    promptGuidelines: [
      "Use web_search when you need real-time information, current events, or data you're uncertain about.",
      "Only works with OpenRouter models.",
    ],
    parameters: Type.Object({
      query: Type.String({ description: "Search query string" }),
      engine: Type.Optional(Type.String({
        description: "Search engine: auto (default), native, exa, firecrawl, parallel",
      })),
      max_results: Type.Optional(Type.Integer({
        minimum: 1, maximum: 25,
        description: "Max results per call (1-25, default 5)",
      })),
      search_context_size: Type.Optional(Type.String({
        description: "Context per result: low (5K), medium (15K), high (30K)",
      })),
      allowed_domains: Type.Optional(Type.Array(Type.String(), {
        description: "Only return results from these domains",
      })),
      excluded_domains: Type.Optional(Type.Array(Type.String(), {
        description: "Exclude results from these domains",
      })),
    }),

    async execute(_id, params, signal, onUpdate, ctx) {
      if (!isActiveModelOpenRouter(ctx)) {
        return { content: [{ type: "text", text: "web_search is only available with OpenRouter models." }], details: { error: "wrong_provider" } };
      }

      const apiKey = resolveApiKey(ctx);
      if (!apiKey) {
        return { content: [{ type: "text", text: "No OpenRouter API key found." }], details: { error: "no_api_key" } };
      }

      const engine = params.engine || state.searchEngine;

      onUpdate?.({ content: [{ type: "text", text: `🔍 Searching: "${params.query}"...` }] });

      const toolParams: Record<string, unknown> = {};
      if (engine && engine !== "auto") toolParams["engine"] = engine;
      if (params.max_results) toolParams["max_results"] = params.max_results;
      if (params.search_context_size) toolParams["search_context_size"] = params.search_context_size;
      if (params.allowed_domains) toolParams["allowed_domains"] = params.allowed_domains;
      if (params.excluded_domains) toolParams["excluded_domains"] = params.excluded_domains;

      const res = await callOpenRouterTool(apiKey, SEARCH_SRV, toolParams, [
        { role: "user", content: params.query },
      ], signal);

      if (!res.ok) {
        throw new Error(`OpenRouter search error (${res.status}): ${res.error}`);
      }

      const extracted = extractResponse(res.data!);
      if (extracted.content) {
        return { content: [{ type: "text", text: extracted.content }], details: { source: "openrouter", engine } };
      }
      if (extracted.toolCalls) {
        const tr = truncateHead(extracted.toolCalls, { maxLines: DEFAULT_MAX_LINES, maxBytes: DEFAULT_MAX_BYTES });
        return { content: [{ type: "text", text: tr.content }], details: { source: "tool_calls", engine, truncated: tr.truncated } };
      }
      return { content: [{ type: "text", text: "No results." }], details: { status: "empty" } };
    },
  });

  // ── web_fetch tool ─────────────────────────────────────────────────────────

  pi.registerTool({
    name: FETCH_TOOL,
    label: "Web Fetch",
    description:
      "Fetch the content of a specific URL via OpenRouter. " +
      "Use when you need to read a web page, documentation, article, or PDF. " +
      "Returns the page title and text content. " +
      "Only functional with OpenRouter models.",
    promptGuidelines: [
      "Use web_fetch to read the content of a specific URL when you need to analyze or summarize a known page.",
      "Only works with OpenRouter models.",
    ],
    parameters: Type.Object({
      url: Type.String({ description: "URL to fetch content from" }),
      engine: Type.Optional(Type.String({
        description: "Fetch engine: auto (default), native, exa, openrouter, firecrawl, parallel",
      })),
      max_content_tokens: Type.Optional(Type.Integer({
        description: "Max content length in approximate tokens (e.g. 50000). Content exceeding this is truncated.",
      })),
    }),

    async execute(_id, params, signal, onUpdate, ctx) {
      if (!isActiveModelOpenRouter(ctx)) {
        return { content: [{ type: "text", text: "web_fetch is only available with OpenRouter models." }], details: { error: "wrong_provider" } };
      }

      const apiKey = resolveApiKey(ctx);
      if (!apiKey) {
        return { content: [{ type: "text", text: "No OpenRouter API key found." }], details: { error: "no_api_key" } };
      }

      const engine = params.engine || state.fetchEngine;

      onUpdate?.({ content: [{ type: "text", text: `📄 Fetching: ${params.url}...` }] });

      const toolParams: Record<string, unknown> = {};
      if (engine && engine !== "auto") toolParams["engine"] = engine;
      if (params.max_content_tokens) toolParams["max_content_tokens"] = params.max_content_tokens;

      const res = await callOpenRouterTool(apiKey, FETCH_SRV, toolParams, [
        { role: "user", content: `Fetch and show me the content at ${params.url}` },
      ], signal);

      if (!res.ok) {
        throw new Error(`OpenRouter fetch error (${res.status}): ${res.error}`);
      }

      const extracted = extractResponse(res.data!);
      if (extracted.content) {
        const tr = truncateHead(extracted.content, { maxLines: DEFAULT_MAX_LINES, maxBytes: DEFAULT_MAX_BYTES });
        return { content: [{ type: "text", text: tr.content }], details: { source: "openrouter", engine, url: params.url, truncated: tr.truncated } };
      }
      if (extracted.toolCalls) {
        const tr = truncateHead(extracted.toolCalls, { maxLines: DEFAULT_MAX_LINES, maxBytes: DEFAULT_MAX_BYTES });
        return { content: [{ type: "text", text: tr.content }], details: { source: "tool_calls", engine, url: params.url, truncated: tr.truncated } };
      }
      return { content: [{ type: "text", text: "Fetch returned no content." }], details: { status: "empty", url: params.url } };
    },
  });
}
