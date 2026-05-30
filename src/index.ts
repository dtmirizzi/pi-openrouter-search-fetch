/**
 * @dtmirizzi/pi-openrouter-multimodal
 *
 * Adds OpenRouter multimodal tools to Pi:
 *
 *   web_search      — server-side web search
 *   web_fetch       — server-side URL/content fetching
 *   image_generate  — text-to-image generation via chat completions
 *   tts_speak       — text-to-speech via /audio/speech
 *   stt_transcribe  — speech-to-text via /audio/transcriptions
 *   image_understand — analyze images via vision models
 *   video_understand — analyze videos via Gemini
 *   pdf_read        — extract/analyze PDFs
 *
 * Each tool is independently toggleable with model selection.
 * Settings at /web-tools and /web-models.
 */

import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  getSettingsListTheme,
  truncateHead,
} from "@earendil-works/pi-coding-agent";
import { Container, type SettingItem, SettingsList } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import type { ExtensionState, ModelOption } from "./helpers";
import {
  callChatMultimodal,
  callOpenRouterTool,
  DEFAULT_STATE,
  extractResponse,
  FALLBACK_IMAGE_MODELS,
  FALLBACK_PDF_MODELS,
  FALLBACK_STT_MODELS,
  FALLBACK_TTS_MODELS,
  FALLBACK_TTS_VOICES,
  FALLBACK_VIDEO_MODELS,
  FALLBACK_VISION_MODELS,
  fetchOpenRouterModels,
  generateImage,
  isActiveModelOpenRouter,
  persistState,
  resolveApiKey,
  restoreState,
  setToolActive,
  speakText,
  statusLabel,
  transcribeAudio,
} from "./helpers";

const SEARCH_SRV = "openrouter:web_search";
const FETCH_SRV = "openrouter:web_fetch";
const SEARCH_TOOL = "web_search";
const FETCH_TOOL = "web_fetch";
const IMAGE_TOOL = "image_generate";
const VISION_TOOL = "image_understand";
const VIDEO_TOOL = "video_understand";
const PDF_TOOL = "pdf_read";
const TTS_TOOL = "tts_speak";
const STT_TOOL = "stt_transcribe";

// ── Model options cache ────────────────────────────────────────────────────

let imageModels: ModelOption[] = [...FALLBACK_IMAGE_MODELS];
let visionModels: ModelOption[] = [...FALLBACK_VISION_MODELS];
let videoModels: ModelOption[] = [...FALLBACK_VIDEO_MODELS];
let pdfModels: ModelOption[] = [...FALLBACK_PDF_MODELS];
let ttsModels: ModelOption[] = [...FALLBACK_TTS_MODELS];
const ttsVoices: ModelOption[] = [...FALLBACK_TTS_VOICES];
let sttModels: ModelOption[] = [...FALLBACK_STT_MODELS];

/** Settings helpers */
function _modelToSettingValue(m: ModelOption): string {
  return m.id;
}

function labelToModelId(label: string, options: ModelOption[]): string {
  const found = options.find((m) => m.label === label);
  return found ? found.id : (options[0]?.id ?? label);
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
            return [theme.fg("accent", theme.bold(title)), theme.fg("dim", "─".repeat(40))];
          }
          invalidate() {}
        })(),
      );

      // Make the list tall enough for all items
      const settingsList = new SettingsList(
        items,
        Math.min(items.length + 4, 22),
        getSettingsListTheme(),
        (id, newValue) => {
          onChange(id, newValue);
        },
        () => done(undefined),
      );

      container.addChild(settingsList);

      const hint = new (class {
        render() {
          return ["", theme.fg("dim", "↑↓ navigate  ·  ←→ cycle value  ·  Esc close")];
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

  function applyState(ctx: ExtensionContext) {
    setToolActive(pi, SEARCH_TOOL, state.searchEnabled);
    setToolActive(pi, FETCH_TOOL, state.fetchEnabled);
    setToolActive(pi, IMAGE_TOOL, state.imageEnabled);
    setToolActive(pi, VISION_TOOL, state.visionEnabled);
    setToolActive(pi, VIDEO_TOOL, state.videoEnabled);
    setToolActive(pi, PDF_TOOL, state.pdfEnabled);
    setToolActive(pi, TTS_TOOL, state.ttsEnabled);
    setToolActive(pi, STT_TOOL, state.sttEnabled);
    ctx.ui.setStatus("web-tools", statusLabel(state));
  }

  // ── Fetch live model list from OpenRouter on startup ──────────────────

  pi.on("session_start", async (_event, ctx) => {
    state = restoreState(ctx);
    applyState(ctx);

    // Fetch latest models from OpenRouter in background (non-blocking)
    const apiKey = await resolveApiKey(ctx);
    if (apiKey) {
      fetchOpenRouterModels(apiKey)
        .then((fetched) => {
          if (fetched.image.length > 0) imageModels = fetched.image;
          if (fetched.vision.length > 0) visionModels = fetched.vision;
          if (fetched.video.length > 0) videoModels = fetched.video;
          if (fetched.pdf.length > 0) pdfModels = fetched.pdf;
          if (fetched.tts.length > 0) ttsModels = fetched.tts;
          if (fetched.stt.length > 0) sttModels = fetched.stt;
        })
        .catch(() => {
          // Keep fallbacks silently
        });
    }
  });

  pi.on("session_tree", async (_event, ctx) => {
    state = restoreState(ctx);
    applyState(ctx);
  });

  pi.on("session_shutdown", async (_event, _ctx) => {
    persistState(pi, state);
  });

  pi.on("session_compact", async (_event, _ctx) => {
    persistState(pi, state);
  });

  // ── /web-tools (toggle tools) ──────────────────────────────────────────

  pi.registerCommand("web-tools", {
    description: "Configure all OpenRouter tools — toggle tools and set engines",
    handler: async (_args, ctx) => {
      const items: SettingItem[] = [
        {
          id: "s-enabled",
          label: "Web Search",
          currentValue: state.searchEnabled ? "on" : "off",
          values: ["on", "off"],
        },
        {
          id: "s-engine",
          label: "Search Engine",
          currentValue: state.searchEngine,
          values: ["auto", "native", "exa", "firecrawl", "parallel"],
        },
        { id: "f-enabled", label: "Web Fetch", currentValue: state.fetchEnabled ? "on" : "off", values: ["on", "off"] },
        {
          id: "f-engine",
          label: "Fetch Engine",
          currentValue: state.fetchEngine,
          values: ["auto", "native", "exa", "openrouter", "firecrawl", "parallel"],
        },
        {
          id: "i-enabled",
          label: "Image Generate",
          currentValue: state.imageEnabled ? "on" : "off",
          values: ["on", "off"],
        },
        {
          id: "v-enabled",
          label: "Image Understand",
          currentValue: state.visionEnabled ? "on" : "off",
          values: ["on", "off"],
        },
        {
          id: "d-enabled",
          label: "Video Understand",
          currentValue: state.videoEnabled ? "on" : "off",
          values: ["on", "off"],
        },
        { id: "p-enabled", label: "PDF Read", currentValue: state.pdfEnabled ? "on" : "off", values: ["on", "off"] },
        { id: "t-enabled", label: "TTS (Speak)", currentValue: state.ttsEnabled ? "on" : "off", values: ["on", "off"] },
        {
          id: "r-enabled",
          label: "STT (Transcribe)",
          currentValue: state.sttEnabled ? "on" : "off",
          values: ["on", "off"],
        },
        {
          id: "compact",
          label: "Status Bar",
          currentValue: state.compactStatus ? "compact" : "verbose",
          values: ["verbose", "compact"],
        },
      ];

      await openSettings(ctx, "OpenRouter Web Tools", items, (id, val) => {
        if (id === "s-enabled") state.searchEnabled = val === "on";
        else if (id === "s-engine") state.searchEngine = val;
        else if (id === "f-enabled") state.fetchEnabled = val === "on";
        else if (id === "f-engine") state.fetchEngine = val;
        else if (id === "i-enabled") state.imageEnabled = val === "on";
        else if (id === "v-enabled") state.visionEnabled = val === "on";
        else if (id === "d-enabled") state.videoEnabled = val === "on";
        else if (id === "p-enabled") state.pdfEnabled = val === "on";
        else if (id === "t-enabled") state.ttsEnabled = val === "on";
        else if (id === "r-enabled") state.sttEnabled = val === "on";
        else if (id === "compact") state.compactStatus = val === "compact";
        persistState(pi, state);
        applyState(ctx);
      });
    },
  });

  // ── /web-models (select models) ────────────────────────────────────────

  pi.registerCommand("web-models", {
    description: "Select models for each modality — image, vision, video, PDF, TTS, STT",
    handler: async (_args, ctx) => {
      const imgValues = imageModels.map((m) => m.label);
      const visValues = visionModels.map((m) => m.label);
      const vidValues = videoModels.map((m) => m.label);
      const pdfValues = pdfModels.map((m) => m.label);
      const ttsValues = ttsModels.map((m) => m.label);
      const voxValues = ttsVoices.map((m) => m.id);
      const sttValues = sttModels.map((m) => m.label);

      // Current labels for display
      const imgCurrent =
        imageModels.find((m) => m.id === state.imageModel)?.label ?? imageModels[0]?.label ?? state.imageModel;
      const visCurrent =
        visionModels.find((m) => m.id === state.visionModel)?.label ?? visionModels[0]?.label ?? state.visionModel;
      const vidCurrent =
        videoModels.find((m) => m.id === state.videoModel)?.label ?? videoModels[0]?.label ?? state.videoModel;
      const pdfCurrent = pdfModels.find((m) => m.id === state.pdfModel)?.label ?? pdfModels[0]?.label ?? state.pdfModel;
      const ttsCurrent = ttsModels.find((m) => m.id === state.ttsModel)?.label ?? ttsModels[0]?.label ?? state.ttsModel;
      const voxCurrent = state.ttsVoice;
      const sttCurrent = sttModels.find((m) => m.id === state.sttModel)?.label ?? sttModels[0]?.label ?? state.sttModel;

      const items: SettingItem[] = [
        { id: "i-model", label: "Image Model", currentValue: imgCurrent, values: imgValues },
        { id: "v-model", label: "Vision Model", currentValue: visCurrent, values: visValues },
        { id: "d-model", label: "Video Model", currentValue: vidCurrent, values: vidValues },
        { id: "p-model", label: "PDF Model", currentValue: pdfCurrent, values: pdfValues },
        { id: "t-model", label: "TTS Model", currentValue: ttsCurrent, values: ttsValues },
        { id: "t-voice", label: "TTS Voice", currentValue: voxCurrent, values: voxValues },
        { id: "r-model", label: "STT Model", currentValue: sttCurrent, values: sttValues },
      ];

      await openSettings(ctx, "OpenRouter Model Selection", items, (id, val) => {
        if (id === "i-model") state.imageModel = labelToModelId(val, imageModels);
        else if (id === "v-model") state.visionModel = labelToModelId(val, visionModels);
        else if (id === "d-model") state.videoModel = labelToModelId(val, videoModels);
        else if (id === "p-model") state.pdfModel = labelToModelId(val, pdfModels);
        else if (id === "t-model") state.ttsModel = labelToModelId(val, ttsModels);
        else if (id === "t-voice") state.ttsVoice = val;
        else if (id === "r-model") state.sttModel = labelToModelId(val, sttModels);
        persistState(pi, state);
        applyState(ctx);
      });
    },
  });

  // ── /web-search ─────────────────────────────────────────────────────────

  pi.registerCommand("web-search", {
    description: "Toggle web_search tool and configure default search engine",
    handler: async (_args, ctx) => {
      const items: SettingItem[] = [
        {
          id: "s-enabled",
          label: "Web Search",
          currentValue: state.searchEnabled ? "on" : "off",
          values: ["on", "off"],
        },
        {
          id: "s-engine",
          label: "Search Engine",
          currentValue: state.searchEngine,
          values: ["auto", "native", "exa", "firecrawl", "parallel"],
        },
      ];
      await openSettings(ctx, "OpenRouter Web Search", items, (id, val) => {
        if (id === "s-enabled") state.searchEnabled = val === "on";
        else if (id === "s-engine") state.searchEngine = val;
        persistState(pi, state);
        applyState(ctx);
      });
    },
  });

  // ── /web-fetch ──────────────────────────────────────────────────────────

  pi.registerCommand("web-fetch", {
    description: "Toggle web_fetch tool and configure default fetch engine",
    handler: async (_args, ctx) => {
      const items: SettingItem[] = [
        { id: "f-enabled", label: "Web Fetch", currentValue: state.fetchEnabled ? "on" : "off", values: ["on", "off"] },
        {
          id: "f-engine",
          label: "Fetch Engine",
          currentValue: state.fetchEngine,
          values: ["auto", "native", "exa", "openrouter", "firecrawl", "parallel"],
        },
      ];
      await openSettings(ctx, "OpenRouter Web Fetch", items, (id, val) => {
        if (id === "f-enabled") state.fetchEnabled = val === "on";
        else if (id === "f-engine") state.fetchEngine = val;
        persistState(pi, state);
        applyState(ctx);
      });
    },
  });

  // ── web_search tool ─────────────────────────────────────────────────────

  pi.registerTool({
    name: SEARCH_TOOL,
    label: "Web Search",
    description:
      "Search the web for real-time information via OpenRouter. " +
      "Use when you need current events, recent data, facts you're unsure about, " +
      "or anything that has changed recently. Only functional with OpenRouter models.",
    promptGuidelines: [
      "Use web_search when you need real-time information, current events, or data you're uncertain about.",
      "Only works with OpenRouter models.",
    ],
    parameters: Type.Object({
      query: Type.String({ description: "Search query string" }),
      engine: Type.Optional(
        Type.String({ description: "Search engine: auto (default), native, exa, firecrawl, parallel" }),
      ),
      max_results: Type.Optional(
        Type.Integer({ minimum: 1, maximum: 25, description: "Max results per call (1-25, default 5)" }),
      ),
      search_context_size: Type.Optional(
        Type.String({ description: "Context per result: low (5K), medium (15K), high (30K)" }),
      ),
      allowed_domains: Type.Optional(
        Type.Array(Type.String(), { description: "Only return results from these domains" }),
      ),
      excluded_domains: Type.Optional(Type.Array(Type.String(), { description: "Exclude results from these domains" })),
    }),

    async execute(_id, params, signal, onUpdate, ctx) {
      if (!isActiveModelOpenRouter(ctx)) {
        return {
          content: [{ type: "text", text: "web_search is only available with OpenRouter models." }],
          details: { error: "wrong_provider" },
        };
      }
      const apiKey = await resolveApiKey(ctx);
      if (!apiKey) {
        return { content: [{ type: "text", text: "No OpenRouter API key found." }], details: { error: "no_api_key" } };
      }

      const engine = params.engine || state.searchEngine;
      onUpdate?.({ content: [{ type: "text", text: `Searching: "${params.query}"...` }], details: {} });

      const toolParams: Record<string, unknown> = {};
      if (engine && engine !== "auto") toolParams.engine = engine;
      if (params.max_results) toolParams.max_results = params.max_results;
      if (params.search_context_size) toolParams.search_context_size = params.search_context_size;
      if (params.allowed_domains) toolParams.allowed_domains = params.allowed_domains;
      if (params.excluded_domains) toolParams.excluded_domains = params.excluded_domains;

      const res = await callOpenRouterTool(
        apiKey,
        SEARCH_SRV,
        toolParams,
        [{ role: "user", content: params.query }],
        signal,
      );

      if (!res.ok) throw new Error(`OpenRouter search error (${res.status}): ${res.error}`);

      const extracted = extractResponse(res.data!);
      if (extracted.content) {
        return { content: [{ type: "text", text: extracted.content }], details: { source: "openrouter", engine } };
      }
      if (extracted.toolCalls) {
        const tr = truncateHead(extracted.toolCalls, { maxLines: DEFAULT_MAX_LINES, maxBytes: DEFAULT_MAX_BYTES });
        return {
          content: [{ type: "text", text: tr.content }],
          details: { source: "tool_calls", engine, truncated: tr.truncated },
        };
      }
      return { content: [{ type: "text", text: "No results." }], details: { status: "empty" } };
    },
  });

  // ── web_fetch tool ───────────────────────────────────────────────────────

  pi.registerTool({
    name: FETCH_TOOL,
    label: "Web Fetch",
    description:
      "Fetch the content of a specific URL via OpenRouter. " +
      "Use when you need to read a web page, documentation, article, or PDF. " +
      "Returns the page title and text content. Only functional with OpenRouter models.",
    promptGuidelines: [
      "Use web_fetch to read the content of a specific URL when you need to analyze or summarize a known page.",
      "Only works with OpenRouter models.",
    ],
    parameters: Type.Object({
      url: Type.String({ description: "URL to fetch content from" }),
      engine: Type.Optional(
        Type.String({ description: "Fetch engine: auto (default), native, exa, openrouter, firecrawl, parallel" }),
      ),
      max_content_tokens: Type.Optional(
        Type.Integer({ description: "Max content length in approximate tokens (e.g. 50000)" }),
      ),
    }),

    async execute(_id, params, signal, onUpdate, ctx) {
      if (!isActiveModelOpenRouter(ctx)) {
        return {
          content: [{ type: "text", text: "web_fetch is only available with OpenRouter models." }],
          details: { error: "wrong_provider" },
        };
      }
      const apiKey = await resolveApiKey(ctx);
      if (!apiKey) {
        return { content: [{ type: "text", text: "No OpenRouter API key found." }], details: { error: "no_api_key" } };
      }

      const engine = params.engine || state.fetchEngine;
      onUpdate?.({ content: [{ type: "text", text: `Fetching: ${params.url}...` }], details: {} });

      const toolParams: Record<string, unknown> = {};
      if (engine && engine !== "auto") toolParams.engine = engine;
      if (params.max_content_tokens) toolParams.max_content_tokens = params.max_content_tokens;

      const res = await callOpenRouterTool(
        apiKey,
        FETCH_SRV,
        toolParams,
        [{ role: "user", content: `Fetch and show me the content at ${params.url}` }],
        signal,
      );

      if (!res.ok) throw new Error(`OpenRouter fetch error (${res.status}): ${res.error}`);

      const extracted = extractResponse(res.data!);
      if (extracted.content) {
        const tr = truncateHead(extracted.content, { maxLines: DEFAULT_MAX_LINES, maxBytes: DEFAULT_MAX_BYTES });
        return {
          content: [{ type: "text", text: tr.content }],
          details: { source: "openrouter", engine, url: params.url, truncated: tr.truncated },
        };
      }
      if (extracted.toolCalls) {
        const tr = truncateHead(extracted.toolCalls, { maxLines: DEFAULT_MAX_LINES, maxBytes: DEFAULT_MAX_BYTES });
        return {
          content: [{ type: "text", text: tr.content }],
          details: { source: "tool_calls", engine, url: params.url, truncated: tr.truncated },
        };
      }
      return {
        content: [{ type: "text", text: "Fetch returned no content." }],
        details: { status: "empty", url: params.url },
      };
    },
  });

  // ── image_generate tool ──────────────────────────────────────────────────

  pi.registerTool({
    name: IMAGE_TOOL,
    label: "Image Generate",
    description:
      "Generate images from text prompts via OpenRouter. " +
      "Choose from compatible image generation models. " +
      "Returns base64-encoded PNG images. " +
      "Use /web-models to see and select available image models.",
    promptGuidelines: [
      "Use image_generate when the user asks to create, generate, or draw an image.",
      "Images are returned as base64 data URLs — display them inline when possible.",
    ],
    parameters: Type.Object({
      prompt: Type.String({ description: "Text prompt describing the image to generate" }),
      model: Type.Optional(Type.String({ description: "Image gen model (overrides default from /web-models)" })),
    }),

    async execute(_id, params, signal, onUpdate, ctx) {
      if (!isActiveModelOpenRouter(ctx)) {
        return {
          content: [{ type: "text", text: "image_generate is only available with OpenRouter models." }],
          details: { error: "wrong_provider" },
        };
      }
      const apiKey = await resolveApiKey(ctx);
      if (!apiKey) {
        return { content: [{ type: "text", text: "No OpenRouter API key found." }], details: { error: "no_api_key" } };
      }

      const model = (params.model as string) || state.imageModel;
      onUpdate?.({ content: [{ type: "text", text: `Generating image with ${model}...` }], details: {} });

      const result = await generateImage(apiKey, params.prompt, model, signal);

      if (!result.ok) {
        throw new Error(`Image generation failed: ${result.error}`);
      }

      if (result.images?.length) {
        const tmpPath = join(tmpdir(), `pi-image-${Date.now()}.png`);
        const b64 = result.images[0].replace(/^data:image\/\w+;base64,/, "");
        writeFileSync(tmpPath, Buffer.from(b64, "base64"));
        return {
          content: [
            { type: "text", text: `Generated image from prompt: "${params.prompt}"` },
            { type: "image", data: result.images[0], mimeType: "image/png" },
          ],
          details: { model, imageCount: result.images.length, savedTo: tmpPath },
        };
      }

      return {
        content: [{ type: "text", text: "Image generation returned no images." }],
        details: { status: "empty" },
      };
    },
  });

  // ── tts_speak tool ───────────────────────────────────────────────────────

  pi.registerTool({
    name: TTS_TOOL,
    label: "TTS Speak",
    description:
      "Convert text to speech via OpenRouter's /audio/speech endpoint. " +
      "Returns an MP3 audio file saved to a temp location. " +
      "Use /web-models to select TTS model and voice.",
    promptGuidelines: ["Use tts_speak when the user asks to speak text aloud or convert text to audio."],
    parameters: Type.Object({
      text: Type.String({ description: "Text to convert to speech" }),
      model: Type.Optional(Type.String({ description: "TTS model (overrides default from /web-models)" })),
      voice: Type.Optional(Type.String({ description: "Voice name (overrides default from /web-models)" })),
    }),

    async execute(_id, params, signal, onUpdate, ctx) {
      if (!isActiveModelOpenRouter(ctx)) {
        return {
          content: [{ type: "text", text: "tts_speak is only available with OpenRouter models." }],
          details: { error: "wrong_provider" },
        };
      }
      const apiKey = await resolveApiKey(ctx);
      if (!apiKey) {
        return { content: [{ type: "text", text: "No OpenRouter API key found." }], details: { error: "no_api_key" } };
      }

      const model = (params.model as string) || state.ttsModel;
      const voice = (params.voice as string) || state.ttsVoice;
      onUpdate?.({ content: [{ type: "text", text: `Speaking: "${params.text.substring(0, 80)}..."` }], details: {} });

      const result = await speakText(apiKey, params.text, model, voice, signal);

      if (!result.ok) {
        throw new Error(`TTS failed: ${result.error}`);
      }

      const ext = result.contentType?.includes("mp3") ? "mp3" : "bin";
      const tmpPath = join(tmpdir(), `pi-tts-${Date.now()}.${ext}`);
      writeFileSync(tmpPath, Buffer.from(result.buffer!));

      return {
        content: [
          {
            type: "text",
            text: `TTS audio saved to: ${tmpPath}\nText: "${params.text}"\nModel: ${model}, Voice: ${voice}`,
          },
        ],
        details: { model, voice, savedTo: tmpPath, size: result.buffer!.byteLength },
      };
    },
  });

  // ── stt_transcribe tool ──────────────────────────────────────────────────

  pi.registerTool({
    name: STT_TOOL,
    label: "STT Transcribe",
    description:
      "Transcribe audio to text via OpenRouter's /audio/transcriptions endpoint. " +
      "Provide base64-encoded audio and its format. " +
      "Supports wav, mp3, flac, m4a, ogg, webm, aac. " +
      "Use /web-models to select the STT model.",
    promptGuidelines: [
      "Use stt_transcribe when the user provides an audio file and wants it transcribed.",
      "The audio must be base64-encoded. Use the 'read' tool first to get the file contents.",
    ],
    parameters: Type.Object({
      audio: Type.String({ description: "Base64-encoded audio data" }),
      format: Type.String({ description: "Audio format: wav, mp3, flac, m4a, ogg, webm, aac" }),
      model: Type.Optional(Type.String({ description: "STT model (overrides default from /web-models)" })),
      language: Type.Optional(Type.String({ description: "ISO-639-1 language code for better accuracy" })),
    }),

    async execute(_id, params, signal, onUpdate, ctx) {
      if (!isActiveModelOpenRouter(ctx)) {
        return {
          content: [{ type: "text", text: "stt_transcribe is only available with OpenRouter models." }],
          details: { error: "wrong_provider" },
        };
      }
      const apiKey = await resolveApiKey(ctx);
      if (!apiKey) {
        return { content: [{ type: "text", text: "No OpenRouter API key found." }], details: { error: "no_api_key" } };
      }

      const model = (params.model as string) || state.sttModel;
      onUpdate?.({ content: [{ type: "text", text: "Transcribing audio..." }], details: {} });

      const result = await transcribeAudio(apiKey, params.audio, params.format, model, params.language, signal);

      if (!result.ok) {
        throw new Error(`Transcription failed: ${result.error}`);
      }

      return {
        content: [{ type: "text", text: result.text || "(empty transcription)" }],
        details: { model, language: params.language, format: params.format },
      };
    },
  });

  // ── image_understand tool ───────────────────────────────────────────────

  pi.registerTool({
    name: VISION_TOOL,
    label: "Image Understand",
    description:
      "Analyze an image via OpenRouter vision models. " +
      "Provide an image URL or base64 data and a prompt describing what to analyze. " +
      "Use /web-models to select the vision model. " +
      "Only functional with OpenRouter models.",
    promptGuidelines: [
      "Use image_understand when you need to analyze or describe an image.",
      "Provide the image URL and a specific prompt about what to look for.",
      "Works with both public URLs and base64-encoded image data.",
    ],
    parameters: Type.Object({
      url: Type.String({ description: "Image URL or base64 data URL (data:image/...;base64,...)" }),
      prompt: Type.Optional(Type.String({ description: "What to analyze (default: 'Describe this image in detail')" })),
      model: Type.Optional(Type.String({ description: "Vision model (overrides default from /web-models)" })),
    }),

    async execute(_id, params, signal, onUpdate, ctx) {
      if (!isActiveModelOpenRouter(ctx)) {
        return {
          content: [{ type: "text", text: "image_understand is only available with OpenRouter models." }],
          details: { error: "wrong_provider" },
        };
      }
      const apiKey = await resolveApiKey(ctx);
      if (!apiKey) {
        return { content: [{ type: "text", text: "No OpenRouter API key found." }], details: { error: "no_api_key" } };
      }

      const model = (params.model as string) || state.visionModel;
      const prompt = (params.prompt as string) || "Describe this image in detail";
      onUpdate?.({ content: [{ type: "text", text: "Analyzing image..." }], details: {} });

      const result = await callChatMultimodal(
        apiKey,
        prompt,
        { type: "image_url", image_url: { url: params.url } },
        model,
        undefined,
        signal,
      );

      if (!result.ok) throw new Error(`Image understanding failed: ${result.error}`);
      return { content: [{ type: "text", text: result.text! }], details: { model } };
    },
  });

  // ── video_understand tool ───────────────────────────────────────────────

  pi.registerTool({
    name: VIDEO_TOOL,
    label: "Video Understand",
    description:
      "Analyze a video via OpenRouter. Provide a video URL (YouTube links work with Gemini models). " +
      "Use /web-models to select the video model. " +
      "Only functional with OpenRouter models.",
    promptGuidelines: [
      "Use video_understand when you need to analyze or summarize video content.",
      "YouTube links are supported with Google Gemini models.",
    ],
    parameters: Type.Object({
      url: Type.String({ description: "Video URL (YouTube link for Gemini, or direct video URL)" }),
      prompt: Type.Optional(
        Type.String({ description: "What to analyze (default: 'Describe what happens in this video')" }),
      ),
      model: Type.Optional(Type.String({ description: "Video model (overrides default from /web-models)" })),
    }),

    async execute(_id, params, signal, onUpdate, ctx) {
      if (!isActiveModelOpenRouter(ctx)) {
        return {
          content: [{ type: "text", text: "video_understand is only available with OpenRouter models." }],
          details: { error: "wrong_provider" },
        };
      }
      const apiKey = await resolveApiKey(ctx);
      if (!apiKey) {
        return { content: [{ type: "text", text: "No OpenRouter API key found." }], details: { error: "no_api_key" } };
      }

      const model = (params.model as string) || state.videoModel;
      const prompt = (params.prompt as string) || "Describe what happens in this video";
      onUpdate?.({ content: [{ type: "text", text: "Analyzing video (this may take a while)..." }], details: {} });

      const result = await callChatMultimodal(
        apiKey,
        prompt,
        { type: "video_url", video_url: { url: params.url } },
        model,
        undefined,
        signal,
      );

      if (!result.ok) throw new Error(`Video understanding failed: ${result.error}`);
      return { content: [{ type: "text", text: result.text! }], details: { model } };
    },
  });

  // ── pdf_read tool ───────────────────────────────────────────────────────

  pi.registerTool({
    name: PDF_TOOL,
    label: "PDF Read",
    description:
      "Extract and analyze content from a PDF via OpenRouter. Provide a PDF URL. " +
      "Use /web-models to select the PDF model. " +
      "Only functional with OpenRouter models.",
    promptGuidelines: [
      "Use pdf_read when you need to extract or analyze content from a PDF document.",
      "Provide the PDF URL and optionally specify what to extract or summarize.",
      "By default uses cloudflare-ai engine (free) for text extraction.",
    ],
    parameters: Type.Object({
      url: Type.String({ description: "URL of the PDF document" }),
      prompt: Type.Optional(
        Type.String({ description: "What to extract/analyze (default: 'Summarize this document')" }),
      ),
      model: Type.Optional(Type.String({ description: "Model (overrides default from /web-models)" })),
      engine: Type.Optional(
        Type.String({
          description: "PDF engine: cloudflare-ai (default, free), mistral-ocr (scanned docs), or native",
        }),
      ),
    }),

    async execute(_id, params, signal, onUpdate, ctx) {
      if (!isActiveModelOpenRouter(ctx)) {
        return {
          content: [{ type: "text", text: "pdf_read is only available with OpenRouter models." }],
          details: { error: "wrong_provider" },
        };
      }
      const apiKey = await resolveApiKey(ctx);
      if (!apiKey) {
        return { content: [{ type: "text", text: "No OpenRouter API key found." }], details: { error: "no_api_key" } };
      }

      const model = (params.model as string) || state.pdfModel;
      const prompt = (params.prompt as string) || "Summarize this document";
      const engine = (params.engine as string) || "cloudflare-ai";
      onUpdate?.({ content: [{ type: "text", text: `Reading PDF: ${params.url}...` }], details: {} });

      const plugins = [{ id: "file-parser", pdf: { engine } }];
      const result = await callChatMultimodal(
        apiKey,
        prompt,
        { type: "file", file: { filename: "document.pdf", file_data: params.url } },
        model,
        plugins,
        signal,
      );

      if (!result.ok) throw new Error(`PDF read failed: ${result.error}`);
      return { content: [{ type: "text", text: result.text! }], details: { model, engine } };
    },
  });
}
