# MrScraper tools for the AI SDK

[MrScraper](https://mrscraper.com) tools for the [Vercel AI SDK](https://ai-sdk.dev):
retrieve public web pages as HTML, Markdown, or screenshots, extract brand
details and structured JSON, search the web, and check your MrScraper account
status.

## Overview

The seven MrScraper services as AI SDK tools. Tool names, descriptions, input
fields, and defaults follow the MrScraper Integrations Standard, shared by the
MrScraper CLI, SDKs, and [MCP server](https://github.com/mrscraper-com/mrscraper-mcp).
Requests go through [`@mrscraper/sdk`](https://www.npmjs.com/package/@mrscraper/sdk) 6.
See the [API Reference](https://docs.mrscraper.com/docs/api/overview).

| Tool | Factory | Description |
| --- | --- | --- |
| `status` | `statusTool()` | Return the raw account status API response without summarizing, redacting body fields, or adding calculated fields. |
| `scrapeHtml` | `scrapeHtmlTool()` | Retrieve the raw HTML of a page. Browser rendering is optional. |
| `scrapeMarkdown` | `scrapeMarkdownTool()` | Retrieve a page as Markdown. Including HTML also enables browser rendering and returns both outputs as JSON. |
| `getScreenshot` | `getScreenshotTool()` | Capture a base64 screenshot of the full page or top viewport. Browser rendering is always enabled. |
| `scrapeBrand` | `scrapeBrandTool()` | Extract a website's colors, typography, logos, and social links as JSON. |
| `scrapeJson` | `scrapeJsonTool()` | Extract structured JSON from a page using a natural-language prompt. Append Json Schema: and a JSON schema to shape the output. |
| `webSearch` | `webSearchTool()` | Search the web and return ranked results with titles, URLs, descriptions, and sources. |

`mrscraperTools()` returns all seven, keyed by tool name.

## Installation

```bash
npm install @mrscraper/ai-sdk ai zod
```

Requires AI SDK 7 and Node.js 18 or later.

## Authentication

Get an API key at [app.mrscraper.com/api-tokens](https://app.mrscraper.com/api-tokens)
and set it as `MRSCRAPER_API_KEY`, or pass `apiKey` to `mrscraperTools()` or a
tool factory. The tools use `apiKey`, then `MRSCRAPER_API_KEY`, then
`MRSCRAPER_API_TOKEN`. The key is sent in request headers. It is not a tool
input, so the model never sees it.

## Quickstart

```ts
import { generateText, isStepCount } from "ai";
import { mrscraperTools } from "@mrscraper/ai-sdk";

const { text } = await generateText({
  model: "openai/gpt-5",
  prompt: "Read https://example.com as Markdown and summarize it in two sentences.",
  tools: mrscraperTools(),
  stopWhen: isStepCount(5),
});

console.log(text);
```

Pick individual tools when you only need some of them:

```ts
import { scrapeMarkdownTool, webSearchTool } from "@mrscraper/ai-sdk";

const tools = {
  scrapeMarkdown: scrapeMarkdownTool({ apiKey: process.env.MRSCRAPER_API_KEY }),
  webSearch: webSearchTool(),
};
```

Examples use `example.com` as the sample target. Replace it for your use case.
Live scraping and search calls consume account quota.

## Shared parameters

### Page controls

`scrapeHtml`, `scrapeMarkdown`, `getScreenshot`, and `scrapeJson` share these
inputs. Page defaults are 300 seconds, US geolocation/proxy country,
real-device routing off, and dashboard saving off. Omitted retry limits mean
no limit.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `url` | string | Required | Absolute HTTP or HTTPS URL of the page to process. |
| `timeout` | number (integer) | `300` | Page load timeout in seconds, from 1 to 300. The HTTP request allows 30 additional seconds. |
| `geoCode` | string | `"us"` | Two-letter country code to load the page from, sent in lowercase. |
| `proxyCountry` | string | `"us"` | Two-letter country code of the proxy server, sent in lowercase. |
| `super` | boolean | `false` | Whether to route the request through real devices. |
| `waitUntil` | string: `domcontentloaded`, `load`, `networkidle0`, `networkidle2` | `"domcontentloaded"` | Navigation completion event to wait for: domcontentloaded, load, networkidle0, or networkidle2. |
| `proxy` | string | Omitted | Custom proxy URL used to load the page. |
| `maxRetries` | number (integer) | Omitted | Maximum number of retries, as a nonnegative integer. Omit this parameter for no limit. |
| `saveResult` | boolean | `false` | Whether to save the result to the dashboard Result tab. |

### Loading controls

`scrapeHtml`, `scrapeMarkdown`, and `getScreenshot` also accept these inputs.
`scrapeJson` does not.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `blockResources` | boolean | `false` | Whether to block images, fonts, and stylesheets while loading the page. |
| `waitForSelector` | string | Omitted | Wait for the page to contain the specified CSS selector before returning the result. |
| `returnCookie` | boolean | `false` | Whether to include browser session cookies in the response. |

Browser rendering is optional for HTML, Markdown, and JSON; screenshots always
enable it. Markdown with HTML also enables browser rendering.

## Service reference

### Status

Tool `status`, factory `statusTool()`.

Return the raw account status API response without summarizing, redacting body fields, or adding calculated fields.

This service takes no service parameters. Authentication is configured
separately. The HTTP deadline is fixed at 600 seconds. It is not a service
parameter.

Response: The API body contains message and data. Account details remain
nested in data, including subscriptionItem and scraperAllowance. The response
envelope therefore exposes account details at data.data. Sensitive response
headers are removed.

### Scrape HTML

Tool `scrapeHtml`, factory `scrapeHtmlTool()`.

Retrieve the raw HTML of a page. Browser rendering is optional.

Inputs: [page controls](#page-controls), [loading controls](#loading-controls), and:

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `browserRendering` | boolean | `false` | Whether to render the page in a browser before returning the result. |
| `warmStart` | boolean | `false` | Whether to enable warm start for more reliable scraping, at the cost of additional latency. |

Example input:

```json
{
  "url": "https://example.com",
  "browserRendering": true,
  "warmStart": true,
  "waitForSelector": "body",
  "timeout": 120
}
```

Response: The default response body is HTML text. Additional controls can
cause the API to return JSON; the returned structure is preserved.

### Scrape Markdown

Tool `scrapeMarkdown`, factory `scrapeMarkdownTool()`.

Retrieve a page as Markdown. Including HTML also enables browser rendering and returns both outputs as JSON.

Inputs: [page controls](#page-controls), [loading controls](#loading-controls), and:

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `browserRendering` | boolean | `false` | Whether to render the page in a browser before returning the result. |
| `warmStart` | boolean | `false` | Whether to enable warm start for more reliable scraping, at the cost of additional latency. |
| `html` | boolean | `false` | Whether to include the page HTML in the response. |

Example input:

```json
{
  "url": "https://example.com",
  "html": true,
  "warmStart": true
}
```

Response: The default response body is Markdown text. Enabling HTML returns
JSON containing both HTML and Markdown.

### Get screenshot

Tool `getScreenshot`, factory `getScreenshotTool()`.

Capture a base64 screenshot of the full page or top viewport. Browser rendering is always enabled.

Inputs: [page controls](#page-controls), [loading controls](#loading-controls), and:

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `screenshot` | string: `full`, `top` | `"full"` | Screenshot area to capture: full for the entire page or top for the top viewport. |
| `html` | boolean | `true` | Whether to include the page HTML in the response. |
| `markdown` | boolean | `false` | Whether to include the page Markdown in the response. |

Example input:

```json
{
  "url": "https://example.com",
  "screenshot": "top",
  "html": false,
  "markdown": true
}
```

Response: The response body contains a base64 screenshot and requested page
outputs. The API can still include HTML when HTML output is disabled.

### Scrape brand

Tool `scrapeBrand`, factory `scrapeBrandTool()`.

Extract a website's colors, typography, logos, and social links as JSON.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `url` | string | Required | Absolute HTTP or HTTPS URL of the page to process. |

The HTTP deadline is fixed at 120 seconds. It is not a service parameter. The
request uses `action=brand-scraping` and `bundle=none`; page controls are not
accepted.

Example input:

```json
{
  "url": "https://example.com"
}
```

Response: The API body contains message and a data object with job_id,
status, url, final_url, brand, and error. Brand details are available at
data.data.brand in the response envelope.

### Scrape JSON

Tool `scrapeJson`, factory `scrapeJsonTool()`.

Extract structured JSON from a page using a natural-language prompt. Append Json Schema: and a JSON schema to shape the output.

Inputs: [page controls](#page-controls) and:

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `prompt` | string | `"Extract all data as complete as possible."` | Instructions describing the data to extract. Append Json Schema: and a JSON schema to shape the output. |
| `browserRendering` | boolean | `false` | Whether to render the page in a browser before returning the result. |
| `html` | boolean | `false` | Whether to include the page HTML in the response. |
| `screenshot` | boolean | `false` | Whether to include a base64 screenshot in the response. |

The request uses `agent=general` and GET. If the encoded URL exceeds 8,000
characters, it switches to POST with `url`, `prompt`, and `agent` in the body;
page controls remain in the query.

Example input:

```json
{
  "url": "https://example.com",
  "prompt": "Extract the first 2 items with title and price. Json Schema: {\"type\":\"array\",\"items\":{\"type\":\"object\",\"properties\":{\"title\":{\"type\":\"string\"},\"price\":{\"type\":\"string\"}},\"required\":[\"title\",\"price\"]}}",
  "browserRendering": true
}
```

Response: Extraction results are in the API body's data field and follow the
requested schema. Response metadata includes thread_id, token_usage, status,
error, runtime, and cookies. html, markdown, and screenshot can be empty
strings when not requested.

### Web search

Tool `webSearch`, factory `webSearchTool()`.

Search the web and return ranked results with titles, URLs, descriptions, and sources.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `query` | string | Required | Search query text, trimmed before sending, containing 1 to 1000 characters. |
| `country` | string | `"us"` | Two-letter country code to search from, sent in lowercase. |
| `numResults` | number (integer) | `10` | Number of search results to request, as an integer from 10 to 100. Fewer results may be returned. |

The HTTP deadline is fixed at 120 seconds. It is not a service parameter.

Example input:

```json
{
  "query": "site:example.com documentation",
  "country": "id",
  "numResults": 20
}
```

Response: The API body contains success, message, a data array, and
tokenUsage. Each result includes rank, title, url, description, and source.

## Response format

Each tool returns the `@mrscraper/sdk` response envelope (`MrScraperResponse`)
containing `status_code`, `data`, and `headers`. The `data` field contains the
API response body; its field names are not converted. Status preserves the
complete body without adding summary fields.

```json
{
  "status_code": 200,
  "data": "<html><body>Example page content...</body></html>",
  "headers": {
    "content-type": "text/html; charset=utf-8"
  }
}
```

The AI SDK sends tool results to the model as JSON. `getScreenshot`, and
`scrapeJson` when a screenshot is requested, send the base64 screenshot as an
image part instead, so a screenshot costs image tokens rather than hundreds of
thousands of text tokens. Your code still receives the base64 string in
`data.screenshot`.

## Error handling

Authentication, HTTP, network, and timeout failures throw `MrScraperError`
from `@mrscraper/sdk`, with the API key redacted. Its `status` property is the
HTTP status when available. The AI SDK reports a thrown error to the model as
a tool error. Inputs that do not match a tool's schema, including fields the
tool does not define, are rejected before any request.

## Integration features

### Configuration

`mrscraperTools()` and each factory accept `{ apiKey }`. TypeScript exports
include `MrScraperToolOptions`, an input type per tool (`StatusInput`,
`ScrapeHtmlInput`, `ScrapeMarkdownInput`, `GetScreenshotInput`,
`ScrapeBrandInput`, `ScrapeJsonInput`, `WebSearchInput`), and the SDK's
`MrScraperResponse`, `PageData`, `WebSearchResponse`, and `WebSearchResult`.

### Data and permissions

The tools send target URLs, search queries, and request options to MrScraper's
API. Use them only for public or otherwise authorized content, and follow the
target site's terms. See the [Privacy Policy](https://mrscraper.com/privacy-policy)
and [Acceptable Use Policy](https://mrscraper.com/acceptable-use-policy).

### Links

- Documentation: https://docs.mrscraper.com/docs/integrations/vercel-ai-sdk
- MrScraper MCP server (for MCP clients): https://github.com/mrscraper-com/mrscraper-mcp
- Support: support@mrscraper.com

## Migration

Upgrading from 0.2:

- `scraperAPI` (`scraperApiTool()`) is removed, and with it the `formats`
  input. Use `scrapeMarkdown` for Markdown (with `html: true` for both),
  `scrapeHtml` for raw HTML, or `getScreenshot` for a screenshot.
- Browser rendering no longer switches on automatically. It is off unless
  `browserRendering` is true; `getScreenshot` always renders. The page timeout
  defaults to 300 seconds (was 120).
- `webSearch`: rename `region` to `country`. `query` is search text; a search
  results URL is no longer read for its `q` parameter.
- `accountStatusTool()` is now `statusTool()`. It returns the raw account
  status response, with account details at `data.data`, instead of summary
  fields such as `token_remaining`.
- Every tool returns `{ status_code, data, headers }` with the API body in
  `data`. Search results are in `data.data`, each with `url` (was `link`).
  The `PageResult`, `PageFormat`, `SearchResult`, `SearchResultItem`,
  `ScraperApiInput`, and `AccountSummary` types are removed.
- `mrscraperTools()` adds `scrapeBrand` and `scrapeJson`. Pick individual
  tools if the model should not use them.

## Development and testing

The automated suite stubs `fetch` and makes no API calls.

```bash
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

## License

[MIT](LICENSE)
