# pi-openrouter-search-fetch

OpenRouter web server tool integration for Pi. Provides two independently
toggleable server tools:

- **`web_search`** — Search the web for real-time information. The model
  decides when to search; OpenRouter executes it and returns results with
  citations.
- **`web_fetch`** — Fetch the content of a specific URL (web page, docs,
  PDF). The model calls it with a URL and gets back page content.

## Installation

Add the extension path to `~/.pi/agent/settings.json`:

```json
{
  "extensions": [
    "/Users/dtmirizzi/pkg/pi-openrouter-search-fetch/src/index.ts"
  ]
}
```

Or install as a package:

```bash
pi install pi-openrouter-search-fetch
```

## API Key

The extension looks for the OpenRouter API key in (priority order):

1. `OPENROUTER_API_KEY` environment variable
2. Pi model registry
3. `~/.pi/agent/models.json` under `providers.openrouter.apiKey`

## Commands

| Command | Description |
|---------|-------------|
| `/web-search` | Toggle `web_search` tool, set default search engine |
| `/web-fetch`  | Toggle `web_fetch` tool, set default fetch engine |
| `/web-tools`  | Unified settings for both tools in one panel |

Each command opens an interactive overlay. Use `↑↓` to navigate, `←→` to
toggle values, `Esc` to close. Settings persist across sessions and survive
branch navigation.

The footer shows the current state, e.g.:
```
web-search: on(auto) fetch:off
```

## web_search Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | required | Search query |
| `engine` | string | auto | auto, native, exa, firecrawl, parallel |
| `max_results` | integer | 5 | Results per search (1-25) |
| `search_context_size` | string | — | low (5K), medium (15K), high (30K) chars |
| `allowed_domains` | string[] | — | Only return results from these domains |
| `excluded_domains` | string[] | — | Exclude results from these domains |

## web_fetch Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | string | required | URL to fetch content from |
| `engine` | string | auto | auto, native, exa, openrouter, firecrawl, parallel |
| `max_content_tokens` | integer | — | Max content length (approximate tokens) |

## How It Works

Both tools work the same way under the hood:

1. The LLM calls the tool (e.g. `web_search` with a query, or `web_fetch`
   with a URL)
2. The extension proxies the request to OpenRouter's chat completions API
   with the corresponding server tool definition (`openrouter:web_search` or
   `openrouter:web_fetch`)
3. OpenRouter executes the server tool (search or fetch) and returns the
   synthesized results
4. The extension returns those results to the model

## References

- https://openrouter.ai/docs/guides/features/server-tools/web-search
- https://openrouter.ai/docs/guides/features/server-tools/web-fetch
