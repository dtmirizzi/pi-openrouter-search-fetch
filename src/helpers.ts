/**
 * Pure helper functions extracted from the extension so they can be
 * unit-tested without registering the full Pi extension.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// ── State types ──────────────────────────────────────────────────────────────

export const STATE_ENTRY = "@dtmirizzi/pi-openrouter-multimodal-config";

export interface ExtensionState {
  searchEnabled: boolean;
  searchEngine: string;
  fetchEnabled: boolean;
  fetchEngine: string;
  imageEnabled: boolean;
  imageModel: string;
  visionEnabled: boolean;
  visionModel: string;
  videoEnabled: boolean;
  videoModel: string;
  pdfEnabled: boolean;
  pdfModel: string;
  ttsEnabled: boolean;
  ttsModel: string;
  ttsVoice: string;
  sttEnabled: boolean;
  sttModel: string;
  compactStatus: boolean;
}

export const DEFAULT_STATE: ExtensionState = {
  searchEnabled: true,
  searchEngine: "auto",
  fetchEnabled: true,
  fetchEngine: "auto",
  imageEnabled: false,
  imageModel: "google/gemini-3.1-flash-image-preview",
  visionEnabled: false,
  visionModel: "google/gemini-2.5-flash",
  videoEnabled: false,
  videoModel: "google/gemini-2.5-flash",
  pdfEnabled: false,
  pdfModel: "google/gemini-2.5-flash",
  ttsEnabled: false,
  ttsModel: "openai/gpt-4o-mini-tts",
  ttsVoice: "alloy",
  sttEnabled: false,
  sttModel: "openai/whisper-large-v3",
  compactStatus: false,
};

// ── Model option types ──────────────────────────────────────────────────────

export interface ModelOption {
  id: string;
  label: string;
}

// ── Fallback model lists (used when API is unavailable) ─────────────────────
// Fetched from OpenRouter API on startup; these are the static fallbacks.

export const FALLBACK_IMAGE_MODELS: ModelOption[] = [
  { id: "google/gemini-3.1-flash-image-preview", label: "Nano Banana 2 (Gemini 3.1 Flash Image Preview)" },
  { id: "google/gemini-2.5-flash-image", label: "Nano Banana (Gemini 2.5 Flash Image)" },
  { id: "google/gemini-3-pro-image-preview", label: "Nano Banana Pro (Gemini 3 Pro Image Preview)" },
  { id: "openai/gpt-5.4-image-2", label: "GPT-5.4 Image 2" },
  { id: "openai/gpt-5-image", label: "GPT-5 Image" },
  { id: "openai/gpt-5-image-mini", label: "GPT-5 Image Mini" },
  { id: "black-forest-labs/flux.2-pro", label: "FLUX.2 Pro" },
  { id: "black-forest-labs/flux.2-flex", label: "FLUX.2 Flex" },
  { id: "black-forest-labs/flux.2-max", label: "FLUX.2 Max" },
  { id: "black-forest-labs/flux.2-klein-4b", label: "FLUX.2 Klein 4B" },
  { id: "bytedance-seed/seedream-4.5", label: "Seedream 4.5" },
  { id: "x-ai/grok-imagine-image-quality", label: "Grok Imagine Image Quality" },
  { id: "sourceful/riverflow-v2-pro", label: "Riverflow V2 Pro" },
  { id: "sourceful/riverflow-v2-max-preview", label: "Riverflow V2 Max Preview" },
  { id: "sourceful/riverflow-v2-standard-preview", label: "Riverflow V2 Standard Preview" },
  { id: "sourceful/riverflow-v2-fast-preview", label: "Riverflow V2 Fast Preview" },
  { id: "sourceful/riverflow-v2-fast", label: "Riverflow V2 Fast" },
  { id: "recraft/recraft-v4.1-pro", label: "Recraft V4.1 Pro" },
  { id: "recraft/recraft-v4.1", label: "Recraft V4.1" },
  { id: "recraft/recraft-v4.1-pro-vector", label: "Recraft V4.1 Pro Vector" },
  { id: "recraft/recraft-v4.1-vector", label: "Recraft V4.1 Vector" },
  { id: "recraft/recraft-v4.1-utility-pro", label: "Recraft V4.1 Utility Pro" },
  { id: "recraft/recraft-v4.1-utility", label: "Recraft V4.1 Utility" },
  { id: "recraft/recraft-v4-pro", label: "Recraft V4 Pro" },
  { id: "recraft/recraft-v4-pro-vector", label: "Recraft V4 Pro Vector" },
  { id: "recraft/recraft-v4", label: "Recraft V4" },
  { id: "recraft/recraft-v4-vector", label: "Recraft V4 Vector" },
  { id: "recraft/recraft-v3", label: "Recraft V3" },
];

export const FALLBACK_VISION_MODELS: ModelOption[] = [
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
  { id: "openai/gpt-4o", label: "GPT-4o" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "anthropic/claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { id: "qwen/qwen3-vl-8b-instruct", label: "Qwen3 VL 8B" },
  { id: "qwen/qwen3-vl-32b-instruct", label: "Qwen3 VL 32B" },
];

export const FALLBACK_VIDEO_MODELS: ModelOption[] = [
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
];

export const FALLBACK_PDF_MODELS: ModelOption[] = [
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "anthropic/claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { id: "openai/gpt-4o", label: "GPT-4o" },
];

export const FALLBACK_TTS_MODELS: ModelOption[] = [
  { id: "openai/gpt-4o-mini-tts", label: "GPT-4o Mini TTS" },
  { id: "openai/tts-1", label: "OpenAI TTS-1" },
  { id: "openai/tts-1-hd", label: "OpenAI TTS-1 HD" },
  { id: "openai/gpt-audio", label: "GPT-Audio" },
  { id: "openai/gpt-audio-mini", label: "GPT-Audio Mini" },
  { id: "google/lyria-3-pro-preview", label: "Lyria 3 Pro" },
  { id: "google/lyria-3-clip-preview", label: "Lyria 3 Clip" },
];

export const FALLBACK_TTS_VOICES: ModelOption[] = [
  { id: "alloy", label: "Alloy" },
  { id: "echo", label: "Echo" },
  { id: "fable", label: "Fable" },
  { id: "onyx", label: "Onyx" },
  { id: "nova", label: "Nova" },
  { id: "shimmer", label: "Shimmer" },
];

export const FALLBACK_STT_MODELS: ModelOption[] = [
  { id: "openai/whisper-large-v3", label: "Whisper Large V3" },
  { id: "openai/whisper-large-v3-turbo", label: "Whisper Large V3 Turbo" },
  { id: "openai/gpt-audio", label: "GPT-Audio" },
  { id: "openai/gpt-audio-mini", label: "GPT-Audio Mini" },
];

// ── Dynamic model fetching ──────────────────────────────────────────────────

interface OpenRouterModel {
  id: string;
  name?: string;
  context_length?: number;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
  };
}

const OPENROUTER_API = "https://openrouter.ai/api/v1";

/** Fetch models from OpenRouter API, keyed by output modality. */
export async function fetchOpenRouterModels(apiKey: string): Promise<{
  image: ModelOption[];
  tts: ModelOption[];
  stt: ModelOption[];
  vision: ModelOption[];
  video: ModelOption[];
  pdf: ModelOption[];
}> {
  const empty = { image: [], tts: [], stt: [], vision: [], video: [], pdf: [] };
  try {
    const res = await fetch(`${OPENROUTER_API}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return empty;

    const data = (await res.json()) as { data: OpenRouterModel[] };
    const models = data.data;

    const image: ModelOption[] = [];
    const tts: ModelOption[] = [];
    const stt: ModelOption[] = [];
    const vision: ModelOption[] = [];
    const video: ModelOption[] = [];
    const pdf: ModelOption[] = [];

    for (const m of models) {
      const id = m.id;
      const outp = m.architecture?.output_modalities ?? [];
      const inp = m.architecture?.input_modalities ?? [];
      // Use the API-provided name for a human-readable label, fall back to provider:model form
      const label = m.name ? `${m.name}` : id;

      // Skip the auto-router — it's not a real model to select
      if (id === "openrouter/auto" || id.endsWith(":free")) continue;

      if (outp.includes("image")) image.push({ id, label });
      if (outp.includes("audio")) tts.push({ id, label });
      if (inp.includes("audio")) stt.push({ id, label });
      if (inp.includes("image") && outp.includes("text")) vision.push({ id, label });
      if (inp.includes("video")) video.push({ id, label });
      if (inp.includes("image") && outp.includes("text")) pdf.push({ id, label });
    }

    // Deduplicate pdf (same as vision filter)
    const pdfIds = new Set(pdf.map((m) => m.id));
    const uniquePdf = pdf.filter((m) => {
      if (vision.find((v) => v.id === m.id)) return true;
      return pdfIds.has(m.id);
    });

    return { image, tts, stt, vision, video, pdf: uniquePdf };
  } catch {
    return empty;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function resolveApiKey(ctx: {
  modelRegistry: { find: (provider: string, id?: string) => { apiKey?: string } | undefined };
}): string | undefined {
  const envKey = process.env.OPENROUTER_API_KEY;
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
      const providers = config.providers as Record<string, unknown> | undefined;
      const openrouter = providers?.openrouter as Record<string, unknown> | undefined;
      const key = openrouter?.apiKey;
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

/** Short model slug for status display (e.g. "flux.2-pro" from "black-forest-labs/flux.2-pro"). */
function modelSlug(model: string): string {
  const slash = model.lastIndexOf("/");
  return slash >= 0 ? model.slice(slash + 1) : model;
}

export function statusLabel(state: ExtensionState): string {
  if (state.compactStatus) {
    const parts: string[] = [];
    if (state.searchEnabled) parts.push(`S ${state.searchEngine}`);
    else parts.push("S off");
    if (state.fetchEnabled) parts.push(`F ${state.fetchEngine}`);
    else parts.push("F off");
    if (state.imageEnabled) parts.push(`Img:${modelSlug(state.imageModel)}`);
    if (state.visionEnabled) parts.push(`Vis:${modelSlug(state.visionModel)}`);
    if (state.videoEnabled) parts.push(`Vid:${modelSlug(state.videoModel)}`);
    if (state.pdfEnabled) parts.push(`PDF:${modelSlug(state.pdfModel)}`);
    if (state.ttsEnabled) parts.push(`TTS:${modelSlug(state.ttsModel)}`);
    if (state.sttEnabled) parts.push(`STT:${modelSlug(state.sttModel)}`);
    return parts.join(" | ");
  }
  const parts: string[] = [];
  parts.push(state.searchEnabled ? `search:on(${state.searchEngine})` : "search:off");
  parts.push(state.fetchEnabled ? `fetch:on(${state.fetchEngine})` : "fetch:off");
  if (state.imageEnabled) parts.push(`img:on(${modelSlug(state.imageModel)})`);
  if (state.visionEnabled) parts.push(`vision:on(${modelSlug(state.visionModel)})`);
  if (state.videoEnabled) parts.push(`video:on(${modelSlug(state.videoModel)})`);
  if (state.pdfEnabled) parts.push(`pdf:on(${modelSlug(state.pdfModel)})`);
  if (state.ttsEnabled) parts.push(`tts:on(${modelSlug(state.ttsModel)})`);
  if (state.sttEnabled) parts.push(`stt:on(${modelSlug(state.sttModel)})`);
  return parts.join(" | ");
}

// ── API layer ────────────────────────────────────────────────────────────────

export async function callOpenRouterTool(
  apiKey: string,
  serverTool: string,
  toolParams: Record<string, unknown>,
  messages: Array<{ role: string; content: string }>,
  signal?: AbortSignal,
): Promise<{ ok: boolean; status: number; data?: Record<string, unknown>; error?: string }> {
  const toolDef: Record<string, unknown> = { type: serverTool };
  if (Object.keys(toolParams).length > 0) toolDef.parameters = toolParams;

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
export function extractResponse(data: Record<string, unknown>): { content?: string; toolCalls?: string } {
  const choice = (data.choices as Array<Record<string, unknown>>)?.[0];
  const msg = choice?.message as Record<string, unknown> | undefined;

  const content = msg?.content as string | null | undefined;
  if (content) return { content };

  const calls = msg?.tool_calls as Array<Record<string, unknown>> | undefined;
  if (calls?.length) {
    const parts: string[] = [];
    for (const c of calls) {
      const fn = c.function as Record<string, unknown> | undefined;
      if (fn?.arguments) parts.push(fn.arguments as string);
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
        messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
        modalities: ["image", "text"],
      }),
      signal,
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${text}` };
    }

    const data = (await res.json()) as Record<string, unknown>;
    const choice = (data.choices as Array<Record<string, unknown>>)?.[0];
    const msg = choice?.message as Record<string, unknown> | undefined;

    // Try multiple response formats
    // Format 1: images array with image_url.url
    const imagesRaw = msg?.images as Array<Record<string, unknown>> | undefined;
    if (imagesRaw?.length) {
      const urls: string[] = [];
      for (const img of imagesRaw) {
        const imageUrl = img.image_url as Record<string, unknown> | undefined;
        const url = imageUrl?.url as string | undefined;
        if (url) urls.push(url);
      }
      if (urls.length) return { ok: true, images: urls };
    }

    // Format 2: content is an array with image_url blocks
    const content = msg?.content;
    if (Array.isArray(content)) {
      const urls: string[] = [];
      for (const block of content) {
        if (block && typeof block === "object" && block.type === "image_url") {
          const url = block.image_url?.url as string | undefined;
          if (url) urls.push(url);
        }
      }
      if (urls.length) return { ok: true, images: urls };
    }

    // Format 3: single image_url in content
    if (content && typeof content === "object" && content.type === "image_url") {
      const url = content.image_url?.url as string | undefined;
      if (url) return { ok: true, images: [url] };
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
      const errText = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${errText}` };
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
      const errText = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${errText}` };
    }

    const data = (await res.json()) as Record<string, unknown>;
    const txt = data.text as string | undefined;
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
  if (plugins) body.plugins = plugins;

  try {
    const res = await fetch(`${OPENROUTER_API}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${errText}` };
    }
    const data = (await res.json()) as Record<string, unknown>;
    const choices = data.choices as Array<Record<string, unknown>> | undefined;
    const msg = choices?.[0]?.message as Record<string, unknown> | undefined;
    const txt = msg?.content as string | null | undefined;
    return { ok: true, text: txt || "(no response)" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
