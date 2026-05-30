# pi-openrouter-multimodal

OpenRouter multimodal tool integration for Pi. Provides five independently
toggleable tools:

- **`web_search`** — Server-side web search with real-time results
- **`web_fetch`** — Fetch page content from a URL (web, docs, PDFs)
- **`image_generate`** — Text-to-image generation via OpenRouter chat completions
- **`tts_speak`** — Text-to-speech via OpenRouter `/audio/speech` endpoint
- **`stt_transcribe`** — Speech-to-text via OpenRouter `/audio/transcriptions` endpoint

## Install

```bash
pi install npm:pi-openrouter-multimodal
```

## API Key

The extension resolves the OpenRouter API key from (priority order):

1. `OPENROUTER_API_KEY` environment variable
2. Pi model registry (provider `openrouter`)
3. `~/.pi/agent/models.json` under `providers.openrouter.apiKey`

## Commands

| Command | Description |
|---------|-------------|
| `/web-tools` | Unified settings panel for all tools |
| `/web-search` | Toggle `web_search`, configure search engine |
| `/web-fetch` | Toggle `web_fetch`, configure fetch engine |

Each command opens an interactive overlay. Use `↑↓` to navigate, `←→` to
toggle, `Esc` to close. Settings persist across sessions.

The `/web-tools` panel also includes toggles for `image_generate`,
`tts_speak`, `stt_transcribe`, and a verbose/compact status-bar setting.

## Tools

### web_search

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | required | Search query |
| `engine` | string | auto | auto, native, exa, firecrawl, parallel |
| `max_results` | integer | 5 | Results per search (1-25) |
| `search_context_size` | string | — | low (5K), medium (15K), high (30K) |
| `allowed_domains` | string[] | — | Only return results from these domains |
| `excluded_domains` | string[] | — | Exclude results from these domains |

### web_fetch

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | string | required | URL to fetch content from |
| `engine` | string | auto | auto, native, exa, openrouter, firecrawl, parallel |
| `max_content_tokens` | integer | — | Max content length (approximate tokens) |

### image_generate

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prompt` | string | required | Text prompt describing the image |
| `model` | string | google/gemini-3.1-flash-image-preview | Image gen model |

Supported models: `google/gemini-3.1-flash-image-preview`,
`google/gemini-2.5-flash-image`, `black-forest-labs/flux.2-pro`,
`black-forest-labs/flux.2-flex`.

### tts_speak

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `text` | string | required | Text to convert to speech |
| `model` | string | openai/gpt-4o-mini-tts | TTS model |
| `voice` | string | alloy | Voice name (model-dependent) |

Supported providers: OpenAI, ElevenLabs, Google, Mistral, Cartesia, xAI.

### stt_transcribe

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `audio` | string | required | Base64-encoded audio data |
| `format` | string | required | Audio format: wav, mp3, flac, m4a, ogg, webm, aac |
| `model` | string | openai/whisper-large-v3 | STT model |
| `language` | string | — | ISO-639-1 language code (optional) |

## How It Works

All tools proxy requests through OpenRouter's API:

- **web_search/web_fetch** — Chat completions with server tool definitions
  (`openrouter:web_search` / `openrouter:web_fetch`)
- **image_generate** — Chat completions with `modalities: ["image", "text"]`
  and compatible image generation models
- **tts_speak** — Direct call to `/api/v1/audio/speech`
- **stt_transcribe** — Direct call to `/api/v1/audio/transcriptions`

## References

- [OpenRouter Web Search docs](https://openrouter.ai/docs/guides/features/server-tools/web-search)
- [OpenRouter Web Fetch docs](https://openrouter.ai/docs/guides/features/server-tools/web-fetch)
- [OpenRouter Multimodal overview](https://openrouter.ai/docs/features/multimodal/overview)
- [OpenRouter Image Generation](https://openrouter.ai/docs/features/multimodal/image-generation)
- [OpenRouter TTS](https://openrouter.ai/docs/features/multimodal/text-to-speech)
