/**
 * Pure helper functions extracted from the extension so they can be
 * unit-tested without registering the full Pi extension.
 */

import type { ExtensionContext, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ── State types ──────────────────────────────────────────────────────────────

export const STATE_ENTRY = "pi-openrouter-search-fetch-config";

export interface ExtensionState {
  searchEnabled: boolean;
  searchEngine: string;
  fetchEnabled: boolean;
  fetchEngine: string;
  imageEnabled: boolean;
  visionEnabled: boolean;
  videoEnabled: boolean;
  pdfEnabled: boolean;
  ttsEnabled: boolean;
  sttEnabled: boolean;
  compactStatus: boolean;
}

export const DEFAULT_STATE: ExtensionState = {
  searchEnabled: true,
  searchEngine: "auto",
  fetchEnabled: true,
  fetchEngine: "auto",
  imageEnabled: false,
  visionEnabled: false,
  videoEnabled: false,
  pdfEnabled: false,
  ttsEnabled: false,
  sttEnabled: false,
  compactStatus: false,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export function resolveApiKey(ctx: {
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

export function isActiveModelOpenRouter(ctx: { model?: { provider?: string } }): boolean {
  return ctx.model?.provider === "openrouter";
}

export function persistState(pi: ExtensionAPI, state: ExtensionState) {
  pi.appendEntry<ExtensionState>(STATE_ENTRY, state);
}

export function restoreState(ctx: ExtensionContext): ExtensionState {
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
export function setToolActive(pi: ExtensionAPI, name: string, enabled: boolean) {
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
export function statusLabel(state: ExtensionState): string {
  if (state.compactStatus) {
    const parts: string[] = [];
    if (state.searchEnabled) parts.push(`S ${state.searchEngine}`);
    else parts.push("S off");
    if (state.fetchEnabled) parts.push(`F ${state.fetchEngine}`);
    else parts.push("F off");
    if (state.imageEnabled) parts.push("Img");
    if (state.visionEnabled) parts.push("Vis");
    if (state.videoEnabled) parts.push("Vid");
    if (state.pdfEnabled) parts.push("PDF");
    if (state.ttsEnabled) parts.push("TTS");
    if (state.sttEnabled) parts.push("STT");
    return parts.join("  ");
  }
  const parts: string[] = [];
  parts.push(state.searchEnabled ? `search:on(${state.searchEngine})` : "search:off");
  parts.push(state.fetchEnabled ? `fetch:on(${state.fetchEngine})` : "fetch:off");
  if (state.imageEnabled) parts.push("img:on");
  if (state.visionEnabled) parts.push("vision:on");
  if (state.videoEnabled) parts.push("video:on");
  if (state.pdfEnabled) parts.push("pdf:on");
  if (state.ttsEnabled) parts.push("tts:on");
  if (state.sttEnabled) parts.push("stt:on");
  return parts.join(" ");
}

// ── API layer ────────────────────────────────────────────────────────────────

const OPENROUTER_API = "https://openrouter.ai/api/v1";

export async function callOpenRouterTool(
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
export function extractResponse(
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

// ── Multimodal API helpers ──────────────────────────────────────────────────

/** Call OpenRouter image generation. Returns base64 data URLs from the response. */
export async function generateImage(
  apiKey: string,
  prompt: string,
  model: string,
  signal?: AbortSignal,
): Promise<{ ok: boolean; images?: string[]; error?: string }> {
  try {
    const res = await fetch(`${OPENROUTER_API}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
      signal,
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${text}` };
    }

    const data = (await res.json()) as Record<string, unknown>;
    const choice = (data["choices"] as Array<Record<string, unknown>>)?.[0];
    const msg = choice?.["message"] as Record<string, unknown> | undefined;
    const imagesRaw = msg?.["images"] as Array<Record<string, unknown>> | undefined;

    if (imagesRaw?.length) {
      const urls: string[] = [];
      for (const img of imagesRaw) {
        const imageUrl = img["image_url"] as Record<string, unknown> | undefined;
        const url = imageUrl?.["url"] as string | undefined;
        if (url) urls.push(url);
      }
      if (urls.length) return { ok: true, images: urls };
    }

    return { ok: false, error: "No images in response" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/** Call OpenRouter TTS. Returns raw audio bytes. */
export async function speakText(
  apiKey: string,
  text: string,
  model: string,
  voice: string,
  signal?: AbortSignal,
): Promise<{ ok: boolean; buffer?: ArrayBuffer; contentType?: string; error?: string }> {
  try {
    const res = await fetch(`${OPENROUTER_API}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, input: text, voice, response_format: "mp3" }),
      signal,
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${text}` };
    }

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "audio/mpeg";
    return { ok: true, buffer, contentType };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/** Call OpenRouter STT. Returns transcribed text. */
export async function transcribeAudio(
  apiKey: string,
  audioBase64: string,
  format: string,
  model: string,
  language?: string,
  signal?: AbortSignal,
): Promise<{ ok: boolean; text?: string; error?: string }> {
  try {
    const res = await fetch(`${OPENROUTER_API}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, audio: audioBase64, format, language }),
      signal,
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${text}` };
    }

    const data = (await res.json()) as Record<string, unknown>;
    const txt = data["text"] as string | undefined;
    return { ok: true, text: txt || "" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// ── Multimodal input helpers ────────────────────────────────────────────────

/**
 * Call OpenRouter chat completions with a multimodal content block (image_url,
 * video_url, or file). Sends to a compatible model and returns the assistant's
 * text response.
 */
export async function callChatMultimodal(
  apiKey: string,
  prompt: string,
  contentBlock: Record<string, unknown>,
  model: string,
  plugins?: Array<Record<string, unknown>>,
  signal?: AbortSignal,
): Promise<{ ok: boolean; text?: string; error?: string }> {
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: [{ type: "text", text: prompt }, contentBlock] }],
    max_tokens: 4096,
  };
  if (plugins) body["plugins"] = plugins;

  try {
    const res = await fetch(`${OPENROUTER_API}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${text}` };
    }
    const data = (await res.json()) as Record<string, unknown>;
    const choices = data["choices"] as Array<Record<string, unknown>> | undefined;
    const msg = choices?.[0]?.["message"] as Record<string, unknown> | undefined;
    const txt = msg?.["content"] as string | null | undefined;
    return { ok: true, text: txt || "(no response)" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
